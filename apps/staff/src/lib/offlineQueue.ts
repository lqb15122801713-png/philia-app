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
 *
 * 不丢照片证明链（冲一条的顺序）：upload 成功 → register(addPhotos 落库) 成功 → 才删队列记录。
 * 任一步失败记录保留：瞬态失败按 2s/5s/15s/60s 退避重试同一条（不跳过、保序）；
 * 永久拒绝（步骤已 done/locked、超 max 上限等）重试永远不会成功，删记录防队列毒化并通知 UI。
 * 唯一会"丢"的情形是服务端永久拒绝——此时服务端已有等效数据或状态机已推进，本地副本无登记意义。
 */

/* ------------------------------------------------------------------ */
/* 契约类型（逐字）                                                      */
/* ------------------------------------------------------------------ */

export interface QueuedPhoto { id: string; aid: string; stepKey: string; blob: Blob; createdAt: number }

/** 照片标签（before_after 步 before/after；其余 normal）——兼容扩展，不改动契约字段 */
export type PhotoTag = 'normal' | 'before' | 'after'

/**
 * 队列记录的内部完整形态：契约 QueuedPhoto + 可选 tag。
 * pendingPhotos 按契约返回 QueuedPhoto[]，运行时记录携带 tag，
 * 用 photoTagOf() 读取（before_after 双卡槽按 tag 归位）。
 */
export type QueuedPhotoRecord = QueuedPhoto & { tag?: PhotoTag }

/** 读记录的 tag（缺省 normal） */
export function photoTagOf(rec: QueuedPhoto): PhotoTag {
  return (rec as QueuedPhotoRecord).tag ?? 'normal'
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
 * 判断 register(addPhotos) 的失败是否为「永久拒绝」（重试永远不会成功）：
 * - FORBIDDEN：步骤状态已变（如已被他人 confirm 成 done / 被打标回退）或归属已变；
 * - BAD_REQUEST 且文案为状态闸门 / 超上限 / 缺 tag：服务端校验硬拒绝。
 * 这类错误继续退避重试只会毒化队列（卡在后面所有记录前面），必须丢弃并通知 UI。
 */
export function isPermanentRegisterError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { data?: { code?: string }; message?: string }
  const code = e.data?.code
  const msg = typeof e.message === 'string' ? e.message : ''
  if (code === 'FORBIDDEN') return true
  if (code === 'BAD_REQUEST') {
    return msg.includes('仅进行中') || msg.includes('超出上限') || msg.includes('标记 before / after')
  }
  return false
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

/* ------------------------------------------------------------------ */
/* 队列读写 API（契约 2）                                                 */
/* ------------------------------------------------------------------ */

function genId(): string {
  try {
    return crypto.randomUUID()
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

/** 删队列记录（契约签名，逐字）；不存在不报错（幂等） */
export async function removePhoto(id: string): Promise<void> {
  await idbDelete(id)
}

/* ------------------------------------------------------------------ */
/* 冲队列引擎（依赖注入，node 冒烟可测）                                   */
/* ------------------------------------------------------------------ */

export interface FlushEngineDeps {
  loadAll(): Promise<QueuedPhotoRecord[]>
  remove(id: string): Promise<void>
  upload(blob: Blob, relDir: string): Promise<{ url: string; thumbUrl: string }>
  register(
    aid: string,
    stepKey: string,
    photo: { url: string; thumbUrl: string; tag?: PhotoTag },
  ): Promise<void>
  onChange?: () => void
  onDropped?: (rec: QueuedPhoto, err: unknown) => void
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
 * - 永久拒绝：删记录 + onDropped + onChange（见 isPermanentRegisterError 注释）。
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
        try {
          // —— 冲一条 = upload → register(addPhotos 落库) → 才删记录（不丢照片证明链）——
          const up = await deps.upload(rec.blob, relDirOf(rec.aid, rec.stepKey))
          const tag = photoTagOf(rec)
          await deps.register(rec.aid, rec.stepKey, {
            url: up.url,
            thumbUrl: up.thumbUrl,
            ...(tag !== 'normal' ? { tag } : {}),
          })
          await deps.remove(rec.id)
          failures = 0 // 有进展即清退避
          deps.onChange?.()
        } catch (err) {
          if (isPermanentRegisterError(err)) {
            // 步骤状态被拒（如该步已被他人 confirm 成 done、已超 max 上限）：
            // 重试永远不会成功。服务端状态机已推进（等效数据在服务端或已无登记意义），
            // 删记录防队列毒化，onChange 通知 UI 刷新（以 list 服务端真图为准）。
            try {
              await deps.remove(rec.id)
            } catch {
              // 删除失败不阻断主流程，下轮再处理
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
  upload: (blob: Blob, relDir: string) => Promise<{ url: string; thumbUrl: string }>
  register: (aid: string, stepKey: string, photo: { url: string; thumbUrl: string }) => Promise<void> // serviceStep.addPhotos
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
