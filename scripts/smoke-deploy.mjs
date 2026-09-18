#!/usr/bin/env node
/**
 * 部署后自检冒烟（批次 6 · 任务 C2）：node scripts/smoke-deploy.mjs
 *
 * 零依赖（Node 20+ 原生 fetch），tRPC 走 HTTP batch + superjson 线格式
 * （与 apps/customer/scripts/api-smoke.mjs 同口径）。
 *
 * 环境变量：
 * - PUBLIC_BASE_URL   被检服务 base（默认 http://localhost:7200）
 * - BETA_GATE_CODE    内测口令；设置后校验口令门（无码 401 / 错码 403 / 对码 200），
 *                     未设置则按开发期开放口径校验（dev-login 无码可登录）
 * - CUSTOMER_URL / MERCHANT_URL / STAFF_URL
 *                     三端首页 URL（默认均取 PUBLIC_BASE_URL——单容器同源部署时
 *                     三端由同一 base 分发；本地对 vite dev server 冒烟时分别指到
 *                     http://localhost:7100 / 7101 / 7102）
 *
 * 检查项：
 *  1. GET /api/health → 200 { ok: true }
 *  2. 三端首页可达（200 + text/html）
 *  3. dev-login 口令门（按 BETA_GATE_CODE 是否设置分口径）
 *  4. 演示单链路：dev-seed-users 动态取数（带口令）→ 客户下单 appointment.create
 *     → 商家确认 appointment.confirm → 客户取码 appointment.getCode
 *     → 员工核销 appointment.checkin（人工 6 位码）
 */

const BASE = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:7200').replace(/\/$/, '');
const GATE = process.env.BETA_GATE_CODE?.trim() || null;
const APP_URLS = {
  customer: (process.env.CUSTOMER_URL ?? BASE).replace(/\/$/, ''),
  merchant: (process.env.MERCHANT_URL ?? BASE).replace(/\/$/, ''),
  staff: (process.env.STAFF_URL ?? BASE).replace(/\/$/, ''),
};

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  if (!ok) failures += 1;
}

