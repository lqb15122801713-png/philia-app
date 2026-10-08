/**
 * 规则配置管理端口 router（批次 员工端2.0 · R9-F，任务书 V1.1 §四.F + V1.3 裁定）
 *
 * 冻结口径：
 * - 仅 owner（merchantOwnerProcedure）：提成+XP 全参数读写；clerk/manager 由 procedure
 *   硬拒（FORBIDDEN，即 e2e「配置端口 clerk+manager 403」实证），本文件不做二次角色判定；
 * - 保存=版本化事务：旧 active 行失效 → 新行 active=1、version=域内当前生效最大版本+1、
 *   effective_from=now + rule_config_versions 一行（每 key 前后值留痕：谁/何时/前后值）；
 * - 保存即生效：读方（services/xpAward.ts 等）永远只读 active=1 行，无缓存可失效；
 * - 新规只管生效后的单不回溯历史：本文件不触碰 commission_snapshots / xp_events 等历史数据；
 * - 配置页只改既有参数：未知 rule_key 一律 BAD_REQUEST（不建 schema 新键）；
 * - 无删除端点（规则行只增不改历史）。
 *
 * 大批片 2 配置作用域分层（0051）：六规则表 store_id NULL=总部下发全局默认 / store_id=门店覆盖行；
 * 解析序=同 rule_key 门店行（storeId=入参店）优先于总部行，入参店 NULL/undefined=只回总部行（resolveScopedRules 单源）；
 * member_plans/copy 两域=中央件全局单份不分层（save 传 scope 一律 400；登记在卷）。
 */
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { merchantManagerProcedure, merchantOwnerProcedure, publicProcedure, router } from '../trpc';

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言，同 cashier.ts 惯例） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/* ------------------------------------------------------------------ */
/* 作用域解析（大批片 2 配置作用域分层 · 0051）：六规则表读侧统一解析序单源   */
/* ------------------------------------------------------------------ */

/**
 * 分层解析序：同 rule_key 门店行（storeId=入参店）优先于总部行（storeId IS NULL）——
 * - 入参店有值：该 key 存在本店行 → 只回本店行（总部同 key 行让位）；无本店行 → 回总部行；
 * - 入参店 NULL/undefined：只回总部行（storeId IS NULL）；
 * - 他店行一律不透出。行集内同 key 同作用域可多行（版本历史），本函数只按作用域拣选不改序。
 * 存量库全行 store_id=NULL → 解析结果与原行集等价（零回归）。
 */
export function resolveScopedRules<T extends { ruleKey: string; storeId: string | null }>(
  rows: T[],
  storeId: string | null | undefined,
): T[] {
  const storeKeys = new Set<string>();
  if (storeId) {
    for (const r of rows) {
      if (r.storeId === storeId) storeKeys.add(r.ruleKey);
    }
  }
  return rows.filter((r) => {
    if (storeId && r.storeId === storeId) return true; // 本店覆盖行优先
    if (r.storeId === null) return !storeKeys.has(r.ruleKey); // 总部行：同 key 有本店行则让位
    return false; // 他店行不透出
  });
}

/* ------------------------------------------------------------------ */
/* 域 → 表映射（commission_rules / xp_rules / duration_rules 结构相同，      */
/* 后两者注释即「结构同 commission_rules」）                                 */
/* ------------------------------------------------------------------ */

const domainSchema = z.enum(['commission', 'xp', 'duration', 'refund', 'member_plans', 'service', 'pay', 'copy']);

const RULES_TABLE = {
  commission: schema.commissionRules,
  xp: schema.xpRules,
  duration: schema.durationRules, // 补充令①：时长系数表配置化（决策 #39/#40），同型天然兼容
  refund: schema.refundRules, // R12 退款专项：退款阈值等（冻结版 V1.0 §九），同型天然兼容
  member_plans: schema.memberPlans, // R11a 会员前置批：四档价格/回馈/折扣/多宠+到账日/有效期，同型天然兼容
  service: schema.serviceRules, // 补缺大批片 4：客服服务时间公示等服务域参数，同型天然兼容
  pay: schema.payRules, // 批次 6 补缺大批：支付超时关单时长/线上通道开关，同型天然兼容
  copy: schema.copyOverrides, // 端口批片 B（CJ-1002-01）：文案端口——copy 键全表后台可改，保存即生效只管新渲染
} as const;

/* ------------------------------------------------------------------ */
/* valueJson 形状校验（按 key 族宽松校验；只校验出现的字段，未知字段放行——   */
/* 规则值结构按 key 约定演进，端口不阻断合法新字段，但不放错类型/负值越界）    */
/* ------------------------------------------------------------------ */

/** 数值字段：若出现必须是有限数字（bp=万分比 / fen=分 / xp=点） */
const NUMERIC_KEYS = new Set([
  'points',
  'cap',
  'limit',
  'threshold',
  'monthly_xp',
  'rate_bp',
  'coeff_bp',
  'multiplier_bp',
  'cap_bp',
  'day',
  'rate_bp_min',
  'rate_bp_max',
  'threshold_per_day',
  'threshold_fen', // R12 退款店长阈值（分）
  'price_fen', // R11a 会员档年费（分）
  'extra_pet_fen', // R11a 多宠附加费（分/年/只）
  'rebate_bp', // R11a 回馈金比例（bp）
  'service_discount_bp', // R11a 服务折扣（bp，10000=无折扣）
  'included_pets', // R11a 档内含宠物数
  'max_pets', // R11a 宠物数封顶
  'days', // R11a 有效期天数
  'minutes', // 批次 6 补缺大批：pay_timeout_minutes 支付超时关单时长（分钟）
  'hour',
  'level',
]);

/** 语义非负的数值字段（比例/系数/倍率/上限/门槛/保级线/日/次数/退款阈值不允许为负） */
const NON_NEGATIVE_KEYS = new Set([
  'cap',
  'limit',
  'threshold',
  'monthly_xp',
  'rate_bp',
  'coeff_bp',
  'multiplier_bp',
  'cap_bp',
  'day',
  'rate_bp_min',
  'rate_bp_max',
  'threshold_per_day',
  'threshold_fen', // R12 退款店长阈值（分）
  'price_fen', // R11a 会员档年费（分）
  'extra_pet_fen', // R11a 多宠附加费（分/年/只）
  'rebate_bp', // R11a 回馈金比例（bp）
  'service_discount_bp', // R11a 服务折扣（bp，10000=无折扣）
  'included_pets', // R11a 档内含宠物数
  'max_pets', // R11a 宠物数封顶
  'days', // R11a 有效期天数
  'minutes', // 批次 6 补缺大批：pay_timeout_minutes 支付超时关单时长（分钟）
  'hour',
  'level',
]);

/** points 允许负值的唯一键族（差评扣分 −8，扣分不扣款） */
const NEGATIVE_POINTS_KEYS = new Set(['xp_penalty_low_star']);

/** 值必须是「字符串→数值」映射的对象字段（定额分 / 师徒拆分 bp） */
const NUMBER_MAP_KEYS = new Set(['fixed_fen_by_plan', 'split_bp']);

/** 字符串字段（段位名 / 同口径引用 / 补缺大批片 4 service 域 text 公示文案） */
const STRING_KEYS = new Set(['name', 'same_as', 'text']);

/** 布尔字段（R11a 会员档：free=免费档标记，仅 true/false 放行） */
const BOOL_KEYS = new Set(['free', 'enabled']);

/** 字符串数组字段（补充令① 时长域关键词表：keywords 词表 / bath、groom 服务种类词表，须 string[]） */
const STRING_ARRAY_KEYS = new Set(['keywords', 'bath', 'groom']);

/** 嵌套数值映射字段（补充令① 时长域：species → 内层映射，内层数值须非负有限数字） */
const NESTED_NUMBER_MAP_KEYS = new Set(['dog', 'cat']);

/**
 * 校验单条规则值（宽松按 key 族）：
 * - 已知数值字段必须是有限数字（NaN/Infinity/字符串一律拒）；
 * - 比例/上限/门槛/分值等非负（points 仅 xp_penalty_low_star 允许为负）；
 * - fixed_fen_by_plan / split_bp 必须是对象且每个值都是非负有限数字；
 * - name / same_as 必须是字符串；
 * - keywords / bath / groom 必须是字符串数组（时长域关键词表，决策 #40 共用）；
 * - dog / cat 嵌套映射的内层数值必须非负有限数字（时长域物种分块）。
 * 未知字段宽松放行（结构按 key 约定演进），但不存在的 rule_key 在调用前已被拒。
 */
