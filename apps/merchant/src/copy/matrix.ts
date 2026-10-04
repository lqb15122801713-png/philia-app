/**
 * 权限矩阵域文案键表（商家端控制台骨架批 · 片 5 段 3 · W-14 权限矩阵屏）
 *
 * 覆盖：MatrixPage（/matrix 真页替换段 0 占位：wtop 锁死区红胶囊 + M5 矩阵四态格）。
 * 依据=UX-02 两端定稿语言包 §四 W-14：角色×权限 ✓/—/只读/锁死；编辑归控制台；
 * 锁死区任何端不可改。
 * 数据真源（本表只承载文案，矩阵结构在 MatrixPage 内常量并注明出处）：
 * lib/roles.ts 头注冻结口径 + 20 号档（V1.2 退款行）+ 26 号档（V1.3 驳回权/运营）。
 */

import { withCopyOverrides } from '@philia/shared';

const MATRIX_COPY_TABLE = {
  'mtx.pageTitle': '权限矩阵',
  'mtx.pageSub': '角色×权限四态 · 本页只读',
  'mtx.lockedPill': '锁死区 · 反结账/导出/储值导入仅店主',

  /* ---- 角色行 ---- */
  'mtx.roleOwner': '店主',
  'mtx.roleManager': '店长',
  'mtx.roleFront': '前台',
  'mtx.roleGroomer': '美容师',

  /* ---- 权限列 ---- */
  'mtx.colCashier': '收银',
  'mtx.colRefund': '退款',
  'mtx.colClose': '日结',
  'mtx.colReverse': '反结账',
  'mtx.colStock': '库存',
  'mtx.colMember': '会员',
  'mtx.colStaff': '员工',
  'mtx.colRules': '规则配置',
  'mtx.colCopy': '文案端口',
  'mtx.colSlots': '槽位',
  'mtx.colReport': '报表',
  'mtx.colMatrix': '权限矩阵',

  /* ---- 口径注（矩阵下逐行明面） ---- */
  'mtx.noteRefund': '退款：店长=本店≤阈值（默认 ¥500，配置端口店主可调）且非涉储值；超阈值/涉储值锁死仅店主（V1.2/V1.3 并轨）',
  'mtx.noteStock': '库存：店长=本店盘点派任务+确认差异；商品与服务定价仅店主',
  'mtx.noteMember': '会员：前台=仅收银识别时可见档位/余额/次卡，不可翻台账',
  'mtx.noteReport': '报表：店员不看营业额（总规则②）；导出仅店主（总规则③）',
  'mtx.noteMatrix': '权限矩阵：本页只读；编辑归控制台（开发侧发布），任何端不可页内改',
  'mtx.noteLocked': '锁死区：反结账/导出/储值台账导入仅店主，任何端不可下放',
  'mtx.noteSource': '数据真源：lib/roles.ts 头注冻结口径 + 20 号档 V1.2（退款行）+ 26 号档 V1.3（驳回权/运营）；改矩阵先改真源',
} as const;

export const MATRIX_COPY = withCopyOverrides(MATRIX_COPY_TABLE);

export type MatrixCopyKey = keyof typeof MATRIX_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function mtx(key: MatrixCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = MATRIX_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
