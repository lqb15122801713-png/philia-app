/**
 * 门店公告 /notices 文案键表（员工端骨架整建批 片 3 · 员工端，coder H）
 * 纪律：键名小写点分（ntc. 族前缀防全局撞键）、as const 冻结、withCopyOverrides 代理
 * （端口值优先、码内默认 fallback）；新键随批注册进 copy_overrides（生成器重跑申报）。
 * 口径：pinned 在前；点开详情即 markRead（已读回执=进详情就落）；已读灰态。
 */

import { withCopyOverrides } from '@philia/shared';

const NOTICES_COPY_TABLE = {
  'ntc.title': '门店公告',
  'ntc.no': 'NOTICES',
  'ntc.pinned': '置顶',
  'ntc.unreadLead': '未读 {n} 条',
  'ntc.badgeUnread': '未读',
  'ntc.badgeRead': '已读',
  'ntc.empty': '暂无公告',
  'ntc.emptyBody': '店长发布公告后会出现在这里',
  'ntc.loadFail': '公告加载失败，请检查网络后重试',
  'ntc.retry': '重新加载',
} as const;

export const NOTICES_COPY = withCopyOverrides(NOTICES_COPY_TABLE);
export type NoticesCopyKey = keyof typeof NOTICES_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function ncc(key: NoticesCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = NOTICES_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
