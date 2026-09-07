// B3-3 修复后 UI 实证：
// A. 商家端待确认列表「婉拒」次按钮 + 弹层填原因
// B. 客户端详情页 SSE 收 appointment.rejected → toast + 刷新出「商家已婉拒：…」横幅
// C. 客户端详情页稳定展示（已拒单 AID2）
import { writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const AID_LIVE = '01M1Y0QFN69JPJ718X9B4KB16C';   // SSE 联动单（会被拒）
const AID_REJECTED = '01M1Y0J69QV4A4FHNSZXXVH7SG'; // 已拒单（稳定文案）

const res = await fetch('http://127.0.0.1:9223/json');
const page = (await res.json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id;
  pending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
};
await new Promise(r => ws.onopen = r);
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 414, height: 896, deviceScaleFactor: 1, mobile: true });

const evalJs = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(name, Buffer.from(s.data, 'base64'));
  console.log('saved', name);
};
const login = async (appPort, role) => {
  await send('Page.navigate', { url: `http://localhost:${appPort}/` });
  await sleep(2200);
  const uid = await evalJs(`
    (async () => {
      const u = await fetch('http://localhost:7200/api/auth/dev-seed-users').then(r => r.json());
      const t = (u.users || u).find(x => (x.roles || []).includes('${role}'));
      await fetch('http://localhost:7200/api/auth/dev-login', { method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: t.id }) });
      return t.id;
    })()
  `);
  console.log(`logged in ${role}:`, uid);
};

/* ---------- A. 商家端：列表婉拒按钮 + 弹层 ---------- */
await login(7101, 'merchant_owner');
await send('Page.navigate', { url: 'http://localhost:7101/appointments?status=pending&date=all' });
await sleep(3200);
const domA = await evalJs(`(() => {
  const btns = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
  return { hasReject: btns.some(t => t === '婉拒'), hasConfirm: btns.some(t => t === '确认') };
})()`);
console.log('A1 列表按钮断言:', JSON.stringify(domA));
await shot('ui-merchant-list-with-reject.png');

// 点「婉拒」开弹层
await evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '婉拒');
  b.click(); return true;
})()`);
await sleep(700);
const domA2 = await evalJs(`(() => {
  const dlg = document.querySelector('[role=dialog]');
  return { dialogOpen: !!dlg, title: dlg?.querySelector('h2')?.textContent ?? null,
    hasTextarea: !!dlg?.querySelector('textarea'),
    submitDisabled: dlg ? [...dlg.querySelectorAll('button')].find(b => b.textContent.includes('确认婉拒'))?.disabled ?? null : null };
})()`);
console.log('A2 弹层断言:', JSON.stringify(domA2));
// 填原因让「确认婉拒」可用（但先不提交，先截图）
await evalJs(`(() => {
  const ta = document.querySelector('[role=dialog] textarea');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '该时段已约满，麻烦改约其他时间');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return ta.value;
})()`);
await sleep(400);
await shot('ui-merchant-reject-modal.png');

/* ---------- B. 客户端：详情页 SSE 收 rejected 实时刷新 ---------- */
await login(7100, 'customer');
await send('Page.navigate', { url: `http://localhost:7100/appointments/${AID_LIVE}` });
await sleep(3500); // 等 push.subscribe + SSE 连接
const preB = await evalJs(`(() => ({
  banner: document.body.innerText.includes('商家已婉拒'),
  statusPill: (document.querySelector('header span')?.textContent) ?? null,
}))()`);
console.log('B 拒单前（应为 待确认 / 无横幅）:', JSON.stringify(preB));
await shot('ui-customer-detail-before-reject.png');

// Node 侧以商家会话触发拒单（与浏览器 profile 无关，独立 cookie）
const users = await fetch('http://localhost:7200/api/auth/dev-seed-users').then(r => r.json());
const merchant = (users.users || users).find(x => (x.roles || []).includes('merchant_owner'));
const loginRes = await fetch('http://localhost:7200/api/auth/dev-login', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: merchant.id }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
const rejRes = await fetch('http://localhost:7200/trpc/appointment.reject?batch=1', {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ '0': { json: { appointmentId: AID_LIVE, reason: '门店临时休业，敬请谅解' } } }),
});
const rejJson = await rejRes.json();
console.log('B 服务端拒单响应 status:', rejJson[0]?.result?.data?.json?.status ?? JSON.stringify(rejJson).slice(0, 200));

// 轮询最多 15s 等 SSE 送达 → toast + 横幅
let seen = null;
for (let i = 0; i < 30; i++) {
  seen = await evalJs(`(() => ({
    banner: document.body.innerText.includes('商家已婉拒'),
    bannerText: (document.body.innerText.match(/商家已婉拒[^\\n]*/) || [null])[0],
    statusPill: (document.querySelector('header span')?.textContent) ?? null,
  }))()`);
  if (seen.banner) break;
  await sleep(500);
}
console.log('B SSE 联动结果（应出现 商家已婉拒 横幅 + 已取消 状态）:', JSON.stringify(seen));
await shot('ui-customer-detail-rejected-live.png');

/* ---------- C. 客户端：已拒单稳定文案 ---------- */
await send('Page.navigate', { url: `http://localhost:7100/appointments/${AID_REJECTED}` });
await sleep(3200);
const domC = await evalJs(`(() => ({
  bannerText: (document.body.innerText.match(/商家已婉拒[^\\n]*/) || [null])[0],
  statusPill: (document.querySelector('header span')?.textContent) ?? null,
}))()`);
console.log('C 已拒单文案断言:', JSON.stringify(domC));
await shot('ui-customer-detail-rejected.png');

ws.close();
process.exit(0);
