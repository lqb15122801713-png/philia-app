/** b9.3 改造后首页五段截图 + 下掉断言 + dock/服务行版式核查（in-service 态用户） */
import { writeFileSync } from 'node:fs';
import { Browser, findUser, sleep } from '../../_lib/phil.mjs';

const OUT = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9.3-home';
const APP = 'http://localhost:7100';

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);

const user = await findUser('customer');
await b.goto(`${APP}/dev-login`, 2500);
console.log('dev-login', await b.loginInPage(user.id));

await b.goto(`${APP}/home`, 4000);
await b.shot(`${OUT}/after-home-full.png`);
writeFileSync(`${OUT}/after-home-full.txt`, await b.eval('document.body.innerText'));

// 五段元素级截图（顶栏/问候/面板/服务行/dock）
const clips = await b.eval(`(()=>{
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
  };
  const panel = document.querySelector('[data-testid="home-inservice-panel"],[data-testid="home-rebook-panel"],[data-testid="home-booking-entry"],[data-testid="home-booking-loading"]');
  const pr = panel?.getBoundingClientRect();
  return JSON.stringify({
    topbar: pick('[data-testid="home-topbar"]'),
    greeting: pick('[data-testid="home-greeting"]'),
    panel: pr ? { x: Math.max(0, pr.x), y: Math.max(0, pr.y), width: pr.width, height: pr.height } : null,
    services: pick('[data-testid="home-services"]'),
    dock: pick('[data-testid="home-dock"]'),
  });
})()`);
const segs = JSON.parse(clips);
console.log('segments', clips);
for (const [name, clip] of Object.entries(segs)) {
  if (!clip) { console.log('缺段', name); continue; }
  const shot = await b.send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...clip, scale: 2 },
  });
  writeFileSync(`${OUT}/seg-${name}.png`, Buffer.from(shot.data, 'base64'));
  console.log('saved seg-' + name);
}

// 下掉六项 DOM 断言
const removed = await b.eval(`(()=>{
  const text = document.body.innerText;
  return JSON.stringify({
    banner: !!document.querySelector('img[src*="banner-home"]'),
    reminder: !!document.querySelector('[data-testid="grooming-reminder"]'),
    nearbyText: text.includes('附近好店'),
    recommendText: text.includes('推荐服务'),
    capsuleEntries: document.querySelectorAll('main a svg.lucide').length,
    oldTabBar: !!document.querySelector('button[aria-label="商城"]'),
    promoText: /促销|特惠|限时|优惠券/.test(text),
  });
})()`);
console.log('下掉断言(全 false 为通过):', removed);
writeFileSync(`${OUT}/removed-assertions.json`, JSON.stringify(JSON.parse(removed), null, 2));

// 三态面板当前模态
const mode = await b.eval(`(()=>{
  if (document.querySelector('[data-testid="home-inservice-panel"]')) return 'in-service';
  if (document.querySelector('[data-testid="home-rebook-panel"]')) return 'rebook';
  if (document.querySelector('[data-testid="home-booking-entry"]')) return 'entry';
  if (document.querySelector('[data-testid="home-booking-loading"]')) return 'loading';
  return 'none';
})()`);
console.log('当前面板模态:', mode);

b.close();
process.exit(0);
