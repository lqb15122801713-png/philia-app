// 复刻 smoke 的导航序列，定位商家 /appointments 在序列后空白的原因
import { Cdp, sleep } from '../cdp.mjs';
const cdp = new Cdp();
try {
  await cdp.launch(1024, 768, false);
  await cdp.nav('http://localhost:7101/dev-login', 2200);
  console.log('login:', await cdp.loginAs('01M20EDD8CMJCG42PBGX9MY5NB'));
  const seq = ['/dashboard', '/monitor', '/monitor/', '/monitor/01M256D240E19GWNG2QMFV3Q8V', '/live', '/appointments', '/appointments/01M256D240E19GWNG2QMFV3Q8V/monitor'];
  for (const p of seq) {
    await cdp.nav('http://localhost:7101' + p, 2500);
    const s = await cdp.eval(`JSON.stringify({ rc: document.getElementById('root')?.childElementCount ?? -1, len: (document.body?.innerText ?? '').length, path: location.pathname })`);
    console.log(p, '=>', s);
  }
  // 再等 6s 观察是否迟渲染
  await sleep(6000);
  console.log('after 6s more:', await cdp.eval(`JSON.stringify({ rc: document.getElementById('root')?.childElementCount ?? -1, len: (document.body?.innerText ?? '').length, path: location.pathname })`));
  console.log('console tail:', JSON.stringify(cdp.consoleLogs.slice(-10), null, 1));
} finally { cdp.close(); }
