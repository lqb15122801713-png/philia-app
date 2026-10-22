/**
 * 开发登录页（devlogin）域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：DevLoginPage /dev-login（L-01 宣言档之外的页面文案——宣言三段已入
 * components/member/copy.ts 的 l1.* 键，本表不重复收录）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：错误详情等到渲染层插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const DEVLOGIN_COPY_TABLE = {
  'devlogin.tagline': 'PHILIA · 洗护 / 美容 / 寄养',
  'devlogin.primaryCta': '手机号一键登录',
  'devlogin.gateLink': '口令登录 ›',
  /* 口令门卡（PD-75 HP-CLIENT-02：去「内测」工程语，统一「访问口令」） */
  'devlogin.gateTitle': '需要访问口令',
  'devlogin.gateBody': '请输入访问口令后加载可登录账号；无口令或口令错误将无法登录。',
  'devlogin.gateHint': '口令通过后在上方选择账号一键登录。',
  /* D-16 手机号自助开户卡 */
  'devlogin.phoneTitle': '手机号登录 / 注册',
  'devlogin.phoneBody': '输入手机号即登录；首次使用将自动注册（新客建档）。',
  /* 演示账号区（PD-75 HP-CLIENT-02：去 seed/userId/db:seed 工程语） */
  'devlogin.seedTitle': '选择演示账号登录',
  'devlogin.devOnly': '',
  'devlogin.seedFail': '演示账号拉取失败（{error}），请检查网络后重试；若有口令请先在上方验证',
  'devlogin.seedEmpty': '暂无可登录的演示账号，请稍后再试',
  /* 手动输入区 */
  'devlogin.manualTitle': '账号 ID 登录',
  'devlogin.manualBody': '演示环境重建后账号 ID 会变化，可向门店索取最新账号 ID。',
  'devlogin.seedNote': '提示：演示账号一键登录，也可在口令通过后用手机号自助开户；登录状态保留 7 天。',
  /* 底部协议小字 */
  'devlogin.footerA': '登录即同意《用户协议》与《隐私政策》',
  'devlogin.footerB': '访问口令由门店发放',
  /* D-33 按角色落端：员工/商家种子账号登录后不迷航——已知拓扑直接跳，未知拓扑出明示卡 */
  'devlogin.endStaffTitle': '该账号是员工账号',
  'devlogin.endStaffBody': '客户端（宠友壳）没有员工工作台，请前往员工端登录使用；当前会话已登录，点下方链接直达。',
  'devlogin.endMerchantTitle': '该账号是商家账号',
  'devlogin.endMerchantBody': '客户端（宠友壳）没有商家后台，请前往商家端登录使用；当前会话已登录，点下方链接直达。',
  'devlogin.endLinkStaff': '前往员工端 ›',
  'devlogin.endLinkMerchant': '前往商家端 ›',
  /* 微信槽写准注记（客户端体验大批 片 1 · 开口项 1 裁：不吹不删槽） */
  'devlogin.wechatNote': '微信授权登录属小程序/资质批，PWA 端暂以手机号或演示账号登录',
} as const;

export const DEVLOGIN_COPY = withCopyOverrides(DEVLOGIN_COPY_TABLE);

export type DevloginCopyKey = keyof typeof DEVLOGIN_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function dc(key: DevloginCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = DEVLOGIN_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
