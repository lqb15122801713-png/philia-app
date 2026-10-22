/**
 * 弱网上传队列（契约 docs/STAFF-CONTRACTS.md 契约 2 · T3.3 实现，T3.4 寄养端复用）
 *
 * —— 契约 2 原文（逐字，本文件严格保持以下签名）——
 * ```ts
 * export interface QueuedPhoto { id: string; aid: string; stepKey: string; blob: Blob; createdAt: number }
 * export function enqueuePhoto(p: Omit<QueuedPhoto, 'id' | 'createdAt'>): Promise<string>
 * export function pendingPhotos(aid: string, stepKey?: string): Promise<QueuedPhoto[]>
 * export function removePhoto(id: string): Promise<void>
 * export function startQueueFlusher(opts: {
 *   upload: (blob: Blob, relDir: string) => Promise<{ url: string; thumbUrl: string }>;
 *   register: (aid: string, stepKey: string, photo: { url: string; thumbUrl: string }) => Promise<void>; // serviceStep.addPhotos
 *   onChange?: () => void;
 * }): () => void
 * ```
 *
 * 兼容扩展（契约字段全部保留，仅新增可选能力，T3.4 按契约原样调用不受影响）：
 * - PhotoTag / enqueuePhotoWithTag：before_after 步需要 before/after 标签才能过服务端校验
 *   （serviceStep.addPhotos 要求 before_after 步每张照片带 tag），tag 随记录入队并在
 *   register 回调时透传（register 的 photo 实参上会多出可选 tag 字段，契约类型不变）。
 * - startQueueFlusher 的 opts 增加可选 onDropped(rec, err)：登记被服务端永久拒绝（步骤状态
 *   已变 / 超上限）而丢弃记录时回调，供 UI toast。
 * - 片 3 B5-2（拍照只许现场拍，前端半）：upload 响应可携 exifTakenAt（server 从原图 EXIF
 *   DateTimeOriginal 解析；秒 epoch 或 ISO 串，原样透传不解释），flushRound 冲一条时把它
 *   放进 register 的 photo.clientTakenAt（addPhotos 入参透传，契约类型不变的可选扩展）。
 * - PD-76（R6-02/R7-01 上传状态机）：记录可带 rejected 原因串（服务端拒收文案原样透传）。
 *   register(addPhotos) 被服务端拒收（FORBIDDEN / 任意 BAD_REQUEST）→ 记录标 rejected 留在
 *   队列（不再删除），flusher 之后跳过该条（不自动重试、不堵后续记录）；UI 在缩略图位单处
 *   显示拒收态＋原因＋「重拍/重试」。retryQueuedPhoto(id) 清标记并立即补冲；removePhoto(id)
 *   即「重拍」的丢弃语义。网络/瞬态错误（无 data.code）仍走 2s/5s/15s/60s 退避自动重试。
 *   addPhotos 判定规则（服务端何时拒收）不在本文件、本令也不改。
 *
 * 不丢照片证明链（冲一条的顺序）：upload 成功 → register(addPhotos 落库) 成功 → 才删队列记录。
 * 任一步失败记录保留：瞬态失败按 2s/5s/15s/60s 退避重试同一条（不跳过、保序）；
 * 服务端永久拒绝（步骤已 done/locked、超 max 上限、拍摄时刻不在服务窗口等）重试无意义——
 * PD-76 起不再静默删除：记录标 rejected＋原因文案留队（跳过不堵队），由 UI 单处显示并给人
 * 「重拍/重试」选择；唯用户主动「重拍」（removePhoto）才丢本地副本。
 */

import { safeUuid } from '@philia/shared/lib/safeUuid.ts'

/* ------------------------------------------------------------------ */
/* 契约类型（逐字）                                                      */
/* ------------------------------------------------------------------ */

export interface QueuedPhoto { id: string; aid: string; stepKey: string; blob: Blob; createdAt: number }

/** 照片标签（before_after 步 before/after；其余 normal）——兼容扩展，不改动契约字段 */
export type PhotoTag = 'normal' | 'before' | 'after'

/**
 * 队列记录的内部完整形态：契约 QueuedPhoto + 可选 tag + 可选 rejected。
 * pendingPhotos 按契约返回 QueuedPhoto[]，运行时记录携带 tag/rejected，
 * 用 photoTagOf() / photoRejectionOf() 读取（before_after 双卡槽按 tag 归位；
 * PD-76：rejected=服务端拒收原因原文，非空即拒收态——flusher 跳过、UI 单处显示）。
 */
export type QueuedPhotoRecord = QueuedPhoto & { tag?: PhotoTag; rejected?: string }

