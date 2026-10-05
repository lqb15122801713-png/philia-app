/**
 * 编辑资料（profile）域文案键表（客户端体验大批 片 1 · copy key 一期硬约定，
 * 纪律同 copy/account.ts）
 *
 * 覆盖：ProfileEditPage /settings/profile（头像上传 / 昵称 / 生日 / 性别 + 保存回显）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：时刻/日期等到渲染层插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const PROFILE_COPY_TABLE = {
  /* ---- 编辑资料 /settings/profile ---- */
  'profile.pushLabel': 'PROFILE',
  'profile.title': '编辑资料',
  'profile.meEntry': '编辑资料',
  'profile.meEntrySub': '头像 · 昵称 · 生日 · 性别',
  'profile.loadFail': '资料加载失败，请检查网络后重试',
  'profile.avatarLabel': '头像',
  'profile.avatarChange': '更换头像',
  'profile.uploading': '上传中…',
  'profile.uploadFail': '头像上传失败，请重试',
  'profile.nicknameLabel': '昵称',
  'profile.nicknamePlaceholder': '输入昵称',
  'profile.nicknameRequired': '昵称不能为空',
  'profile.birthdayLabel': '生日',
  'profile.genderLabel': '性别',
  'profile.genderMale': '男',
  'profile.genderFemale': '女',
  'profile.genderSecret': '保密',
  'profile.save': '保存',
  'profile.saving': '保存中…',
  'profile.saveOk': '资料已保存',
  'profile.saveFail': '保存失败，请稍后再试',
} as const;

export const PROFILE_COPY = withCopyOverrides(PROFILE_COPY_TABLE);

export type ProfileCopyKey = keyof typeof PROFILE_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function pfc(key: ProfileCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PROFILE_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
