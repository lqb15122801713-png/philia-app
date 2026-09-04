/**
 * serviceStep tRPC router —— 洗护六步状态机（T1.3b，全产品业务闭环核心）
 *
 * 状态机规则落点（开发方案 §3.2「服务六步确认流」规则 1-5，服务端强制）：
 * - 规则 1（任意时刻至多一个 active 步）：confirmStep / flagForRedo 事务内
 *   校验不变量（activeStepsInvariant），破坏即抛错回滚；见 assertSingleActive。
 * - 规则 2（仅 active 步可上传，locked/done 一律 FORBIDDEN）：addPhotos 状态闸门。
 * - 规则 3（confirm 校验未失效照片张数 ∈ [min,max]，before_after 步 before/after
 *   各 ≥1）：confirmStep 前置校验；张数口径只统计 invalidated_at IS NULL。
 * - 规则 4（第 6 步 confirm 三合一事务：step6 done + 预约 completed + 完成事件）：
 *   confirmStep 末步分支，三件事同一 db.transaction。
 * - 规则 5（flagForRedo 为唯一回退边，前置条件二选一 (a)/(b)）：flagForRedo；
 *   (b) 路径事务内 done→active + flagged=1 + 旧照片批量 invalidated_at=now。
 *
 * 事件（§7.3）：
 * - step_updated → appointment:{aid}，data={appointmentId, stepKey, status,
 *   photos:[{url,thumbUrl}], nextStepKey}（confirmStep 事务内 emitEvent，提交后 broadcastNow）
 * - step_flagged → staff:{staffId} + appointment:{aid} 双频道
 * - appointment.completed → appointment:{aid}
 */

import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type db } from '../db';
import { broadcastNow, emitEvent, type Db as BusDb } from '../realtime/bus';
import { EventType } from '../realtime/events';
import {
  assertAppointmentAccess,
  merchantProcedure,
  publicProcedure,
  router,
  staffProcedure,
  type Db,
} from '../trpc';

/* ------------------------------------------------------------------ */
/* 六步定义常量（来源：开发方案 §3.2 步骤定义表；顺序不可变，required_photos 快照存 min） */
/* ------------------------------------------------------------------ */

export const STEP_KEYS = [
  'disinfection',
  'precheck',
  'grooming',
  'detail',
  'before_after',
  'confirm',
] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export interface StepDef {
  stepKey: StepKey;
  stepOrder: number;
  /** 照片最少张数（confirm 校验下限；appointment_steps.required_photos 快照此值） */
  minPhotos: number;
  /** 照片最多张数（addPhotos/confirm 校验上限，防刷屏式滥传） */
  maxPhotos: number;
}

export const STEP_DEFS: ReadonlyArray<StepDef> = [
  { stepKey: 'disinfection', stepOrder: 1, minPhotos: 1, maxPhotos: 3 }, // 消毒工具确认
  { stepKey: 'precheck', stepOrder: 2, minPhotos: 2, maxPhotos: 6 }, // 预检
  { stepKey: 'grooming', stepOrder: 3, minPhotos: 3, maxPhotos: 9 }, // 洗澡美容
  { stepKey: 'detail', stepOrder: 4, minPhotos: 2, maxPhotos: 6 }, // 细节对比照
  { stepKey: 'before_after', stepOrder: 5, minPhotos: 2, maxPhotos: 2 }, // 前后对比照（before/after 各 1）
  { stepKey: 'confirm', stepOrder: 6, minPhotos: 0, maxPhotos: 0 }, // 完成确认（无需照片）
];

const StepKeySchema = z.enum(STEP_KEYS);
const PhotoTagSchema = z.enum(['normal', 'before', 'after']);

const defOf = (stepKey: StepKey): StepDef => STEP_DEFS.find((d) => d.stepKey === stepKey)!;
const nextDefOf = (def: StepDef): StepDef | null =>
  STEP_DEFS.find((d) => d.stepOrder === def.stepOrder + 1) ?? null;

