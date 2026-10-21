/**
 * PD-64（M-1 时段提前量 UI）一条测试：
 * 1. 距开场 <1h 的 slot 不可进入已选态（isSlotSelectable=false，栅格禁用／点选拦截；
 *    retainSelectedSlot 同样拒绝——已选态无从形成）；
 * 2. 拒约／409（CONFLICT＝不可约语义）后该槽出可约集，底栏「已选」清零不残留
 *    （retainSelectedSlot(slot, 不含该槽的可约集) → null）；
 * 3. 边界与服务端同帧：t == now+1h 可约（server 剔除口径 t < now+1h），>1h 可约槽保留已选。
 *
 * 运行：node server/node_modules/tsx/dist/cli.mjs --test apps/customer/src/components/booking/single/slotGrid.test.ts
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { isSlotSelectable, retainSelectedSlot, LEAD_BUFFER_MS } from './slotGrid'

test('PD-64 M-1：距开场 <1h 的 slot 不可进入已选态；409 后底栏无已选', () => {
  const now = 1_800_000_000_000 // 固定参照时刻（测试与墙钟无关）

  // ① 距开场 <1h（now+30min），即使在（滞留的）可约集内也不可进入已选态
  const nearSlot = new Date(now + 30 * 60_000)
  const staleAvailable = new Set([nearSlot.getTime()])
  assert.equal(isSlotSelectable(nearSlot, staleAvailable, now), false)
  assert.equal(retainSelectedSlot(nearSlot, staleAvailable, now), null)

  // ③ 边界同帧：t == now+1h 可约（server 口径 t < now+1h 才剔）；>1h 可约槽正常保留已选
  const edgeSlot = new Date(now + LEAD_BUFFER_MS)
  const okSlot = new Date(now + 2 * 60 * 60_000)
  const available = new Set([edgeSlot.getTime(), okSlot.getTime()])
  assert.equal(isSlotSelectable(edgeSlot, available, now), true)
  assert.equal(retainSelectedSlot(okSlot, available, now)?.getTime(), okSlot.getTime())

  // ② 拒约／409 后：服务端按不可约口径将该槽剔出可约集（refetch 后的新鲜集不含它），
  //    底栏「已选」必须清零——保留口径派生为 null，不得残留
  const afterConflictAvailable = new Set([edgeSlot.getTime()]) // 409 后 okSlot 出集
  assert.equal(retainSelectedSlot(okSlot, afterConflictAvailable, now), null)
})