/* ------------------------------------------------------------------ */
/* tRPC HTTP 调用（batch=1 + superjson 线格式）                          */
/* ------------------------------------------------------------------ */

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
  const res = await fetch(`${BASE}/trpc/${path}?batch=1&input=${payload}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return unwrap(await res.json(), `trpc ${path}`);
}

async function trpcMutate(cookie, path, input, metaValues) {
  const body = { '0': { json: input } };
  if (metaValues) body['0'].meta = { values: metaValues };
  const res = await fetch(`${BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return unwrap(await res.json(), `trpc ${path}`);
}

/* ------------------------------------------------------------------ */
/* dev-login / dev-seed-users（口令门感知）                              */
/* ------------------------------------------------------------------ */

const gateQs = (code) => (code ? `?code=${encodeURIComponent(code)}` : '');

async function seedUsers(code) {
  const res = await fetch(`${BASE}/api/auth/dev-seed-users${gateQs(code)}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function devLogin(userId, code) {
  const res = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(code ? { userId, code } : { userId }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, body: await res.json().catch(() => null), cookie };
}

/* ------------------------------------------------------------------ */
/* 1. health                                                           */
/* ------------------------------------------------------------------ */

{
  const res = await fetch(`${BASE}/api/health`);
  const body = await res.json();
  check('GET /api/health', res.ok && body.ok === true, JSON.stringify(body));
}

/* ------------------------------------------------------------------ */
/* 2. 三端首页可达                                                       */
/* ------------------------------------------------------------------ */

for (const [name, url] of Object.entries(APP_URLS)) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const ct = res.headers.get('content-type') ?? '';
    check(`三端首页可达：${name} ${url}`, res.ok && ct.includes('text/html'), `status=${res.status} ct=${ct}`);
    await res.body?.cancel();
  } catch (err) {
    check(`三端首页可达：${name} ${url}`, false, String(err?.message ?? err));
  }
}

/* ------------------------------------------------------------------ */
/* 3. dev-login 口令门                                                   */
/* ------------------------------------------------------------------ */

if (GATE) {
  const noCode = await seedUsers(undefined);
  check(
    '口令门：dev-seed-users 无码 → 401 BETA_GATE_REQUIRED',
    noCode.status === 401 && noCode.body?.error === 'BETA_GATE_REQUIRED',
    `status=${noCode.status} error=${noCode.body?.error}`,
  );
  const wrong = await seedUsers('smoke-wrong-code');
  check(
    '口令门：dev-seed-users 错码 → 403 BETA_GATE_INVALID',
    wrong.status === 403 && wrong.body?.error === 'BETA_GATE_INVALID',
    `status=${wrong.status} error=${wrong.body?.error}`,
  );
  const right = await seedUsers(GATE);
  check(
    '口令门：dev-seed-users 对口令 → 200',
    right.status === 200 && Array.isArray(right.body?.users) && right.body.users.length > 0,
    `status=${right.status} users=${right.body?.users?.length}`,
  );
  const wrongLogin = await devLogin('01SMOKE0000000000000000000', 'smoke-wrong-code');
  check(
    '口令门：dev-login 错码 → 403（先于用户校验被拒）',
    wrongLogin.status === 403 && wrongLogin.body?.error === 'BETA_GATE_INVALID',
    `status=${wrongLogin.status}`,
  );
} else {
  const open = await seedUsers(undefined);
  check(
    '口令门未设置（开发期开放）：dev-seed-users 无码 → 200',
    open.status === 200 && Array.isArray(open.body?.users),
    `status=${open.status} users=${open.body?.users?.length}`,
  );
}

/* ------------------------------------------------------------------ */
/* 4. 演示单链路：下单 → 确认 → 取码 → 核销                               */
/* ------------------------------------------------------------------ */

// 4.0 种子用户动态取数（带口令），按角色选人，禁止硬编码 ULID
let seeds = null;
{
  const r = await seedUsers(GATE ?? undefined);
  seeds = r.status === 200 ? r.body?.users ?? [] : null;
  check('dev-seed-users 动态取数（带口令）', !!seeds && seeds.length > 0, `users=${seeds?.length}`);
}

const pick = (role) => seeds?.find((u) => u.roles.includes(role));
const seedCustomer = pick('customer');
const seedMerchant = pick('merchant_owner');
const seedStaff = pick('staff');
check(
  '种子角色齐全（customer / merchant_owner / staff）',
  !!(seedCustomer && seedMerchant && seedStaff),
  `customer=${seedCustomer?.nickname} merchant=${seedMerchant?.nickname} staff=${seedStaff?.nickname}`,
);

const sessions = {};
if (seedCustomer && seedMerchant && seedStaff) {
  for (const [role, u] of [['customer', seedCustomer], ['merchant', seedMerchant], ['staff', seedStaff]]) {
    const r = await devLogin(u.id, GATE ?? undefined);
    sessions[role] = r.cookie;
    check(`dev-login（${u.nickname} / ${role}）`, r.status === 200 && r.cookie.includes('philia_session='), `status=${r.status}`);
  }
}

let appointmentId = null;
if (sessions.customer && sessions.merchant && sessions.staff) {
  // 4.1 客户宠物 + 门店 + 服务项（全部动态取数）
  const pets = await trpcQuery(sessions.customer, 'pet.list');
  const pet = pets?.[0];
  check('trpc pet.list（种子客户有宠物）', !!pet?.id, `pets=${pets?.length} 第一只=${pet?.name}`);

  const nearby = await trpcQuery(sessions.customer, 'store.listNearby', { lat: 30.2741, lng: 120.1551 });
  const store = nearby?.stores?.[0];
  check('trpc store.listNearby（种子门店）', !!store?.id, `stores=${nearby?.stores?.length} 第一家=${store?.name}`);

  const detail = store ? await trpcQuery(sessions.customer, 'store.getWithServices', { storeId: store.id }) : null;
  const service = detail?.services?.find((s) => s.type === 'grooming');
  check('trpc store.getWithServices（洗护服务项）', !!service?.id, `服务=${service?.name} 价格=${service?.priceFen}分`);

  // 4.2 下单：门店规范时区（Asia/Shanghai，固定 +8，与 server B8-B4 口径一致）取
  // 「明天 10:00」起，满槽 CONFLICT 则 +30min 重试。
  // U4-G 修复：此前用容器本地时区 setHours(10)——VPS 容器为 UTC 时演示单落在
  // 门店墙钟 18:00，撞打烊校验（营业时间判定按门店规范时区）。改为位移法：
  // 先把瞬时移到 +8 墙钟取「明天」，再按 UTC 合成 10:00 并位移回真实 epoch。
  if (pet && store && service) {
    const STORE_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
    const storeNow = new Date(Date.now() + STORE_TZ_OFFSET_MS);
    const start = new Date(
      Date.UTC(storeNow.getUTCFullYear(), storeNow.getUTCMonth(), storeNow.getUTCDate() + 1, 10, 0, 0, 0) -
        STORE_TZ_OFFSET_MS,
    );
    let lastErr = null;
    for (let i = 0; i < 16 && !appointmentId; i++) {
      const scheduledStart = new Date(start.getTime() + i * 30 * 60_000);
      try {
        const created = await trpcMutate(
          sessions.customer,
          'appointment.create',
          {
            storeId: store.id,
            petId: pet.id,
            serviceId: service.id,
            type: 'grooming',
            scheduledStart: scheduledStart.toISOString(),
            paymentMode: 'pay_at_store',
            note: 'smoke-deploy 演示单（可安全取消）',
          },
          { scheduledStart: ['Date'] },
        );
        appointmentId = created?.id ?? created?.appointment?.id ?? null;
        check(
          '演示单下单 trpc appointment.create',
          !!appointmentId,
          `id=${appointmentId} scheduledStart=${scheduledStart.toLocaleString()}`,
        );
      } catch (err) {
        lastErr = err;
        if (!String(err?.message).includes('CONFLICT') && !String(err?.message).includes('约满')) {
          check('演示单下单 trpc appointment.create', false, String(err?.message ?? err));
          break;
        }
      }
    }
    if (!appointmentId && lastErr) {
      check('演示单下单 trpc appointment.create', false, `16 个时段均不可约：${lastErr?.message}`);
    }
  }

  // 4.3 商家确认
  if (appointmentId) {
    try {
      const confirmed = await trpcMutate(sessions.merchant, 'appointment.confirm', { appointmentId });
      check(
        '商家确认 trpc appointment.confirm（pending → confirmed）',
        confirmed?.status === 'confirmed',
        `status=${confirmed?.status}`,
      );
    } catch (err) {
      check('商家确认 trpc appointment.confirm', false, String(err?.message ?? err));
    }

    // 4.4 客户取码（人工 6 位核销码）
    let manualCode = null;
    try {
      const codeRes = await trpcQuery(sessions.customer, 'appointment.getCode', { appointmentId });
      manualCode = codeRes?.code ?? null;
      check('客户取码 trpc appointment.getCode', /^[2-9A-HJKMNP-Z]{6}$/.test(manualCode ?? ''), `code=${manualCode}`);
    } catch (err) {
      check('客户取码 trpc appointment.getCode', false, String(err?.message ?? err));
    }

    // 4.5 员工核销（人工码路径，confirmed → in_service）
    if (manualCode) {
      try {
        const r = await trpcMutate(sessions.staff, 'appointment.checkin', { code: manualCode });
        const appt = r?.appointment ?? r;
        check(
          '员工核销 trpc appointment.checkin（confirmed → in_service）',
          appt?.status === 'in_service' && !!appt?.checkedInAt,
          `status=${appt?.status} checkedInAt=${appt?.checkedInAt} 认领员工=${r?.appointment?.staffId ?? appt?.staffId}`,
        );
      } catch (err) {
        check('员工核销 trpc appointment.checkin', false, String(err?.message ?? err));
      }
    }
  }
}

console.log(`\n目标：${BASE}${GATE ? '（口令门已启用）' : '（口令门未设置，开发期开放口径）'}`);
console.log(failures === 0 ? '全部通过 🎉' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
