#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7163').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7242').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9243)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'tdd'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'design-upgrade-u4-mag-mall')
const BROWSER = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean).find((p) => existsSync(p))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = []
let browser = null
const profileDir = join(tmpdir(), `philia-u4-mag-mall-${process.pid}`)

function record(id, ok, detail, state = undefined) {
  results.push({ id, ok, detail, state })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function launchBrowser() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome 可执行文件')
  browser = spawn(BROWSER, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // CDP 尚未就绪时继续等待。
    }
    await sleep(500)
  }
  throw new Error(`CDP 端口 ${CDP_PORT} 未就绪`)
}

function cleanup() {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' })
  browser = null
  try {
    rmSync(profileDir, { recursive: true, force: true })
  } catch {
    // 临时浏览器目录清理由系统兜底，不覆盖测试结果。
  }
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(2))

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 0
    this.pending = new Map()
  }

  async open() {
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const pending = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? pending.reject(new Error(msg.error.message)) : pending.resolve(msg.result)
        return
      }
      if (msg.method === 'Fetch.requestPaused') {
        this.send('Fetch.failRequest', { requestId: msg.params.requestId, errorReason: 'ConnectionAborted' }).catch(() => {})
      }
    }
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
    await this.send('Page.enable')
    await this.send('Runtime.enable')
    await this.send('Network.enable')
    await this.send('Network.setBypassServiceWorker', { bypass: true })
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/events*', requestStage: 'Request' }] })
    await this.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
    }
    return response.result.value
  }

  async waitFor(expression, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await this.eval(expression).catch(() => false)) return true
      await sleep(250)
    }
    return false
  }

  close() {
    try {
      this.ws.close()
    } catch {
      // 已断开时无需重复关闭。
    }
  }
}

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  const ready = await cdp.waitFor(readyExpression)
  if (!ready) throw new Error(`页面未就绪：${path}`)
}

async function login(cdp) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const customer = users.find((user) => (user.roles ?? []).includes('customer'))
  if (!customer) throw new Error('无种子客户')
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
  return customer
}

async function devLogin(userId) {
  const response = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!response.ok) throw new Error(`夹具 dev-login HTTP ${response.status}`)
  const cookie = (response.headers.getSetCookie?.() ?? []).map((item) => item.split(';')[0]).join('; ')
  if (!cookie.includes('philia_session=')) throw new Error('夹具 dev-login 未返回会话')
  await response.body?.cancel()
  return cookie
}

function unwrap(payload, name) {
  const first = payload?.[0]
  if (first?.error) throw new Error(`${name} 失败：${JSON.stringify(first.error.json ?? first.error)}`)
  return first?.result?.data?.json
}

async function trpcQuery(cookie, path, input) {
  const payload = encodeURIComponent(JSON.stringify({ 0: { json: input ?? null } }))
  const response = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, { headers: { Cookie: cookie } })
  return unwrap(await response.json(), `trpc ${path}`)
}

function cartFixture(product, qty = 1) {
  return {
    productId: product.id,
    storeId: product.storeId,
    storeName: 'U4 隔离夹具门店',
    name: product.name,
    priceFen: product.priceFen,
    image: product.images?.[0] ?? null,
    stock: product.stock,
    qty,
    checked: true,
  }
}

