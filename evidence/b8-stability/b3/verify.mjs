// B3 自验（修复后）：1) 购物车结算→收银台出现→模拟支付→成功页→订单列表
//                     2) 失败路径（断网）→ 购物车保留 + 错误提示
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b3';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';
const CART = `JSON.stringify({ items: [{
  productId: '01M20EDD8GG8B9DM30FRF0A7T8', storeId: '01M20EDD8FQ5K9X22WACHWSXN4',
  storeName: '菲丽亚宠物·示例店', name: '全价成犬粮 2kg', priceFen: 12900,
  image: null, stock: 51, qty: 1, checked: true,
}] })`;

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7100/dev-login', 2000);
  console.log('login:', await cdp.loginAs(CUSTOMER));

  /* ---- 1. 成功路径 ---- */
  await cdp.eval(`localStorage.setItem('philia.cart', ${CART}); localStorage.setItem('philia.address', JSON.stringify({ name: '走查员', phone: '13800000000', detail: '示例市示例区示例路 1 号' }))`);
  await cdp.nav('http://localhost:7100/mall/checkout', 3500);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('提交订单'))?.click()`);
  await sleep(2500);
  const s1 = await cdp.eval(`JSON.stringify({
    cashierOpen: !!document.querySelector('[aria-label="收银台"]'),
    emptyState: document.body.innerText.includes('没有待结算的商品'),
    cashierReady: document.body.innerText.includes('模拟支付成功') || document.body.innerText.includes('收银台准备中'),
  }, null, 1)`);
  console.log('after submit =>', s1);
  await cdp.shot(DIR + '\\fix-1-cashier-open.png');

  // 模拟支付成功
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('模拟支付成功'))?.click()`);
  await sleep(2500);
  const s2 = await cdp.eval(`JSON.stringify({
    paidPage: document.body.innerText.includes('支付成功'),
    orderNo: (document.body.innerText.match(/订单号\s*(\S+)/) ?? [])[1] ?? null,
  }, null, 1)`);
  console.log('after mock pay =>', s2);
  await cdp.shot(DIR + '\\fix-2-paid.png');

  // 查看订单 → 订单列表
  await cdp.eval(`[...document.querySelectorAll('a')].find(x => x.textContent.includes('查看订单'))?.click()`);
  await sleep(3000);
  console.log('orders page =>', await cdp.eval(`JSON.stringify({ path: location.pathname, hasOrder: document.body.innerText.includes('全价成犬粮') })`));
  await cdp.shot(DIR + '\\fix-3-orders.png');

  /* ---- 2. 失败路径（断网）：购物车保留 + 错误提示 ---- */
  await cdp.eval(`localStorage.setItem('philia.cart', ${CART})`);
  await cdp.nav('http://localhost:7100/mall/checkout', 3500);
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('提交订单'))?.click()`);
  await sleep(4000);
  const f1 = await cdp.eval(`JSON.stringify({
    cashierOpen: !!document.querySelector('[aria-label="收银台"]'),
    cartKept: (JSON.parse(localStorage.getItem('philia.cart') ?? '{}').items ?? []).length,
    stillOnCheckout: location.pathname === '/mall/checkout',
    pageText: document.body.innerText.slice(0, 200),
  }, null, 1)`);
  console.log('offline submit =>', f1);
  await cdp.shot(DIR + '\\fix-4-fail-keeps-cart.png');
} finally {
  cdp.close();
}