/* ------------------------------------------------------------------ */
/* 内部工具                                                            */
/* ------------------------------------------------------------------ */

/**
 * 查询/写入最小接口：全局 db 与事务 handle 结构上都满足。
 * （emitEvent 的形参是完整 BusDb 且要求 batch 方法，事务 handle 没有 batch——
 *   仅在 emitEvent 调用点做一次收窄，见 txBus()；emitEvent 内部只用 select/insert。）
 */
type Q = Pick<BusDb, 'select' | 'insert' | 'update'>;
const txBus = (tx: Q): BusDb => tx as unknown as BusDb;

/** 事务 handle 类型（供 insertInitialSteps 给 T1.3a appointment.checkin 复用） */
export type StepTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 步骤中文名（报错文案用，与 realtime/events.ts StepKeyLabel 对齐） */
const StepLabel: Record<StepKey, string> = {
  disinfection: '消毒',
  precheck: '预检',
  grooming: '洗护',
  detail: '精修',
  before_after: '前后对比照',
  confirm: '完成确认',
};

/** 加载某预约的指定步骤；不存在（未核销初始化/ boarding 类）抛 NOT_FOUND */
async function loadStep(d: Q, appointmentId: string, stepKey: StepKey) {
  const step = await d
    .select()
    .from(schema.appointmentSteps)
    .where(
      and(
        eq(schema.appointmentSteps.appointmentId, appointmentId),
        eq(schema.appointmentSteps.stepKey, stepKey),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!step) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `该预约不存在「${StepLabel[stepKey]}」步骤（可能尚未核销初始化六步流）`,
    });
  }
  return step;
}

/** 未失效照片（invalidated_at IS NULL），按 taken_at 升序（id 升序兜底同秒并列） */
function validPhotosOf(d: Q, stepId: string) {
  return d
    .select()
    .from(schema.stepPhotos)
    .where(and(eq(schema.stepPhotos.stepId, stepId), isNull(schema.stepPhotos.invalidatedAt)))
    .orderBy(asc(schema.stepPhotos.takenAt), asc(schema.stepPhotos.id));
}

/** 当前全部 active 步（规则 1 不变量校验用） */
function activeStepsOf(d: Q, appointmentId: string) {
  return d
    .select({ id: schema.appointmentSteps.id, stepKey: schema.appointmentSteps.stepKey })
    .from(schema.appointmentSteps)
    .where(
      and(
        eq(schema.appointmentSteps.appointmentId, appointmentId),
        eq(schema.appointmentSteps.status, 'active'),
      ),
    );
}

/** 规则 1 不变量守护：至多一个 active 步；expectOne=true 时要求恰好一个。破坏即抛错（事务内抛错=回滚） */
async function assertActiveInvariant(d: Q, appointmentId: string, expectOne: boolean) {
  const actives = await activeStepsOf(d, appointmentId);
  const broken = expectOne ? actives.length !== 1 : actives.length > 1;
  if (broken) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `状态机不变量破坏：预约 ${appointmentId} 当前存在 ${actives.length} 个 active 步骤，已回滚`,
    });
  }
  return actives;
}

/** 宠物名（事件/通知文案用；查不到返回 undefined，不阻断主流程） */
async function petNameOf(d: Q, petId: string): Promise<string | undefined> {
  const pet = await d
    .select({ name: schema.pets.name })
    .from(schema.pets)
    .where(eq(schema.pets.id, petId))
    .get();
  return pet?.name ?? undefined;
}

/* ------------------------------------------------------------------ */
/* 供 appointment.checkin（T1.3a）事务内初始化六步：step1 active，其余 locked */
/* ------------------------------------------------------------------ */

export async function insertInitialSteps(tx: StepTx, appointmentId: string): Promise<void> {
  const now = new Date();
  await tx.insert(schema.appointmentSteps).values(
    STEP_DEFS.map((d) => ({
      appointmentId,
      stepKey: d.stepKey,
      stepOrder: d.stepOrder,
      status: d.stepOrder === 1 ? 'active' : 'locked',
      requiredPhotos: d.minPhotos, // §3.2 张数口径：required_photos 快照存 min 值
      startedAt: d.stepOrder === 1 ? now : null,
    })),
  );
}

