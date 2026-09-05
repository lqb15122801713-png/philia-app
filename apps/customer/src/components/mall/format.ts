/**
 * 商城展示辅助（T5.3）：金额 / 图片 URL / 时间格式化。
 */

/** 分 → 元 展示（整数元不带小数，配合 font-number 等宽数字） */
export function fenToYuan(fen: number): string {
  const yuan = fen / 100;
  return `¥${Number.isInteger(yuan) ? yuan : yuan.toFixed(2)}`;
}

/**
 * 商品/订单图片 URL 归一化：
 * - http(s) 绝对地址：原样；
 * - `/api/...`（后端签名图 URL 是 API 源相对路径，见 server storage/sign.ts）：拼 API base；
 * - 其余（如种子数据的 `/brand/...`，客户端自身静态资源）：原样。
 */
export function resolveImgSrc(url: string | null | undefined, apiBase: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api/')) return `${apiBase}${url}`;
  return url;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 订单时间展示：YYYY-MM-DD HH:mm（createdAt/updatedAt 经 superjson 已是 Date） */
export function fmtOrderTime(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