export function validateValueJson(ruleKey: string, value: Record<string, unknown>): void {
  const bad = (msg: string): never => {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `规则 ${ruleKey}：${msg}` });
  };
  for (const [k, v] of Object.entries(value)) {
    if (NUMERIC_KEYS.has(k)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        // 直接 throw（而非 bad() 包装）以保持 TS 控制流收窄 v → number
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `规则 ${ruleKey}：字段 ${k} 必须是有限数字`,
        });
      }
      if (k === 'points') {
        if (v < 0 && !NEGATIVE_POINTS_KEYS.has(ruleKey)) {
          bad('分值 points 不允许为负（仅差评扣分键可为负）');
        }
      } else if (NON_NEGATIVE_KEYS.has(k) && v < 0) {
        bad(`字段 ${k} 不允许为负`);
      }
    } else if (NUMBER_MAP_KEYS.has(k)) {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        bad(`字段 ${k} 必须是对象（值为非负数字）`);
      }
      for (const [mk, mv] of Object.entries(v as Record<string, unknown>)) {
        if (typeof mv !== 'number' || !Number.isFinite(mv) || mv < 0) {
          bad(`字段 ${k}.${mk} 必须是非负有限数字`);
        }
      }
    } else if (STRING_KEYS.has(k)) {
      if (typeof v !== 'string') {
        bad(`字段 ${k} 必须是字符串`);
      }
    } else if (BOOL_KEYS.has(k)) {
      if (typeof v !== 'boolean') {
        bad(`字段 ${k} 必须是布尔值（true/false）`);
      }
    } else if (STRING_ARRAY_KEYS.has(k)) {
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && x.length > 0)) {
        bad(`字段 ${k} 必须是非空字符串数组`);
      }
    } else if (NESTED_NUMBER_MAP_KEYS.has(k)) {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        bad(`字段 ${k} 必须是对象（嵌套映射，内层值为非负数字）`);
      }
      for (const [mk, mv] of Object.entries(v as Record<string, unknown>)) {
        if (typeof mv !== 'number' || !Number.isFinite(mv) || mv < 0) {
          bad(`字段 ${k}.${mk} 必须是非负有限数字`);
        }
      }
    }
  }
}

/** 规则值必须是普通对象（拒绝数组/null；空对象 {} 合法，与种子置灰行同构） */
const valueJsonSchema = z
  .record(z.unknown())
  .refine((v) => !Array.isArray(v), { message: '规则值必须是对象' });

const changeSchema = z.object({
  ruleKey: z.string().min(1, '规则键不能为空'),
  valueJson: valueJsonSchema,
  /** 可空：缺省沿用既有 label */
  label: z.string().min(1, '规则名不能为空').max(500, '规则名过长').optional(),
  /** 端口 V2（copy 域）：位置注人工改=留口件（缺省沿用既有；屏名=字典写死不可经此改） */
  position: z.string().max(500, '位置注过长').optional(),
});

/* ------------------------------------------------------------------ */
/* 文案域（copy）双闸（端口批片 B · CJ-1002-01）：高危键重确认 + 禁令词校验      */
/* ------------------------------------------------------------------ */

/**
 * 高危键前缀（涉钱/涉协议/涉会员口径，R15 域）：命中者保存须带 confirmedHighRisk 确认
 * （端口页改前重确认弹层的服务端对应闸；宁可宽列=保守口径，端口页展示同名单）。
 */
const COPY_HIGH_RISK_PREFIX = [
  'refund.', 'pay.', 'agreement.', 'rules.', 'deact.', 'up.', 'chg.', 'w1.', 'saved.',
  'perk.', 'card.', 'a3.', 'j1.', 'cashier.', 'fin.', 'pass.',
];
/** 涉钱补充判定：键名含 rebate（回馈金）一律高危（member 域 mall.rebate* 等散键兜底） */
export function isCopyHighRiskKey(ruleKey: string): boolean {
  return COPY_HIGH_RISK_PREFIX.some((p) => ruleKey.startsWith(p)) || ruleKey.includes('rebate');
}

/** 禁令词（禁令四条+红线文案 grep 词表：充值/储值/自动续费/返现/返钱/疯抢/秒杀/守护值） */
const COPY_BANNED_PATTERN = /充值|储值|自动续费|返现|返钱|疯抢|秒杀|守护值/;
/** 否定明面句豁免（「年费≠储值」「到期不自动续费」等纪律明面件不算违禁——先剥除再判定） */
const COPY_NEGATION_ALLOW = /年费\s*≠\s*储值|(非|不是|并非|≠)\s*储值|不自动续费|永不自动续费/g;
/**
 * 禁令词校验：命中即拒（返回命中词供明文提示）。否定明面句剥除后判定——
 * 如「年费 ≠ 储值 · 到期不自动续费」可保存；「充值送好礼」拒。
 */
export function copyBannedHit(text: string): string | null {
  const stripped = text.replace(COPY_NEGATION_ALLOW, '');
  const m = stripped.match(COPY_BANNED_PATTERN);
  return m ? m[0]! : null;
}
/** copy 域文案值形状：{ text: string } 且去空白非空（空文案=界面事故，硬拒） */
function copyTextOf(valueJson: Record<string, unknown>): string | null {
  const t = valueJson.text;
  return typeof t === 'string' && t.trim().length > 0 ? t : null;
}

/* ------------------------------------------------------------------ */
/* 端口批收尾片 1：涉钱键名单 / 参数字典（通用字段字典）/ kill switch / 共享应用机  */
/* ------------------------------------------------------------------ */

/**
 * 涉钱配置键名单（件 3 高危参数二级审批；宁可宽列=保守口径，登记留口候产品侧裁）：
 * member_plans（会员价费/回馈/折扣）+pay（支付通道）全域；commission 费率/定额/拆分组；
 * refund 金额阈值两键；service 现金类两键。xp/duration/copy=非涉钱直存。
 * 口径注记：直存口 config.save 不挂硬闸（护既有断言+e2e 十个 owner 直存调用点），
 * 名单内键 UI 只给「提交审批」口；审批应用口=名单内键唯一新落库通道（服务端强校验）。
 */
const MONEY_HIGH_RISK_COMMISSION_PATTERN = /^(commission_.*(rate|fixed|split|multiplier)|perf_(base_rate|coeff_).*|settlement_day|snapshot_day)$/;
export function isMoneyHighRiskKey(domain: string, ruleKey: string): boolean {
  if (domain === 'member_plans' || domain === 'pay') return true;
  if (domain === 'commission') return MONEY_HIGH_RISK_COMMISSION_PATTERN.test(ruleKey);
  if (domain === 'refund') return ruleKey === 'refund_threshold_fen' || ruleKey === 'refund_over_threshold_to_draft';
  if (domain === 'service') return ruleKey === 'cashier_cash_diff_review_thresh_fen' || ruleKey === 'shifts_opening_float_default_fen';
  return false;
}

/** 参数字典·通用字段字典（件 5 写死件：字段名→人话注；帮助注=字典合成+cfghelp copy 键覆盖留口） */
const FIELD_NOTE: Record<string, string> = {
  price_fen: '年费金额（分）', extra_pet_fen: '多宠附加费（分/年/只）', rebate_bp: '回馈金比例（万分比）',
  service_discount_bp: '服务折扣（万分比，10000=无折扣）', included_pets: '档内含宠物数（只）', max_pets: '宠物数封顶（只）',
  days: '天数', minutes: '分钟数', hours: '小时数', day: '日（每月第几日）', hour: '小时（每日第几时）',
  threshold: '阈值', threshold_fen: '金额阈值（分）', threshold_per_day: '日频次阈值', monthly_xp: '月度 XP 上限',
  rate_bp: '比率（万分比）', rate_bp_min: '比率下限（万分比）', rate_bp_max: '比率上限（万分比）',
  coeff_bp: '绩效系数（万分比）', multiplier_bp: '倍率（万分比）', cap_bp: '封顶比例（万分比）',
  points: 'XP 分值（可负=扣分）', cap: '上限', limit: '次数上限', level: '等级门槛',
  enabled: '开关（true=开/false=关）', free: '免费档标记', text: '公示文案', name: '名称',
  same_as: '同口径引用（复用他键值）', rule: '规则枚举（none=不叠加/allow=叠加）', note: '注记',
  fixed_fen_by_plan: '按档定额（分，{档键:金额}）', split_bp: '拆分比例（万分比，{角色:份额}，合计须 100%）',
  keywords: '关键词表（字符串数组）', bath: '洗护类关键词表', groom: '美容类关键词表',
  dog: '犬种映射（{体型:系数}）', cat: '猫种映射（{体型:系数}）',
  tiers: '阶梯表（按 hoursBefore 分档）', items: '清单行', categories: '类目表', tags: '标签表',
  morning: '早推送时刻（HH:MM）', evening: '晚推送时刻（HH:MM）', bp: '比例（万分比）',
  amountFen: '金额（分）', threshFen: '阈值金额（分）', validDays: '有效天数', mode: '模式枚举',
};

