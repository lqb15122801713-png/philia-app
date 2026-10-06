/**
 * 照护/提醒定时扫描族（客户端体验大批片 4 · 通知触达与服务过程连带件）
 *
 * 四个幂等扫描函数，index.ts 定时器与 e2e 直调同函数（钉时刻断言=传入 now 钉死）：
 * - sweepPetDueReminders：疫苗/驱虫到期提醒（盘点表 A12）——pets.vaccine_valid_until
 *   与 pet_health_records.next_due_date 双源，到期前 pet_due_remind_days 天内
 *   （含逾期宽限同天数）通知主人；当日当项幂等（存在性锚=同日同 type 同 link 行）。
 * - sweepBoardingDayNight：寄养早晚定时推送（盘点表 B18 缺半）——在住单（未退房+
 *   预约 in_boarding）于早晚刻点（boarding_daynight_push 端口，缺省 08:30/20:30，
 *   门店时区 30 分钟窗口）推主人一条「早安/晚安播报」（当日打卡摘要）；当日当槽幂等。
 * - sweepCareLogReminders：照护日志 4 小时定时打卡提醒（盘点表 B19）——在住单距
 *   上次打卡（无打卡=入住登记时刻）超 care_log_remind_hours（缺省 4）小时→通知
 *   本店全部在职员工打卡；同一员工同单间隔内幂等；夜间 22:00–08:00 不打扰。
 * - sweepIncidentEscalations：异常 15 分钟双通知升级半（B18 连带 B16）——通报超
 *   incident_escalate_minutes（缺省 15）未处置→置 escalated_at + 主人与门店双方
 *   再落一条升级通知（escalated_at 非空即幂等锚，重扫零副作用）。
 *
 * 全部 crash-safe：调用方逐函数 try/catch；函数内逐行 try/catch 不拖垮整批。
 * 通知一律直插 notifications（类型/标题/正文/link 显式给），不经 emitEvent——
 * 定时器无 SSE 即时广播语义，与 index.ts runXpCompletionSweep 同工艺。
 */

import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { schema, type db as DbT } from '../db';
import { storeDayStartMs, storeWallclock } from '../routers/appointment';
import { resolveScopedRules } from '../routers/configRules';

type Db = typeof DbT;

/* ------------------------------------------------------------------ */
/* 配置端口读数（service_rules active 行最高版本；缺行/缺字段回落缺省值）      */
/* ------------------------------------------------------------------ */

async function ruleValue(d: Db, ruleKey: string, storeId?: string | null): Promise<Record<string, unknown> | null> {
  const rows = await d
    .select({ ruleKey: schema.serviceRules.ruleKey, valueJson: schema.serviceRules.valueJson, storeId: schema.serviceRules.storeId })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, ruleKey), eq(schema.serviceRules.active, true)))
    .orderBy(desc(schema.serviceRules.version));
  /* 大批片 2 分层：传 storeId 按本店作用域解析（本店覆盖行优先）；不传=既有全量口径
     （四个滴答均为全域扫描无单店上下文，调用点不传——单活跃行不变式下=最新端口值） */
  const row = (storeId === undefined ? rows : resolveScopedRules(rows, storeId))[0];
  return row?.valueJson ?? null;
}

const numOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const strOr = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : fallback;

/** 当日已有同 userId+type+link 通知即跳过（当日幂等锚；dayStartMs=门店时区日界） */
async function notifiedToday(
  d: Db,
  userId: string,
  type: string,
  link: string,
  dayStartMs: number,
): Promise<boolean> {
  const row = await d
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.type, type),
        eq(schema.notifications.link, link),
        gte(schema.notifications.createdAt, new Date(dayStartMs)),
      ),
    )
    .get();
  return !!row;
}

/* ------------------------------------------------------------------ */
/* 1. 疫苗/驱虫到期提醒                                                    */
/* ------------------------------------------------------------------ */

