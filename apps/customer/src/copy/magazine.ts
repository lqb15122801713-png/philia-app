/**
 * PHILIA 杂志域文案键表（产品-1015 换皮 · 片4-运营商城 · 批C 杂志端口配套）
 *
 * 纪律同 copy/mall.ts：界面文案一律经本表取值，组件内零硬编码；
 * 本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 口径写死：PHILIA＝PGC 杂志（编辑部出品），不做开放 Feed（READY §6.9）；
 * 条目主副题/CTA 走槽位端口（philia.magazine.*，D-42 三行），本表=壳层文案＋槽位与正文缺省回退。
 */

import { slotContentOf, withCopyOverrides, type SlotContent } from '@philia/shared';

const MAGAZINE_COPY_TABLE = {
  /* ---- 壳层（页头 + 口径注 + 阅读页出口） ---- */
  'mag.headTitle': 'PHILIA',
  'mag.headSub': '杂志 · 给它，也给自己',
  'mag.pgcNote': '编辑部出品 · 精选内容（不开放投稿）',
  'mag.articleMissingTitle': '这篇内容还在整理中',
  'mag.articleMissingSub': '返回杂志首页，看看已经发布的文章。',
  'mag.backToMagazine': '返回杂志首页',

  /* ---- 槽位与正文缺省回退（槽行无对应字段时显示；与迁移 0086 槽种默认同帧） ---- */
  'mag.leadTitle': '秋日洗护季特刊',
  'mag.leadSub': '换季掉毛与皮肤干燥——给它一套入秋洗护方案',
  'mag.leadCta': '读本期',
  'mag.leadBody1': '换季时，先观察皮肤和被毛状态，再决定洗护频率。梳开浮毛与小结后再用温水打湿，避免水流直冲眼耳；使用宠物专用洗护产品并彻底冲净。',
  'mag.leadBody2': '吹干从低温低风开始，顺着被毛生长方向移动。若出现持续红肿、频繁抓挠或异味，先暂停自行加洗，到店让洗护师检查皮肤状态。',
  'mag.e2Title': '猫咪换季软便怎么办',
  'mag.e2Sub': '饮食过渡七日法 · 编辑部',
  'mag.e2Body1': '换粮用七天过渡：前两天新粮约四分之一，随后逐步提高比例。每餐少量、定时，保证饮水；不要因一次软便突然叠加多种新食物。',
  'mag.e2Body2': '记录便便形态、食欲与精神。持续超过一天、伴随呕吐或精神变差时，应尽快就医；幼猫、老年猫和有基础疾病的猫咪更不要拖。',
  'mag.e3Title': '狗狗脚掌护理入门',
  'mag.e3Sub': '秋冬干裂预防 · 编辑部',
  'mag.e3Body1': '外出回家先擦干趾缝，检查是否有裂口、异物或红肿。秋冬不要用过热的水冲洗，也不必频繁使用人用清洁产品。',
  'mag.e3Body2': '脚垫保持干燥，趾毛过长时由专业人员修剪。若狗狗持续舔咬、跛行或疼痛躲避触碰，停止自行处理并咨询兽医。',
} as const;

export const MAGAZINE_COPY = withCopyOverrides(MAGAZINE_COPY_TABLE);

export type MagazineCopyKey = keyof typeof MAGAZINE_COPY;

/** 文案键取值（本表无插值位；保留 helper 形态与各端 copy 表同族） */
export function mgc(key: MagazineCopyKey): string {
  return MAGAZINE_COPY[key];
}

/** getter 延迟到渲染读取，避免模块加载时冻结尚未到达的 copy 覆盖值。 */
export const MAGAZINE_ARTICLES = [
  {
    slug: 'lead',
    slotKey: 'philia.magazine.lead',
    fallback: {
      get title() { return mgc('mag.leadTitle') },
      get sub() { return mgc('mag.leadSub') },
      get cta() { return mgc('mag.leadCta') },
    },
    get paragraphs() { return [mgc('mag.leadBody1'), mgc('mag.leadBody2')] },
  },
  {
    slug: '02',
    slotKey: 'philia.magazine.02',
    fallback: {
      get title() { return mgc('mag.e2Title') },
      get sub() { return mgc('mag.e2Sub') },
    },
    get paragraphs() { return [mgc('mag.e2Body1'), mgc('mag.e2Body2')] },
  },
  {
    slug: '03',
    slotKey: 'philia.magazine.03',
    fallback: {
      get title() { return mgc('mag.e3Title') },
      get sub() { return mgc('mag.e3Sub') },
    },
    get paragraphs() { return [mgc('mag.e3Body1'), mgc('mag.e3Body2')] },
  },
] as const;

/** 杂志条目槽读口：槽位 live 值 → copy 键缺省回退（字段级）。 */
export function magazineEntryOf(article: (typeof MAGAZINE_ARTICLES)[number]) {
  const slot: SlotContent | undefined = slotContentOf(article.slotKey);
  return {
    url: slot?.url ?? null,
    alt: slot?.alt ?? article.fallback.title,
    title: slot?.title_main ?? article.fallback.title,
    sub: slot?.title_sub ?? article.fallback.sub,
    cta: slot?.cta_text ?? ('cta' in article.fallback ? article.fallback.cta : null),
  };
}
