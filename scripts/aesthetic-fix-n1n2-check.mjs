#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9231)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-n1n2')
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
const profileDir = join(tmpdir(), `philia-aesthetic-n1n2-${process.pid}`)

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

function unwrap(payload, name) {
  const first = payload?.[0]
  if (first?.error) {
    const error = first.error.json ?? first.error
    throw new Error(`${name} 失败：${error?.message ?? JSON.stringify(error)}`)
  }
  return first?.result?.data?.json
}

async function trpcQuery(cookie, path, input, metaValues) {
  const frame = { json: input ?? null }
  if (metaValues) frame.meta = { values: metaValues }
  const payload = encodeURIComponent(JSON.stringify({ 0: frame }))
  const response = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, {
    headers: cookie ? { Cookie: cookie } : {},
  })
  return unwrap(await response.json(), `trpc ${path}`)
}

async function trpcMutate(cookie, path, input, metaValues) {
  const frame = { json: input }
  if (metaValues) frame.meta = { values: metaValues }
  const response = await fetch(`${API_BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ 0: frame }),
  })
  return unwrap(await response.json(), `trpc ${path}`)
}

async function devLogin(userId) {
  const response = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!response.ok) throw new Error(`dev-login HTTP ${response.status}`)
  const cookies = response.headers.getSetCookie?.() ?? []
  const cookie = cookies.map((item) => item.split(';')[0]).join('; ')
  if (!cookie.includes('philia_session=')) throw new Error('dev-login 未返回会话')
  await response.body?.cancel()
  return cookie
}

async function createLocalAppointment(cookie, store, pet, service) {
  const offset = 8 * 60 * 60 * 1000
  const storeNow = new Date(Date.now() + offset)
  let lastError = null
  for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
    const dayStart = new Date(Date.UTC(
      storeNow.getUTCFullYear(),
      storeNow.getUTCMonth(),
      storeNow.getUTCDate() + dayOffset,
      10,
      0,
      0,
      0,
    ) - offset)
    for (let slot = 0; slot < 16; slot += 1) {
      const scheduledStart = new Date(dayStart.getTime() + slot * 30 * 60_000)
      try {
        return await trpcMutate(cookie, 'appointment.create', {
          storeId: store.id,
          petId: pet.id,
          serviceId: service.id,
          type: 'grooming',
          scheduledStart: scheduledStart.toISOString(),
          paymentMode: 'pay_at_store',
          note: '【测试】PD-29 本地布局回归前置单',
        }, { scheduledStart: ['Date'] })
      } catch (error) {
        lastError = error
        if (!String(error?.message).includes('CONFLICT') && !String(error?.message).includes('约满')) throw error
      }
    }
  }
  throw new Error(`本地前置单无可用时段：${lastError?.message ?? '未知原因'}`)
}

async function prepareLocalState() {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const customer = users.find((user) => user.roles?.includes('customer'))
  const merchant = users.find((user) => user.roles?.includes('merchant_owner'))
  if (!customer || !merchant) throw new Error('种子客户或店主缺失')

  const customerCookie = await devLogin(customer.id)
  const merchantCookie = await devLogin(merchant.id)
  const pets = await trpcQuery(customerCookie, 'pet.list')
  const pet = pets?.[0] ?? (await trpcMutate(customerCookie, 'pet.upsert', {
    name: 'PD29测试毛孩',
    species: 'dog',
    vaccineValidUntil: '2030-12-31',
  }))?.pet
  if (!pet?.id) throw new Error('本地宠物前置失败')
  const vaccinePet = pets?.find((item) => item.name === 'PD29疫苗警示毛孩') ?? (await trpcMutate(customerCookie, 'pet.upsert', {
    name: 'PD29疫苗警示毛孩',
    species: 'dog',
  }))?.pet
  if (!vaccinePet?.id) throw new Error('本地疫苗警示宠物前置失败')

  const nearby = await trpcQuery(customerCookie, 'store.listNearby', { lat: 30.2741, lng: 120.1551 })
  const store = nearby?.stores?.[0]
  const detail = store ? await trpcQuery(customerCookie, 'store.getWithServices', { storeId: store.id }) : null
  const grooming = detail?.services?.find((service) => service.type === 'grooming')
  const boarding = detail?.services?.find((service) => service.type === 'boarding' && (service.boardingRoomType ?? service.name).includes('标准间'))
  if (!store?.id || !grooming?.id || !boarding?.id) throw new Error('本地门店、洗护或标准间前置缺失')

  let passes = await trpcQuery(customerCookie, 'pass.mine', { storeId: store.id })
  if (!passes?.some((pass) => pass.usable)) {
    const eligible = await trpcQuery(merchantCookie, 'pass.listCustomers')
    if (!eligible?.customers?.some((user) => user.id === customer.id)) {
      await createLocalAppointment(customerCookie, store, pet, grooming)
    }
    await trpcMutate(merchantCookie, 'pass.topUp', { userId: customer.id, times: 2 })
    passes = await trpcQuery(customerCookie, 'pass.mine', { storeId: store.id })
  }
  const usablePass = passes?.find((pass) => pass.usable)
  if (!usablePass) throw new Error('本地可用次卡前置失败')
  return { customer, store, pet, vaccinePet, grooming, boarding, usablePass }
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

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  if (!await cdp.waitFor(readyExpression)) {
    const debug = await cdp.eval(`JSON.stringify({ url: location.href, text: (document.body?.innerText ?? '').slice(0, 500) })`)
    throw new Error(`页面未就绪：${path}；${debug}`)
  }
}

async function browserLogin(cdp, customer) {
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include',
  }).then((response) => response.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function checkN1(cdp, state) {
  const query = `storeId=${state.store.id}&petId=${state.pet.id}&serviceId=${state.grooming.id}`
  await navigate(cdp, `/booking/grooming?${query}`, `!!document.querySelector('[data-testid="gs-payment-toggle"]') && !!document.querySelector('[data-testid="gs-confirm-bar"]')`)
  await cdp.eval(`document.querySelector('[data-testid="gs-payment-toggle"]').scrollIntoView({ block: 'center' })`)
  await sleep(400)
  await cdp.eval(`document.querySelector('[data-testid="gs-payment-toggle"]').click()`)
  const ready = await cdp.waitFor(`document.querySelector('[data-testid="gs-payment-pass_deduct"]')?.dataset.disabled === 'false'`)
  if (!ready) throw new Error('N1 次卡选项未进入可用态')
  await cdp.eval(`document.querySelector('[data-testid="gs-payment-pay_at_store"]').click()`)
  const switchedToStore = await cdp.waitFor(`document.querySelector('[data-testid="gs-confirm-assurance"]')?.textContent.includes('到店付')`)
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const option = document.querySelector('[data-testid="gs-payment-pass_deduct"]')
    const bar = document.querySelector('[data-testid="gs-confirm-bar"]').firstElementChild
    const optionRect = option.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    const x = optionRect.left + optionRect.width / 2
    const y = optionRect.top + optionRect.height / 2
    const hit = document.elementFromPoint(x, y)
    const textRects = [...option.querySelectorAll('span')].filter((span) => span.children.length === 0 && span.textContent.trim()).map((span) => {
      const rect = span.getBoundingClientRect()
      return { text: span.textContent.trim(), top: rect.top, bottom: rect.bottom, covered: rect.bottom > barRect.top && rect.top < barRect.bottom }
    })
    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      option: { top: optionRect.top, bottom: optionRect.bottom, left: optionRect.left, right: optionRect.right },
      confirmBar: { top: barRect.top, bottom: barRect.bottom },
      disabled: option.disabled,
      fullyVisible: optionRect.top >= 0 && optionRect.bottom <= innerHeight,
      covered: optionRect.bottom > barRect.top && optionRect.top < barRect.bottom,
      clickable: hit === option || option.contains(hit),
      hitTestId: hit?.closest?.('[data-testid]')?.dataset.testid ?? hit?.tagName ?? null,
      textRects,
    }
  })())`))
  let modeChanged = false
  if (measurements.clickable) {
    const x = (measurements.option.left + measurements.option.right) / 2
    const y = (measurements.option.top + measurements.option.bottom) / 2
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    modeChanged = await cdp.waitFor(`document.querySelector('[data-testid="gs-confirm-assurance"]')?.textContent.includes('次卡扣次')`, 3000)
  }
  measurements.switchedToStore = switchedToStore
  measurements.modeChanged = modeChanged
  const textCovered = measurements.textRects.filter((rect) => rect.covered)
  const ok = switchedToStore && !measurements.disabled && measurements.fullyVisible && !measurements.covered && measurements.clickable && modeChanged && textCovered.length === 0
  record('N1 收款展开后次卡扣次完整可见可点', ok, `option=${Math.round(measurements.option.top)}–${Math.round(measurements.option.bottom)}；barTop=${Math.round(measurements.confirmBar.top)}；到店付=${switchedToStore}；次卡=${modeChanged}；文案被压=${textCovered.length}`, measurements)
  await shot(cdp, 'n1-payment-pass')
}

