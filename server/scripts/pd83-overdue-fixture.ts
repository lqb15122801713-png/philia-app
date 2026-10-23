/**
 * PD-83 走测夹具：寄养超期单（写 CTA 闸验证用，真实窗口库，server 需在跑）
 *
 * 造两单（同店同人同宠，可复跑即弃——先清 note 前缀「【PD-83」的旧行再插）：
 * - overdue：in_boarding + stay 已登记 + 昨日打卡 1 条，scheduledEnd=昨天（超期真值）；
 * - control：in_boarding + stay 已登记，scheduledEnd=后天（正常在住对照组，证不误伤写口）。
 *
 * 纪律：不碰夹具 01M5EQVF；不跨店造种（全用种子首店）；金额仅字段值（pay_at_store），
 * 无任何支付动作（涉钱 mock 口径）。测完由走测脚本/手清 note 前缀行自清。
 *
 * 用法：PHILIA_DB_URL=file:<窗口库> node node_modules/tsx/dist/cli.mjs scripts/pd83-overdue-fixture.ts
 * 输出：JSON { overdueAid, controlAid, staffUserId, staffName, storeId }
 */
import { eq, like, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../src/db/index.js';

const NOTE_PREFIX = '【PD-83';

/* ---- 复跑即弃：清旧夹具（先子后父） ---- */
const stale = await db.select().from(schema.appointments)
  .where(like(schema.appointments.note, `${NOTE_PREFIX}%`)).all();
if (stale.length) {
  const ids = stale.map((a) => a.id);
  const stays = await db.select().from(schema.boardingStays)
    .where(inArray(schema.boardingStays.appointmentId, ids)).all();
  if (stays.length) {
    await db.delete(schema.boardingDailyLogs)
      .where(inArray(schema.boardingDailyLogs.stayId, stays.map((s) => s.id)));
    await db.delete(schema.boardingStays)
      .where(inArray(schema.boardingStays.appointmentId, ids));
  }
  await db.delete(schema.appointments).where(inArray(schema.appointments.id, ids));
  console.log(`  清旧夹具 ${stale.length} 单`);
}

/* ---- 种子实体 ---- */
const store = (await db.select().from(schema.stores).all())[0]!;
const customer = (await db.select().from(schema.users).all()).find((u) => u.nickname === '示例客户')!;
const pet = (await db.select().from(schema.pets).all())[0]!;
const service = (await db.select().from(schema.services).all()).find((s) => s.type === 'boarding')!;
const staffRec = await db.select().from(schema.staff).all()
  .then((rows) => rows.find((s) => JSON.stringify(s.skills).includes('boarding')));
if (!staffRec) throw new Error('无 boarding 技能员工');
const staffUser = (await db.select().from(schema.users).all()).find((u) => u.id === staffRec.userId)!;

const DAY = 86_400_000;
const now = Date.now();
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);

async function makeBoarding(opts: {
  code: string; startAgoDays: number; endOffsetDays: number; roomNo: string; tag: string;
  withYesterdayLog: boolean;
}) {
  const aid = `appt_pd83_${ulid()}`;
  await db.insert(schema.appointments).values({
    id: aid,
    code: opts.code,
    customerId: customer.id,
    storeId: store.id,
    staffId: staffRec.id,
    assignSource: 'merchant',
    petId: pet.id,
    serviceId: service.id,
    type: 'boarding',
    scheduledStart: new Date(now - opts.startAgoDays * DAY),
    scheduledEnd: new Date(now + opts.endOffsetDays * DAY),
    status: 'in_boarding',
    priceFen: 39900,
    paymentMode: 'pay_at_store',
    note: `${NOTE_PREFIX} ${opts.tag}（可复跑即弃）`,
  });
  const stayId = `stay_pd83_${ulid()}`;
  await db.insert(schema.boardingStays).values({
    id: stayId,
    appointmentId: aid,
    roomNo: opts.roomNo,
    checkinWeightKg: 5.6,
    belongings: [{ name: '猫抓板' }, { name: '常备粮半袋' }],
  });
  if (opts.withYesterdayLog) {
    await db.insert(schema.boardingDailyLogs).values({
      stayId,
      staffId: staffRec.id,
      logDate: isoDate(now - DAY),
      meals: [{ time: '09:00', food: '干粮 40g', finished: true }],
      walks: 1,
      note: '精神状态不错，食量正常。',
      photos: [],
    });
  }
  return aid;
}

const overdueAid = await makeBoarding({
  code: 'PD83A1', startAgoDays: 3, endOffsetDays: -1, roomNo: 'A-201',
  tag: '超期寄养合成单', withYesterdayLog: true,
});
const controlAid = await makeBoarding({
  code: 'PD83A2', startAgoDays: 1, endOffsetDays: 2, roomNo: 'A-202',
  tag: '在住对照单', withYesterdayLog: true,
});

console.log(JSON.stringify({
  overdueAid, controlAid,
  staffUserId: staffUser.id, staffName: staffRec.name, storeId: store.id,
}));
process.exit(0);
