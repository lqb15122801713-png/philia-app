/**
 * B9a 任务 C · 时长引擎（服务时长由「猫犬 / 体型 / 毛长」驱动，替代写死的
 * services.duration_min）。
 *
 * ⚠️ 占位声明（PR 报告同步标注）：本文件全部数值与推导规则均为【占位，待老板供给】
 * ——基础时长、体型/毛长系数、体重分档阈值、长毛品种关键词表、服务种类关键词表
 * 在产品侧给出正式供给表之前仅用于打通链路；届时【只改本文件，不改任何调用代码】
 * （规则表可配置口径：server 侧常量文件，改表不改码，不做管理后台界面）。
 *
 * 作用点（任务书口径）：
 *  1) appointment.create：grooming 的 scheduledEnd 一律以本引擎输出为准
 *     （客户端传入的 scheduledEnd 对 grooming 不再生效；boarding 不动，仍必传
 *     scheduledEnd 按晚计费）；槽位占用按引擎输出时长覆盖的连续 30min 槽逐个占用。
 *  2) store.getWithServices：可选入参 petId —— 传入时按该宠物逐服务输出引擎时长
 *     （响应扩展 serviceDurations 字段），且可约槽「时长连续」过滤的 slotsNeeded
 *     改用引擎输出（不传 petId 时行为与之前完全一致，按 services.duration_min）。
 *  3) 前端单屏确认条 / 首页一键面板「约 N 分钟」读取 serviceDurations 联动显示。
 *
 * 回退口径（任务书：不阻断下单）：以下任一成立即回退服务默认 durationMin
 * （source='default'，fallbackReason 注明原因）——
 *   服务非 grooming（寄养按晚计费，本引擎不介入）/ 无宠物档案 / 物种非犬猫 /
 *   缺体重（无法分体型档）/ 缺品种（无法推毛长）/ 服务名未命中洗澡/美容关键词。
 */

import type { schema } from '../db';

/** 槽位粒度（分钟）：与 store_slots 30min 栅格一致（非占位，属既有栅格契约） */
export const DURATION_SLOT_MIN = 30;

/* ------------------------------------------------------------------ */
/* 规则表（全部【占位，待老板供给】；调整供给 = 只改本区常量）             */
/* ------------------------------------------------------------------ */

/** 服务种类关键词（服务名命中即归类；谁先命中谁优先：bath 先于 groom 判定）【占位，待老板供给】 */
export const SERVICE_KIND_KEYWORDS = {
  bath: ['洗', '浴', 'SPA', 'spa', '清洁', '吹干'],
  groom: ['美容', '造型', '修剪', '修毛', '剪'],
} as const;

/** 基础时长（分钟）：物种 × 服务种类【占位，待老板供给】 */
export const BASE_DURATION_MIN = {
  dog: { bath: 60, groom: 90 },
  cat: { bath: 90, groom: 120 },
} as const;

/** 体型系数【占位，待老板供给】 */
export const SIZE_COEF = { small: 1.0, medium: 1.5, large: 2.0 } as const;

/** 毛长系数【占位，待老板供给】 */
export const COAT_COEF = { short: 1.0, long: 1.25 } as const;

/**
 * 体型分档阈值（按 pets.weight_kg，单位 kg）：weight < smallMax → 小；
 * smallMax ≤ weight ≤ mediumMax → 中；> mediumMax → 大。【占位，待老板供给】
 * 推导规则说明：pets 表现无「体型档」结构化列（本任务不新增 pets 列），
 * 故按体重阈值在引擎内推导，阈值随供给表一并调整。
 */
export const SIZE_TIER_WEIGHT_KG = {
  dog: { smallMax: 10, mediumMax: 25 },
  cat: { smallMax: 5, mediumMax: 10 },
} as const;

/**
 * 长毛品种关键词（pets.breed 子串命中即判长毛，未命中判短毛）【占位，待老板供给】。
 * 推导规则说明：pets 表无「毛长档」结构化列（本任务不新增 pets 列），
 * 故按品种关键词在引擎内推导，词表随供给表一并调整。
 */
export const LONG_COAT_BREED_KEYWORDS = [
  '金毛', '萨摩', '阿拉斯加', '哈士奇', '二哈', '边牧', '边境牧羊', '苏牧', '苏格兰牧羊',
  '古牧', '古代牧羊', '松狮', '博美', '比熊', '泰迪', '贵宾', '雪纳瑞', '喜乐蒂', '藏獒',
  '布偶', '波斯', '缅因', '挪威森林', '西森', '金吉拉', '英长', '英国长毛', '长毛',
] as const;

/* ------------------------------------------------------------------ */
/* 推导（纯函数；规则表以上述常量为准）                                    */
/* ------------------------------------------------------------------ */

type Species = keyof typeof BASE_DURATION_MIN; // 'dog' | 'cat'
type ServiceKind = keyof (typeof BASE_DURATION_MIN)['dog']; // 'bath' | 'groom'
type SizeTier = keyof typeof SIZE_COEF;
type CoatLen = keyof typeof COAT_COEF;

