/**
 * 收银台离线暂存队列（批次 M1-补2 · R4 断网不静默）
 *
 * 口径（任务书 E）：
 * - 结账时离线（navigator.onLine=false 或 SSE 断开）→ 本地暂存
 *   （localStorage 队列，含购物车快照 + 已 hold 的 bill_no），明示
 *   「已暂存，待补传」——禁止只转「结账中…」；
 * - 补传链路（M1-Y1 口径落地）：无 billNo 的暂存单先 hold 取号再 settle；
 *   已有 billNo 的直接 settle——bill_no 幂等键（服务端 settle 幂等快路径，
 *   重复补传零副作用）；
 * - 恢复（online 事件 / SSE 重连）自动逐单串行补传，结果明示
 *   「补传成功 N 单 / 失败原因」；失败单保留队列待下轮（或人工处理）。
 *
 * 队列条目为纯 JSON（快照即 toCartSnapshot 输出，可直接回放到 hold/settle）。
 * 暂存上限 50 单（超出拒绝并明示——异常保护，正常营业不会触达）。
 */

import type { HoldInput, SettleInput } from './model'

export interface OfflineQueueEntry {
  /** 本地暂存 id（队列内唯一，与服务端单号无关） */
  localId: string
  /** 已 hold 取号的单号（取单回来后离线结账的场景）；null=补传时先 hold 取号 */
  billNo: string | null
  /** 购物车快照（hold/settle 共用入参） */
  snapshot: HoldInput
  /** 支付段（settle 入参；储值/次卡段已按结账时口径派生） */
  payments: SettleInput['payments']
  /** 暂存时刻（ms） */
  enqueuedAt: number
  /** 上次补传失败原因（保留队列待下轮/人工；展示用） */
  lastError?: string
}

const KEY = 'philia.cashierOfflineQueue'
const MAX_QUEUE = 50

/** 队列变更事件（同页签内 localStorage 无 storage 事件，自派发同步 UI 条数） */
export const OFFLINE_QUEUE_EVENT = 'philia.cashierOfflineQueue.changed'

export function loadOfflineQueue(): OfflineQueueEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    // 结构防御：脏数据行丢弃（不阻塞其余单）
    return (arr as OfflineQueueEntry[]).filter(
      (e) => e && typeof e.localId === 'string' && e.snapshot && Array.isArray(e.payments),
    )
  } catch {
    return []
  }
}

function saveOfflineQueue(list: OfflineQueueEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // localStorage 不可用/超限：静默（调用方 toast 已明示暂存动作）
  }
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT))
}

export function offlineQueueSize(): number {
  return loadOfflineQueue().length
}

/** 暂存一单；超过上限返回 false（调用方明示「暂存队列已满」） */
export function enqueueOffline(
  entry: Omit<OfflineQueueEntry, 'localId' | 'enqueuedAt'>,
): boolean {
  const list = loadOfflineQueue()
  if (list.length >= MAX_QUEUE) return false
  list.push({
    ...entry,
    localId: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: Date.now(),
  })
  saveOfflineQueue(list)
  return true
}

/**
 * 逐单串行补传（幂等键 bill_no）。返回 { ok, failed }；失败单保留队列并记 lastError。
 * trpc 句柄由调用方注入（避免本模块依赖 React context）。
 */
export async function flushOfflineQueue(trpc: {
  cashier: {
    hold: { mutate: (i: HoldInput) => Promise<{ bill: { billNo: string } }> }
    settle: { mutate: (i: SettleInput) => Promise<unknown> }
  }
}): Promise<{ ok: number; failed: Array<{ entry: OfflineQueueEntry; reason: string }>; networkDown: boolean }> {
  const failed: Array<{ entry: OfflineQueueEntry; reason: string }> = []
  let ok = 0
  let networkDown = false
  // 每轮重新读队列（前单可能改动 lastError）
  for (;;) {
    const list = loadOfflineQueue()
    const next = list.find((e) => e.lastError === undefined || e.lastError === '')
    if (!next) break
    try {
      // M1-Y1 口径：先 hold 取号再 settle（已有 billNo 的直接 settle，幂等）
      let billNo = next.billNo
      if (!billNo) {
        const held = await trpc.cashier.hold.mutate(next.snapshot)
        billNo = held.bill.billNo
      }
      await trpc.cashier.settle.mutate({ ...next.snapshot, billNo, payments: next.payments })
      ok += 1
      saveOfflineQueue(loadOfflineQueue().filter((e) => e.localId !== next.localId))
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      // 网络层又断了 → 不记 lastError（不占用「失败留痕」位，下轮仍重试），停止本轮
      if (isNetworkError(err)) {
        networkDown = true
        break
      }
      failed.push({ entry: next, reason })
      saveOfflineQueue(
        loadOfflineQueue().map((e) => (e.localId === next.localId ? { ...e, lastError: reason } : e)),
      )
    }
  }
  return { ok, failed, networkDown }
}

/** tRPC 网络层错误判定（fetch 失败/断网）；业务错误（400/403/CONFLICT）不算 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const m = err.message.toLowerCase()
    return (
      m.includes('failed to fetch') ||
      m.includes('networkerror') ||
      m.includes('network request failed') ||
      m.includes('load failed')
    )
  }
  return false
}