/** 帮助注合成（件 7：label 下一句人话注）：cfghelp.<ruleKey> copy 键覆盖优先，缺省=字段字典逐字段合成 */
function composeHelpText(
  ruleKey: string,
  valueJson: Record<string, unknown>,
  overrides: Map<string, string>,
): string {
  const ov = overrides.get(`cfghelp.${ruleKey}`);
  if (ov) return ov;
  const fields = Object.keys(valueJson ?? {});
  if (fields.length === 0) return '（空值/置灰行）';
  return fields.map((f) => `${f}=${FIELD_NOTE[f] ?? '自定义字段'}`).join('；');
}

/** cfghelp.* 覆盖注读取（copy_overrides active 行；帮助注覆盖留口数据源） */
async function loadCfgHelpOverrides(d: DbHandle): Promise<Map<string, string>> {
  const rows = await d
    .select({ ruleKey: schema.copyOverrides.ruleKey, valueJson: schema.copyOverrides.valueJson })
    .from(schema.copyOverrides)
    .where(eq(schema.copyOverrides.active, true));
  const map = new Map<string, string>();
  for (const r of rows) {
    if (!r.ruleKey.startsWith('cfghelp.')) continue;
    const t = copyTextOf(r.valueJson as Record<string, unknown>);
    if (t) map.set(r.ruleKey, t);
  }
  return map;
}

/** kill switch（件 4a）：service_rules 全局行 config_kill_switch.enabled===true=开（可关参数瞬时回落安全值） */
export async function isKillSwitchOn(d: DbHandle): Promise<boolean> {
  const rows = await d
    .select({ valueJson: schema.serviceRules.valueJson })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, 'config_kill_switch'), eq(schema.serviceRules.active, true)));
  return (rows[0]?.valueJson as Record<string, unknown> | undefined)?.enabled === true;
}

/** 字符串域→规则表（sweep/审批应用共用；copy 表多 screen/position 两列，按 commission 同型断言用） */
function rulesTableOf(domain: string): (typeof RULES_TABLE)['commission'] {
  const t = (RULES_TABLE as unknown as Record<string, (typeof RULES_TABLE)['commission']>)[domain];
  if (!t) throw new TRPCError({ code: 'BAD_REQUEST', message: `未知配置域：${domain}` });
  return t;
}

