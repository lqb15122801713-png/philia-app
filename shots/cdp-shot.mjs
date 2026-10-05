// CDP 截图：先 setDeviceMetricsOverride 再 captureScreenshot，避免系统 DPI 干扰
import { writeFileSync } from 'node:fs';

const DEBUG_PORT = 9223;
// 参数：url width height mobile outfile
const [url, w, h, mobile, outfile] = process.argv.slice(2);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  };
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: mobile === '1' });
  await send('Page.navigate', { url });
  await sleep(3500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
  console.log('saved', outfile);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