/** 读记录的 tag（缺省 normal） */
export function photoTagOf(rec: QueuedPhoto): PhotoTag {
  return (rec as QueuedPhotoRecord).tag ?? 'normal'
}

/** PD-76：读记录的拒收原因（无/空串 → null=未拒收） */
export function photoRejectionOf(rec: QueuedPhoto): string | null {
  const r = (rec as QueuedPhotoRecord).rejected
  return typeof r === 'string' && r ? r : null
}

/* ------------------------------------------------------------------ */
/* 常量与纯逻辑（node 冒烟可测，不依赖 IndexedDB / window）               */
/* ------------------------------------------------------------------ */

/** IndexedDB 库名（契约指定） */
export const QUEUE_DB_NAME = 'philia-staff-queue'
const STORE_NAME = 'photos'

/** 失败退避序列（毫秒）：2s / 5s / 15s / 60s 封顶（契约指定） */
export const QUEUE_BACKOFF_DELAYS = [2000, 5000, 15000, 60000] as const

/** 第 failures 次连续失败（从 1 计）的等待毫秒数；超过序列末尾后封顶 60s */
export function flushBackoffDelay(failures: number): number {
  const idx = Math.min(Math.max(failures - 1, 0), QUEUE_BACKOFF_DELAYS.length - 1)
  return QUEUE_BACKOFF_DELAYS[idx]
}

/**
 * 判断 register(addPhotos) 的失败是否为「服务端永久拒收」（自动重试无意义）：
 * - FORBIDDEN：步骤状态已变（如已被他人 confirm 成 done / 被打标回退）或归属已变；
 * - BAD_REQUEST（addPhotos 400 全口径）：状态闸门 / 超上限 / 缺 tag / 拍摄时刻不在服务窗口等
 *   服务端校验硬拒绝——PD-76 起一律转拒收态，message 原文透传给 UI（判定规则不在本文件、不改）。
 * 瞬态错误（网络抖动、5xx、无 data.code 的普通 Error）返回 false，继续退避自动重试。
 */
export function isPermanentRegisterError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { data?: { code?: string }; message?: string }
  const code = e.data?.code
  if (code === 'FORBIDDEN') return true
  if (code === 'BAD_REQUEST') return true
  return false
}

/** 拒收原因文案：服务端 message 原样透传（取不到给兜底口语） */
export function rejectionReasonOf(err: unknown): string {
  const msg = (err as { message?: unknown } | null)?.message
  return typeof msg === 'string' && msg ? msg : '服务端未接收这张照片，请重拍或重试'
}

/** 上传存储目录（server storage/images.ts 约定形如 `appointment/<aid>/<stepKey>`） */
export function relDirOf(aid: string, stepKey: string): string {
  return `appointment/${aid}/${stepKey}`
}

/* ------------------------------------------------------------------ */
/* IndexedDB 薄层（原生 API，不引库；全部操作经此层，便于纯逻辑冒烟替身）   */
/* ------------------------------------------------------------------ */

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error ?? new Error('IndexedDB 打开失败'))
    }
  })
  return dbPromise
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'))
  })
}

async function idbPut(rec: QueuedPhotoRecord): Promise<void> {
  const db = await openDb()
  await reqResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(rec))
}

async function idbAll(): Promise<QueuedPhotoRecord[]> {
  const db = await openDb()
  const rows = await reqResult(
    db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
  )
  return (rows ?? []) as QueuedPhotoRecord[]
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb()
  await reqResult(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id))
}

/** PD-76：读单条（retryQueuedPhoto / markRejected 用） */
async function idbGet(id: string): Promise<QueuedPhotoRecord | undefined> {
  const db = await openDb()
  const rec = await reqResult(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id))
  return rec as QueuedPhotoRecord | undefined
}

/* ------------------------------------------------------------------ */
/* 队列读写 API（契约 2）                                                 */
/* ------------------------------------------------------------------ */

function genId(): string {
  try {
    return safeUuid()
  } catch {
    return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  }
}

/** 模块级 flusher 注册表：入队即通知在线的 flusher 立即开冲（在线即冲） */
const enqueuedListeners = new Set<() => void>()
function notifyEnqueued(): void {
  for (const fn of enqueuedListeners) fn()
}

/** 入队（契约签名，逐字）。立即通知所有运行中的 flusher 开冲。 */
export async function enqueuePhoto(p: Omit<QueuedPhoto, 'id' | 'createdAt'>): Promise<string> {
  return enqueuePhotoWithTag(p)
}

