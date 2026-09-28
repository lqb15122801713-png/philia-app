/**
 * 安全源检测（修复包 PR-2 · A7，走查缺陷 24 号档 P1-1）
 *
 * HTTP 非安全源下浏览器禁用 geolocation / getUserMedia——API 对象存在但调用
 * 恒回 PERMISSION_DENIED / NotAllowedError，文案若一律归因「权限被拒绝」会误导
 * 用户（真因是非安全源，开权限也没用）。统一在此区分，两处入口引同一套文案。
 */

/** 是否安全源（HTTPS / localhost / App WebView 等）；老浏览器无此属性时按安全处理 */
export function isSecureContextOk(): boolean {
  return window.isSecureContext !== false;
}

/** 非安全源 · 定位场景文案 */
export const INSECURE_CONTEXT_GEO_MESSAGE =
  '当前页面为 HTTP 环境，浏览器已禁用定位——请用 HTTPS 链接或 App 内打开后重试';

/** 非安全源 · 摄像头场景文案 */
export const INSECURE_CONTEXT_CAMERA_MESSAGE =
  '当前页面为 HTTP 环境，浏览器已禁用摄像头——请用 HTTPS 链接或 App 内打开，或改用手动输入';
