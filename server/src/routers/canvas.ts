/**
 * 画布端口 router（端口批收尾片 3 · B 股 v1.1 冻结口径：右栏真页预览+点选反查+拖拽排序收/自由排版不做）
 *
 * 冻结口径：
 * - block_registry=写死件白名单（0064 种子 18 块；端口只读，saveLayout 校验块∈注册表且属本页，
 *   未知块/跨页块一律 BAD_REQUEST——滑成装修编辑器是本批最大风险，注册表边界不松）；
 * - page_layouts=布局/内容留口件：版本化+草稿/发布两步流（第六域同族——draft→published[+archived]，
 *   单店单页单一 published 事务内互斥同 slot_contents 工艺；revert=回上一版）；
 * - blocksJson=[{blockKey,visible}] 完整排列（缺块/多块/重块 400；渲染侧缺省回退=注册表默认序）；
 * - liveLayout=public（客户端/收银台真页渲染数据源；published 才透出，draft 不透出）。
 */
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import { merchantOwnerProcedure, publicProcedure, router } from '../trpc';

const PAGE_KEYS = ['home', 'memberCenter', 'cashierMarketing'] as const;
const pageKeySchema = z.enum(PAGE_KEYS);

/** 本页注册表块集（saveLayout 校验用） */
async function pageBlocks(d: typeof db, pageKey: string) {
  return d
    .select()
    .from(schema.blockRegistry)
    .where(eq(schema.blockRegistry.pageKey, pageKey))
    .orderBy(asc(schema.blockRegistry.sortOrder));
}