/** 入队并携带 tag（before_after 步 before/after 用；兼容扩展） */
export async function enqueuePhotoWithTag(
  p: Omit<QueuedPhoto, 'id' | 'createdAt'>,
  tag?: PhotoTag,
): Promise<string> {
  const id = genId()
  const rec: QueuedPhotoRecord = { ...p, id, createdAt: Date.now(), ...(tag ? { tag } : {}) }
  await idbPut(rec)
  notifyEnqueued()
  return id
}

/** 查待上传队列（契约签名，逐字）；按 createdAt 升序（= 入队顺序 = 补传顺序） */
export async function pendingPhotos(aid: string, stepKey?: string): Promise<QueuedPhoto[]> {
  const all = await idbAll()
  return all
    .filter((r) => r.aid === aid && (stepKey === undefined || r.stepKey === stepKey))
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
}

/** 删队列记录（契约签名，逐字）；不存在不报错（幂等）。PD-76：「重拍」= 弃掉本地副本走此 */
export async function removePhoto(id: string): Promise<void> {
  await idbDelete(id)
}

/**
 * PD-76 状态机 retry 边：清拒收标记并立即通知在冲的 flusher 补冲（在线即重传）。
 * 记录不存在/未拒收 → false；清成功 → true。
 */
export async function retryQueuedPhoto(id: string): Promise<boolean> {
  const rec = await idbGet(id)
  if (!rec || !photoRejectionOf(rec)) return false
  const next = { ...rec }
  delete next.rejected
  await idbPut(next)
  notifyEnqueued()
  return true
}

/* ------------------------------------------------------------------ */
/* 冲队列引擎（依赖注入，node 冒烟可测）                                   */
/* ------------------------------------------------------------------ */

export interface FlushEngineDeps {
  loadAll(): Promise<QueuedPhotoRecord[]>
  remove(id: string): Promise<void>
  /** 片 3 B5-2：上传响应可携 exifTakenAt（服务端 EXIF 拍摄时刻，原样透传） */
  upload(blob: Blob, relDir: string): Promise<{ url: string; thumbUrl: string; exifTakenAt?: number | string | null }>
  register(
    aid: string,
    stepKey: string,
    photo: { url: string; thumbUrl: string; tag?: PhotoTag; clientTakenAt?: number | string },
  ): Promise<void>
  onChange?: () => void
  onDropped?: (rec: QueuedPhoto, err: unknown) => void
  /** PD-76：永久拒收时标 rejected＋原因留队（提供则不再删记录；缺省回落旧径=删记录） */
  markRejected?: (id: string, reason: string) => Promise<void>
  isOnline(): boolean
  setTimeoutFn: (fn: () => void, ms: number) => unknown
  clearTimeoutFn: (handle: unknown) => void
}

export interface FlushEngine {
  /** 立即尝试冲一轮（在线才动；已在冲则标记补一轮） */
  kick(): void
  /** 'online' 事件语义：重置退避并立即冲 */
  onOnline(): void
  dispose(): void
  /** 测试观测用：当前连续失败次数 */
  failureCount(): number
}

/**
 * 冲队列引擎（纯逻辑分层）：
 * - 串行保序：按 createdAt 升序逐条 upload → register → remove，一条失败本轮中止，
 *   下轮从同一条重试（绝不跳过乱序）；
 * - 退避：连续失败按 2s/5s/15s/60s 调度下一轮；任意一条成功即清零；
 * - PD-76：已标 rejected 的记录跳过（不自动重试、不堵队；由 retryQueuedPhoto 手动复活）；
 * - 永久拒绝：有 markRejected 则标 rejected＋原因留队（UI 单处显示，可重拍/重试），
 *   否则回落旧径删记录；两径均 onDropped + onChange（见 isPermanentRegisterError 注释）。
 */
