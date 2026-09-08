// 一次性探针：寄养单屏选完日期后各区块状态
const API = 'http://localhost:7200', APP = 'http://localhost:7100';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function main() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try { const res = await fetch('http://127.0.0.1:9223/json'); targets = await res.json(); if (targets.length) break; } catch {}
    await sleep(500);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await new Promise(r => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evalJs = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };

  const seeds = await (await fetch(`${API}/api/auth/dev-seed-users`)).json();
  const customer = seeds.users.find(u => (u.roles || []).includes('customer'));
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2000);
  await evalJs(`fetch('${API}/api/auth/dev-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:'${customer.id}'}),credentials:'include'}).then(r=>r.status)`);
  const prep = await evalJs(`(async()=>{
    const q = (p,i)=>fetch('${API}/trpc/'+p+'?batch=1&input='+encodeURIComponent(JSON.stringify({0:{json:i}})),{credentials:'include'}).then(r=>r.json());
    const pets=(await q('pet.list',null))[0].result.data.json;
    const nearby=(await q('store.listNearby',{}))[0].result.data.json;
    return {petId:pets[0].id, storeId:nearby.stores[0].id};
  })()`);
  console.log('prep', prep);
  await send('Page.navigate', { url: `${APP}/booking/boarding?petId=${prep.petId}&storeId=${prep.storeId}` });
  await sleep(3000);
  const inD = new Date(Date.now() + 86400000), outD = new Date(Date.now() + 4 * 86400000);
  await evalJs(`document.querySelector('[data-testid="bs-checkin-cell"]').click()`);
  await sleep(1200);
  const tap = await evalJs(`(()=>{
    const ci=document.querySelector('[data-testid="bs-day-${iso(inD)}"]');
    const st1 = ci ? {disabled:ci.disabled, cls:ci.className.slice(0,80)} : null;
    if(ci && !ci.disabled) ci.click();
    const co=document.querySelector('[data-testid="bs-day-${iso(outD)}"]');
    const st2 = co ? {disabled:co.disabled} : null;
    if(co && !co.disabled) co.click();
    return {ci:st1, co:st2};
  })()`);
  console.log('tap', JSON.stringify(tap));
  await sleep(1500);
  const dump = await evalJs(`(()=>{
    const q=s=>document.querySelector(s);
    return {
      nights: q('[data-testid="bs-nights-line"]')?.textContent?.trim(),
      room: q('[data-testid="bs-room-readonly"]')?.textContent?.slice(0,60) ?? q('[data-testid="bs-room-loading"]')?.textContent,
      state: q('[data-testid="bs-confirm"]')?.getAttribute('data-state'),
      label: q('[data-testid="bs-confirm"]')?.textContent?.trim(),
      reason: q('[data-testid="bs-confirm"]')?.getAttribute('data-block-reason'),
      vaccineBar: q('[data-testid="bs-vaccine-bar"]')?.textContent?.trim(),
      sheetOpen: !!q('[data-testid^="bs-month-"]'),
    };
  })()`);
  console.log('dump', JSON.stringify(dump, null, 1));
  ws.close();
}
main().catch(e => { console.error(e); process.exit(1); });
