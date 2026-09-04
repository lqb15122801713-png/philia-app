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
import { toEnvelope } from './events';
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

/** 启动后台清扫（默认重投 30s / 归档每日）。返回停止函数。 */
export function startOutboxSweeper(opts?: {
  sweepIntervalMs?: number;
  archiveIntervalMs?: number;
  archiveFile?: string;
}): { stop(): void } {
  const sweepIntervalMs = opts?.sweepIntervalMs ?? 30_000;
  const archiveIntervalMs = opts?.archiveIntervalMs ?? 24 * 3600 * 1000;

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

  return {
    stop() {
      clearInterval(sweepTimer);
      clearInterval(archiveTimer);
    },
  };
}
