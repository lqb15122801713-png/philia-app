#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7110').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7210').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9237)
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'design-upgrade-b7-service-timeline', 'shots')
const BROWSER = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((path) => existsSync(path))
const NODE_NAMES = ['已下单', '已到店', '洗护中', '美容造型', '待接回', '已完成']
const results = []
const profileDir = join(tmpdir(), `philia-b7-${process.pid}`)
let browser = null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const record = (id, ok, detail) => {
  results.push({ id, ok, detail })
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
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
    return response.result.value
  }

  async waitFor(expression, timeout = 12000) {
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
    } catch {}
  }
}

function cleanup() {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' })
  browser = null
  try {
    rmSync(profileDir, { recursive: true, force: true })
  } catch {}
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(2))

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
  for (let index = 0; index < 40; index += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(500)
  }
  throw new Error(`CDP 端口 ${CDP_PORT} 未就绪`)
}

async function navigate(cdp, path) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  const ready = await cdp.waitFor(`(document.querySelector('#root')?.innerText ?? '').length > 20`)
  if (!ready) throw new Error(`页面未就绪：${path}`)
  await sleep(900)
}

async function login(cdp) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const customer = users.find((user) => (user.roles ?? []).includes('customer'))
  if (!customer) throw new Error('无种子客户')
  await navigate(cdp, '/dev-login')
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function shot(cdp, state) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(join(OUT_DIR, `b7-${state}.png`), Buffer.from(image.data, 'base64'))
}