/* ------------------------------------------------------------------ */
/* serviceStep router                                                  */
/* ------------------------------------------------------------------ */

export const serviceStepRouter = router({
  /**
   * 六步状态 + 每步未失效照片（实时页首屏）。
   * 权限：customer/staff/merchant（assertAppointmentAccess 归属校验）。
   */
  list: publicProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertAppointmentAccess(ctx, input.appointmentId);
      const steps = await ctx.db
        .select()
        .from(schema.appointmentSteps)
        .where(eq(schema.appointmentSteps.appointmentId, input.appointmentId))
        .orderBy(asc(schema.appointmentSteps.stepOrder));

      const stepIds = steps.map((s) => s.id);
      const photos =
        stepIds.length === 0
          ? []
          : await ctx.db
              .select()
              .from(schema.stepPhotos)
              .where(
                and(
                  inArray(schema.stepPhotos.stepId, stepIds),
                  isNull(schema.stepPhotos.invalidatedAt), // 仅未失效照片
                ),
              )
              .orderBy(asc(schema.stepPhotos.takenAt), asc(schema.stepPhotos.id));

      const byStep = new Map<string, typeof photos>();
      for (const p of photos) {
        const arr = byStep.get(p.stepId);
        if (arr) arr.push(p);
        else byStep.set(p.stepId, [p]);
      }
      return steps.map((s) => ({ ...s, photos: byStep.get(s.id) ?? [] }));
    }),

  /**
   * 登记步骤照片（员工上传成功后调用）。
   * 规则 2：仅 active 步开放，locked/done 一律 FORBIDDEN；
   * 归属：本店且（未指派或指派给自己）（assertAppointmentAccess staff 分支）；
   * 上限：未失效照片总数（含本次）不得超 max，超限 BAD_REQUEST；
   * before_after 步每张照片必须带 before/after 标签；staff 未开始时补写 started_at。
   */
  addPhotos: staffProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        stepKey: StepKeySchema,
        photos: z
          .array(
            z.object({
              url: z.string().min(1).max(1024),
              thumbUrl: z.string().min(1).max(1024).optional(),
              tag: PhotoTagSchema.default('normal'),
            }),
          )
          .min(1)
          .max(9),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAppointmentAccess(ctx, input.appointmentId);
      const def = defOf(input.stepKey);
      const step = await loadStep(ctx.db, input.appointmentId, input.stepKey);

      // 规则 2：仅 active 步开放
      if (step.status !== 'active') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `「${StepLabel[input.stepKey]}」步骤当前为 ${step.status} 状态，仅进行中（active）的步骤可上传照片`,
        });
      }
      // before_after 步必须带 before/after 标签
      if (input.stepKey === 'before_after' && input.photos.some((p) => p.tag === 'normal')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '前后对比照必须为每张照片标记 before / after 标签',
        });
      }

      const now = new Date();
      return await ctx.db.transaction(async (tx) => {
        // max 上限（未失效口径，事务内复查防并发超限）
        const existing = await validPhotosOf(tx, step.id);
        if (existing.length + input.photos.length > def.maxPhotos) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `「${StepLabel[input.stepKey]}」步骤照片上限 ${def.maxPhotos} 张：当前未失效 ${existing.length} 张，本次 ${input.photos.length} 张超出上限`,
          });
        }
        const inserted = await tx
          .insert(schema.stepPhotos)
          .values(
            input.photos.map((p) => ({
              stepId: step.id,
              url: p.url,
              thumbUrl: p.thumbUrl ?? null,
              tag: p.tag,
              takenBy: ctx.user.id,
              takenAt: now,
            })),
          )
          .returning();
        // staff 未开始时写 started_at
        if (!step.startedAt) {
          await tx
            .update(schema.appointmentSteps)
            .set({ startedAt: now, updatedAt: now })
            .where(eq(schema.appointmentSteps.id, step.id));
        }
        return {
          stepId: step.id,
          added: inserted.length,
          totalValid: existing.length + inserted.length,
          minPhotos: def.minPhotos,
          maxPhotos: def.maxPhotos,
          photos: inserted,
        };
      });
    }),

  /**
   * 确认本步完成（员工）。
   * 规则 3：未失效照片张数 ∈ [min,max]，before_after 步 before/after 各 ≥1；
   * 事务：本步 done（写 done_at、清 flagged）→ 下一步 locked→active（写 started_at）；
   * 规则 4：第 6 步为事务三合一（step6 done + 预约 in_service→completed 写 completed_at
   *        + appointment.completed 事件）；
   * 规则 1：事务内校验「恰好一个 active 且就是本步」不变量，破坏即回滚；
   * 每步完成事务内 emitEvent(step_updated) → 提交后 broadcastNow。
   */
  confirmStep: staffProcedure
    .input(z.object({ appointmentId: z.string().min(1), stepKey: StepKeySchema }))
    .mutation(async ({ ctx, input }) => {
      const appt = await assertAppointmentAccess(ctx, input.appointmentId);
      const def = defOf(input.stepKey);
      const step = await loadStep(ctx.db, input.appointmentId, input.stepKey);

      // 仅 active 步可确认完成
      if (step.status !== 'active') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `「${StepLabel[input.stepKey]}」步骤当前为 ${step.status} 状态，仅进行中（active）的步骤可确认完成`,
        });
      }

      // 规则 3：未失效照片张数 ∈ [min,max]
      const valid = await validPhotosOf(ctx.db, step.id);
      if (valid.length > def.maxPhotos) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `照片超出上限：「${StepLabel[input.stepKey]}」最多 ${def.maxPhotos} 张，当前未失效 ${valid.length} 张`,
        });
      }
      // before_after 步：before/after 各 ≥1（先于张数下限校验，给出更可操作的提示）
      if (input.stepKey === 'before_after') {
        const beforeCnt = valid.filter((p) => p.tag === 'before').length;
        const afterCnt = valid.filter((p) => p.tag === 'after').length;
        if (beforeCnt < 1 || afterCnt < 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `前后对比照需 before / after 各至少 1 张未失效照片（当前 before ${beforeCnt} 张、after ${afterCnt} 张）`,
          });
        }
      }
      if (valid.length < def.minPhotos) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `照片不足：还差 ${def.minPhotos - valid.length} 张（「${StepLabel[input.stepKey]}」需 ${def.minPhotos}-${def.maxPhotos} 张未失效照片，当前 ${valid.length} 张）`,
        });
      }

      const nextDef = nextDefOf(def);
      const petName = await petNameOf(ctx.db, appt.petId);
      const now = new Date();
      const photoPayload = valid.map((p) => ({ url: p.url, thumbUrl: p.thumbUrl ?? null }));

      const outboxIds = await ctx.db.transaction(async (tx) => {
        // 规则 1 不变量：事务内复查——必须恰好 1 个 active 步且就是本步，否则回滚
        const actives = await assertActiveInvariant(tx, input.appointmentId, true);
        if (actives[0]!.id !== step.id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '当前进行中步骤与本步不一致，请刷新后重试（已回滚）',
          });
        }

        // 本步 done（写 done_at、清 flagged）
        await tx
          .update(schema.appointmentSteps)
          .set({ status: 'done', doneAt: now, flagged: false, updatedAt: now })
          .where(eq(schema.appointmentSteps.id, step.id));

        let isFinalStep = false;
        if (!nextDef) {
          // 规则 4：第 6 步三合一——预约 in_service→completed（写 completed_at）+ 完成事件
          const apptRow = await tx
            .select({ status: schema.appointments.status })
            .from(schema.appointments)
            .where(eq(schema.appointments.id, appt.id))
            .get();
          if (apptRow?.status !== 'in_service') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `预约当前状态为 ${apptRow?.status ?? '未知'}，仅服务中（in_service）可确认完成`,
            });
          }
          await tx
            .update(schema.appointments)
            .set({ status: 'completed', completedAt: now, updatedAt: now })
            .where(eq(schema.appointments.id, appt.id));
          isFinalStep = true;
          // 注：completed 事件在 step_updated 之后发射（T1.6 修复）——SSE 续传去重依赖
          // 事件 id 单调序 = 广播序，先发射 step_updated 才能保证 completed 不被过滤。
        } else {
          // 下一步 locked → active（写 started_at）
          await tx
            .update(schema.appointmentSteps)
            .set({ status: 'active', startedAt: now, updatedAt: now })
            .where(
              and(
                eq(schema.appointmentSteps.appointmentId, input.appointmentId),
                eq(schema.appointmentSteps.stepKey, nextDef.stepKey),
                eq(schema.appointmentSteps.status, 'locked'),
              ),
            );
        }

        // §7.3 step_updated 载荷：{appointmentId, stepKey, status, photos[{url,thumbUrl}], nextStepKey}
        const stepUpdatedId = await emitEvent(
          txBus(tx),
          `appointment:${appt.id}`,
          EventType.StepUpdated,
          {
            appointmentId: appt.id,
            petName,
            stepKey: input.stepKey,
            status: 'done',
            photos: photoPayload,
            nextStepKey: nextDef?.stepKey ?? null,
          },
        );
        // 末步：step_updated 之后发射 completed（保持 outbox id 单调序 = 广播序）
        const completedOutboxId = isFinalStep
          ? await emitEvent(txBus(tx), `appointment:${appt.id}`, EventType.AppointmentCompleted, {
              appointmentId: appt.id,
              petName,
              status: 'completed',
            })
          : null;
        return completedOutboxId ? [stepUpdatedId, completedOutboxId] : [stepUpdatedId];
      });

      for (const id of outboxIds) broadcastNow(id); // 事务提交后即时广播（fire-and-forget）
      return {
        stepKey: input.stepKey,
        status: 'done' as const,
        nextStepKey: nextDef?.stepKey ?? null,
        appointmentCompleted: nextDef === null,
      };
    }),

  /**
   * 商家打标重拍（规则 5：状态机唯一合法回退边）。
   * 前置条件二选一：
   *  (a) 目标步为当前 active 步 → 仅置 flagged=1（不动照片）；
   *  (b) 目标步为 step_order 最大的 done 步且其后全部 locked（即当前无 active 步）
   *      → 事务内 done→active + flagged=1 + 该步未失效照片批量 invalidated_at=now；
   * 其他情况一律拒绝。规则 1 不变量事务内校验。事件 step_flagged → staff + appointment 双频道。
   */
  flagForRedo: merchantProcedure
    .input(
      z.object({
        appointmentId: z.string().min(1),
        stepKey: StepKeySchema,
        reason: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appt = await assertAppointmentAccess(ctx, input.appointmentId); // merchant 本店
      await loadStep(ctx.db, input.appointmentId, input.stepKey); // NOT_FOUND 早退
      const petName = await petNameOf(ctx.db, appt.petId);
      const now = new Date();

      const { outboxIds, reactivated, invalidatedCount } = await ctx.db.transaction(
        async (tx) => {
          // 规则 1 不变量预检：存在多个 active 步直接回滚
          const actives = await assertActiveInvariant(tx, input.appointmentId, false);
          const steps = await tx
            .select()
            .from(schema.appointmentSteps)
            .where(eq(schema.appointmentSteps.appointmentId, input.appointmentId))
            .orderBy(asc(schema.appointmentSteps.stepOrder));
          const target = steps.find((s) => s.stepKey === input.stepKey)!;

          let didReactivate = false;
          let invalidated = 0;

          if (target.status === 'active') {
            // 路径 (a)：目标步为当前 active 步 → 仅置 flagged=1（重新打标/催拍，不动照片）
            await tx
              .update(schema.appointmentSteps)
              .set({ flagged: true, updatedAt: now })
              .where(eq(schema.appointmentSteps.id, target.id));
          } else if (target.status === 'done') {
            // 路径 (b)：目标步为最新一个 done 步（step_order 最大）且其后全部 locked
            const doneSteps = steps.filter((s) => s.status === 'done');
            const latestDone = doneSteps[doneSteps.length - 1];
            const allLaterLocked = steps
              .filter((s) => s.stepOrder > target.stepOrder)
              .every((s) => s.status === 'locked');
            // (b) 场景其后全 locked ⇒ 原 active 步不存在才合法
            if (latestDone?.id !== target.id || !allLaterLocked || actives.length !== 0) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message:
                  '仅支持对「当前进行中步骤」或「最新一个已完成且其后步骤均未开始的步骤」打标重拍',
              });
            }
            // 事务内 done → active + flagged=1 + 清 done_at
            await tx
              .update(schema.appointmentSteps)
              .set({ status: 'active', flagged: true, doneAt: null, updatedAt: now })
              .where(eq(schema.appointmentSteps.id, target.id));
            // 该步已有未失效照片批量 invalidated_at=now（保留可查、不计入张数校验）
            const voided = await tx
              .update(schema.stepPhotos)
              .set({ invalidatedAt: now, updatedAt: now })
              .where(
                and(
                  eq(schema.stepPhotos.stepId, target.id),
                  isNull(schema.stepPhotos.invalidatedAt),
                ),
              )
              .returning({ id: schema.stepPhotos.id });
            invalidated = voided.length;
            didReactivate = true;
            // 规则 1 不变量复检：回退后必须恰好 1 个 active 步（即目标步）
            const after = await assertActiveInvariant(tx, input.appointmentId, true);
            if (after[0]!.id !== target.id) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: '状态机不变量破坏：打标回退后 active 步骤异常，已回滚',
              });
            }
          } else {
            // locked 步：拒绝
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `「${StepLabel[input.stepKey]}」步骤尚未开始（locked），无需打标重拍`,
            });
          }

          // step_flagged → staff 与 appointment 双频道（§7.3）
          const data = {
            appointmentId: appt.id,
            petName,
            stepKey: input.stepKey,
            status: 'active' as const,
            flagged: true,
            reason: input.reason ?? null,
          };
          const ids = [await emitEvent(txBus(tx), `appointment:${appt.id}`, EventType.StepFlagged, data)];
          if (appt.staffId) {
            ids.push(await emitEvent(txBus(tx), `staff:${appt.staffId}`, EventType.StepFlagged, data));
          }
          return { outboxIds: ids, reactivated: didReactivate, invalidatedCount: invalidated };
        },
      );

      for (const id of outboxIds) broadcastNow(id);
      return { stepKey: input.stepKey, flagged: true as const, reactivated, invalidatedCount };
    }),

  /**
   * 轻量进度（philia 光环 / 列表角标轮询兜底）。
   * 权限：复用 assertAppointmentAccess（本人客户/本店员工/本店商家）。
   */
  progressSummary: publicProcedure
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const appt = await assertAppointmentAccess(ctx, input.appointmentId);
      const steps = await ctx.db
        .select({
          stepKey: schema.appointmentSteps.stepKey,
          status: schema.appointmentSteps.status,
        })
        .from(schema.appointmentSteps)
        .where(eq(schema.appointmentSteps.appointmentId, input.appointmentId))
        .orderBy(asc(schema.appointmentSteps.stepOrder));
      const current = steps.find((s) => s.status === 'active');
      return {
        currentStepKey: (current?.stepKey ?? null) as StepKey | null,
        doneCount: steps.filter((s) => s.status === 'done').length,
        total: STEP_DEFS.length, // 6
        status: appt.status,
      };
    }),
});

export type ServiceStepRouter = typeof serviceStepRouter;
