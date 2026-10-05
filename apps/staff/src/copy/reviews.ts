/**
 * 我的评价域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：评价域说明文（摘要口径/页脚规则）与空态一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：均分/条数到渲染层读聚合数据插值（JSX 内 mono 片段，
 * 键只持静态 Lead/Tail 碎片，同 me.ts 纪律）。
 * 骨架批片 1（S-07）：展示词/通用 UI 词已随骨架帧抽键（reviews.trio·reviews.retry 等族）。
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

  /* ---- 骨架帧（S-07：backbar + trio 均分/条数/差评 + 评价卡） ---- */
  'reviews.title': '我的评价',
  'reviews.aside.lead': '已加载',
  'reviews.aside.tail': '条',
  'reviews.load.fail': '评价加载失败，请检查网络后重试',
  'reviews.retry': '重新加载',
  'reviews.trio.avg': '均分',
  'reviews.trio.count': '条数',
  'reviews.trio.bad': '差评',
  'reviews.anonymous': '匿名客户',
  'reviews.customer': '客户',
  'reviews.noText': '未留言',
  'reviews.more': '加载更多',
  'reviews.loading': '加载中…',
  'reviews.starUnit': '星',
  'reviews.callbackNote': '差评 24 小时内由店长回访 · 评价不可删改',

  /* ---- 申诉入口（N6 申诉通道 · report.raiseMetricAppeal，targetType='review' + targetId=评价 id） ---- */
  'reviews.appeal.cta': '申诉',
  'reviews.appeal.pending': '已申诉待复核',
  'reviews.appeal.title': '申诉该评价',
  'reviews.appeal.placeholder': '请说明申诉理由（必填，500 字内，店长复核时可见）',
  'reviews.appeal.cancel': '取消',
  'reviews.appeal.submit': '提交申诉',
  'reviews.appeal.required': '请填写申诉理由',
  'reviews.appeal.toast': '申诉已提交，待店长复核',
  'reviews.appeal.duplicated': '该评价已有申诉在途，请等待复核',
} as const;

export const REVIEWS_COPY = withCopyOverrides(REVIEWS_COPY_TABLE);

export type ReviewsCopyKey = keyof typeof REVIEWS_COPY;
