/**
 * 提成/绩效 router（批次 员工端2.0 · R9，任务书 V1.1 §四 + 提成规则表 V1.3 +
 * docs/staff2/R7-R10-DESIGN.md §一.4/§一.5/§一.6/§四/§六）
 *
 * 冻结口径：
 * - 提成只读计算（改数只能改规则或源单）：数值全落 commission_rules 配置表，
 *   代码零常量；live 月份按源单时间（账单 settled_at）取 effective_from 生效的规则版本
 *   逐行计提；已快照月份读 commission_snapshots，不动历史快照；
 * - 仅本人硬过滤：staff 端点 employeeId=ctx.user.staffId，输入 .strict()，
 *   越权传参直接 FORBIDDEN（查不到，非遮蔽）；
 * - 接待人域：账单 receptionist_id 默认=开单人，含预约行时优先取预约 receptionist_id
 *   （cashier.ts 落点）；核销改挂/事后纠偏写 reception_logs（前后值留痕，可挂预约或账单）；
 *   receptionist_id IS NULL 的洗美单在前台绩效聚合中硬排除（宁漏计不乱挂）；
 * - 同源双计两池分列：同一笔洗美营收操作美容师计一次、接待前台计一次，
 *   payload 中 groomerPool / frontdeskPool 两池分列不合并；
 * - 扣减 50% 硬闸门：当月累计 ≤ 当月绩效估计 50%（扣绩效不扣提成），超限 FORBIDDEN 硬拒；
 * - 产能红线：日超 8 只超出部分按 1.5 倍须店长批准（overwork_approvals 留痕），
 *   未批准按 1 倍计提并标 pendingApproval；
 * - 售卡定额规则已落库但源单不存在（R11 会员前置批）：cardLines 恒空 + cardNote 明示，不悬空。
 *
 * 报备偏差（schema 实证适配，PR 中显式列）：
 * 1. 洗护/造型判别（裁定③ + 决策 #40）：services 表无类目列（仅 type=grooming|boarding
 *    大类）→ G0 学徒 5% 用名称关键词判别（isWashService：命中 bath 词表且不命中 groom
 *    词表），关键词读 duration_rules 的 duration_service_kind_keywords 当前生效行——
 *    与时长引擎共用一张表一处维护；commission_grooming_assistant_g0_rate.valueJson.scope
 *    控制口径（'bath' 默认仅洗护 / 'all' 全部 grooming，老板端口可调；缺省='bath' 向后
 *    兼容无 scope 行）；时长供给表批次落地正式类目列后换装正式判别；
 * 2. 计提时点=结账时（备案知悉，行为不动）：服务单任务书口径=服务完成即计提，但提成
 *    源单=收银账单（门市价快照/冲正排除均在账单域），月份归属与规则版本统一按账单
 *    settled_at——完成与结算跨月的微差在案；
 * 3. 散客服务单不计个人提成（备案知悉，合「宁漏计」）：kind='service' 行无预约链、无
 *    归属链，不计入任何个人服务提成（但计入全店洗美营收基数，G4/P3/绩效池口径一致）；
 *    个人服务提成仅以 kind='appointment' 行 + appointments.staff_id 归属；
 * 4. 绩效月度估计（扣减 50% 闸门分母）=（当季池基数×5%×系数）/3，季度未评级时系数按 1.0
 *    计（报备口径：宁可放行可解释的上限，不用 0 锁死扣减录入）；
 * 5. 试用期（staff.probation=1）：前台商品/售卡类提成 ×50%（commission_probation_multiplier）；
 *    试用期不设绩效——performance.applicable=false，应付绩效按 0 透出（基数仍列出供核对）；
 * 6. P3 全店提成基数=全店洗美服务营收（门市价，同 G4 口径；商品/年费不进，寄养不计——
 *    任务书 §九 寄养默认不计提成）。
 * 7. R12 V6 退款提成冲减（读侧）：源单行有 refund_bill_items（kind='item'）→ 行退款额/
 *    行有效价=退款比例，该行提成×(1−比例) 精确到分（行内 refundRatioBp/refundClawbackFen/
 *    refunded 快照列）；全额退=该行提成全额冲减归零；跨月=退款发生月 biz_date 落在本月、
 *    源单属更早月份且源月已快照 → 不动快照、差额进本月 adjustments 调整项行（mySummary
 *    提成区随行透出）；源月未快照由源月 live 重算自然冲减（防双计）。G4/P3 店级行与绩效
 *    池基数不做冲减（V6 冻结口径只写「该行提成」）。
 *
 * 回溯写死（七步复核 Bug② 修复）：computeMonth 全部金钱行（服务率/商品率/产能阈值倍率/
 * G4/P3 率/perf_base_rate/SABCD 系数档/试用期倍率）逐源单按 settled_at 时序解析
 * （resolveFromHistory：effective_from<=ts 最新行，失效历史行参与，无命中取最早行兜底）；
 * 仅两处例外取当前生效值并注释写死——扣减 50% cap（扣减是当下动作）与口径小字/policyNote
 * （那是「现在口径」不是历史账单）。快照逻辑不变：每月 1 日 02:00 冻结，已快照月份不动。
 */

import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import {
  merchantManagerProcedure,
  merchantOwnerProcedure,
  router,
  staffProcedure,
} from '../trpc';

/** 全局 db handle 类型（事务 handle 运行时接口一致，类型上显式断言，同 attendance.ts 惯例） */
export type DbHandle = typeof db;
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const QUARTER_RE = /^\d{4}-Q[1-4]$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → 本地 'YYYY-MM-DD' */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM' → 当月起止（本地时区，右端不含） */
function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

