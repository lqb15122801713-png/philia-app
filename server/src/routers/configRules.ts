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
 */
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { merchantOwnerProcedure, publicProcedure, router } from '../trpc';

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言，同 cashier.ts 惯例） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

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
function validateValueJson(ruleKey: string, value: Record<string, unknown>): void {
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
/* router：全部 merchantOwnerProcedure（clerk/manager → FORBIDDEN 硬拒）    */
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
      /* 端口 V2（copy 域）：屏名+位置注透出（第二查按 id 并图；RULES_TABLE 并集类型无
         screen/position 列，故 copy 域单列查询不塞进主 select）；其他域不透出（undefined） */
      let metaByKey = new Map<string, { screen: string | null; position: string | null }>();
      if (input.domain === 'copy') {
        const ext = await ctx.db
          .select({ ruleKey: schema.copyOverrides.ruleKey, screen: schema.copyOverrides.screen, position: schema.copyOverrides.position })
          .from(schema.copyOverrides)
          .where(eq(schema.copyOverrides.active, true));
        metaByKey = new Map(ext.map((x) => [x.ruleKey, { screen: x.screen, position: x.position }]));
      }
      /* 端口批片 B：copy 域行附高危标记（涉钱/涉协议/涉会员口径）——端口页改前重确认弹层用；
         其他域恒 false（加字段不改形状） */
      return {
        domain: input.domain,
        currentVersion,
        rules: rows.map((r) => ({
          ...r,
          highRisk: input.domain === 'copy' && isCopyHighRiskKey(r.ruleKey),
          screen: input.domain === 'copy' ? (metaByKey.get(r.ruleKey)?.screen ?? null) : undefined,
          position: input.domain === 'copy' ? (metaByKey.get(r.ruleKey)?.position ?? null) : undefined,
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

        return { domain: input.domain, version: nextVersion, keys, savedAt: now, outboxId };
      });
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