export const canvasRouter = router({
  /** blocks（public）：区块注册表全量（白名单公示；画布页/渲染侧共用） */
  blocks: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(schema.blockRegistry)
      .orderBy(asc(schema.blockRegistry.pageKey), asc(schema.blockRegistry.sortOrder));
    return { items: rows };
  }),

  /**
   * liveLayout（public）：(store,page) 当前 published 布局——真页渲染数据源；
   * 无 published 行 → {blocks:null}（调用方回退注册表默认序）。draft 不透出。
   */
  liveLayout: publicProcedure
    .input(z.object({ pageKey: pageKeySchema, storeId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = (
        await ctx.db
          .select()
          .from(schema.pageLayouts)
          .where(
            and(
              eq(schema.pageLayouts.storeId, input.storeId),
              eq(schema.pageLayouts.pageKey, input.pageKey),
              eq(schema.pageLayouts.status, 'published'),
            ),
          )
          .limit(1)
      )[0];
      return { blocks: row?.blocksJson ?? null, version: row?.version ?? null };
    }),

  /**
   * getLayout（owner）：编辑帧——最新 draft（无则当前 published 顶替）+ 版本时间轴
   * （version/status/操作人昵称/时刻 新→旧 ≤20）。
   */
  getLayout: merchantOwnerProcedure.input(z.object({ pageKey: pageKeySchema })).query(async ({ ctx, input }) => {
    const storeId = ctx.user.storeId!;
    const versions = await ctx.db
      .select({
        id: schema.pageLayouts.id,
        version: schema.pageLayouts.version,
        status: schema.pageLayouts.status,
        blocksJson: schema.pageLayouts.blocksJson,
        createdBy: schema.pageLayouts.createdBy,
        creatorNickname: schema.users.nickname,
        actedAt: schema.pageLayouts.actedAt,
        createdAt: schema.pageLayouts.createdAt,
      })
      .from(schema.pageLayouts)
      .leftJoin(schema.users, eq(schema.users.id, schema.pageLayouts.createdBy))
      .where(and(eq(schema.pageLayouts.storeId, storeId), eq(schema.pageLayouts.pageKey, input.pageKey)))
      .orderBy(desc(schema.pageLayouts.version))
      .limit(20);
    const draft = versions.find((v) => v.status === 'draft') ?? null;
    const live = versions.find((v) => v.status === 'published') ?? null;
    return { draft, live, editing: draft ?? live, versions };
  }),

  /**
   * saveLayout（owner）：存草稿——blocks 必须是本页注册表块的完整排列
   * （全块不重不漏；未知块/跨页块/重块 400 明文）；version=店页内 max+1，status='draft'。
   */
  saveLayout: merchantOwnerProcedure
    .input(
      z.object({
        pageKey: pageKeySchema,
        blocks: z
          .array(z.object({ blockKey: z.string().min(1), visible: z.boolean() }))
          .min(1, '布局不能为空')
          .max(30, '单页区块数越界'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const registry = await pageBlocks(ctx.db, input.pageKey);
      const registryKeys = new Set(registry.map((b) => b.blockKey));
      const seen = new Set<string>();
      for (const b of input.blocks) {
        if (!registryKeys.has(b.blockKey)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `区块「${b.blockKey}」不在本页注册表白名单（白名单制：新区块=新迁移登记）`,
          });
        }
        if (seen.has(b.blockKey)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `区块重复：${b.blockKey}` });
        }
        seen.add(b.blockKey);
      }
      if (seen.size !== registryKeys.size) {
        const missing = [...registryKeys].filter((k) => !seen.has(k));
        throw new TRPCError({ code: 'BAD_REQUEST', message: `布局须含本页全部区块（缺：${missing.join('、')}）` });
      }
      const maxRows = await ctx.db
        .select({ v: schema.pageLayouts.version })
        .from(schema.pageLayouts)
        .where(and(eq(schema.pageLayouts.storeId, storeId), eq(schema.pageLayouts.pageKey, input.pageKey)))
        .orderBy(desc(schema.pageLayouts.version))
        .limit(1);
      const nextVersion = (maxRows[0]?.v ?? 0) + 1;
      const [row] = await ctx.db
        .insert(schema.pageLayouts)
        .values({
          storeId,
          pageKey: input.pageKey,
          version: nextVersion,
          blocksJson: input.blocks,
          status: 'draft',
          createdBy: ctx.user.id,
        })
        .returning();
      return { layout: row };
    }),

  /**
   * publishLayout（owner）：草稿→published（同事务：旧 published→archived 连留痕 actedBy/At；
   * 已 published 幂等返回；非 draft 拒「仅草稿可发布」）——发布即客户端/收银台生效（liveLayout 数据源）。
   */
  publishLayout: merchantOwnerProcedure
    .input(z.object({ versionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        const txh = tx as unknown as typeof ctx.db;
        const target = (
          await txh.select().from(schema.pageLayouts).where(eq(schema.pageLayouts.id, input.versionId)).limit(1)
        )[0];
        if (!target || target.storeId !== storeId) throw new TRPCError({ code: 'NOT_FOUND', message: '布局版本不存在' });
        if (target.status === 'published') return { version: target.version, idempotent: true };
        if (target.status !== 'draft') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '仅草稿版可发布（历史版请走回退）' });
        }
        await txh
          .update(schema.pageLayouts)
          .set({ status: 'archived', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(
            and(
              eq(schema.pageLayouts.storeId, storeId),
              eq(schema.pageLayouts.pageKey, target.pageKey),
              eq(schema.pageLayouts.status, 'published'),
            ),
          );
        const [live] = await txh
          .update(schema.pageLayouts)
          .set({ status: 'published', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(eq(schema.pageLayouts.id, target.id))
          .returning();
        return { version: live!.version, idempotent: false };
      });
    }),

  /**
   * revertLayout（owner）：回上一版——当前 published→archived，最近一版（version 次新且非 draft）
   * →published（同 slot revert 工艺）；无上一版=400。
   */
  revertLayout: merchantOwnerProcedure
    .input(z.object({ pageKey: pageKeySchema }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const now = new Date();
      return ctx.db.transaction(async (tx) => {
        const txh = tx as unknown as typeof ctx.db;
        const cur = (
          await txh
            .select()
            .from(schema.pageLayouts)
            .where(
              and(
                eq(schema.pageLayouts.storeId, storeId),
                eq(schema.pageLayouts.pageKey, input.pageKey),
                eq(schema.pageLayouts.status, 'published'),
              ),
            )
            .limit(1)
        )[0];
        if (!cur) throw new TRPCError({ code: 'NOT_FOUND', message: '当前无线上版本' });
        const prev = (
          await txh
            .select()
            .from(schema.pageLayouts)
            .where(
              and(
                eq(schema.pageLayouts.storeId, storeId),
                eq(schema.pageLayouts.pageKey, input.pageKey),
                eq(schema.pageLayouts.version, cur.version - 1),
              ),
            )
            .limit(1)
        )[0] ?? (
          await txh
            .select()
            .from(schema.pageLayouts)
            .where(and(eq(schema.pageLayouts.storeId, storeId), eq(schema.pageLayouts.pageKey, input.pageKey)))
            .orderBy(desc(schema.pageLayouts.version))
            .limit(10)
        ).find((r) => r.version < cur.version && r.status !== 'draft');
        if (!prev) throw new TRPCError({ code: 'BAD_REQUEST', message: '无上一版可回退' });
        await txh
          .update(schema.pageLayouts)
          .set({ status: 'archived', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(eq(schema.pageLayouts.id, cur.id));
        const [live] = await txh
          .update(schema.pageLayouts)
          .set({ status: 'published', actedBy: ctx.user.id, actedAt: now, updatedAt: now })
          .where(eq(schema.pageLayouts.id, prev.id))
          .returning();
        return { version: live!.version, revertedFrom: cur.version };
      });
    }),
});