export interface PetDurationProfile {
  species: string | null | undefined;
  breed: string | null | undefined;
  weightKg: number | null | undefined;
}

export interface ServiceDurationInput {
  type: string;
  name: string;
  durationMin: number | null;
}

export interface ServiceDuration {
  /** 生效时长（分钟，30min 向上取整后）；boarding 恒 null（按晚计费，不涉引擎） */
  durationMin: number | null;
  /** 占槽块数 = ceil(durationMin / 30min)；boarding 恒 null */
  slotsNeeded: number | null;
  /** engine = 引擎输出（含 30min 向上取整）；default = 回退服务默认 durationMin */
  source: 'engine' | 'default';
  /** 引擎未取整原始值（仅 engine 路径；验收/调试对照用） */
  rawMin?: number;
  /** 引擎推导明细（仅 engine 路径） */
  detail?: {
    species: Species;
    kind: ServiceKind;
    sizeTier: SizeTier;
    coat: CoatLen;
    baseMin: number;
    sizeCoef: number;
    coatCoef: number;
  };
  /** 回退原因（仅 default 路径） */
  fallbackReason?: string;
}

/** 服务名 → 服务种类（关键词命中；未命中返回 null → 回退默认时长） */
export function classifyServiceKind(serviceName: string): ServiceKind | null {
  const name = serviceName.toLowerCase();
  for (const kw of SERVICE_KIND_KEYWORDS.bath) {
    if (name.includes(kw.toLowerCase())) return 'bath';
  }
  for (const kw of SERVICE_KIND_KEYWORDS.groom) {
    if (name.includes(kw.toLowerCase())) return 'groom';
  }
  return null;
}

/** 体重 → 体型档（阈值见 SIZE_TIER_WEIGHT_KG【占位】） */
export function deriveSizeTier(species: Species, weightKg: number): SizeTier {
  const t = SIZE_TIER_WEIGHT_KG[species];
  if (weightKg < t.smallMax) return 'small';
  if (weightKg <= t.mediumMax) return 'medium';
  return 'large';
}

/** 品种 → 毛长档（关键词表见 LONG_COAT_BREED_KEYWORDS【占位】；未命中判短毛） */
export function deriveCoatLength(breed: string): CoatLen {
  const b = breed.toLowerCase();
  return LONG_COAT_BREED_KEYWORDS.some((kw) => b.includes(kw.toLowerCase())) ? 'long' : 'short';
}

/** 回退默认时长（source='default'）：boarding → null；grooming → durationMin ?? 60 */
function fallback(service: ServiceDurationInput, reason: string): ServiceDuration {
  if (service.type !== 'grooming') {
    return { durationMin: null, slotsNeeded: null, source: 'default', fallbackReason: reason };
  }
  const durationMin = service.durationMin ?? 60;
  return {
    durationMin,
    slotsNeeded: Math.max(1, Math.ceil(durationMin / DURATION_SLOT_MIN)),
    source: 'default',
    fallbackReason: reason,
  };
}

/**
 * 时长引擎主入口（纯函数，不查库）：
 * engine：rawMin = 基础时长 × 体型系数 × 毛长系数；durationMin = rawMin 按 30min
 * 向上取整；slotsNeeded = durationMin / 30。
 * 边界示例（验收锚点）：大型长毛犬美容 = 90 × 2.0 × 1.25 = 225min → 240min / 8 槽。
 */
export function resolveServiceDuration(
  service: ServiceDurationInput,
  pet: PetDurationProfile | null | undefined,
): ServiceDuration {
  if (service.type !== 'grooming') return fallback(service, '寄养按晚计费，时长引擎不介入');
  if (!pet) return fallback(service, '无宠物档案');
  const species = pet.species === 'dog' || pet.species === 'cat' ? pet.species : null;
  if (!species) return fallback(service, `物种非犬猫（${pet.species ?? '空'}）`);
  if (typeof pet.weightKg !== 'number' || !Number.isFinite(pet.weightKg) || pet.weightKg <= 0) {
    return fallback(service, '缺体重，无法推导体型档');
  }
  if (!pet.breed || pet.breed.trim() === '') return fallback(service, '缺品种，无法推导毛长档');
  const kind = classifyServiceKind(service.name);
  if (!kind) return fallback(service, '服务名未命中洗澡/美容关键词');

  const sizeTier = deriveSizeTier(species, pet.weightKg);
  const coat = deriveCoatLength(pet.breed);
  const baseMin = BASE_DURATION_MIN[species][kind];
  const sizeCoef = SIZE_COEF[sizeTier];
  const coatCoef = COAT_COEF[coat];
  const rawMin = baseMin * sizeCoef * coatCoef;
  const durationMin = Math.ceil(rawMin / DURATION_SLOT_MIN) * DURATION_SLOT_MIN;
  return {
    durationMin,
    slotsNeeded: durationMin / DURATION_SLOT_MIN,
    source: 'engine',
    rawMin,
    detail: { species, kind, sizeTier, coat, baseMin, sizeCoef, coatCoef },
  };
}

/** 宠物行类型别名（drizzle pets 表） */
export type PetRow = typeof schema.pets.$inferSelect;
