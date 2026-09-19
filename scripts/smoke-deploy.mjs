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

async function trpcQuery(cookie, path, input, metaValues) {
  const frame = { json: input ?? null };
  if (metaValues) frame.meta = { values: metaValues };
  const payload = encodeURIComponent(JSON.stringify({ '0': frame }));
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

/* ------------------------------------------------------------------ */
/* 5. 收银台全链路（批次 M1）：开单→挂单→取单→结账→流水可查→次卡扣次联动   */
/*    （+撤单留痕/幂等重放/库存扣减/财务接数断言；全部真实落库）          */
/* ------------------------------------------------------------------ */

if (sessions.merchant && seedCustomer && sessions.customer) {
  // 5.0 服务项重取（第 4 节块级作用域不外泄）：首店首个 grooming 服务
  const nearby5 = await trpcQuery(sessions.customer, 'store.listNearby', { lat: 30.2741, lng: 120.1551 });
  const store5 = nearby5?.stores?.[0];
  const detail5 = store5 ? await trpcQuery(sessions.customer, 'store.getWithServices', { storeId: store5.id }) : null;
  const service = detail5?.services?.find((s) => s.type === 'grooming') ?? null;

  // 5.1 待收款预约可查（收银台「待收款」tab 数据源）
  const pending = await trpcQuery(sessions.merchant, 'cashier.pendingAppointments');
  check('收银台 trpc cashier.pendingAppointments 可查', Array.isArray(pending), `待收款=${pending?.length ?? 'ERR'}`);

  // 5.2 会员检索：命中（种子客户固定手机号，server/src/db/seed.ts 同口径）+ 未命中安静
  const hit = await trpcQuery(sessions.merchant, 'cashier.searchMember', { phone: '13800000000' });
  check('收银台 会员检索命中（种子客户）', hit?.found === true && !!hit?.id, `found=${hit?.found} 次卡余=${hit?.passRemainTimes}`);
  const miss = await trpcQuery(sessions.merchant, 'cashier.searchMember', { phone: '19900000000' });
  check('收银台 会员检索未命中（安静 found:false）', miss?.found === false, `found=${miss?.found}`);

  // 5.3 扣次联动前置：给种子客户充 1 次（pass.topUp 真链路；重复跑次数累积不失败）
  const topped = await trpcMutate(sessions.merchant, 'pass.topUp', { userId: seedCustomer.id, times: 1 });
  check('收银台前置 pass.topUp 充次 1', !!topped, 'times=1');

  // 5.4 开单+挂单：服务行（演示单同服务）+ 商品行（首个在架商品）
  const prodList = await trpcQuery(sessions.merchant, 'mall.listProductsForStore', { page: 1, pageSize: 100 });
  const product = (prodList?.items ?? []).find((p) => p.status === 'on');
  let billNo1 = null;
  let payable1 = 0;
  let stockBefore = null;
  if (product?.id && service?.id) {
    stockBefore = product.stock;
    const cart1 = {
      items: [
        { kind: 'service', refId: service.id, qty: 1 },
        { kind: 'product', refId: product.id, qty: 1 },
      ],
      discountType: 'none',
      discountValue: 0,
      note: 'smoke-deploy 收银演示单',
    };
    const held = await trpcMutate(sessions.merchant, 'cashier.hold', cart1);
    billNo1 = held?.bill?.billNo ?? held?.billNo ?? null;
    payable1 = held?.bill?.payableFen ?? 0;
    check(
      '收银台 挂单 cashier.hold（HD 单号）',
      /^HD-\d{8}-\d{3}$/.test(billNo1 ?? '') && (held?.bill?.status ?? held?.status) === 'held',
      `billNo=${billNo1} 应收=${payable1}分`,
  );

    // 5.5 取单：held → open 整单恢复
    if (billNo1) {
      const resumed = await trpcMutate(sessions.merchant, 'cashier.resume', { billNo: billNo1 });
      const rBill = resumed?.bill ?? resumed;
      const rItems = resumed?.items ?? rBill?.items ?? [];
      check('收银台 取单 cashier.resume（held→open）', rBill?.status === 'open' && rItems.length === 2, `status=${rBill?.status} 行数=${rItems.length}`);

      // 5.6 结账：现金全额（Σ支付=应收，金额取服务端快照口径）
      const settled = await trpcMutate(sessions.merchant, 'cashier.settle', {
        ...cart1,
        billNo: billNo1,
        payments: [{ method: 'cash', amountFen: payable1 }],
      });
      const sBill = settled?.bill ?? settled;
      check(
        '收银台 结账 cashier.settle（现金）',
        sBill?.status === 'settled' && sBill?.paidFen === sBill?.payableFen,
        `status=${sBill?.status} 已收=${sBill?.paidFen}分`,
      );

      // 5.7 幂等重放：同 bill_no 重复 settle → idempotent，不重复扣库存
      const replay = await trpcMutate(sessions.merchant, 'cashier.settle', {
        ...cart1,
        billNo: billNo1,
        payments: [{ method: 'cash', amountFen: payable1 }],
      });
      check('收银台 结账幂等（同 bill_no 重放 idempotent）', replay?.idempotent === true, `idempotent=${replay?.idempotent}`);
      const prodAfter = (await trpcQuery(sessions.merchant, 'mall.listProductsForStore', { page: 1, pageSize: 100 }))?.items?.find((p) => p.id === product.id);
      check(
        '收银台 库存扣减（settled −1，幂等重放不再扣）',
        prodAfter?.stock === stockBefore - 1,
        `stock ${stockBefore}→${prodAfter?.stock}（重放后仍 ${prodAfter?.stock}）`,
      );

      // 5.8 流水可查 + 详情支付明细
      const ledger = await trpcQuery(sessions.merchant, 'cashier.listBills', { range: 'today' });
      const row1 = (ledger?.bills ?? ledger ?? []).find?.((b) => b.billNo === billNo1);
      check('收银台 流水可查 cashier.listBills（今日含本单）', !!row1, `rows=${ledger?.bills?.length ?? ledger?.length}`);
      const detail1 = await trpcQuery(sessions.merchant, 'cashier.getBill', { billNo: billNo1 });
      const pays1 = detail1?.payments ?? detail1?.bill?.payments ?? [];
      check('收银台 流水详情 getBill（现金 1 段）', pays1.length === 1 && pays1[0]?.method === 'cash', `支付段=${pays1.length}`);
    }
  } else {
    check('收银台 挂单前置（在架商品+洗护服务）', false, '无在架商品或服务项');
  }

  // 5.9 次卡扣次联动：会员单 grooming 服务行扣次 → settle → 次卡 remain −1
  if (service?.id && hit?.found) {
    // 扣次前余额重取（5.2 的检索早于 5.3 充次，不能拿旧值当基线）
    const beforeSettle2 = await trpcQuery(sessions.merchant, 'cashier.searchMember', { phone: '13800000000' });
    const passBefore = beforeSettle2?.passRemainTimes ?? null;
    const cart2 = {
      customerId: seedCustomer.id,
      items: [{ kind: 'service', refId: service.id, qty: 1, paidByPass: true }],
      discountType: 'none',
      discountValue: 0,
      note: 'smoke-deploy 扣次联动单',
    };
    // 先 hold 取服务端重算应收（扣次行有效价=pass 段金额）
    const held2 = await trpcMutate(sessions.merchant, 'cashier.hold', cart2);
    const billNo2 = held2?.bill?.billNo ?? null;
    const payable2 = held2?.bill?.payableFen ?? 0;
    const settled2 = billNo2
      ? await trpcMutate(sessions.merchant, 'cashier.settle', {
          ...cart2,
          billNo: billNo2,
          payments: [{ method: 'pass', amountFen: payable2 }],
        })
      : null;
    const sBill2 = settled2?.bill ?? settled2;
    check('收银台 次卡扣次结账（pass 段=扣次行有效价）', sBill2?.status === 'settled', `billNo=${billNo2} 应收=${payable2}分`);
    const passes = await trpcQuery(sessions.merchant, 'pass.listForStore');
    const passRow = (passes?.passes ?? passes ?? []).find?.((p) => p.userId === seedCustomer.id || p.customerId === seedCustomer.id);
    check(
      '收银台 扣次联动（次卡余额 −1）',
      passBefore !== null && (passRow?.remainTimes ?? passRow?.remain_times) === passBefore - 1,
      `remain ${passBefore}→${passRow?.remainTimes ?? passRow?.remain_times}`,
    );
  }

  // 5.10 撤单留痕（不物理删除，流水灰签可见）
  if (product?.id) {
    const held3 = await trpcMutate(sessions.merchant, 'cashier.hold', {
      items: [{ kind: 'product', refId: product.id, qty: 1 }],
      discountType: 'none',
      discountValue: 0,
      note: 'smoke-deploy 撤单验证单',
    });
    const billNo3 = held3?.bill?.billNo ?? null;
    if (billNo3) {
      const voided = await trpcMutate(sessions.merchant, 'cashier.voidBill', { billNo: billNo3, reason: 'smoke 撤单验证' });
      const vBill = voided?.bill ?? voided;
      const ledger2 = await trpcQuery(sessions.merchant, 'cashier.listBills', { range: 'today' });
      const voidRow = (ledger2?.bills ?? ledger2 ?? []).find?.((b) => b.billNo === billNo3);
      check(
        '收银台 撤单留痕 cashier.voidBill（voided 留痕不删除）',
        vBill?.status === 'voided' && !!vBill?.voidReason && voidRow?.status === 'voided',
        `status=${vBill?.status} reason=${vBill?.voidReason}`,
      );
    }
  }

  // 5.11 财务接数：financeStats 含 cashierLedger（来源签 cashier）；入参 {from,to} Date（门店时区今日区间）
  const STORE_TZ_MS = 8 * 60 * 60 * 1000;
  const nowWc = new Date(Date.now() + STORE_TZ_MS);
  const dayStart = new Date(Date.UTC(nowWc.getUTCFullYear(), nowWc.getUTCMonth(), nowWc.getUTCDate(), 0, 0, 0, 0) - STORE_TZ_MS);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const fin = await trpcQuery(
    sessions.merchant,
    'store.financeStats',
    { from: dayStart.toISOString(), to: dayEnd.toISOString() },
    { from: ['Date'], to: ['Date'] },
  );
  const cashierRows = fin?.cashierLedger ?? [];
  check(
    '收银台 财务流水接数（financeStats.cashierLedger 含本批单）',
    cashierRows.some?.((r) => r.billNo === billNo1) ?? false,
    `cashierLedger=${cashierRows.length} 行`,
  );
}

console.log(`\n目标：${BASE}${GATE ? '（口令门已启用）' : '（口令门未设置，开发期开放口径）'}`);
console.log(failures === 0 ? '全部通过 🎉' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
