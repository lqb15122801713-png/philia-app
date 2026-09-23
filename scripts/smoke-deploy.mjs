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
 *  5. 收银台全链路 + 冲正回补；5.13（staff-2 R8）库存流水三类来源验证：
 *     cashier（结账扣减）/ reversal（冲正回补）/ count（现造盘点单确认入账），前后值正确；
 *     5.14（R12）退款冒烟：现金单全额退六联动 / 储值组合单 6:4 分摊回补前后值 /
 *     商品 refund 流水 / 寄养剩余晚部分退；
 *     5.15（R11a）会员冒烟：微光开档 / 萤火售卖到店付（多宠 4 只 25800）/ 回馈金返 2% 挂期次 /
 *     抵扣段仅商品（服务行 rebate 段 403）/ 日结分摊双口径 amortizationStats
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
  // M1-补2 加固：高频复跑把明天时段占满时，按天顺延（门店时区，最多 7 天，
  // 与可约窗口同口径）——「重复跑自动顺延不失败」口径落实。
  if (pet && store && service) {
    const STORE_TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
    const storeNow = new Date(Date.now() + STORE_TZ_OFFSET_MS);
    const dayStartAt = (offsetDays) =>
      new Date(
        Date.UTC(storeNow.getUTCFullYear(), storeNow.getUTCMonth(), storeNow.getUTCDate() + offsetDays, 10, 0, 0, 0) -
          STORE_TZ_OFFSET_MS,
      );
    let lastErr = null;
    outer: for (let dayOffset = 1; dayOffset <= 7 && !appointmentId; dayOffset++) {
      const start = dayStartAt(dayOffset);
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
            break outer;
          }
        }
      }
    }
    if (!appointmentId && lastErr) {
      check('演示单下单 trpc appointment.create', false, `7 天时段均不可约：${lastErr?.message}`);
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

  // 5.12 商品单冲正库存回补（运营签收台账① · W1 顺手）：settle 商品 ×N → stock −N →
  // owner 反结账冲正 → stock 回补 +N（库存自动回补口径实证）
  if (product?.id && billNo1) {
    const beforeRev = (await trpcQuery(sessions.merchant, 'mall.listProductsForStore', { page: 1, pageSize: 100 }))?.items?.find((p) => p.id === product.id)?.stock;
    const rev = await trpcMutate(sessions.merchant, 'cashier.reverseBill', { billNo: billNo1, reason: 'smoke 冲正回补验证' }).catch((e) => ({ err: String(e?.message ?? e) }));
    const afterRev = (await trpcQuery(sessions.merchant, 'mall.listProductsForStore', { page: 1, pageSize: 100 }))?.items?.find((p) => p.id === product.id)?.stock;
    check(
      '收银台 冲正库存回补（reverseBill 后 stock +1）',
      !rev?.err && afterRev === beforeRev + 1,
      `stock ${beforeRev}→${afterRev}（期望 +1）${rev?.err ? ` err=${rev.err.slice(0, 60)}` : ''}`,
    );
  }

  // 5.13 staff-2 R8：库存流水三类来源写入验证（cashier / reversal / count，前后值正确）——
  // cashier 行来自 5.6 结账扣减（sourceId=billNo1），reversal 行来自 5.12 冲正回补；
  // count 行由本节现造盘点单（owner 建单 → staff 录入盘亏 → owner 确认入账）产出。
  // 幂等口径：全部按「本单 sourceId / 相对前后值」断言，重复跑数据累积不失败。
  if (sessions.staff) {
    // cashier 来源：5.6 结账商品行扣减（delta=-1，before→after 连续）
    const movC = await trpcQuery(sessions.merchant, 'inventory.listMovements', { sourceType: 'cashier', limit: 100 })
      .catch((e) => ({ err: String(e?.message ?? e) }));
    const cashRow = Array.isArray(movC) ? movC.find((m) => m.sourceId === billNo1 && m.productId === product?.id) : null;
    check(
      '库存流水 cashier 来源（5.6 结账扣减落账，delta=-1 前后值连续）',
      !movC?.err && !!cashRow && cashRow.delta === -1 && cashRow.afterStock === cashRow.beforeStock - 1,
      cashRow ? `before=${cashRow.beforeStock} after=${cashRow.afterStock}` : `err=${movC?.err ?? '未找到本单流水'}`,
    );

    // reversal 来源：5.12 冲正回补（delta=+1；note 带原单号）
    const movR = await trpcQuery(sessions.merchant, 'inventory.listMovements', { sourceType: 'reversal', limit: 100 })
      .catch((e) => ({ err: String(e?.message ?? e) }));
    const revRow = Array.isArray(movR)
      ? movR.find((m) => m.productId === product?.id && String(m.note ?? '').includes(billNo1 ?? '')) ?? movR.find((m) => m.productId === product?.id && m.delta > 0)
      : null;
    check(
      '库存流水 reversal 来源（5.12 冲正回补落账，delta=+1 前后值连续）',
      !movR?.err && !!revRow && revRow.delta === 1 && revRow.afterStock === revRow.beforeStock + 1,
      revRow ? `before=${revRow.beforeStock} after=${revRow.afterStock}` : `err=${movR?.err ?? '未找到冲正流水（5.12 未执行则不达）'}`,
    );

    // count 来源：现造盘点单（weekly 全量）→ 员工录入（首个商品盘亏 2）→ owner 确认入账
    const count0 = await trpcMutate(sessions.merchant, 'inventory.assignCount', { type: 'weekly' })
      .catch((e) => ({ err: String(e?.message ?? e) }));
    const countId = count0?.id ?? null;
    check('库存流水 count 前置：盘点建单（weekly draft）', !count0?.err && !!countId && count0?.status === 'draft', `countId=${countId} items=${count0?.itemCount}${count0?.err ? ` err=${count0.err.slice(0, 60)}` : ''}`);
    if (countId) {
      const tasks = await trpcQuery(sessions.staff, 'inventory.myCountTasks').catch((e) => ({ err: String(e?.message ?? e) }));
      const task = Array.isArray(tasks) ? tasks.find((t) => t.id === countId) : null;
      const items = task?.items ?? [];
      const target = items.find((it) => (it.systemStock ?? 0) >= 2) ?? items[0];
      check('库存流水 count 前置：员工待办可见盘点行项', !!task && items.length > 0, `items=${items.length}${tasks?.err ? ` err=${tasks.err.slice(0, 60)}` : ''}`);
      if (task && target) {
        const rec = await trpcMutate(sessions.staff, 'inventory.recordItems', {
          countId,
          items: items.map((it) => ({ itemId: it.id, actualStock: it.id === target.id ? Math.max(0, it.systemStock - 2) : it.systemStock })),
        }).catch((e) => ({ err: String(e?.message ?? e) }));
        check('库存流水 count 前置：实盘录入 → counted', !rec?.err && rec?.status === 'counted', `status=${rec?.status}${rec?.err ? ` err=${rec.err.slice(0, 60)}` : ''}`);
        const conf = await trpcMutate(sessions.merchant, 'inventory.confirmCount', { countId })
          .catch((e) => ({ err: String(e?.message ?? e) }));
        const confCount = conf?.count ?? conf;
        check('库存流水 count 前置：店长确认入账（posted，diffs≥1）', !conf?.err && confCount?.status === 'posted' && (conf?.diffs ?? 0) >= 1, `status=${confCount?.status} diffs=${conf?.diffs}${conf?.err ? ` err=${conf.err.slice(0, 60)}` : ''}`);
        const movCnt = await trpcQuery(sessions.merchant, 'inventory.listMovements', { sourceType: 'count', limit: 100 })
          .catch((e) => ({ err: String(e?.message ?? e) }));
        const cntRow = Array.isArray(movCnt) ? movCnt.find((m) => m.sourceId === countId && m.productId === target.productId) : null;
        check(
          '库存流水 count 来源（盘点入账落账，delta=-2 前后值=快照/实盘）',
          !movCnt?.err && !!cntRow && cntRow.delta === -2 && cntRow.beforeStock === target.systemStock && cntRow.afterStock === Math.max(0, target.systemStock - 2),
          cntRow ? `before=${cntRow.beforeStock} after=${cntRow.afterStock}` : `err=${movCnt?.err ?? '未找到盘点流水'}`,
        );
      }
    }
  } else {
    check('库存流水三类来源验证（staff 会话缺失，跳过 count 链路）', false, 'sessions.staff 不可用');
  }

  // 5.14 R12 退款专项冒烟（任务书 §七闸门：现金单全额退 / 储值单余额回补 / 商品单 refund 流水 / 寄养剩余晚部分退）
  // 幂等口径：全部按本单号 / 相对前后值断言，重复跑数据累积不失败。
  {
    // (a) 现金单全额退（服务+商品）→ 六联动：refund_status 回指 + rebate 列位 + 商品 refund 流水前后值 + 库存回补
    if (service?.id && product?.id) {
      const itemsR1 = [{ kind: 'service', refId: service.id, qty: 1 }, { kind: 'product', refId: product.id, qty: 1 }];
      const stockR1Before = (await trpcQuery(sessions.merchant, 'mall.listProductsForStore', { page: 1, pageSize: 100 }))?.items?.find((p) => p.id === product.id)?.stock;
      const heldR1 = await trpcMutate(sessions.merchant, 'cashier.hold', {
        items: itemsR1, discountType: 'none', discountValue: 0, note: 'smoke R12 现金全额退单',
      }).catch((e) => ({ err: String(e?.message ?? e) }));
      const r1No = heldR1?.bill?.billNo ?? null;
      const r1Payable = heldR1?.bill?.payableFen ?? 0;
      if (r1No) {
        await trpcMutate(sessions.merchant, 'cashier.settle', {
          items: itemsR1, billNo: r1No, discountType: 'none', discountValue: 0, note: 'smoke R12 现金全额退单',
          payments: [{ method: 'cash', amountFen: r1Payable }],
        }).catch(() => null);
        const rf1 = await trpcMutate(sessions.merchant, 'refund.execute', { billNo: r1No, type: 'full', reason: 'smoke R12 现金单全额退' })
          .catch((e) => ({ err: String(e?.message ?? e) }));
        const rf1Row = rf1?.refund ?? null;
        const linkage1 = rf1Row?.linkageJson ?? {};
        check('R12 现金单全额退 executed（金额=原单已收）',
          !rf1?.err && rf1Row?.status === 'executed' && rf1Row?.amountFen === r1Payable,
          rf1?.err ?? `refundNo=${rf1Row?.refundNo} 金额=${rf1Row?.amountFen}`);
        check('R12 六联动快照含 rebateClawbackFen=0 列位（回馈金 R11 冻结回归）',
          !rf1?.err && 'rebateClawbackFen' in linkage1 && linkage1.rebateClawbackFen === 0,
          `keys=${Object.keys(linkage1).length}`);
        const billR1After = await trpcQuery(sessions.merchant, 'cashier.getBill', { billNo: r1No }).catch(() => null);
        const billR1Obj = billR1After?.bill ?? billR1After ?? {};
        check('R12 原单挂 refund_status=refunded + refund_bill_no 双向回指（已收 paidFen 不涂改）',
          billR1Obj?.refundStatus === 'refunded' && billR1Obj?.refundBillNo === rf1Row?.refundNo && billR1Obj?.paidFen === r1Payable,
          `refundStatus=${billR1Obj?.refundStatus} refundBillNo=${billR1Obj?.refundBillNo}`);
        const movR1 = await trpcQuery(sessions.merchant, 'inventory.listMovements', { sourceType: 'refund', limit: 100 })
          .catch((e) => ({ err: String(e?.message ?? e) }));
        const mvRow1 = Array.isArray(movR1) ? movR1.find((m) => m.sourceId === rf1Row?.refundNo && m.productId === product.id) : null;
        const stockR1After = (await trpcQuery(sessions.merchant, 'mall.listProductsForStore', { page: 1, pageSize: 100 }))?.items?.find((p) => p.id === product.id)?.stock;
        check('R12 商品 refund 流水前后值（delta=+1 连续）+ 库存回补到位',
          !movR1?.err && !!mvRow1 && mvRow1.delta === 1 && mvRow1.afterStock === mvRow1.beforeStock + 1 && stockR1After === stockR1Before,
          mvRow1 ? `流水 ${mvRow1.beforeStock}→${mvRow1.afterStock}，stock ${stockR1Before}→${stockR1After}` : `err=${movR1?.err ?? '未找到退款流水'}`);
      } else {
        check('R12 现金单全额退（挂单前置失败）', false, heldR1?.err ?? 'no billNo');
      }
    }

    // (b) 储值段单退（余额回补前后值）：CSV 导入建账 ¥100 → 现金 6/储值 4 组合单 → 按金额退 50% → 6:4 分摊回补。
    // 偏差说明：§6.6 对导入只 preview 不执行；本节为退款链路必须真实建户——executeImport 即生产建账
    // 通道（仅店主），重复跑余额累加 ¥100/次，断言全为相对前后值，幂等安全。
    const svCsv = [
      '门店,会员编号,会员姓名,手机号码,会员卡名称,储值本金余额(¥),储值赠送金额(¥),次卡名称,次卡剩余次数,累计消费金额(¥),累计消费次数,会员加入时间,上次消费时间',
      '贝肯山店,9001,演示甲,13800000000,银卡,100.00,0,,0,0,0,2026-09-01,2026-09-01',
    ].join('\n');
    const imp = await trpcMutate(sessions.merchant, 'storedValue.executeImport', { csvText: svCsv, filename: 'smoke-r12-sv.csv', mapping: { 贝肯山店: store5?.id } })
      .catch((e) => ({ err: String(e?.message ?? e) }));
    check('R12 前置：储值账户建账（executeImport 1 行 ¥100，仅店主生产通道）', !imp?.err && imp?.okRows === 1, imp?.err ?? `okRows=${imp?.okRows}`);
    if (!imp?.err && service?.id) {
      const balBefore = (await trpcQuery(sessions.merchant, 'cashier.searchMember', { phone: '13800000000' }))?.storedValueBalanceFen ?? null;
      const heldR2 = await trpcMutate(sessions.merchant, 'cashier.hold', {
        customerId: seedCustomer.id, items: [{ kind: 'service', refId: service.id, qty: 1 }],
        discountType: 'none', discountValue: 0, note: 'smoke R12 储值组合单',
      }).catch((e) => ({ err: String(e?.message ?? e) }));
      const r2No = heldR2?.bill?.billNo ?? null;
      const r2Payable = heldR2?.bill?.payableFen ?? 0;
      const cashPart = Math.round(r2Payable * 0.6);
      const svPart = r2Payable - cashPart;
      if (r2No && balBefore !== null && balBefore >= svPart) {
        await trpcMutate(sessions.merchant, 'cashier.settle', {
          customerId: seedCustomer.id, items: [{ kind: 'service', refId: service.id, qty: 1 }],
          billNo: r2No, discountType: 'none', discountValue: 0, note: 'smoke R12 储值组合单',
          payments: [{ method: 'cash', amountFen: cashPart }, { method: 'stored_value', amountFen: svPart }],
        }).catch(() => null);
        const balAfterSettle = (await trpcQuery(sessions.merchant, 'cashier.searchMember', { phone: '13800000000' }))?.storedValueBalanceFen;
        check('R12 储值段结账扣减（余额 −40% 段，前后值连续）', balAfterSettle === balBefore - svPart, `balance ${balBefore}→${balAfterSettle}`);
        const rfAmt = Math.floor(r2Payable / 2);
        const expSv = Math.floor((rfAmt * svPart) / r2Payable);
        const expCash = rfAmt - expSv; // 余数落最大段（cash>sv）
        const rf2 = await trpcMutate(sessions.merchant, 'refund.execute', { billNo: r2No, type: 'partial_amount', amountFen: rfAmt, reason: 'smoke R12 储值组合单退 50%' })
          .catch((e) => ({ err: String(e?.message ?? e) }));
        const segs2 = rf2?.plan?.segments ?? [];
        const cashSeg2 = segs2.find((s) => s.method === 'cash');
        const svSeg2 = segs2.find((s) => s.method === 'stored_value');
        const balAfterRefund = (await trpcQuery(sessions.merchant, 'cashier.searchMember', { phone: '13800000000' }))?.storedValueBalanceFen;
        check('R12 组合支付 6:4 分摊回补（按段占比精确到分）+ 储值余额回补前后值留痕',
          !rf2?.err && cashSeg2?.amountFen === expCash && svSeg2?.amountFen === expSv && svSeg2?.channel === 'stored_value_restore' &&
            balAfterRefund === balAfterSettle + expSv,
          rf2?.err ?? `segs=${segs2.map((s) => `${s.method}:${s.amountFen}`).join('/')} balance=${balAfterSettle}→${balAfterRefund}`);
      } else {
        check('R12 储值组合单（前置失败：余额不足或挂单失败）', false, `balBefore=${balBefore} svPart=${svPart} r2No=${r2No}`);
      }
    }

    // (c) 寄养剩余晚部分退：boarding 预约（明天入住 3 晚）→ 前台核销（in_boarding）→ 退房（completed）
    //     → 收银结账 → 退 2 晚。注：演示单明天入住→已发生 0 晚；「已发生晚一分不退」由 e2e §32（昨日入住夹具）实证。
    const boardingSvc5 = detail5?.services?.find((s) => s.type === 'boarding');
    const petsR = await trpcQuery(sessions.customer, 'pet.list').catch(() => null);
    const petR = petsR?.[0];
    if (boardingSvc5?.id && petR?.id && store5?.id && sessions.staff) {
      const STORE_TZ3 = 8 * 60 * 60 * 1000;
      const nowW3 = new Date(Date.now() + STORE_TZ3);
      const bStart = new Date(Date.UTC(nowW3.getUTCFullYear(), nowW3.getUTCMonth(), nowW3.getUTCDate() + 1, 15, 0, 0, 0) - STORE_TZ3);
      const bEnd = new Date(bStart.getTime() + 3 * 86400000);
      const bAppt = await trpcMutate(sessions.customer, 'appointment.create', {
        storeId: store5.id, petId: petR.id, serviceId: boardingSvc5.id, type: 'boarding',
        scheduledStart: bStart.toISOString(), scheduledEnd: bEnd.toISOString(),
        paymentMode: 'pay_at_store', note: 'smoke R12 寄养 3 晚单',
      }, { scheduledStart: ['Date'], scheduledEnd: ['Date'] }).catch((e) => ({ err: String(e?.message ?? e) }));
      const bAid = bAppt?.id ?? null;
      check('R12 寄养预约创建（明天入住共 3 晚）', !bAppt?.err && !!bAid, bAppt?.err ?? `id=${bAid}`);
      if (bAid) {
        const bCode = await trpcQuery(sessions.customer, 'appointment.getCode', { appointmentId: bAid }).catch(() => null);
        const bCheckin = bCode?.code
          ? await trpcMutate(sessions.staff, 'appointment.checkin', { code: bCode.code }).catch((e) => ({ err: String(e?.message ?? e) }))
          : { err: '取码失败' };
        const bOut = await trpcMutate(sessions.staff, 'boarding.checkout', { appointmentId: bAid }).catch((e) => ({ err: String(e?.message ?? e) }));
        check('R12 寄养核销 + 退房（in_boarding → completed）', !bCheckin?.err && !bOut?.err, bCheckin?.err ?? bOut?.err ?? 'ok');
        const heldB = await trpcMutate(sessions.merchant, 'cashier.hold', {
          items: [{ kind: 'appointment', refId: bAid, qty: 1 }], discountType: 'none', discountValue: 0, note: 'smoke R12 寄养结账',
        }).catch((e) => ({ err: String(e?.message ?? e) }));
        const bNo = heldB?.bill?.billNo ?? null;
        const bPayable = heldB?.bill?.payableFen ?? 0;
        if (bNo) {
          await trpcMutate(sessions.merchant, 'cashier.settle', {
            items: [{ kind: 'appointment', refId: bAid, qty: 1 }], billNo: bNo, discountType: 'none', discountValue: 0,
            note: 'smoke R12 寄养结账', payments: [{ method: 'cash', amountFen: bPayable }],
          }).catch(() => null);
          const rfB = await trpcMutate(sessions.merchant, 'refund.execute', { billNo: bNo, type: 'boarding_nights', nights: 2, reason: 'smoke R12 寄养退剩余 2 晚' })
            .catch((e) => ({ err: String(e?.message ?? e) }));
          const expB = Math.floor(bPayable / 3) * 2;
          const bd = rfB?.plan?.boarding ?? null;
          check('R12 寄养剩余晚部分退（退 2/3 晚，金额=floor(总价÷3)×2；分段明细透出总晚/退晚/晚单价）',
            !rfB?.err && rfB?.refund?.status === 'executed' && rfB?.refund?.amountFen === expB &&
              bd?.totalNights === 3 && bd?.nights === 2 && bd?.remainingNights === 3,
            rfB?.err ?? `amount=${rfB?.refund?.amountFen} 期望=${expB} boarding=${JSON.stringify(bd)}`);
        } else {
          check('R12 寄养结账（挂单前置失败）', false, heldB?.err ?? 'no billNo');
        }
      }
    } else {
      check('R12 寄养剩余晚部分退（前置缺失，显式跳过）', false, `boardingSvc=${boardingSvc5?.id ?? 'none'} pet=${petR?.id ?? 'none'} staff=${!!sessions.staff}`);
    }
  }

  // 5.15 R11a 会员前置批冒烟：微光开档 / 萤火售卖到店付（多宠 4 只 25800）/ 回馈金返 2% 挂期次 /
  //   抵扣段仅商品（服务行 rebate 段 403 明文）/ 日结分摊双口径（amortizationStats cashFen vs amortizedFen）。
  // 幂等口径：重复跑「已是会员」按幂等通过；金额断言全为相对值/增量。
  {
    // R11a 售卡夹具手机号每次运行唯一（重复跑幂等：会员不可重复售卡，新号=新客）
    const runTag = String(Date.now() % 10000000).padStart(7, '0'); // 7 位尾号 + 判别位，恰 11 位不截断
    const wgPhone = `139${runTag}1`;
    const yhPhone = `139${runTag}2`;
    // (a) 微光开档：新手机号旁路建档 + 0 元单成交；openFree 幂等（第二次 idempotent=true）
    const freeSell = await trpcMutate(sessions.merchant, 'membership.sell', {
      phone: wgPhone, planKey: 'plan_weiguang', petCount: 0, paySegments: [],
    }).catch((e) => ({ err: String(e?.message ?? e) }));
    check('R11a 微光开档（新手机号建档 + 0 元单直接成交）',
      (!freeSell?.err && freeSell?.membership?.planKey === 'plan_weiguang' && freeSell?.amountFen === 0) || /已是会员/.test(freeSell?.err ?? ''),
      freeSell?.err ?? `membership=${freeSell?.membership?.id} amount=${freeSell?.amountFen}`);
    const of1 = await trpcMutate(sessions.customer, 'membership.openFree').catch((e) => ({ err: String(e?.message ?? e) }));
    const of2 = await trpcMutate(sessions.customer, 'membership.openFree').catch((e) => ({ err: String(e?.message ?? e) }));
    check('R11a openFree 幂等（重复调用 idempotent=true 不重建）',
      !of1?.err && !of2?.err && of2?.idempotent === true, of1?.err ?? of2?.err ?? `idempotent=${of2?.idempotent}`);

    // (b) 萤火售卖到店付（多宠第 4 只 +¥59：19900+5900=25800 现金段，成交即开通，sold_store=本店）
    const curMonth = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 7); // 门店规范时区月（与 server monthWindow 同帧）
    const amoBefore = await trpcQuery(sessions.merchant, 'membership.amortizationStats', { month: curMonth }).catch(() => null);
    const sellYh = await trpcMutate(sessions.merchant, 'membership.sell', {
      phone: yhPhone, planKey: 'plan_yinghuo', petCount: 4, paySegments: [{ method: 'cash', amountFen: 25800 }],
    }).catch((e) => ({ err: String(e?.message ?? e) }));
    const yhMember = sellYh?.membership ?? null;
    const sellYhOk = !sellYh?.err && sellYh?.amountFen === 25800;
    check('R11a 萤火售卖到店付（4 只宠 25800 现金段，成交即开通 active）',
      sellYhOk && yhMember?.status === 'active' && yhMember?.petCount === 4,
      sellYh?.err ?? `amount=${sellYh?.amountFen} pets=${yhMember?.petCount} status=${yhMember?.status}`);
    check('R11a 双归属：memberships.sold_store_id=办卡店（本店）',
      !sellYhOk || yhMember?.soldStoreId === store5?.id, `soldStore=${yhMember?.soldStoreId}（重复跑已有会员时跳过）`);

    // (c) 回馈金返 2%（萤火会员商品单结账 → grant 挂期次；未到账口径=本期预计 pendingFen 增加）
    let yhUserId = yhMember?.userId ?? null;
    if (!yhUserId) {
      const mHit = await trpcQuery(sessions.merchant, 'cashier.searchMember', { phone: yhPhone }).catch(() => null);
      yhUserId = mHit?.id ?? null;
    }
    if (yhUserId && product?.id) {
      const fu0 = await trpcQuery(sessions.merchant, 'membership.forUser', { userId: yhUserId }).catch(() => null);
      const pend0 = fu0?.rebate?.pendingFen ?? 0;
      const prodPrice = product.priceFen ?? 0;
      const heldG = await trpcMutate(sessions.merchant, 'cashier.hold', {
        customerId: yhUserId, items: [{ kind: 'product', refId: product.id, qty: 1 }],
        discountType: 'none', discountValue: 0, note: 'smoke R11a 回馈金商品单',
      }).catch((e) => ({ err: String(e?.message ?? e) }));
      const gNo = heldG?.bill?.billNo ?? null;
      const gPayable = heldG?.bill?.payableFen ?? 0;
      if (gNo) {
        await trpcMutate(sessions.merchant, 'cashier.settle', {
          customerId: yhUserId, items: [{ kind: 'product', refId: product.id, qty: 1 }],
          billNo: gNo, discountType: 'none', discountValue: 0, note: 'smoke R11a 回馈金商品单',
          payments: [{ method: 'cash', amountFen: gPayable }],
        }).catch(() => null);
        const fu1 = await trpcQuery(sessions.merchant, 'membership.forUser', { userId: yhUserId }).catch(() => null);
        const expGrant = Math.round((prodPrice * 200) / 10000); // 萤火 2%
        check('R11a 回馈金返 2%（商品单 grant 挂期次：本期预计 +2% 精确到分，余额未动=次月到账）',
          (fu1?.rebate?.pendingFen ?? -1) - pend0 === expGrant && fu1?.rebate?.balanceFen === fu0?.rebate?.balanceFen,
          `pending ${pend0}→${fu1?.rebate?.pendingFen}（期望 +${expGrant}）`);
      } else {
        check('R11a 回馈金返 2%（挂单前置失败）', false, heldG?.err ?? 'no billNo');
      }

      // (d) 抵扣段仅商品：服务行+rebate 段 → 403 明文；商品行+rebate 段 → 闸门通过（余额足则成，不足则「余额不足」明文——均证明已过仅商品闸）
      // 会员折扣后应收≠门市价（萤火 88 折 8800→7744）：先 hold 取服务端重算应收再 settle（5.6 同口径），否则先撞合计闸
      const svcCart = {
        customerId: yhUserId, items: [{ kind: 'service', refId: service.id, qty: 1 }],
        discountType: 'none', discountValue: 0, note: 'smoke R11a 服务行 rebate 验证',
      };
      const heldSvc = await trpcMutate(sessions.merchant, 'cashier.hold', svcCart).catch(() => null);
      const svcBillNo = heldSvc?.bill?.billNo ?? null;
      const svcPayable = heldSvc?.bill?.payableFen ?? 0;
      const svcRebate = svcBillNo
        ? await trpcMutate(sessions.merchant, 'cashier.settle', {
            ...svcCart, billNo: svcBillNo,
            payments: [{ method: 'rebate', amountFen: 100 }, { method: 'cash', amountFen: svcPayable - 100 }],
          }).then(() => ({ err: null })).catch((e) => ({ err: String(e?.message ?? e) }))
        : { err: 'hold 失败（前置）' };
      check('R11a 抵扣段仅商品（服务行 + rebate 段 → 403「回馈金仅可抵商品」）',
        /FORBIDDEN/.test(svcRebate?.err ?? '') && /仅可抵商品/.test(svcRebate?.err ?? ''), svcRebate?.err ?? '未被拒（异常）');
      const prodRebate = await trpcMutate(sessions.merchant, 'cashier.settle', {
        customerId: yhUserId, items: [{ kind: 'product', refId: product.id, qty: 1 }],
        discountType: 'none', discountValue: 0, note: 'smoke R11a 商品行 rebate 验证',
        payments: [{ method: 'rebate', amountFen: 100 }, { method: 'cash', amountFen: prodPrice - 100 }],
      }).then((r) => ({ err: null, ok: (r?.bill?.status ?? r?.status) === 'settled' })).catch((e) => ({ err: String(e?.message ?? e) }));
      // 余额未到账（grant 次月才入账）时明文「余额不足」= 已过「仅商品」闸；余额足够则直接成交
      check('R11a 抵扣段仅商品（商品行 + rebate 段过闸门：成交或余额不足明文，不触「仅可抵商品」）',
        (prodRebate.ok === true || /余额不足/.test(prodRebate?.err ?? '')) && !/仅可抵商品/.test(prodRebate?.err ?? ''),
        prodRebate.err ?? `settled=${prodRebate.ok}`);

      // (e) 日结分摊双口径：amortizationStats 当月售卡实收（cashFen）vs 分摊确认（amortizedFen）并列
      const amoAfter = await trpcQuery(sessions.merchant, 'membership.amortizationStats', { month: curMonth }).catch(() => null);
      check('R11a 日结分摊双口径并列（cashFen 收现 vs amortizedFen 分摊，两字段同帧透出）',
        !!amoAfter && typeof amoAfter.cashFen === 'number' && typeof amoAfter.amortizedFen === 'number' &&
          amoAfter.cashFen >= (amoBefore?.cashFen ?? 0) && amoAfter.amortizedFen >= 0 &&
          // 本次售卖成功时：收现口径恰 +25800，分摊口径 ≥ round(25800/12)=2150
          (!sellYhOk || (amoAfter.cashFen - (amoBefore?.cashFen ?? 0) === 25800 && amoAfter.amortizedFen >= 2150)),
        `cashFen ${amoBefore?.cashFen}→${amoAfter?.cashFen} amortizedFen=${amoAfter?.amortizedFen}`);
    } else {
      check('R11a 回馈金/抵扣/分摊链路（前置失败：萤火会员 userId 或商品缺失）', false, `yhUserId=${yhUserId} product=${product?.id}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6. M1-补2 收银修复包：同源聚合 / 三级闸门 / 日结 / 反结账 / 储值导入   */
/* ------------------------------------------------------------------ */

if (sessions.merchant) {
  // 6.0 clerk 会话与服务项重取（种子动态取数，禁硬编码 ULID）
  const clerkUser = seeds?.find((u) => u.roles.includes('merchant_clerk'));
  let clerkCookie = null;
  if (clerkUser) {
    const r = await devLogin(clerkUser.id, GATE ?? undefined);
    clerkCookie = r.cookie;
    check(`dev-login（${clerkUser.nickname} / clerk）`, r.status === 200 && r.cookie.includes('philia_session='), `status=${r.status}`);
  } else {
    check('种子含 merchant_clerk（seed_clerk）', false, '未找到 clerk 种子');
  }
  const nearby6 = await trpcQuery(sessions.customer, 'store.listNearby', { lat: 30.2741, lng: 120.1551 });
  const store6 = nearby6?.stores?.[0];
  const detail6 = store6 ? await trpcQuery(sessions.customer, 'store.getWithServices', { storeId: store6.id }) : null;
  const service6 = detail6?.services?.find((s) => s.type === 'grooming') ?? null;

  // 6.1 同源聚合出口：字段齐全 + 已收=现金类和可加总
  const tender = await trpcQuery(sessions.merchant, 'store.todayTenderStats', {});
  const t = tender?.tender ?? {};
  const sumOk = (t.cashFen ?? 0) + (t.wechatFen ?? 0) + (t.alipayFen ?? 0) === tender?.receivedTotalFen;
  check('收银修复包 todayTenderStats（已收=现金+微信+支付宝可加总）', !!tender && sumOk && typeof t.passFen === 'number' && typeof t.storedValueFen === 'number',
    `已收=${tender?.receivedTotalFen}分 分列=${t.cashFen}/${t.wechatFen}/${t.alipayFen} 参考列 pass=${t.passFen} sv=${t.storedValueFen}`);

  // 6.2 三处同源：todayTenderStats / dashboardStats.todayTender / financeStats.todayTender 同数
  const STORE_TZ_MS2 = 8 * 60 * 60 * 1000;
  const nowWc2 = new Date(Date.now() + STORE_TZ_MS2);
  const d0 = new Date(Date.UTC(nowWc2.getUTCFullYear(), nowWc2.getUTCMonth(), nowWc2.getUTCDate(), 0, 0, 0, 0) - STORE_TZ_MS2);
  const d1 = new Date(d0.getTime() + 24 * 60 * 60 * 1000);
  const dash = await trpcQuery(sessions.merchant, 'store.dashboardStats', {});
  const fin2 = await trpcQuery(sessions.merchant, 'store.financeStats', { from: d0.toISOString(), to: d1.toISOString() }, { from: ['Date'], to: ['Date'] });
  const v1 = tender?.receivedTotalFen, v2 = dash?.todayTender?.receivedTotalFen, v3 = fin2?.todayTender?.receivedTotalFen;
  check('收银修复包 三处同源同数（总览/收银台头部/财务头部）', v1 !== undefined && v1 === v2 && v2 === v3, `三处=${v1}/${v2}/${v3}分`);

  // 6.3 clerk 闸门：开单 200 / 改价 403 / 财务聚合 403 / 营业额遮罩 / 撤单未支付放行 / 日结 403
  if (clerkCookie) {
    const clerkTender = await trpcQuery(clerkCookie, 'store.todayTenderStats', {});
    check('clerk 营业额遮罩（restricted=true 且金额 null）', clerkTender?.restricted === true && (clerkTender?.tender?.cashFen ?? null) === null, `restricted=${clerkTender?.restricted}`);
    let clerkBillNo = null;
    if (service6) {
      const clerkHold = await trpcMutate(clerkCookie, 'cashier.hold', {
        items: [{ kind: 'service', refId: service6.id, qty: 1 }],
        discountType: 'none', discountValue: 0, note: 'smoke clerk 开单验证',
      }).then((r) => ({ ok: true, bill: r?.bill ?? r })).catch((e) => ({ ok: false, err: String(e?.message ?? e) }));
      clerkBillNo = clerkHold.bill?.billNo ?? null;
      check('clerk 开单 cashier.hold 放行', clerkHold.ok === true, clerkHold.ok ? `billNo=${clerkBillNo}` : clerkHold.err);
    }
    if (service6) {
      const clerkPriced = await trpcMutate(clerkCookie, 'cashier.hold', {
        items: [{ kind: 'service', refId: service6.id, qty: 1, adjustedPriceFen: 100 }],
        discountType: 'none', discountValue: 0, note: 'smoke clerk 改价验证（应被拒）',
      }).then(() => false).catch((e) => /店主|FORBIDDEN|改价/.test(String(e?.message ?? e)));
      check('clerk 改价 403（服务端硬闸门）', clerkPriced === true, '');
    }
    const clerkFin = await trpcQuery(clerkCookie, 'store.financeStats', { from: d0.toISOString(), to: d1.toISOString() }, { from: ['Date'], to: ['Date'] }).then(() => false).catch(() => true);
    check('clerk financeStats 403', clerkFin === true, '');
    if (clerkBillNo) {
      const clerkVoid = await trpcMutate(clerkCookie, 'cashier.voidBill', { billNo: clerkBillNo, reason: 'smoke clerk 撤单验证' }).then((r) => ((r?.bill ?? r)?.status === 'voided')).catch(() => false);
      check('clerk 撤单（未支付单，补丁①放宽）放行', clerkVoid === true, '');
    }
    const clerkClose = await trpcMutate(clerkCookie, 'cashier.dayClose', { actualCashFen: 0 }).then(() => false).catch(() => true);
    check('clerk 日结 403（无交接班/日结权）', clerkClose === true, '');
  }

  // 6.4 日结全流程（owner）：当前班次 → 日结冻结 → 列表可查（重复跑：已冻结视为幂等通过）
  const shift = await trpcQuery(sessions.merchant, 'cashier.currentShift', {});
  check('日结 当前班次可查（懒建开班）', !!(shift?.shift?.id ?? shift?.id), `shift=${shift?.shift?.id ?? shift?.id ?? 'none'}`);
  const tenderNow = await trpcQuery(sessions.merchant, 'store.todayTenderStats', {});
  const bookCash = tenderNow?.tender?.cashFen ?? 0;
  const closeRes = await trpcMutate(sessions.merchant, 'cashier.dayClose', { actualCashFen: bookCash, note: 'smoke 日结验证' })
    .then((r) => ({ ok: true, close: r?.close ?? r }))
    .catch((e) => ({ ok: false, err: String(e?.message ?? e) }));
  const closeOk = closeRes.ok || /已冻结|已日结|CONFLICT|已存在|已结/.test(closeRes.err ?? '');
  check('日结 cashier.dayClose 冻结当班（当日已结则幂等通过）', closeOk, closeRes.ok ? `diff=${closeRes.close?.diffFen ?? 0}分` : (closeRes.err ?? '').slice(0, 60));
  const closes = await trpcQuery(sessions.merchant, 'cashier.listDayCloses', {});
  const closeRows = closes?.closes ?? closes ?? [];
  check('日结单留痕可查（listDayCloses）', (closeRows.some?.((c) => c.status === 'frozen' || c.kind === 'close') ?? false), `rows=${closeRows.length}`);

  // 6.5 反结账单（owner）：挑一张今日未冲正 settled 单冲正 → 冲正单生成 + 原单链接；manager 403
  const ledgerNow = await trpcQuery(sessions.merchant, 'cashier.listBills', { range: 'today' });
  const settledRow = (ledgerNow?.bills ?? ledgerNow ?? []).find?.((b) => b.status === 'settled' && !(b.reversedAt ?? b.reversed_at));
  if (settledRow) {
    const rev = await trpcMutate(sessions.merchant, 'cashier.reverseBill', { billNo: settledRow.billNo, reason: 'smoke 反结账验证' }).catch((e) => ({ err: String(e?.message ?? e) }));
    const revBill = rev?.reversalBill ?? rev?.reversal ?? null;
    check('反结账单 cashier.reverseBill（owner，强制原因+关联原单）', !rev?.err && (!!revBill || rev?.ok === true || !!(rev?.bill ?? null)), `原单=${settledRow.billNo} 冲正=${revBill?.billNo ?? rev?.reversalBillNo ?? '见日志'}`);
    const mgrUser = seeds?.find((u) => u.roles.includes('merchant_manager'));
    if (mgrUser) {
      const mgrLogin = await devLogin(mgrUser.id, GATE ?? undefined);
      const mgrDeny = await trpcMutate(mgrLogin.cookie, 'cashier.reverseBill', { billNo: settledRow.billNo, reason: 'x' }).then(() => false).catch(() => true);
      check('manager 反结账 403（仅店主）', mgrDeny === true, '');
    }
  } else {
    check('反结账单（今日有 settled 单可冲）', false, '今日无 settled 单');
  }

  // 6.6 储值导入接口：preview 零写入对账（演示台账内嵌 2 行；execute 不在 smoke 层执行——只交付不执行口径）
  const demoCsv = [
    '门店,会员编号,会员姓名,手机号码,会员卡名称,储值本金余额(¥),储值赠送金额(¥),次卡名称,次卡剩余次数,累计消费金额(¥),累计消费次数,会员加入时间,上次消费时间',
    '贝肯山店,9001,演示甲,13800000000,银卡,100.00,0,,0,0,0,2026-09-01,2026-09-01',
    '生活馆店,9002,演示乙,13911112222,银卡,50.00,0,,0,0,0,2026-09-01,2026-09-01',
  ].join('\n');
  const preview = await trpcMutate(sessions.merchant, 'storedValue.previewImport', {
    csvText: demoCsv, filename: 'smoke-demo.csv',
    mapping: { 贝肯山店: store6?.id, 生活馆店: store6?.id, 生态城店: store6?.id },
  }).catch((e) => ({ err: String(e?.message ?? e) }));
  const src = preview?.sourceStats ?? preview?.report?.sourceStats ?? preview ?? {};
  const srcStr = JSON.stringify(src);
  check('储值导入 preview（零写入+校验位：2 行/本金 ¥150）',
    !preview?.err && /15000/.test(srcStr) && /("totalRows":2|"rows":2)/.test(srcStr),
    `sourceStats=${srcStr.slice(0, 140)}`);
  if (clerkCookie) {
    const clerkImport = await trpcMutate(clerkCookie, 'storedValue.previewImport', { csvText: demoCsv, mapping: {} }).then(() => false).catch(() => true);
    check('clerk 储值导入 403（仅老板）', clerkImport === true, '');
  }
}

console.log(`\n目标：${BASE}${GATE ? '（口令门已启用）' : '（口令门未设置，开发期开放口径）'}`);
console.log(failures === 0 ? '全部通过 🎉' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
