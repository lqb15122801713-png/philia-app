/**
 * 通知中心 /notifications 文案键表（员工端骨架整建批 片 3 · 员工端，coder H）
 * 纪律：键名小写点分（snt. 族前缀防全局撞键——ntf.* 已被客户端 notify.ts 族占用）、as const 冻结、withCopyOverrides 代理
 * （端口值优先、码内默认 fallback）；新键随批注册进 copy_overrides（生成器重跑申报）。
 */

import { withCopyOverrides } from '@philia/shared';

const NOTIFICATIONS_COPY_TABLE = {
  'snt.title': '通知',
  'snt.no': 'NOTIFICATIONS',
  'snt.unreadLead': '未读 {n} 条',
  'snt.markAll': '全部已读',
  'snt.markAllDone': '已全部标记为已读',
  'snt.empty': '没有通知',
  'snt.emptyBody': '派单、改期与系统消息会出现在这里',
  'snt.loadFail': '通知加载失败，请检查网络后重试',
  'snt.retry': '重新加载',
} as const;

export const NOTIFICATIONS_COPY = withCopyOverrides(NOTIFICATIONS_COPY_TABLE);
export type NotificationsCopyKey = keyof typeof NOTIFICATIONS_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function nfc(key: NotificationsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = NOTIFICATIONS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
