/**
 * 宠物档案（pets）域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：PetsPage /philia/pets（档案列表 / 空态三句话 / 疫苗状态规则明面 / 洗护史）。
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 数值不进本表：天数/次数/日期等到渲染层读数据插值（{var} 模板）。
 */

export const PETS_COPY = {
  'pets.title': '宠物档案',
  'pets.loadFail': '宠物档案加载失败',
  /* 空态三句话（题/说明/出口） */
  'pets.emptyTitle': '还没有宠物档案',
  'pets.emptyBody': '建立档案后，预约洗护与寄养更省心',
  'pets.emptyCta': '建立档案',
  'pets.addCta': '新增宠物',
  /* 疫苗状态徽章（寄养硬校验规则明面） */
  'pets.vaccineNone': '未登记疫苗',
  'pets.vaccineExpired': '疫苗已过期 · 寄养前需补种',
  'pets.vaccineSoon': '疫苗 {days} 天后到期 · 寄养需有效期内',
  'pets.vaccineOk': '疫苗有效至 {date}',
  /* 洗护史时间线 */
  'pets.historyTitle': '洗护史',
  'pets.historyCount': '共 {count} 次',
  'pets.rebook': '同款再约 ›',
} as const;

export type PetsCopyKey = keyof typeof PETS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function pc(key: PetsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PETS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
