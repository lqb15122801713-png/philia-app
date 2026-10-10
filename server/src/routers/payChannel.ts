/**
 * 支付通道配置端口（产品-1010 线上支付批片 1 · A 股件 ②高危件）
 *
 * 口径（令书逐字）：商户号/密钥/证书位入配置端口高危族——口令复核+留痕+密钥永不明文回显（掩码读出）。
 *
 * 为什么不开在 generic config.save：
 * - config.save 有种子宇宙校验（未知键拒）+涉钱二级审批硬闸（pay 全域涉钱）——通道配置=店主自管件
 *   （任务书旅程 3：店主在端口填商户号/密钥+切真通道），二级审批与自管相冲突；令口径=口令复核件；
 * - 密钥真值不能进 rule_config_versions 留痕/审批载荷（永不明文）——本件留痕 changesJson 全掩码；
 * - generic 三口（save/proposeChange/rollback）对本两键一律拒（configRules.assertNotPayChannelKey 同域挡）。
 *
 * 存储（pay_rules 两键，无种子零迁移，首存建行；全局单份 storeId=NULL=总公司账户口径·开口项②裁）：
 * - pay_channel_provider {provider}——切换闸读口（轻量无密）；
 * - pay_channel_credentials {wechat?{appid,mchid,serial,apiV3Key}, alipay?{appid,privateKey,publicKey}}——
 *   高危密钥件：active 行真值 server-only（provider 解析读取），所有读出/留痕一律掩码（****+末 4 位）。
 */

import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { merchantOwnerProcedure, router } from '../trpc';
import {
  PAY_CHANNEL_CREDENTIALS_RULE_KEY,
  PAY_CHANNEL_PROVIDER_RULE_KEY,
  maskPayChannelCredentials,
  type PayChannelCredentials,
} from '../payments/channelKeys';
import { loadPayChannelCredentials } from '../payments/provider';
import type { PayChannel } from '../db/schema';
import { isKillSwitchOn } from './configRules';

type DbHandle = Parameters<typeof emitEvent>[0];
const txDb = (tx: unknown): DbHandle => tx as DbHandle;

/** 口令复核句（server 硬闸；UI D 套弹层键入同句回传） */
export const PAY_CHANNEL_CONFIRM_PHRASE = '确认变更支付通道';

const channelSchema = z.enum(['mock', 'wechat_jsapi', 'wechat_h5', 'alipay_wap']);

/** 凭据入参：字段空串/缺省=该位不变（部分更新口径；掩码读出值形如 ****1234 一律拒收防误存） */
const credentialsField = z
  .string()
  .trim()
  .max(512, '字段过长')
  .refine((v) => !v.startsWith('****'), { message: '掩码值不可回存（留空=该位不变）' });
const wechatSchema = z
  .object({
    appid: credentialsField.optional(),
    mchid: credentialsField.optional(),
    serial: credentialsField.optional(),
    apiV3Key: credentialsField.optional(),
  })
  .optional();
const alipaySchema = z
  .object({
    appid: credentialsField.optional(),
    privateKey: credentialsField.optional(),
    publicKey: credentialsField.optional(),
  })
  .optional();

/** 部分更新单位：入参非空=覆盖，空/缺=保留旧值 */
function mergeField(oldV: string | undefined, newV: string | undefined): string | undefined {
  return typeof newV === 'string' && newV.trim() ? newV.trim() : oldV;
}