async function pageState(cdp) {
  return JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const root = document.querySelector('[data-testid="grooming-service-process"]')
    const header = document.querySelector('[data-testid="service-process-header"]')
    const text = root?.innerText ?? ''
    const smallText = root ? [...root.querySelectorAll('*')].filter((el) => {
      if (el.closest('[data-testid="appt-live-canvas-preview-note"]')) return false
      if (['SCRIPT', 'STYLE', 'SVG', 'PATH'].includes(el.tagName)) return false
      const ownText = [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('').trim()
      if (!ownText) return false
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && Number.parseFloat(style.fontSize) < 12
    }).map((el) => ({ text: el.textContent, size: getComputedStyle(el).fontSize })) : []
    const nodeElements = [...document.querySelectorAll('[data-step-key]')]
    const visibleNodeCount = nodeElements.filter((el) => {
      const rect = el.getBoundingClientRect()
      return rect.top >= 0 && rect.bottom <= innerHeight - 70
    }).length
    const reportLink = document.querySelector('a[href^="/philia/reports/"]')
    const reportRect = reportLink?.getBoundingClientRect()
    const reportCtaVisible = !!reportRect && reportRect.top >= 0 && reportRect.bottom <= innerHeight - 70
    return {
      exists: !!root,
      viewState: header?.dataset.viewState ?? '',
      text,
      nodes: nodeElements.map((el) => ({ key: el.dataset.stepKey, status: el.dataset.stepStatus })),
      visibleNodeCount,
      cream: document.querySelectorAll('[data-cream="now"]').length,
      tabCount: document.querySelectorAll('[data-testid="client-tab-bar"] > div > div > a').length,
      oldDock: !!document.querySelector('[data-testid="app-dock"], [data-testid="app-dock-philia"]'),
      oldStepper: !!document.querySelector('[data-testid="live-stepper"]'),
      photoGrid: !!document.querySelector('[data-testid="service-process-photo-grid"]'),
      empty: !!document.querySelector('[data-testid="service-process-empty"]'),
      report: !!reportLink,
      reportCtaVisible,
      smallText,
    }
  })())`))
}

const EXPECTATIONS = {
  'not-started': { viewState: 'not-started', statuses: ['active', 'locked', 'locked', 'locked', 'locked', 'locked'], cream: 2, text: '到店后会自动推进' },
  'in-progress': { viewState: 'in-progress', statuses: ['done', 'done', 'active', 'locked', 'locked', 'locked'], cream: 2, text: '此刻 洗护中 · 吹干定型' },
  expanded: { viewState: 'in-progress', statuses: ['done', 'done', 'active', 'locked', 'locked', 'locked'], cream: 2, text: '吹干 ①', photoGrid: true },
  'step-empty': { viewState: 'in-progress', statuses: ['done', 'done', 'done', 'active', 'locked', 'locked'], cream: 2, text: '本步照片尚未齐', empty: true },
  completed: { viewState: 'completed', statuses: ['done', 'done', 'done', 'done', 'done', 'done'], cream: 0, text: '查看美容报告', report: true },
}

async function checkState(cdp, state) {
  await navigate(cdp, `/appointments/preview/live?canvasPreview=1&b7State=${state}`)
  const actual = await pageState(cdp)
  const expected = EXPECTATIONS[state]
  const namesOk = NODE_NAMES.every((name) => actual.text.includes(name)) && !actual.text.includes('步骤 3/8')
  const nodesOk = actual.nodes.length === 6 && actual.nodes.every((node, index) => node.key && node.status === expected.statuses[index])
  const ok = actual.exists && actual.viewState === expected.viewState && namesOk && nodesOk && actual.visibleNodeCount === 6
    && actual.cream === expected.cream && actual.text.includes(expected.text)
    && actual.tabCount === 5 && !actual.oldDock && !actual.oldStepper && actual.smallText.length === 0
    && (!expected.photoGrid || actual.photoGrid) && (!expected.empty || actual.empty) && (!expected.report || (actual.report && actual.reportCtaVisible))
  record(`B7 ${state}`, ok, `存在=${actual.exists}；态=${actual.viewState}；节点=${actual.nodes.map((node) => node.status).join('/')}；首屏节点=${actual.visibleNodeCount}；报告CTA=${actual.reportCtaVisible}；cream=${actual.cream}；五栏=${actual.tabCount}；小字=${JSON.stringify(actual.smallText)}`)
  await shot(cdp, state)
}

async function checkSafeArea(cdp) {
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom: 34, right: 0 } })
  try {
    await navigate(cdp, '/appointments/preview/live?canvasPreview=1&b7State=completed')
    const actual = JSON.parse(await cdp.eval(`JSON.stringify((() => {
      const cta = document.querySelector('a[href^="/philia/reports/"]')?.getBoundingClientRect()
      const dock = document.querySelector('[data-testid="client-tab-bar"] > div > div')?.getBoundingClientRect()
      return { ctaBottom: cta?.bottom ?? null, dockTop: dock?.top ?? null, overlap: !!cta && !!dock && cta.bottom > dock.top }
    })())`))
    record('B7 34px 安全区报告 CTA 不被浮岛遮挡', !actual.overlap, JSON.stringify(actual))
    await shot(cdp, 'completed-safe-area')
  } finally {
    await cdp.send('Emulation.clearSafeAreaInsetsOverride').catch(() => {})
  }
}

async function checkInstallBanner(cdp) {
  await navigate(cdp, '/appointments/preview/live?canvasPreview=1&b7State=completed')
  await cdp.eval(`(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
    window.dispatchEvent(event)
    return true
  })()`)
  await sleep(200)
  const visible = await cdp.eval(`!!document.querySelector('[data-testid="pwa-install-banner"]')`)
  record('B7 live 不叠加 PWA 安装条', !visible, `安装条可见=${visible}`)
}

async function checkExpansion(cdp) {
  await navigate(cdp, '/appointments/preview/live?canvasPreview=1&b7State=in-progress')
  const initial = await cdp.eval(`document.querySelector('[data-step-key="wash"] button[aria-expanded]')?.getAttribute('aria-expanded')`)
  await cdp.eval(`document.querySelector('[data-step-key="wash"] button[aria-expanded]')?.click()`)
  await sleep(150)
  const expanded = JSON.parse(await cdp.eval(`JSON.stringify({
    expanded: document.querySelector('[data-step-key="wash"] button[aria-expanded]')?.getAttribute('aria-expanded'),
    empty: !!document.querySelector('[data-testid="service-process-empty"]'),
  })`))
  await cdp.eval(`document.querySelector('[data-step-key="wash"] button[aria-expanded]')?.click()`)
  await sleep(150)
  const collapsed = JSON.parse(await cdp.eval(`JSON.stringify({
    expanded: document.querySelector('[data-step-key="wash"] button[aria-expanded]')?.getAttribute('aria-expanded'),
    empty: !!document.querySelector('[data-testid="service-process-empty"]'),
  })`))
  const toggleOk = initial === 'false' && expanded.expanded === 'true' && expanded.empty && collapsed.expanded === 'false' && !collapsed.empty
  record('B7 当前步可展开并收起', toggleOk, JSON.stringify({ initial, expanded, collapsed }))

  await navigate(cdp, '/appointments/preview/live?canvasPreview=1&b7State=step-empty')
  await cdp.eval(`document.querySelector('[data-testid="service-process-empty"] button')?.click()`)
  await sleep(150)
  const empty = await cdp.eval(`!!document.querySelector('[data-testid="service-process-empty"]')`)
  record('B7 空态稍后再看可收起', !empty, `空态仍在=${empty}`)
}

async function checkSuccessEntry(cdp) {
  await navigate(cdp, '/booking/success?aid=preview')
  const entry = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const link = document.querySelector('[data-testid="booking-view-service-process"]')
    const rect = link?.getBoundingClientRect()
    return {
      exists: !!link,
      href: link?.getAttribute('href') ?? '',
      text: link?.textContent ?? '',
      visible: !!rect && rect.top >= 0 && rect.bottom <= innerHeight,
      top: rect?.top ?? null,
      bottom: rect?.bottom ?? null,
    }
  })())`))
  const ok = entry.exists && entry.visible && entry.href === '/appointments/preview/live' && entry.text.includes('查看服务过程')
  record('C3 预约成功查看服务过程入口', ok, JSON.stringify(entry))
  await shot(cdp, 'success-entry')
  if (entry.exists) {
    await cdp.eval(`document.querySelector('[data-testid="booking-view-service-process"]').click()`)
    await sleep(700)
    const path = await cdp.eval('location.pathname')
    record('C3 入口落到现有 live 路由', path === '/appointments/preview/live', path)
  }
}

let cdp
try {
  const wsUrl = await launchBrowser()
  cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  await checkSuccessEntry(cdp)
  for (const state of Object.keys(EXPECTATIONS)) await checkState(cdp, state)
  await checkSafeArea(cdp)
  await checkInstallBanner(cdp)
  await checkExpansion(cdp)
} catch (error) {
  record('B7 浏览器检查执行', false, error instanceof Error ? error.message : String(error))
} finally {
  cdp?.close()
  cleanup()
}

const failed = results.filter((result) => !result.ok)
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'browser-results.json'), JSON.stringify(results, null, 2))
console.log(`B7 浏览器检查：${results.length - failed.length}/${results.length} 项通过`)
if (failed.length > 0 || results.length === 0) process.exitCode = 1
