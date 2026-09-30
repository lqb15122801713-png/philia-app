/**
 * XP 成长域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：XP 域说明文（今日经验口径/保级线/榜单口径/规则注脚）与空态一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，
 * 键名小写点分、冻结不改。
 *
 * 数值不进本表：段位名/经验数/上限等到渲染层读端口插值（JSX 内 u1-num 片段，
 * 键只持静态 Lead/Mid/Tail 碎片，同 me.ts 纪律）。
 * 不抽：区块题（本店榜/我的经验明细）、状态签、server 下发的 oneLiner/sources 文案、
 * 通用 UI 词（加载更多/重新加载）。
 */

export const XP_COPY = {
  /* ---- 段位卡（进度/保级说明） ---- */
  'xp.level.gapLead': '距',
  'xp.level.gapMid': '还差',
  'xp.level.gapTail': '经验',
  'xp.level.max': '已达最高段位',
  'xp.retention.lead': '保级线：月增量',
  'xp.retention.mid': '· 本月已增',
  'xp.retention.none': '当前段位无保级要求，经验累计不清零',

  /* ---- 今日经验 ---- */
  'xp.today.fullHint': '今日经验已满，明日 0 点重置',
  'xp.today.capLead': '日上限',
  'xp.today.capTail': '，超出部分不计分',
  'xp.today.fullBadge': '今日经验已满',

  /* ---- 本店榜口径注脚 ---- */
  'xp.board.note': '榜单只显示前三与你相邻的名次',

  /* ---- 经验明细空态 + 页脚说明 ---- */
  'xp.events.empty': '还没有经验记录——打卡、完成服务、收获好评都会长经验',
  'xp.footer': '每月 1 日段位结算 · 经验累计不清零',
} as const;

export type XpCopyKey = keyof typeof XP_COPY;
