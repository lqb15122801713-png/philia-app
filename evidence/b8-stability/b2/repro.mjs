// B2 复现（修复前）：商家端 /monitor、/live 打开后落到哪
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b2';
const MERCHANT_USER = '01M20EDD8CMJCG42PBGX9MY5NB'; // 菲丽亚店主

const cdp = new Cdp();
try {
  await cdp.launch(1024, 768, false);
  await cdp.nav('http://localhost:7101/dev-login', 2000);
  console.log('login:', await cdp.loginAs(MERCHANT_USER));

  for (const path of ['/monitor', '/live']) {
    await cdp.nav('http://localhost:7101' + path, 3500);
    const landed = await cdp.eval('location.pathname');
    console.log(`open ${path} => landed ${landed}`);
    await cdp.shot(`${DIR}\\repro-${path.slice(1)}.png`);
  }
  // 对照组：既有监视页深链（应可开）
  await cdp.nav('http://localhost:7101/appointments/01M256D240E19GWNG2QMFV3Q8V/monitor', 4000);
  console.log('control /appointments/:id/monitor =>', await cdp.eval('location.pathname'),
    '| has timeline:', await cdp.eval(`document.body.innerText.includes('消毒') || document.body.innerText.includes('预检')`));
  await cdp.shot(DIR + '\\repro-control-appt-monitor.png');
} finally {
  cdp.close();
}
