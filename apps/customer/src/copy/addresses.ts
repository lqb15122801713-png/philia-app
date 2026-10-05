/**
 * 收货地址（addresses）域文案键表（客户端体验大批 片 1 · copy key 一期硬约定，
 * 纪律同 copy/account.ts）
 *
 * 覆盖：AddressesPage /settings/addresses（列表+默认徽 / 新增·编辑弹层 / 删除二次确认）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：手机号/时刻等到渲染层插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const ADDRESSES_COPY_TABLE = {
  /* ---- 收货地址 /settings/addresses ---- */
  'addr.pushLabel': 'ADDRESSES',
  'addr.title': '收货地址',
  'addr.loadFail': '地址加载失败，请检查网络后重试',
  'addr.emptyTitle': '还没有收货地址',
  'addr.emptyBody': '添加常用收货地址，商城下单结算时一键带出',
  'addr.emptyCta': '新增地址',
  'addr.add': '新增地址',
  'addr.addTitle': '新增地址',
  'addr.editTitle': '编辑地址',
  'addr.receiverLabel': '收货人',
  'addr.receiverPlaceholder': '输入收货人姓名',
  'addr.receiverRequired': '请填写收货人',
  'addr.phoneLabel': '手机号',
  'addr.phonePlaceholder': '输入 11 位手机号',
  'addr.phoneInvalid': '请输入 11 位手机号',
  'addr.regionLabel': '所在地区',
  'addr.regionPlaceholder': '省 / 市 / 区',
  'addr.regionRequired': '请填写所在地区',
  'addr.detailLabel': '详细地址',
  'addr.detailPlaceholder': '小区、楼栋、门牌号等',
  'addr.detailRequired': '请填写详细地址',
  'addr.setDefault': '设为默认地址',
  'addr.defaultBadge': '默认',
  'addr.edit': '编辑',
  'addr.delete': '删除',
  'addr.save': '保存',
  'addr.saving': '保存中…',
  'addr.saveOk': '地址已保存',
  'addr.saveFail': '保存失败，请稍后再试',
  'addr.delConfirmTitle': '删除该地址？',
  'addr.delConfirmBody': '删除后不可恢复。',
  'addr.delCancel': '再想想',
  /* 默认删除注记（契约口径透出）：默认地址删除后最早添加的自动升为默认 */
  'addr.delDefaultNote': '这是默认地址，删除后最早添加的地址将自动升为默认。',
  'addr.delOk': '地址已删除',
  'addr.delFail': '删除失败，请稍后再试',
} as const;

export const ADDRESSES_COPY = withCopyOverrides(ADDRESSES_COPY_TABLE);

export type AddressesCopyKey = keyof typeof ADDRESSES_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function adc(key: AddressesCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = ADDRESSES_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
