/**
 * 登录页域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：/dev-login 屏题宣言/门店行/协议小字/口令门引导/种子区说明一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 不抽：通用 UI 词（确认/登录/退出登录）、表单 placeholder、角色签 label、
 * dev 链路报错透传（seedsError/登录失败 message）。
 * 插值：{error} 等动态位以 {var} 占位，渲染层 replace 注入。
 */

import { withCopyOverrides } from '@philia/shared';

const LOGIN_COPY_TABLE = {
  /* ---- 屏题宣言档（规格书 §1：wordmark + 衬线宣言 + 门店行） ---- */
  'login.wordmark': 'PHILIA · 员工端',
  'login.manifesto.line1': '照顾好每一个',
  'login.manifesto.line2': '被托付的小生命',
  'login.storeLine': '菲丽亚宠物·示例店 · 员工内测通道',

  /* ---- 协议小字 ---- */
  'login.agreement': '登录即同意《员工内测协议》与《服务影像记录规范》',

  /* ---- 口令门（操作引导语） ---- */
  'login.gate.title': '内测口令',
  'login.gate.hint': '输入口令后加载可登录账号；无口令或口令错误将无法登录。',
  'login.gate.required': '需先输入内测口令',

  /* ---- 账号选择区（说明文） ---- */
  'login.accounts.title': '选择员工账号',
  'login.seed.loadFailed': '种子用户拉取失败（{error}），请确认 server 已启动，或手动输入 userId',
  'login.seed.empty': '未拉到员工种子用户，请重跑 server 的 db:seed，或手动输入 userId',
  'login.seed.tip': '提示：dev-login 仅允许种子用户（kimi_id 以 seed_ 前缀），会话 cookie 有效期 7 天。\n非员工账号登录后会被引导回本页切换。',
} as const;

export const LOGIN_COPY = withCopyOverrides(LOGIN_COPY_TABLE);

export type LoginCopyKey = keyof typeof LOGIN_COPY;
