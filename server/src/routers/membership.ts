/**
 * 会员 router（批次 R11a 会员前置批·骨架批 · 27 号任务书冻结版 V1.0 §二/§四/§六/§七 +
 * docs/r11/R11a-DESIGN.md §三/§四）
 *
 * namespace membership 端点：
 * - plans            四档配置透出（public；客户端开通页/收银台共用，多宠规则与权益表述明面，
 *                    安心包=全员免费表述在权益 label——CJ-0922-13 落槌，非会员 ¥15 作废）
 * - my               本人会员+回馈金账本（customer；非会员 null+引导；补缺-3 增透
 *                    nextPlanKey/nextPlanSetAt/upgradeAvailable/changeWindowDays 入口判定字段）
 * - ledger           W-01 回馈金账本独立页数据源（customer · R11b；全量流水+溯源联表商品名/门店名+本年累计）
 * - openFree         注册用户一键注册（customer；免费 0 元，手机号即会员=用户本身，幂等）
 * - sell             收银台售卡（merchant；到店付现金/微信/支付宝段，多宠附加费入单；
 *                    补缺-3 防滥用两件：退会窗口内重购/累计退会≥阈值再购 → cancel_rebuy_note 留痕不拦截）
 * - renew            收银台续费（merchant；解冻 frozen→active+expires 顺延+回馈金解冻；
 *                    补缺-3 扩展：预约 next_plan_key 非空 → 按预约档全价收款+切档+置空+executed 留痕）
 * - cancel           退会（manager|owner；折算=剩余整月×月均价精确到分，回馈金清零留痕）
 * - upgradeQuote     升档试算（customer 本人 / upgradeQuoteForUser 收银台代客；双薄端点共用
 *                    quoteUpgrade 内部函数；期内降级档不出现；注册用户=新购口径）
 * - upgrade          期内升档（merchant · withCashierWriteLock；server 兜底重算差价不信入参；
 *                    Σ支付段=差价硬校验；补差单 discountType='none'+paid_fen=原实付+补差；
 *                    即时生效新档到期日不变；在途回馈金不重算、旧档余额零动作；同档重放幂等；
 *                    注册用户档=新购口径全价+重起算有效期+sold_store 补办理店）
 * - scheduleChange   到期换档预约（customer；到期前 member_change_window_days 天窗口内任意档，
 *                    重复预约覆盖幂等）/ cancelScheduleChange（置空+留痕）
 * - mySavings        今年已省双源（customer；rebateSettledFen=QA40-D10 yearGrantFen 同源 +
 *                    serviceDiscountFen=当年服务/预约行 (unit−adjusted)×qty 合计，两源分明透出）
 * - savingsPreview   非会员当单「开通萤火立省 ¥X」（merchant；实时读 member_plans 萤火行）
 * - amortizationStats 年费分摊双口径（merchant；日结/看板用：当月售卡实收 + 当月分摊确认）
 *
 * 红线落点：
 * - 三本账物理分离永不计营业额（售卡款=会员费权益服务费，不计储值账户不进储值看板；
 *   回馈金账本见 services/rebate.ts 头注）；
 * - 内测期售卡/续费=收银台「到店付」收款+开通确认（成交即开通；微信/支付宝线上通道
 *   未接入，接口预留——任务书 §〇④）；退会退款=内测期线下原路退回口径（R12 沿用），
 *   refund_fen 透出待线下退，本端点无任何线上退款写入；
 * - 连锁双归属（决策 #41）：会员卡=全局档位表（member_plans 中央建卡，三店通用）；
 *   售卡单 sold_store=bill.store_id=本店落 memberships.sold_store_id；
 * - 售卡提成定额由 commission 读侧自然计提（本路由已落 cashier_bill_items
 *   kind='membership' 行，commission.ts 卡线计提不在本文件——另一代理施工）。
 */

import { TRPCError } from '@trpc/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  balanceOf,
  clearRebateAccount,
  currentMembership,
  ensureRebateAccount,
  loadMemberPlans,
  planNum,
  planStr,
  rebatePeriodOf,
  unfreezeRebateAccount,
  voidPendingGrants,
  type MemberPlanRow,
  type MembershipRow,
} from '../services/rebate';
import type { DbHandle } from '../services/xpAward';
import {
  customerProcedure,
  merchantManagerProcedure,
  merchantProcedure,
  publicProcedure,
  router,
} from '../trpc';
import { ensureOpenShift, genBillNo, withCashierWriteLock } from './cashier';
import { storeDayStartMs, storeWallclock } from './appointment';

/** 事务 handle 类型断言（同 attendance.ts 惯例） */
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* 补缺修复小批 P1-3：免费档数据层永久有效（CJ-0925-10④ 注册用户=永久普通会员）      */
/* ------------------------------------------------------------------ */

/** 免费档到期日=远端 2099-12-31T23:59:59Z（unix 秒 4102444799；与迁移 0023 存量修正同值）。
 *  展示侧永不显示该数字（plan.free 分支写「永久有效」）；懒冻结对免费档既有豁免（PR-4 件 1）。 */
export const FREE_PLAN_EXPIRES_AT = new Date(4102444799 * 1000);

/** 免费档判定=member_plans.value_json.free 真值（同 planPublicShape 透出口径，非硬编码档键） */
function isFreePlanRow(plan: MemberPlanRow | undefined): boolean {
  if (!plan) return false;
  return planNum(plan, 'free', 0) === 1 || (plan.valueJson as Record<string, unknown>).free === true;
}

/* ------------------------------------------------------------------ */
/* 打回①：退会折算自动挂退款单（R12 同通道）工具                            */
/* ------------------------------------------------------------------ */

/**
 * 退款单号日序发生器：RB-{YYYYMMDD}-{当日 3 位序号}。
 * refund.ts 的 genRefundNo 未导出且本批不动 refund.ts（另一代理钱域文件），
 * 同模式自写（照 cashier genBillNo / refund genRefundNo 模式：门店规范时区 +8
 * 当日窗口 count+1；调用方须在收银写串行锁/事务内使用）。
 */
