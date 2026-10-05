/**
 * offlineQueue 纯逻辑冒烟（node 直跑，无 IndexedDB —— IDB 操作已抽薄层，本测试注入内存替身）
 *
 * 跑法：node apps/staff/scripts/offline-queue.smoke.mjs
 * 覆盖：
 *  1) 退避序列 2s/5s/15s/60s 封顶
 *  2) 永久拒绝判定（FORBIDDEN / 状态闸门 BAD_REQUEST）
 *  3) 断网入队 → 上线按 createdAt 顺序自动补齐；每条严格 upload → register → remove
 *  4) 瞬态失败：保序重试同一条（不跳过），退避调度序列正确
 *  5) 永久拒绝：丢记录 + onDropped + 继续后续记录
 *  6) upload 成功 register 失败：下轮重传同一条（不丢照片）
 */
import {
  createFlushEngine,
  flushBackoffDelay,
  isPermanentRegisterError,
  relDirOf,
} from '../src/lib/offlineQueue.ts'

let passed = 0
let failed = 0
function assert(cond, name) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

/* ---------- 1) 退避序列 ---------- */
console.log('1) 退避序列')
assert(flushBackoffDelay(1) === 2000, '第 1 次失败 → 2000ms')
assert(flushBackoffDelay(2) === 5000, '第 2 次失败 → 5000ms')
assert(flushBackoffDelay(3) === 15000, '第 3 次失败 → 15000ms')
assert(flushBackoffDelay(4) === 60000, '第 4 次失败 → 60000ms')
assert(flushBackoffDelay(9) === 60000, '第 9 次失败 → 封顶 60000ms')

/* ---------- 2) 永久拒绝判定 ---------- */
console.log('2) isPermanentRegisterError')
const trpcLike = (code, message) => ({ data: { code }, message })
assert(isPermanentRegisterError(trpcLike('FORBIDDEN', '「洗护」步骤当前为 done 状态，仅进行中（active）的步骤可上传照片')), 'FORBIDDEN 步骤状态 → 永久')
assert(isPermanentRegisterError(trpcLike('BAD_REQUEST', '「预检」步骤照片上限 6 张：当前未失效 6 张，本次 1 张超出上限')), 'BAD_REQUEST 超上限 → 永久')
assert(!isPermanentRegisterError(trpcLike('BAD_REQUEST', '网络抖动')), 'BAD_REQUEST 其他 → 瞬态')
assert(!isPermanentRegisterError(new Error('fetch failed')), '普通网络错误 → 瞬态')

/* ---------- 内存队列 + 事件日志替身 ---------- */
function makeWorld() {
  const store = new Map() // id -> rec
  const log = [] // 事件流：'upload:id' 'register:id' 'remove:id'
  const scheduled = [] // 记录的退避延迟序列
  let online = true
  let timerCbs = []
  const world = {
    store, log, scheduled,
    setOnline(v) { online = v },
    async runTimers() { const cbs = timerCbs; timerCbs = []; for (const cb of cbs) await cb() },
    deps(behavior) {
      return {
        loadAll: async () => [...store.values()],
        remove: async (id) => { log.push(`remove:${id}`); store.delete(id) },
        upload: async (blob, relDir) => {
          log.push(`upload:${blob.__rid}`)
          if (behavior.uploadFail?.(blob.__rid)) throw new Error('fetch failed')
          return { url: `u/${blob.__rid}`, thumbUrl: `t/${blob.__rid}` }
        },
        register: async (aid, stepKey, photo) => {
          const rid = photo.url.slice(2)
          log.push(`register:${rid}`)
          const r = behavior.registerFail?.(rid)
          if (r) throw r
        },
        onChange: () => log.push('onChange'),
        onDropped: (rec, err) => log.push(`dropped:${rec.id}`),
        isOnline: () => online,
        setTimeoutFn: (fn, ms) => { scheduled.push(ms); timerCbs.push(fn); return timerCbs.length },
        clearTimeoutFn: () => {},
      }
    },
  }
  return world
}
const rec = (id, createdAt) => ({ id, aid: 'a1', stepKey: 'grooming', blob: { __rid: id }, createdAt })

