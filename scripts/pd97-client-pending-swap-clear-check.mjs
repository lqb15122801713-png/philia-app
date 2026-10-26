#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7197').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? CUSTOMER_URL).replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? (9400 + (process.pid % 500)))
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'baseline'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'pd97-client-pending-swap-clear')
const CREATE_ORDERS = process.env.PD97_CREATE_ORDERS === '1'
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
].filter(Boolean).find((path) => existsSync(path))
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const profileDir = join(tmpdir(), `philia-pd97-${process.pid}`)
const checks = []
let ordersCreated = 0
let browser = null

function record(id, identityOk, assetOk, state) {
  checks.push({ id, ok: identityOk && assetOk, identityOk, assetOk, state })
  console.log(`${identityOk && assetOk ? 'GREEN' : 'RED'} ${id} identity=${identityOk} asset=${assetOk} pending=${state.pendingCount}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const metrics = await cdp.send('Page.getLayoutMetrics')
  const width = Math.ceil(metrics.cssContentSize?.width ?? metrics.contentSize.width)
  const height = Math.min(12000, Math.ceil(metrics.cssContentSize?.height ?? metrics.contentSize.height))
  const image = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function launchBrowser() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome')
  browser = spawn(BROWSER, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ], { stdio: 'ignore' })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(500)
  }
  throw new Error(`CDP ${CDP_PORT} 未就绪`)
}

function cleanup() {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' })
  browser = null
  try { rmSync(profileDir, { recursive: true, force: true }) } catch {}
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
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result)
        return
      }
      if (message.method === 'Fetch.requestPaused') {
        this.send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'ConnectionAborted' }).catch(() => {})
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
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
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
    try { this.ws.close() } catch {}
  }
}

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  if (!await cdp.waitFor(readyExpression)) throw new Error(`页面未就绪：${path}`)
  await sleep(700)
}

async function devLogin(userId) {
  const response = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!response.ok) throw new Error(`dev-login HTTP ${response.status}`)
  const cookie = (response.headers.getSetCookie?.() ?? []).map((item) => item.split(';')[0]).join('; ')
  if (!cookie.includes('philia_session=')) throw new Error('dev-login 未返回会话')
  await response.body?.cancel()
  return cookie
}

function unwrap(payload, name) {
  const first = payload?.[0]
  if (first?.error) throw new Error(`${name}：${JSON.stringify(first.error.json ?? first.error)}`)
  return first?.result?.data?.json
}

async function trpcQuery(cookie, path, input) {
  const payload = encodeURIComponent(JSON.stringify({ 0: { json: input ?? null } }))
  const response = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, { headers: { Cookie: cookie } })
  return unwrap(await response.json(), path)
}

async function trpcMutation(cookie, path, input) {
  const response = await fetch(`${API_BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ 0: { json: input } }),
  })
  return unwrap(await response.json(), path)
}

async function login(cdp) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`dev-seed-users HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const customer = users.find((user) => (user.roles ?? []).includes('customer'))
  if (!customer) throw new Error('无种子客户')
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择演示账号登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
  return customer
}

async function surfaceState(cdp, selector) {
  return JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const root = document.querySelector(${JSON.stringify(selector)}) ?? document.body
    const text = root.innerText ?? ''
    const images = [...root.querySelectorAll('img')].map((img) => ({
      src: img.getAttribute('src') ?? '',
      naturalOk: img.complete && img.naturalWidth > 0,
    }))
    return {
      path: location.pathname,
      pendingCount: text.split('待换').length - 1,
      emptyCart: text.includes('购物袋还空着呢'),
      images,
    }
  })())`))
}

