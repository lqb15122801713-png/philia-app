/**
 * 断网打卡暂存队列（员工端骨架整建批片 2 · 考勤 B1-3 员工端侧）
 *
 * - localStorage 队列（照片先例=offlineQueue.ts IndexedDB；打卡载荷纯文本小对象，localStorage 即可，
 *   免 IndexedDB 异步样板）；
 * - mark 网络失败时入队（业务拒绝如「不在门店范围」不入队——服务端已明确拒，重放无意义）；
 * - 重放时机：online 事件 / 窗口聚焦 / 30s 定时；补传调 attendance.mark 带
 *   source='offline_relay' + clientTs=原打点时刻（考勤口径=实际打点时刻，服务端超时兜底挂异常）；
 * - 重放成功出队；失败保留（下次再试，不无声丢卡）。
 */

import { safeUuid } from '@philia/shared/lib/safeUuid.ts';

export interface QueuedPunch {
  id: string;
  kind: 'in' | 'out';
  lat: number;
  lng: number;
  bssid?: string;
  photoUrl?: string;
  /** 设备端打点时刻（Unix 秒） */
  clientTs: number;
  deviceId: string;
}

const STORAGE_KEY = 'philia-staff-offline-punches';

/** 当前暂存条数（页面提示条用；读失败=0 不炸） */
export function pendingPunches(): QueuedPunch[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as QueuedPunch[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(rows: QueuedPunch[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // 存储满/隐私模式：暂存失败不阻断主流程（打卡本体已由 server 拒/成）
  }
}

function genId(): string {
  try {
    return safeUuid();
  } catch {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** 入队（返回完整队列记录；clientTs 由调用方在打点当下取定，之后不改） */
export function enqueuePunch(p: Omit<QueuedPunch, 'id'>): QueuedPunch {
  const rec: QueuedPunch = { ...p, id: genId() };
  writeAll([...pendingPunches(), rec]);
  return rec;
}

/** 出队（重放成功后调用；不存在不报错） */
export function removePunch(id: string): void {
  writeAll(pendingPunches().filter((r) => r.id !== id));
}

/**
 * 判定 mark 失败是否为「网络层失败」（应暂存补传）：
 * tRPC 业务拒绝（围栏外/参数错等）响应带 data.code；fetch 级断网失败无 data。
 */
export function isNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const code = (err as { data?: { code?: string } }).data?.code;
  return code === undefined;
}

/**
 * 启动后台补传器：
 * - 启动即冲一轮（在线才动）；
 * - window 'online' / 'focus' 事件即冲；
 * - 30s 定时兜底；
 * - 串行按入队序逐条 relay（= attendance.mark source='offline_relay'），成功出队、失败保留；
 * - 返回 cleanup（移除监听+停定时器）。
 */
export function startPunchRelayer(opts: {
  relay: (p: QueuedPunch) => Promise<unknown>;
  onChange?: () => void;
}): () => void {
  let stopped = false;
  let flushing = false;

  const flush = async (): Promise<void> => {
    if (stopped || flushing) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    flushing = true;
    try {
      for (const p of pendingPunches()) {
        if (stopped) return;
        try {
          await opts.relay(p);
          removePunch(p.id);
          opts.onChange?.();
        } catch {
          // 失败保留在队列，等下次 online/聚焦/定时再试（不无声丢卡）
        }
      }
    } finally {
      flushing = false;
    }
  };

  const onOnline = () => void flush();
  const onFocus = () => void flush();
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onFocus);
  const timer = window.setInterval(() => void flush(), 30_000);
  void flush();

  return () => {
    stopped = true;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onFocus);
    window.clearInterval(timer);
  };
}