export async function sweepPetDueReminders(d: Db, now: Date): Promise<number> {
  const days = numOr((await ruleValue(d, 'pet_due_remind_days'))?.days, 7);
  const w = storeWallclock(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${w.y}-${pad(w.m)}-${pad(w.day)}`;
  const soon = new Date(storeDayStartMs(w.y, w.m, w.day) + days * 24 * 3600 * 1000);
  const sw = storeWallclock(soon);
  const soonStr = `${sw.y}-${pad(sw.m)}-${pad(sw.day)}`;
  const past = new Date(storeDayStartMs(w.y, w.m, w.day) - days * 24 * 3600 * 1000);
  const pw = storeWallclock(past);
  const pastStr = `${pw.y}-${pad(pw.m)}-${pad(pw.day)}`;
  const dayStartMs = storeDayStartMs(w.y, w.m, w.day);
  let sent = 0;

  /* 源一：pets.vaccine_valid_until（既有单字段） */
  const petsDue = await d
    .select({
      id: schema.pets.id,
      name: schema.pets.name,
      ownerId: schema.pets.ownerId,
      due: schema.pets.vaccineValidUntil,
    })
    .from(schema.pets)
    .where(
      and(
        isNull(schema.pets.deletedAt),
        lte(schema.pets.vaccineValidUntil, soonStr),
        gte(schema.pets.vaccineValidUntil, pastStr),
      ),
    );
  for (const p of petsDue) {
    try {
      const link = `/philia/pets/${p.id}`;
      if (await notifiedToday(d, p.ownerId, 'pet.vaccineDue', link, dayStartMs)) continue;
      const overdue = p.due! < todayStr;
      await d.insert(schema.notifications).values({
        userId: p.ownerId,
        type: 'pet.vaccineDue',
        category: 'service',
        title: '疫苗到期提醒',
        body: overdue
          ? `【${p.name}】的疫苗已于 ${p.due} 到期，请尽快安排补种`
          : `【${p.name}】的疫苗将于 ${p.due} 到期，请提前安排接种`,
        link,
      });
      sent += 1;
    } catch (err) {
      console.error(`[care] 疫苗到期提醒失败 pet=${p.id}:`, err);
    }
  }

  /* 源二：pet_health_records.next_due_date（vaccine/deworm 等到期项） */
  const recs = await d
    .select({
      id: schema.petHealthRecords.id,
      type: schema.petHealthRecords.type,
      title: schema.petHealthRecords.title,
      nextDueDate: schema.petHealthRecords.nextDueDate,
      petId: schema.petHealthRecords.petId,
      petName: schema.pets.name,
      ownerId: schema.pets.ownerId,
    })
    .from(schema.petHealthRecords)
    .innerJoin(schema.pets, eq(schema.petHealthRecords.petId, schema.pets.id))
    .where(
      and(
        isNull(schema.pets.deletedAt),
        lte(schema.petHealthRecords.nextDueDate, soonStr),
        gte(schema.petHealthRecords.nextDueDate, pastStr),
      ),
    );
  for (const r of recs) {
    try {
      const link = `/philia/pets/${r.petId}/health?rec=${r.id}`;
      if (await notifiedToday(d, r.ownerId, 'pet.healthDue', link, dayStartMs)) continue;
      const kindLabel = r.type === 'vaccine' ? '疫苗' : r.type === 'deworm' ? '驱虫' : '健康项目';
      const overdue = r.nextDueDate! < todayStr;
      await d.insert(schema.notifications).values({
        userId: r.ownerId,
        type: 'pet.healthDue',
        category: 'service',
        title: `${kindLabel}到期提醒`,
        body: overdue
          ? `【${r.petName}】的「${r.title}」已于 ${r.nextDueDate} 到期，请尽快处理`
          : `【${r.petName}】的「${r.title}」将于 ${r.nextDueDate} 到期，请提前安排`,
        link,
      });
      sent += 1;
    } catch (err) {
      console.error(`[care] 健康记录到期提醒失败 rec=${r.id}:`, err);
    }
  }
  return sent;
}

/* ------------------------------------------------------------------ */
/* 2. 寄养早晚定时推送                                                     */
/* ------------------------------------------------------------------ */

export async function sweepBoardingDayNight(d: Db, now: Date): Promise<number> {
  const cfg = await ruleValue(d, 'boarding_daynight_push');
  const [mh, mm] = strOr(cfg?.morning, '08:30').split(':').map(Number);
  const [eh, em] = strOr(cfg?.evening, '20:30').split(':').map(Number);
  const w = storeWallclock(now);
  const morningMin = mh! * 60 + mm!;
  const eveningMin = eh! * 60 + em!;
  // 30 分钟窗口（5min 滴答必然扫到；窗内多扫由当日当槽幂等锚兜底）
  const slot: 'am' | 'pm' | null =
    w.minutes >= morningMin && w.minutes < morningMin + 30
      ? 'am'
      : w.minutes >= eveningMin && w.minutes < eveningMin + 30
        ? 'pm'
        : null;
  if (!slot) return 0;

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${w.y}-${pad(w.m)}-${pad(w.day)}`;
  const dayStartMs = storeDayStartMs(w.y, w.m, w.day);
  const title = slot === 'am' ? '早安播报' : '晚安播报';

  const stays = await d
    .select({
      stayId: schema.boardingStays.id,
      appointmentId: schema.boardingStays.appointmentId,
      roomNo: schema.boardingStays.roomNo,
      customerId: schema.appointments.customerId,
      petName: schema.pets.name,
    })
    .from(schema.boardingStays)
    .innerJoin(schema.appointments, eq(schema.boardingStays.appointmentId, schema.appointments.id))
    .innerJoin(schema.pets, eq(schema.appointments.petId, schema.pets.id))
    .where(and(isNull(schema.boardingStays.checkoutAt), eq(schema.appointments.status, 'in_boarding')));

  let sent = 0;
  for (const s of stays) {
    try {
      const link = `/appointments/${s.appointmentId}/live`;
      if (await notifiedToday(d, s.customerId, 'boarding.daynight', link, dayStartMs)) {
        // 当日已推过：若标题槽不同（早/晚各一条）仍需推——存在性锚细化到标题槽
        const dup = await d
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, s.customerId),
              eq(schema.notifications.type, 'boarding.daynight'),
              eq(schema.notifications.link, link),
              eq(schema.notifications.title, title),
              gte(schema.notifications.createdAt, new Date(dayStartMs)),
            ),
          )
          .get();
        if (dup) continue;
      }
      const todayLog = await d
        .select({ walks: schema.boardingDailyLogs.walks, meals: schema.boardingDailyLogs.meals })
        .from(schema.boardingDailyLogs)
        .where(
          and(
            eq(schema.boardingDailyLogs.stayId, s.stayId),
            eq(schema.boardingDailyLogs.logDate, todayStr),
          ),
        )
        .get();
      const summary = todayLog
        ? `今日已打卡：遛放 ${todayLog.walks} 次${todayLog.meals?.length ? `、餐饮 ${todayLog.meals.length} 顿` : ''}`
        : '今日照护记录整理中，打卡后即时可见';
      await d.insert(schema.notifications).values({
        userId: s.customerId,
        type: 'boarding.daynight',
        category: 'service',
        title,
        body: `【${s.petName}】寄养${title}：${summary}${s.roomNo ? `（房间 ${s.roomNo}）` : ''}`,
        link,
      });
      sent += 1;
    } catch (err) {
      console.error(`[care] 早晚推送失败 stay=${s.stayId}:`, err);
    }
  }
  return sent;
}