/* ---------- 3) 断网入队 → 上线顺序补齐 ---------- */
console.log('3) 断网入队 → 恢复后按序补齐（upload→register→remove 链）')
{
  const w = makeWorld()
  w.setOnline(false)
  const engine = createFlushEngine(w.deps({}))
  w.store.set('r1', rec('r1', 1)); w.store.set('r2', rec('r2', 2)); w.store.set('r3', rec('r3', 3))
  engine.kick()
  await new Promise((r) => setTimeout(r, 10))
  assert(w.log.length === 0, '离线时 kick 不动（无 upload）')
  w.setOnline(true) // 恢复网络
  engine.onOnline()
  await new Promise((r) => setTimeout(r, 10))
  const seq = w.log.filter((l) => !l.startsWith('onChange'))
  assert(JSON.stringify(seq) === JSON.stringify([
    'upload:r1', 'register:r1', 'remove:r1',
    'upload:r2', 'register:r2', 'remove:r2',
    'upload:r3', 'register:r3', 'remove:r3',
  ]), `严格保序且每条 upload→register→remove（实际：${seq.join(',')}）`)
  assert(w.store.size === 0, '冲完队列清空')
}

/* ---------- 4) 瞬态失败保序 + 退避 ---------- */
console.log('4) 瞬态失败：不跳过、退避 2s→5s、恢复后从同一条续传')
{
  const w = makeWorld()
  let fails = 2
  const engine = createFlushEngine(w.deps({
    registerFail: (rid) => (rid === 'r2' && fails-- > 0 ? new Error('HTTP 500') : null),
  }))
  w.store.set('r1', rec('r1', 1)); w.store.set('r2', rec('r2', 2)); w.store.set('r3', rec('r3', 3))
  engine.kick()
  await new Promise((r) => setTimeout(r, 10))
  assert(w.scheduled.length === 1 && w.scheduled[0] === 2000, `r2 失败后调度 2000ms（实际 ${w.scheduled}）`)
  assert(!w.log.includes('register:r3'), 'r2 卡住时 r3 不被抢先登记（保序）')
  await w.runTimers()
  await new Promise((r) => setTimeout(r, 10))
  assert(w.scheduled.length === 2 && w.scheduled[1] === 5000, `第二次失败调度 5000ms（实际 ${w.scheduled}）`)
  await w.runTimers()
  await new Promise((r) => setTimeout(r, 10))
  assert(w.store.size === 0 && w.log.includes('register:r3'), '恢复后 r2→r3 全部冲完')
}

/* ---------- 5) 永久拒绝：丢记录不卡队 ---------- */
console.log('5) 永久拒绝（步骤已被他人 confirm）：丢记录 + onDropped + 继续')
{
  const w = makeWorld()
  const engine = createFlushEngine(w.deps({
    registerFail: (rid) =>
      rid === 'r1'
        ? { data: { code: 'FORBIDDEN' }, message: '「洗护」步骤当前为 done 状态，仅进行中（active）的步骤可上传照片' }
        : null,
  }))
  w.store.set('r1', rec('r1', 1)); w.store.set('r2', rec('r2', 2))
  engine.kick()
  await new Promise((r) => setTimeout(r, 10))
  assert(w.log.includes('dropped:r1'), 'r1 被丢弃并 onDropped 回调')
  assert(!w.store.has('r1'), 'r1 记录已删（防队列毒化）')
  assert(w.log.includes('register:r2'), 'r2 正常继续登记')
}

/* ---------- 6) upload 成功 register 失败：不丢 ---------- */
console.log('6) upload 成功但 register 瞬态失败：下轮重传同一条（不丢照片）')
{
  const w = makeWorld()
  let once = true
  const engine = createFlushEngine(w.deps({
    registerFail: () => (once ? ((once = false), new Error('timeout')) : null),
  }))
  w.store.set('r1', rec('r1', 1))
  engine.kick()
  await new Promise((r) => setTimeout(r, 10))
  assert(w.store.has('r1'), 'register 失败记录保留')
  const uploadsBefore = w.log.filter((l) => l === 'upload:r1').length
  await w.runTimers()
  await new Promise((r) => setTimeout(r, 10))
  const uploadsAfter = w.log.filter((l) => l === 'upload:r1').length
  assert(uploadsBefore === 1 && uploadsAfter === 2, '重试重新 upload 同一条（服务端无双倍登记）')
  assert(!w.store.has('r1'), '最终 register 成功后删除')
}

console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
process.exit(failed ? 1 : 0)
