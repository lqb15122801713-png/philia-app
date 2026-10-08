/* 急修 1008：canvasPreviewUrl 推导矩阵断言 v2（四轨；含端口分端轨+映射表端口覆盖例）
 * 用法：npx tsx canvas-url-matrix.mjs（仓根） → JSON（全过 exit 0） */
import { canvasPreviewUrl, parsePreviewPortMap } from './apps/merchant/src/pages/canvasPreviewUrl.ts';

const L = (hostname, port, pathname, protocol = 'http:') => ({ hostname, port, pathname, protocol });
const cases = [
  // 轨 2（急修新增）：端口分端=生产真拓扑（同 IP 7200/7201/7202）
  ['端口轨 商家 7202→7200 home', canvasPreviewUrl('home', null, L('120.53.102.45', '7202', '/console')), 'http://120.53.102.45:7200/home?canvasPreview=1'],
  ['端口轨 商家 7202→7200 memberCenter', canvasPreviewUrl('memberCenter', null, L('120.53.102.45', '7202', '/console')), 'http://120.53.102.45:7200/member?canvasPreview=1'],
  ['端口轨 cashierMarketing=同源 /cashier（7202 自口）', canvasPreviewUrl('cashierMarketing', null, L('120.53.102.45', '7202', '/console')), '/cashier?canvasPreview=1'],
  ['端口轨 员工 7201→7200', canvasPreviewUrl('home', null, L('120.53.102.45', '7201', '/execute/x')), 'http://120.53.102.45:7200/home?canvasPreview=1'],
  ['端口轨 映射表端口覆盖（copy 端口值：7202→7900 改拓扑零代码）', canvasPreviewUrl('home', null, L('120.53.102.45', '7202', '/console'), false, { '7202': '7900' }), 'http://120.53.102.45:7900/home?canvasPreview=1'],
  // 轨 1：/admin 路径分端（片 4 保留）
  ['路径轨 /admin home', canvasPreviewUrl('home', null, L('philia.example.cn', '', '/admin/console', 'https:')), '/home?canvasPreview=1'],
  ['路径轨 /admin cashier', canvasPreviewUrl('cashierMarketing', null, L('philia.example.cn', '', '/admin/console', 'https:')), '/admin/cashier?canvasPreview=1'],
  // 轨 3：dev/截图双轨（零改动）
  ['dev 7101→7100', canvasPreviewUrl('home', null, L('localhost', '7101', '/console')), 'http://localhost:7100/home?canvasPreview=1'],
  ['截图轨 7131→7130', canvasPreviewUrl('memberCenter', null, L('localhost', '7131', '/console')), 'http://localhost:7130/member?canvasPreview=1'],
  ['dev cashier 同端', canvasPreviewUrl('cashierMarketing', null, L('localhost', '7101', '/console')), 'http://localhost:7101/cashier?canvasPreview=1'],
  // 轨 4：Host 前缀（保留）
  ['Host 轨 m.*→app.*', canvasPreviewUrl('home', null, L('m.example.com', '', '/console', 'https:')), 'https://app.example.com/home?canvasPreview=1'],
  ['Host 轨 cashier 同源', canvasPreviewUrl('cashierMarketing', null, L('m.example.com', '', '/console', 'https:')), '/cashier?canvasPreview=1'],
  ['裸域兜底同源相对', canvasPreviewUrl('memberCenter', null, L('example.com', '', '/console', 'https:')), 'https://example.com/member?canvasPreview=1'],
  // 映射表解析件
  ['parsePreviewPortMap 缺省回落（undefined）', JSON.stringify(parsePreviewPortMap(undefined)), JSON.stringify({ '7202': '7200', '7201': '7200' })],
  ['parsePreviewPortMap 坏 JSON 回落缺省', JSON.stringify(parsePreviewPortMap('{bad')), JSON.stringify({ '7202': '7200', '7201': '7200' })],
  ['parsePreviewPortMap 端口值读入', JSON.stringify(parsePreviewPortMap('{"7202":"7900"}')), JSON.stringify({ '7202': '7900' })],
];
let fail = 0;
const rows = cases.map(([name, got, want]) => {
  const ok = got === want;
  if (!ok) fail++;
  return { name, ok, got, want };
});
console.log(JSON.stringify({ allOk: fail === 0, total: cases.length, fail, rows }, null, 2));
process.exit(fail === 0 ? 0 : 1);
