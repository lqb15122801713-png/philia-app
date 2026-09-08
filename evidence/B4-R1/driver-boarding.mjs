/**
 * B4-R1 录屏驱动·寄养单屏：确认条完整可见 + 中央可点实证
 * 流程：登录 → /booking/boarding（URL 预填）→ 月历点入住/退房 → 断言无 TabBar +
 * elementFromPoint(确认条中央)===按钮 → 截图（可点态）→ 中央真实点击 → 成功页。
 */
import { writeFileSync } from 'node:fs';

const API = 'http://localhost:7200';
const APP = 'http://localhost:7100';
const OUT = process.env.B4R1_OUT || '.';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default async function drive(evalJs, send, sleep) {
  const log = [];
  const assert = (name, ok, detail = '') => {
    log.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) throw new Error('断言失败: ' + name);
  };

  const seeds = await (await fetch(`${API}/api/auth/dev-seed-users`)).json();
  const customer = seeds.users.find(u => (u.roles || []).includes('customer')) ?? seeds.users[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2000);
  const login = await evalJs(`fetch('${API}/api/auth/dev-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:'${customer.id}'}),credentials:'include'}).then(r=>r.status)`);
  assert('dev-login 种子客户', login === 200, `HTTP ${login}`);

  const prep = await evalJs(`(async()=>{
    const q = (p,i)=>fetch('${API}/trpc/'+p+'?batch=1&input='+encodeURIComponent(JSON.stringify({0:{json:i}})),{credentials:'include'}).then(r=>r.json());
    const pets=(await q('pet.list',null))[0].result.data.json;
    const nearby=(await q('store.listNearby',{}))[0].result.data.json;
    return {petId:pets[0].id, storeId:nearby.stores[0].id};
  })()`);
  log.push(`prep ${JSON.stringify(prep)}`);

  await send('Page.navigate', { url: `${APP}/booking/boarding?petId=${prep.petId}&storeId=${prep.storeId}` });
  await sleep(3000);

  // 打开月历，点入住（明天）→ 等重渲染 → 点退房（+3 天）
  const inD = new Date(Date.now() + 86400000), outD = new Date(Date.now() + 4 * 86400000);
  await evalJs(`document.querySelector('[data-testid="bs-checkin-cell"]').click()`);
  await sleep(1200);
  const t1 = await evalJs(`(()=>{
    const ci=document.querySelector('[data-testid="bs-day-${iso(inD)}"]');
    if(!ci || ci.disabled) return {ok:false, why:'checkin-day-missing-or-disabled'};
    ci.click(); return {ok:true};
  })()`);
  assert('点入住日', t1.ok === true, t1.why || iso(inD));
  await sleep(1000); // 等 React 重渲染（阶段切到 checkout），避免陈旧闭包
  const t2 = await evalJs(`(()=>{
    const co=document.querySelector('[data-testid="bs-day-${iso(outD)}"]');
    if(!co || co.disabled) return {ok:false, why:'checkout-day-missing-or-disabled'};
    co.click(); return {ok:true, phase: co.getAttribute('data-phase')};
  })()`);
  assert('点退房日', t2.ok === true, t2.why || `${iso(outD)} phase=${t2.phase}`);
  await sleep(1500);

  const nights = await evalJs(`document.querySelector('[data-testid="bs-nights-line"]')?.textContent?.trim() ?? ''`);
  log.push(`nights-line: ${nights}`);

  const noTabBar = await evalJs(`!document.querySelector('[aria-label="Philia"]') && !document.querySelector('nav[aria-label="底部导航"]')`);
  assert('单屏页无 TabBar', noTabBar === true);

  const state = await evalJs(`document.querySelector('[data-testid="bs-confirm"]')?.getAttribute('data-state')`);
  assert('确认条可点态（无疫苗阻断）', state === 'ready', `state=${state}`);
  const hit = await evalJs(`(()=>{
    const b=document.querySelector('[data-testid="bs-confirm"]');
    const r=b.getBoundingClientRect();
    const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    return {center: el===b || b.contains(el), text: b.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight};
  })()`);
  assert('elementFromPoint(中央)===确认按钮', hit.center === true, JSON.stringify(hit));

  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/r1-boarding-ready.png`, Buffer.from(shot1.data, 'base64'));

  await evalJs(`(()=>{const b=document.querySelector('[data-testid="bs-confirm"]');const r=b.getBoundingClientRect();window.__cx=r.left+r.width/2;window.__cy=r.top+r.height/2;})()`);
  const cx = await evalJs('window.__cx'), cy = await evalJs('window.__cy');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
  await sleep(2500);
  const path = await evalJs('location.pathname');
  assert('中央点击后落成功页', path === '/booking/success', path);

  const tabOnSuccess = await evalJs(`!!document.querySelector('[aria-label="Philia"]')`);
  assert('成功页 TabBar 保留（现状不动）', tabOnSuccess === true);

  // 断言 4：旧向导隐藏路由 TabBar 维持现状（仍在）
  await send('Page.navigate', { url: `${APP}/booking/boarding/wizard` });
  await sleep(2000);
  const tabOnWizard = await evalJs(`!!document.querySelector('[aria-label="Philia"]')`);
  assert('旧向导 /wizard TabBar 保留（现状不动）', tabOnWizard === true);

  writeFileSync(`${OUT}/r1-boarding-asserts.txt`, log.join('\n') + '\n');
  console.log(log.join('\n'));
}
