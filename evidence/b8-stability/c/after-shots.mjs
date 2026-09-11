// 任务 A 修复后 after 截图：四条必现路由直开+刷新 + 下单主链路抽查
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\c';
const APPT = '01M256D240E19GWNG2QMFV3Q8V';

const GROUPS = [
  { app: 'customer', base: 'http://localhost:7100', user: '01M20EDD8DKJ5DR9FZY7A01Y04',
    routes: [
      [`/appointments/${APPT}`, 'a1-appointment-detail'],
      ['/mall/orders', 'a2-mall-orders'],
      ['/philia/pets', 'a4-philia-pets'],
      ['/philia/moments', 'a4-philia-moments'],
      ['/booking/grooming', 'flow-booking-grooming'],
      ['/booking/success', 'flow-booking-success'],
    ] },
  { app: 'merchant', base: 'http://localhost:7101', user: '01M20EDD8CMJCG42PBGX9MY5NB',
    routes: [['/appointments', 'a3-merchant-appointments']] },
];

for (const g of GROUPS) {
  const cdp = new Cdp();
  try {
    await cdp.launch();
    await cdp.nav(`${g.base}/dev-login`, 2200);
    console.log(g.app, 'login:', await cdp.loginAs(g.user));
    for (const [path, name] of g.routes) {
      // 直开
      await cdp.nav(g.base + path, 4000);
      const direct = await cdp.eval(`JSON.stringify({ len: (document.body?.innerText ?? '').length, rc: document.getElementById('root')?.childElementCount ?? 0 })`);
      await cdp.shot(`${DIR}\\after-${name}-direct.png`);
      // 刷新
      await cdp.send('Page.reload', { ignoreCache: true });
      await sleep(4000);
      const reload = await cdp.eval(`JSON.stringify({ len: (document.body?.innerText ?? '').length, rc: document.getElementById('root')?.childElementCount ?? 0 })`);
      await cdp.shot(`${DIR}\\after-${name}-reload.png`);
      console.log(`${g.app}${path} 直开=${direct} 刷新=${reload}`);
    }
  } finally {
    cdp.close();
  }
}
