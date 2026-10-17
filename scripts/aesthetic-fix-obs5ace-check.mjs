#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9239)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-obs5ace')
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
const profileDir = join(tmpdir(), `philia-aesthetic-obs5ace-${process.pid}`)

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
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

async function trpcQuery(cookie, path, input) {
  const payload = encodeURIComponent(JSON.stringify({ 0: { json: input ?? null } }))
  const response = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, { headers: { Cookie: cookie } })
  return unwrap(await response.json(), `trpc ${path}`)
}

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  if (!await cdp.waitFor(readyExpression)) throw new Error(`页面未就绪：${path}`)
}

async function login(cdp, userId) {
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: ${JSON.stringify(userId)} }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function setViewport(cdp, bottomInset = 34) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 1, mobile: true })
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom: bottomInset, right: 0 } })
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(250)
}

async function checkBoarding(cdp, state) {
  await setViewport(cdp, 0)
  const roomReady = `[...document.querySelectorAll('[data-testid="bs-room-readonly"], [data-testid^="bs-room-option-"]')].some((card) => card.innerText.includes('标准间'))`
  const query = `storeId=${state.store.id}&petId=${state.pet.id}&serviceId=${state.boarding.id}`
  await navigate(cdp, `/booking/boarding?${query}`, roomReady)
  await setViewport(cdp, 0)
  const m = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const root = document.querySelector('[data-testid="bs-room-selector"], [data-testid="bs-room-readonly"]')
    const subtitles = [...root.querySelectorAll('span.font-number.flex-wrap')].map((el) => ({
      text: el.innerText,
      fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
    }))
    const card = root.matches('[data-testid="bs-room-readonly"]') ? root : (root.querySelector('[data-active="true"]') ?? root.firstElementChild)
    const bar = document.querySelector('[data-testid="bs-confirm-bar"]')
    const cardRect = card.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    return { scrollY, subtitles, card: { bottom: cardRect.bottom }, barTop: barRect.top, clearance: barRect.top - cardRect.bottom }
  })())`))
  const minFont = Math.min(...m.subtitles.map((item) => item.fontSize))
  const ok = m.scrollY === 0 && m.subtitles.length > 0 && minFont >= 12 && m.clearance >= 8
  record('Obs5a 寄养房型副文 ≥12px 且 N2 避让不回退', ok, `副文=${m.subtitles.length} 处；最小字号=${minFont}px；房型卡底=${Math.round(m.card.bottom)}；栏顶=${Math.round(m.barTop)}；净空=${Math.round(m.clearance)}`, m)
  await shot(cdp, 'obs5a-boarding')
}

async function checkMemberCompare(cdp) {
  await setViewport(cdp)
  await navigate(cdp, '/member/open', `!!document.querySelector('.member-compare-link button') && !!document.querySelector('[data-block-key="mo.cta"] .m2-ctabar')`)
  await setViewport(cdp)
  const m = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const button = document.querySelector('.member-compare-link button')
    const bar = document.querySelector('[data-block-key="mo.cta"] .m2-ctabar')
    const rect = button.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const style = getComputedStyle(button)
    return {
      scrollY,
      marginTop: style.marginTop,
      marginBottom: style.marginBottom,
      display: style.display,
      transform: style.transform,
      text: button.innerText,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      bottom: rect.bottom,
      barTop: barRect.top,
      clearance: barRect.top - rect.bottom,
      hitInside: button.contains(hit),
    }
  })())`))
  const ok = m.scrollY === 0 && m.text.includes('对比四档权益') && m.height >= 44 && m.clearance >= 8 && m.hitInside
  record('Obs5c 对比四档权益热区 ≥44px 且 N4 避让不回退', ok, `热区=${Math.round(m.width)}×${Math.round(m.height)}；链底=${Math.round(m.bottom)}；栏顶=${Math.round(m.barTop)}；净空=${Math.round(m.clearance)}；mt=${m.marginTop}；命中=${m.hitInside}`, m)
  await shot(cdp, 'obs5c-member-open')
}

async function checkQuickAdd(cdp) {
  await setViewport(cdp)
  await navigate(cdp, '/mall', `!!document.querySelector('button[data-testid^="mall-quickadd-"]')`)
  await setViewport(cdp)
  const m = JSON.parse(await cdp.eval(`JSON.stringify((() => ({
    scrollY,
    buttons: [...document.querySelectorAll('button[data-testid^="mall-quickadd-"]')].map((button) => {
      const rect = button.getBoundingClientRect()
      return { id: button.getAttribute('data-testid'), width: rect.width, height: rect.height }
    }),
  }))())`))
  const minHeight = Math.min(...m.buttons.map((item) => item.height))
  const minWidth = Math.min(...m.buttons.map((item) => item.width))
  const ok = m.scrollY === 0 && m.buttons.length > 0 && minHeight >= 44 && minWidth >= 44
  record('Obs5e 商城列表 quick-add 同族热区 ≥44px', ok, `按钮=${m.buttons.length} 个；最小热区=${Math.round(minWidth)}×${Math.round(minHeight)}`, m)
  await shot(cdp, 'obs5e-mall-quickadd')
}

