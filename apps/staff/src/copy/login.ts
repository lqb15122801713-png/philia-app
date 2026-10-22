/**
 * 登录页域文案键表：屏题、账号表单与口令引导统一经本表取值，端口值优先。
 */

import { withCopyOverrides } from '@philia/shared';

const LOGIN_COPY_TABLE = {
  'login.wordmark': 'PHILIA · 员工端',
  'login.manifesto.line1': '照顾好每一个',
  'login.manifesto.line2': '被托付的小生命',
  'login.storeLine': '菲丽亚宠物·示例店 · 员工内测通道',
  'login.agreement': '登录即同意《员工内测协议》与《服务影像记录规范》',

  'login.gate.title': '内测口令',
  'login.gate.hint': '如门店提供内测口令，请与员工账号一并输入。',
  'login.gate.required': '需先输入内测口令',
  'login.primaryCta': '输入员工账号登录',
  'login.gateEntry': '口令入内测',
  'login.loggedIn.lead': '当前已登录',
  'login.loggedIn.enter': '进入任务台',
  'login.loggedIn.logout': '退出登录',
  'login.role.frontdesk': '前台',
  'login.role.groomer': '美容师',
  'login.gate.placeholder': '内测口令',
  'login.manual.label': '员工账号 ID',
  'login.manual.placeholder': '请输入员工账号 ID',

  'login.accounts.title': '员工账号登录',
  'login.account.tip': '请使用门店分配的员工账号。非员工账号无法进入任务台。',
} as const;

export const LOGIN_COPY = withCopyOverrides(LOGIN_COPY_TABLE);

export type LoginCopyKey = keyof typeof LOGIN_COPY;
