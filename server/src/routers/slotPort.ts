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
import { z } from 'zod';
import { schema } from '../db';
import { merchantOwnerProcedure, publicProcedure, router } from '../trpc';

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}
function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

const contentSchema = z.object({
  url: z.string().min(1).max(500).nullable(),
  alt: z.string().trim().min(1).max(100),
});

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
      slots: rows.map((r) => ({ key: r.slotKey, url: r.contentJson.url, alt: r.contentJson.alt })),
    };
  }),

  /** list（owner）：全槽注册表（live+pending 行 + 版本计数 + 操作人昵称） */
  list: merchantOwnerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: schema.slotContents.id,
        slotKey: schema.slotContents.slotKey,
        version: schema.slotContents.version,
        contentJson: schema.slotContents.contentJson,
        status: schema.slotContents.status,
        createdBy: schema.slotContents.createdBy,
        creatorNickname: schema.users.nickname,
        createdAt: schema.slotContents.createdAt,
      })
      .from(schema.slotContents)
      .leftJoin(schema.users, eq(schema.users.id, schema.slotContents.createdBy))
      .orderBy(schema.slotContents.slotKey, desc(schema.slotContents.version));
    /* 按槽聚组：live 行 + pending 行 + 总版本数 */
    const bySlot = new Map<string, { live: (typeof rows)[number] | null; pending: (typeof rows)[number][]; totalVersions: number }>();
    for (const r of rows) {
      const cur = bySlot.get(r.slotKey) ?? { live: null, pending: [], totalVersions: 0 };
      cur.totalVersions += 1;
      if (r.status === 'live') cur.live = r;
      if (r.status === 'pending') cur.pending.push(r);
      bySlot.set(r.slotKey, cur);
    }
    return {
      slots: [...bySlot.entries()].map(([slotKey, v]) => ({ slotKey, ...v })),
    };
  }),

  /** upload（owner）：登记新版本（pending 待审；slotKey 须在注册表） */
  upload: merchantOwnerProcedure
    .input(
      z.object({
        slotKey: z.string().min(1),
        content: contentSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
        await tx
          .update(schema.slotContents)
          .set({ status: 'archived', updatedAt: now })
          .where(and(eq(schema.slotContents.slotKey, target.slotKey), eq(schema.slotContents.status, 'live')));
        const live = await tx
          .update(schema.slotContents)
          .set({ status: 'live', updatedAt: now })
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
          .set({ status: 'archived', updatedAt: now })
          .where(eq(schema.slotContents.id, cur.id));
        const live = await tx
          .update(schema.slotContents)
          .set({ status: 'live', updatedAt: now })
          .where(eq(schema.slotContents.id, prev.id))
          .returning()
          .then((r) => r[0]!);
        return { version: live, revertedFrom: cur.version };
      });
    }),
});