/* ------------------------------------------------------------------ */
/* 3. 照护日志 4 小时定时打卡提醒（员工侧）                                   */
/* ------------------------------------------------------------------ */

export async function sweepCareLogReminders(d: Db, now: Date): Promise<number> {
  const hours = numOr((await ruleValue(d, 'care_log_remind_hours'))?.hours, 4);
  const w = storeWallclock(now);
  // 夜间不打扰：08:00–22:00 门店时区外不提醒（照护打卡=班次动作）
  if (w.minutes < 8 * 60 || w.minutes >= 22 * 60) return 0;
  const intervalMs = hours * 3600 * 1000;

  const stays = await d
    .select({
      stayId: schema.boardingStays.id,
      appointmentId: schema.boardingStays.appointmentId,
      storeId: schema.appointments.storeId,
      stayCreatedAt: schema.boardingStays.createdAt,
      petName: schema.pets.name,
    })
    .from(schema.boardingStays)
    .innerJoin(schema.appointments, eq(schema.boardingStays.appointmentId, schema.appointments.id))
    .innerJoin(schema.pets, eq(schema.appointments.petId, schema.pets.id))
    .where(and(isNull(schema.boardingStays.checkoutAt), eq(schema.appointments.status, 'in_boarding')));

  let sent = 0;
  for (const s of stays) {
    try {
      const lastLog = await d
        .select({ updatedAt: schema.boardingDailyLogs.updatedAt })
        .from(schema.boardingDailyLogs)
        .where(eq(schema.boardingDailyLogs.stayId, s.stayId))
        .orderBy(desc(schema.boardingDailyLogs.updatedAt))
        .limit(1)
        .then((r) => r[0]);
      const lastAt = (lastLog?.updatedAt ?? s.stayCreatedAt).getTime();
      if (now.getTime() - lastAt < intervalMs) continue;

      // 本店在职员工全员（照护=班次共享动作，同 staffTask 日粒度件同族）
      const staffRows = await d
        .select({ userId: schema.staff.userId })
        .from(schema.staff)
        .where(and(eq(schema.staff.storeId, s.storeId), eq(schema.staff.status, 'active')));
      const link = `/boarding/${s.appointmentId}/checkin`;
      for (const st of staffRows) {
        const dup = await d
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, st.userId),
              eq(schema.notifications.type, 'boarding.careRemind'),
              eq(schema.notifications.link, link),
              gte(schema.notifications.createdAt, new Date(now.getTime() - intervalMs)),
            ),
          )
          .get();
        if (dup) continue;
        await d.insert(schema.notifications).values({
          userId: st.userId,
          type: 'boarding.careRemind',
          category: 'service',
          title: '照护打卡提醒',
          body: `【${s.petName}】在住寄养已超过 ${hours} 小时未打卡，请及时完成照护记录`,
          link,
        });
        sent += 1;
      }
    } catch (err) {
      console.error(`[care] 4h 照护提醒失败 stay=${s.stayId}:`, err);
    }
  }
  return sent;
}

