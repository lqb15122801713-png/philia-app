/* 片 4 D 股：canvasPreviewUrl 推导矩阵断言（机读件，tsx 直跑纯函数模块）
 * 用法：npx tsx canvas-url-matrix.mjs → 输出 JSON（断言全过 exit 0） */
import { canvasPreviewUrl } from './apps/merchant/src/pages/canvasPreviewUrl.ts';

const L = (hostname, port, pathname, protocol = 'https:') => ({ hostname, port, pathname, protocol });
const cases = [
  // 轨 1：单域路径分端（生产实测：控制台挂 /admin/ 下）
  ['路径分端 home', canvasPreviewUrl('home', null, L('philia.example.cn', '', '/admin/console'), false), '/home?canvasPreview=1'],
  ['路径分端 memberCenter', canvasPreviewUrl('memberCenter', null, L('philia.example.cn', '', '/admin/console'), false), '/member?canvasPreview=1'],
  ['路径分端 cashierMarketing', canvasPreviewUrl('cashierMarketing', null, L('philia.example.cn', '', '/admin/console'), false), '/admin/cashier?canvasPreview=1'],
  ['路径分端带店锚', canvasPreviewUrl('home', 'st1', L('philia.example.cn', '', '/admin/console'), false), '/home?canvasPreview=1&canvasStore=st1'],
  // 轨 2：dev/截图双轨（既有口径零改动）
  ['dev 7101→7100', canvasPreviewUrl('home', null, L('localhost', '7101', '/console'), false), 'http://localhost:7100/home?canvasPreview=1'],
  ['截图轨 7131→7130', canvasPreviewUrl('memberCenter', null, L('localhost', '7131', '/console'), false), 'http://localhost:7130/member?canvasPreview=1'],
  ['dev cashierMarketing 同端', canvasPreviewUrl('cashierMarketing', null, L('localhost', '7101', '/console'), false), 'http://localhost:7101/cashier?canvasPreview=1'],
  // 轨 3：Host 前缀分端（保留工艺）
  ['Host 前缀 m.*→app.*', canvasPreviewUrl('home', null, L('m.example.com', '', '/console'), false), 'https://app.example.com/home?canvasPreview=1'],
  ['Host 前缀 cashier 同源', canvasPreviewUrl('cashierMarketing', null, L('m.example.com', '', '/console'), false), '/cashier?canvasPreview=1'],
  ['裸域兜底（无 m. 无 /admin）同源相对', canvasPreviewUrl('memberCenter', null, L('example.com', '', '/console'), false), 'https://example.com/member?canvasPreview=1'],
];
let fail = 0;
const rows = cases.map(([name, got, want]) => {
  const ok = got === want;
  if (!ok) fail++;
  return { name, ok, got, want };
});
console.log(JSON.stringify({ allOk: fail === 0, total: cases.length, fail, rows }, null, 2));
process.exit(fail === 0 ? 0 : 1);
