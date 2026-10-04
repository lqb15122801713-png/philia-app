/**
 * 体验大批片 2 · server 契约封装（coder O 端点已落，直调无断言）：
 * - appointment.create 入参加 addonServiceIds / emergencyContact / medicalAuth
 *   （寄养缺 = 400 硬闸）/ walkTimesPerDay（寄养选填 >0）；
 * - appointment.get 响应加 addons / rescheduleLogs；
 * - appointment.cancelFeeTiers（端口值读口）/ appointment.prepaidOf（{record} 包壳）；
 * - store.fullAlternatives（定死形状 enabled=false，只渲染 note）；
 * - pet.upsert 入参加 vaccineProofUrls。
 * 页面侧统一走本模块，契约再漂移时只改这里。
 */

import type { PhiliaClient } from '@philia/shared';
import type { AppointmentCreateInput, AppointmentDetail } from '@/components/booking/types';

type Trpc = PhiliaClient['trpc'];

/** 取消阶梯收费档（cancelFeeTiers 端口值；feeBp=万分比） */
export interface CancelFeeTier {
  hoursBefore: number;
  feeBp: number;
  label: string;
}

/** 改约历史行（appointment.get 响应扩展） */
export type RescheduleLogView = AppointmentDetail['rescheduleLogs'][number];

/** 附加项快照行（appointment.get 响应扩展） */
export type AddonLineView = AppointmentDetail['addons'][number];

/** 预付台账行（四态徽只用 status；其余字段透出预留） */
export type PrepaidRecordView = NonNullable<
  Awaited<ReturnType<Trpc['appointment']['prepaidOf']['query']>>['record']
>;

/** appointment.create（片 2 契约入参；返回行取 id 供成功页跳转） */
export async function createAppointmentExp2(
  trpc: Trpc,
  input: AppointmentCreateInput,
): Promise<{ id: string }> {
  return trpc.appointment.create.mutate(input);
}

/** appointment.cancelFeeTiers（端口值；空档=无公示，调用方不渲染） */
export function queryCancelFeeTiers(trpc: Trpc): Promise<{ tiers: CancelFeeTier[] }> {
  return trpc.appointment.cancelFeeTiers.query();
}

/** appointment.prepaidOf（响应 {record} 包壳摊平：无登记 → null） */
export async function queryPrepaidOf(trpc: Trpc, appointmentId: string): Promise<PrepaidRecordView | null> {
  const res = await trpc.appointment.prepaidOf.query({ appointmentId });
  return res.record;
}

/** store.fullAlternatives（满档替代推荐，形状定死 enabled=false） */
export function queryFullAlternatives(trpc: Trpc, storeId: string, date: Date) {
  return trpc.store.fullAlternatives.query({ storeId, date });
}

/** pet.upsert（契约入参加 vaccineProofUrls） */
export function upsertPetExp2(
  trpc: Trpc,
  input: Parameters<Trpc['pet']['upsert']['mutate']>[0],
): Promise<{ pet: { id: string } }> {
  return trpc.pet.upsert.mutate(input);
}

/** appointment.get 响应扩展读取（addons / rescheduleLogs；缺省空数组，空态不渲染由调用方判） */
export function readDetailExtras(d: AppointmentDetail | undefined): {
  addons: AddonLineView[];
  rescheduleLogs: RescheduleLogView[];
} {
  return {
    addons: d?.addons ?? [],
    rescheduleLogs: d?.rescheduleLogs ?? [],
  };
}
