/**
 * 画布预览 iframe URL 推导（会员链路片 4 · D 股死链修复；从 CanvasPortBody 抽成纯函数=可测件；
 * 生产可用性急修 1008 补轨 2：端口分端轨=生产真拓扑实证）
 *
 * 推导顺序（四轨并存，判定信号互斥写明）：
 * 1. 单域路径分端（/admin 前缀判定；片 4 轨，保留不拆）；
 * 2. 端口分端（生产真拓扑=同 IP 端口分端：7200 客户端/7201 员工端/7202 商家端，Caddy 映射）——
 *    判定=当前口在映射表键内；客户页推导=同 host:映射客户口，cashierMarketing=同源 /cashier；
 *    映射表=配置端口留口（copy 键 canvas.previewPortMap，JSON 串，改拓扑零代码；
 *    端口值缺席/解析失败=回落 DEFAULT_PORT_MAP）；
 * 3. dev/截图双轨（vite dev 或 localhost/127.0.0.1 直跑）：三端三 vite 端口
 *    （nav 轨 7101→7100 / 截图轨 7131→7130；cashierMarketing=同端）——既有口径零改动；
 * 4. Host 前缀分端（将来真域名子域启用，工艺保留不拆）：m.* 宿主 → app.* 推导；
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

/** 端口分端映射缺省值（生产实测拓扑：商家端 7202/员工端 7201 → 客户端 7200）；
 *  端口配置件（copy key canvas.previewPortMap）可覆盖——改拓扑零代码 */
export const DEFAULT_PORT_MAP: Record<string, string> = { '7202': '7200', '7201': '7200' };

/** 端口映射表解析（copy 端口值为 JSON 串；缺/坏=回落缺省，绝不抛错断预览） */
export function parsePreviewPortMap(raw: string | undefined): Record<string, string> {
  if (!raw) return DEFAULT_PORT_MAP;
  try {
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
        if (/^\d+$/.test(k) && typeof v === 'string' && /^\d+$/.test(v)) out[k] = v;
      }
      return Object.keys(out).length > 0 ? out : DEFAULT_PORT_MAP;
    }
  } catch {
    /* 坏 JSON 回落缺省 */
  }
  return DEFAULT_PORT_MAP;
}

export function canvasPreviewUrl(
  pageKey: CanvasPageKey,
  storeId: string | null,
  loc: PreviewLoc,
  dev: boolean,
  portMap: Record<string, string> = DEFAULT_PORT_MAP,
): string {
  const params = `canvasPreview=1${storeId ? `&canvasStore=${storeId}` : ''}`;
  const path = pageKey === 'home' ? '/home' : pageKey === 'memberCenter' ? '/member' : '/cashier';

  /* 轨 1：单域路径分端（片 4 保留；判定=/admin/ 路径前缀） */
  if (loc.pathname.startsWith('/admin/')) {
    if (pageKey === 'cashierMarketing') return `/admin/cashier?${params}`;
    return `${path}?${params}`;
  }

  /* 轨 2：端口分端（生产真拓扑；判定=当前口在映射表键内） */
  const mappedCustomerPort = portMap[loc.port];
  if (mappedCustomerPort) {
    if (pageKey === 'cashierMarketing') return `${path}?${params}`; // 同源（商家端 cashier 自口）
    return `${loc.protocol}//${loc.hostname}:${mappedCustomerPort}${path}?${params}`;
  }

  /* 轨 3：dev/截图双轨（localhost 一律走三 vite 端口口径） */
  const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (dev || isLocal) {
    const customerPort = ({ '7101': '7100', '7131': '7130' } as Record<string, string>)[loc.port] ?? '7100';
    const port = pageKey === 'cashierMarketing' ? loc.port || '7101' : customerPort;
    return `http://localhost:${port}${path}?${params}`;
  }

  /* 轨 4：Host 前缀分端（m.*→app.*；cashierMarketing=同源相对路径） */
  if (pageKey === 'cashierMarketing') return `${path}?${params}`;
  const customerHost = loc.hostname.startsWith('m.') ? `app.${loc.hostname.slice(2)}` : loc.hostname;
  return `${loc.protocol}//${customerHost}${path}?${params}`;
}
