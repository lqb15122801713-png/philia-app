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
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { merchantOwnerProcedure, router } from '../trpc';

/** emitEvent 首参类型（全局 db；事务 handle 运行时接口一致，类型上做显式断言，同 cashier.ts 惯例） */
type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/* ------------------------------------------------------------------ */
/* 域 → 表映射（commission_rules / xp_rules 结构相同，xp_rules 注释即「结构同 commission_rules」） */
/* ------------------------------------------------------------------ */

const domainSchema = z.enum(['commission', 'xp']);

const RULES_TABLE = {
  commission: schema.commissionRules,
  xp: schema.xpRules,
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
  'hour',
  'level',
]);

/** 语义非负的数值字段（比例/系数/倍率/上限/门槛/保级线/日/次数不允许为负） */
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
  'hour',
  'level',
]);

/** points 允许负值的唯一键族（差评扣分 −8，扣分不扣款） */
const NEGATIVE_POINTS_KEYS = new Set(['xp_penalty_low_star']);

/** 值必须是「字符串→数值」映射的对象字段（定额分 / 师徒拆分 bp） */
const NUMBER_MAP_KEYS = new Set(['fixed_fen_by_plan', 'split_bp']);

/** 字符串字段（段位名 / 同口径引用） */
const STRING_KEYS = new Set(['name', 'same_as']);

/**
 * 校验单条规则值（宽松按 key 族）：
 * - 已知数值字段必须是有限数字（NaN/Infinity/字符串一律拒）；
 * - 比例/上限/门槛/分值等非负（points 仅 xp_penalty_low_star 允许为负）；
 * - fixed_fen_by_plan / split_bp 必须是对象且每个值都是非负有限数字；
 * - name / same_as 必须是字符串。
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
});

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
      return { domain: input.domain, currentVersion, rules: rows };
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
          /* 新行：version+1 / effective_from=now / active=1 / createdBy=操作人 */
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
