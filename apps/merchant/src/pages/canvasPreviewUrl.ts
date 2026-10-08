/**
 * 画布预览 iframe URL 推导（会员链路片 4 · D 股死链修复；从 CanvasPortBody 抽成纯函数=可测件）
 *
 * 推导顺序（三轨并存，各轨判定信号互斥）：
 * 1. 单域路径分端（生产实测形态：7200 同口 客户端 /、商家端 /admin、员工端 /staff）——
 *    判定=当前控制台挂在 /admin/ 路径前缀下；home/memberCenter=客户端同源路径（/home /member），
 *    cashierMarketing=商家端 cashier 同源挂 /admin 前缀（同源相对路径）；
 * 2. dev/截图双轨（vite dev 或 localhost/127.0.0.1 直跑）：三端三 vite 端口
 *    （nav 轨 7101→7100 / 截图轨 7131→7130；cashierMarketing=同端）——既有口径零改动；
 * 3. Host 前缀分端（将来真域名子域启用，工艺保留不拆）：m.* 宿主 → app.* 推导；
 *    cashierMarketing=同源 /cashier；推导不出落同源相对路径兜底。
 *
 * canvasPreview=1=探针激活参；canvasStore=店锚参（真页查询参优先于记忆门店/首店解析）。
 */

import type { CanvasPageKey } from '@philia/shared';

/** 推导所需的最小 location 面（注入式=纯函数可测；生产调用点传 window.location） */
export interface PreviewLoc {
  hostname: string;
  port: string;
  pathname: string;
  protocol: string;
}

export function canvasPreviewUrl(
  pageKey: CanvasPageKey,
  storeId: string | null,
  loc: PreviewLoc,
  dev: boolean,
): string {
  const params = `canvasPreview=1${storeId ? `&canvasStore=${storeId}` : ''}`;
  const path = pageKey === 'home' ? '/home' : pageKey === 'memberCenter' ? '/member' : '/cashier';

  /* 轨 1：单域路径分端（生产实测形态；判定=/admin/ 路径前缀） */
  if (loc.pathname.startsWith('/admin/')) {
    if (pageKey === 'cashierMarketing') return `/admin/cashier?${params}`;
    return `${path}?${params}`;
  }

  /* 轨 2：dev/截图双轨（localhost 一律走三 vite 端口口径） */
  const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (dev || isLocal) {
    const customerPort = ({ '7101': '7100', '7131': '7130' } as Record<string, string>)[loc.port] ?? '7100';
    const port = pageKey === 'cashierMarketing' ? loc.port || '7101' : customerPort;
    return `http://localhost:${port}${path}?${params}`;
  }

  /* 轨 3：Host 前缀分端（m.*→app.*；cashierMarketing=同源相对路径） */
  if (pageKey === 'cashierMarketing') return `${path}?${params}`;
  const customerHost = loc.hostname.startsWith('m.') ? `app.${loc.hostname.slice(2)}` : loc.hostname;
  return `${loc.protocol}//${customerHost}${path}?${params}`;
}
