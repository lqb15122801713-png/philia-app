/**
 * 展示槽位端口 router（端口批片 C · CJ-1002-01 · A5 落地 · 控制台第八域「槽位」）
 *
 * 端点：
 * - liveMap（public）：全槽 live 行透出 {key→{url,alt}}——客户端 SlotContentLoader 数据源
 *   （透出物=展示素材路径/文案，无敏感；待审 pending 不透出=新素材默认待审不上线 D-6）；
 * - list（owner）：全槽注册表——live 版本+pending 版本+版本计数+操作人昵称；
 * - upload（owner）：登记新版本（status='pending'，url=客户端先走 /api/upload 落盘件的签名 URL）；
 * - publish（owner）：pending 版本点上线——同槽旧 live→archived、该版本→live（单事务）；
 * - revert（owner）：回退上一版——当前 live→archived、最近 archived 版→live（单事务）。
 *
 * 红线：仅 owner（merchantOwnerProcedure 硬 403）；无删除端点（版本行只增不改历史）；
 * 未知 slotKey 硬拒（注册表=种子七槽，新槽位=新迁移登记）；R10 不画假件（url=null=渐变占位）。
 */
import { TRPCError } from '@trpc/server';
import { and, desc, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { schema } from '../db';
import { merchantOwnerProcedure, publicProcedure, router } from '../trpc';
import { copyBannedHit } from './configRules';

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

/** D-42（PD-20）：audience 人群枚举——all=全量（缺省）/anon=未登录/free=已登录微光/anon_free=未登录+微光 */
export const SLOT_AUDIENCE_VALUES = ['all', 'anon', 'free', 'anon_free'] as const;

const contentSchema = z.object({
  url: z.string().min(1).max(500).nullable(),
  alt: z.string().trim().min(1).max(100),
  /* D-42 三行制闸（可选字段，缺席=纯图版合法）：主标题 ≤12 字 / 副标题 ≤20 字 / CTA 2–4 字 */
  title_main: z.string().trim().min(1, '主标题至少 1 字').max(12, '主标题超 12 字，保存失败').optional(),
  title_sub: z.string().trim().min(1, '副标题至少 1 字').max(20, '副标题超 20 字，保存失败').optional(),
  cta_text: z.string().trim().min(2, 'CTA 至少 2 字').max(4, 'CTA 至多 4 字，保存失败').optional(),
  audience: z.enum(SLOT_AUDIENCE_VALUES).optional(),
  priority: z.number().int().min(0).max(999).optional(),
});

/* D-42 红线词闸：复用 copy 端口禁令词表（copyBannedHit：充值/储值/自动续费/返现/返钱/疯抢/秒杀/守护值
   +否定明面句豁免），槽位追加折扣类词（「9.5折」等 \d+折）——槽位文案=对外门面，同口径收紧 */
const SLOT_BANNED_DISCOUNT = /\d+(\.\d+)?\s*折/;
function slotCopyGuard(content: { alt: string; title_main?: string; title_sub?: string; cta_text?: string }): void {
  for (const text of [content.alt, content.title_main, content.title_sub, content.cta_text]) {
    if (!text) continue;
    const hit = copyBannedHit(text);
    if (hit) badRequest(`文案含禁令词「${hit}」，保存失败（红线词闸）`);
    const discount = text.match(SLOT_BANNED_DISCOUNT);
    if (discount) badRequest(`文案含折扣词「${discount[0]}」，保存失败（红线词闸）`);
  }
}

export const slotPortRouter = router({
  /**
   * liveMap（public）：live 行全量 → { slots: [{key,url,alt}] }。
   * 客户端读取顺序=槽位 live 值 → 码内默认（渐变/默认图 fallback 纪律）。
   */
  liveMap: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        slotKey: schema.slotContents.slotKey,
        contentJson: schema.slotContents.contentJson,
      })
      .from(schema.slotContents)
      .where(eq(schema.slotContents.status, 'live'));
    return {
      /* D-42：live 行透出 contentJson 全字段（三行文案/audience/priority 接线客户端读口；pending 依旧不透） */
      slots: rows.map((r) => ({
        key: r.slotKey,
        url: r.contentJson.url,
        alt: r.contentJson.alt,
        title_main: r.contentJson.title_main ?? null,
        title_sub: r.contentJson.title_sub ?? null,
        cta_text: r.contentJson.cta_text ?? null,
        audience: r.contentJson.audience ?? 'all',
        priority: r.contentJson.priority ?? null,
      })),
    };
  }),

  /** list（owner）：全槽注册表（live+pending 行 + 版本计数 + 上传人/发布回退操作人昵称） */
  list: merchantOwnerProcedure.query(async ({ ctx }) => {
    const actors = alias(schema.users, 'slot_actor');
    const rows = await ctx.db
      .select({
        id: schema.slotContents.id,
        slotKey: schema.slotContents.slotKey,
        version: schema.slotContents.version,
        contentJson: schema.slotContents.contentJson,
        status: schema.slotContents.status,
        createdBy: schema.slotContents.createdBy,
        creatorNickname: schema.users.nickname,
        actedBy: schema.slotContents.actedBy,
        actedByNickname: actors.nickname,
        actedAt: schema.slotContents.actedAt,
        createdAt: schema.slotContents.createdAt,
      })
      .from(schema.slotContents)
      .leftJoin(schema.users, eq(schema.users.id, schema.slotContents.createdBy))
      .leftJoin(actors, eq(actors.id, schema.slotContents.actedBy))
      .orderBy(schema.slotContents.slotKey, desc(schema.slotContents.version));
    /* 按槽聚组：live 行 + pending 行 + 总版本数；D-40：archived 历史行透出（紧急下线/回退留痕可查，
       版本/操作人/时间在册，物理删历史=禁令不动） */
    const bySlot = new Map<string, { live: (typeof rows)[number] | null; pending: (typeof rows)[number][]; archived: (typeof rows)[number][]; totalVersions: number }>();
    for (const r of rows) {
      const cur = bySlot.get(r.slotKey) ?? { live: null, pending: [], archived: [], totalVersions: 0 };
      cur.totalVersions += 1;
      if (r.status === 'live') cur.live = r;
      if (r.status === 'pending') cur.pending.push(r);
      if (r.status === 'archived') cur.archived.push(r);
      bySlot.set(r.slotKey, cur);
    }
    return {
      slots: [...bySlot.entries()].map(([slotKey, v]) => ({ slotKey, ...v })),
    };
  }),

  /** upload（owner）：登记新版本（pending 待审；slotKey 须在注册表；D-42 三行制+红线词闸入事务前硬拒） */
  upload: merchantOwnerProcedure
    .input(
      z.object({
        slotKey: z.string().min(1),
        content: contentSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      slotCopyGuard(input.content);
      return ctx.db.transaction(async (tx) => {
        const existing = await tx
          .select({ version: schema.slotContents.version })
          .from(schema.slotContents)
          .where(eq(schema.slotContents.slotKey, input.slotKey))
          .orderBy(desc(schema.slotContents.version))
          .limit(1);
        if (existing.length === 0) {
          badRequest(`未知槽位键：${input.slotKey}（槽位注册表只认既有槽，新槽位须新迁移登记）`);
        }
        const row = await tx
          .insert(schema.slotContents)
          .values({
            slotKey: input.slotKey,
            version: existing[0]!.version + 1,
            contentJson: input.content,
            status: 'pending',
            createdBy: ctx.user.id,
          })
          .returning()
          .then((r) => r[0]!);
        return { version: row };
      });
    }),

  /** publish（owner）：pending 版本点上线（同槽唯一 live：旧 live→archived） */
  publish: merchantOwnerProcedure
    .input(z.object({ versionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const now = new Date();
        const target = await tx
          .select()
          .from(schema.slotContents)
          .where(eq(schema.slotContents.id, input.versionId))
          .get();
        if (!target) notFound('版本不存在');
        if (target.status === 'live') return { version: target, idempotent: true as const };
        if (target.status !== 'pending') badRequest('仅待审版本可点上线（历史版请走回退）');
        /* 旧 live→archived（连带留痕=同一次上线操作） */
        await tx
          .update(schema.slotContents)
          .set({ status: 'archived', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(and(eq(schema.slotContents.slotKey, target.slotKey), eq(schema.slotContents.status, 'live')));
        /* 该版→live（留痕=发布人） */
        const live = await tx
          .update(schema.slotContents)
          .set({ status: 'live', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(eq(schema.slotContents.id, target.id))
          .returning()
          .then((r) => r[0]!);
        return { version: live, idempotent: false as const };
      });
    }),

  /** revert（owner）：回退上一版（当前 live→archived，最近一版 archived→live） */
  revert: merchantOwnerProcedure
    .input(z.object({ slotKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const now = new Date();
        const cur = await tx
          .select()
          .from(schema.slotContents)
          .where(and(eq(schema.slotContents.slotKey, input.slotKey), eq(schema.slotContents.status, 'live')))
          .get();
        if (!cur) notFound('该槽位当前无上线版本');
        const prev = await tx
          .select()
          .from(schema.slotContents)
          .where(
            and(
              eq(schema.slotContents.slotKey, input.slotKey),
              ne(schema.slotContents.status, 'pending'),
              ne(schema.slotContents.id, cur.id),
            ),
          )
          .orderBy(desc(schema.slotContents.version))
          .limit(1)
          .then((r) => r[0]);
        if (!prev) badRequest('无上一版可回退（当前已是首个版本）');
        await tx
          .update(schema.slotContents)
          .set({ status: 'archived', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(eq(schema.slotContents.id, cur.id));
        const live = await tx
          .update(schema.slotContents)
          .set({ status: 'live', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(eq(schema.slotContents.id, prev.id))
          .returning()
          .then((r) => r[0]!);
        return { version: live, revertedFrom: cur.version };
      });
    }),

  /** unpublish（owner · PD-20 D-40）：单槽紧急下线——当前 live→archived（留痕=操作人+时刻），
      槽可无 live（客户端 liveMap 无行→回落码内默认品牌图）；
      与页顶「一键关停」（config_kill_switch 支付通道语义）零耦合零复用；版本行只增不改不物理删；
      下线后可再 upload→pending→publish 恢复（既有端点不动） */
  unpublish: merchantOwnerProcedure
    .input(z.object({ slotKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const now = new Date();
        const cur = await tx
          .select()
          .from(schema.slotContents)
          .where(and(eq(schema.slotContents.slotKey, input.slotKey), eq(schema.slotContents.status, 'live')))
          .get();
        if (!cur) badRequest('该槽位当前无上线版本可下线（已是离线态）');
        const archived = await tx
          .update(schema.slotContents)
          .set({ status: 'archived', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(eq(schema.slotContents.id, cur.id))
          .returning()
          .then((r) => r[0]!);
        return { version: archived };
      });
    }),

  /** previewVersion（owner · PD-20 D-41）：真预览数据口——按版本 id 读任意状态版本全量 contentJson
      （pending 可吃；owner 硬闸=白名单边界。客户端预览旁路专用；liveMap 公共口依旧只透 live） */
  previewVersion: merchantOwnerProcedure
    .input(z.object({ versionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db
        .select()
        .from(schema.slotContents)
        .where(eq(schema.slotContents.id, input.versionId))
        .get();
      if (!row) notFound('版本不存在');
      return { version: row };
    }),
});
