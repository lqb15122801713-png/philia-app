/**
 * 宠物健康档案（health）域文案键表（copy key 一期硬约定 · 纪律同 copy/pets.ts）
 *
 * 覆盖：PetHealthPage /philia/pets/:id/health（体重趋势 SVG 折线 / 记体重表单 /
 * 健康记录四类 tab + 时间线 / 记一笔表单 / 删除二次确认）。
 * 文案端口已落：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：天数/日期/体重等到渲染层读数据插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const HEALTH_COPY_TABLE = {
  'health.title': '健康档案',
  'health.loadFail': '健康档案加载失败',
  /* 体重趋势 */
  'health.weightTrend': '体重趋势',
  'health.weightEmptyTitle': '还没有体重记录',
  'health.weightEmptyBody': '定期称重，掌握 TA 的健康变化',
  'health.weightUnit': 'kg',
  /* 记体重表单 */
  'health.weightAddTitle': '记体重',
  'health.weightDateLabel': '称重日期',
  'health.weightKgLabel': '体重（kg）',
  'health.weightKgPlaceholder': '如：4.5',
  'health.weightNoteLabel': '备注（可选）',
  'health.weightSubmit': '保存体重',
  /* 健康记录 */
  'health.recordsTitle': '健康记录',
  'health.tabVaccine': '疫苗',
  'health.tabDeworm': '驱虫',
  'health.tabMedication': '用药',
  'health.tabVetVisit': '就医',
  'health.recordsTabEmpty': '暂无{type}记录',
  /* 到期徽章（照 PetsPage 疫苗徽章视觉惯例：临期暖底 / 过期赭红） */
  'health.dueOk': '下次到期 {date}',
  'health.dueSoon': '下次到期 {date} · {days} 天后',
  'health.dueExpired': '已过期 {date}',
  /* 记一笔表单 */
  'health.recordAddTitle': '记一笔',
  'health.recordTypeLabel': '类型',
  'health.recordTitleLabel': '标题',
  'health.recordTitlePlaceholder': '如：狂犬疫苗第三针',
  'health.recordDateLabel': '发生日期',
  'health.recordNextDueLabel': '下次到期日（可选）',
  'health.recordNoteLabel': '备注（可选）',
  'health.recordNotePlaceholder': '如：宠物医院名称 / 剂量',
  'health.recordSubmit': '保存记录',
  /* 删除二次确认（同钮两击） */
  'health.recordDelete': '删除',
  'health.recordDeleteConfirm': '再点一次确认删除',
  'health.recordDeleted': '记录已删除',
  /* 表单通用 */
  'health.saving': '保存中…',
  'health.saveFail': '保存失败，请稍后重试',
} as const;

export const HEALTH_COPY = withCopyOverrides(HEALTH_COPY_TABLE);

export type HealthCopyKey = keyof typeof HEALTH_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function hc(key: HealthCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = HEALTH_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
