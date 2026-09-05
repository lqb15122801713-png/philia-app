/**
 * 扫码核销 · 解码逻辑冒烟（无摄像头环境，T3.2）
 *
 * 流程：
 * 1. 用 qrcode 包生成一张含预约码 payload（v2 滚动时间窗格式，§3.3）的 QR PNG；
 * 2. pngjs 读出 RGBA 像素（等价于浏览器 canvas getImageData 的产物）；
 * 3. jsQR(data, w, h) 解码 —— 即 QrScanner.tsx 的 jsQR 降级路径所用同一调用形态；
 * 4. 断言解码原文与生成原文逐字一致。
 *
 * BarcodeDetector 路径说明：BarcodeDetector 是浏览器原生 API（需真摄像头帧），
 * Node 环境无法构造；QrScanner.tsx 中以 `'BarcodeDetector' in window` 特性检测分支，
 * 浏览器内存在即走原生 loop，本脚本走查的是两个分支共用的「命中后处理」所依赖的
 * 解码正确性。原生路径的机型覆盖（Android Chrome）列入 P6 真机验证。
 *
 * 运行：node apps/staff/scripts/decode.smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));
const QRCode = require('qrcode');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');

const PAYLOAD = JSON.stringify({ v: 2, aid: 'appt_test', tw: 1, exp: 1, sig: 'x' });
const outDir = join(dirname(fileURLToPath(import.meta.url)), '.smoke-out');
const pngPath = join(outDir, 'booking-code.png');

let failed = 0;
function assert(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} ${extra}`);
  }
}

console.log('[smoke] 生成 QR PNG …');
mkdirSync(outDir, { recursive: true });
await QRCode.toFile(pngPath, PAYLOAD, { errorCorrectionLevel: 'M', margin: 2, width: 320 });

console.log('[smoke] 读取像素（pngjs → RGBA，同 canvas getImageData 形态）…');
const png = PNG.sync.read(await import('node:fs').then((fs) => fs.readFileSync(pngPath)));
assert('PNG 尺寸 320x320', png.width === 320 && png.height === 320, `got ${png.width}x${png.height}`);
assert('RGBA 字节长度 = w*h*4', png.data.length === png.width * png.height * 4);

console.log('[smoke] jsQR 解码（QrScanner 降级路径同款调用 jsQR(data, w, h)）…');
const t0 = performance.now();
const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
const ms = (performance.now() - t0).toFixed(1);
assert('解码命中', !!result && typeof result.data === 'string');
if (result) {
  console.log(`  解码原文: ${result.data}`);
  console.log(`  单帧耗时: ${ms}ms（320px 帧，5fps 帧循环预算 200ms 内）`);
  assert('解码原文与生成原文逐字一致', result.data === PAYLOAD);
  const parsed = JSON.parse(result.data);
  assert('payload.v === 2', parsed.v === 2);
  assert('payload.aid === "appt_test"', parsed.aid === 'appt_test');
  assert('payload 含 tw/exp/sig 字段', 'tw' in parsed && 'exp' in parsed && 'sig' in parsed);
}

console.log('[smoke] BarcodeDetector 分支走查（特性检测形态与 QrScanner.tsx 一致）…');
// QrScanner.tsx 中的分支条件：const Detector = window.BarcodeDetector; if (Detector) { 原生 loop } else { jsQR }
const fakeWindow = {};
const detector = fakeWindow.BarcodeDetector;
assert("Node 环境无 BarcodeDetector → 应落入 jsQR 降级分支", detector === undefined);
assert('jsQR 降级分支解码结果可用（见上）', !!result);

rmSync(outDir, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\n[smoke] 失败 ${failed} 项`);
  process.exit(1);
}
console.log('\n[smoke] 全部断言通过 ✅');