export function createFlushEngine(deps: FlushEngineDeps): FlushEngine {
  let stopped = false
  let flushing = false
  let wantMore = false
  let failures = 0
  let timer: unknown = null

  const clearTimer = () => {
    if (timer !== null) {
      deps.clearTimeoutFn(timer)
      timer = null
    }
  }

  const scheduleRetry = () => {
    clearTimer()
    const delay = flushBackoffDelay(failures)
    timer = deps.setTimeoutFn(() => {
      timer = null
      void flushRound()
    }, delay)
  }

  const flushRound = async (): Promise<void> => {
    if (stopped) return
    if (flushing) {
      wantMore = true
      return
    }
    if (!deps.isOnline()) return // 离线不动，等 'online' / 下次入队
    flushing = true
    try {
      const records = (await deps.loadAll()).sort(
        (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1),
      )
      for (const rec of records) {
        if (stopped) return
        if (!deps.isOnline()) return // 冲到一半掉线：停下等 online
        if (photoRejectionOf(rec) !== null) continue // PD-76：拒收态不自动重试，跳过不堵队
        try {
          // —— 冲一条 = upload → register(addPhotos 落库) → 才删记录（不丢照片证明链）——
          const up = await deps.upload(rec.blob, relDirOf(rec.aid, rec.stepKey))
          const tag = photoTagOf(rec)
          await deps.register(rec.aid, rec.stepKey, {
            url: up.url,
            thumbUrl: up.thumbUrl,
            ...(tag !== 'normal' ? { tag } : {}),
            // 片 3 B5-2：EXIF 拍摄时刻随登记透传（clientTakenAt；无则不传，服务端按缺失口径留痕）
            ...(up.exifTakenAt != null ? { clientTakenAt: up.exifTakenAt } : {}),
          })
          await deps.remove(rec.id)
          failures = 0 // 有进展即清退避
          deps.onChange?.()
        } catch (err) {
          if (isPermanentRegisterError(err)) {
            // 服务端永久拒收（步骤已被他人 confirm 成 done、超 max 上限、拍摄时刻不在服务窗口等）：
            // 自动重试永远不会成功。PD-76：标 rejected＋原因原文留队（flusher 跳过不毒化队列），
            // UI 在缩略图位单处显示拒收态＋「重拍/重试」；无 markRejected 的旧调用方回落删记录。
            if (deps.markRejected) {
              try {
                await deps.markRejected(rec.id, rejectionReasonOf(err))
              } catch {
                // 标记失败不阻断主流程，下轮再处理
              }
            } else {
              try {
                await deps.remove(rec.id)
              } catch {
                // 删除失败不阻断主流程，下轮再处理
              }
            }
            deps.onDropped?.(rec, err)
            deps.onChange?.()
            continue
          }
          // 瞬态失败：本轮中止，保序——下轮仍从这条开始
          failures += 1
          scheduleRetry()
          return
        }
      }
      // 一轮冲完：队列已空（或仅剩本轮新入队的），有新增则补一轮
    } finally {
      flushing = false
    }
    if (wantMore && !stopped) {
      wantMore = false
      void flushRound()
    }
  }

  return {
    kick() {
      void flushRound()
    },
    onOnline() {
      failures = 0
      clearTimer()
      void flushRound()
    },
    dispose() {
      stopped = true
      clearTimer()
    },
    failureCount() {
      return failures
    },
  }
}

/* ------------------------------------------------------------------ */
/* startQueueFlusher（契约 2 · 浏览器装配）                               */
/* ------------------------------------------------------------------ */

/**
 * 启动后台冲队列（契约签名，逐字）：
 * - 启动时在线即冲一轮；
 * - window 'online' 事件即冲（并重置退避）；
 * - 入队（enqueuePhoto/enqueuePhotoWithTag）立即冲；
 * - 返回 cleanup：移除监听、清定时器、停引擎。
 */
export function startQueueFlusher(opts: {
  /** 片 3 B5-2：上传响应可携 exifTakenAt（服务端 EXIF 拍摄时刻，原样透传进 register） */
  upload: (blob: Blob, relDir: string) => Promise<{ url: string; thumbUrl: string; exifTakenAt?: number | string | null }>
  register: (aid: string, stepKey: string, photo: { url: string; thumbUrl: string; tag?: PhotoTag; clientTakenAt?: number | string }) => Promise<void> // serviceStep.addPhotos
  onChange?: () => void
  /** 兼容扩展：记录被永久拒绝丢弃时回调（供 UI toast） */
  onDropped?: (rec: QueuedPhoto, err: unknown) => void
}): () => void {
  const engine = createFlushEngine({
    loadAll: idbAll,
    remove: idbDelete,
    upload: opts.upload,
    register: (aid, stepKey, photo) => opts.register(aid, stepKey, photo),
    onChange: opts.onChange,
    onDropped: opts.onDropped,
    // PD-76：浏览器装配恒走「标 rejected 留队」新径（UI 拒收态＋重拍/重试）
    markRejected: async (id, reason) => {
      const rec = await idbGet(id)
      if (!rec) return
      await idbPut({ ...rec, rejected: reason })
    },
    isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
    setTimeoutFn: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeoutFn: (h) => window.clearTimeout(h as number),
  })

  const handleEnqueued = () => engine.kick()
  const handleOnline = () => engine.onOnline()
  enqueuedListeners.add(handleEnqueued)
  window.addEventListener('online', handleOnline)

  // 在线即冲（启动先把积压的补掉）
  engine.kick()

  return () => {
    enqueuedListeners.delete(handleEnqueued)
    window.removeEventListener('online', handleOnline)
    engine.dispose()
  }
}
