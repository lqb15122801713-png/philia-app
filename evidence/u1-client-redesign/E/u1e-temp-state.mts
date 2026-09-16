/**
 * U1-C 验收临时脚本（不入库；执行后从 server/ 删除，卷宗存 evidence/u1-client-redesign/C/）
 * 用法：
 *   npx tsx u1c-temp-state.mts flip     种子 completed 洗护单 → in_service（步骤 1/2 done、3 active），先快照
 *   npx tsx u1c-temp-state.mts restore  从快照还原
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { db } from './src/db'
import { appointments, appointmentSteps } from './src/db/schema'

const APPT_ID = '01M256D240E19GWNG2QMFV3Q8V'
const SNAP = 'u1e-temp-snapshot.json'
const mode = process.argv[2]

if (mode === 'flip') {
  const appt = await db.select().from(appointments).where(eq(appointments.id, APPT_ID))
  const steps = await db.select().from(appointmentSteps).where(eq(appointmentSteps.appointmentId, APPT_ID))
  writeFileSync(SNAP, JSON.stringify({ appt, steps }, null, 2))
  console.log('snapshot saved:', appt[0]?.status, steps.map((s) => `${s.stepOrder}:${s.status}`).join(','))
  await db.update(appointments).set({ status: 'in_service' }).where(eq(appointments.id, APPT_ID))
  for (const s of steps) {
    const next = s.stepOrder <= 2 ? 'done' : s.stepOrder === 3 ? 'active' : 'locked'
    await db.update(appointmentSteps).set({ status: next }).where(eq(appointmentSteps.id, s.id))
  }
  console.log('flipped → in_service（步骤 1/2 done、3 active、余 locked）')
} else if (mode === 'restore') {
  const snap = JSON.parse(readFileSync(SNAP, 'utf8'))
  for (const a of snap.appt) {
    await db.update(appointments).set({ status: a.status }).where(eq(appointments.id, a.id))
  }
  for (const s of snap.steps) {
    await db.update(appointmentSteps).set({ status: s.status }).where(eq(appointmentSteps.id, s.id))
  }
  console.log('restored:', snap.appt[0]?.status)
} else {
  console.log('usage: flip | restore')
  process.exit(1)
}
process.exit(0)