async function runSurface(id, cdp, fn) {
  try {
    const state = await fn()
    record(id, state.identityOk, state.assetOk, state)
    await shot(cdp, id)
  } catch (error) {
    record(id, false, false, { error: error?.message ?? String(error), pendingCount: -1 })
    await shot(cdp, `${id}-error`).catch(() => {})
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const cdp = new Cdp(await launchBrowser())
  await cdp.open()
  const customer = await login(cdp)
  const cookie = await devLogin(customer.id)
  const catalog = await trpcQuery(cookie, 'mall.listProducts', { page: 1, pageSize: 12 })
  const products = catalog?.items ?? []
  if (products.length < 5) throw new Error('有货商品不足')
  if (CREATE_ORDERS) {
    for (const product of products.slice(0, 5)) {
      await trpcMutation(cookie, 'mall.createOrder', {
        items: [{ productId: product.id, qty: 1 }],
        deliveryMethod: 'pickup',
      })
      ordersCreated += 1
    }
  }

  await runSurface('home', cdp, async () => {
    await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-featured"]') && !!document.querySelector('[data-testid="home-stories"]')`)
    const state = await surfaceState(cdp, '[data-testid="home-page"]')
    const contentImages = state.images.filter((image) => image.src.includes('/photos/icons/') || image.src.includes('/brand/banner-home'))
    return {
      ...state,
      identityOk: state.path === '/home' && !!await cdp.eval(`!!document.querySelector('[data-testid="home-featured"]') && !!document.querySelector('[data-testid="home-stories"]')`),
      assetOk: state.pendingCount === 0 && contentImages.length >= 4 && contentImages.every((image) => image.naturalOk),
      contentImages,
    }
  })

  await runSurface('mall', cdp, async () => {
    await navigate(cdp, '/mall', `document.querySelectorAll('[data-testid^="mall-product-card-"]').length >= 10`)
    const state = await surfaceState(cdp, '[data-testid="mall-hero"]') // 先取英雄身份，随后取全页资产
    const page = await surfaceState(cdp, 'body')
    const productImages = page.images.filter((image) => image.src.includes('/products/'))
    const hero = await surfaceState(cdp, '[data-testid="mall-hero"]')
    return {
      ...page,
      heroPending: hero.pendingCount,
      identityOk: state.path === '/mall' && await cdp.eval(`document.querySelectorAll('[data-testid^="mall-product-card-"]').length >= 10`),
      assetOk: page.pendingCount === 0 && productImages.length >= 10 && productImages.every((image) => image.naturalOk)
        && hero.images.some((image) => image.src.includes('/photos/icons/ic-shop.png') && image.naturalOk),
      productImages,
      heroImages: hero.images,
    }
  })

  await runSurface('product', cdp, async () => {
    await navigate(cdp, '/mall', `!!document.querySelector('[data-testid^="mall-product-card-"] a')`)
    const href = await cdp.eval(`document.querySelector('[data-testid^="mall-product-card-"] a').getAttribute('href')`)
    await navigate(cdp, href, `!!document.querySelector('[data-testid="pdp-add-cart"]')`)
    const state = await surfaceState(cdp, '[data-block-key="pdp.gallery"]')
    const addButtonCount = await cdp.eval(`document.querySelectorAll('[data-testid="pdp-add-cart"]').length`)
    const identityOk = state.path.startsWith('/mall/product/') && !state.emptyCart && addButtonCount === 1
    await cdp.eval(`document.querySelector('[data-testid="pdp-add-cart"]').click()`)
    await sleep(400)
    const cartItems = await cdp.eval(`JSON.parse(localStorage.getItem('philia.cart') ?? '{"items":[]}').items.map((item) => ({ productId: item.productId, qty: item.qty }))`)
    return {
      ...state,
      addButtonCount,
      cartItems,
      identityOk: identityOk && cartItems.length === 1 && cartItems[0]?.qty === 1,
      assetOk: state.pendingCount === 0 && state.images.length > 0 && state.images.every((image) => image.src.includes('/products/') && image.naturalOk),
    }
  })

  await runSurface('cart-in-stock', cdp, async () => {
    await navigate(cdp, '/mall/cart', `document.querySelectorAll('[data-testid^="cart-row-"]').length === 1`)
    const state = await surfaceState(cdp, 'body')
    return {
      ...state,
      identityOk: state.path === '/mall/cart' && !state.emptyCart && await cdp.eval(`document.querySelectorAll('[data-testid^="cart-row-"]').length === 1`),
      assetOk: state.pendingCount === 0 && state.images.length >= 1 && state.images.every((image) => image.naturalOk),
    }
  })

  await runSurface('checkout-in-stock', cdp, async () => {
    await navigate(cdp, '/mall/checkout', `!!document.querySelector('[data-testid="checkout-items-summary"]') && !!document.querySelector('[data-testid="checkout-submit"]')`)
    const state = await surfaceState(cdp, '[data-testid="checkout-items-summary"]')
    const bodyText = await cdp.eval(`document.body.innerText`)
    return {
      ...state,
      identityOk: state.path === '/mall/checkout' && bodyText.includes('1 件商品') && !bodyText.includes('结算还没有商品'),
      assetOk: state.pendingCount === 0 && state.images.length >= 1 && state.images.every((image) => image.naturalOk),
    }
  })

  await runSurface('orders', cdp, async () => {
    await navigate(cdp, '/mall/orders', `document.querySelectorAll('[data-testid^="order-detail-link-"]').length >= 5`)
    const state = await surfaceState(cdp, 'body')
    const orderCount = await cdp.eval(`document.querySelectorAll('[data-testid^="order-detail-link-"]').length`)
    return {
      ...state,
      orderCount,
      identityOk: state.path === '/mall/orders' && orderCount >= 5,
      assetOk: state.pendingCount === 0 && state.images.length >= 5 && state.images.every((image) => image.naturalOk),
    }
  })

  await cdp.send('Browser.close').catch(() => {})
  cdp.close()
  const failures = checks.filter((check) => !check.ok).length
  const result = {
    at: new Date().toISOString(),
    base: CUSTOMER_URL,
    apiBase: API_BASE,
    ordersCreated,
    checks,
    failures,
    hit: false,
    localhostUsedAsLiveHIT: false,
    payment: 'none; order setup only via mall.createOrder on isolated single-store database',
  }
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify(result, null, 2))
  console.log(`汇总：${checks.length - failures}/${checks.length} GREEN；ordersCreated=${ordersCreated}`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(`环境异常：${error?.message ?? error}`)
  process.exit(2)
})
