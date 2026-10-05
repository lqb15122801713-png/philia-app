/**
 * 关于（about）域文案键表（客户端体验大批 片 1 · copy key 一期硬约定，
 * 纪律同 copy/account.ts）
 *
 * 覆盖：AboutPage /settings/about（版本号 / 清除缓存二次确认 / 协议中心入口）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 版本号入键（任务口径：构建期注入或 copy 键二选一，本片走 copy 键）。
 */

import { withCopyOverrides } from '@philia/shared';

const ABOUT_COPY_TABLE = {
  /* ---- 关于 /settings/about ---- */
  'about.pushLabel': 'ABOUT',
  'about.title': '关于',
  'about.versionLabel': '版本号',
  'about.versionValue': '0.9.0 内测版',
  'about.betaNote': '内测版本，功能与文案以门店公示为准。',
  'about.agreements': '协议中心',
  'about.agreementsSub': '用户协议 / 隐私政策 / 会员服务协议 / 寄养协议',
  /* 清除缓存（二次确认弹层；本地缓存+缓存 API+SW 注销+重载） */
  'about.clearCache': '清除缓存',
  'about.clearCacheDesc': '清除本机缓存的图片与偏好，页面随后自动重新加载',
  'about.clearConfirmTitle': '清除缓存并重新加载？',
  'about.clearConfirmBody': '将清除本机缓存数据与本端偏好设置（含本机设备标识），账号数据不受影响；确认后页面自动重新加载。',
  'about.clearOk': '确认清除',
  'about.clearCancel': '再想想',
  'about.clearing': '正在清除…',
} as const;

export const ABOUT_COPY = withCopyOverrides(ABOUT_COPY_TABLE);

export type AboutCopyKey = keyof typeof ABOUT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function abc(key: AboutCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = ABOUT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