/** 键序无关的 JSON 深比较（自动回滚「当前值==回滚目标」幂等判定用） */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}
function stableJsonEq(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * 应用机（rollback/审批应用共用；定时切换/自动回滚同工艺变体在文件尾部 sweep 内）：
 * 同事务内 旧 active 行失效→新行 active=1（version=域内当前生效最大版本+1，effective_from=now，
 * createdBy=操作人）+rule_config_versions 留痕（note=工序标）。与 save 同工艺但不走 input 校验
 * （值来自库内行/已校验载荷）；不回溯快照/历史事件口径同 save。
 */
async function applyRuleValueTx(
  tx: unknown,
  input: {
    domain: string;
    ruleKey: string;
    valueJson: Record<string, unknown>;
    label?: string;
    storeId: string | null;
    changedBy: string;
    note: string;
  },
): Promise<{ version: number; before: Record<string, unknown> | null }> {
  const table = rulesTableOf(input.domain);
  const now = new Date();
  const isCentral = input.domain === 'member_plans' || input.domain === 'copy';
  const cur = await txDb(tx)
    .select({ valueJson: table.valueJson, label: table.label })
    .from(table)
    .where(and(eq(table.ruleKey, input.ruleKey), eq(table.active, true)));
  const before = (cur[0]?.valueJson as Record<string, unknown> | undefined) ?? null;
  const maxRows = await txDb(tx)
    .select({ v: sql<number>`coalesce(max(${table.version}), 0)` })
    .from(table)
    .where(eq(table.active, true));
  const nextVersion = (maxRows[0]?.v ?? 0) + 1;
  await txDb(tx)
    .update(table)
    .set({ active: false, updatedAt: now })
    .where(and(eq(table.ruleKey, input.ruleKey), eq(table.active, true)));
  /* copy 域：screen/position 沿用该键最新行（字典写死不丢归属，同 save 工艺） */
  const copyExt =
    input.domain === 'copy'
      ? (
          await txDb(tx)
            .select({ screen: schema.copyOverrides.screen, position: schema.copyOverrides.position })
            .from(schema.copyOverrides)
            .where(eq(schema.copyOverrides.ruleKey, input.ruleKey))
            .orderBy(desc(schema.copyOverrides.version))
            .limit(1)
        )[0]
      : undefined;
  await txDb(tx)
    .insert(table)
    .values({
      version: nextVersion,
      ruleKey: input.ruleKey,
      label: input.label ?? cur[0]?.label ?? input.ruleKey,
      valueJson: input.valueJson,
      effectiveFrom: now,
      active: true,
      createdBy: input.changedBy,
      ...(isCentral ? {} : { storeId: input.storeId }),
      ...(input.domain === 'copy' ? { screen: copyExt?.screen ?? null, position: copyExt?.position ?? null } : {}),
    });
  await txDb(tx)
    .insert(schema.ruleConfigVersions)
    .values({
      domain: input.domain,
      version: nextVersion,
      changedBy: input.changedBy,
      changesJson: [{ rule_key: input.ruleKey, before, after: input.valueJson, note: input.note }],
    });
  return { version: nextVersion, before };
}

/* ------------------------------------------------------------------ */
/* router：merchantOwnerProcedure 为主（clerk/manager → FORBIDDEN 硬拒）；     */
/* 例外=configApprovalReview=merchantManagerProcedure（件 3：owner/manager 皆可复核） */
/* ------------------------------------------------------------------ */

export const configRulesRouter = router({
  /**
   * list：某域全量规则行（active 在前、同 key 版本新→旧，inactive 历史行一并返回供配置页展示留痕），
   * 附当前生效版本号（active 行最大 version）与每行创建/变更人昵称（join users）。
   */
  list: merchantOwnerProcedure
    .input(z.object({ domain: domainSchema }))
    .query(async ({ ctx, input }) => {
      const table = RULES_TABLE[input.domain];
      const rows = await ctx.db
        .select({
          id: table.id,
          version: table.version,
          ruleKey: table.ruleKey,
          label: table.label,
          valueJson: table.valueJson,
          effectiveFrom: table.effectiveFrom,
          active: table.active,
          createdBy: table.createdBy,
          creatorNickname: schema.users.nickname,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
        })
        .from(table)
        .leftJoin(schema.users, eq(schema.users.id, table.createdBy))
        .orderBy(desc(table.active), asc(table.ruleKey), desc(table.version));

      let currentVersion = 0;
      for (const r of rows) {
        if (r.active && r.version > currentVersion) currentVersion = r.version;
      }
      /* 大批片 2 分层（六规则域 · 0051）：行原样透出 storeId（NULL=总部下发 / 店 id=门店覆盖）。
         RULES_TABLE 并集含 member_plans/copy（中央件无此列），同 screen/position 工艺单列查询并图 */
      let storeIdById = new Map<string, string | null>();
      if (input.domain !== 'member_plans' && input.domain !== 'copy') {
        const lt = table as unknown as typeof schema.commissionRules; // 六规则表同型（store_id 列同名）
        const ext = await ctx.db.select({ id: lt.id, storeId: lt.storeId }).from(lt);
        storeIdById = new Map(ext.map((x) => [x.id, x.storeId]));
      }
      /* 端口 V2（copy 域）：屏名+位置注透出（第二查按 id 并图；RULES_TABLE 并集类型无
         screen/position 列，故 copy 域单列查询不塞进主 select）；其他域不透出（undefined）
         OP-03 P3-2：defaultText=v1 种子原文透出（端口列表「码内默认 vs 当前生效」双列数据源） */
      let metaByKey = new Map<string, { screen: string | null; position: string | null }>();
      let defaultTextByKey = new Map<string, string>();
      if (input.domain === 'copy') {
        const ext = await ctx.db
          .select({ ruleKey: schema.copyOverrides.ruleKey, screen: schema.copyOverrides.screen, position: schema.copyOverrides.position })
          .from(schema.copyOverrides)
          .where(eq(schema.copyOverrides.active, true));
        metaByKey = new Map(ext.map((x) => [x.ruleKey, { screen: x.screen, position: x.position }]));
        const v1Rows = await ctx.db
          .select({ ruleKey: schema.copyOverrides.ruleKey, valueJson: schema.copyOverrides.valueJson })
          .from(schema.copyOverrides)
          .where(eq(schema.copyOverrides.version, 1));
        defaultTextByKey = new Map(
          v1Rows
            .map((x) => ({ key: x.ruleKey, text: copyTextOf(x.valueJson as Record<string, unknown>) }))
            .filter((x): x is { key: string; text: string } => x.text !== null)
            .map((x) => [x.key, x.text]),
        );
      }
      /* 端口批收尾片 1：待生效徽（config_scheduled pending 目标行）+涉钱键名单标+帮助注
         （参数字典合成，cfghelp.* copy 键覆盖留口；copy 域本页自管不附） */
      const pendSched = await ctx.db
        .select({ id: schema.configScheduled.id, rowId: schema.configScheduled.rowId, effectiveAt: schema.configScheduled.effectiveAt })
        .from(schema.configScheduled)
        .where(and(eq(schema.configScheduled.domain, input.domain), eq(schema.configScheduled.status, 'pending')));
      const schedByRowId = new Map(pendSched.map((x) => [x.rowId, { id: x.id, effectiveAt: x.effectiveAt }]));
      const helpOverrides = input.domain === 'copy' ? new Map<string, string>() : await loadCfgHelpOverrides(ctx.db);
      /* 端口批片 B：copy 域行附高危标记（涉钱/涉协议/涉会员口径）——端口页改前重确认弹层用；
         其他域恒 false（加字段不改形状） */
      return {
        domain: input.domain,
        currentVersion,
        rules: rows.map((r) => ({
          ...r,
          highRisk: input.domain === 'copy' && isCopyHighRiskKey(r.ruleKey),
          storeId: input.domain !== 'member_plans' && input.domain !== 'copy' ? (storeIdById.get(r.id) ?? null) : undefined,
          screen: input.domain === 'copy' ? (metaByKey.get(r.ruleKey)?.screen ?? null) : undefined,
          position: input.domain === 'copy' ? (metaByKey.get(r.ruleKey)?.position ?? null) : undefined,
          scheduledPending: schedByRowId.has(r.id),
          scheduledId: schedByRowId.get(r.id)?.id ?? null,
          scheduledEffectiveAt: schedByRowId.get(r.id)?.effectiveAt ?? null,
          moneyHighRisk: isMoneyHighRiskKey(input.domain, r.ruleKey),
          helpText: input.domain === 'copy' ? undefined : composeHelpText(r.ruleKey, r.valueJson as Record<string, unknown>, helpOverrides),
          defaultText: input.domain === 'copy' ? (defaultTextByKey.get(r.ruleKey) ?? null) : undefined,
        })),
      };
    }),

  /**
   * activeCopyTexts（public，端口批片 B）：文案端口客户端读口——copy_overrides 全量 active 行
   * 透出 {key,text}（读取顺序=端口值→码内默认 fallback 在客户端覆盖层；码内不存在的键=只读
   * 提示不拦截=本读口照常透出、客户端永不命中即零副作用）。保存即生效=只管新渲染。
   */
  activeCopyTexts: publicProcedure.query(async ({ ctx }) => {
    const table = RULES_TABLE.copy;
    const rows = await ctx.db
      .select({ ruleKey: table.ruleKey, valueJson: table.valueJson })
      .from(table)
      .where(eq(table.active, true));
    return {
      rows: rows
        .map((r) => ({ key: r.ruleKey, text: copyTextOf(r.valueJson as Record<string, unknown>) }))
        .filter((r): r is { key: string; text: string } => r.text !== null),
    };
  }),

  /**
   * save：保存即生效（版本化事务）——
   * 1. 校验：changes 非空去重；rule_key 必须已存在于该域种子宇宙（只改既有参数，未知键 BAD_REQUEST 并点名）；
   *    valueJson 按 key 族宽松形状校验（有限数字/非负/映射对象）；
   * 2. 事务：逐 key 旧 active 行失效（active=false）→ 插新行（version=域内当前生效最大版本+1，
   *    effectiveFrom=now，active=true，label 缺省沿用既有 label，createdBy=操作人）；
   * 3. 同事务插一条 rule_config_versions（domain/version/changedBy/changesJson 每 key 前后值）；
   * 4. 同事务 emitEvent store 频道 config.versionSaved {domain, version, keys}；
   * 5. 不触碰快照/历史事件：新规只管生效后的单，不回溯。
   */
  save: merchantOwnerProcedure
    .input(
      z.object({
        domain: domainSchema,
        changes: z.array(changeSchema).min(1, '变更不能为空'),
        /* 文案域高危键重确认（端口页弹层确认后回传命中键名单；非 copy 域忽略） */
        confirmedHighRisk: z.array(z.string()).optional(),
        /* 大批片 2 配置作用域分层（0051）：store=门店覆盖（缺省，新行 store_id=本店）/
           hq=总部下发（新行 store_id=NULL，仅 merchant_owner）；member_plans/copy 两域
           =中央件全局单份不分层，传本参一律 400 */
        scope: z.enum(['store', 'hq']).optional(),
        /* 端口批收尾片 1（定时生效/定时切换）：ISO 时刻串；晚于当前=定时件（新行 active=0 待生效
           + config_scheduled 登记，到点懒切换），缺省/不晚于当前=保存即生效冻结口径不变 */
        effectiveAt: z.string().max(64, '生效时点串过长').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      /* 定时件预检（进事务前）：串可解析才放行；晚不晚于当前在事务内按 now 判（钉时刻口径） */
      const effAtParsed = input.effectiveAt === undefined ? null : new Date(input.effectiveAt);
      if (input.effectiveAt !== undefined && (effAtParsed === null || !Number.isFinite(effAtParsed.getTime()))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '定时生效时点格式非法（须 ISO 时刻串）' });
      }
      /* 去重：同一 key 一次保存只允许一条 */
      const seen = new Set<string>();
      for (const c of input.changes) {
        if (seen.has(c.ruleKey)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `同一规则键重复提交：${c.ruleKey}`,
          });
        }
        seen.add(c.ruleKey);
      }
      /* 形状校验（纯 CPU，进事务前先拒，不产生半事务） */
      for (const c of input.changes) {
        validateValueJson(c.ruleKey, c.valueJson);
      }
      /* 大批片 2 分层闸（进事务前硬拒）：member_plans/copy=中央件全局单份不分层（传 scope 即 400）；
         scope='hq' 改总部下发=仅 merchant_owner（非 owner 403 明文） */
      const isCentralDomain = input.domain === 'member_plans' || input.domain === 'copy';
      if (isCentralDomain && input.scope !== undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '该域=中央件全局单份不分层' });
      }
      const scope = input.scope ?? 'store';
      if (scope === 'hq' && !ctx.user.roles.includes('merchant_owner')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '总部下发仅店主' });
      }
      /* 文案域双闸（端口批片 B，进事务前硬拒）：
         1. 值形状={text:非空文案}；2. 禁令词校验（命中即拒明文）；3. 高危键须重确认。
         片 C 顺带件③（产品侧自纠口径）：禁令词闸限对外域（customer 12 域+member）——
         merchant:/staff: 域（label 前缀）豁免（内部操作面术语非对外文案）；高危重确认全端保留 */
      if (input.domain === 'copy') {
        const confirmed = new Set(input.confirmedHighRisk ?? []);
        const tableForLabel = RULES_TABLE.copy;
        const labelRows = await ctx.db
          .select({ ruleKey: tableForLabel.ruleKey, label: tableForLabel.label })
          .from(tableForLabel)
          .where(inArray(tableForLabel.ruleKey, input.changes.map((c) => c.ruleKey)));
        const domainByKey = new Map(labelRows.map((r) => [r.ruleKey, r.label]));
        /** 对外域=非 merchant:/staff: 前缀（customer 12 域+member；未知键=null 照闸=保守） */
        const isExternalKey = (key: string) => {
          const d = domainByKey.get(key);
          return d === undefined || (!d.startsWith('merchant:') && !d.startsWith('staff:'));
        };
        for (const c of input.changes) {
          const text = copyTextOf(c.valueJson);
          if (text === null) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `文案键 ${c.ruleKey} 的值必须是 { text: 非空文案 }` });
          }
          if (isExternalKey(c.ruleKey)) {
            const hit = copyBannedHit(text);
            if (hit) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `文案含禁令词「${hit}」（禁令四条红线：禁充值入口/年费≠储值文案/禁提自动续费/禁诱导词）——请改写后再保存`,
              });
            }
          }
          if (isCopyHighRiskKey(c.ruleKey) && !confirmed.has(c.ruleKey)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `「${c.ruleKey}」属涉钱/涉协议/涉会员口径高危键，请在端口页完成重确认后再保存`,
            });
          }
        }
      }

      const table = RULES_TABLE[input.domain];
      const storeId = ctx.user.storeId!; // merchantOwnerProcedure 已硬保证 storeId 存在

      return ctx.db.transaction(async (tx) => {
        const now = new Date();
        /* 定时生效闸（事务内钉 now）：effectiveAt 必须晚于当前，否则按 BAD_REQUEST 拒（不静默降级为直存） */
        const scheduled = effAtParsed !== null && effAtParsed.getTime() > now.getTime();
        if (effAtParsed !== null && !scheduled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '定时生效时点须晚于当前时刻（保存即生效请不传 effectiveAt）' });
        }

        /* 该域全量行：种子宇宙校验 + 既有 label / 旧值（前后值留痕）一并取齐 */
        const existing = await txDb(tx)
          .select({
            ruleKey: table.ruleKey,
            label: table.label,
            valueJson: table.valueJson,
            active: table.active,
            version: table.version,
          })
          .from(table);
        const universe = new Set(existing.map((r) => r.ruleKey));
        for (const c of input.changes) {
          if (!universe.has(c.ruleKey)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `未知规则键：${c.ruleKey}（配置页仅支持修改既有参数，不能新增键）`,
            });
          }
        }
        /* 端口 V2（copy 域）：screen/position 沿用源=该键最新行（save 改文案不丢屏归属；
           position=留口件可随本次 change 显式改） */
        const copyMetaByKey = new Map<string, { screen: string | null; position: string | null }>();
        if (input.domain === 'copy') {
          const ext = await txDb(tx)
            .select({ ruleKey: schema.copyOverrides.ruleKey, screen: schema.copyOverrides.screen, position: schema.copyOverrides.position, version: schema.copyOverrides.version })
            .from(schema.copyOverrides)
            .where(eq(schema.copyOverrides.active, true));
          for (const x of ext) copyMetaByKey.set(x.ruleKey, { screen: x.screen, position: x.position });
        }
        /* 每 key 当前生效行（旧值来源）与最近 label（含置灰行：取版本最大者） */
        const activeByKey = new Map<string, Record<string, unknown>>();
        const latestLabelByKey = new Map<string, { version: number; label: string }>();
        for (const r of existing) {
          if (r.active) activeByKey.set(r.ruleKey, r.valueJson);
          const cur = latestLabelByKey.get(r.ruleKey);
          if (!cur || r.version > cur.version) {
            latestLabelByKey.set(r.ruleKey, { version: r.version, label: r.label });
          }
        }

        /* 域内当前生效最大版本 + 1（与 xpAward.loadXpRules 的版本口径一致） */
        const maxRows = await txDb(tx)
          .select({ v: sql<number>`coalesce(max(${table.version}), 0)` })
          .from(table)
          .where(eq(table.active, true));
        const nextVersion = (maxRows[0]?.v ?? 0) + 1;

        const changesJson: schema.RuleConfigChanges = [];
        const keys: string[] = [];
        for (const c of input.changes) {
          const before = activeByKey.get(c.ruleKey) ?? null;
          /* 端口批收尾片 1 · 定时生效（effectiveAt 晚于当前）：旧 active 行不动（读方单行口径
             零回归），新行 active=0+effectiveFrom=生效时点+config_scheduled 登记 pending；
             同 key 既有 pending 件=superseded 顶替（只增不改状态机） */
          if (scheduled && effAtParsed !== null) {
            await txDb(tx)
              .update(schema.configScheduled)
              .set({ status: 'superseded', updatedAt: now })
              .where(and(
                eq(schema.configScheduled.domain, input.domain),
                eq(schema.configScheduled.ruleKey, c.ruleKey),
                eq(schema.configScheduled.status, 'pending'),
              ));
            const copyMeta = copyMetaByKey.get(c.ruleKey);
            const [ins] = await txDb(tx)
              .insert(table)
              .values({
                version: nextVersion,
                ruleKey: c.ruleKey,
                label: c.label ?? latestLabelByKey.get(c.ruleKey)?.label ?? c.ruleKey,
                valueJson: c.valueJson,
                effectiveFrom: effAtParsed,
                active: false,
                createdBy: ctx.user.id,
                ...(isCentralDomain ? {} : { storeId: scope === 'hq' ? null : storeId }),
                ...(input.domain === 'copy'
                  ? { screen: copyMeta?.screen ?? null, position: c.position ?? copyMeta?.position ?? null }
                  : {}),
              })
              .returning({ id: table.id });
            await txDb(tx).insert(schema.configScheduled).values({
              domain: input.domain,
              ruleKey: c.ruleKey,
              rowId: ins!.id,
              effectiveAt: effAtParsed,
              status: 'pending',
              createdBy: ctx.user.id,
            });
            changesJson.push({ rule_key: c.ruleKey, before, after: c.valueJson, note: `scheduled:${effAtParsed.toISOString()}` });
            keys.push(c.ruleKey);
            continue;
          }
          /* 旧 active 行失效（仅当前生效行；历史 inactive 行不动） */
          await txDb(tx)
            .update(table)
            .set({ active: false, updatedAt: now })
            .where(and(eq(table.ruleKey, c.ruleKey), eq(table.active, true)));
          /* 新行：version+1 / effective_from=now / active=1 / createdBy=操作人；
             端口 V2（copy 域）：screen 沿用最新行（字典写死不丢归属）；position=change 显式值优先、缺省沿用 */
          const copyMeta = copyMetaByKey.get(c.ruleKey);
          await txDb(tx)
            .insert(table)
            .values({
              version: nextVersion,
              ruleKey: c.ruleKey,
              label: c.label ?? latestLabelByKey.get(c.ruleKey)?.label ?? c.ruleKey,
              valueJson: c.valueJson,
              effectiveFrom: now,
              active: true,
              createdBy: ctx.user.id,
              /* 大批片 2 分层：六规则域新行落 store_id（hq=NULL=总部下发 / store=本店覆盖）；
                 中央件两域无此列不铺；旧 active 行失效/版本/留痕逻辑随既有口径不动 */
              ...(isCentralDomain ? {} : { storeId: scope === 'hq' ? null : storeId }),
              ...(input.domain === 'copy'
                ? { screen: copyMeta?.screen ?? null, position: c.position ?? copyMeta?.position ?? null }
                : {}),
            });
          changesJson.push({ rule_key: c.ruleKey, before, after: c.valueJson });
          keys.push(c.ruleKey);
        }

        /* 留痕：一条版本行（谁/何时/前后值） */
        await txDb(tx)
          .insert(schema.ruleConfigVersions)
          .values({
            domain: input.domain,
            version: nextVersion,
            changedBy: ctx.user.id,
            changesJson,
          });

        const outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.ConfigVersionSaved, {
          domain: input.domain,
          version: nextVersion,
          keys,
        });

        return { domain: input.domain, version: nextVersion, keys, savedAt: now, outboxId, scheduled, effectiveAt: scheduled ? effAtParsed : null };
      });
    }),

  /**
   * rollback（片 1 · 件 1 配置回滚）：回滚到任一旧版本——目标版本整行恢复 active
   * （新行 version=域 max+1、effective_from=now、createdBy=操作人；旧 active 行失效）+
   * rule_config_versions 留痕（note=rollback:vA→vB）。回滚≠改历史：历史行一律不动（只增不改）。
   */
  rollback: merchantOwnerProcedure
    .input(
      z.object({
        domain: domainSchema,
        ruleKey: z.string().min(1, '规则键不能为空'),
        toVersion: z.number().int('版本号必须是整数').min(1, '版本号必须 ≥1'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = RULES_TABLE[input.domain];
      const target = (
        await ctx.db
          .select({ version: table.version, label: table.label, valueJson: table.valueJson, active: table.active })
          .from(table)
          .where(and(eq(table.ruleKey, input.ruleKey), eq(table.version, input.toVersion)))
          .limit(1)
      )[0];
      if (!target) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `目标版本不存在：${input.ruleKey} v${input.toVersion}` });
      }
      const isCentral = input.domain === 'member_plans' || input.domain === 'copy';
      const lt = table as unknown as typeof schema.commissionRules;
      const curActive = isCentral
        ? (
            await ctx.db
              .select({ version: table.version, valueJson: table.valueJson })
              .from(table)
              .where(and(eq(table.ruleKey, input.ruleKey), eq(table.active, true)))
              .limit(1)
          )[0]
        : (
            await ctx.db
              .select({ version: lt.version, valueJson: lt.valueJson, storeId: lt.storeId })
              .from(lt)
              .where(and(eq(lt.ruleKey, input.ruleKey), eq(lt.active, true)))
              .limit(1)
          )[0];
      if (curActive && curActive.version === input.toVersion) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '目标版本即当前生效版，无需回滚' });
      }
      if (curActive && stableJsonEq(curActive.valueJson, target.valueJson)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '目标版本值与当前生效值一致，无需回滚' });
      }
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const r = await applyRuleValueTx(tx, {
          domain: input.domain,
          ruleKey: input.ruleKey,
          valueJson: target.valueJson as Record<string, unknown>,
          label: target.label,
          storeId: isCentral ? null : ((curActive as { storeId?: string | null } | undefined)?.storeId ?? storeId),
          changedBy: ctx.user.id,
          note: `rollback:v${curActive?.version ?? 0}→v${input.toVersion}`,
        });
        const outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.ConfigVersionSaved, {
          domain: input.domain,
          version: r.version,
          keys: [input.ruleKey],
        });
        return { domain: input.domain, ruleKey: input.ruleKey, version: r.version, rolledBackTo: input.toVersion, outboxId };
      });
    }),

  /**
   * cancelScheduled（片 1 · 件 2 定时生效配套）：撤销待生效件（pending→superseded，
   * 只增不改状态机；目标规则行留 active=0 作历史行不动）。
   */
  cancelScheduled: merchantOwnerProcedure
    .input(z.object({ id: z.string().min(1, '登记 id 不能为空') }))
    .mutation(async ({ ctx, input }) => {
      const row = (
        await ctx.db.select().from(schema.configScheduled).where(eq(schema.configScheduled.id, input.id)).limit(1)
      )[0];
      if (!row || row.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '待生效件不存在或已处理' });
      }
      await ctx.db
        .update(schema.configScheduled)
        .set({ status: 'superseded', updatedAt: new Date() })
        .where(eq(schema.configScheduled.id, row.id));
      return { id: row.id, cancelled: true };
    }),

  /**
   * proposeChange（片 1 · 件 3 涉钱配置二级审批·发起）：仅受理涉钱键名单内变更
   * （名单外键 400 明文引去直存口）；落 config_change_proposals（载荷单据表）+
   * approval_requests kind='config'（不新建审批表），值不落库待复核。
   */
  proposeChange: merchantOwnerProcedure
    .input(
      z.object({
        domain: domainSchema,
        changes: z.array(changeSchema.omit({ position: true })).min(1, '变更不能为空'),
        scope: z.enum(['store', 'hq']).optional(),
        note: z.string().max(500, '附言过长').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const seen = new Set<string>();
      for (const c of input.changes) {
        if (seen.has(c.ruleKey)) throw new TRPCError({ code: 'BAD_REQUEST', message: `同一规则键重复提交：${c.ruleKey}` });
        seen.add(c.ruleKey);
        if (!isMoneyHighRiskKey(input.domain, c.ruleKey)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `「${c.ruleKey}」非涉钱键名单内键，请走保存即生效直存（二级审批=涉钱配置专用通道）`,
          });
        }
        validateValueJson(c.ruleKey, c.valueJson);
      }
      const isCentralDomain = input.domain === 'member_plans' || input.domain === 'copy';
      if (isCentralDomain && input.scope !== undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '该域=中央件全局单份不分层' });
      }
      if (input.scope === 'hq' && !ctx.user.roles.includes('merchant_owner')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '总部下发仅店主' });
      }
      const table = RULES_TABLE[input.domain];
      const existing = await ctx.db.select({ ruleKey: table.ruleKey }).from(table);
      const universe = new Set(existing.map((r) => r.ruleKey));
      for (const c of input.changes) {
        if (!universe.has(c.ruleKey)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `未知规则键：${c.ruleKey}（仅支持修改既有参数）` });
        }
      }
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const [proposal] = await txDb(tx)
          .insert(schema.configChangeProposals)
          .values({
            storeId,
            domain: input.domain,
            scope: isCentralDomain ? null : (input.scope ?? 'store'),
            changesJson: input.changes.map((c) => ({
              ruleKey: c.ruleKey,
              valueJson: c.valueJson,
              ...(c.label ? { label: c.label } : {}),
            })),
            note: input.note ?? null,
            status: 'pending',
            proposerId: ctx.user.id,
          })
          .returning({ id: schema.configChangeProposals.id });
        const summary = `配置变更审批：${input.domain} · ${input.changes.map((c) => c.ruleKey).join('、')}`;
        const [req] = await txDb(tx)
          .insert(schema.approvalRequests)
          .values({
            storeId,
            kind: 'config',
            refId: proposal!.id,
            summary,
            status: 'pending',
            applicantId: ctx.user.id,
            timelineJson: [{ at: new Date().toISOString(), action: 'submitted', by: ctx.user.id }],
          })
          .returning({ id: schema.approvalRequests.id });
        return { proposalId: proposal!.id, requestId: req!.id, summary };
      });
    }),

  /**
   * configApprovals（片 1 · 件 3 队列查询）：本店 kind='config' 审批单+载荷（proposer/reviewer 昵称），
   * 按创建新→旧，limit ≤50。
   */
  configApprovals: merchantOwnerProcedure
    .input(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }))
    .query(async ({ ctx, input }) => {
      const conds = [
        eq(schema.approvalRequests.storeId, ctx.user.storeId!),
        eq(schema.approvalRequests.kind, 'config'),
      ];
      if (input.status) conds.push(eq(schema.approvalRequests.status, input.status));
      const rows = await ctx.db
        .select({
          id: schema.approvalRequests.id,
          status: schema.approvalRequests.status,
          summary: schema.approvalRequests.summary,
          reviewNote: schema.approvalRequests.reviewNote,
          reviewedAt: schema.approvalRequests.reviewedAt,
          timelineJson: schema.approvalRequests.timelineJson,
          createdAt: schema.approvalRequests.createdAt,
          proposerNickname: schema.users.nickname,
          domain: schema.configChangeProposals.domain,
          scope: schema.configChangeProposals.scope,
          changesJson: schema.configChangeProposals.changesJson,
          note: schema.configChangeProposals.note,
        })
        .from(schema.approvalRequests)
        .innerJoin(schema.configChangeProposals, eq(schema.configChangeProposals.id, schema.approvalRequests.refId))
        .leftJoin(schema.users, eq(schema.users.id, schema.approvalRequests.applicantId))
        .where(and(...conds))
        .orderBy(desc(schema.approvalRequests.createdAt))
        .limit(50);
      return { items: rows };
    }),

  /**
   * configApprovalReview（片 1 · 件 3 复核口；merchantManagerProcedure=owner/manager 皆可复核）：
   * 通过=同事务应用载荷（再校验防漂移+版本化+rule_config_versions note=approved-apply，
   * changedBy=原发起人；复核人落 approval_requests.reviewerId）+载荷单 applied；
   * 驳回=审批单+载荷单双 rejected，值不落库。timeline 只增不改。
   */
  configApprovalReview: merchantManagerProcedure
    .input(
      z.object({
        requestId: z.string().min(1, '审批单 id 不能为空'),
        approve: z.boolean(),
        note: z.string().max(500, '复核附言过长').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const req = (
          await txDb(tx).select().from(schema.approvalRequests).where(eq(schema.approvalRequests.id, input.requestId)).limit(1)
        )[0];
        if (!req || req.storeId !== storeId || req.kind !== 'config') {
          throw new TRPCError({ code: 'NOT_FOUND', message: '审批单不存在' });
        }
        if (req.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该审批已处理，不可重复审批' });
        }
        const now = new Date();
        const timeline = [
          ...req.timelineJson,
          {
            at: now.toISOString(),
            action: input.approve ? 'approved' : 'rejected',
            by: ctx.user.id,
            ...(input.note ? { note: input.note } : {}),
          },
        ];
        await txDb(tx)
          .update(schema.approvalRequests)
          .set({
            status: input.approve ? 'approved' : 'rejected',
            reviewerId: ctx.user.id,
            reviewNote: input.note ?? null,
            reviewedAt: now,
            timelineJson: timeline,
            updatedAt: now,
          })
          .where(eq(schema.approvalRequests.id, req.id));
        const proposal = (
          await txDb(tx)
            .select()
            .from(schema.configChangeProposals)
            .where(eq(schema.configChangeProposals.id, req.refId))
            .limit(1)
        )[0];
        if (!proposal) throw new TRPCError({ code: 'NOT_FOUND', message: '审批载荷单不存在' });
        if (!input.approve) {
          await txDb(tx)
            .update(schema.configChangeProposals)
            .set({ status: 'rejected', updatedAt: now })
            .where(eq(schema.configChangeProposals.id, proposal.id));
          return { requestId: req.id, approved: false };
        }
        /* 通过=同事务应用（值再校验防存货漂移；涉钱名单复核——载荷必须全在名单内） */
        const table = rulesTableOf(proposal.domain);
        const existing = await txDb(tx).select({ ruleKey: table.ruleKey }).from(table);
        const universe = new Set(existing.map((r) => r.ruleKey));
        const appliedKeys: string[] = [];
        let lastVersion = 0;
        for (const c of proposal.changesJson) {
          if (!universe.has(c.ruleKey)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `载荷键已不在规则宇宙：${c.ruleKey}` });
          }
          if (!isMoneyHighRiskKey(proposal.domain, c.ruleKey)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `载荷键非涉钱名单内键：${c.ruleKey}` });
          }
          validateValueJson(c.ruleKey, c.valueJson);
          const r = await applyRuleValueTx(tx, {
            domain: proposal.domain,
            ruleKey: c.ruleKey,
            valueJson: c.valueJson,
            label: c.label,
            storeId:
              proposal.domain === 'member_plans' || proposal.domain === 'copy'
                ? null
                : proposal.scope === 'hq'
                  ? null
                  : proposal.storeId,
            changedBy: proposal.proposerId,
            note: 'approved-apply',
          });
          lastVersion = r.version;
          appliedKeys.push(c.ruleKey);
        }
        await txDb(tx)
          .update(schema.configChangeProposals)
          .set({ status: 'applied', appliedAt: now, updatedAt: now })
          .where(eq(schema.configChangeProposals.id, proposal.id));
        const outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.ConfigVersionSaved, {
          domain: proposal.domain,
          version: lastVersion,
          keys: appliedKeys,
        });
        return { requestId: req.id, approved: true, version: lastVersion, keys: appliedKeys, outboxId };
      });
    }),

  /**
   * setKillSwitch（片 1 · 件 4a 全局一键开关）：service_rules 全局行 config_kill_switch
   * 版本化切换（留痕 note=kill-switch；store_id=NULL=全局单份）；开=全部可关参数瞬时回落
   * 安全值（v1=pay_channel_enabled 线上通道关，页面显著红态=ConsolePage kill 横幅）。
   */
  setKillSwitch: merchantOwnerProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      return ctx.db.transaction(async (tx) => {
        const r = await applyRuleValueTx(tx, {
          domain: 'service',
          ruleKey: 'config_kill_switch',
          valueJson: { enabled: input.enabled },
          storeId: null,
          changedBy: ctx.user.id,
          note: 'kill-switch',
        });
        const outboxId = await emitEvent(txDb(tx), `store:${storeId}`, EventType.ConfigVersionSaved, {
          domain: 'service',
          version: r.version,
          keys: ['config_kill_switch'],
        });
        return { enabled: input.enabled, version: r.version, outboxId };
      });
    }),

  /** killStatus（片 1 · 件 4a 页面显著态数据源）：开关态+最后切换时刻/操作人昵称 */
  killStatus: merchantOwnerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        valueJson: schema.serviceRules.valueJson,
        updatedAt: schema.serviceRules.updatedAt,
        nickname: schema.users.nickname,
      })
      .from(schema.serviceRules)
      .leftJoin(schema.users, eq(schema.users.id, schema.serviceRules.createdBy))
      .where(and(eq(schema.serviceRules.ruleKey, 'config_kill_switch'), eq(schema.serviceRules.active, true)))
      .limit(1);
    const row = rows[0];
    return {
      enabled: (row?.valueJson as Record<string, unknown> | undefined)?.enabled === true,
      updatedAt: row?.updatedAt ?? null,
      by: row?.nickname ?? null,
    };
  }),

  /**
   * dictionary（片 1 · 件 5+7 参数字典/逐参数帮助）：参数域（copy 域除外）逐键透出
   * 最新行 label+字段字典注+帮助注（cfghelp.* 覆盖优先）+涉钱名单标+当前生效版本；q=键/名/注 contains 过滤。
   */
  dictionary: merchantOwnerProcedure
    .input(z.object({ domain: domainSchema.optional(), q: z.string().max(100, '搜索串过长').optional() }))
    .query(async ({ ctx, input }) => {
      const domains = input.domain ? [input.domain] : (Object.keys(RULES_TABLE) as Array<z.infer<typeof domainSchema>>);
      const overrides = await loadCfgHelpOverrides(ctx.db);
      const q = input.q?.trim().toLowerCase() || null;
      const items: Array<{
        domain: string;
        ruleKey: string;
        label: string;
        fields: Array<{ field: string; note: string }>;
        helpText: string;
        moneyHighRisk: boolean;
        currentVersion: number | null;
      }> = [];
      for (const d of domains) {
        if (d === 'copy') continue; // 文案域=文案端口页自管，字典只收参数域
        const table = RULES_TABLE[d];
        const rows = await ctx.db
          .select({ ruleKey: table.ruleKey, label: table.label, valueJson: table.valueJson, version: table.version, active: table.active })
          .from(table);
        const latest = new Map<string, { label: string; valueJson: Record<string, unknown>; version: number }>();
        const activeVersion = new Map<string, number>();
        for (const r of rows) {
          const cur = latest.get(r.ruleKey);
          if (!cur || r.version > cur.version) {
            latest.set(r.ruleKey, { label: r.label, valueJson: r.valueJson as Record<string, unknown>, version: r.version });
          }
          if (r.active) activeVersion.set(r.ruleKey, r.version);
        }
        for (const [ruleKey, meta] of latest) {
          const fields = Object.keys(meta.valueJson ?? {}).map((f) => ({ field: f, note: FIELD_NOTE[f] ?? '自定义字段' }));
          items.push({
            domain: d,
            ruleKey,
            label: meta.label,
            fields,
            helpText: composeHelpText(ruleKey, meta.valueJson, overrides),
            moneyHighRisk: isMoneyHighRiskKey(d, ruleKey),
            currentVersion: activeVersion.get(ruleKey) ?? null,
          });
        }
      }
      const filtered = q
        ? items.filter(
            (it) =>
              it.ruleKey.toLowerCase().includes(q) ||
              it.label.toLowerCase().includes(q) ||
              it.helpText.toLowerCase().includes(q),
          )
        : items;
      return { items: filtered };
    }),

  /**
   * versions：版本留痕审计（谁/何时/前后值）——rule_config_versions 按版本新→旧，
   * 附变更人昵称（join users）；limit ≤50。
   */
  versions: merchantOwnerProcedure
    .input(
      z.object({
        domain: domainSchema,
        limit: z.number().int('条数必须是整数').min(1).max(50, '单次最多查 50 条').default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: schema.ruleConfigVersions.id,
          domain: schema.ruleConfigVersions.domain,
          version: schema.ruleConfigVersions.version,
          changedBy: schema.ruleConfigVersions.changedBy,
          changerNickname: schema.users.nickname,
          changesJson: schema.ruleConfigVersions.changesJson,
          createdAt: schema.ruleConfigVersions.createdAt,
        })
        .from(schema.ruleConfigVersions)
        .leftJoin(schema.users, eq(schema.users.id, schema.ruleConfigVersions.changedBy))
        .where(eq(schema.ruleConfigVersions.domain, input.domain))
        .orderBy(desc(schema.ruleConfigVersions.version), desc(schema.ruleConfigVersions.createdAt))
        .limit(input.limit);
      return { domain: input.domain, versions: rows };
    }),
});