/** 'YYYY-MM' → 所在季度 'YYYY-Qn' */
function quarterOfMonth(month: string): string {
  const [y, m] = month.split('-').map((s) => parseInt(s, 10));
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

/** 'YYYY-Qn' → 季度起止（本地时区，右端不含） */
function quarterRange(quarter: string): { start: Date; end: Date } {
  const [y, q] = quarter.split('-Q').map((s) => parseInt(s, 10));
  const m0 = (q - 1) * 3; // 季度首月（0 基）
  return { start: new Date(y, m0, 1), end: new Date(y, m0 + 3, 1) };
}


function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/* ------------------------------------------------------------------ */
/* 规则读取（配置表只读，代码零常量）                                       */
/* ------------------------------------------------------------------ */

export interface CommissionRuleSet {
  /** 当前生效版本号（active 行中最大 version） */
  version: number;
  byKey: Map<string, Record<string, unknown>>;
}

/**
 * 读取提成规则（同 services/xpAward.ts loadXpRules 模式）：
 * - 不传 atTs：当前生效（active=1）规则映射；
 * - 传 atTs：effective_from 口径——全表行中逐 key 取 effective_from <= atTs 的最新行
 *   （含已失效历史行：配置端口保存时旧行 active=0 但 effective_from 保留，
 *   故历史源单可按其发生时点取到当时生效的版本，新规不回溯）。
 */
export async function loadCommissionRules(d: DbHandle, atTs?: Date): Promise<CommissionRuleSet> {
  const rows = await d
    .select({
      ruleKey: schema.commissionRules.ruleKey,
      valueJson: schema.commissionRules.valueJson,
      version: schema.commissionRules.version,
      effectiveFrom: schema.commissionRules.effectiveFrom,
      active: schema.commissionRules.active,
    })
    .from(schema.commissionRules)
    .where(atTs ? undefined : eq(schema.commissionRules.active, true));
  const byKey = new Map<string, Record<string, unknown>>();
  const effByKey = new Map<string, number>();
  let version = 0;
  for (const r of rows) {
    if (atTs) {
      const effMs = r.effectiveFrom.getTime();
      if (effMs > atTs.getTime()) continue; // 新规只管生效后的单
      if ((effByKey.get(r.ruleKey) ?? -1) > effMs) continue;
      effByKey.set(r.ruleKey, effMs);
    }
    byKey.set(r.ruleKey, (r.valueJson ?? {}) as Record<string, unknown>);
    if (r.version > version) version = r.version;
  }
  return { version, byKey };
}

/** 规则时序行（effective_from 升序） */
interface RuleHistoryRow {
  effMs: number;
  value: Record<string, unknown>;
}
type RuleHistory = Map<string, RuleHistoryRow[]>;

/** 全表规则时序一次加载（computeMonth 逐行解析用，单查询无 N+1） */
async function loadRuleHistory(d: DbHandle): Promise<{ history: RuleHistory; currentVersion: number }> {
  const rows = await d
    .select({
      ruleKey: schema.commissionRules.ruleKey,
      valueJson: schema.commissionRules.valueJson,
      version: schema.commissionRules.version,
      effectiveFrom: schema.commissionRules.effectiveFrom,
    })
    .from(schema.commissionRules);
  const history: RuleHistory = new Map();
  let currentVersion = 0;
  for (const r of rows) {
    let arr = history.get(r.ruleKey);
    if (!arr) {
      arr = [];
      history.set(r.ruleKey, arr);
    }
    arr.push({ effMs: r.effectiveFrom.getTime(), value: (r.valueJson ?? {}) as Record<string, unknown> });
    if (r.version > currentVersion) currentVersion = r.version;
  }
  for (const arr of history.values()) arr.sort((a, b) => a.effMs - b.effMs);
  return { history, currentVersion };
}

/**
 * 时序解析（纯函数）：取 effective_from <= ts 的最新一行（active 与 inactive 历史行
 * 都参与——config.save 保留失效行 effective_from，新规只管生效后的单不回溯）；
 * 无命中（源单早于该 key 首行生效时间）→ 取该 key 最早一行兜底（种子行即初始口径）。
 * 同秒边界（时间列精度=秒的固有歧义）：源单 ts 与某次改版 effective_from 同秒时
 * 取改前旧版——宁旧勿新，与「不回溯、防工资越看越瘦」同向（e2e 同秒连击实证）：
 * 实现=严格取 effMs < ts 的最后一行；同秒首行之前无更早行时取 effMs <= ts 的最早一行。
 */
function resolveFromHistory(history: RuleHistory, key: string, ts: Date): Record<string, unknown> | undefined {
  const arr = history.get(key);
  if (!arr || arr.length === 0) return undefined;
  const ms = ts.getTime();
  let hit: RuleHistoryRow | undefined;
  for (const row of arr) {
    if (row.effMs >= ms) break; // 严格小于：同秒改版不算「生效后」
    hit = row;
  }
  if (!hit) hit = arr.find((r) => r.effMs <= ms) ?? arr[0]!;
  return hit.value;
}

/**
 * 规则时序解析器（DB 版，给定 key 集合单查询解析）：各取 effective_from <= ts 的最新一行；
 * 无则取该 key 最早一行兜底。语义与 resolveFromHistory 完全一致。
 * （computeMonth 走 loadRuleHistory+resolveFromHistory 预加载路径避免逐行查询；
 * 本函数供需要"任意 ts 任意 keys"的调用方/测试直用。）
 */
export async function resolveRulesAt(
  d: DbHandle,
  keys: string[],
  ts: Date,
): Promise<Map<string, Record<string, unknown>>> {
  const rows = keys.length
    ? await d
        .select({
          ruleKey: schema.commissionRules.ruleKey,
          valueJson: schema.commissionRules.valueJson,
          effectiveFrom: schema.commissionRules.effectiveFrom,
        })
        .from(schema.commissionRules)
        .where(inArray(schema.commissionRules.ruleKey, keys))
    : [];
  const history: RuleHistory = new Map();
  for (const r of rows) {
    let arr = history.get(r.ruleKey);
    if (!arr) {
      arr = [];
      history.set(r.ruleKey, arr);
    }
    arr.push({ effMs: r.effectiveFrom.getTime(), value: (r.valueJson ?? {}) as Record<string, unknown> });
  }
  for (const arr of history.values()) arr.sort((a, b) => a.effMs - b.effMs);
  const out = new Map<string, Record<string, unknown>>();
  for (const key of keys) {
    const v = resolveFromHistory(history, key, ts);
    if (v) out.set(key, v);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* G0 学徒洗护判别（裁定③/决策 #40：仅洗护不含造型；关键词读 duration_rules） */
/* ------------------------------------------------------------------ */

/**
 * G0 学徒 5% 洗护单判别（决策 #40：与时长引擎共用 duration_service_kind_keywords
 * 一张关键词表，一处维护；不再硬编码关键词）：
 * 服务名命中 bath 词表（洗/浴/SPA/清洁/吹干…）且不命中 groom 词表（美容/造型/修剪/修毛/剪…）
 * → 洗护单（计 5%）；否则不计。
 * 注意与引擎 classifyServiceKind 的「bath 先命中优先」语义刻意不同：G0 是排除式
 * （双语义命中=groom 优先排除，宁漏计不多计），注释写死防误统一。
 * 时长供给表批次落地正式类目列后换装正式判别（仅此一处集中判别，换装零扩散）。
 */
export function isWashService(
  serviceName: string,
  keywords: Record<'bath' | 'groom', string[]>,
): boolean {
  const name = serviceName.toLowerCase();
  const hit = (kws: string[]) => kws.some((kw) => name.includes(kw.toLowerCase()));
  return hit(keywords.bath) && !hit(keywords.groom);
}

/* ------------------------------------------------------------------ */
/* 计算载荷类型（快照 payload_json 同构）                                  */
/* ------------------------------------------------------------------ */

interface CommissionLine {
  billId: string;
  billNo: string;
  itemId: string;
  /** 预约行源单（服务提成） / 商品行 refId */
  refId: string;
  name: string;
  date: string; // 账单 settled_at 本地日期（计提时点见头部报备偏差 2）
  /** 计提基数（分）：服务行=门市价快照 unit_price_fen；商品行=实收（有效价×qty） */
  baseFen: number;
  rateBp: number;
  /** 产能加计倍率 bp（默认 10000=1 倍） */
  multiplierBp: number;
  /** 提成净额（分）：R12 V6 起=毛提成−退款冲减（行退款额/行金额=退款比例，精确到分） */
  amountFen: number;
  /** 产能红线超出部分：已批准 1.5 倍（overwork=true）；未批准 1 倍计提+待批准标记 */
  overwork: boolean;
  pendingApproval: boolean;
  /* ---- R12 V6 退款提成冲减（读侧快照列） ---- */
  /** 退款比例 bp（行退款额÷行有效价×10000；无退款=0） */
  refundRatioBp: number;
  /** 冲减额（分）= round(毛提成 × 退款比例) */
  refundClawbackFen: number;
  /** 全额退标记：该行提成全额冲减、行归零 */
  refunded: boolean;
}

interface StoreLine {
  kind: 'g4_store' | 'p3_store';
  label: string;
  baseFen: number;
  rateBp: number;
  amountFen: number;
}

interface PerfPool {
  /** 绩效基数（分）：洗美营收·门市价 */
  baseFen: number;
  /** 绩效比例 bp（perf_base_rate，5%） */
  rateBp: number;
  /** 池金额（分）= 基数 × 比例（未乘系数） */
  amountFen: number;
}

interface PerformanceBlock {
  quarter: string;
  /** 试用期不设绩效与全勤（任务书 V1.1 §四.A 试用期行） */
  applicable: boolean;
  note?: string;
  grade: string; // S|A|B|C|D 或 '未评级'
  coeffBp: number | null; // 未评级 → null（应付绩效不可算，基数仍透出）
  /** 美容师绩效池（本人操作洗美营收×5%）——同源双计，两池分列 */
  groomerPool: PerfPool;
  /** 前台绩效池（本人接待归属洗美营收×5%，receptionist_id IS NULL 硬排除） */
  frontdeskPool: PerfPool;
  /** 应付绩效（分）=（适用池金额×系数）；未评级/不适用 → 0 */
  payableFen: number;
}

export interface CommissionMonthPayload {
  staffId: string;
  storeId: string;
  month: string;
  role: string;
  grade: string | null;
  probation: boolean;
  serviceLines: CommissionLine[];
  productLines: CommissionLine[];
  /** 售卡定额：规则已落库、源单随 R11 会员前置批开通——恒空+明示，不悬空 */
  cardLines: never[];
  cardNote: string;
  storeLines: StoreLine[];
  /** 提成合计（分）= 行净额合计 + 店级行 − 跨月调整项合计（R12 V6 冲减口径） */
  commissionTotalFen: number;
  /**
   * 跨月冲减「调整项」（R12 V6 · V1.3 口径）：退款发生月在本月、源单属更早月份且
   * 源月已快照 → 不动快照，差额进本月调整项行；源月未快照 → 由源月 live 重算自然
   * 冲减，不进调整项（防双计，注释写死）。clawbackFen 正值列示（展示=负数行）。
   */
  adjustments: Array<{
    refundNo: string;
    billNo: string;
    itemId: string;
    name: string;
    clawbackFen: number;
  }>;
  /** 调整项冲减合计（分，≥0；commissionTotalFen 已减除） */
  adjustmentsTotalFen: number;
  performance: PerformanceBlock;
  deductions: Array<{
    id: string;
    amountFen: number;
    reason: string;
    createdBy: string;
    createdAt: Date;
  }>;
  ruleVersion: number;
}

type StaffRow = typeof schema.staff.$inferSelect;
type BillItemRow = typeof schema.cashierBillItems.$inferSelect;

/** 账单行有效价（改价留痕口径：adjusted ?? unit，同 cashier.ts effPrice） */
function effPrice(it: Pick<BillItemRow, 'unitPriceFen' | 'adjustedPriceFen'>): number {
  return it.adjustedPriceFen ?? it.unitPriceFen;
}

/**
 * 读取门店某时间段内已结账且未被冲正的账单+行项+关联预约/服务（一次取齐，无 N+1）。
 * 冲正口径：status='settled' 且 reversed_at IS NULL；冲正单（status='reversal'）本身
 * 不进入计提（金额镜像负值单与原单一并排除，同 computeDayTender 双落点口径）。
 */
async function loadSettledBills(d: DbHandle, storeId: string, start: Date, end: Date) {
  const bills = await d
    .select()
    .from(schema.cashierBills)
    .where(
      and(
        eq(schema.cashierBills.storeId, storeId),
        eq(schema.cashierBills.status, 'settled'),
        isNull(schema.cashierBills.reversedAt),
        gte(schema.cashierBills.settledAt, start),
        lt(schema.cashierBills.settledAt, end),
      ),
    );
  if (bills.length === 0) {
    return { bills, items: [] as BillItemRow[], appts: new Map(), services: new Map() };
  }
  const billIds = bills.map((b) => b.id);
  const items = await d
    .select()
    .from(schema.cashierBillItems)
    .where(inArray(schema.cashierBillItems.billId, billIds));

  const apptIds = [...new Set(items.filter((i) => i.kind === 'appointment').map((i) => i.refId))];
  const svcIds = [...new Set(items.filter((i) => i.kind === 'service').map((i) => i.refId))];
  const apptRows = apptIds.length
    ? await d
        .select({
          id: schema.appointments.id,
          staffId: schema.appointments.staffId,
          type: schema.appointments.type,
        })
        .from(schema.appointments)
        .where(inArray(schema.appointments.id, apptIds))
    : [];
  const svcRows = svcIds.length
    ? await d
        .select({ id: schema.services.id, type: schema.services.type })
        .from(schema.services)
        .where(inArray(schema.services.id, svcIds))
    : [];
  return {
    bills,
    items,
    appts: new Map(apptRows.map((a) => [a.id, a])),
    services: new Map(svcRows.map((s) => [s.id, s])),
  };
}

/** 行项是否计入洗美营收（门市价口径；寄养/商品/年费不进） */
function isGroomingItem(
  it: BillItemRow,
  appts: Map<string, { id: string; staffId: string | null; type: string }>,
  services: Map<string, { id: string; type: string }>,
): boolean {
  if (it.kind === 'appointment') return appts.get(it.refId)?.type === 'grooming';
  if (it.kind === 'service') return services.get(it.refId)?.type === 'grooming';
  return false;
}

/**
 * 计算某员工某月提成+绩效结构化载荷（live 口径：源单实时计算）。
 * 回溯写死（V1.3「新规只管生效后的单」，七步复核 Bug② 修复）：
 * 全部金钱行（服务/商品/产能加计/G4/P3/绩效池/系数档/试用期倍率）逐源单按其
 * 账单 settled_at 走 resolveFromHistory 时序解析（effective_from<=ts 最新行，
 * 失效历史行参与，无命中取最早行兜底）——改率前的旧单永按旧率，改率后的新单按新率。
 */
export async function computeMonth(
  d: DbHandle,
  staffRow: StaffRow,
  month: string,
): Promise<CommissionMonthPayload> {
  const storeId = staffRow.storeId;
  const { start, end } = monthRange(month);
  const quarter = quarterOfMonth(month);
  const qRange = quarterRange(quarter);
  const { history: ruleHistory, currentVersion } = await loadRuleHistory(d);
  const ruleAt = (key: string, ts: Date) => resolveFromHistory(ruleHistory, key, ts);

  /* ---- 当月账单域（提成） ---- */
  const monthData = await loadSettledBills(d, storeId, start, end);
  const billById = new Map(monthData.bills.map((b) => [b.id, b]));

  /* 产能红线批准留痕（本月，按日） */
  const approvals = await d
    .select({ date: schema.overworkApprovals.date })
    .from(schema.overworkApprovals)
    .where(
      and(
        eq(schema.overworkApprovals.staffId, staffRow.id),
        gte(schema.overworkApprovals.date, localDateStr(start)),
        lt(schema.overworkApprovals.date, localDateStr(end)),
      ),
    );
  const approvedDates = new Set(approvals.map((a) => a.date));

  /* ---- 服务提成（groomer）：仅 kind='appointment' 行可归属操作美容师（备案③散客单不计） ---- */
  const serviceLines: CommissionLine[] = [];
  const lineTs = new Map<string, Date>(); // itemId → 源单时间（产能加计逐行时序解析用）
  const isGroomer = staffRow.role === 'groomer' || (staffRow.grade ?? '').startsWith('G');
  /* G0 判别关键词（决策 #40：读 duration_service_kind_keywords 当前生效行，与时长引擎共用一表） */
  const kwRow = isGroomer && staffRow.grade === 'G0'
    ? await d
        .select({ valueJson: schema.durationRules.valueJson })
        .from(schema.durationRules)
        .where(and(eq(schema.durationRules.ruleKey, 'duration_service_kind_keywords'), eq(schema.durationRules.active, true)))
        .get()
    : undefined;
  const kwVal = kwRow?.valueJson as Record<string, unknown> | undefined;
  const serviceKindKeywords: Record<'bath' | 'groom', string[]> | null =
    Array.isArray(kwVal?.bath) && Array.isArray(kwVal?.groom)
      ? { bath: kwVal.bath as string[], groom: kwVal.groom as string[] }
      : null; // 缺行/非法 → scope=bath 时 G0 不计（宁漏计口径，注释在案）
  if (isGroomer) {
    for (const it of monthData.items) {
      if (it.kind !== 'appointment') continue;
      const appt = monthData.appts.get(it.refId);
      if (!appt || appt.type !== 'grooming' || appt.staffId !== staffRow.id) continue;
      const bill = billById.get(it.billId)!;
      const ts = bill.settledAt ?? bill.createdAt;
      // 裁定③/决策 #40：G0 学徒 5% scope 判定——scope 缺省='bath'（向后兼容既有库无 scope 行）：
      // bath=仅洗护单（isWashService 读共享关键词表）；all=全部 grooming 单（老板端口可调）
      if (staffRow.grade === 'G0') {
        const g0Rule = ruleAt('commission_grooming_assistant_g0_rate', ts);
        const scope = typeof g0Rule?.scope === 'string' ? g0Rule.scope : 'bath';
        if (scope !== 'all' && (!serviceKindKeywords || !isWashService(it.nameSnapshot, serviceKindKeywords))) {
          continue;
        }
      }
      const key = staffRow.grade === 'G0' ? 'commission_grooming_assistant_g0_rate' : 'commission_grooming_rate';
      const rateBp = num(ruleAt(key, ts)?.rate_bp, 0);
      const baseFen = it.unitPriceFen; // 门市价快照（券单/会员差额门店担，同按门市价）
      lineTs.set(it.id, ts);
      serviceLines.push({
        billId: bill.id,
        billNo: bill.billNo,
        itemId: it.id,
        refId: it.refId,
        name: it.nameSnapshot,
        date: localDateStr(ts),
        baseFen,
        rateBp,
        multiplierBp: 10000,
        amountFen: Math.round((baseFen * rateBp) / 10000),
        overwork: false,
        pendingApproval: false,
        refundRatioBp: 0, // R12 V6：退款冲减在总额聚合前统一按行结算（见下方 V6 段）
        refundClawbackFen: 0,
        refunded: false,
      });
    }

    /* 产能红线加计：按日分组，序号>threshold 的行为超出行 ×1.5（须店长批准；未批准 1 倍+待批准）。
       阈值/倍率逐行按该行源单 settled_at 时序解析（回溯口径同提成率）。 */
    const byDay = new Map<string, CommissionLine[]>();
    for (const l of serviceLines) {
      const arr = byDay.get(l.date) ?? [];
      arr.push(l);
      byDay.set(l.date, arr);
    }
    for (const [date, lines] of byDay) {
      const approved = approvedDates.has(date);
      lines.forEach((l, idx) => {
        const ts = lineTs.get(l.itemId) ?? new Date(`${date}T23:59:59`);
        const cfg = ruleAt('commission_overwork_multiplier', ts) ?? {};
        const threshold = num(cfg.threshold_per_day, 8);
        if (idx < threshold) return; // 阈值内行正常计提
        if (approved) {
          const multiplierBp = num(cfg.multiplier_bp, 15000);
          l.multiplierBp = multiplierBp;
          l.amountFen = Math.round((l.baseFen * l.rateBp * multiplierBp) / 10000 / 10000);
          l.overwork = true;
        } else {
          l.pendingApproval = true; // 未批准按 1 倍计提，页面据此明示「待店长批准」
        }
      });
    }
  }

  /* ---- 全店洗美营收（门市价，G4/P3 共用基数；金额逐行时序解析） ---- */
  let storeGroomingRevenueFen = 0;
  let g4AmountFen = 0;
  let p3AmountFen = 0;
  const wantG4 = staffRow.grade === 'G4';
  const wantP3 = staffRow.grade === 'P3';
  for (const it of monthData.items) {
    if (!isGroomingItem(it, monthData.appts, monthData.services)) continue;
    const fen = it.unitPriceFen * it.qty;
    storeGroomingRevenueFen += fen;
    if (wantG4 || wantP3) {
      const bill = billById.get(it.billId)!;
      const ts = bill.settledAt ?? bill.createdAt;
      if (wantG4) g4AmountFen += Math.round((fen * num(ruleAt('commission_g4_store_rate', ts)?.rate_bp, 0)) / 10000);
      if (wantP3) p3AmountFen += Math.round((fen * num(ruleAt('commission_p3_store_rate', ts)?.rate_bp, 0)) / 10000);
    }
  }

  const storeLines: StoreLine[] = [];
  if (wantG4) {
    // rateBp 展示口径=当期末生效版本；amountFen 已按逐源单时序解析（回溯不回改）
    storeLines.push({
      kind: 'g4_store',
      label: 'G4 全店管理提成（本店月度洗美营收·门市价）',
      baseFen: storeGroomingRevenueFen,
      rateBp: num(ruleAt('commission_g4_store_rate', end)?.rate_bp, 0),
      amountFen: g4AmountFen,
    });
  }

  /* ---- 商品提成（frontdesk 或 P3 本人开单；实收口径；试用期 ×50%） ---- */
  const productLines: CommissionLine[] = [];
  const frontdeskLike = staffRow.role === 'frontdesk' || staffRow.grade === 'P3';
  if (frontdeskLike) {
    for (const bill of monthData.bills) {
      if (bill.operatorId !== staffRow.userId) continue; // 个人开单归属（operator=开单人同源起步）
      const ts = bill.settledAt ?? bill.createdAt;
      const rateBp = num(ruleAt('commission_product_rate', ts)?.rate_bp, 0);
      const probMultBp = staffRow.probation
        ? num(ruleAt('commission_probation_multiplier', ts)?.multiplier_bp, 5000)
        : 10000;
      for (const it of monthData.items) {
        if (it.billId !== bill.id || it.kind !== 'product') continue;
        const baseFen = effPrice(it) * it.qty; // 实收口径（有效价×qty）
        productLines.push({
          billId: bill.id,
          billNo: bill.billNo,
          itemId: it.id,
          refId: it.refId,
          name: it.nameSnapshot,
          date: localDateStr(ts),
          baseFen,
          rateBp,
          multiplierBp: probMultBp,
          amountFen: Math.round((baseFen * rateBp * probMultBp) / 10000 / 10000),
          overwork: false,
          pendingApproval: false,
          refundRatioBp: 0,
          refundClawbackFen: 0,
          refunded: false,
        });
      }
    }
  }

  /* ---- P3 全店提成（全店洗美服务营收 ×1%，金额逐行时序解析，报备偏差 6） ---- */
  if (wantP3) {
    storeLines.push({
      kind: 'p3_store',
      label: 'P3 全店提成（全店洗美服务营收·门市价）',
      baseFen: storeGroomingRevenueFen,
      rateBp: num(ruleAt('commission_p3_store_rate', end)?.rate_bp, 0), // 展示口径=当期末生效
      amountFen: p3AmountFen,
    });
  }

  /* ---- 绩效（季度，Philia 口径 ×5% × SABCD 系数；同源双计两池分列；
         perf_base_rate 与系数档均逐源单按 settled_at 时序解析——改率/改档不回溯旧单） ---- */
  const gradeRow = await d
    .select()
    .from(schema.performanceGrades)
    .where(
      and(
        eq(schema.performanceGrades.staffId, staffRow.id),
        eq(schema.performanceGrades.quarter, quarter),
      ),
    )
    .get();
  const coeffKey = gradeRow ? `perf_coeff_${gradeRow.grade.toLowerCase()}` : null;
  const qData = await loadSettledBills(d, storeId, qRange.start, qRange.end);
  let groomerBaseFen = 0;
  let groomerAmountFen = 0; // Σ 逐行 round(门市价×当时 perf 率)
  let groomerPayableFen = 0; // Σ 逐行 round(行池额×当时系数)
  let frontdeskBaseFen = 0;
  let frontdeskAmountFen = 0;
  let frontdeskPayableFen = 0;
  const qBillById = new Map(qData.bills.map((b) => [b.id, b]));
  for (const it of qData.items) {
    if (!isGroomingItem(it, qData.appts, qData.services)) continue;
    const fen = it.unitPriceFen * it.qty; // 绩效基数=门市价（与提成同口径）
    const bill = qBillById.get(it.billId)!;
    const ts = bill.settledAt ?? bill.createdAt;
    const rowPerfBp = num(ruleAt('perf_base_rate', ts)?.rate_bp, 500);
    const rowAmount = Math.round((fen * rowPerfBp) / 10000);
    const rowCoeffBp = coeffKey ? num(ruleAt(coeffKey, ts)?.coeff_bp, 0) : null;
    const rowPayable = rowCoeffBp !== null ? Math.round((rowAmount * rowCoeffBp) / 10000) : 0;
    // 美容师池：本人操作（appointment 行 staff_id；散客 service 行无操作人归属不计个人池）
    if (it.kind === 'appointment' && qData.appts.get(it.refId)?.staffId === staffRow.id) {
      groomerBaseFen += fen;
      groomerAmountFen += rowAmount;
      groomerPayableFen += rowPayable;
    }
    // 前台池：本人接待归属（receptionist_id=本人 userId；IS NULL 的账单等值匹配天然硬排除）
    if (bill.receptionistId === staffRow.userId) {
      frontdeskBaseFen += fen;
      frontdeskAmountFen += rowAmount;
      frontdeskPayableFen += rowPayable;
    }
  }
  // 展示口径（rateBp/coeffBp）=当期末生效版本；金额列已逐行时序解析
  const perfRateBp = num(ruleAt('perf_base_rate', qRange.end)?.rate_bp, 500);
  const coeffBp = coeffKey ? num(ruleAt(coeffKey, qRange.end)?.coeff_bp, 0) : null;
  const groomerPool: PerfPool = {
    baseFen: groomerBaseFen,
    rateBp: perfRateBp,
    amountFen: groomerAmountFen,
  };
  const frontdeskPool: PerfPool = {
    baseFen: frontdeskBaseFen,
    rateBp: perfRateBp,
    amountFen: frontdeskAmountFen,
  };
  // 适用池：按岗位取主池（groomer=操作池，frontdesk/P 档=接待池）；两池仍分列透出
  const applicable = !staffRow.probation; // 试用期不设绩效与全勤（报备偏差 5）
  const payableFen =
    applicable && gradeRow ? (isGroomer ? groomerPayableFen : frontdeskPayableFen) : 0;
  const performance: PerformanceBlock = {
    quarter,
    applicable,
    ...(applicable ? {} : { note: '试用期不设绩效与全勤' }),
    grade: gradeRow?.grade ?? '未评级',
    coeffBp,
    groomerPool,
    frontdeskPool,
    payableFen,
  };

  /* ---- 扣减（只扣绩效不扣提成，列示含原因） ---- */
  const deductions = await d
    .select({
      id: schema.deductionRecords.id,
      amountFen: schema.deductionRecords.amountFen,
      reason: schema.deductionRecords.reason,
      createdBy: schema.deductionRecords.createdBy,
      createdAt: schema.deductionRecords.createdAt,
    })
    .from(schema.deductionRecords)
    .where(
      and(
        eq(schema.deductionRecords.staffId, staffRow.id),
        eq(schema.deductionRecords.month, month),
      ),
    )
    .orderBy(desc(schema.deductionRecords.createdAt));

  /* ---- R12 V6 退款提成冲减（读侧，只读计算；接回溯修复后的逐行解析口径） ----
   * 行内冲减：源单（本月账单域）有 refund_bill_items（kind='item'，含全额退的逐行、
   * 按行退的指定行、按金额退的 apportioned 分摊行）→ 行退款额/行有效价=退款比例，
   * 该行提成×(1−比例)（精确到分）；全额退=该行提成全额冲减（行归零并标注 refunded）。
   * 跨月调整项：退款发生月在本月（refund_bills.biz_date）、源单属更早月份且源月
   * 已快照 → 不动快照，差额进本月「调整项」行；源月未快照 → 由源月 live 重算自然
   * 冲减，不进调整项（防双计，口径写死）。
   * 边界写死：G4/P3 店级行与绩效池基数不做退款冲减（V6 冻结口径只写「该行提成」，
   * 店级/绩效口径如需联动随 V1.3 后续修订）；寄养/次卡退卡无 item 明细行天然不进。 */
  const monthItemById = new Map(monthData.items.map((it) => [it.id, it]));
  const refundFenByItem = new Map<string, number>();
  const monthBillIds = monthData.bills.map((b) => b.id);
  if (monthBillIds.length > 0) {
    const refundItemRows = await d
      .select({
        billItemId: schema.refundBillItems.billItemId,
        amountFen: schema.refundBillItems.amountFen,
      })
      .from(schema.refundBillItems)
      .innerJoin(schema.refundBills, eq(schema.refundBills.id, schema.refundBillItems.refundId))
      .where(
        and(
          inArray(schema.refundBills.billId, monthBillIds),
          inArray(schema.refundBills.status, ['executed', 'settled']),
          eq(schema.refundBillItems.kind, 'item'),
        ),
      );
    for (const r of refundItemRows) {
      if (!r.billItemId) continue;
      refundFenByItem.set(r.billItemId, (refundFenByItem.get(r.billItemId) ?? 0) + r.amountFen);
    }
  }
  const applyRefundClawback = (lines: CommissionLine[]) => {
    for (const l of lines) {
      const refundedFen = refundFenByItem.get(l.itemId) ?? 0;
      if (refundedFen <= 0) continue;
      const src = monthItemById.get(l.itemId);
      const lineEffFen = src ? effPrice(src) * src.qty : 0;
      if (lineEffFen <= 0) continue;
      const ratio = Math.min(1, refundedFen / lineEffFen);
      const clawbackFen = Math.round(l.amountFen * ratio); // 行提成×退款比例，精确到分
      l.refundRatioBp = Math.round(ratio * 10000);
      l.refundClawbackFen = clawbackFen;
      l.refunded = ratio >= 1; // 全额退=该行提成全额冲减（行归零并标注 refunded）
      l.amountFen -= clawbackFen;
    }
  };
  applyRefundClawback(serviceLines);
  applyRefundClawback(productLines);

  /* 跨月「调整项」：逐退款单重算归属本人的源行毛提成×退款比例（1×基线——产能加计的
     跨月差额不追，简单正确口径写死；规则版本仍按源单 settled_at 时序解析，回溯口径保持） */
  const adjustments: CommissionMonthPayload['adjustments'] = [];
  const monthRefunds = await d
    .select()
    .from(schema.refundBills)
    .where(
      and(
        eq(schema.refundBills.storeId, storeId),
        gte(schema.refundBills.bizDate, localDateStr(start)),
        lt(schema.refundBills.bizDate, localDateStr(end)),
        inArray(schema.refundBills.status, ['executed', 'settled']),
      ),
    );
  for (const rf of monthRefunds) {
    const srcBill = await d
      .select()
      .from(schema.cashierBills)
      .where(eq(schema.cashierBills.id, rf.billId))
      .get();
    if (!srcBill) continue;
    const srcTs = srcBill.settledAt ?? srcBill.createdAt;
    const srcMonth = localDateStr(srcTs).slice(0, 7);
    if (srcMonth >= month) continue; // 同月：行内冲减已覆盖，不进调整项
    const snap = await d
      .select({ id: schema.commissionSnapshots.id })
      .from(schema.commissionSnapshots)
      .where(
        and(
          eq(schema.commissionSnapshots.staffId, staffRow.id),
          eq(schema.commissionSnapshots.period, srcMonth),
          eq(schema.commissionSnapshots.kind, 'commission'),
        ),
      )
      .get();
    if (!snap) continue; // 源月未快照：源月 live 重算自然冲减（防双计，口径写死）
    const rfItems = await d
      .select()
      .from(schema.refundBillItems)
      .where(and(eq(schema.refundBillItems.refundId, rf.id), eq(schema.refundBillItems.kind, 'item')));
    if (rfItems.length === 0) continue;
    const srcItems = await d
      .select()
      .from(schema.cashierBillItems)
      .where(
        inArray(
          schema.cashierBillItems.id,
          rfItems.map((r) => r.billItemId).filter((x): x is string => !!x),
        ),
      );
    const srcApptIds = [...new Set(srcItems.filter((i) => i.kind === 'appointment').map((i) => i.refId))];
    const srcAppts = srcApptIds.length
      ? await d
          .select({ id: schema.appointments.id, staffId: schema.appointments.staffId, type: schema.appointments.type })
          .from(schema.appointments)
          .where(inArray(schema.appointments.id, srcApptIds))
      : [];
    const srcApptById = new Map(srcAppts.map((a) => [a.id, a]));
    for (const rfIt of rfItems) {
      const src = srcItems.find((i) => i.id === rfIt.billItemId);
      if (!src) continue;
      const lineEffFen = effPrice(src) * src.qty;
      if (lineEffFen <= 0) continue;
      const ratio = Math.min(1, rfIt.amountFen / lineEffFen);
      let grossFen = 0;
      if (src.kind === 'appointment' && isGroomer) {
        const appt = srcApptById.get(src.refId);
        if (!appt || appt.type !== 'grooming' || appt.staffId !== staffRow.id) continue;
        if (staffRow.grade === 'G0') {
          const g0Rule = ruleAt('commission_grooming_assistant_g0_rate', srcTs);
          const scope = typeof g0Rule?.scope === 'string' ? g0Rule.scope : 'bath';
          if (scope !== 'all' && (!serviceKindKeywords || !isWashService(src.nameSnapshot, serviceKindKeywords))) {
            continue;
          }
        }
        const key = staffRow.grade === 'G0' ? 'commission_grooming_assistant_g0_rate' : 'commission_grooming_rate';
        grossFen = Math.round((src.unitPriceFen * num(ruleAt(key, srcTs)?.rate_bp, 0)) / 10000);
      } else if (src.kind === 'product' && frontdeskLike) {
        if (srcBill.operatorId !== staffRow.userId) continue;
        const rateBp = num(ruleAt('commission_product_rate', srcTs)?.rate_bp, 0);
        const probMultBp = staffRow.probation
          ? num(ruleAt('commission_probation_multiplier', srcTs)?.multiplier_bp, 5000)
          : 10000;
        grossFen = Math.round((lineEffFen * rateBp * probMultBp) / 10000 / 10000);
      } else {
        continue; // 非本人归属行（散客 service 行/他人行）不进本人调整项
      }
      const clawbackFen = Math.round(grossFen * ratio);
      if (clawbackFen <= 0) continue;
      adjustments.push({
        refundNo: rf.refundNo,
        billNo: srcBill.billNo,
        itemId: src.id,
        name: src.nameSnapshot,
        clawbackFen,
      });
    }
  }
  const adjustmentsTotalFen = adjustments.reduce((s, a) => s + a.clawbackFen, 0);

  const commissionTotalFen =
    serviceLines.reduce((s, l) => s + l.amountFen, 0) +
    productLines.reduce((s, l) => s + l.amountFen, 0) +
    storeLines.reduce((s, l) => s + l.amountFen, 0) -
    adjustmentsTotalFen;

  return {
    staffId: staffRow.id,
    storeId,
    month,
    role: staffRow.role,
    grade: staffRow.grade,
    probation: staffRow.probation,
    serviceLines,
    productLines,
    cardLines: [], // 售卡定额规则已落库、源单随 R11 会员前置批开通（不悬空，不虚构）
    cardNote: '随会员前置批开通',
    storeLines,
    commissionTotalFen,
    adjustments,
    adjustmentsTotalFen,
    performance,
    deductions,
    ruleVersion: currentVersion,
  };
}

/* ------------------------------------------------------------------ */
/* 快照（每月 1 日 02:00 定时器 + 老板手动补跑共用；幂等 onConflictDoNothing） */
/* ------------------------------------------------------------------ */

export interface SnapshotResult {
  commission: number;
  performance: number;
}

/**
 * 门店月度快照：每员工写 commission_snapshots kind='commission'（period=month）；
 * month 为季度末月（m%3==0）时同写 kind='performance' 季度快照（period=该季度）。
 * 幂等：unique(staff_id,period,kind) + onConflictDoNothing——重复触发/手动补跑不动历史快照。
 */
export async function snapshotStoreMonth(
  d: DbHandle,
  storeId: string,
  month: string,
): Promise<SnapshotResult> {
  const staffRows = await d
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')));
  const quarterSnap = parseInt(month.slice(5, 7), 10) % 3 === 0 ? quarterOfMonth(month) : null;

  let commission = 0;
  let performance = 0;
  for (const st of staffRows) {
    const payload = await computeMonth(d, st, month);
    const ins = await d
      .insert(schema.commissionSnapshots)
      .values({
        storeId,
        staffId: st.id,
        period: month,
        kind: 'commission',
        payloadJson: payload as unknown as schema.CommissionSnapshotPayload,
        totalFen: payload.commissionTotalFen,
        ruleVersion: payload.ruleVersion,
      })
      .onConflictDoNothing()
      .returning({ id: schema.commissionSnapshots.id });
    commission += ins.length;

    if (quarterSnap) {
      const perfIns = await d
        .insert(schema.commissionSnapshots)
        .values({
          storeId,
          staffId: st.id,
          period: quarterSnap,
          kind: 'performance',
          payloadJson: {
            month,
            quarter: quarterSnap,
            role: payload.role,
            grade: payload.grade,
            performance: payload.performance,
          } as unknown as schema.CommissionSnapshotPayload,
          totalFen: payload.performance.payableFen,
          ruleVersion: payload.ruleVersion,
        })
        .onConflictDoNothing()
        .returning({ id: schema.commissionSnapshots.id });
      performance += perfIns.length;
    }
  }
  return { commission, performance };
}

/* ------------------------------------------------------------------ */
/* 口径小字（提成规则表 V1.3 第三节：计提时点/冲减/结算日/快照，数值读规则表） */
/* ------------------------------------------------------------------ */

function policyNote(rules: CommissionRuleSet): string {
  const settleDay = num(rules.byKey.get('settlement_day')?.day, 15);
  const snapDay = num(rules.byKey.get('snapshot_day')?.day, 1);
  const snapHour = num(rules.byKey.get('snapshot_day')?.hour, 2);
  return (
    `计提：售卡/商品=支付成功即计提，服务单=服务完成即计提；` +
    `冲减：退款/退卡对应提成当月发放中冲减，已快照月份差额进当月「调整项」，不动历史快照；` +
    `结算：次月 ${settleDay} 日随工资发放；月度快照每月 ${snapDay} 日 ${pad2(snapHour)}:00；` +
    `绩效=洗美营收 5% 额外奖励，季度考核季度发放，SABCD 五档系数。`
  );
}

/** 员工归属校验：staffId 必须是本店员工（管理端端点共用） */
async function assertStoreStaff(d: DbHandle, storeId: string, staffId: string): Promise<StaffRow> {
  const row = await d.select().from(schema.staff).where(eq(schema.staff.id, staffId)).get();
  if (!row || row.storeId !== storeId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '员工不存在或不属于本店' });
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* router                                                                */
/* ------------------------------------------------------------------ */

export const commissionRouter = router({
  /**
   * mySummary（staff · 仅本人硬过滤）：本人提成/绩效总览。
   * - month 缺省=当月：live 实时计算（源单×effective_from 规则版本）；
   * - 已快照月份：读 commission_snapshots（frozen=true，不动历史）；
   * - 未快照的过往月份：按 live 口径重算（frozen=false，差额自然含在重算中）；
   * - 附历史快照列表（新→旧）+ 口径小字（数值读 settlement_day/snapshot_day 规则行）；
   * - employeeId 不接受传参（.strict() 拒绝任何额外字段）——查不到非遮蔽。
   */
  mySummary: staffProcedure
    .input(z.object({ month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM').optional() }).strict())
    .query(async ({ ctx, input }) => {
      const staffId = ctx.user.staffId!;
      const now = new Date();
      const currentMonth = localDateStr(now).slice(0, 7);
      const month = input.month ?? currentMonth;

      const staffRow = await ctx.db
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.id, staffId))
        .get();
      if (!staffRow) throw new TRPCError({ code: 'NOT_FOUND', message: '员工记录不存在' });

      const rules = await loadCommissionRules(ctx.db);
      const snapshots = await ctx.db
        .select({
          period: schema.commissionSnapshots.period,
          kind: schema.commissionSnapshots.kind,
          totalFen: schema.commissionSnapshots.totalFen,
          ruleVersion: schema.commissionSnapshots.ruleVersion,
          createdAt: schema.commissionSnapshots.createdAt,
        })
        .from(schema.commissionSnapshots)
        .where(eq(schema.commissionSnapshots.staffId, staffId))
        .orderBy(desc(schema.commissionSnapshots.period), desc(schema.commissionSnapshots.kind))
        .limit(24);

      /* 已快照月份读快照（冻结口径）；当月/未快照月份 live 计算 */
      if (month < currentMonth) {
        const snap = await ctx.db
          .select()
          .from(schema.commissionSnapshots)
          .where(
            and(
              eq(schema.commissionSnapshots.staffId, staffId),
              eq(schema.commissionSnapshots.period, month),
              eq(schema.commissionSnapshots.kind, 'commission'),
            ),
          )
          .get();
        if (snap) {
          return {
            month,
            frozen: true,
            snapshotAt: snap.createdAt,
            ruleVersion: snap.ruleVersion,
            payload: snap.payloadJson,
            snapshots,
            policyNote: policyNote(rules),
          };
        }
      }
      const payload = await computeMonth(ctx.db, staffRow, month);
      return {
        month,
        frozen: false,
        snapshotAt: null,
        ruleVersion: payload.ruleVersion,
        payload,
        snapshots,
        policyNote: policyNote(rules),
      };
    }),

  /**
   * storePools（仅店主——店长也无下属工资眼，红线 3）：
   * 本店某季度绩效池两行聚合（美容师绩效池/前台绩效池，分列不合并），
   * 只出店级聚合，不出个人明细。storeId 缺省=本会话门店。
   */
  storePools: merchantOwnerProcedure
    .input(
      z.object({
        storeId: z.string().min(1).optional(),
        quarter: z.string().regex(QUARTER_RE, '季度格式须为 YYYY-Qn'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const storeId = input.storeId ?? ctx.user.storeId!;
      const qRange = quarterRange(input.quarter);
      const data = await loadSettledBills(ctx.db, storeId, qRange.start, qRange.end);
      // 展示率=当期末生效；金额逐源单时序解析（与 computeMonth 同口径，改率不回溯旧单）
      const { history: poolRuleHistory } = await loadRuleHistory(ctx.db);
      const perfRateBp = num(resolveFromHistory(poolRuleHistory, 'perf_base_rate', qRange.end)?.rate_bp, 500);

      let groomerBaseFen = 0; // 全店美容师操作洗美营收（门市价）
      let groomerAmountFen = 0;
      let frontdeskBaseFen = 0; // 全店前台接待归属洗美营收（门市价；receptionist_id IS NULL 硬排除）
      let frontdeskAmountFen = 0;
      let unattributedFen = 0; // 无接待人洗美营收（明示漏计量，不乱挂）
      const billById = new Map(data.bills.map((b) => [b.id, b]));
      for (const it of data.items) {
        if (!isGroomingItem(it, data.appts, data.services)) continue;
        const fen = it.unitPriceFen * it.qty;
        const bill = billById.get(it.billId)!;
        const ts = bill.settledAt ?? bill.createdAt;
        const rowAmount = Math.round(
          (fen * num(resolveFromHistory(poolRuleHistory, 'perf_base_rate', ts)?.rate_bp, 500)) / 10000,
        );
        if (it.kind === 'appointment' && data.appts.get(it.refId)?.staffId) {
          groomerBaseFen += fen;
          groomerAmountFen += rowAmount;
        }
        if (bill.receptionistId) {
          frontdeskBaseFen += fen;
          frontdeskAmountFen += rowAmount;
        } else unattributedFen += fen;
      }
      return {
        storeId,
        quarter: input.quarter,
        pools: [
          {
            pool: 'groomer',
            label: '美容师绩效池（当季操作洗美营收·门市价 ×5%）',
            baseFen: groomerBaseFen,
            rateBp: perfRateBp,
            amountFen: groomerAmountFen,
          },
          {
            pool: 'frontdesk',
            label: '前台绩效池（当季接待归属洗美营收·门市价 ×5%）',
            baseFen: frontdeskBaseFen,
            rateBp: perfRateBp,
            amountFen: frontdeskAmountFen,
          },
        ],
        unattributedFen, // 无接待人硬排除量（宁漏计不乱挂，透出供核对）
      };
    }),

  /**
   * createDeduction（店长或老板）：绩效扣减录入（必填原因留痕）。
   * 50% 硬闸门（红线 1）：当月累计扣减 > 当月绩效估计×cap（perf_deduction_cap_bp）
   * → FORBIDDEN 硬拒「已达当月扣减上限（扣减只扣绩效不扣提成）」——算不出来，不是警告。
   * 当月绩效估计=（当季适用池金额×系数）/3；季度未评级系数按 1.0（报备偏差 4）。
   */
  createDeduction: merchantManagerProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM'),
        amountFen: z.number().int('金额必须是整数（分）').positive('扣减金额必须大于 0'),
        reason: z.string().min(1, '请填写扣减原因'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const staffRow = await assertStoreStaff(ctx.db, storeId, input.staffId);

      const payload = await computeMonth(ctx.db, staffRow, input.month);
      const perf = payload.performance;
      const isGroomer = staffRow.role === 'groomer' || (staffRow.grade ?? '').startsWith('G');
      const poolAmountFen = (isGroomer ? perf.groomerPool : perf.frontdeskPool).amountFen;
      // 季度未评级 → 系数按 1.0 计（报备口径：不用 0 锁死扣减录入，上限可解释）
      const coeffBp = perf.coeffBp ?? 10000;
      const monthlyPerfEstimateFen = Math.round((poolAmountFen * coeffBp) / 10000 / 3);
      // cap 取当前生效值：扣减是当下动作（不是历史源单重算），不走回溯语义——
      // 与提成/绩效逐行时序解析的口径刻意不同，注释写死防误改
      const rules = await loadCommissionRules(ctx.db);
      const capBp = num(rules.byKey.get('perf_deduction_cap_bp')?.cap_bp, 5000);
      const capFen = Math.floor((monthlyPerfEstimateFen * capBp) / 10000);

      const existing = await ctx.db
        .select({ s: sql<number>`coalesce(sum(${schema.deductionRecords.amountFen}),0)` })
        .from(schema.deductionRecords)
        .where(
          and(
            eq(schema.deductionRecords.staffId, input.staffId),
            eq(schema.deductionRecords.month, input.month),
          ),
        );
      const usedFen = existing[0]?.s ?? 0;
      if (usedFen + input.amountFen > capFen) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '已达当月扣减上限（扣减只扣绩效不扣提成）',
        });
      }

      const row = await ctx.db
        .insert(schema.deductionRecords)
        .values({
          storeId,
          staffId: input.staffId,
          month: input.month,
          amountFen: input.amountFen,
          reason: input.reason,
          createdBy: ctx.user.id,
        })
        .returning()
        .then((r) => r[0]!);
      return { deduction: row, monthUsedFen: usedFen + input.amountFen, monthCapFen: capFen };
    }),

  /**
   * gradePerformance（老板或授权店长——merchantManagerProcedure 双角色放行，任务书 §四.B
   * 「打分人=老板或授权店长」）：季度档位录入/改档。upsert by unique(staff_id,quarter)，
   * 改档就地更新 grader_id+note+updated_at（留痕：note 记录变更说明，旧值以更新人与时间可追溯）。
   */
  gradePerformance: merchantManagerProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        quarter: z.string().regex(QUARTER_RE, '季度格式须为 YYYY-Qn'),
        grade: z.enum(['S', 'A', 'B', 'C', 'D']),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      await assertStoreStaff(ctx.db, storeId, input.staffId);
      const now = new Date();
      const existing = await ctx.db
        .select()
        .from(schema.performanceGrades)
        .where(
          and(
            eq(schema.performanceGrades.staffId, input.staffId),
            eq(schema.performanceGrades.quarter, input.quarter),
          ),
        )
        .get();
      if (existing) {
        const updated = await ctx.db
          .update(schema.performanceGrades)
          .set({ grade: input.grade, graderId: ctx.user.id, note: input.note ?? null, updatedAt: now })
          .where(eq(schema.performanceGrades.id, existing.id))
          .returning()
          .then((r) => r[0]!);
        return { grade: updated, changed: true, previousGrade: existing.grade };
      }
      const inserted = await ctx.db
        .insert(schema.performanceGrades)
        .values({
          storeId,
          staffId: input.staffId,
          quarter: input.quarter,
          grade: input.grade,
          graderId: ctx.user.id,
          note: input.note ?? null,
        })
        .returning()
        .then((r) => r[0]!);
      return { grade: inserted, changed: false, previousGrade: null };
    }),

  /**
   * approveOverwork（店长或老板）：产能红线批准留痕（任务书 §四.A 产能红线行：
   * 日超 8 只须店长批准，批准留痕）。upsert by unique(staff_id,date)——重复批准幂等。
   * 批准后提成页 live 重算自动按 1.5 倍计提超出部分（快照月份不动历史）。
   */
  approveOverwork: merchantManagerProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        date: z.string().regex(DATE_RE, '日期格式须为 YYYY-MM-DD'),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      await assertStoreStaff(ctx.db, storeId, input.staffId);
      const now = new Date();
      const existing = await ctx.db
        .select()
        .from(schema.overworkApprovals)
        .where(
          and(
            eq(schema.overworkApprovals.staffId, input.staffId),
            eq(schema.overworkApprovals.date, input.date),
          ),
        )
        .get();
      if (existing) {
        const updated = await ctx.db
          .update(schema.overworkApprovals)
          .set({ approvedBy: ctx.user.id, note: input.note ?? null, updatedAt: now })
          .where(eq(schema.overworkApprovals.id, existing.id))
          .returning()
          .then((r) => r[0]!);
        return { approval: updated, duplicated: true };
      }
      const inserted = await ctx.db
        .insert(schema.overworkApprovals)
        .values({
          storeId,
          staffId: input.staffId,
          date: input.date,
          approvedBy: ctx.user.id,
          note: input.note ?? null,
        })
        .returning()
        .then((r) => r[0]!);
      return { approval: inserted, duplicated: false };
    }),

  /**
   * reassignReception（店长或老板）：账单接待人事后纠偏。
   * 校验账单属本店、新接待人=本店员工绑定用户；变更写 reception_logs
   * （bill_id 挂账，前后值留痕）+ 更新 cashier_bills.receptionist_id；同事务。
   * 值相同→幂等返回（不写留痕）。
   */
  reassignReception: merchantManagerProcedure
    .input(
      z.object({
        billId: z.string().min(1),
        receptionistId: z.string().min(1),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const bill = await ctx.db
        .select()
        .from(schema.cashierBills)
        .where(eq(schema.cashierBills.id, input.billId))
        .get();
      if (!bill || bill.storeId !== storeId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '账单不存在或不属于本店' });
      }
      const staffRow = await ctx.db
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.userId, input.receptionistId))
        .get();
      if (!staffRow || staffRow.storeId !== storeId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '接待人须为本店员工' });
      }
      if (bill.receptionistId === input.receptionistId) {
        return { bill, changed: false };
      }
      const now = new Date();
      const updated = await ctx.db.transaction(async (tx) => {
        const t = txDb(tx);
        const row = await t
          .update(schema.cashierBills)
          .set({ receptionistId: input.receptionistId, updatedAt: now })
          .where(eq(schema.cashierBills.id, bill.id))
          .returning()
          .then((r) => r[0]!);
        await t.insert(schema.receptionLogs).values({
          billId: bill.id,
          appointmentId: null,
          oldReceptionistId: bill.receptionistId,
          newReceptionistId: input.receptionistId,
          changedBy: ctx.user.id,
          note: input.note ?? null,
        });
        return row;
      });
      return { bill: updated, changed: true };
    }),

  /**
   * snapshotMonth（仅店主；定时器共用 snapshotStoreMonth 内核）：
   * 本店每员工写 commission_snapshots kind='commission'（period=month）；
   * month 为季度末月时同写 kind='performance' 季度快照。
   * 幂等 onConflictDoNothing——补跑不动历史快照。返回写入行数。
   */
  snapshotMonth: merchantOwnerProcedure
    .input(
      z.object({
        storeId: z.string().min(1).optional(),
        month: z.string().regex(MONTH_RE, '月份格式须为 YYYY-MM'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = input.storeId ?? ctx.user.storeId!;
      const result = await snapshotStoreMonth(ctx.db, storeId, input.month);
      return { storeId, month: input.month, ...result };
    }),

  /**
   * rulesViewStaff（staff）：当前生效提成规则（label+value，只读透明）。
   * 员工端规则页用；无编辑端点（改数只能走老板端配置端口 config.save）。
   * 储值（已作废）/活体（备用）/P4（预留）等 active=0 行不透出。
   */
  rulesViewStaff: staffProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        ruleKey: schema.commissionRules.ruleKey,
        label: schema.commissionRules.label,
        valueJson: schema.commissionRules.valueJson,
        effectiveFrom: schema.commissionRules.effectiveFrom,
      })
      .from(schema.commissionRules)
      .where(eq(schema.commissionRules.active, true))
      .orderBy(schema.commissionRules.ruleKey);
    const rules = await loadCommissionRules(ctx.db);
    return { version: rules.version, rules: rows };
  }),
});

export type CommissionRouter = typeof commissionRouter;
