// 移动仿真 + 全量异常捕获：探商家 /appointments 在 smoke 口径下的真实表现
import { Cdp, sleep } from '../cdp.mjs';
const cdp = new Cdp();
const exceptions = [];
try {
  await cdp.launch(); // 默认 390x844 mobile:true，与 smoke 同口径
  // 全量捕获异常与日志
  cdp.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      exceptions.push(String(d?.exception?.description ?? d?.text ?? '').slice(0, 500));
    }
    if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      if (e.level === 'error') exceptions.push(`[log:${e.source}] ${String(e.text).slice(0, 300)} ${e.url ?? ''}`);
    }
  });
  await cdp.send('Log.enable');
  await cdp.nav('http://localhost:7101/dev-login', 2200);
  console.log('login:', await cdp.loginAs('01M20EDD8CMJCG42PBGX9MY5NB'));
  await cdp.nav('http://localhost:7101/appointments', 6000);
  console.log('text len:', await cdp.eval(`(document.body?.innerText ?? '').length`));
  console.log('text head:', await cdp.eval(`(document.body?.innerText ?? '').slice(0, 120)`));
  console.log('exceptions:', JSON.stringify(exceptions, null, 1));
  await cdp.shot('D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\c\\probe-mobile-appts.png');
} finally { cdp.close(); }
