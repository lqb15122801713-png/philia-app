import { Cdp, sleep } from '../cdp.mjs';
const cdp = new Cdp();
try {
  await cdp.launch(1024, 768, false);
  await cdp.nav('http://localhost:7101/dev-login', 2200);
  console.log('login:', await cdp.loginAs('01M20EDD8CMJCG42PBGX9MY5NB'));
  for (const p of ['/dashboard', '/monitor', '/live']) {
    await cdp.nav('http://localhost:7101' + p, 4500);
    const t = await cdp.eval(`(document.body?.innerText ?? '').slice(0, 300)`);
    console.log('---', p, '=> final', await cdp.eval('location.pathname'), '---');
    console.log(t);
  }
} finally { cdp.close(); }
