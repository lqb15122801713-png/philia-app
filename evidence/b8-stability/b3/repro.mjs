// B3 复现（修复前）：客户端商城购物车结算 → 提交订单 → 观察反馈（预期：原地变空态，收银台不出现）
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b3';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7100/dev-login', 2000);
  console.log('login:', await cdp.loginAs(CUSTOMER));

  // 预置购物车（localStorage philia.cart）+ 地址记忆
  await cdp.eval(`(() => {
    localStorage.setItem('philia.cart', JSON.stringify({ items: [{
      productId: '01M20EDD8GG8B9DM30FRF0A7T8', storeId: '01M20EDD8FQ5K9X22WACHWSXN4',
      storeName: '菲丽亚宠物·示例店', name: '全价成犬粮 2kg', priceFen: 12900,
      image: null, stock: 51, qty: 1, checked: true,
    }] }));
    localStorage.setItem('philia.address', JSON.stringify({ name: '走查员', phone: '13800000000', detail: '示例市示例区示例路 1 号' }));
  })()`);

  await cdp.nav('http://localhost:7100/mall/checkout', 3500);
  console.log('checkout rendered:', await cdp.eval(`document.body.innerText.includes('确认订单') && document.body.innerText.includes('全价成犬粮')`));
  await cdp.shot(DIR + '\\repro-1-checkout.png');

  // 提交订单
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('提交订单'))?.click()`);
  await sleep(800);
  await cdp.shot(DIR + '\\repro-2-after-submit-0.8s.png');
  await sleep(2500);
  await cdp.shot(DIR + '\\repro-3-after-submit-3.3s.png');

  const r = await cdp.eval(`JSON.stringify({
    path: location.pathname,
    cashierOpen: !!document.querySelector('[aria-label="收银台"]'),
    emptyState: document.body.innerText.includes('没有待结算的商品'),
    btnText: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t).slice(0, 8),
    toast: document.querySelector('[data-mall-toast]')?.textContent ?? null,
    cartAfter: localStorage.getItem('philia.cart'),
  }, null, 1)`);
  console.log('after submit =>', r);
} finally {
  cdp.close();
}
