// CDP 布局探针：量 nav / philia 按钮 / tab 项的真实位置
const DEBUG_PORT = 9223;
const URL_TO_TEST = process.argv[2] || 'http://localhost:7100/philia';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  // 等 Chrome 起来
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
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result);
      pending.delete(msg.id);
    }
  };
  await new Promise(r => ws.onopen = r);

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: URL_TO_TEST });
  await sleep(3500);

  const expr = `(() => {
    const nav = document.querySelector('nav[aria-label="底部导航"]');
    const philia = document.querySelector('button[aria-label="Philia"]');
    const tabs = [...document.querySelectorAll('nav[aria-label="底部导航"] button:not([aria-label="Philia"])')];
    const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return {x: Math.round(b.x), w: Math.round(b.width)}; };
    return JSON.stringify({
      innerWidth: window.innerWidth,
      docClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      visualViewport: window.visualViewport ? {w: window.visualViewport.width, scale: window.visualViewport.scale, offsetLeft: window.visualViewport.offsetLeft} : null,
      devicePixelRatio: window.devicePixelRatio,
      nav: r(nav), philia: r(philia), tabs: tabs.map(r),
      rootEl: r(document.getElementById('root')),
    });
  })()`;
  const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(JSON.parse(out.result.value), null, 2));
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
