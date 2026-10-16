/**
 * PHILIA 杂志域文案键表（产品-1015 换皮 · 片4-运营商城 · 批C 杂志端口配套）
 *
 * 纪律同 copy/mall.ts：界面文案一律经本表取值，组件内零硬编码；
 * 本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 口径写死：PHILIA＝PGC 杂志（编辑部出品），不做开放 Feed（READY §6.9）；
 * 条目主副题/CTA 走槽位端口（philia.magazine.*，D-42 三行），本表=壳层文案＋槽位缺省回退。
 */

import { withCopyOverrides } from '@philia/shared';

const MAGAZINE_COPY_TABLE = {
  /* ---- 壳层（页头 + 口径注） ---- */
  'mag.headTitle': 'PHILIA',
  'mag.headSub': '杂志 · 给它，也给自己',
  'mag.pgcNote': '编辑部出品 · 精选内容（不开放投稿）',

  /* ---- 槽位缺省回退（槽行无对应字段时显示；与迁移 0086 槽种默认同帧） ---- */
  'mag.leadTitle': '秋日洗护季特刊',
  'mag.leadSub': '换季掉毛与皮肤干燥——给它一套入秋洗护方案',
  'mag.leadCta': '读本期',
  'mag.e2Title': '猫咪换季软便怎么办',
  'mag.e2Sub': '饮食过渡七日法 · 编辑部',
  'mag.e3Title': '狗狗脚掌护理入门',
  'mag.e3Sub': '秋冬干裂预防 · 编辑部',
} as const;

export const MAGAZINE_COPY = withCopyOverrides(MAGAZINE_COPY_TABLE);

export type MagazineCopyKey = keyof typeof MAGAZINE_COPY;

/** 文案键取值（本表无插值位；保留 helper 形态与各端 copy 表同族） */
export function mgc(key: MagazineCopyKey): string {
  return MAGAZINE_COPY[key];
}
