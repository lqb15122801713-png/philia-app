/** b9.3 任务 B 验收：/booking 直达单屏（URL 断言）+ hub 不可达 + 寄养两入口 + 对称回链 */
import { writeFileSync } from 'node:fs';
import { Browser, findUser, sleep } from '../../_lib/phil.mjs';

const OUT = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9.3-home';
const APP = 'http://localhost:7100';
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(ok ? '✅' : '❌', name, '——', detail);
};

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);
const user = await findUser('customer');
await b.goto(`${APP}/dev-login`, 2500);
await b.loginInPage(user.id);

/* 1. /booking → 重定向 /booking/grooming */
await b.goto(`${APP}/booking`, 4000);
const p1 = await b.eval('location.pathname');
const t1 = await b.eval('document.body.innerText');
check('/booking 直达洗护单屏', p1 === '/booking/grooming' && t1.includes('预约洗护'), `path=${p1}`);
check('hub 不可达（无「预约服务/选择服务类型」残留）', !t1.includes('预约服务') && !t1.includes('选择服务类型'), 'hub 文案 0 命中');
await b.shot(`${OUT}/booking-redirect-grooming.png`);

/* 2. 兼容深链 /booking?type=boarding → 寄养单屏 */
await b.goto(`${APP}/booking?type=boarding`, 4000);
const p2 = await b.eval('location.pathname');
const t2 = await b.eval('document.body.innerText');
check('/booking?type=boarding 直达寄养单屏', p2 === '/booking/boarding' && t2.includes('预约寄养'), `path=${p2}`);
await b.shot(`${OUT}/booking-redirect-boarding.png`);

/* 3. 洗护单屏顶部「寄养 ›」→ 寄养单屏 */
await b.goto(`${APP}/booking/grooming`, 4000);
const hasLink = await b.eval(`!!document.querySelector('[data-testid="grooming-to-boarding"]')`);
check('洗护单屏顶部「寄养 ›」存在', hasLink, `testid=${hasLink}`);
await b.eval(`document.querySelector('[data-testid="grooming-to-boarding"]').click()`);
await sleep(3000);
const p3 = await b.eval('location.pathname');
check('「寄养 ›」点击落点 /booking/boarding', p3 === '/booking/boarding', `path=${p3}`);
await b.shot(`${OUT}/boarding-from-grooming-link.png`);

/* 4. 寄养单屏对称「洗护 ›」回链 */
const hasBack = await b.eval(`!!document.querySelector('[data-testid="boarding-to-grooming"]')`);
check('寄养单屏顶部「洗护 ›」存在', hasBack, `testid=${hasBack}`);
await b.eval(`document.querySelector('[data-testid="boarding-to-grooming"]').click()`);
await sleep(3000);
const p4 = await b.eval('location.pathname');
check('「洗护 ›」点击落点 /booking/grooming', p4 === '/booking/grooming', `path=${p4}`);

/* 5. 首页服务行「寄养服务 ›」入口 */
await b.goto(`${APP}/home`, 4000);
const hasRow = await b.eval(`!!document.querySelector('[data-testid="home-service-boarding"]')`);
check('首页服务行「寄养服务 ›」存在', hasRow, `testid=${hasRow}`);
await b.eval(`document.querySelector('[data-testid="home-service-boarding"]').click()`);
await sleep(3000);
const p5 = await b.eval('location.pathname');
check('首页「寄养服务 ›」落点 /booking/boarding', p5 === '/booking/boarding', `path=${p5}`);
await b.shot(`${OUT}/boarding-from-home-row.png`);

writeFileSync(`${OUT}/booking-redirect-checks.json`, JSON.stringify(results, null, 2));
b.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n汇总: ${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
