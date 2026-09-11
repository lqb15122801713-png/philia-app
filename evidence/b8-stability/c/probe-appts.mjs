import { Cdp, sleep } from '../cdp.mjs';
const cdp = new Cdp();
try {
  await cdp.launch(1024, 768, false);
  await cdp.nav('http://localhost:7101/dev-login', 2200);
  console.log('login:', await cdp.loginAs('01M20EDD8CMJCG42PBGX9MY5NB'));
  await cdp.nav('http://localhost:7101/appointments', 6000);
  console.log('final:', await cdp.eval('location.pathname'));
  console.log('rootChildren:', await cdp.eval(`document.getElementById('root')?.childElementCount`));
  console.log('text:', await cdp.eval(`(document.body?.innerText ?? '').slice(0, 200)`));
  console.log('console:', JSON.stringify(cdp.consoleLogs.slice(-15), null, 1));
  await cdp.shot('D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\c\\probe-appointments.png');
} finally { cdp.close(); }
