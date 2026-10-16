#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://127.0.0.1:7131').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9228)
const PUBLISH = process.env.CANVAS_PUBLISH === '1'
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'canvas-final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-d60')
const EXPECTED_ORDER = ['me.apphead', 'me.hero', 'me.notify', 'me.orderrow', 'me.entries', 'me.grid']
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
const profileDir = join(tmpdir(), `philia-d60-canvas-${process.pid}`)

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
    await this.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
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

async function navigate(cdp, base, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${base}${path}` })
  const ready = await cdp.waitFor(readyExpression)
  if (!ready) throw new Error(`页面未就绪：${path}`)
}

async function login(cdp, role) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const user = users.find((item) => (item.roles ?? []).includes(role))
  if (!user) throw new Error(`无种子角色 ${role}`)
  const base = role === 'merchant_owner' ? MERCHANT_URL : CUSTOMER_URL
  const ready = role === 'merchant_owner'
    ? `!!document.querySelector('[data-testid="login-gate"]')`
    : `(document.body?.innerText ?? '').includes('选择种子用户登录')`
  await navigate(cdp, base, '/dev-login', ready)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`${role} dev-login HTTP ${status}`)
}

async function trpc(cdp, path, input) {
  const result = await cdp.eval(`fetch('${API_BASE}/trpc/${path}?batch=1', {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ 0: { json: ${JSON.stringify(input)} } }),
  }).then((res) => res.json())`)
  if (result?.[0]?.error) throw new Error(JSON.stringify(result[0].error))
  return result?.[0]?.result?.data?.json
}

async function trpcQuery(cdp, path, input) {
  const encoded = encodeURIComponent(JSON.stringify({ 0: { json: input } }))
  const result = await cdp.eval(`fetch('${API_BASE}/trpc/${path}?batch=1&input=${encoded}', { credentials: 'include' }).then((res) => res.json())`)
  if (result?.[0]?.error) throw new Error(JSON.stringify(result[0].error))
  return result?.[0]?.result?.data?.json
}

async function checkCanvasOrder(cdp) {
  await login(cdp, 'merchant_owner')
  const before = await trpcQuery(cdp, 'canvas.getLayout', { pageKey: 'me' })
  if (before?.editing !== null) {
    throw new Error('当前已有草稿或 published 布局，无法证明注册表默认稿；请使用干净测试库')
  }
  await navigate(cdp, MERCHANT_URL, '/console?port=canvas', `!!document.querySelector('[data-testid="canvas-tab-me"]')`)
  await cdp.eval(`document.querySelector('[data-testid="canvas-tab-me"]').click()`)
  await cdp.waitFor(`!!document.querySelector('[data-testid="canvas-row-me.orderrow"]')`)
  const order = await cdp.eval(`[...document.querySelectorAll('[data-canvas-row="true"]')].map((el) => el.dataset.testid.replace('canvas-row-', ''))`)
  const ok = JSON.stringify(order) === JSON.stringify(EXPECTED_ORDER)
  record('D-60 商家默认编辑稿使用新订单行顺序', ok, order.join(' → '))
  await shot(cdp, 'merchant-default-order')

  if (PUBLISH) {
    const saved = await trpc(cdp, 'canvas.saveLayout', {
      pageKey: 'me',
      blocks: order.map((blockKey) => ({ blockKey, visible: true })),
    })
    await trpc(cdp, 'canvas.publishLayout', { versionId: saved.layout.id })
    const live = await trpcQuery(cdp, 'canvas.liveLayout', { pageKey: 'me', storeId: saved.layout.storeId })
    const liveOrder = (live?.blocks ?? []).map((block) => block.blockKey)
    const liveOrderOk = JSON.stringify(liveOrder) === JSON.stringify(EXPECTED_ORDER)
    record('D-60 liveLayout 与发布顺序一致', liveOrderOk, liveOrder.join(' → '))

    await login(cdp, 'customer')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 1, mobile: true })
    await navigate(cdp, CUSTOMER_URL, '/me', `!!document.querySelector('[data-testid="me-orderrow"]') && !!document.querySelector('[data-testid="app-dock"]')`)
    await cdp.eval('window.scrollTo(0, 0)')
    await sleep(400)
    const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
      const dock = document.querySelector('[data-testid="app-dock"]').firstElementChild.firstElementChild.getBoundingClientRect()
      const items = [...document.querySelector('[data-testid="me-orderrow"]').children].map((el) => {
        const rect = el.getBoundingClientRect()
        return { top: rect.top, bottom: rect.bottom, inViewport: rect.top >= 0 && rect.bottom <= innerHeight, covered: rect.bottom > dock.top && rect.top < dock.bottom }
      })
      return { scrollY, items }
    })())`))
    const visible = state.items.filter((item) => item.inViewport).length
    const covered = state.items.filter((item) => item.covered).length
    const liveOk = state.scrollY === 0 && state.items.length === 5 && visible === 5 && covered === 0
    record('D-60 默认稿发布后零滚仍无遮', liveOk, `scrollY=${state.scrollY}；五格=${state.items.length}；完整=${visible}；被遮=${covered}`)
    await shot(cdp, 'published-zero-700')
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await checkCanvasOrder(cdp)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
  const expectedCount = PUBLISH ? 3 : 1
  if (results.length !== expectedCount) {
    console.error(`检查数不符：期望 ${expectedCount}，实际 ${results.length}`)
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