async function checkMagazine(cdp) {
  await navigate(cdp, '/philia', `!!document.querySelector('[data-testid="philia-magazine"]')`)
  await sleep(500)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const member = document.querySelector('[data-testid="philia-member-strip"]')
    const shortcuts = [...document.querySelectorAll('[data-testid^="philia-shortcut-"]')].map((el) => el.textContent.trim())
    const lead = document.querySelector('[data-testid="philia-editorial-lead"]')
    const secondary = [...document.querySelectorAll('[data-u4-secondary]')].map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
    return {
      head: document.querySelector('.m2-apphead')?.innerText ?? '',
      member: member?.innerText ?? '',
      shortcuts,
      lead: !!lead,
      leadImages: lead?.querySelectorAll('img,[role="img"]').length ?? 0,
      leadText: lead?.innerText ?? '',
      afterAlt: [...(lead?.querySelectorAll('[role="img"]') ?? [])][1]?.getAttribute('aria-label') ?? '',
      pgc: document.querySelector('[data-testid="philia-mag-note"]')?.innerText ?? '',
      secondary,
    }
  })())`))
  const minFont = state.secondary.length > 0 ? Math.min(...state.secondary) : 0
  const ok = state.head.includes('品牌杂志') && state.member.includes('回馈金') && state.member.includes('会员码')
    && state.shortcuts.join('|') === '权益|券|任务'
    && state.lead && state.leadImages >= 2
    && state.leadText.includes('今日') && state.leadText.includes('示例店') && state.leadText.includes('前') && state.leadText.includes('后')
    && state.afterAlt.includes('后') && state.pgc.includes('不开放投稿')
    && minFont >= 12
  record('U4-187 杂志会员条、三入口与编辑前后对照', ok, `会员条=${state.member.replace(/\n/g, '/') || '缺'}；入口=${state.shortcuts.join('/')}；lead=${state.lead}；图=${state.leadImages}；副文最小=${minFont}px`, state)
  await shot(cdp, '187-philia')
}

async function checkMall(cdp) {
  await navigate(cdp, '/mall', `!!document.querySelector('[data-testid="mall-hero"]') && !!document.querySelector('[data-block-key="mall.productGrid"] .grid')`)
  await sleep(500)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const hero = document.querySelector('[data-testid="mall-hero"]')
    const cards = [...document.querySelectorAll('[data-testid^="mall-product-card-"]')]
    return {
      search: document.querySelector('input')?.placeholder ?? '',
      rebate: document.querySelector('[data-testid="mall-rebate-pill"]')?.innerText ?? '',
      categories: [...document.querySelectorAll('[data-testid^="mall-cat-"]')].map((el) => el.textContent.trim()),
      heroCopy: !!document.querySelector('[data-testid="mall-hero-copy"]'),
      heroImages: hero?.querySelectorAll('img,[role="img"]').length ?? 0,
      cards: cards.map((el) => el.innerText),
      imageStates: cards.map((card) => ({
        generatedSvg: [...card.querySelectorAll('img')].filter((img) => img.src.includes('/products/') && img.src.endsWith('.svg')).length,
        pending: [...card.querySelectorAll('[role="img"]')].filter((el) => el.innerText.includes('待换')).length,
      })),
      quickAdds: document.querySelectorAll('[data-testid^="mall-quickadd-"]').length,
    }
  })())`))
  const structureOk = state.search.includes('搜索粮') && state.rebate.includes('回馈金')
    && state.categories.join('|') === '推荐|粮|零食|洗护|玩具|出行'
    && state.heroCopy && state.heroImages >= 1
    && state.cards.length > 0 && state.cards.every((text) => text.includes('会员') && text.includes('购可得'))
    && state.imageStates.every((item) => item.generatedSvg === 0 && item.pending === 1)
    && state.quickAdds === 0
  if (!structureOk) {
    record('U4-188 商城定稿结构与洗护真实筛选', false, `搜索=${state.search}；pill=${state.rebate}；类目=${state.categories.join('/')}；heroCopy=${state.heroCopy}；商品卡=${state.cards.length}；快加购=${state.quickAdds}`, state)
    await shot(cdp, '188-mall')
    return
  }
  await cdp.eval(`document.querySelector('[data-testid="mall-cat-洗护"]').click()`)
  const filtered = await cdp.waitFor(`[...document.querySelectorAll('[data-testid^="mall-product-card-"]')].length > 0 && [...document.querySelectorAll('[data-testid^="mall-product-card-"]')].every((el) => el.innerText.includes('香波') || el.innerText.includes('猫砂'))`, 8000)
  record('U4-188 商城定稿结构与洗护真实筛选', filtered, `结构齐；洗护筛选=${filtered}`, state)
  await shot(cdp, '188-mall')
}