async function genRefundNoLocal(d: DbHandle, storeId: string, now: Date): Promise<string> {
  const w = storeWallclock(now);
  const dayStart = new Date(storeDayStartMs(w.y, w.m, w.day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const row = await d
    .select({ n: sql<number>`count(*)` })
    .from(schema.refundBills)
    .where(
      and(
        eq(schema.refundBills.storeId, storeId),
        gte(schema.refundBills.createdAt, dayStart),
        lt(schema.refundBills.createdAt, dayEnd),
      ),
    )
    .get();
  const seq = Number(row?.n ?? 0) + 1;
  return `RB-${w.y}${pad2(w.m)}${pad2(w.day)}-${String(seq).padStart(3, '0')}`;
}

/** 门店规范时区（+8）YYYY-MM-DD（refund.ts storeLocalDateStr 未导出，同口径自写） */
function storeLocalDateStrLocal(d: Date): string {
  const w = storeWallclock(d);
  return `${w.y}-${pad2(w.m)}-${pad2(w.day)}`;
}
/** 'YYYY-MM' → 当月起止（本地时区 Date） */
function monthWindow(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

/** 剩余整月数（退会折算口径）：expires_at 往前整月数，已用零头月不计 */
export function remainingWholeMonths(now: Date, expiresAt: Date): number {
  let months =
    (expiresAt.getFullYear() * 12 + expiresAt.getMonth()) -
    (now.getFullYear() * 12 + now.getMonth());
  if (expiresAt.getDate() < now.getDate()) months -= 1; // 已用零头月不计
  return Math.max(0, months);
}

/**
 * 退会折算（CJ-0922-13 落槌口径）：剩余整月×月均价，精确到分。
 * - 月均价=paid_fen÷12（不先取整：59900÷12=4991.66…，×3=14975 精确到分=¥149.75，
 *   对齐任务书示例）；已用零头月不计（到期日「日」< 退会日「日」时当月零头抹掉）；
 * - 续费场景 paid_fen 为当期实付（见 renew），剩余整月理论可超 12，折算封顶 paid_fen
 *   （内测期口径报备：多缴年度折算超额部分不放大退款）。
 */
export function cancelRefundFen(paidFen: number, now: Date, expiresAt: Date): number {
  if (paidFen <= 0) return 0;
  const months = remainingWholeMonths(now, expiresAt);
  return Math.min(Math.round((paidFen * months) / 12), paidFen);
}

/** 档位公开展示形状（plans 端点透出；多宠规则/权益表述明面，label 即权益文案） */
function planPublicShape(row: MemberPlanRow | undefined) {
  if (!row) return null;
  return {
    planKey: row.ruleKey,
    label: row.label,
    version: row.version,
    free: planNum(row, 'free', 0) === 1 || (row.valueJson as Record<string, unknown>).free === true,
    priceFen: planNum(row, 'price_fen', 0),
    rebateBp: planNum(row, 'rebate_bp', 0),
    serviceDiscountBp: planNum(row, 'service_discount_bp', 10000),
    includedPets: planNum(row, 'included_pets', 3),
    extraPetFen: planNum(row, 'extra_pet_fen', 5900),
    maxPets: planNum(row, 'max_pets', 10),
  };
}

/** 售卡/续费金额=档价+多宠附加费（含 included_pets 只，超出每只 +extra_pet_fen；max_pets 封顶硬校验）。
 *  批次 6 补缺大批：export 供 routers/pay.ts 线上开通 server 重算金额同源（前端金额一律不信）。 */
export function membershipChargeFen(
  plan: MemberPlanRow,
  petCount: number,
): { amountFen: number; extraCount: number; priceFen: number } {
  const priceFen = planNum(plan, 'price_fen', 0);
  const included = planNum(plan, 'included_pets', 3);
  const extraPetFen = planNum(plan, 'extra_pet_fen', 5900);
  const maxPets = planNum(plan, 'max_pets', 10);
  if (petCount > maxPets) badRequest(`多宠封顶 ${maxPets} 只（第 ${included + 1} 只起 +¥${(extraPetFen / 100).toFixed(2)}/年/只）`);
  const extraCount = Math.max(0, petCount - included);
  return { amountFen: priceFen + extraCount * extraPetFen, extraCount, priceFen };
}

/** 售卡/续费收银段落库（kind='membership' 行 + 支付段 + settled 单；内测期到店付口径） */
async function writeMembershipBill(
  t: DbHandle,
  opts: {
    storeId: string;
    operatorId: string;
    userId: string;
    planKey: string;
    planLabel: string;
    petCount: number;
    amountFen: number;
    paySegments: Array<{ method: 'cash' | 'wechat' | 'alipay'; amountFen: number }>;
    now: Date;
    kindNote: '售卡' | '续费' | '升级补差'; // 补缺-3：升级补差单同族（会员费类目，discountType='none'）
    /** 单头 note 覆写（升级补差单落「升级补差 萤火→暖阳」式双档名；缺省=「{kindNote} {planLabel}」） */
    noteOverride?: string;
    outboxIds: string[];
  },
): Promise<{ billNo: string; billId: string }> {
  const outboxIds = opts.outboxIds;
  const billNo = await genBillNo(t, opts.storeId, opts.now);
  const { shift, openedOutboxId } = await ensureOpenShift(t, opts.storeId, opts.operatorId, opts.now);
  if (openedOutboxId) outboxIds.push(openedOutboxId);
  const bill = await t
    .insert(schema.cashierBills)
    .values({
      billNo,
      storeId: opts.storeId,
      status: 'settled', // 内测期到店付：收款登记即成交（开通确认=成交即开通）
      customerId: opts.userId,
      discountType: 'none', // 售卡单不计服务折扣（年费=权益服务费，红线 6 折扣仅限服务行）
      discountValue: 0,
      subtotalFen: opts.amountFen,
      discountFen: 0,
      payableFen: opts.amountFen,
      paidFen: opts.amountFen,
      note: opts.noteOverride ?? `${opts.kindNote} ${opts.planLabel}`,
      createdBy: opts.operatorId,
      operatorId: opts.operatorId,
      receptionistId: opts.operatorId,
      shiftId: shift.id,
      settledAt: opts.now,
    })
    .returning()
    .then((r) => r[0]!);
  await t.insert(schema.cashierBillItems).values({
    billId: bill.id,
    kind: 'membership', // 决策 #41 售卡单：sold_store=bill.store_id（消费店语义注释写死）；commission 卡线定额读侧计提
    refId: opts.planKey,
    nameSnapshot: opts.planLabel,
    specSnapshot: `含宠物 ${opts.petCount} 只`,
    qty: 1,
    unitPriceFen: opts.amountFen,
    adjustedPriceFen: null,
    paidByPass: false,
    stockShort: false,
  });
  if (opts.paySegments.length > 0) {
    await t.insert(schema.cashierPayments).values(
      opts.paySegments.map((p) => ({ billId: bill.id, method: p.method, amountFen: p.amountFen, passId: null })),
    );
  }
  outboxIds.push(
    await emitEvent(t, `store:${opts.storeId}`, EventType.CashierBillSettled, {
      billId: bill.id,
      billNo,
      payableFen: opts.amountFen,
      paidFen: opts.amountFen,
      passFen: 0,
      storedValueFen: 0,
      rebateFen: 0,
      storedValueBalanceAfterFen: null,
      itemCount: 1,
      hasStockShort: false,
      kind: 'membership', // 售卡/续费单标记（流水展示区分）
      by: opts.operatorId,
    }),
  );
  return { billNo, billId: bill.id };
}

const paySegmentSchema = z.object({
  method: z.enum(['cash', 'wechat', 'alipay']), // 内测期到店付三段（回馈金/储值/次卡段不用于售卡——三本账物理分离）
  amountFen: z.number().int().min(1, '支付金额须 ≥1 分').max(100_000_000),
});

/* ------------------------------------------------------------------ */
/* 补缺-3（46 号档+PD-07）：升档试算 / 到期换档 / 防滥用 共用件              */
/* ------------------------------------------------------------------ */

/** 注册默认档键（读 default_plan_key 全局键；键值指向不存在档行回退 plan_weiguang，同 openFree 口径）
 *  会员链路片 2 导出：pay 域 membership_upgrade 注册用户判定同源复用 */
export function defaultPlanKeyOf(plans: Map<string, MemberPlanRow>): string {
  const configured = planStr(plans.get('default_plan_key'), 'value', 'plan_weiguang');
  return plans.has(configured) ? configured : 'plan_weiguang';
}

/** 档位短名（label「会员档·萤火：…」→「萤火」；取不到回退 ruleKey，升级补差单 note 用） */
function shortPlanName(plan: MemberPlanRow): string {
  const hit = plan.label.match(/·([^：:·]+)/);
  return hit?.[1]?.trim() || plan.ruleKey;
}

/** 到期换档预约窗口天数（端口 member_change_window_days，默认 30） */
function changeWindowDaysOf(plans: Map<string, MemberPlanRow>): number {
  return planNum(plans.get('member_change_window_days'), 'days', 30);
}

/** 当年回馈金发放合计（QA40-D10 单类行口径：每期只计一类行——未结算=计提行／已结算=入账行
 *  source_id=批次 id；ledger.yearGrantFen 与 mySavings.rebateSettledFen 同源复用） */
async function yearGrantFenOf(d: DbHandle, userId: string, now: Date): Promise<number> {
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const rows = await d
    .select({ total: sql<number>`coalesce(sum(${schema.rebateLogs.deltaFen}), 0)` })
    .from(schema.rebateLogs)
    .where(
      and(
        eq(schema.rebateLogs.userId, userId),
        eq(schema.rebateLogs.type, 'grant'),
        gte(schema.rebateLogs.createdAt, yearStart),
        or(
          isNull(schema.rebateLogs.settlementId),
          eq(schema.rebateLogs.sourceId, schema.rebateLogs.settlementId),
        ),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

/** 升档差价试算明面（46 号档+PD-07 冻结公式，精确到分）
 *  会员链路片 2 导出：pay 域 membership_upgrade 收单/兑付同源性=直接复用本函数（不重写算式） */
export interface UpgradeDiffQuote {
  planKey: string;
  label: string;
  remainingMonths: number;
  baseDiffFen: number;
  petDiffFen: number;
  totalDiffFen: number;
  formula: {
    m: number;
    newMonthlyFen: number;
    oldMonthlyFen: number;
    perMonthDiffFen: number;
    /** true=注册用户档新购口径（差价=新档全价+附加按现 petCount 重算，无剩余整月折算） */
    newPurchase: boolean;
  };
}

/**
 * 单目标档差价重算（server 兜底，不信任前端传入金额）：
 * - 付费档升档：补差价 = remainingWholeMonths ×（新档月均价 − 旧档月均价），
 *   月均价=档价÷12 不先取整、末位 round 到分（remainingWholeMonths 用既有同族函数：
 *   到期日「日」< 升级日「日」抹当月零头）；多宠附加费随同公式
 *   （(新附加年额−旧附加年额)×m÷12 末位 round；现码四档附加同价 5900 → 该项恒 0，照公式实现）；
 * - 注册用户档（=default_plan_key 读档判断）=新购口径：差价=新档全价+多宠附加按现 petCount 重算，
 *   remainingMonths=0、formula.newPurchase=true。
 */
export function computeUpgradeDiff(
  plans: Map<string, MemberPlanRow>,
  m: MembershipRow,
  target: MemberPlanRow,
  now: Date,
): UpgradeDiffQuote {
  const cur = plans.get(m.planKey);
  if (m.planKey === defaultPlanKeyOf(plans) || !cur) {
    const { amountFen } = membershipChargeFen(target, m.petCount); // 新购口径：全价+附加按现 petCount 重算
    const priceFen = planNum(target, 'price_fen', 0);
    return {
      planKey: target.ruleKey,
      label: target.label,
      remainingMonths: 0,
      baseDiffFen: amountFen,
      petDiffFen: 0,
      totalDiffFen: amountFen,
      formula: { m: 0, newMonthlyFen: priceFen / 12, oldMonthlyFen: 0, perMonthDiffFen: priceFen / 12, newPurchase: true },
    };
  }
  const months = remainingWholeMonths(now, m.expiresAt);
  const newPrice = planNum(target, 'price_fen', 0);
  const oldPrice = planNum(cur, 'price_fen', 0);
  const baseDiffFen = Math.round((months * (newPrice - oldPrice)) / 12);
  const oldPetYearFen = planNum(cur, 'extra_pet_fen', 5900) * Math.max(0, m.petCount - planNum(cur, 'included_pets', 3));
  const newPetYearFen = planNum(target, 'extra_pet_fen', 5900) * Math.max(0, m.petCount - planNum(target, 'included_pets', 3));
  const petDiffFen = Math.round((months * (newPetYearFen - oldPetYearFen)) / 12);
  return {
    planKey: target.ruleKey,
    label: target.label,
    remainingMonths: months,
    baseDiffFen,
    petDiffFen,
    totalDiffFen: baseDiffFen + petDiffFen,
    formula: { m: months, newMonthlyFen: newPrice / 12, oldMonthlyFen: oldPrice / 12, perMonthDiffFen: (newPrice - oldPrice) / 12, newPurchase: false },
  };
}

/** 升档试算（upgradeQuote 本人 / upgradeQuoteForUser 收银台代客 双薄端点共用内部函数） */
async function quoteUpgrade(
  d: DbHandle,
  userId: string,
  now: Date,
): Promise<{ currentPlan: ReturnType<typeof planPublicShape>; targetPlans: UpgradeDiffQuote[]; windowDays: number }> {
  const m = await currentMembership(d, userId, now);
  const plans = await loadMemberPlans(d);
  const windowDays = changeWindowDaysOf(plans);
  if (!m) return { currentPlan: null, targetPlans: [], windowDays };
  const cur = plans.get(m.planKey);
  if (!cur) badRequest('当前档位配置缺失，请检查会员档配置');
  const curPrice = planNum(cur, 'price_fen', 0);
  const isFreeCurrent = m.planKey === defaultPlanKeyOf(plans);
  const targetPlans = [...plans.values()]
    .filter((p) => p.ruleKey.startsWith('plan_') && p.ruleKey !== m.planKey)
    /* 期内只升不降：降级档不出现（注册用户=新购口径不受限，任意付费档皆可升） */
    .filter((p) => isFreeCurrent || planNum(p, 'price_fen', 0) > curPrice)
    .map((p) => computeUpgradeDiff(plans, m, p, now))
    .sort((a, b) => a.totalDiffFen - b.totalDiffFen);
  return { currentPlan: planPublicShape(cur), targetPlans, windowDays };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/* ------------------------------------------------------------------ */
/* 片 3：会员码签发/核验（HMAC token，时效 5min）                            */
/* ------------------------------------------------------------------ */

/** 会员码签名密钥（内测口径：仓内常量缺省，生产经环境变量覆盖——仿 IMG_SECRET /
 *  BOOKING_CODE_SECRET 纪律；哈希不留明文同 verificationCodes 哈希纪律） */
const MEMBER_CARD_SECRET = process.env.MEMBER_CARD_SECRET ?? 'philia-dev-member-card-secret-do-not-use-in-prod';
/** 会员码时效：5 分钟（超时须客户重新出示） */
export const MEMBER_CARD_TTL_SEC = 300;

/** 会员码签发（纯函数，供 myCardToken 与 e2e 过期件伪造复用）：
 *  token = base64url(`${uid}|${planKey}|${exp}`) + '.' + hmac_sha256_hex(payload) */
export function signMemberCardPayload(uid: string, planKey: string, expSec: number): string {
  const payload = Buffer.from(`${uid}|${planKey}|${expSec}`, 'utf8').toString('base64url');
  const sig = createHmac('sha256', MEMBER_CARD_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** 会员码验签+解析（纯函数）：结构/签名/时效三闸；失败抛 400 明文（篡改/过期分明） */
function parseMemberCardToken(token: string): { uid: string; planKey: string; expSec: number } {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) badRequest('会员码格式不正确，请客户重新出示');
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(sig)) badRequest('会员码格式不正确，请客户重新出示');
  const expected = Buffer.from(createHmac('sha256', MEMBER_CARD_SECRET).update(payload).digest('hex'), 'utf8');
  const actual = Buffer.from(sig, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    badRequest('会员码校验失败（签名不符，可能被篡改），请客户重新出示');
  }
  const raw = Buffer.from(payload, 'base64url').toString('utf8');
  const parts = raw.split('|');
  const expSec = Number(parts[2]);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !Number.isInteger(expSec)) {
    badRequest('会员码格式不正确，请客户重新出示');
  }
  if (expSec < Math.floor(Date.now() / 1000)) {
    badRequest('会员码已过期（5 分钟时效），请客户重新出示');
  }
  return { uid: parts[0]!, planKey: parts[1]!, expSec };
}

/**
 * 落注册用户档共用函数（OP-03 P1-1 修复 · 端口批收尾片 4）：openFree 落档内核——
 * 自助开户（auth/devLogin）/微信静默开户（auth/wechatMini）/openFree 三处同调，两段并一段
 * （老板 10-07「注册即注册用户会员」口径；勿新写落档口=调用点一律走本函数）。
 * 幂等：已有 active/frozen 会员=返回现状不重建；默认档读全局键 default_plan_key
 * （端口可改，键值指向不存在档行回退 plan_weiguang 防断链）；回馈金账户一人一本预建。
 * 返回 { membership, created }（created=false=幂等命中）。
 */
export async function openFreeMembershipCore(
  d: DbHandle,
  userId: string,
  now: Date,
): Promise<{ membership: unknown; created: boolean }> {
  const existing = await currentMembership(d, userId, now);
  if (existing) return { membership: existing, created: false };
  const plans = await loadMemberPlans(d);
  const days = planNum(plans.get('membership_validity_days'), 'days', 365);
  const configuredDefault = planStr(plans.get('default_plan_key'), 'value', 'plan_weiguang');
  const defaultPlanKey = plans.has(configuredDefault) ? configuredDefault : 'plan_weiguang';
  const openingPlan = plans.get(defaultPlanKey);
  const row = await d
    .insert(schema.memberships)
    .values({
      userId,
      planKey: defaultPlanKey,
      soldStoreId: null, // 注册用户自助开档无办卡店（决策 #41 双归属：NULL 或注册店，骨架批=NULL）
      startedAt: now,
      expiresAt: isFreePlanRow(openingPlan) ? FREE_PLAN_EXPIRES_AT : new Date(now.getTime() + days * 24 * 3600 * 1000),
      status: 'active',
      petCount: 0,
      paidFen: 0,
    })
    .returning()
    .then((r) => r[0]!);
  await ensureRebateAccount(d, userId, now); // 回馈金账户一人一本预建（余额 0）
  return { membership: row, created: true };
}

export const membershipRouter = router({
  /**
   * plans（public）：member_plans active 行透出——客户端开通页/收银台售卡区共用。
   * 四档价格/回馈 bp/折扣 bp/多宠规则+权益表述（label）明面；全局参数
   * （回馈金到账日/回馈金有效期/会员有效期）同包返回（红线 5 规则明面数据源）。
   */
  plans: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.memberPlans)
      .where(eq(schema.memberPlans.active, true));
    const byKey = new Map(rows.map((r) => [r.ruleKey, r]));
    const plans = [...byKey.values()]
      .filter((r) => r.ruleKey.startsWith('plan_'))
      .map(planPublicShape)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .sort((a, b) => a.priceFen - b.priceFen);
    return {
      plans,
      rebateSettlementDay: planNum(byKey.get('rebate_settlement_day'), 'day', 5),
      rebateValidityDays: planNum(byKey.get('rebate_validity_days'), 'days', 365),
      membershipValidityDays: planNum(byKey.get('membership_validity_days'), 'days', 365),
    };
  }),

  /**
   * my（customer）：本人会员页数据源——membership+档位+回馈金账本（balanceOf：
   * 余额/本期预计/状态）+本期明细（当期 period 流水）+非会员 null+引导。
   * 读路径顺带到期懒冻结（红线 4：expire 过日→frozen+余额不可用）。
   */
  my: customerProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const plans = await loadMemberPlans(ctx.db);
    const changeWindowDays = changeWindowDaysOf(plans);
    const m = await currentMembership(ctx.db, ctx.user.id, now);
    if (!m) {
      return {
        membership: null,
        plan: null,
        rebate: null,
        period: rebatePeriodOf(now),
        periodLogs: [],
        guide: '开通会员享商品回馈金与服务折扣；注册用户免费在册（手机号即在册），升档线上即时生效',
        /* 补缺-3 入口判定字段（非会员态同构透出） */
        nextPlanKey: null,
        nextPlanSetAt: null,
        upgradeAvailable: false,
        changeWindowDays,
      };
    }
    const rebate = await balanceOf(ctx.db, ctx.user.id, now);
    const period = rebatePeriodOf(now);
    const periodLogs = await ctx.db
      .select()
      .from(schema.rebateLogs)
      .where(and(eq(schema.rebateLogs.userId, ctx.user.id), eq(schema.rebateLogs.period, period)))
      .orderBy(desc(schema.rebateLogs.createdAt))
      .limit(50);
    /* 补缺-3：存在更高档且 active → 客户端「升档」入口亮显 */
    const curPrice = planNum(plans.get(m.planKey), 'price_fen', 0);
    const upgradeAvailable =
      m.status === 'active' &&
      [...plans.values()].some((p) => p.ruleKey.startsWith('plan_') && planNum(p, 'price_fen', 0) > curPrice);
    return {
      membership: m,
      plan: planPublicShape(plans.get(m.planKey)),
      rebate,
      period,
      periodLogs,
      guide: null,
      nextPlanKey: m.nextPlanKey ?? null,
      nextPlanSetAt: m.nextPlanSetAt ?? null,
      upgradeAvailable,
      changeWindowDays,
    };
  }),

  /**
   * ledger（customer · R11b W-01 回馈金账本独立页数据源）：余额（balanceOf）+ 期次
   * （rebatePeriodOf）+ 到账日（rebate_settlement_day 读表）+ 全量五类流水（最新 100 条）。
   * 溯源联表（38 号档 CJ-0923-16④「要」）：source_id=收银单号（HD- 前缀）时联
   * cashier_bills/cashier_bill_items 取商品快照名+门店名透出；联不到（商城订单/退款单/
   * 结算批次等）title=null，前端降级=类型文案+单号。
   * yearGrantFen=当年发放合计（每期只计一类行：未结算=计提行／已结算=入账行
   * source_id=批次 id——QA40-D10 双倍计数修复，PD-02 件 3）。
   * 读路径顺带到期懒冻结（红线 4，同 my）。
   */
  ledger: customerProcedure.query(async ({ ctx }) => {
    const now = new Date();
    await currentMembership(ctx.db, ctx.user.id, now);
    const rebate = await balanceOf(ctx.db, ctx.user.id, now);
    const plans = await loadMemberPlans(ctx.db);
    const settlementDay = planNum(plans.get('rebate_settlement_day'), 'day', 5);
    const period = rebatePeriodOf(now);

    const rows = await ctx.db
      .select()
      .from(schema.rebateLogs)
      .where(eq(schema.rebateLogs.userId, ctx.user.id))
      .orderBy(desc(schema.rebateLogs.createdAt))
      .limit(100);

    /* 溯源联表：收银单号 → 商品快照名（kind='product' 行）+ 门店名 */
    const billNos = [...new Set(rows.map((r) => r.sourceId).filter((s) => /^HD-/.test(s)))];
    const billMap = new Map<string, { storeName: string | null; productNames: string[] }>();
    if (billNos.length > 0) {
      const bills = await ctx.db
        .select({
          id: schema.cashierBills.id,
          billNo: schema.cashierBills.billNo,
          storeName: schema.stores.name,
        })
        .from(schema.cashierBills)
        .leftJoin(schema.stores, eq(schema.stores.id, schema.cashierBills.storeId))
        .where(inArray(schema.cashierBills.billNo, billNos));
      const billIdToNo = new Map(bills.map((b) => [b.id, b.billNo]));
      for (const b of bills) billMap.set(b.billNo, { storeName: b.storeName ?? null, productNames: [] });
      if (bills.length > 0) {
        const items = await ctx.db
          .select({
            billId: schema.cashierBillItems.billId,
            name: schema.cashierBillItems.nameSnapshot,
          })
          .from(schema.cashierBillItems)
          .where(
            and(
              inArray(schema.cashierBillItems.billId, bills.map((b) => b.id)),
              eq(schema.cashierBillItems.kind, 'product'),
            ),
          );
        for (const it of items) {
          const no = billIdToNo.get(it.billId);
          const slot = no ? billMap.get(no) : undefined;
          if (slot && !slot.productNames.includes(it.name)) slot.productNames.push(it.name);
        }
      }
    }

    /* 本年累计发放（QA40-D10 双倍计数修复 · PD-02 件 3 死线 10-05）：
     * 每期只计一类行——期次未结算=计提行（settlement_id 为空）；期次已结算=
     * 入账行（source_id=settlement_id=批次 id；计提行月结时已回标批次不再计入）。
     * 两类交接不重不漏：月结 settleMonthly 跑完后本值不翻倍（e2e 实证在案）。
     * 补缺-3：口径抽取为 yearGrantFenOf，mySavings.rebateSettledFen 同源复用。 */
    const yearGrantFen = await yearGrantFenOf(ctx.db, ctx.user.id, now);

    return {
      rebate,
      period,
      settlementDay,
      yearGrantFen,
      logs: rows.map((r) => {
        const hit = billMap.get(r.sourceId);
        return {
          id: r.id,
          type: r.type,
          deltaFen: r.deltaFen,
          beforeFen: r.beforeFen,
          afterFen: r.afterFen,
          sourceId: r.sourceId,
          period: r.period,
          settlementId: r.settlementId,
          note: r.note,
          createdAt: r.createdAt,
          title: hit && hit.productNames.length > 0 ? hit.productNames.join('、') : null,
          storeName: hit?.storeName ?? null,
        };
      }),
    };
  }),

  /**
   * forUser（merchant 本店，clerk 放行）：收银台「识别会员后带出档位/回馈金余额/宠物数」
   * 正式通道（任务书 §四.1）——此前收银台靠成交回写缓存降级，本端点消降级。
   * 返回该用户当前 membership（档位/status/expiresAt/petCount/paidFen/soldStore）+
   * 档位配置 + rebate balanceOf（余额/本期预计/status）；非会员 membership=null。
   * 读路径顺带到期懒冻结（红线 4，同 my）。
   *
   * 微光正名批片 1（CJ-1009-06 定盘星：客户=总公司流量池，不属任何店）：
   * 店域客户闸撤除——客户全池可识别可服务（识别/检索/会员服务通断=放行读面）；
   * **订单/账目级门店隔离面零改动**（单据/账目读口仍按店域闸原样，本端点只读会员档+回馈金余额）。
   * 防探测口径保留=用户不存在（users 无行）→ NOT_FOUND「会员不存在」；
   * 存在即读（在册客户=全池件，店员检索即见档=定盘星原生需求）。
   */
  forUser: merchantProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const uid = input.userId;
      /* 流量池化：存在性校验（users 有行=可读；无行=NOT_FOUND 防探测口径不动） */
      const userRow = await ctx.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, uid))
        .get();
      if (!userRow) throw new TRPCError({ code: 'NOT_FOUND', message: '会员不存在' });
      const now = new Date();
      const m = await currentMembership(ctx.db, input.userId, now);
      const plans = await loadMemberPlans(ctx.db);
      const rebate = await balanceOf(ctx.db, input.userId, now);
      return {
        membership: m,
        plan: m ? planPublicShape(plans.get(m.planKey)) : null,
        rebate,
      };
    }),

  /**
   * openFree（customer）：注册用户一键注册——免费档 0 元开档（paid_fen=0，
   * expires=免费档置远端 2099（补缺修复小批 P1-3 数据层永久有效）/付费档 +membership_validity_days
   * 读表默认 365 天，status=active）。
   * 手机号即会员=用户本身（users 行即会员身份，无需另建档案）。
   * 幂等：已有 active/frozen 会员直接返回现状；退会（cancelled）后可重新开通。
   * OP-03 P1-1：落档内核=openFreeMembershipCore（自助/微信开户同调，两段并一段）。
   */
  openFree: customerProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    return ctx.db.transaction(async (tx) => {
      const r = await openFreeMembershipCore(txDb(tx), ctx.user.id, now);
      return { membership: r.membership, idempotent: !r.created };
    });
  }),

  /**
   * sell（merchant 本店）：收银台售卡（开通确认=成交即开通）。
   * - 用户：userId 直传 或 手机号旁路建档（手机号无账号→仅建 users+user_roles
   *   customer 档案，不开任何档位；购卡成交才开档——任务书 §四.6 新客快速开卡口径）；
   * - 金额=档价+多宠附加费（petCount>included_pets 起每只 +extra_pet_fen，max_pets
   *   封顶硬校验）；注册用户档 price=0 → 0 元单直接成交（paySegments 须为空）；
   * - 事务：cashier 单落 kind='membership' 行+支付段（settled，不计服务折扣）+
   *   memberships 落库（sold_store=本店，免费档 expires=远端 2099（P1-3）/付费档 +365 天读表，
   *   status=active）+回馈金账户预建；
   *   售卡提成由 commission 读侧自然计提（kind='membership' 行已落，不在本文件）；
   * - 已是会员（active/frozen）拒售卡，指引走 renew；退会后可重新购卡。
   */
  sell: merchantProcedure
    .input(
      z
        .object({
          userId: z.string().min(1).optional(),
          phone: z.string().trim().regex(/^1\d{10}$/, '手机号格式不正确').optional(),
          planKey: z.string().min(1),
          petCount: z.number().int().min(0).max(99),
          paySegments: z.array(paySegmentSchema).max(3).default([]),
        })
        .refine((v) => !!v.userId || !!v.phone, { message: '须传 userId 或手机号（旁路建档）' }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          const now = new Date();
          const plans = await loadMemberPlans(t);
          const plan = plans.get(input.planKey);
          if (!plan || !plan.ruleKey.startsWith('plan_')) badRequest('档位不存在或已停用');
          const { amountFen, extraCount } = membershipChargeFen(plan, input.petCount);
          const sumPay = input.paySegments.reduce((s, p) => s + p.amountFen, 0);
          if (amountFen === 0) {
            if (input.paySegments.length > 0) badRequest('免费档开档无须支付段');
          } else if (sumPay !== amountFen) {
            badRequest(
              `支付合计（${(sumPay / 100).toFixed(2)} 元）须等于售卡金额（${(amountFen / 100).toFixed(2)} 元${extraCount > 0 ? `，含多宠附加 ${extraCount} 只` : ''}）`,
            );
          }

          /* 用户解析：手机号旁路建档（仅建档不开档，购卡才开——本端点即购卡成交） */
          let userId = input.userId ?? null;
          if (!userId && input.phone) {
            const found = await t
              .select({ id: schema.users.id })
              .from(schema.users)
              .where(eq(schema.users.phone, input.phone))
              .get();
            if (found) {
              userId = found.id;
            } else {
              const created = await t
                .insert(schema.users)
                .values({
                  kimiId: `phone:${input.phone}`, // 旁路建档占位（Kimi/微信账号未绑定；手机号即建档键）
                  phone: input.phone,
                  nickname: `新客 ${input.phone.slice(-4)}`,
                })
                .returning({ id: schema.users.id })
                .then((r) => r[0]!);
              await t.insert(schema.userRoles).values({ userId: created.id, role: 'customer' });
              userId = created.id;
            }
          }
          if (!userId) badRequest('须传 userId 或手机号（旁路建档）');
          const userRow = await t
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .get();
          if (!userRow) badRequest('客户不存在');

          const existing = await currentMembership(t, userId, now);
          if (existing) badRequest('该客户已是会员（续费/升档请走对应页签办理，不要重复购卡；退会后可重新购卡）');

          const { billNo, billId } = await writeMembershipBill(t, {
            storeId,
            operatorId: ctx.user.id,
            userId,
            planKey: input.planKey,
            planLabel: plan.label,
            petCount: input.petCount,
            amountFen,
            paySegments: input.paySegments,
            now,
            kindNote: '售卡',
            outboxIds,
          });

          const days = planNum(plans.get('membership_validity_days'), 'days', 365);
          const membership = await t
            .insert(schema.memberships)
            .values({
              userId,
              planKey: input.planKey,
              soldStoreId: storeId, // 决策 #41 双归属：售卡单 sold_store=本店
              startedAt: now,
              /* 补缺修复小批 P1-3：免费档（收银台 0 元售注册用户同口径）expiresAt 置远端 2099 */
              expiresAt: isFreePlanRow(plan)
                ? FREE_PLAN_EXPIRES_AT
                : new Date(now.getTime() + days * 24 * 3600 * 1000),
              status: 'active',
              petCount: input.petCount,
              paidFen: amountFen, // 实付（多宠附加费含）
            })
            .returning()
            .then((r) => r[0]!);
          await ensureRebateAccount(t, userId, now);
          /* 补缺-3 防滥用两件（46 号档+PD-07，只留痕不拦截）：退会后 member_cancel_cooldown_days
           * 天内重购 / 累计退会≥member_cancel_count_threshold 再购 → membership_events
           * type='cancel_rebuy_note'（距上次退会天数/累计次数入 meta，审计可查） */
          const cancelledRows = await t
            .select({ cancelledAt: schema.memberships.cancelledAt })
            .from(schema.memberships)
            .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.status, 'cancelled')));
          if (cancelledRows.length > 0) {
            const cooldownDays = planNum(plans.get('member_cancel_cooldown_days'), 'days', 90);
            const countThreshold = planNum(plans.get('member_cancel_count_threshold'), 'threshold', 2);
            const latestCancelledAt = cancelledRows.reduce<Date | null>(
              (acc, r) => (r.cancelledAt && (!acc || r.cancelledAt > acc) ? r.cancelledAt : acc),
              null,
            );
            const daysSinceLastCancel = latestCancelledAt
              ? Math.floor((now.getTime() - latestCancelledAt.getTime()) / (24 * 3600 * 1000))
              : null;
            if (daysSinceLastCancel !== null && daysSinceLastCancel <= cooldownDays) {
              await t.insert(schema.membershipEvents).values({
                userId,
                type: 'cancel_rebuy_note',
                toPlan: input.planKey,
                billNo,
                meta: { trigger: 'cooldown', daysSinceLastCancel, cooldownDays },
              });
            }
            if (cancelledRows.length >= countThreshold) {
              await t.insert(schema.membershipEvents).values({
                userId,
                type: 'cancel_rebuy_note',
                toPlan: input.planKey,
                billNo,
                meta: { trigger: 'count', cancelCount: cancelledRows.length, threshold: countThreshold },
              });
            }
          }
          return { billNo, billId, membership, amountFen };
        });
        outboxIds.forEach(broadcastNow);
        return result;
      });
    }),

  /**
   * renew（merchant 本店）：收银台续费（内测期到店付同售卡链路）。
   * 解冻 frozen→active + expires 顺延（max(now, expires_at)+365 天读表）+
   * 回馈金账户解冻（freeze 留痕行 note 解冻）；active 续费=提前顺延。
   * 金额按当前档位价+既有 petCount 多宠附加费重算（档位变更请退会后重售）。
   * 报备口径：续费后 paid_fen 落当期实付（分摊/退会折算按当期卡价口径）。
   */
  renew: merchantProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        paySegments: z.array(paySegmentSchema).max(3).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          const now = new Date();
          const m = await currentMembership(t, input.userId, now);
          if (!m) badRequest('该客户无会员档案（新开通请走售卡）');
          const plans = await loadMemberPlans(t);
          const plan = plans.get(m.planKey);
          if (!plan) badRequest('档位配置缺失，请检查会员档配置');
          /* 补缺-3 到期换档执行（46 号档+PD-07 内测落法）：事务起读 next_plan_key 非空 →
           * 到期后转「待续费目标档」——按预约档全价计应收（换档方向不限，到期换档不收差价
           * 口径=按新档全价续）+plan_key 切换+next_plan_key 置空+change_schedule(executed) 留痕；
           * 未预约续费既有口径一字不动（零破既有断言）。 */
          const scheduledPlan = m.nextPlanKey ? plans.get(m.nextPlanKey) : undefined;
          if (m.nextPlanKey && !scheduledPlan) {
            badRequest('预约换档目标档位配置缺失，请取消预约后再续费');
          }
          const chargePlan = scheduledPlan ?? plan;
          const { amountFen } = membershipChargeFen(chargePlan, m.petCount);
          const sumPay = input.paySegments.reduce((s, p) => s + p.amountFen, 0);
          if (amountFen === 0) {
            if (input.paySegments.length > 0) badRequest('免费档续期无须支付段');
          } else if (sumPay !== amountFen) {
            badRequest(`支付合计（${(sumPay / 100).toFixed(2)} 元）须等于续费金额（${(amountFen / 100).toFixed(2)} 元）`);
          }

          const { billNo, billId } = await writeMembershipBill(t, {
            storeId,
            operatorId: ctx.user.id,
            userId: input.userId,
            planKey: chargePlan.ruleKey, // 补缺-3：预约换档执行时=预约档（否则=现档，同既有）
            planLabel: chargePlan.label,
            petCount: m.petCount,
            amountFen,
            paySegments: input.paySegments,
            now,
            kindNote: '续费',
            outboxIds,
          });

          const days = planNum(plans.get('membership_validity_days'), 'days', 365);
          const base = m.expiresAt.getTime() > now.getTime() ? m.expiresAt : now; // 到期冻结后续费自今日顺延
          const membership = await t
            .update(schema.memberships)
            .set({
              status: 'active', // 解冻 frozen→active（红线 4：续费解冻）
              /* 补缺修复小批 P1-3：续费目标档为免费档（含预约换档落免费档）→ expiresAt 置远端 2099 */
              expiresAt: isFreePlanRow(chargePlan)
                ? FREE_PLAN_EXPIRES_AT
                : new Date(base.getTime() + days * 24 * 3600 * 1000),
              paidFen: amountFen, // 报备：当期实付口径（分摊/退会折算按当期卡价）
              /* 补缺-3：预约换档执行=切档+预约置空（幂等：置空后重复续费按新档常价顺延） */
              ...(scheduledPlan ? { planKey: chargePlan.ruleKey, nextPlanKey: null, nextPlanSetAt: null } : {}),
              updatedAt: now,
            })
            .where(eq(schema.memberships.id, m.id))
            .returning()
            .then((r) => r[0]!);
          if (scheduledPlan) {
            await t.insert(schema.membershipEvents).values({
              userId: input.userId,
              type: 'change_schedule',
              fromPlan: m.planKey,
              toPlan: chargePlan.ruleKey,
              billNo,
              meta: { executed: true, petCount: m.petCount, amountFen },
            });
          }
          await unfreezeRebateAccount(t, { userId: input.userId, sourceId: billNo, now });
          return { billNo, billId, membership, amountFen };
        });
        outboxIds.forEach(broadcastNow);
        return result;
      });
    }),

  /**
   * upgradeQuote（customer 本人）：升档试算——当前档+可升目标档列表+窗口天数透出。
   * 公式明面（46 号档+PD-07 冻结）：remainingMonths/baseDiffFen/petDiffFen/totalDiffFen +
   * formula{m, newMonthlyFen, oldMonthlyFen, perMonthDiffFen, newPurchase}；期内降级档不出现
   * （targetPlans 过滤）；注册用户档=新购口径（remainingMonths=0，totalDiffFen=档全价+附加重算）。
   * 与 upgradeQuoteForUser（收银台代客试算）共用内部函数 quoteUpgrade，双端同帧。
   */
  upgradeQuote: customerProcedure.query(async ({ ctx }) => {
    return quoteUpgrade(ctx.db, ctx.user.id, new Date());
  }),

  /** upgradeQuoteForUser（merchant 本店）：收银台代客升档试算（同 quoteUpgrade 内部函数） */
  upgradeQuoteForUser: merchantProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return quoteUpgrade(ctx.db, input.userId, new Date());
    }),

  /**
   * upgrade（merchant 本店到店付，同 sell 族 withCashierWriteLock）：期内升档。
   * - server 兜底重算差价（computeUpgradeDiff，不以前端传入金额为准）→ Σ支付段=差价硬校验；
   * - 原子事务：writeMembershipBill（补差单 note「升级补差 萤火→暖阳」、refId=新档键、
   *   discountType='none'）+ memberships 更新 + membership_events('upgrade') + emit SSE；
   * - 付费档升档：即时生效新档（plan_key 换、paid_fen=原实付+补差；expires_at 不动、
   *   pet_count 不变）；在途回馈金不重算、旧档回馈金余额零动作（本端点不触碰 rebate 域）；
   * - 注册用户档（default_plan_key 读档判断）=新购口径：差价=新档全价（多宠附加按现 petCount
   *   重算），started_at=now、expires_at=now+有效期天数、sold_store_id 补=办理店；
   * - 幂等：已是目标档（同档重放）→ 返回现状 idempotent=true 零写入；
   * - 期内只升不降：新档总价 ≤ 旧档总价 → BAD_REQUEST「会员期内不降级，可在到期前 30 天
   *   预约下期档位」（低档换档走到期预约通道 scheduleChange）。
   */
  upgrade: merchantProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        targetPlanKey: z.string().min(1),
        paySegments: z.array(paySegmentSchema).max(3).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return withCashierWriteLock(async () => {
        const outboxIds: string[] = [];
        const result = await ctx.db.transaction(async (tx) => {
          const t = txDb(tx);
          const now = new Date();
          const m = await currentMembership(t, input.userId, now);
          if (!m) badRequest('该客户无会员档案（新开通请走售卡）');
          const plans = await loadMemberPlans(t);
          const target = plans.get(input.targetPlanKey);
          if (!target || !target.ruleKey.startsWith('plan_')) badRequest('目标档位不存在或已停用');
          /* 幂等：已是目标档（同档重放）→ 返回现状，零写入零单据 */
          if (m.planKey === target.ruleKey) {
            return { membership: m, idempotent: true as const, diffFen: 0, billNo: null, billId: null };
          }
          if (m.status !== 'active') badRequest('会员已到期冻结，请续费解冻后再办理升档');
          const cur = plans.get(m.planKey);
          const isFreeCurrent = m.planKey === defaultPlanKeyOf(plans);
          if (!isFreeCurrent) {
            if (!cur) badRequest('当前档位配置缺失，请检查会员档配置');
            /* 期内只升不降（冻结明文逐字；同价横跳同按不升处理，报备） */
            if (planNum(target, 'price_fen', 0) <= planNum(cur, 'price_fen', 0)) {
              badRequest('会员期内不降级，可在到期前 30 天预约下期档位');
            }
          }
          /* 钱域 server 兜底重算（不以前端传入为准） */
          const quote = computeUpgradeDiff(plans, m, target, now);
          const diffFen = quote.totalDiffFen;
          const sumPay = input.paySegments.reduce((s, p) => s + p.amountFen, 0);
          if (diffFen === 0) {
            if (input.paySegments.length > 0) badRequest('零差价升档无须支付段');
          } else if (sumPay !== diffFen) {
            badRequest(`支付合计（${(sumPay / 100).toFixed(2)} 元）须等于升档补差（${(diffFen / 100).toFixed(2)} 元）`);
          }

          const { billNo, billId } = await writeMembershipBill(t, {
            storeId,
            operatorId: ctx.user.id,
            userId: input.userId,
            planKey: target.ruleKey, // 升级单 refId=新档键（会员费类目）
            planLabel: target.label,
            petCount: m.petCount,
            amountFen: diffFen,
            paySegments: input.paySegments,
            now,
            kindNote: '升级补差',
            noteOverride: `升级补差 ${cur ? shortPlanName(cur) : m.planKey}→${shortPlanName(target)}`,
            outboxIds,
          });

          const days = planNum(plans.get('membership_validity_days'), 'days', 365);
          const membership = await t
            .update(schema.memberships)
            .set(
              quote.formula.newPurchase
                ? {
                    /* 注册用户档=新购口径：开通时点重起算有效期，paid_fen=新档全价（含附加），sold_store 补=办理店 */
                    planKey: target.ruleKey,
                    startedAt: now,
                    expiresAt: new Date(now.getTime() + days * 24 * 3600 * 1000),
                    soldStoreId: storeId,
                    paidFen: diffFen,
                    updatedAt: now,
                  }
                : {
                    /* 期内升档即时生效：到期日不变、pet_count 不变、paid_fen=原实付+补差 */
                    planKey: target.ruleKey,
                    paidFen: m.paidFen + diffFen,
                    updatedAt: now,
                  },
            )
            .where(eq(schema.memberships.id, m.id))
            .returning()
            .then((r) => r[0]!);
          await t.insert(schema.membershipEvents).values({
            userId: input.userId,
            type: 'upgrade',
            fromPlan: m.planKey,
            toPlan: target.ruleKey,
            diffFen,
            billNo,
            meta: {
              remainingMonths: quote.remainingMonths,
              baseDiffFen: quote.baseDiffFen,
              petDiffFen: quote.petDiffFen,
              petCount: m.petCount,
              newPurchase: quote.formula.newPurchase,
            },
          });
          outboxIds.push(
            await emitEvent(t, `user:${input.userId}`, EventType.MembershipUpgraded, {
              userId: input.userId,
              fromPlan: m.planKey,
              toPlan: target.ruleKey,
              diffFen,
              billNo,
              by: ctx.user.id,
            }),
          );
          return { billNo, billId, membership, diffFen, idempotent: false as const };
        });
        outboxIds.forEach(broadcastNow);
        return result;
      });
    }),

  /**
   * scheduleChange（customer 本人）：到期换档预约——到期前 member_change_window_days 天
   * （端口读值，默认 30）窗口内可预约下期档位（任意档；低档=到期换档通道，期内不降级不变）。
   * 窗口外明文拒「到期前 30 天开放预约下期档位」；重复预约=覆盖更新幂等（同档重放零写入）；
   * 预约落 memberships.next_plan_key+next_plan_set_at + membership_events('change_schedule') 留痕。
   */
  scheduleChange: customerProcedure
    .input(z.object({ targetPlanKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const now = new Date();
        const m = await currentMembership(t, ctx.user.id, now);
        if (!m) badRequest('非会员无到期换档预约（开通/升档请走售卡或升档通道）');
        const plans = await loadMemberPlans(t);
        if (m.planKey === defaultPlanKeyOf(plans)) {
          badRequest('免费档会员无到期换档预约（升档即时生效，请走升档通道）');
        }
        const target = plans.get(input.targetPlanKey);
        if (!target || !target.ruleKey.startsWith('plan_')) badRequest('目标档位不存在或已停用');
        if (target.ruleKey === m.planKey) badRequest('预约档位与当前档位相同（到期按现档续费即可，无需预约）');
        const windowDays = changeWindowDaysOf(plans);
        if (m.expiresAt.getTime() - now.getTime() > windowDays * 24 * 3600 * 1000) {
          badRequest(`到期前 ${windowDays} 天开放预约下期档位`);
        }
        /* 重复预约=覆盖更新幂等：同档重放返回现状零写入 */
        if (m.nextPlanKey === target.ruleKey) return { membership: m, idempotent: true as const };
        const updated = await t
          .update(schema.memberships)
          .set({ nextPlanKey: target.ruleKey, nextPlanSetAt: now, updatedAt: now })
          .where(eq(schema.memberships.id, m.id))
          .returning()
          .then((r) => r[0]!);
        await t.insert(schema.membershipEvents).values({
          userId: ctx.user.id,
          type: 'change_schedule',
          fromPlan: m.planKey,
          toPlan: target.ruleKey,
          meta: { windowDays, overwrite: m.nextPlanKey ?? null },
        });
        return { membership: updated, idempotent: false as const };
      });
    }),

  /** cancelScheduleChange（customer 本人）：取消到期换档预约（next_plan_key 置空+留痕；无预约幂等） */
  cancelScheduleChange: customerProcedure.mutation(async ({ ctx }) => {
    return ctx.db.transaction(async (tx) => {
      const t = txDb(tx);
      const now = new Date();
      const m = await currentMembership(t, ctx.user.id, now);
      if (!m || !m.nextPlanKey) return { membership: m, idempotent: true as const };
      const updated = await t
        .update(schema.memberships)
        .set({ nextPlanKey: null, nextPlanSetAt: null, updatedAt: now })
        .where(eq(schema.memberships.id, m.id))
        .returning()
        .then((r) => r[0]!);
      await t.insert(schema.membershipEvents).values({
        userId: ctx.user.id,
        type: 'change_schedule',
        fromPlan: m.planKey,
        toPlan: null,
        meta: { cancelled: true, cancelledPlanKey: m.nextPlanKey },
      });
      return { membership: updated, idempotent: false as const };
    });
  }),

  /**
   * mySavings（customer 本人）：今年已省双源分明透出——
   * - rebateSettledFen：当年回馈金发放合计（QA40-D10 yearGrantFen 同源函数复用：
   *   每期只计一类行，已结算期=入账行、未结算期=计提行，月结后不翻倍）；
   * - serviceDiscountFen：当年服务/预约行 (unit_price_fen−adjusted_price_fen)×qty 合计
   *   （join 本人 cashier_bills 且 status='settled' 未冲正 reversed_at is null，当年窗口）；
   * - totalFen=两源和，精确到分；year=当年（本地年界，与 yearGrantFen 口径同帧）。
   */
  mySavings: customerProcedure.query(async ({ ctx }) => {
    const now = new Date();
    await currentMembership(ctx.db, ctx.user.id, now); // 读路径顺带到期懒冻结（同 my/ledger 族）
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const rebateSettledFen = await yearGrantFenOf(ctx.db, ctx.user.id, now);
    const svcRow = await ctx.db
      .select({
        s: sql<number>`coalesce(sum((${schema.cashierBillItems.unitPriceFen} - ${schema.cashierBillItems.adjustedPriceFen}) * ${schema.cashierBillItems.qty}), 0)`,
      })
      .from(schema.cashierBillItems)
      .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.cashierBillItems.billId))
      .where(
        and(
          eq(schema.cashierBills.customerId, ctx.user.id),
          eq(schema.cashierBills.status, 'settled'),
          isNull(schema.cashierBills.reversedAt), // 被冲正单不计（同收入聚合口径）
          inArray(schema.cashierBillItems.kind, ['service', 'appointment']),
          isNotNull(schema.cashierBillItems.adjustedPriceFen), // 无改价行无折扣，不计已省
          gte(schema.cashierBills.settledAt, yearStart),
        ),
      )
      .get();
    const serviceDiscountFen = Number(svcRow?.s ?? 0);
    return {
      year: now.getFullYear(),
      rebateSettledFen,
      serviceDiscountFen,
      totalFen: rebateSettledFen + serviceDiscountFen,
    };
  }),

  /**
   * myCardToken（customer 本人 · 片 3）：会员码签发——
   * token=base64url(`{uid}|{planKey}|{exp}`)+'.'+hmac_sha256_hex(payload)（仓内常量
   * 缺省密钥，内测口径明面注记，仿 verificationCodes 哈希纪律/预约码签名同族工艺），
   * 时效 5 分钟；本人 active 会员才签发（非会员/冻结明文拒）。
   */
  myCardToken: customerProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const m = await currentMembership(ctx.db, ctx.user.id, now);
    if (!m) badRequest('非会员无会员码，请先开通会员');
    if (m.status !== 'active') badRequest('会员已冻结或已退会，会员码不可用（续费解冻后可出示）');
    const expSec = Math.floor(now.getTime() / 1000) + MEMBER_CARD_TTL_SEC;
    return {
      token: signMemberCardPayload(ctx.user.id, m.planKey, expSec),
      planKey: m.planKey,
      expiresAt: new Date(expSec * 1000),
      ttlSec: MEMBER_CARD_TTL_SEC,
    };
  }),

  /**
   * verifyCardToken（merchantManager 收银台核验口 · 片 3）：验签+时效+档透出。
   * 篡改（签名不符）/过期/畸形一律 400 明文；通过后透出 uid+planKey+档位名+
   * 当前会员状态（核销/权益使用以本口透出档位为准，签后状态变更以库为准）。
   */
  verifyCardToken: merchantManagerProcedure
    .input(z.object({ token: z.string().min(1).max(512) }))
    .mutation(async ({ ctx, input }) => {
      const claims = parseMemberCardToken(input.token);
      const now = new Date();
      const m = await currentMembership(ctx.db, claims.uid, now);
      const plans = await loadMemberPlans(ctx.db);
      const plan = plans.get(claims.planKey);
      return {
        userId: claims.uid,
        planKey: claims.planKey,
        planLabel: plan?.label ?? claims.planKey,
        membershipStatus: m?.status ?? null, // 签发后状态变更（退会/冻结）以库为准透出
        expiresAt: new Date(claims.expSec * 1000),
      };
    }),

  /**
   * cancel（manager|owner · 任务书 §六 退会审批档）：退会。
   * - 折算=剩余整月×月均价精确到分（cancelRefundFen，CJ-0922-13 口径）→ refund_fen
   *   落留痕；**内测期线下原路退回**（无线上退款通道，refund_fen 透出待线下退）；
   * - 同事务：回馈金清零（clear 行前后值）+ memberships status='cancelled'+
   *   cancelled_at/reason；到期已 frozen 也可退会（余额一样清零）；
   * - 打回②（七步复核）：退会清零含未到账——未结算 grant 先写「退会作废未到账
   *   回馈金 N 分（期次 X）」汇总 clear 留痕行（before=after，pendings 不进余额
   *   故前后值不动）；settleMonthly 同步跳过 cancelled 用户 grant（双保险）；
   * - 打回①（七步复核）：折算不悬空——同事务自动挂退款单（R12 同通道
   *   refund_bills，type='membership_cancel'[中文签「会员退会」（UI/CSV 映射已落地）]，
   *   status='executed' 账已联动/refund_method='offline_original' 现金实退待线下），
   *   bill_id=该会员售卡原单（kind='membership' 最近 settled 未冲正单；查不到→
   *   拒绝退会并明示「无售卡原单，退会须店主人工办理」）——实退待办
   *   refund.pendingActual（>24h）自动可见、refund.list 可查、settleActual 通用；
   * - emitEvent user 频道（客户侧文案口径「退款已安排，按原路退回」）。
   */
  cancel: merchantManagerProcedure
    .input(z.object({ userId: z.string().min(1), reason: z.string().min(1, '退会原因必填').max(200) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const result = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const now = new Date();
        const m = await currentMembership(t, input.userId, now);
        if (!m) badRequest('该客户无有效会员（或已退会）');

        /* ---- 打回①前置：售卡原单挂号（折算不悬空——查不到原单拒绝退会，先于任何写入） ---- */
        const origItem = await t
          .select({ billId: schema.cashierBillItems.billId })
          .from(schema.cashierBillItems)
          .innerJoin(schema.cashierBills, eq(schema.cashierBills.id, schema.cashierBillItems.billId))
          .where(
            and(
              eq(schema.cashierBillItems.kind, 'membership'),
              eq(schema.cashierBills.customerId, input.userId),
              eq(schema.cashierBills.status, 'settled'),
              isNull(schema.cashierBills.reversedAt), // 被冲正单不算原单
            ),
          )
          .orderBy(desc(schema.cashierBills.settledAt))
          .limit(1)
          .then((r) => r[0]);
        if (!origItem) {
          badRequest('无售卡原单，退会须店主人工办理（退会折算不悬空挂号）');
        }

        const refundFen = cancelRefundFen(m.paidFen, now, m.expiresAt);
        const monthsRemaining = remainingWholeMonths(now, m.expiresAt);

        /* ---- 打回②：未结算 grant 作废留痕（汇总 clear 行，前后值不动）→ 余额清零 ---- */
        const { voidedFen, periods } = await voidPendingGrants(t, {
          userId: input.userId,
          sourceId: m.id,
          now,
        });
        const { clearedFen } = await clearRebateAccount(t, {
          userId: input.userId,
          sourceId: m.id,
          now,
          note: `退会清零（${m.planKey}，退会原因：${input.reason}）`,
        });
        const updated = await t
          .update(schema.memberships)
          .set({
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: input.reason,
            refundFen,
            updatedAt: now,
          })
          .where(eq(schema.memberships.id, m.id))
          .returning()
          .then((r) => r[0]!);

        /* ---- 打回①：退款单落库（R12 同通道；store=执行店，bill=售卡原单店——
           决策 #41 会员卡三店通用，退会实退由执行店登记待办） ---- */
        const refundNo = await genRefundNoLocal(t, storeId, now);
        const refund = await t
          .insert(schema.refundBills)
          .values({
            storeId,
            refundNo,
            bizDate: storeLocalDateStrLocal(now), // V7 口径：执行日
            billId: origItem.billId,
            type: 'membership_cancel', // 中文签「会员退会」（UI/CSV 映射已落地）
            amountFen: refundFen,
            reason: input.reason,
            status: 'executed', // 账已联动（回馈金清零同事务）；现金实退待线下
            refundMethod: 'offline_original', // 内测期线下原路退回
            linkageJson: {
              membershipCancel: {
                planKey: m.planKey,
                paidFen: m.paidFen,
                refundFen,
                clearedRebateFen: clearedFen,
                monthsRemaining,
                voidedPendingFen: voidedFen, // 打回②：作废未到账合计（期次 periods）
                voidedPendingPeriods: periods,
              },
              rebateClawbackFen: 0, // 退会非商品退款，无扣回（列位口径同 R12）
              executedAt: now.toISOString(),
              operatorId: ctx.user.id,
              approverId: ctx.user.id,
              refundMethod: 'offline_original',
              reason: input.reason,
            },
            operatorId: ctx.user.id,
            approverId: ctx.user.id, // 退会审批档=执行人本人（merchantManager 闸门已在路由层）
          })
          .returning()
          .then((r) => r[0]!);

        const outboxId = await emitEvent(t, `user:${input.userId}`, EventType.MembershipCancelled, {
          userId: input.userId,
          planKey: m.planKey,
          refundFen,
          refundNo, // 打回①：退款单号透出（实退待办/查询对齐）
          clearedRebateFen: clearedFen,
          reason: input.reason,
          message: '退款已安排，按原路退回', // 客户侧口径（内测期线下原路退回）
          by: ctx.user.id,
        });
        return {
          membership: updated,
          refundFen,
          refundNo,
          refundId: refund.id,
          clearedRebateFen: clearedFen,
          voidedPendingFen: voidedFen,
          outboxId,
        };
      });
      broadcastNow(result.outboxId);
      const { outboxId: _drop, ...rest } = result;
      return rest;
    }),

  /**
   * savingsPreview（merchant 本店）：非会员当单「开通萤火立省 ¥X」立省钩子
   * （APP-47，结算页一屏一次不打扰）=服务/预约行×(1−萤火折扣 bp)+商品行×萤火回馈 2%，
   * 读 member_plans 萤火行实时算（配置端口改值即生效）。
   */
  savingsPreview: merchantProcedure
    .input(
      z.object({
        lines: z
          .array(
            z.object({
              kind: z.enum(['service', 'product', 'appointment']),
              amountFen: z.number().int().min(0).max(100_000_000),
            }),
          )
          .min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const plans = await loadMemberPlans(ctx.db);
      const yinghuo = plans.get('plan_yinghuo');
      const discBp = planNum(yinghuo, 'service_discount_bp', 8800);
      const rebateBp = planNum(yinghuo, 'rebate_bp', 200);
      let fen = 0;
      for (const l of input.lines) {
        if (l.kind === 'product') fen += Math.round((l.amountFen * rebateBp) / 10000);
        else fen += Math.round((l.amountFen * (10000 - discBp)) / 10000);
      }
      return { fen, text: `开通萤火立省 ¥${(fen / 100).toFixed(2)}` };
    }),

  /**
   * amortizationStats（merchant 本店 · APP-32 年费分摊双口径，日结/看板用）：
   * - cashFen 收现口径：当月售卡/续费实收（settled 且未冲正的 kind='membership'
   *   单 payable 合计，按 settledAt 落月）；
   * - amortizedFen 分摊口径：当月分摊确认=Σ active 会员 paid_fen÷12 精确到分
   *   （逐会员 round 后求和；内测口径=当前 active 快照，month 参数供对账展示同帧）。
   *   Y7 本店口径（急修三件 PD-03 件 2，老板已圈）：Σ 按办卡店过滤
   *   （memberships.sold_store_id=本店）。
   *   PR-4 OP-01② 口径收口（意见书 issuecomment-5853808886 §三.3，产品侧已批）：
   *   注册用户线上开档 sold_store_id=NULL **进全店合计**（本店合计一并计入）——
   *   数值零影响（注册用户 paid_fen=0），口径统一；连锁期归属口径留痕待连锁合批。
   */
  amortizationStats: merchantProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM') }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const { start, end } = monthWindow(input.month);
      const cashRows = await ctx.db
        .select({ s: sql<number>`coalesce(sum(${schema.cashierBills.payableFen}),0)` })
        .from(schema.cashierBills)
        .innerJoin(
          schema.cashierBillItems,
          and(
            eq(schema.cashierBillItems.billId, schema.cashierBills.id),
            eq(schema.cashierBillItems.kind, 'membership'),
          ),
        )
        .where(
          and(
            eq(schema.cashierBills.storeId, storeId),
            eq(schema.cashierBills.status, 'settled'),
            isNull(schema.cashierBills.reversedAt), // 被冲正单不进收入聚合（同 computeDayTender 口径）
            gte(schema.cashierBills.settledAt, start),
            lt(schema.cashierBills.settledAt, end),
          ),
        )
        .get();
      const activeRows = await ctx.db
        .select({ paidFen: schema.memberships.paidFen })
        .from(schema.memberships)
        .where(
          and(
            eq(schema.memberships.status, 'active'),
            /* Y7 本店口径（PD-03 件 2）+ PR-4 OP-01②：办卡店=本店 ∪ 注册用户线上开档
               sold_store_id=NULL 进全店合计（数值零影响，口径统一；连锁期留痕） */
            or(eq(schema.memberships.soldStoreId, storeId), isNull(schema.memberships.soldStoreId)),
          ),
        );
      return {
        month: input.month,
        cashFen: Number(cashRows?.s ?? 0),
        amortizedFen: activeRows.reduce((s, r) => s + Math.round(r.paidFen / 12), 0),
      };
    }),
});

export type MembershipRouter = typeof membershipRouter;
