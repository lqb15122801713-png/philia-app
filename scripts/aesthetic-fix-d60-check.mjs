#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9227)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-d60')
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
const EXPECTED_LINKS = [
  { index: 0, label: '待到店', path: '/appointments', search: '?tab=confirmed', activeTab: '已确认' },
  { index: 1, label: '服务中', path: '/appointments', search: '?tab=serving', activeTab: '服务中' },
  { index: 2, label: '待评价', path: '/appointments', search: '?tab=history', activeTab: '已完成' },
  { index: 3, label: '退款售后', path: '/refunds', search: '', activeTab: null },
  { index: 4, label: '全部订单', path: '/appointments', search: '?tab=all', activeTab: '全部' },
]
const LIST_MINE_INPUT = encodeURIComponent(JSON.stringify({ 0: { json: null } }))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = []
let browser = null
const profileDir = join(tmpdir(), `philia-aesthetic-d60-${process.pid}`)

function record(id, ok, detail) {
  results.push({ id, ok, detail })
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
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    '--no-first-run', '--disable-extensions', 'about:blank',
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

  async viewport(height) {
    await this.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true })
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
}

async function measure(cdp) {
  return JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const dock = document.querySelector('[data-testid="app-dock"]').firstElementChild.firstElementChild.getBoundingClientRect()
    const items = [...document.querySelector('[data-testid="me-orderrow"]').children].map((el) => {
      const rect = el.getBoundingClientRect()
      const link = el.tagName === 'A' ? el : el.querySelector('a')
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null
      return {
        text: el.innerText.trim().replace(/\\n/g, '/'),
        top: rect.top, bottom: rect.bottom,
        inViewport: rect.top >= 0 && rect.bottom <= innerHeight,
        covered: rect.bottom > dock.top && rect.top < dock.bottom,
        clickable: hit === el || el.contains(hit),
        href: link?.getAttribute('href') ?? null,
      }
    })
    return { scrollY, dockTop: dock.top, dockBottom: dock.bottom, items }
  })())`))
}

async function checkZeroScroll(cdp, height) {
  await cdp.viewport(height)
  await navigate(cdp, '/me', `!!document.querySelector('[data-testid="me-orderrow"]') && !!document.querySelector('[data-testid="app-dock"]')`)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(400)
  const state = await measure(cdp)
  const visible = state.items.filter((item) => item.inViewport)
  const covered = state.items.filter((item) => item.covered)
  const clickable = state.items.filter((item) => item.clickable)
  const ok = state.scrollY === 0 && state.items.length === 5 && visible.length === 5 && covered.length === 0 && clickable.length === 5
  record(`D-60 零滚初屏五态完整无遮可点（390×${height}）`, ok, `scrollY=${state.scrollY}；五格=${state.items.length}；完整=${visible.length}；被遮=${covered.length}；可点=${clickable.length}；dockTop=${Math.round(state.dockTop)}`)
  await shot(cdp, `d60-zero-${height}`)
}

async function clickOrderLink(cdp, index) {
  const point = await cdp.eval(`(() => {
    const item = document.querySelector('[data-testid="me-orderrow"]').children[${index}]
    const link = item.tagName === 'A' ? item : item.querySelector('a')
    if (!link) return null
    const rect = link.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, href: link.getAttribute('href') }
  })()`)
  if (!point) return null
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  return point.href
}

async function checkOrderLinks(cdp) {
  await cdp.viewport(844)
  for (const expected of EXPECTED_LINKS) {
    await navigate(cdp, '/me', `!!document.querySelector('[data-testid="me-orderrow"]')`)
    const href = await clickOrderLink(cdp, expected.index)
    if (!href) {
      record(`D-60 入口 ${expected.label} 到达 ${expected.path}${expected.search}`, false, '无链或中心点不可点')
      continue
    }
    const readyExpression = expected.activeTab
      ? `[...document.querySelectorAll('[data-block-key="appointments.tabs"] button')].some((button) => button.textContent.includes('${expected.activeTab}') && button.className.includes('bg-brand-primary'))`
      : `(document.body?.innerText ?? '').includes('退款/售后')`
    await cdp.waitFor(readyExpression, 10000)
    const state = JSON.parse(await cdp.eval(`JSON.stringify({ path: location.pathname, search: location.search, ready: ${readyExpression} })`))
    let idsDetail = ''
    let idsMatch = true
    if (expected.search === '?tab=all') {
      const all = JSON.parse(await cdp.eval(`(async () => {
        const response = await fetch('${API_BASE}/trpc/appointment.listMine?batch=1&input=${LIST_MINE_INPUT}', { credentials: 'include' }).then((res) => res.json())
        const groups = response[0].result.data.json.groups
        const expectedIds = Object.values(groups).flat().map((item) => item.id).sort()
        const renderedIds = [...document.querySelectorAll('[data-block-key="appointments.list"] a[href^="/appointments/"]')]
          .map((link) => link.getAttribute('href').split('/')[2]).sort()
        return JSON.stringify({ expectedIds, renderedIds })
      })()`))
      idsMatch = all.expectedIds.length === all.renderedIds.length
        && all.expectedIds.every((id, index) => id === all.renderedIds[index])
        && new Set(all.renderedIds).size === all.renderedIds.length
      idsDetail = `；接口=${all.expectedIds.length}；渲染=${all.renderedIds.length}；去重=${new Set(all.renderedIds).size}`
    }
    const ok = state.path === expected.path && state.search === expected.search && state.ready && idsMatch
    record(`D-60 入口 ${expected.label} 到达 ${expected.path}${expected.search}`, ok, `href=${href}；实际=${state.path}${state.search}；目标就绪=${state.ready}${idsDetail}`)
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  await checkZeroScroll(cdp, 844)
  await checkZeroScroll(cdp, 700)
  await checkOrderLinks(cdp)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: CUSTOMER_URL, results }, null, 2))
  if (results.length !== 7) {
    console.error(`检查数不符：期望 7，实际 ${results.length}`)
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
