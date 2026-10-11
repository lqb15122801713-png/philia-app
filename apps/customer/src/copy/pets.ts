/**
 * 宠物档案（pets）域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：PetsPage /philia/pets（档案列表 / 空态三句话 / 疫苗状态规则明面 / 洗护史）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：天数/次数/日期等到渲染层读数据插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const PETS_COPY_TABLE = {
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
  /* 体验大批片 2：疫苗证明留证（/api/upload relDir=vaccine/<petId>；行为不变口径明面） */
  'pets.vaccineProofTitle': '疫苗证明',
  'pets.vaccineProofNote': '仅留证，寄养校验仍以疫苗有效期为准',
  'pets.vaccineProofAdd': '上传证明',
  'pets.vaccineProofCount': '疫苗证明 {count} 张',
  /* 芯片号 / 花色（体验批片 4 扩字段） */
  'pets.chipNoLabel': '芯片号',
  'pets.chipNoPlaceholder': '如：900123456789012',
  'pets.coatColorLabel': '花色',
  'pets.coatColorPlaceholder': '如：橘白 / 三花',
  /* 健康档案入口（/philia/pets/:id/health） */
  'pets.healthEntry': '健康档案 ›',
  /* 多宠物全局切换器（ActivePetSwitcher） */
  'pets.switcherAll': '全部宠物',
  'pets.switcherTitle': '切换宠物',
  'pets.switcherSingleNote': '单宠档案已选定',
  'pets.switcherFail': '切换失败，请稍后重试',
  /* 画布批片 3：表单/卡片写死中文抽键（默认值=改造前写死逐字）。
     不抽键口径：PRESET_TAGS 预设性格标签=写库数据值（照 MallPage 分类枚举不抽键先例）；
     zod 校验消息=镜像 server pet.upsert 规则，保持写死防双端口径分叉；
     数值类（天数/次数/日期/体重）读数据插值不入表。 */
  'pets.editTitle': '编辑档案',
  'pets.editEntry': '编辑 ›',
  'pets.avatarUpload': '上传头像',
  'pets.avatarChange': '更换头像',
  'pets.avatarNote': '上传前自动压缩，最长边 2000px',
  'pets.avatarPreviewAlt': '头像预览',
  'pets.nameLabel': '名字 *',
  'pets.namePlaceholder': 'TA 的名字',
  'pets.speciesLabel': '物种 *',
  'pets.speciesDog': '狗狗',
  'pets.speciesCat': '猫咪',
  'pets.speciesOther': '其他',
  'pets.breedLabel': '品种',
  'pets.breedPlaceholder': '如：金毛',
  'pets.birthdayLabel': '生日',
  'pets.weightLabel': '体重（kg）',
  'pets.weightPlaceholder': '如：4.5',
  'pets.vaccineLabel': '疫苗有效期至',
  'pets.neuteredLabel': '已绝育',
  'pets.tagsLabel': '性格标签（最多 12 个）',
  'pets.tagCustomPlaceholder': '自定义标签，回车添加',
  'pets.tagLimitPlaceholder': '标签已达上限',
  'pets.tagAdd': '添加',
  'pets.proofRemove': '删除',
  'pets.formCancel': '取消',
  'pets.formSaving': '保存中…',
  'pets.formSubmit': '保存档案',
  'pets.formSaveFail': '保存失败，请稍后重试',
  'pets.historyServiceFallback': '洗护',
} as const;

export const PETS_COPY = withCopyOverrides(PETS_COPY_TABLE);

export type PetsCopyKey = keyof typeof PETS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function pc(key: PetsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PETS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