/** 合并部分更新：凭据位逐字段走 mergeField；两通道全空=无凭据（不写行） */
function mergeCredentials(
  oldC: PayChannelCredentials | null,
  patch: {
    wechat?: { appid?: string; mchid?: string; serial?: string; apiV3Key?: string };
    alipay?: { appid?: string; privateKey?: string; publicKey?: string };
  },
): PayChannelCredentials {
  const next: PayChannelCredentials = {};
  if (oldC?.wechat || patch.wechat) {
    next.wechat = {
      appid: mergeField(oldC?.wechat?.appid, patch.wechat?.appid),
      mchid: mergeField(oldC?.wechat?.mchid, patch.wechat?.mchid),
      serial: mergeField(oldC?.wechat?.serial, patch.wechat?.serial),
      apiV3Key: mergeField(oldC?.wechat?.apiV3Key, patch.wechat?.apiV3Key),
    };
  }
  if (oldC?.alipay || patch.alipay) {
    next.alipay = {
      appid: mergeField(oldC?.alipay?.appid, patch.alipay?.appid),
      privateKey: mergeField(oldC?.alipay?.privateKey, patch.alipay?.privateKey),
      publicKey: mergeField(oldC?.alipay?.publicKey, patch.alipay?.publicKey),
    };
  }
  return next;
}

/** 版本化写行（config.save 同工艺：旧 active 失效+新行 active=1；全局单份 storeId=NULL） */
async function upsertPayRuleTx(
  tx: unknown,
  args: { ruleKey: string; label: string; valueJson: Record<string, unknown>; version: number; changedBy: string; now: Date },
): Promise<void> {
  const d = txDb(tx);
  await d
    .update(schema.payRules)
    .set({ active: false, updatedAt: args.now })
    .where(and(eq(schema.payRules.ruleKey, args.ruleKey), eq(schema.payRules.active, true)));
  await d.insert(schema.payRules).values({
    version: args.version,
    ruleKey: args.ruleKey,
    label: args.label,
    valueJson: args.valueJson,
    effectiveFrom: args.now,
    active: true,
    createdBy: args.changedBy,
    storeId: null,
  });
}

