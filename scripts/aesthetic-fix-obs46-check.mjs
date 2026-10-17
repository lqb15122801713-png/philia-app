#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9234)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-obs46')
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
const profileDir = join(tmpdir(), `philia-aesthetic-obs46-${process.pid}`)

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
  if (!await cdp.waitFor(readyExpression)) throw new Error(`页面未就绪：${path}`)
}

async function login(cdp) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const customer = users.find((user) => user.roles?.includes('customer'))
  if (!customer) throw new Error('无种子客户')
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function checkObs4(cdp, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true })
  await navigate(cdp, '/booking/boarding', `!!document.querySelector('[data-testid="bs-room-readonly"], [data-testid^="bs-room-option-"]') && !!document.querySelector('[data-testid="bs-confirm-bar"]')`)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(400)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const dock = document.querySelector('[data-testid="app-dock"]')
    const confirm = document.querySelector('[data-testid="bs-confirm-bar"]')
    const card = document.querySelector('[data-testid="bs-room-readonly"], [data-testid^="bs-room-option-"]')
    const button = document.querySelector('[data-testid="bs-confirm"]')
    const booking = document.querySelector('[data-testid="app-dock-booking"]')
    const dockRect = dock?.firstElementChild.firstElementChild.getBoundingClientRect() ?? null
    const confirmRect = confirm.firstElementChild.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const overlaps = (a, b) => !!a && !!b && a.bottom > b.top && a.top < b.bottom
    const hit = (rect) => {
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      return document.elementFromPoint(x, y)
    }
    const cardHit = hit(cardRect)
    const buttonHit = hit(buttonRect)
    return {
      viewport: { width: innerWidth, height: innerHeight },
      dockPresent: !!dock,
      dockFamily: !!document.querySelector('.booking-with-dock'),
      bookingActive: booking?.getAttribute('aria-current') ?? null,
      dockRect,
      confirmRect: { top: confirmRect.top, bottom: confirmRect.bottom },
      cardRect: { top: cardRect.top, bottom: cardRect.bottom },
      buttonRect: { top: buttonRect.top, bottom: buttonRect.bottom },
      confirmDockOverlap: overlaps(confirmRect, dockRect),
      cardDockOverlap: overlaps(cardRect, dockRect),
      cardConfirmOverlap: overlaps(cardRect, confirmRect),
      cardClickable: cardHit === card || card.contains(cardHit),
      buttonClickable: buttonHit === button || button.contains(buttonHit),
    }
  })())`))
  const ok = measurements.dockPresent && measurements.dockFamily && measurements.bookingActive === 'page'
    && !measurements.confirmDockOverlap && !measurements.cardDockOverlap && !measurements.cardConfirmOverlap
    && measurements.cardClickable && measurements.buttonClickable
  record(`Obs4 寄养 dock 与 ConfirmBar 共存不挡关键操作（390×${height}）`, ok, `dock=${measurements.dockPresent}；family=${measurements.dockFamily}；active=${measurements.bookingActive}；栏dock叠=${measurements.confirmDockOverlap}；卡dock叠=${measurements.cardDockOverlap}；卡栏叠=${measurements.cardConfirmOverlap}`, measurements)
  await shot(cdp, `obs4-boarding-${height}`)
}

async function checkObs4InstallBanner(cdp) {
  const defaultUserAgent = await cdp.eval('navigator.userAgent')
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await navigate(cdp, '/booking/boarding', `!!document.querySelector('[data-testid="bs-confirm"]')`)
    await sleep(300)
    const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
      const banner = document.querySelector('[data-testid="pwa-install-banner"]')
      const button = document.querySelector('[data-testid="bs-confirm"]')
      const bannerRect = banner?.getBoundingClientRect() ?? null
      const buttonRect = button.getBoundingClientRect()
      const x = buttonRect.left + buttonRect.width / 2
      const y = buttonRect.top + buttonRect.height / 2
      const hit = document.elementFromPoint(x, y)
      return {
        bannerPresent: !!banner,
        bannerRect,
        buttonRect: { top: buttonRect.top, bottom: buttonRect.bottom },
        overlap: bannerRect ? buttonRect.bottom > bannerRect.top && buttonRect.top < bannerRect.bottom : false,
        buttonClickable: hit === button || button.contains(hit),
        hitTestId: hit?.closest?.('[data-testid]')?.dataset.testid ?? hit?.tagName ?? null,
      }
    })())`))
    const ok = measurements.buttonClickable && !measurements.overlap
    record('Obs4 PWA 安装条不遮寄养确认按钮', ok, `banner=${measurements.bannerPresent}；叠=${measurements.overlap}；可点=${measurements.buttonClickable}；命中=${measurements.hitTestId}`, measurements)
    await shot(cdp, 'obs4-install-banner')
  } finally {
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: defaultUserAgent })
  }
}

async function checkObs6(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navigate(cdp, '/notifications', `!!document.querySelector('[data-testid="notify-chip-marketing"]')`)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const last = document.querySelector('[data-testid="notify-chip-marketing"]')
    const rail = last.parentElement
    const railRect = rail.getBoundingClientRect()
    const chips = [...rail.querySelectorAll('button[data-testid^="notify-chip-"]')].map((chip) => {
      const rect = chip.getBoundingClientRect()
      return {
        id: chip.dataset.testid,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        fullyVisible: rect.left >= 0 && rect.right <= innerWidth && rect.left >= railRect.left && rect.right <= railRect.right,
      }
    })
    const lastRect = last.getBoundingClientRect()
    return {
      viewport: { width: innerWidth, height: innerHeight },
      chipCount: chips.length,
      chips,
      rail: { left: railRect.left, right: railRect.right, scrollWidth: rail.scrollWidth, clientWidth: rail.clientWidth, scrollLeft: rail.scrollLeft },
      last: { left: lastRect.left, right: lastRect.right, top: lastRect.top, bottom: lastRect.bottom },
      hintPresent: !!document.querySelector('[data-testid="notify-chip-scroll-hint"]'),
      pageHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    }
  })())`))
  const allVisible = measurements.chipCount === 6 && measurements.chips.every((chip) => chip.fullyVisible)
  let clicked = false
  if (allVisible) {
    const x = (measurements.last.left + measurements.last.right) / 2
    const y = (measurements.last.top + measurements.last.bottom) / 2
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    clicked = await cdp.waitFor(`document.querySelector('[data-testid="notify-chip-marketing"]').className.includes('bg-brand-primary')`, 3000)
  }
  measurements.clicked = clicked
  const ok = allVisible && !measurements.pageHorizontalOverflow && clicked
  record('Obs6 消息活动 chip 完整可见且可点', ok, `chips=${measurements.chipCount}；完整=${measurements.chips.filter((chip) => chip.fullyVisible).length}；活动right=${Math.round(measurements.last.right)}；视口=${measurements.viewport.width}；点击=${clicked}；页横溢=${measurements.pageHorizontalOverflow}`, measurements)
  await shot(cdp, 'obs6-notify-chips')
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  await checkObs4(cdp, 844)
  await checkObs4(cdp, 700)
  await checkObs4InstallBanner(cdp)
  await checkObs6(cdp)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({
    at: new Date().toISOString(),
    base: CUSTOMER_URL,
    results,
  }, null, 2))
  if (results.length !== 4) {
    console.error(`检查数不符：期望 4，实际 ${results.length}；拒绝空跑假绿`)
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
