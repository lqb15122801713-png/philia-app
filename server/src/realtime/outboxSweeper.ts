/**
 * event_outbox 后台清扫（开发方案 §7.1）
 *
 * - 重投：每 30s 扫描 delivered=0 且目标频道有在线连接的事件，重投并置 delivered=1
 *   （无在线订阅者的事件保持 delivered=0，等待下次扫描；单实例内存 Hub 的离线
 *   补偿由 notifications 表兜底）。
 * - 归档：每日把 delivered=1 且创建时间超过 7 天的事件导出到
 *   server/data/outbox-archive.jsonl 后从库中删除，防发件箱无限膨胀。
 *
 * 由服务入口（T1.6 src/index.ts）调用 startOutboxSweeper() 启动；
 * sweepOnce / archiveOutbox 导出供测试与手工触发。
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db, schema } from '../db';
import { broadcastNow, emitEvent } from './bus';
import { EventType, toEnvelope } from './events';
import * as hub from './hub';

/** 归档文件：server/data/outbox-archive.jsonl（相对本文件定位，与 CWD 无关） */
export const defaultArchiveFile = fileURLToPath(
  new URL('../../data/outbox-archive.jsonl', import.meta.url),
);

/** 重投保留窗口内、当前有在线连接的未投递事件。返回本轮重投并置 delivered 的数量。 */
export async function sweepOnce(d: typeof db = db): Promise<number> {
  const online = hub.onlineChannels();
  if (online.length === 0) return 0;

  const rows = await d
    .select()
    .from(schema.eventOutbox)
    .where(
      and(eq(schema.eventOutbox.delivered, false), inArray(schema.eventOutbox.channel, online)),
    )
    .orderBy(schema.eventOutbox.id)
    .limit(200);

  let redelivered = 0;
  for (const row of rows) {
    const sent = hub.broadcast(row.channel, toEnvelope(row));
    if (sent > 0) {
      await d
        .update(schema.eventOutbox)
        .set({ delivered: true, updatedAt: new Date() })
        .where(eq(schema.eventOutbox.id, row.id));
      redelivered++;
    }
  }
  return redelivered;
}

/**
 * 归档：delivered=1 且 created_at 早于 cutoff（默认 7 天前）的事件导出 JSONL 后删除。
 * 返回归档条数。
 */
export async function archiveOutbox(
  d: typeof db = db,
  archiveFile: string = defaultArchiveFile,
  retentionMs: number = 7 * 24 * 3600 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionMs);
  const rows = await d
    .select()
    .from(schema.eventOutbox)
    .where(and(eq(schema.eventOutbox.delivered, true), lt(schema.eventOutbox.createdAt, cutoff)))
    .orderBy(schema.eventOutbox.id)
    .limit(2000);
  if (rows.length === 0) return 0;

  mkdirSync(dirname(archiveFile), { recursive: true });
  const lines = rows.map((r) =>
    JSON.stringify({
      id: r.id,
      channel: r.channel,
      event_type: r.eventType,
      payload: r.payload,
      delivered: r.delivered ? 1 : 0,
      created_at: Math.floor(r.createdAt.getTime() / 1000),
      updated_at: Math.floor(r.updatedAt.getTime() / 1000),
      archived_at: Math.floor(Date.now() / 1000),
    }),
  );
  appendFileSync(archiveFile, lines.join('\n') + '\n');

  await d.delete(schema.eventOutbox).where(
    inArray(schema.eventOutbox.id, rows.map((r) => r.id)),
  );
  return rows.length;
}

/**
 * 寄养超期每日提醒（开发方案 §3.1 / §7.3 · T6.3 补齐 D3 缺口）：
 * in_boarding 且 scheduled_end < now 的预约，按（预约 × 自然日）幂等发射
 * boarding.overdue → store:{storeId}，并即时广播。返回本轮新发射条数。
 * 幂等依据：event_outbox 中当日已存在同 appointmentId 的 boarding.overdue 事件。
 */
export async function emitBoardingOverdue(
  d: typeof db = db,
  now: Date = new Date(),
): Promise<number> {
  const overdueList = await d
    .select()
    .from(schema.appointments)
    .where(
      and(eq(schema.appointments.status, 'in_boarding'), lt(schema.appointments.scheduledEnd, now)),
    )
    .all();
  if (overdueList.length === 0) return 0;

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  let emitted = 0;
  for (const appt of overdueList) {
    const rows = await d
      .select()
      .from(schema.eventOutbox)
      .where(
        and(
          eq(schema.eventOutbox.channel, `store:${appt.storeId}`),
          eq(schema.eventOutbox.eventType, EventType.BoardingOverdue),
        ),
      )
      .all();
    const alreadyToday = rows.some((e) => {
      const payload = e.payload as Record<string, unknown> | null;
      return payload?.appointmentId === appt.id && e.createdAt >= dayStart;
    });
    if (alreadyToday) continue;

    const outboxId = await emitEvent(d, `store:${appt.storeId}`, EventType.BoardingOverdue, {
      appointmentId: appt.id,
      scheduledEnd: appt.scheduledEnd,
      note: '寄养已超期，请尽快安排退房',
    });
    broadcastNow(outboxId);
    emitted++;
  }
  return emitted;
}

/** 启动后台清扫（默认重投 30s / 归档每日 / 超期检查 30min）。返回停止函数。 */
export function startOutboxSweeper(opts?: {
  sweepIntervalMs?: number;
  archiveIntervalMs?: number;
  overdueIntervalMs?: number;
  archiveFile?: string;
}): { stop(): void } {
  const sweepIntervalMs = opts?.sweepIntervalMs ?? 30_000;
  const archiveIntervalMs = opts?.archiveIntervalMs ?? 24 * 3600 * 1000;
  const overdueIntervalMs = opts?.overdueIntervalMs ?? 30 * 60 * 1000;

  const sweepTimer = setInterval(() => {
    sweepOnce().catch((err) => console.error('[realtime] outbox 重投失败:', err));
  }, sweepIntervalMs);
  sweepTimer.unref?.();

  const archiveTimer = setInterval(() => {
    archiveOutbox(db, opts?.archiveFile).catch((err) =>
      console.error('[realtime] outbox 归档失败:', err),
    );
  }, archiveIntervalMs);
  archiveTimer.unref?.();

  // 寄养超期：启动即查一次，之后每 30min 幂等轮查（同一预约每天至多一条）
  emitBoardingOverdue().catch((err) => console.error('[realtime] 寄养超期检查失败:', err));
  const overdueTimer = setInterval(() => {
    emitBoardingOverdue().catch((err) => console.error('[realtime] 寄养超期检查失败:', err));
  }, overdueIntervalMs);
  overdueTimer.unref?.();

  return {
    stop() {
      clearInterval(sweepTimer);
      clearInterval(archiveTimer);
      clearInterval(overdueTimer);
    },
  };
}
