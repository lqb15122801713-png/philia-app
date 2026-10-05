/**
 * 今日任务区（TodayPage /today · taskExec 循环任务卡）文案键表
 * （员工端骨架整建批 片 3 · 员工端，coder H）
 * 纪律：键名小写点分（ttd. 族前缀防全局撞键）、as const 冻结、withCopyOverrides 代理
 * （端口值优先、码内默认 fallback）；新键随批注册进 copy_overrides（生成器重跑申报）。
 * 口径：pending 卡点「完成」幂等打点；done 卡灰态+完成时刻透出。
 */

import { withCopyOverrides } from '@philia/shared';

const TASK_TODAY_COPY_TABLE = {
  'ttd.title': '今日任务',
  'ttd.due': '截止 {hm}',
  'ttd.doneCta': '完成',
  'ttd.doing': '打点中…',
  'ttd.doneOk': '已完成',
  'ttd.doneAt': '{hm} 已完成',
  'ttd.statusDone': '已完成',
  'ttd.loadFail': '任务加载失败',
} as const;

export const TASK_TODAY_COPY = withCopyOverrides(TASK_TODAY_COPY_TABLE);
export type TaskTodayCopyKey = keyof typeof TASK_TODAY_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function ttc(key: TaskTodayCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = TASK_TODAY_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
