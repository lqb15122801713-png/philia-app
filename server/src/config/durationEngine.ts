/**
 * B9a 任务 C · 时长引擎（服务时长由「猫犬 / 体型 / 毛长」驱动，替代写死的
 * services.duration_min）。
 *
 * 补充令①（时长系数表配置化，决策 #39/#40）：全部系数（物种×服务种类基础时长、
 * 体型/毛长系数、体重分档阈值、长毛品种关键词、服务种类关键词）已从代码常量迁移
 * 至 duration_rules 配置表（初始种子=原占位常量照转，label 注「占位待供给」）——
 * 本文件只剩纯函数与取数装配，引擎逻辑不动；老板端配置端口（config.save domain=
 * 'duration'）保存即生效、版本化留痕，新值只管修改后新产生的预约/时长计算，不回溯。
 * G0 洗护判别（决策 #40）与时长引擎共用 duration_service_kind_keywords 一张关键词表。
 *
 * 作用点（任务书口径）：
 *  1) appointment.create/reschedule：grooming 的 scheduledEnd 一律以本引擎输出为准
 *     （客户端传入的 scheduledEnd 对 grooming 不生效；boarding 不动，按晚计费）；
 *  2) store.getWithServices：可选入参 petId —— 传入时按该宠物逐服务输出引擎时长
 *     （响应扩展 serviceDurations），可约槽「时长连续」过滤的 slotsNeeded 改用引擎输出；
 *  3) 前端单屏确认条 / 首页一键面板「约 N 分钟」读取 serviceDurations 联动显示。
 *
 * 回退口径（任务书：不阻断下单）：以下任一成立即回退服务默认 durationMin
 * （source='default'，fallbackReason 注明原因）——
 *   服务非 grooming / 无宠物档案 / 物种非犬猫 / 缺体重 / 缺品种 /
 *   服务名未命中洗澡/美容关键词 / duration_rules 缺行或形状非法（配置缺失不阻断，
 *   参数不落代码常量——缺行时按既有 fallback 语义走服务默认时长，注释在案）。
 */

import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

/** 槽位粒度（分钟）：与 store_slots 30min 栅格一致（非占位，属既有栅格契约） */
export const DURATION_SLOT_MIN = 30;

/* ------------------------------------------------------------------ */
/* 规则结构（数值全落 duration_rules 配置表；loadDurationRules 装配）        */
/* ------------------------------------------------------------------ */

export type Species = 'dog' | 'cat';
export type ServiceKind = 'bath' | 'groom';
export type SizeTier = 'small' | 'medium' | 'large';
export type CoatLen = 'short' | 'long';

/** 时长规则六块结构（与 duration_rules 六行种子一一对应） */
export interface DurationRules {
  /** 基础时长（分钟）：物种 × 服务种类（duration_base_min） */
  baseMin: Record<Species, Record<ServiceKind, number>>;
  /** 体型系数（duration_size_coef） */
  sizeCoef: Record<SizeTier, number>;
  /** 毛长系数（duration_coat_coef） */
  coatCoef: Record<CoatLen, number>;
  /** 体型分档体重阈值 kg（duration_size_tier_weight_kg） */
  sizeTierWeightKg: Record<Species, { smallMax: number; mediumMax: number }>;
  /** 长毛品种关键词（duration_long_coat_breeds.keywords） */
  longCoatBreedKeywords: string[];
  /** 服务种类关键词（duration_service_kind_keywords；bath 先于 groom 判定） */
  serviceKindKeywords: Record<ServiceKind, string[]>;
}

/** 全局 db handle 类型（事务 handle 运行时接口一致，同 services/xpAward.ts 惯例） */
export type DurationDbHandle = typeof db;

/* ---- loadDurationRules 装配 helpers（宽松校验：任一形状非法即整组回退 null） ---- */

function asSpeciesKindMap(v: unknown): Record<Species, Record<ServiceKind, number>> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out = {} as Record<Species, Record<ServiceKind, number>>;
  for (const sp of ['dog', 'cat'] as const) {
    const row = (v as Record<string, unknown>)[sp];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
    const kinds = {} as Record<ServiceKind, number>;
    for (const k of ['bath', 'groom'] as const) {
      const n = (row as Record<string, unknown>)[k];
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
      kinds[k] = n;
    }
    out[sp] = kinds;
  }
  return out;
}

function asCoefMap<T extends string>(v: unknown, keys: readonly T[]): Record<T, number> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out = {} as Record<T, number>;
  for (const k of keys) {
    const n = (v as Record<string, unknown>)[k];
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
    out[k] = n;
  }
  return out;
}

function asTierMap(v: unknown): Record<Species, { smallMax: number; mediumMax: number }> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out = {} as Record<Species, { smallMax: number; mediumMax: number }>;
  for (const sp of ['dog', 'cat'] as const) {
    const row = (v as Record<string, unknown>)[sp];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
    const smallMax = (row as Record<string, unknown>).smallMax;
    const mediumMax = (row as Record<string, unknown>).mediumMax;
    if (
      typeof smallMax !== 'number' || !Number.isFinite(smallMax) || smallMax <= 0 ||
      typeof mediumMax !== 'number' || !Number.isFinite(mediumMax) || mediumMax <= smallMax
    ) return null;
    out[sp] = { smallMax, mediumMax };
  }
  return out;
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  if (!v.every((x) => typeof x === 'string' && x.length > 0)) return null;
  return v as string[];
}