export const payChannelRouter = router({
  /**
   * get（owner）：当前通道配置掩码视图——portProvider（null=未配置走 env 兜底现状）+
   * 凭据掩码镜像（****+末 4 位，永无明文）+killSwitchOn（回落提示）+最近变更人/时刻。
   */
  get: merchantOwnerProcedure.query(async ({ ctx }) => {
    const providerRow = await ctx.db
      .select({
        valueJson: schema.payRules.valueJson,
        updatedAt: schema.payRules.updatedAt,
        nickname: schema.users.nickname,
      })
      .from(schema.payRules)
      .leftJoin(schema.users, eq(schema.users.id, schema.payRules.createdBy))
      .where(and(eq(schema.payRules.ruleKey, PAY_CHANNEL_PROVIDER_RULE_KEY), eq(schema.payRules.active, true)))
      .get();
    const v = (providerRow?.valueJson as Record<string, unknown> | undefined)?.provider;
    const credentials = await loadPayChannelCredentials(ctx.db);
    return {
      portProvider: (v === 'mock' || v === 'wechat_jsapi' || v === 'wechat_h5' || v === 'alipay_wap' ? v : null) as PayChannel | null,
      credentials: maskPayChannelCredentials(credentials),
      killSwitchOn: await isKillSwitchOn(ctx.db),
      updatedAt: providerRow?.updatedAt ?? null,
      updatedBy: providerRow?.nickname ?? null,
    };
  }),

  /**
   * save（owner · 高危件）：口令复核硬闸（confirmPhrase≠「确认变更支付通道」→400 人话）→
   * 事务：版本化写 provider 行（+凭据行=入参带凭据位时）+rule_config_versions 留痕
   * （changesJson 全掩码，note='pay-channel-save'）+ConfigVersionSaved SSE。
   */
  save: merchantOwnerProcedure
    .input(
      z.object({
        provider: channelSchema,
        confirmPhrase: z.string().max(50),
        wechat: wechatSchema,
        alipay: alipaySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      /* 口令复核 server 硬闸（前端弹层只是体验层，闸在 server） */
      if (input.confirmPhrase !== PAY_CHANNEL_CONFIRM_PHRASE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `口令复核未通过：请完整键入「${PAY_CHANNEL_CONFIRM_PHRASE}」后再保存（涉钱高危件，防误触）`,
        });
      }

      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        /* 旧值（留痕 before）：provider 值+凭据掩码镜像 */
        const oldProviderRow = await txDb(tx)
          .select({ valueJson: schema.payRules.valueJson })
          .from(schema.payRules)
          .where(and(eq(schema.payRules.ruleKey, PAY_CHANNEL_PROVIDER_RULE_KEY), eq(schema.payRules.active, true)))
          .get();
        const oldProvider = (oldProviderRow?.valueJson as Record<string, unknown> | undefined)?.provider ?? null;
        const oldCredentials = await loadPayChannelCredentials(txDb(tx));

        /* 域内当前生效最大版本 + 1（config.save 同口径） */
        const maxRows = await txDb(tx)
          .select({ v: sql<number>`coalesce(max(${schema.payRules.version}), 0)` })
          .from(schema.payRules)
          .where(eq(schema.payRules.active, true));
        const nextVersion = (maxRows[0]?.v ?? 0) + 1;

        /* ① 切换闸行（每次保存必写=留痕谁何时切到哪） */
        await upsertPayRuleTx(tx, {
          ruleKey: PAY_CHANNEL_PROVIDER_RULE_KEY,
          label: '线上支付通道（切换闸）',
          valueJson: { provider: input.provider },
          version: nextVersion,
          changedBy: ctx.user.id,
          now,
        });

        /* ② 凭据行（入参带凭据位才写；部分更新合并） */
        const hasCredentialPatch =
          (input.wechat && Object.values(input.wechat).some((v) => typeof v === 'string' && v.trim())) ||
          (input.alipay && Object.values(input.alipay).some((v) => typeof v === 'string' && v.trim()));
        let nextCredentials: PayChannelCredentials | null = null;
        if (hasCredentialPatch) {
          nextCredentials = mergeCredentials(oldCredentials, { wechat: input.wechat, alipay: input.alipay });
          await upsertPayRuleTx(tx, {
            ruleKey: PAY_CHANNEL_CREDENTIALS_RULE_KEY,
            label: '支付通道凭据（高危件）',
            valueJson: nextCredentials as Record<string, unknown>,
            version: nextVersion,
            changedBy: ctx.user.id,
            now,
          });
        }

        /* 留痕：一条版本行（谁/何时/前后值）——密钥全掩码，真值永不进留痕 */
        const changesJson: schema.RuleConfigChanges = [
          {
            rule_key: PAY_CHANNEL_PROVIDER_RULE_KEY,
            before: oldProvider === null ? null : { provider: oldProvider },
            after: { provider: input.provider },
            note: 'pay-channel-save',
          },
        ];
        if (hasCredentialPatch) {
          changesJson.push({
            rule_key: PAY_CHANNEL_CREDENTIALS_RULE_KEY,
            before: maskPayChannelCredentials(oldCredentials),
            after: maskPayChannelCredentials(nextCredentials),
            note: 'pay-channel-save（密钥全掩码留痕，真值仅 active 行 server-only）',
          });
        }
        await txDb(tx).insert(schema.ruleConfigVersions).values({
          domain: 'pay',
          version: nextVersion,
          changedBy: ctx.user.id,
          changesJson,
        });

        const outboxId = await emitEvent(txDb(tx), `store:${ctx.user.storeId!}`, EventType.ConfigVersionSaved, {
          domain: 'pay',
          version: nextVersion,
          keys: hasCredentialPatch
            ? [PAY_CHANNEL_PROVIDER_RULE_KEY, PAY_CHANNEL_CREDENTIALS_RULE_KEY]
            : [PAY_CHANNEL_PROVIDER_RULE_KEY],
        });

        return {
          saved: true as const,
          version: nextVersion,
          provider: input.provider,
          credentials: maskPayChannelCredentials(nextCredentials ?? oldCredentials),
          outboxId,
        };
      });
    }),
});
