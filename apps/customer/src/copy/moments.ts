/**
 * 服务相册（moments）域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：MomentsPage /philia/moments（相册流 / 空态三句话 / 分享钩文案）。
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 数值不进本表：日期/名称等到渲染层读数据插值（{var} 模板）。
 */

export const MOMENTS_COPY = {
  'moments.title': '服务相册',
  'moments.loadFail': '相册加载失败',
  /* 空态三句话（题/说明/出口） */
  'moments.emptyTitle': '相册还是空的',
  'moments.emptyBody': '完成洗护服务后，前后对比照会自动收进这里',
  'moments.emptyCta': '去预约洗护',
  /* 分享（Web Share / 复制链接兜底） */
  'moments.shareCta': '分享这份美好',
  'moments.shareCopied': '链接已复制',
  'moments.shareTitle': '{pet}的变美记录',
  'moments.shareText': '{date} 在菲丽亚完成了{service}，看看前后对比！',
} as const;

export type MomentsCopyKey = keyof typeof MOMENTS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function moc(key: MomentsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = MOMENTS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