/**
 * 读取时长规则（每次实时读表：配置端口保存即生效）。
 * 六块任一缺行/形状非法 → 返回 null：调用方（resolveServiceDuration rules=null）
 * 回退服务默认 durationMin 路径（不阻断下单；参数不落代码常量，故不回退代码字面量）。
 */
export async function loadDurationRules(d: DurationDbHandle): Promise<DurationRules | null> {
  const rows = await d
    .select({ ruleKey: schema.durationRules.ruleKey, valueJson: schema.durationRules.valueJson })
    .from(schema.durationRules)
    .where(eq(schema.durationRules.active, true));
  const byKey = new Map(rows.map((r) => [r.ruleKey, r.valueJson as Record<string, unknown>]));

  const baseMin = asSpeciesKindMap(byKey.get('duration_base_min'));
  const sizeCoef = asCoefMap(byKey.get('duration_size_coef'), ['small', 'medium', 'large'] as const);
  const coatCoef = asCoefMap(byKey.get('duration_coat_coef'), ['short', 'long'] as const);
  const sizeTierWeightKg = asTierMap(byKey.get('duration_size_tier_weight_kg'));
  const longCoatBreedKeywords = asStringArray(byKey.get('duration_long_coat_breeds')?.keywords);
  const skRaw = byKey.get('duration_service_kind_keywords');
  const bathKws = asStringArray(skRaw?.bath);
  const groomKws = asStringArray(skRaw?.groom);
  if (!baseMin || !sizeCoef || !coatCoef || !sizeTierWeightKg || !longCoatBreedKeywords || !bathKws || !groomKws) {
    return null;
  }
  return {
    baseMin,
    sizeCoef,
    coatCoef,
    sizeTierWeightKg,
    longCoatBreedKeywords,
    serviceKindKeywords: { bath: bathKws, groom: groomKws },
  };
}

/* ------------------------------------------------------------------ */
/* 推导（纯函数；规则全部经参数注入，代码零常量）                            */
/* ------------------------------------------------------------------ */

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

/** 服务名 → 服务种类（关键词表注入；谁先命中谁优先：bath 先于 groom；未命中 null → 回退默认时长） */
export function classifyServiceKind(
  serviceName: string,
  keywords: Record<ServiceKind, string[]>,
): ServiceKind | null {
  const name = serviceName.toLowerCase();
  for (const kw of keywords.bath) {
    if (name.includes(kw.toLowerCase())) return 'bath';
  }
  for (const kw of keywords.groom) {
    if (name.includes(kw.toLowerCase())) return 'groom';
  }
  return null;
}

/** 体重 → 体型档（阈值表注入）：weight < smallMax → 小；smallMax ≤ weight ≤ mediumMax → 中；> mediumMax → 大 */
export function deriveSizeTier(
  species: Species,
  weightKg: number,
  tiers: Record<Species, { smallMax: number; mediumMax: number }>,
): SizeTier {
  const t = tiers[species];
  if (weightKg < t.smallMax) return 'small';
  if (weightKg <= t.mediumMax) return 'medium';
  return 'large';
}

/** 品种 → 毛长档（关键词表注入；子串命中即长毛，未命中判短毛） */
export function deriveCoatLength(breed: string, keywords: string[]): CoatLen {
  const b = breed.toLowerCase();
  return keywords.some((kw) => b.includes(kw.toLowerCase())) ? 'long' : 'short';
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
 * 时长引擎主入口（纯函数，不查库；rules 由调用方 loadDurationRules 注入）：
 * engine：rawMin = 基础时长 × 体型系数 × 毛长系数；durationMin = rawMin 按 30min
 * 向上取整；slotsNeeded = durationMin / 30。
 * rules=null（duration_rules 缺行/非法）→ 回退服务默认 durationMin（不阻断下单）。
 * 边界示例（种子值口径，验收锚点）：大型长毛犬美容 = 90 × 2.0 × 1.25 = 225min → 240min / 8 槽。
 */
export function resolveServiceDuration(
  service: ServiceDurationInput,
  pet: PetDurationProfile | null | undefined,
  rules: DurationRules | null,
): ServiceDuration {
  if (service.type !== 'grooming') return fallback(service, '寄养按晚计费，时长引擎不介入');
  if (!rules) return fallback(service, '时长规则未配置（duration_rules 缺行或形状非法）');
  if (!pet) return fallback(service, '无宠物档案');
  const species = pet.species === 'dog' || pet.species === 'cat' ? pet.species : null;
  if (!species) return fallback(service, `物种非犬猫（${pet.species ?? '空'}）`);
  if (typeof pet.weightKg !== 'number' || !Number.isFinite(pet.weightKg) || pet.weightKg <= 0) {
    return fallback(service, '缺体重，无法推导体型档');
  }
  if (!pet.breed || pet.breed.trim() === '') return fallback(service, '缺品种，无法推导毛长档');
  const kind = classifyServiceKind(service.name, rules.serviceKindKeywords);
  if (!kind) return fallback(service, '服务名未命中洗澡/美容关键词');

  const sizeTier = deriveSizeTier(species, pet.weightKg, rules.sizeTierWeightKg);
  const coat = deriveCoatLength(pet.breed, rules.longCoatBreedKeywords);
  const baseMin = rules.baseMin[species][kind];
  const sizeCoef = rules.sizeCoef[sizeTier];
  const coatCoef = rules.coatCoef[coat];
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
