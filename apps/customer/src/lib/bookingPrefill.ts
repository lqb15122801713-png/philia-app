/**
 * B4-3 默认值预填体系：上次成功下单记忆（localStorage）+ 默认值解析。
 *
 * 优先级（任务书 B4-3）：
 *   URL ?storeId/?serviceId/?petId 预填参数（批次 2 现状逻辑，最高优先）
 *   > localStorage 上次成功下单记忆
 *   > 无历史默认：门店=listNearby 第一家（最近门店）/ 服务=该店首个在架项 /
 *     宠物=唯一宠物直选（多宠物不替选，宠物卡显示「请选择」）。
 *
 * 写入时机：预约提交成功（appointment.create onSuccess）时记录当次
 *   {storeId, serviceId, petId}，下次进单屏即预填。
 *
 * Philia 中按钮长按「一键预约」与完成单「再次预约」入口交互不变——它们仍跳
 *   /booking/grooming?serviceId=&storeId=(&petId=)，URL 预填优先级最高，同源生效。
 *
 * 纯函数 + localStorage 读写，无 React 依赖，寄养单屏（B4-2）可直接复用。
 */

export interface LastBooking {
  storeId?: string;
  serviceId?: string;
  petId?: string;
}

const KEY = 'philia:lastBooking';

/** 读取上次成功下单记忆；解析失败/无记录返回 null（不抛错） */
export function readLastBooking(): LastBooking | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as LastBooking;
    if (typeof obj !== 'object' || obj === null) return null;
    return {
      storeId: typeof obj.storeId === 'string' ? obj.storeId : undefined,
      serviceId: typeof obj.serviceId === 'string' ? obj.serviceId : undefined,
      petId: typeof obj.petId === 'string' ? obj.petId : undefined,
    };
  } catch {
    return null;
  }
}

/** 预约成功后写入记忆（覆盖式——「上次成功下单」语义） */
export function writeLastBooking(b: Required<Pick<LastBooking, 'storeId' | 'serviceId' | 'petId'>>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // 隐私模式等写入失败不影响下单主流程
  }
}

/**
 * 解析门店预填：URL 值有效则保留；否则上次记忆有效则用；否则列表第一家（最近门店）。
 * @returns 应选中的 storeId（列表为空返回 null）
 */
export function resolveStoreId(
  current: string | null,
  stores: { id: string }[],
  last: LastBooking | null,
): string | null {
  if (current && stores.some((s) => s.id === current)) return current;
  if (last?.storeId && stores.some((s) => s.id === last.storeId)) return last.storeId;
  return stores[0]?.id ?? null;
}

/**
 * 解析服务预填：URL 值有效则保留；否则上次记忆有效则用；否则首个在架项（推荐位）。
 * @returns 应选中的 serviceId（无可约项返回 null）
 */
export function resolveServiceId(
  current: string | null,
  services: { id: string }[],
  last: LastBooking | null,
): string | null {
  if (current && services.some((s) => s.id === current)) return current;
  if (last?.serviceId && services.some((s) => s.id === last.serviceId)) return last.serviceId;
  return services[0]?.id ?? null;
}

/**
 * 解析宠物预填：URL 值有效则保留；否则上次记忆有效则用；否则唯一宠物直选；
 * 多宠物不替用户选（返回 null，宠物卡显示「请选择」）。
 */
export function resolvePetId(
  current: string | null,
  pets: { id: string }[],
  last: LastBooking | null,
): string | null {
  if (current && pets.some((p) => p.id === current)) return current;
  if (last?.petId && pets.some((p) => p.id === last.petId)) return last.petId;
  if (pets.length === 1) return pets[0]!.id;
  return null;
}
