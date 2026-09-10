import { Cdp, sleep } from '../cdp.mjs';
const cdp = new Cdp();
try {
  await cdp.launch(1024, 768, false);
  await cdp.nav('http://localhost:7101/dev-login', 2000);
  console.log('login:', await cdp.loginAs('01M20EDD8CMJCG42PBGX9MY5NB'));
  await cdp.nav('http://localhost:7101/no-such-page', 2500);
  for (let i = 0; i < 6; i++) {
    console.log('t+' + (i * 500) + 'ms path =', await cdp.eval('location.pathname'),
      '| body has 仪表盘/今日:', await cdp.eval(`document.body.innerText.length`));
    await sleep(500);
  }
} finally { cdp.close(); }
