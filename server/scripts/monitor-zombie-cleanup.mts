/**
 * PD-22 D-47 运维清淤：异常待清（in_service 超 24h 未翻步）僵尸单演示收口
 *
 * 口径（任务书冻结版 V1.0 §一 D-47 + 开口①裁死）：
 * - 清淤=**强制完成端点单源留痕**（apply=走 appointment.forceCompleteStale 真端点，谁/何时/单号/
 *   前后状态全留痕；脚本不自写库=零双轨）；
 * - 白名单=note 命中演示/走测标记（缺省 '%【测试】%' / '%演示单%' / 'wtshot%' 闸具前缀），
 *   真实经营单永不命中——军规①真慢单不误伤的码内落地；
 * - **dry-run 缺省**（只列不调）；`--apply` 才逐单调端点；可重复跑（已 completed 幂等安全）；
 * - 报告 `--report <path>` 写 JSON（命中单号/时刻/前后状态/结果）；
 * - PD-23 D-49：口令门开启时 `BETA_GATE_CODE` 环境变量随 dev-login 递码（缺码 401/错码 403
 *   明文诊断退出，不再运维临补）。
 *
 * 禁区（写死）：不物理删行；不碰钱域；不翻六步逐行；不越白名单。
 *
 * 用法（server/ 目录，须 API 在跑）：
 *   npx tsx scripts/monitor-zombie-cleanup.mts                      # dry-run 只列
 *   npx tsx scripts/monitor-zombie-cleanup.mts --apply --report ../tmp/d47-report.json
 * 环境：PHILIA_DB_URL（缺省 data/philia.db）+ PHILIA_API_BASE（缺省 http://localhost:7200）。
 */

import { writeFileSync } from 'node:fs';
import { and, eq, lt, or, like } from 'drizzle-orm';
import { db, schema } from '../src/db';

const APPLY = process.argv.includes('--apply');
const argOf = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1]! : d;
};
const REPORT = argOf('--report', '');
const API = process.env.PHILIA_API_BASE ?? 'http://localhost:7200';
const NOTE_LIKES = ['%【测试】%', '%演示单%', 'wtshot%'];
const ZOMBIE_MS = 24 * 3600 * 1000;
const NOTE = '运维一次性收口（PD-22 D-47 异常待清清淤；dry-run 先审后落）';

async function main() {
  const deadline = new Date(Date.now() - ZOMBIE_MS);
  const rows = await db
    .select({
      id: schema.appointments.id,
      code: schema.appointments.code,
      status: schema.appointments.status,
      note: schema.appointments.note,
      checkedInAt: schema.appointments.checkedInAt,
      scheduledStart: schema.appointments.scheduledStart,
    })
    .from(schema.appointments)
    .where(and(eq(schema.appointments.status, 'in_service'), or(...NOTE_LIKES.map((p) => like(schema.appointments.note, p)), like(schema.appointments.id, 'wtshot%'))));
  const zombies = rows.filter((r) => Date.now() - new Date(r.checkedInAt ?? r.scheduledStart).getTime() >= ZOMBIE_MS);
  console.log(`[d47] 白名单（演示/走测标记）+超 24h 未翻步：命中 ${zombies.length} 单（白名单在册 in_service 共 ${rows.length} 单）`);
  for (const r of zombies) console.log(`  ${r.code} ${r.id} checkedInAt=${r.checkedInAt?.toISOString() ?? 'null'} note=${r.note ?? ''}`);

  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    dryRun: !APPLY,
    whitelist: NOTE_LIKES,
    hitCount: zombies.length,
    rows: [],
  };

  if (APPLY && zombies.length > 0) {
    /* 运维落账=走真端点（单源留痕）：dev-login 取店主会话 → forceCompleteStale 逐单；
       PD-23 D-49：BETA_GATE_CODE 硬化入仓（合部候裁⑥）——内测口令门开启时口令随 dev-login
       一并递，缺码 401/错码 403 明文可诊断退出（不再运维临补） */
    const ownerRow = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
      .where(eq(schema.userRoles.role, 'merchant_owner'))
      .limit(1)
      .then((r) => r[0]);
    if (!ownerRow) throw new Error('缺 merchant_owner 种子用户');
    const gateCode = process.env.BETA_GATE_CODE;
    const login = await fetch(`${API}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: ownerRow.id, ...(gateCode ? { code: gateCode } : {}) }),
    });
    if (!login.ok) {
      const j = await login.json().catch(() => null);
      throw new Error(
        `dev-login 失败：HTTP ${login.status}（${j?.error ?? 'unknown'}）——内测口令门在跑时请带 BETA_GATE_CODE 环境变量再跑`,
      );
    }
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
    for (const r of zombies) {
      const res = await fetch(`${API}/trpc/appointment.forceCompleteStale`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ json: { appointmentId: r.id, note: NOTE } }),
      });
      const j = await res.json();
      const ok = res.ok && !j?.error;
      (report.rows as unknown[]).push({ code: r.code, id: r.id, before: 'in_service', after: ok ? 'completed' : `FAILED:${j?.error?.json?.message ?? res.status}` });
      console.log(`  ${ok ? '✓' : '✗'} ${r.code} → ${ok ? 'completed（留痕事件已发）' : j?.error?.json?.message ?? res.status}`);
    }
  }
  if (REPORT) {
    writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.log(`[d47] 报告=${REPORT}`);
  }
  console.log(APPLY ? '[d47] DONE(applied)' : '[d47] DONE(dry-run，未写库)');
}

main().catch((e) => {
  console.error('[d47] FATAL', e);
  process.exit(1);
});
