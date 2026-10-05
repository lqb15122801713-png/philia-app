/**
 * 小程序端 API base（批次 7.1，内测期 dev 直连 server 7200）
 * 正式部署按静态托管/反代口径改为同域相对路径或公共域名（产品侧上线计划裁定）。
 */
export const API_BASE = 'http://localhost:7200';

/** 静态资产 URL（商品图等以 / 开头的相对路径 → 拼 API 源；批次 6 静态托管下 server 同源分发） */
export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** 分 → 元（展示两位小数；价格 token 类 text-price 配套） */
export function fenToYuan(fen: number | null | undefined): string {
  return ((fen ?? 0) / 100).toFixed(2);
}
