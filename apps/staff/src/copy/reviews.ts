/**
 * 我的评价域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：评价域说明文（摘要口径/页脚规则）与空态一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：均分/条数到渲染层读聚合数据插值（JSX 内 u1-num 片段，
 * 键只持静态 Lead/Tail 碎片，同 me.ts 纪律）。
 * 不抽：展示词（匿名客户/客户/未留言）、通用 UI 词（加载更多/重新加载）。
 */

import { withCopyOverrides } from '@philia/shared';

const REVIEWS_COPY_TABLE = {
  /* ---- 空态引导 ---- */
  'reviews.empty': '还没有收到客户评价——服务完成后客户可在预约详情留言，好评会同时长 XP',

  /* ---- 摘要口径说明（基于已加载页面前端自算） ---- */
  'reviews.summary.lead': '已加载',
  'reviews.summary.tail': '条评价的平均分',

  /* ---- 页脚规则说明 ---- */
  'reviews.footer': '仅本人可见 · 好评 +XP，≤2 星 −8（扣分不扣款）',
} as const;

export const REVIEWS_COPY = withCopyOverrides(REVIEWS_COPY_TABLE);

export type ReviewsCopyKey = keyof typeof REVIEWS_COPY;
