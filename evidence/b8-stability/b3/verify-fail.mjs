// B3 自验补充：服务端失败（createOrder 立即 500）→ 错误提示 + 购物车保留
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
  await cdp.eval(`localStorage.setItem('philia.cart', ${CART}); localStorage.setItem('philia.address', JSON.stringify({ name: '走查员', phone: '13800000000', detail: '示例市示例区示例路 1 号' }))`);
  await cdp.nav('http://localhost:7100/mall/checkout', 3500);

  // 拦截 createOrder：立即以 500 失败
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:7200/trpc/mall.createOrder*', requestStage: 'Request' }] });
  cdp.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Fetch.requestPaused') {
      cdp.send('Fetch.fulfillRequest', {
        requestId: msg.params.requestId, responseCode: 500,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify([{ error: { json: { message: '库存不足（剩余 0 件）', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } } }])).toString('base64'),
      });
    }
  });

  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('提交订单'))?.click()`);
  await sleep(2500);
  const r = await cdp.eval(`JSON.stringify({
    cashierOpen: !!document.querySelector('[aria-label="收银台"]'),
    cartKept: (JSON.parse(localStorage.getItem('philia.cart') ?? '{}').items ?? []).length,
    toastShown: document.body.innerText.includes('库存不足') || document.body.innerText.includes('下单失败'),
    submitBtnBack: [...document.querySelectorAll('button')].some(x => x.textContent.includes('提交订单')),
  }, null, 1)`);
  console.log('server-500 submit =>', r);
  await cdp.shot(DIR + '\\fix-5-fail-toast.png');
} finally {
  cdp.close();
}