/* ------------------------------------------------------------------ */
/* sweep（index.ts 60s 同滴答注册；e2e 直调推进同 sweepIncidentEscalations 工艺）   */
/* ------------------------------------------------------------------ */

/**
 * sweepScheduledConfig（片 1 · 件 2 到点懒切换）：config_scheduled pending 且 effective_at<=now
 * 的登记行逐行事务推进——旧 active 行失效→目标行激活（version=域内当前生效最大版本+1，行值不动
 * =只增不改）+登记行 applied+rule_config_versions 留痕（note=scheduled-applied，changedBy=原保存人）。
 * 目标行已被后续工序顶替（active=1 或行不在）→登记行 superseded 废弃。幂等：重扫零增量。
 */
export async function sweepScheduledConfig(d: DbHandle, now: Date): Promise<number> {
  const due = await d
    .select()
    .from(schema.configScheduled)
    .where(and(eq(schema.configScheduled.status, 'pending'), lte(schema.configScheduled.effectiveAt, now)))
    .orderBy(asc(schema.configScheduled.effectiveAt));
  let applied = 0;
  for (const s of due) {
    await d.transaction(async (tx) => {
      const table = rulesTableOf(s.domain);
      const target = (
        await txDb(tx)
          .select({ id: table.id, valueJson: table.valueJson, active: table.active })
          .from(table)
          .where(eq(table.id, s.rowId))
          .limit(1)
      )[0];
      if (!target || target.active) {
        await txDb(tx)
          .update(schema.configScheduled)
          .set({ status: 'superseded', updatedAt: now })
          .where(eq(schema.configScheduled.id, s.id));
        return;
      }
      const cur = await txDb(tx)
        .select({ valueJson: table.valueJson })
        .from(table)
        .where(and(eq(table.ruleKey, s.ruleKey), eq(table.active, true)));
      const before = (cur[0]?.valueJson as Record<string, unknown> | undefined) ?? null;
      const maxRows = await txDb(tx)
        .select({ v: sql<number>`coalesce(max(${table.version}), 0)` })
        .from(table)
        .where(eq(table.active, true));
      const nextVersion = (maxRows[0]?.v ?? 0) + 1;
      await txDb(tx)
        .update(table)
        .set({ active: false, updatedAt: now })
        .where(and(eq(table.ruleKey, s.ruleKey), eq(table.active, true)));
      await txDb(tx).update(table).set({ active: true, version: nextVersion, updatedAt: now }).where(eq(table.id, s.rowId));
      await txDb(tx)
        .update(schema.configScheduled)
        .set({ status: 'applied', updatedAt: now })
        .where(eq(schema.configScheduled.id, s.id));
      await txDb(tx)
        .insert(schema.ruleConfigVersions)
        .values({
          domain: s.domain,
          version: nextVersion,
          changedBy: s.createdBy,
          changesJson: [{ rule_key: s.ruleKey, before, after: target.valueJson as Record<string, unknown>, note: 'scheduled-applied' }],
        });
      applied += 1;
    });
  }
  return applied;
}