async function selectVaccineWarning(cdp) {
  const dates = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const iso = (offset) => {
      const date = new Date()
      date.setDate(date.getDate() + offset)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return date.getFullYear() + '-' + month + '-' + day
    }
    return { checkin: iso(1), checkout: iso(2) }
  })())`))
  await cdp.eval(`document.querySelector('[data-testid="bs-checkin-cell"]').click()`)
  await cdp.waitFor(`!!document.querySelector('[data-testid="bs-range-sheet"]')`)
  await cdp.eval(`document.querySelector('[data-testid="bs-day-${dates.checkin}"]').click()`)
  await cdp.waitFor(`document.querySelector('[data-testid="bs-phase-checkout"]')?.dataset.active === 'true'`)
  await cdp.eval(`document.querySelector('[data-testid="bs-day-${dates.checkout}"]').click()`)
  if (!await cdp.waitFor(`!!document.querySelector('[data-testid="bs-vaccine-bar"]')`)) {
    throw new Error('N2 疫苗警示场景未就绪')
  }
}

async function checkN2(cdp, state, height, vaccineWarning = false) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true })
  const pet = vaccineWarning ? state.vaccinePet : state.pet
  const query = `storeId=${state.store.id}&petId=${pet.id}&serviceId=${state.boarding.id}`
  await navigate(cdp, `/booking/boarding?${query}`, `[...document.querySelectorAll('[data-testid="bs-room-readonly"], [data-testid^="bs-room-option-"]')].some((card) => card.innerText.includes('标准间')) && !!document.querySelector('[data-testid="bs-confirm-bar"]')`)
  if (vaccineWarning) await selectVaccineWarning(cdp)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(400)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const card = [...document.querySelectorAll('[data-testid="bs-room-readonly"], [data-testid^="bs-room-option-"]')].find((item) => item.innerText.includes('标准间'))
    const bar = document.querySelector('[data-testid="bs-confirm-bar"]').firstElementChild
    const dock = document.querySelector('[data-testid="app-dock"]')
    const cardRect = card.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    const dockRect = dock?.firstElementChild.firstElementChild.getBoundingClientRect() ?? null
    const x = cardRect.left + cardRect.width / 2
    const y = cardRect.top + cardRect.height / 2
    const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null
    const textRects = [...card.querySelectorAll('span')].filter((span) => span.children.length === 0 && span.textContent.trim()).map((span) => {
      const rect = span.getBoundingClientRect()
      return { text: span.textContent.trim(), top: rect.top, bottom: rect.bottom, covered: rect.bottom > barRect.top && rect.top < barRect.bottom, inViewport: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight }
    })
    const priceRects = [...card.querySelectorAll('span')].filter((span) => span.children.length === 0 && span.textContent.includes('¥') && span.textContent.includes('/ 晚')).map((span) => {
      const rect = span.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight }
    })
    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      testId: card.dataset.testid,
      card: { top: cardRect.top, bottom: cardRect.bottom, left: cardRect.left, right: cardRect.right },
      confirmBar: { top: barRect.top, bottom: barRect.bottom },
      clearance: barRect.top - cardRect.bottom,
      fullyVisible: cardRect.top >= 0 && cardRect.bottom <= innerHeight,
      covered: cardRect.bottom > barRect.top && cardRect.top < barRect.bottom,
      centerClickable: hit === card || card.contains(hit),
      hitTestId: hit?.closest?.('[data-testid]')?.dataset.testid ?? hit?.tagName ?? null,
      dockPresent: !!dock,
      confirmDockOverlap: dockRect ? barRect.bottom > dockRect.top && barRect.top < dockRect.bottom : false,
      vaccineWarning: !!document.querySelector('[data-testid="bs-vaccine-bar"]'),
      priceNodeCount: priceRects.length,
      visiblePriceCount: priceRects.filter((rect) => rect.visible).length,
      priceRects,
      textRects,
    }
  })())`))
  const textCovered = measurements.textRects.filter((rect) => rect.covered || !rect.inViewport)
  const ok = measurements.scrollY === 0 && measurements.vaccineWarning === vaccineWarning && measurements.clearance >= 8 && measurements.fullyVisible && !measurements.covered && measurements.centerClickable && measurements.dockPresent && !measurements.confirmDockOverlap && measurements.priceNodeCount === 1 && measurements.visiblePriceCount === 1 && textCovered.length === 0
  const scenario = vaccineWarning ? '疫苗警示' : '初始'
  record(`N2 寄养零滚标准间文案与热区不被确认栏压住（${scenario} 390×${height}）`, ok, `card=${Math.round(measurements.card.top)}–${Math.round(measurements.card.bottom)}；barTop=${Math.round(measurements.confirmBar.top)}；间隙=${Math.round(measurements.clearance)}；价格=${measurements.priceNodeCount}/${measurements.visiblePriceCount}；文案异常=${textCovered.length}；dock=${measurements.dockPresent}；栏dock叠=${measurements.confirmDockOverlap}`, measurements)
  await shot(cdp, `n2-boarding-standard-room-${vaccineWarning ? 'vaccine-' : ''}${height}`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const state = await prepareLocalState()
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await browserLogin(cdp, state.customer)
  await checkN1(cdp, state)
  const initialHeights = [844, 825, 824, 815, 814, 701, 700, 667]
  const vaccineHeights = [900, 901, 815, 814, 734, 733, 700, 667]
  for (const height of initialHeights) await checkN2(cdp, state, height)
  for (const height of vaccineHeights) await checkN2(cdp, state, height, true)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({
    at: new Date().toISOString(),
    base: CUSTOMER_URL,
    viewportWidth: 390,
    initialHeights,
    vaccineHeights,
    results,
  }, null, 2))
  if (results.length !== 17) {
    console.error(`检查数不符：期望 17，实际 ${results.length}；拒绝空跑假绿`)
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