async function checkProductDetail(cdp) {
  await navigate(cdp, '/mall', `!!document.querySelector('[data-testid^="mall-product-card-"] a')`)
  const href = await cdp.eval(`document.querySelector('[data-testid^="mall-product-card-"] a').getAttribute('href')`)
  await navigate(cdp, href, `!!document.querySelector('[data-block-key="pdp.info"]') && !!document.querySelector('[data-testid="pdp-add-cart"]')`)
  await sleep(500)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const cta = document.querySelector('[data-block-key="pdp.ctaBar"]')
    return {
      info: document.querySelector('[data-block-key="pdp.info"]')?.innerText ?? '',
      rebate: document.querySelector('[data-testid="pdp-rebate-strip"]')?.innerText ?? '',
      specs: document.querySelector('[data-testid="pdp-specs"]')?.innerText ?? '',
      ctaButtons: cta?.querySelectorAll('button').length ?? 0,
      buyNow: document.querySelectorAll('[data-testid="pdp-buy-now"]').length,
      addText: document.querySelector('[data-testid="pdp-add-cart"]')?.innerText ?? '',
      secondary: [...document.querySelectorAll('[data-u4-secondary]')].map((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
    }
  })())`))
  const minFont = state.secondary.length > 0 ? Math.min(...state.secondary) : 0
  const ok = state.info.includes('会员价') && state.rebate.includes('预计得回馈金') && state.rebate.includes('按实付约')
    && state.specs.includes('规格') && state.specs.length > 2
    && state.ctaButtons === 1 && state.buyNow === 0 && state.addText.includes('加入购物车')
    && minFont >= 12
  record('U4-188D 商详信息、回馈金、规格与单一加购闸口', ok, `会员价=${state.info.includes('会员价')}；回馈条=${state.rebate.replace(/\n/g, '/') || '缺'}；规格=${state.specs.replace(/\n/g, '/') || '缺'}；CTA=${state.ctaButtons}；立即购买=${state.buyNow}；副文最小=${minFont}px`, state)
  await shot(cdp, '188-product')
}

async function checkCart(cdp, context) {
  const items = context.products.map((product) => cartFixture(product))
  await cdp.eval(`localStorage.setItem('philia.cart', ${JSON.stringify(JSON.stringify({ items }))}); localStorage.removeItem('philia.rebateUse')`)
  await navigate(cdp, '/mall/cart', `!!document.querySelector('button[aria-label="增加数量"]')`)
  await sleep(500)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => ({
    manage: document.querySelector('[data-testid="cart-manage"]')?.innerText ?? '',
    rows: document.querySelectorAll('[data-testid^="cart-row-"]').length,
    checkDots: document.querySelectorAll('[role="checkbox"]').length,
    rebate: document.querySelector('[data-testid="cart-rebate-card"]')?.innerText ?? '',
    switchChecked: document.querySelector('[data-testid="cart-rebate-switch"]')?.getAttribute('aria-checked') ?? '',
    deduction: document.querySelector('[data-testid="cart-deduction"]')?.innerText ?? '',
    payable: document.querySelector('[data-testid="cart-payable"]')?.innerText ?? '',
    checkout: document.querySelector('[data-testid="cart-checkout"]')?.innerText ?? '',
    storeNote: document.querySelector('[data-testid="cart-store-note"]')?.innerText ?? '',
    secondary: [...document.querySelectorAll('[data-u4-secondary]')].map((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
  }))())`))
  const minFont = state.secondary.length > 0 ? Math.min(...state.secondary) : 0
  const structureOk = state.manage.includes('管理') && state.rows === 2 && state.checkDots === 0
    && state.storeNote.includes('一次下单仅支持同一门店')
    && state.rebate.includes('使用回馈金') && state.rebate.includes('余额') && state.switchChecked === 'true'
    && state.deduction.includes('-¥') && state.payable.includes('¥') && state.checkout.includes('去结算')
    && minFont >= 12
  if (!structureOk) {
    record('U4-189C 购物车行、回馈金抵扣与管理态', false, `管理=${state.manage || '缺'}；行=${state.rows}；默认可选=${state.checkDots}；回馈金=${state.rebate.replace(/\n/g, '/') || '缺'}；应付=${state.payable || '缺'}`, state)
    await shot(cdp, '189-cart')
    return
  }
  await cdp.eval(`document.querySelector('[data-testid="cart-rebate-switch"]').click()`)
  await sleep(300)
  const off = JSON.parse(await cdp.eval(`JSON.stringify({
    deduction: document.querySelector('[data-testid="cart-deduction"]')?.innerText ?? '',
    payable: document.querySelector('[data-testid="cart-payable"]')?.innerText ?? '',
  })`))
  const toggled = off.deduction.includes('¥0') && off.payable !== state.payable
  await cdp.eval(`document.querySelector('[data-testid="cart-manage"]').click()`)
  const managed = await cdp.waitFor(`document.querySelectorAll('[role="checkbox"]').length === 2`, 5000)
  await cdp.eval(`document.querySelector('[data-testid="cart-manage"]').click()`)
  const restored = await cdp.waitFor(`document.querySelectorAll('[role="checkbox"]').length === 0`, 5000)
  await cdp.eval(`document.querySelector('[data-testid="cart-rebate-switch"]').click()`)
  const rebateRestored = await cdp.waitFor(`!document.querySelector('[data-testid="cart-deduction"]')?.innerText.includes('¥0')`, 5000)
  record('U4-189C 购物车行、回馈金抵扣与管理态', toggled && managed && restored && rebateRestored, `抵扣联动=${toggled}；管理展开=${managed}；收起=${restored}；默认态复位=${rebateRestored}`, { before: state, off })
  await shot(cdp, '189-cart')
  await cdp.eval(`document.querySelector('[data-testid="cart-rebate-switch"]').click()`)
  await cdp.waitFor(`document.querySelector('[data-testid="cart-deduction"]')?.innerText.includes('¥0')`, 5000)
}