/**
 * sweepConfigAutoRollback（片 1 · 件 4b 异常自动回滚）：service_rules config_auto_rollback 开
 * 且 client_error_events 窗口计数越 client_error_alert_threshold{threshold,minutes} 线时——
 * 窗口内人工版本行（rule_config_versions note 空=直存 / approved-apply=审批应用；机器工序
 * note[rollback:* / scheduled* / auto-rollback* / kill-switch] 排除防互滚）逐键回滚到 before 值
 * （版本化+留痕 note=auto-rollback:client-error-spike）+告警通知（notifications type=
 * config.autoRollback，收=该键当前生效行所属店 merchant_owner ∪ 原变更人）。幂等：
 * 当前值==回滚目标即跳过；机器行不作嫌疑行→重扫零增量。
 */
export async function sweepConfigAutoRollback(d: DbHandle, now: Date): Promise<number> {
  const armed = await d
    .select({ valueJson: schema.serviceRules.valueJson })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, 'config_auto_rollback'), eq(schema.serviceRules.active, true)));
  if ((armed[0]?.valueJson as Record<string, unknown> | undefined)?.enabled !== true) return 0;
  const thRows = await d
    .select({ valueJson: schema.serviceRules.valueJson })
    .from(schema.serviceRules)
    .where(and(eq(schema.serviceRules.ruleKey, 'client_error_alert_threshold'), eq(schema.serviceRules.active, true)));
  const thVal = thRows[0]?.valueJson as Record<string, unknown> | undefined;
  const threshold = typeof thVal?.threshold === 'number' && thVal.threshold > 0 ? thVal.threshold : 20;
  const minutes = typeof thVal?.minutes === 'number' && thVal.minutes > 0 ? thVal.minutes : 10;
  const windowStart = new Date(now.getTime() - minutes * 60_000);
  const errs = await d
    .select({ id: schema.clientErrorEvents.id })
    .from(schema.clientErrorEvents)
    .where(gte(schema.clientErrorEvents.createdAt, windowStart));
  if (errs.length <= threshold) return 0;
  const vers = await d
    .select()
    .from(schema.ruleConfigVersions)
    .where(gte(schema.ruleConfigVersions.createdAt, windowStart))
    .orderBy(asc(schema.ruleConfigVersions.createdAt));
  let rolled = 0;
  const doneKeys = new Set<string>();
  /* 幂等锚=「键最新窗口工序」：每键只取窗口内最新一条变更（后写覆盖先写）——最新=机器工序
     note（rollback:* / scheduled* / auto-rollback* / kill-switch）=已处理跳过；最新=人工
     （note 空 / approved-apply）才作嫌疑，回滚目标=该最新条 before（只撤最新一手，不考古）。
     回滚后该键最新行=机器行→重扫天然零增量（修初版「逐条嫌疑+调用内 doneKeys」跨扫乒乓缺陷） */
  const lastByKey = new Map<string, { domain: string; ruleKey: string; before: unknown; note?: string; changedBy: string }>();
  for (const v of vers) {
    for (const ch of v.changesJson) {
      lastByKey.set(`${v.domain}:${ch.rule_key}`, {
        domain: v.domain,
        ruleKey: ch.rule_key,
        before: ch.before,
        note: ch.note,
        changedBy: v.changedBy,
      });
    }
  }
  for (const [dedupKey, s] of lastByKey) {
    {
      const ch = { rule_key: s.ruleKey, before: s.before, note: s.note };
      const v = { domain: s.domain, changedBy: s.changedBy };
      if (ch.note !== undefined && ch.note !== 'approved-apply') continue;
      if (doneKeys.has(dedupKey)) continue;
      if (ch.before === null || ch.before === undefined) continue;
      const isCentral = v.domain === 'member_plans' || v.domain === 'copy';
      const table = rulesTableOf(v.domain);
      const curRow = isCentral
        ? (
            await d
              .select({ valueJson: table.valueJson })
              .from(table)
              .where(and(eq(table.ruleKey, ch.rule_key), eq(table.active, true)))
              .limit(1)
          )[0]
        : (
            await d
              .select({ valueJson: table.valueJson, storeId: (table as unknown as typeof schema.commissionRules).storeId })
              .from(table as unknown as typeof schema.commissionRules)
              .where(and(eq(table.ruleKey, ch.rule_key), eq(table.active, true)))
              .limit(1)
          )[0];
      const curVal = curRow?.valueJson as Record<string, unknown> | undefined;
      if (curVal === undefined) continue;
      if (stableJsonEq(curVal, ch.before)) continue;
      const rowStoreId = isCentral ? null : ((curRow as { storeId?: string | null }).storeId ?? null);
      await d.transaction(async (tx) => {
        await applyRuleValueTx(tx, {
          domain: v.domain,
          ruleKey: ch.rule_key,
          valueJson: ch.before as Record<string, unknown>,
          storeId: rowStoreId,
          changedBy: v.changedBy,
          note: 'auto-rollback:client-error-spike',
        });
        /* 告警留痕：收=原变更人 ∪ 生效行所属店店主+店长（总部行=全店店主；同 incident 升级双通知工艺） */
        let storeOwnerIds: string[] = [];
        if (rowStoreId) {
          const st = await txDb(tx)
            .select({ ownerId: schema.stores.ownerId })
            .from(schema.stores)
            .where(eq(schema.stores.id, rowStoreId))
            .get();
          const managers = await txDb(tx)
            .select({ userId: schema.staff.userId })
            .from(schema.staff)
            .innerJoin(
              schema.userRoles,
              and(eq(schema.userRoles.userId, schema.staff.userId), eq(schema.userRoles.role, 'merchant_manager')),
            )
            .where(eq(schema.staff.storeId, rowStoreId));
          storeOwnerIds = [st?.ownerId, ...managers.map((m) => m.userId)].filter((x): x is string => !!x);
        } else {
          const allStores = await txDb(tx).select({ ownerId: schema.stores.ownerId }).from(schema.stores);
          storeOwnerIds = allStores.map((s) => s.ownerId).filter((x): x is string => !!x);
        }
        const recipients = new Set<string>([v.changedBy, ...storeOwnerIds]);
        for (const uid of recipients) {
          await txDb(tx).insert(schema.notifications).values({
            userId: uid,
            type: 'config.autoRollback',
            title: '配置已自动回滚（客户端错误告警越线）',
            body: `${v.domain}.${ch.rule_key} 已回滚至上一版（窗口 ${minutes} 分钟错误上报 ${errs.length} 条 > 阈值 ${threshold} 条）`,
            link: '/console',
          });
        }
      });
      doneKeys.add(dedupKey);
      rolled += 1;
    }
  }
  return rolled;
}
