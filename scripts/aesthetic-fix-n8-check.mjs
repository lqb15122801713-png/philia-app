#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9238)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-n8')
const DB_URL = process.env.PHILIA_DB_URL ?? 'file:server/data/aesthetic-fix-n8.db'
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
const results = []
let browser = null
const profileDir = join(tmpdir(), `philia-aesthetic-n8-${process.pid}`)

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

function runFixtureSql(sql) {
  if (!DB_URL.startsWith('file:') || !DB_URL.includes('aesthetic-fix-n8')) {
    throw new Error(`拒绝在非 PD-34 专用夹具库上写数据：${DB_URL}`)
  }
  const code = `(async()=>{ const { client } = await import('./server/src/db/index.ts'); await client.execute({ sql: ${JSON.stringify(sql)}, args: [] }); client.close(); })()`
  execFileSync(process.execPath, ['server/node_modules/tsx/dist/cli.mjs', '-e', code], {
    cwd: ROOT,
    env: { ...process.env, PHILIA_DB_URL: DB_URL },
    stdio: 'inherit',
  })
}

function prepareFixtures() {
  runFixtureSql("DELETE FROM product_reviews WHERE product_id IN (SELECT id FROM products WHERE name IN ('幼犬奶糕粮 1kg', '全价成犬粮 2kg'))")
  runFixtureSql("UPDATE products SET stock = 40 WHERE name = '幼犬奶糕粮 1kg'")
  runFixtureSql("UPDATE products SET stock = 0 WHERE name = '全价成犬粮 2kg'")
}

function restoreFixtures() {
  runFixtureSql("UPDATE products SET stock = 50 WHERE name = '全价成犬粮 2kg'")
}

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
    try {
      this.ws.close()
    } catch {
      // 已断开时无需重复关闭。
    }
  }
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
  for (let attempt = 0; attempt < 40; attempt += 1) {
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

function unwrap(payload, name) {
  const first = payload?.[0]
  if (first?.error) throw new Error(`${name} 失败：${JSON.stringify(first.error.json ?? first.error)}`)
  return first?.result?.data?.json
}

async function devLogin() {
  const response = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '19900000228' }),
  })
  if (!response.ok) throw new Error(`夹具 dev-login HTTP ${response.status}`)
  const cookie = (response.headers.getSetCookie?.() ?? []).map((item) => item.split(';')[0]).join('; ')
  if (!cookie.includes('philia_session=')) throw new Error('夹具 dev-login 未返回会话')
  await response.body?.cancel()
  return cookie
}

async function trpcQuery(cookie, path, input) {
  const payload = encodeURIComponent(JSON.stringify({ 0: { json: input ?? null } }))
  const response = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, {
    headers: { Cookie: cookie },
  })
  return unwrap(await response.json(), `trpc ${path}`)
}

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  if (!await cdp.waitFor(readyExpression)) throw new Error(`页面未就绪：${path}`)
}

async function login(cdp) {
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '19900000228' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function setViewport(cdp, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true })
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom: 34, right: 0 } })
}

async function checkProduct(cdp, product, height) {
  await setViewport(cdp, height)
  const ready = `!!document.querySelector('[data-testid="pdp-review-need"]') && !!document.querySelector('[data-block-key="pdp.ctaBar"] > div')`
  await navigate(cdp, `/mall/product/${product.id}`, ready)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const review = document.querySelector('[data-testid="pdp-reviews"]')
    const cta = document.querySelector('[data-block-key="pdp.ctaBar"] > div')
    const gallery = document.querySelector('[data-block-key="pdp.gallery"] img')
    const reviewRect = review.getBoundingClientRect()
    const ctaRect = cta.getBoundingClientRect()
    const hit = document.elementFromPoint(reviewRect.left + reviewRect.width / 2, reviewRect.top + reviewRect.height / 2)
    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      review: { top: reviewRect.top, bottom: reviewRect.bottom, height: reviewRect.height, text: review.innerText },
      cta: { top: ctaRect.top, bottom: ctaRect.bottom, height: ctaRect.height, text: cta.innerText },
      clearance: ctaRect.top - reviewRect.bottom,
      reviewHitInside: review.contains(hit),
      hitTestId: hit?.closest?.('[data-testid]')?.getAttribute('data-testid') ?? hit?.tagName ?? null,
      galleryHeight: gallery?.getBoundingClientRect().height ?? null,
      buyNowDisabled: document.querySelector('[data-testid="pdp-buy-now"]')?.disabled ?? null,
    }
  })())`))
  const emptyCopy = measurements.review.text.includes('还没有评价') && measurements.review.text.includes('确认收货后即可评价本商品')
  const soldOutOk = product.kind !== 'soldout' || (measurements.buyNowDisabled === true && measurements.cta.text.includes('已售罄'))
  const ok = measurements.scrollY === 0 && measurements.clearance >= 8 && measurements.reviewHitInside && emptyCopy && soldOutOk
  record(
    `N8 ${product.label} 评价空态清出 sticky 购买栏（390×${height}）`,
    ok,
    `scrollY=${measurements.scrollY}；评价=${Math.round(measurements.review.top)}–${Math.round(measurements.review.bottom)}；栏顶=${Math.round(measurements.cta.top)}；净空=${Math.round(measurements.clearance)}；命中=${measurements.hitTestId}；图高=${Math.round(measurements.galleryHeight)}；空态=${emptyCopy}；售罄态=${soldOutOk}`,
    measurements,
  )
  await shot(cdp, `n8-${product.kind}-${height}`)
}

async function main() {
  prepareFixtures()
  try {
    const cookie = await devLogin()
    const catalog = await trpcQuery(cookie, 'mall.listProducts', { page: 1, pageSize: 50 })
    const puppy = catalog?.items?.find((item) => item.name === '幼犬奶糕粮 1kg')
    const soldOut = catalog?.items?.find((item) => item.name === '全价成犬粮 2kg')
    if (!puppy?.id || !soldOut?.id) throw new Error('专用夹具商品缺失')
    const wsUrl = await launchBrowser()
    const cdp = new Cdp(wsUrl)
    await cdp.open()
    await login(cdp)
    const products = [
      { id: puppy.id, kind: 'puppy', label: '幼犬奶糕粮' },
      { id: soldOut.id, kind: 'soldout', label: '售罄成犬粮' },
    ]
    for (const product of products) {
      for (const height of [844, 700, 667]) await checkProduct(cdp, product, height)
    }
    cdp.close()
  } finally {
    restoreFixtures()
  }
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: CUSTOMER_URL, results }, null, 2))
  if (results.length !== 6) {
    console.error(`检查数不符：期望 6，实际 ${results.length}；拒绝空跑假绿`)
    process.exit(2)
  }
  const passed = results.filter((item) => item.ok).length
  console.log(`汇总：${passed}/${results.length} 通过；证据目录=${OUT_DIR}`)
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