/* ------------------------------------------------------------------ */
/* 4. 异常通报 15 分钟升级                                                  */
/* ------------------------------------------------------------------ */

export async function sweepIncidentEscalations(d: Db, now: Date): Promise<number> {
  const minutes = numOr((await ruleValue(d, 'incident_escalate_minutes'))?.minutes, 15);
  const cutoff = new Date(now.getTime() - minutes * 60 * 1000);
  const rows = await d
    .select()
    .from(schema.serviceIncidents)
    .where(
      and(
        isNull(schema.serviceIncidents.handledAt),
        isNull(schema.serviceIncidents.escalatedAt),
        lte(schema.serviceIncidents.createdAt, cutoff),
      ),
    )
    .limit(200);

  let sent = 0;
  for (const inc of rows) {
    try {
      // 先置幂等锚（同事务语义：置位失败则不通知，下轮重试）
      await d
        .update(schema.serviceIncidents)
        .set({ escalatedAt: now, updatedAt: now })
        .where(eq(schema.serviceIncidents.id, inc.id));
      const pet = await d
        .select({ name: schema.pets.name })
        .from(schema.pets)
        .where(eq(schema.pets.id, inc.petId))
        .get();
      const link = `/appointments/${inc.appointmentId}/live#incident`;
      const body = `【${pet?.name ?? '宠物'}】异常通报已超过 ${minutes} 分钟未处置，已升级店长跟进`;
      await d.insert(schema.notifications).values({
        userId: inc.customerId,
        type: 'incident.escalated',
        category: 'service',
        title: '异常通报升级',
        body,
        link,
      });
      // 门店端（店主+商家角色员工）同步升级提醒
      const store = await d
        .select({ ownerId: schema.stores.ownerId })
        .from(schema.stores)
        .where(eq(schema.stores.id, inc.storeId))
        .get();
      const managers = await d
        .select({ userId: schema.staff.userId })
        .from(schema.staff)
        .innerJoin(
          schema.userRoles,
          and(eq(schema.userRoles.userId, schema.staff.userId), eq(schema.userRoles.role, 'merchant_manager')),
        )
        .where(eq(schema.staff.storeId, inc.storeId));
      const targets = [...new Set([store?.ownerId, ...managers.map((m) => m.userId)].filter((x): x is string => !!x))];
      for (const uid of targets) {
        await d.insert(schema.notifications).values({
          userId: uid,
          type: 'incident.escalated',
          category: 'service',
          title: '异常通报超时未处置',
          body: `【${pet?.name ?? '宠物'}】异常通报已超过 ${minutes} 分钟未处置，请立即跟进`,
          link,
        });
        sent += 1;
      }
      sent += 1;
      console.log(`[care] 异常通报升级 incident=${inc.id}（超 ${minutes} 分钟未处置）`);
    } catch (err) {
      console.error(`[care] 异常升级扫描失败 incident=${inc.id}:`, err);
    }
  }
  return sent;
}
