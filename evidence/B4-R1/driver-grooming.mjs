/**
 * B4-R1 录屏驱动·洗护单屏：确认条完整可见 + 中央可点实证
 * 流程：登录 → /booking/grooming（URL 三参预填）→ 选时间 → 断言无 TabBar +
 * elementFromPoint(确认条中央)===按钮 → 截图（可点态）→ 中央真实点击 → 成功页。
 */
import { writeFileSync } from 'node:fs';

const API = 'http://localhost:7200';
const APP = 'http://localhost:7100';
const OUT = process.env.B4R1_OUT || '.';

export default async function drive(evalJs, send, sleep) {
  const log = [];
  const assert = (name, ok, detail = '') => {
    log.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) throw new Error('断言失败: ' + name);
  };

  // 动态取种子客户
  const seeds = await (await fetch(`${API}/api/auth/dev-seed-users`)).json();
  const customer = seeds.users.find(u => (u.roles || []).includes('customer')) ?? seeds.users[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2000);
  const login = await evalJs(`fetch('${API}/api/auth/dev-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:'${customer.id}'}),credentials:'include'}).then(r=>r.status)`);
  assert('dev-login 种子客户', login === 200, `HTTP ${login}`);

  // 取预填三参：pet.list / store.getWithServices（listNearby 第一家）
  const prep = await evalJs(`(async()=>{
    const q = (p,i)=>fetch('${API}/trpc/'+p+'?batch=1&input='+encodeURIComponent(JSON.stringify({0:{json:i}})),{credentials:'include'}).then(r=>r.json());
    const pets=(await q('pet.list',null))[0].result.data.json;
    const nearby=(await q('store.listNearby',{}))[0].result.data.json;
    const store=nearby.stores[0];
    const gws=(await q('store.getWithServices',{storeId:store.id}))[0].result.data.json;
    const svc=gws.services.find(s=>s.type==='grooming');
    return {petId:pets[0].id, storeId:store.id, serviceId:svc.id};
  })()`);
  log.push(`prep ${JSON.stringify(prep)}`);

  await send('Page.navigate', { url: `${APP}/booking/grooming?petId=${prep.petId}&storeId=${prep.storeId}&serviceId=${prep.serviceId}` });
  await sleep(3000);

  // 选第一个可点时段（今天/明天第一个非灰槽）
  const picked = await evalJs(`(()=>{
    const btns=[...document.querySelectorAll('[data-testid^="gs-slot-"]')].filter(b=>!b.disabled);
    if(!btns.length) return null;
    btns[0].click(); return btns[0].textContent.trim();
  })()`);
  await sleep(1200);
  log.push(`picked slot: ${picked}`);

  // 断言 1：无 TabBar（凸起中按钮不存在）
  const noTabBar = await evalJs(`!document.querySelector('[aria-label="Philia"]') && !document.querySelector('nav[aria-label="底部导航"]')`);
  assert('单屏页无 TabBar', noTabBar === true);

  // 断言 2：确认条可点态 + 中央命中测试
  const state = await evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.getAttribute('data-state')`);
  assert('确认条可点态', state === 'ready', `state=${state}`);
  const hit = await evalJs(`(()=>{
    const b=document.querySelector('[data-testid="gs-confirm"]');
    const r=b.getBoundingClientRect();
    const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    return {center: el===b || b.contains(el), text: b.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight};
  })()`);
  assert('elementFromPoint(中央)===确认按钮', hit.center === true, JSON.stringify(hit));

  // 截图：洗护可点态
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/r1-grooming-ready.png`, Buffer.from(shot1.data, 'base64'));

  // 中央真实点击（坐标点击，非 JS click）
  await evalJs(`(()=>{const b=document.querySelector('[data-testid="gs-confirm"]');const r=b.getBoundingClientRect();window.__cx=r.left+r.width/2;window.__cy=r.top+r.height/2;})()`);
  const cx = await evalJs('window.__cx'), cy = await evalJs('window.__cy');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
  await sleep(2500);
  const path = await evalJs('location.pathname');
  assert('中央点击后落成功页', path === '/booking/success', path);

  // 断言 3：成功页 TabBar 维持现状（仍在）
  const tabOnSuccess = await evalJs(`!!document.querySelector('[aria-label="Philia"]')`);
  assert('成功页 TabBar 保留（现状不动）', tabOnSuccess === true);

  writeFileSync(`${OUT}/r1-grooming-asserts.txt`, log.join('\n') + '\n');
  console.log(log.join('\n'));
}
