/**
 * 发票抬头（invoiceTitles）域文案键表（客户端体验大批 片 1 · copy key 一期硬约定，
 * 纪律同 copy/account.ts）
 *
 * 覆盖：InvoiceTitlesPage /settings/invoice-titles（列表+默认徽 / 个人·企业新增编辑弹层 /
 * 删除二次确认）+ InvoiceApplyPage「选常用抬头」快速回填入口。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 */

import { withCopyOverrides } from '@philia/shared';

const INVOICE_TITLES_COPY_TABLE = {
  /* ---- 发票抬头 /settings/invoice-titles ---- */
  'invt.pushLabel': 'INVOICE TITLES',
  'invt.title': '发票抬头',
  'invt.loadFail': '抬头加载失败，请检查网络后重试',
  'invt.emptyTitle': '还没有发票抬头',
  'invt.emptyBody': '保存常用抬头，申请发票时一键回填',
  'invt.emptyCta': '新增抬头',
  'invt.add': '新增抬头',
  'invt.addTitle': '新增抬头',
  'invt.editTitle': '编辑抬头',
  'invt.typeLabel': '抬头类型',
  'invt.typePersonal': '个人',
  'invt.typeBusiness': '企业',
  'invt.titleLabel': '抬头名称',
  'invt.titlePlaceholderPersonal': '输入姓名',
  'invt.titlePlaceholderBusiness': '输入企业全称',
  'invt.titleRequired': '请填写抬头名称',
  'invt.taxNoLabel': '税号（统一社会信用代码）',
  'invt.taxNoPlaceholder': '企业抬头必填',
  'invt.taxNoRequired': '企业抬头须填写税号',
  'invt.setDefault': '设为默认抬头',
  'invt.defaultBadge': '默认',
  'invt.edit': '编辑',
  'invt.delete': '删除',
  'invt.save': '保存',
  'invt.saving': '保存中…',
  'invt.saveOk': '抬头已保存',
  'invt.saveFail': '保存失败，请稍后再试',
  'invt.delConfirmTitle': '删除该抬头？',
  'invt.delConfirmBody': '删除后不可恢复。',
  'invt.delCancel': '再想想',
  'invt.delOk': '抬头已删除',
  'invt.delFail': '删除失败，请稍后再试',
  /* ---- 发票申请页「选常用抬头」回填入口 ---- */
  'invt.pickCta': '选常用抬头 ›',
  'invt.pickTitle': '选择常用抬头',
} as const;

export const INVOICE_TITLES_COPY = withCopyOverrides(INVOICE_TITLES_COPY_TABLE);

export type InvoiceTitlesCopyKey = keyof typeof INVOICE_TITLES_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function itc(key: InvoiceTitlesCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = INVOICE_TITLES_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
