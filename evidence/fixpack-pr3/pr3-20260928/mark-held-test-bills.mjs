#!/usr/bin/env node
/**
 * 挂单标注「测试件勿动」一次性脚本（修复包 PR-3 C2b · CJ-0926-03 口径 · 产品侧执行件）
 *
 * 用途：把现库 status='held' 的挂单逐张标注为「测试件勿动 · 保留标测试件（CJ-0926-03）」
 * ——挂单队列卡片备注行即刻醒目（PR-3 HoldPanel 备注行），运营每月看挂单页不再误判。
 * 机制：getBill 读出行项/买家/优惠 → cashier.hold 带 billNo 同参复挂（现成端点，零新码）。
 *
 * 口径与注意（执行前必读）：
 * - 仅处理 status='held' 的单；已标注（note 含「测试件勿动」）的跳过=幂等，可重复跑；
 * - 复挂会刷新 heldAt（=标注动作留痕，可接受）并重算应收（会员折扣按当前值快照——
 *   测试件金额漂移无害，脚本逐单打印 before/after payableFen 供留痕）；
 * - 不动 settled/voided/open 单；不删任何单（保留标测试件铁律）。
 *
 * 用法：
 *   node tmp/mark-held-test-bills.mjs                 # DRY_RUN=1 预演（默认，零写入）
 *   DRY_RUN=0 node tmp/mark-held-test-bills.mjs       # 实际标注
 * 环境变量：BASE（默认 http://localhost:7200）/ GATE（口令门码）/ DRY_RUN（默认 1）/
 *   MARK_NOTE（标注文案，默认「测试件勿动 · 保留标测试件（CJ-0926-03）」）/
 *   ONLY（只处理这些单号，逗号分隔，可选）
 *
 * 执行纪律：本地 dev 验证 → 产品侧 SSH/生产通道执行（A 窗不直连生产）。
 */

const BASE = (process.env.BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const GATE = process.env.GATE?.trim() || null;
const DRY = process.env.DRY_RUN !== '0';
const MARK_NOTE = process.env.MARK_NOTE ?? '测试件勿动 · 保留标测试件（CJ-0926-03）';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map((s) => s.trim())) : null;

function unwrap(arr, name) {
  const first = arr?.[0];
  if (first?.error) {
    const e = first.error.json ?? first.error;
    throw new Error(`${name} 失败：${e?.message ?? JSON.stringify(e)}（code=${e?.data?.code ?? e?.code}）`);
  }
  return first?.result?.data?.json;
}
async function trpcQuery(cookie, path, input) {
  const payload = encodeURIComponent(JSON.stringify({ '0': { json: input ?? null } }));
  const res = await fetch(`${BASE}/trpc/${path}?batch=1&input=${payload}`, { headers: cookie ? { Cookie: cookie } : {} });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function trpcMutate(cookie, path, input) {
  const res = await fetch(`${BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ '0': { json: input } }),
  });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function devLogin(userId, code) {
  const res = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(code ? { userId, code } : { userId }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, cookie: setCookies.map((c) => c.split(';')[0]).join('; ') };
}

const seeds = await (await fetch(`${BASE}/api/auth/dev-seed-users${GATE ? `?code=${encodeURIComponent(GATE)}` : ''}`)).json();
const owner = (seeds?.users ?? seeds ?? []).find((u) => u.roles?.includes('merchant_owner'));
if (!owner) throw new Error('未找到 merchant_owner 种子用户');
const { status, cookie } = await devLogin(owner.id, GATE ?? undefined);
if (status !== 200) throw new Error(`dev-login 失败 status=${status}`);
console.log(`目标=${BASE} DRY_RUN=${DRY} 标注文案=「${MARK_NOTE}」`);

const held = await trpcQuery(cookie, 'cashier.listBills', { status: 'held' });
const bills = (Array.isArray(held) ? held : []).filter((b) => !ONLY || ONLY.has(b.billNo));
console.log(`held 单 ${bills.length} 张待检`);
let marked = 0, skipped = 0, failed = 0;
for (const b of bills) {
  try {
    const detail = await trpcQuery(cookie, 'cashier.getBill', { billNo: b.billNo });
    const bill = detail?.bill ?? detail;
    if ((bill.note ?? '').includes('测试件勿动')) {
      console.log(`- ${b.billNo} 已标注，跳过`);
      skipped++;
      continue;
    }
    const items = (detail?.items ?? []).map((it) => ({ kind: it.kind, refId: it.refId, qty: it.qty }));
    if (items.length === 0) throw new Error('行项为空，拒绝复挂');
    const input = {
      billNo: b.billNo,
      customerId: bill.customerId ?? undefined,
      items,
      discountType: bill.discountType ?? 'none',
      discountValue: bill.discountValue ?? 0,
      note: MARK_NOTE,
    };
    if (DRY) {
      console.log(`- ${b.billNo} [预演] items=${items.length} payable=${bill.payableFen} note→「${MARK_NOTE}」`);
      skipped++;
      continue;
    }
    const r = await trpcMutate(cookie, 'cashier.hold', input);
    const after = r?.bill ?? r;
    const drift = (after?.payableFen ?? bill.payableFen) - bill.payableFen;
    console.log(`✓ ${b.billNo} 已标注（payable ${bill.payableFen}→${after?.payableFen}，漂移 ${drift}；heldAt 已刷新=留痕）`);
    marked++;
  } catch (e) {
    console.log(`✗ ${b.billNo} 失败：${String(e?.message ?? e)}`);
    failed++;
  }
}
console.log(`\n完成：标注 ${marked} / 跳过 ${skipped} / 失败 ${failed}${DRY ? '（预演零写入）' : ''}`);
process.exit(failed === 0 ? 0 : 1);
