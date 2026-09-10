// B2 自验（修复后）：/monitor 目录页、/monitor/:id 别名、/live 系重定向
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b2';
const MERCHANT_USER = '01M20EDD8CMJCG42PBGX9MY5NB';

const cdp = new Cdp();
try {
  await cdp.launch(1024, 768, false);
  await cdp.nav('http://localhost:7101/dev-login', 2000);
  console.log('login:', await cdp.loginAs(MERCHANT_USER));

  // 1. /monitor 目录页
  await cdp.nav('http://localhost:7101/monitor', 4000);
  const hub = await cdp.eval(`JSON.stringify({
    path: location.pathname,
    title: document.querySelector('h1')?.textContent ?? null,
    rowCount: document.querySelectorAll('[role="button"]').length,
    text: document.body.innerText.slice(0, 120),
  }, null, 1)`);
  console.log('/monitor =>', hub);
  await cdp.shot(DIR + '\\fix-monitor-hub.png');

  // 2. 点第一行进监视页
  await cdp.eval(`document.querySelector('[role="button"]')?.click()`);
  await sleep(4000);
  const detail = await cdp.eval(`JSON.stringify({
    path: location.pathname,
    hasTimeline: document.body.innerText.includes('消毒') || document.body.innerText.includes('预检'),
  }, null, 1)`);
  console.log('row click =>', detail);
  await cdp.shot(DIR + '\\fix-monitor-detail.png');

  // 3. /monitor/:id 别名深链
  await cdp.nav('http://localhost:7101/monitor/01M254A5YEHJX4H0D9CPWWYZTT', 4500);
  console.log('/monitor/:id =>', await cdp.eval(`JSON.stringify({ path: location.pathname, hasTimeline: document.body.innerText.includes('消毒') || document.body.innerText.includes('预检') })`));
  await cdp.shot(DIR + '\\fix-monitor-id-alias.png');

  // 4. /live → /monitor；/live/:id → /monitor/:id
  await cdp.nav('http://localhost:7101/live', 3500);
  console.log('/live =>', await cdp.eval('location.pathname'));
  await cdp.nav('http://localhost:7101/live/01M254A5YEHJX4H0D9CPWWYZTT', 4500);
  console.log('/live/:id =>', await cdp.eval('location.pathname'));

  // 5. 回归：未知路由仍回 /dashboard；原深链不受影响
  await cdp.nav('http://localhost:7101/no-such-page', 3000);
  console.log('unknown =>', await cdp.eval('location.pathname'));
  await cdp.nav('http://localhost:7101/appointments/01M256D240E19GWNG2QMFV3Q8V/monitor', 4000);
  console.log('orig deep link =>', await cdp.eval('location.pathname'));
} finally {
  cdp.close();
}