async function checkCheckout(cdp, context) {
  const items = context.products.map((product) => cartFixture(product))
  await cdp.eval(`localStorage.setItem('philia.cart', ${JSON.stringify(JSON.stringify({ items }))})`)
  await navigate(cdp, '/mall/checkout', `!!document.querySelector('[data-block-key], [data-testid="checkout-submit"]') || (document.body?.innerText ?? '').includes('确认订单')`)
  await sleep(700)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => ({
    head: document.body.innerText.includes('确认订单'),
    delivery: [...document.querySelectorAll('[data-testid^="checkout-delivery-"]')].map((el) => el.innerText.trim()),
    pickupPressed: document.querySelector('[data-testid="checkout-delivery-pickup"]')?.getAttribute('aria-pressed') ?? '',
    store: document.querySelector('[data-testid="checkout-pickup-store"]')?.innerText ?? '',
    summary: document.querySelector('[data-testid="checkout-items-summary"]')?.innerText ?? '',
    fees: document.querySelector('[data-testid="checkout-fees"]')?.innerText ?? '',
    rebate: document.querySelector('[data-testid="checkout-rebate-card"]')?.innerText ?? '',
    switchChecked: document.querySelector('[data-testid="checkout-rebate-switch"]')?.getAttribute('aria-checked') ?? '',
    deduction: document.querySelector('[data-testid="checkout-deduction"]')?.innerText ?? '',
    payable: document.querySelector('[data-testid="checkout-payable"]')?.innerText ?? '',
    submit: document.querySelector('[data-testid="checkout-submit"]')?.innerText ?? '',
    addressInputs: [...document.querySelectorAll('input, textarea')].filter((el) => el.offsetParent !== null).length,
    secondary: [...document.querySelectorAll('[data-u4-secondary]')].map((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
  }))())`))
  const minFont = state.secondary.length > 0 ? Math.min(...state.secondary) : 0
  const structureOk = state.head
    && state.delivery.join('|') === '到店自提|配送到家' && state.pickupPressed === 'true'
    && state.store.length > 0 && state.summary.includes('2 件商品')
    && state.fees.includes('商品金额') && state.fees.includes('运费') && state.fees.includes('回馈金抵扣') && state.fees.includes('应付')
    && state.rebate.includes('使用回馈金') && state.rebate.includes('余额') && state.switchChecked === 'false'
    && state.deduction.includes('¥0') && state.payable.includes('¥') && state.submit.includes('确认支付')
    && state.addressInputs === 0 && minFont >= 12
  if (!structureOk) {
    record('U4-189S 结算自提、汇总、费用与回馈金表面', false, `配送=${state.delivery.join('/')}；门店=${state.store.replace(/\n/g, '/') || '缺'}；汇总=${state.summary.replace(/\n/g, '/') || '缺'}；费用=${state.fees.replace(/\n/g, '/') || '缺'}；提交=${state.submit || '缺'}；地址字段=${state.addressInputs}`, state)
    await shot(cdp, '189-checkout')
    return
  }
  await cdp.eval(`document.querySelector('[data-testid="checkout-rebate-switch"]').click()`)
  await sleep(300)
  const on = JSON.parse(await cdp.eval(`JSON.stringify({
    checked: document.querySelector('[data-testid="checkout-rebate-switch"]')?.getAttribute('aria-checked') ?? '',
    deduction: document.querySelector('[data-testid="checkout-deduction"]')?.innerText ?? '',
    payable: document.querySelector('[data-testid="checkout-payable"]')?.innerText ?? '',
  })`))
  const toggled = on.checked === 'true' && !on.deduction.includes('¥0') && on.payable !== state.payable
  record('U4-189S 结算自提、汇总、费用与回馈金表面', toggled, `跨页继承=off；开启联动=${toggled}`, { before: state, on })
  await shot(cdp, '189-checkout')
}

async function checkGroupbuy(cdp) {
  await navigate(cdp, '/mall?channel=groupbuy', `!!document.querySelector('[data-testid="mall-groupbuy-pending"]')`)
  const state = JSON.parse(await cdp.eval(`JSON.stringify({
    pending: document.querySelector('[data-testid="mall-groupbuy-pending"]')?.innerText ?? '',
    products: document.querySelectorAll('[data-testid^="mall-product-card-"]').length,
    categories: document.querySelectorAll('[data-testid^="mall-cat-"]').length,
    exit: !!document.querySelector('[data-testid="mall-groupbuy-pending"] a[href="/mall"]'),
  })`))
  const ok = state.pending.includes('团购') && state.products === 0 && state.categories === 0 && state.exit
  record('U4-188G groupbuy 待上线分支不受商城定稿影响', ok, `商品=${state.products}；类目=${state.categories}；出口=${state.exit}`, state)
  await shot(cdp, '188-groupbuy')
}

const checks = [checkMagazine, checkMall, checkProductDetail, checkCart, checkCheckout, checkGroupbuy]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  const customer = await login(cdp)
  const cookie = await devLogin(customer.id)
  const catalog = await trpcQuery(cookie, 'mall.listProducts', { page: 1, pageSize: 2 })
  const context = { products: catalog?.items?.slice(0, 2) ?? [] }
  if (context.products.length < 2) throw new Error('商城夹具商品不足')
  for (const check of checks) await check(cdp, context)
  cdp.close()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({
    at: new Date().toISOString(),
    base: CUSTOMER_URL,
    results,
  }, null, 2))
  if (results.length !== checks.length) {
    console.error(`检查数不符：期望 ${checks.length}，实际 ${results.length}；拒绝空跑假绿`)
    process.exit(2)
  }
  const failures = results.filter((result) => !result.ok).length
  console.log(`汇总：${results.length - failures}/${results.length} 通过；证据目录=${OUT_DIR}`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(`环境异常：${error?.message ?? error}`)
  process.exit(2)
})