async function checkQuickAddContentClearance(cdp) {
  const m = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const button = document.querySelector('button[data-testid^="mall-quickadd-"]')
    const card = button.closest('.u1-card')
    const name = card.querySelector('p.line-clamp-2')
    name.textContent = '幼犬奶糕粮 1kg 两行商品名遮挡回归夹具'
    const priceRow = name.nextElementSibling
    const rebate = document.createElement('span')
    rebate.className = 'ml-auto font-number text-[8.5px] tabular-nums text-ink-secondary'
    rebate.textContent = '返 ¥99.00 回馈金'
    priceRow.append(rebate)
    const buttonRect = button.getBoundingClientRect()
    const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    const nameRange = document.createRange()
    nameRange.selectNodeContents(name)
    const nameRects = [...nameRange.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }))
    const rebateRange = document.createRange()
    rebateRange.selectNodeContents(rebate)
    const rebateRect = rebateRange.getBoundingClientRect()
    return {
      button: { left: buttonRect.left, right: buttonRect.right, top: buttonRect.top, bottom: buttonRect.bottom, width: buttonRect.width, height: buttonRect.height },
      nameRects,
      nameOverlap: nameRects.some((rect) => intersects(rect, buttonRect)),
      rebateRect: { left: rebateRect.left, right: rebateRect.right, top: rebateRect.top, bottom: rebateRect.bottom },
      rebateOverlap: intersects(rebateRect, buttonRect),
    }
  })())`))
  const ok = m.button.width >= 44 && m.button.height >= 44 && !m.nameOverlap && !m.rebateOverlap
  record('Obs5e quick-add 与两行名称／付费返显零相交', ok, `热区=${Math.round(m.button.width)}×${Math.round(m.button.height)}；名称叠=${m.nameOverlap}；返显叠=${m.rebateOverlap}`, m)
  await shot(cdp, 'obs5e-mall-content-clearance')
}

async function checkProductDetail(cdp, product) {
  await setViewport(cdp)
  await navigate(cdp, `/mall/product/${product.id}`, `!!document.querySelector('[data-testid="pdp-review-need"]')`)
  await setViewport(cdp)
  const m = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const root = document.querySelector('[data-block-key="pdp.ctaBar"]')
    const buttons = [...root.querySelectorAll('button[aria-label="减少数量"], button[aria-label="增加数量"]')].map((button) => {
      const rect = button.getBoundingClientRect()
      return { label: button.getAttribute('aria-label'), width: rect.width, height: rect.height }
    })
    const review = document.querySelector('[data-testid="pdp-reviews"]').getBoundingClientRect()
    const cta = root.firstElementChild.getBoundingClientRect()
    return { scrollY, buttons, reviewBottom: review.bottom, ctaTop: cta.top, reviewClearance: cta.top - review.bottom }
  })())`))
  const minHeight = Math.min(...m.buttons.map((item) => item.height))
  const minWidth = Math.min(...m.buttons.map((item) => item.width))
  const ok = m.scrollY === 0 && m.buttons.length === 2 && minHeight >= 44 && minWidth >= 44 && m.reviewClearance >= 8
  record('Obs5e 商详加减热区 ≥44px 且 N8 避让不回退', ok, `按钮=${m.buttons.length} 个；最小热区=${Math.round(minWidth)}×${Math.round(minHeight)}；评价净空=${Math.round(m.reviewClearance)}`, m)
  await shot(cdp, 'obs5e-product-detail')
}

async function checkCart(cdp, product) {
  const item = {
    productId: product.id,
    storeId: product.storeId,
    storeName: 'PD-35 本地夹具门店',
    name: product.name,
    priceFen: product.priceFen,
    image: product.images?.[0] ?? null,
    stock: product.stock,
    qty: 2,
    checked: true,
  }
  await cdp.eval(`localStorage.setItem('philia.cart', JSON.stringify({ items: [${JSON.stringify(item)}] }))`)
  await setViewport(cdp)
  await navigate(cdp, '/mall/cart', `!!document.querySelector('button[aria-label="增加数量"]')`)
  await setViewport(cdp)
  const m = JSON.parse(await cdp.eval(`JSON.stringify((() => ({
    scrollY,
    buttons: [...document.querySelectorAll('button[aria-label="减少数量"], button[aria-label="增加数量"]')].map((button) => {
      const rect = button.getBoundingClientRect()
      return { label: button.getAttribute('aria-label'), width: rect.width, height: rect.height }
    }),
  }))())`))
  const minHeight = Math.min(...m.buttons.map((item) => item.height))
  const minWidth = Math.min(...m.buttons.map((item) => item.width))
  const ok = m.scrollY === 0 && m.buttons.length === 2 && minHeight >= 44 && minWidth >= 44
  record('Obs5e 购物列表加减热区 ≥44px', ok, `按钮=${m.buttons.length} 个；最小热区=${Math.round(minWidth)}×${Math.round(minHeight)}`, m)
  await shot(cdp, 'obs5e-cart-list')
}

async function main() {
  const seedResponse = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  const customer = (await seedResponse.json())?.users?.find((user) => user.roles?.includes('customer'))
  if (!customer?.id) throw new Error('种子客户缺失')
  const cookie = await devLogin(customer.id)
  const catalog = await trpcQuery(cookie, 'mall.listProducts', { page: 1, pageSize: 50 })
  const product = catalog?.items?.find((item) => item.name === '幼犬奶糕粮 1kg')
  const pets = await trpcQuery(cookie, 'pet.list')
  const pet = pets?.[0]
  const nearby = await trpcQuery(cookie, 'store.listNearby', { lat: 30.2741, lng: 120.1551 })
  const store = nearby?.stores?.[0]
  const detail = store ? await trpcQuery(cookie, 'store.getWithServices', { storeId: store.id }) : null
  const boarding = detail?.services?.find((service) => service.type === 'boarding' && (service.boardingRoomType ?? service.name).includes('标准间'))
  if (!product?.id || !pet?.id || !store?.id || !boarding?.id) throw new Error('商品、既有宠物、门店或标准间前置缺失')
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp, customer.id)
  await checkBoarding(cdp, { store, pet, boarding })
  await checkMemberCompare(cdp)
  await checkQuickAdd(cdp)
  await checkQuickAddContentClearance(cdp)
  await checkProductDetail(cdp, product)
  await checkCart(cdp, product)
  cdp.close()
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
