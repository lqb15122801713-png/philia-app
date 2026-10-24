import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import superjson from 'superjson'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const PHASE = process.env.PD91_PHASE ?? 'after'
const SHOT_DIR = join(HERE, 'shots', PHASE)
const API_PORT = Number(process.env.PD91_API_PORT ?? 7291)
const WEB_PORT = Number(process.env.PD91_WEB_PORT ?? 7191)
let CDP_PORT = Number(process.env.PD91_CDP_PORT ?? 0)
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`

async function freePort() {
  const server = createNetServer()
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const port = server.address().port
  await new Promise((resolveClose) => server.close(resolveClose))
  return port
}
const TRACKING_NO = 'SF-PD91-MOCK-ONLY'
const ORDER_ID = '01PD91MOCK0000000000000001'
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

const mockOrder = {
  id: ORDER_ID,
  orderNo: 'PD91-MOCK-PAID-001',
  customerId: 'pd91-mock-customer',
  storeId: 'pd91-mock-store',
  items: [{ product_id: 'pd91-mock-product', name: 'PD91 Mock 商品', quantity: 1, price_fen: 19900, image: null }],
  totalFen: 19900,
  address: { receiver: 'Mock 收货人', phone: '13800000000', detail: 'Mock 地址（无真实订单）' },
  status: 'paid',
  trackingNo: null,
  deliveryMethod: 'express',
  shippedAt: null,
  createdAt: new Date('2026-10-24T01:00:00.000Z'),
  updatedAt: new Date('2026-10-24T01:00:00.000Z'),
  storeName: null,
  customerNickname: 'Mock 客户',
  rebateFen: 0,
}
const mockState = { shipCalls: [], shippedIds: [], shipDelayMs: 0, forceError: false }
const checks = []
let viteLog = ''
let vite = null
let browser = null
let cdp = null
let api = null
let cleaned = false

function dataFor(procedure, input) {
  switch (procedure) {
    case 'auth.me':
      return {
        user: { id: 'pd91-mock-owner', nickname: '敏慧店长（Mock）', activePetId: null },
        roles: ['merchant_owner'],
        staff: null,
        store: { id: 'pd91-mock-store', name: 'PD91 Mock 门店' },
      }
    case 'mall.listStoreOrders': {
      const shipped = mockState.shippedIds.includes(ORDER_ID)
      return {
        groups: {
          paid: shipped ? [] : [mockOrder],
          shipped: shipped ? [{ ...mockOrder, status: 'shipped', trackingNo: TRACKING_NO, shippedAt: new Date('2026-10-24T02:00:00.000Z') }] : [],
          refunding: [],
        },
      }
    }
    case 'mall.shipOrder':
      return {
        ...mockOrder,
        status: 'shipped',
        trackingNo: input?.trackingNo ?? TRACKING_NO,
        shippedAt: new Date('2026-10-24T02:00:00.000Z'),
      }
    case 'config.activeCopyTexts':
      return { rows: [] }
    case 'slotPort.liveMap':
      return { slots: [] }
    case 'collab.selfCheck.listPending':
      return { runs: [] }
    case 'report.listMetricAppeals':
      return { pending: [] }
    case 'stock2.approvalPendingCount':
      return { count: 0 }
    case 'push.subscribe':
      return { ok: true }
    default:
      return {}
  }
}

async function startApi() {
  api = createServer(async (req, res) => {
    const origin = req.headers.origin
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${API_PORT}`)
    if (url.pathname === '/__mock/state') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(mockState))
      return
    }
    if (!url.pathname.startsWith('/trpc/')) {
      res.writeHead(404)
      res.end()
      return
    }
    let body = ''
    for await (const chunk of req) body += chunk
    const parsedBody = body ? JSON.parse(body) : null
    const procedures = url.pathname.slice('/trpc/'.length).split(',').map((name) => decodeURIComponent(name))
    const rows = []
    for (let index = 0; index < procedures.length; index += 1) {
      const procedure = procedures[index]
      const input = parsedBody?.[index]?.json ?? parsedBody?.json ?? null
      if (procedure === 'mall.shipOrder') {
        mockState.shipCalls.push({ at: new Date().toISOString(), body, input })
        if (mockState.shipDelayMs > 0) await sleep(mockState.shipDelayMs)
        if (mockState.forceError) {
          rows.push({ error: { json: {
            message: 'PD91 mock ship rejected',
            code: -32603,
            data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
          } } })
          continue
        }
        if (!mockState.shippedIds.includes(input.orderId)) mockState.shippedIds.push(input.orderId)
      }
      rows.push({ result: { data: superjson.serialize(dataFor(procedure, input)) } })
    }
    res.writeHead(rows.some((row) => row.error) ? 500 : 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(url.searchParams.get('batch') === '1' ? rows : rows[0]))
  })
  await new Promise((resolveListen, rejectListen) => {
    api.once('error', rejectListen)
    api.listen(API_PORT, '127.0.0.1', resolveListen)
  })
}

async function startVite() {
  vite = spawn(process.execPath, [
    join(ROOT, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1',
    '--port', String(WEB_PORT),
    '--strictPort',
  ], {
    cwd: join(ROOT, 'apps/merchant'),
    env: { ...process.env, VITE_API_BASE: `http://127.0.0.1:${API_PORT}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  vite.stdout.on('data', (chunk) => { viteLog += chunk })
  vite.stderr.on('data', (chunk) => { viteLog += chunk })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (vite.exitCode !== null) throw new Error(`Vite exited ${vite.exitCode}:\n${viteLog}`)
    try {
      const response = await fetch(WEB_URL)
      if (response.ok) return
    } catch {}
    await sleep(150)
  }
  throw new Error(`Vite not ready:\n${viteLog}`)
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 0
    this.pending = new Map()
    this.pageErrors = []
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
      if (message.method === 'Runtime.exceptionThrown') {
        this.pageErrors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text)
      }
    }
    await new Promise((resolveOpen, rejectOpen) => {
      this.ws.onopen = resolveOpen
      this.ws.onerror = rejectOpen
    })
    await this.send('Page.enable')
    await this.send('Runtime.enable')
    await this.send('Network.enable')
    await this.send('Network.setBypassServiceWorker', { bypass: true })
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/events*', requestStage: 'Request' }] })
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    })
  }

  send(method, params = {}) {
    return new Promise((resolveSend, rejectSend) => {
      const id = ++this.id
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result.value
  }

  async waitFor(expression, timeoutMs = 10000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (await this.eval(`Boolean(${expression})`)) return
      await sleep(100)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async shot(name) {
    mkdirSync(SHOT_DIR, { recursive: true })
    const result = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(join(SHOT_DIR, `${name}.png`), Buffer.from(result.data, 'base64'))
  }

  close() {
    try { this.ws.close() } catch {}
  }
}

const EDGE_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const profileDir = join(tmpdir(), `philia-pd91-${process.pid}`)

async function startBrowser() {
  const executable = EDGE_CANDIDATES.find((path) => existsSync(path))
  if (!executable) throw new Error('Edge/Chrome not found')
  if (CDP_PORT === 0) CDP_PORT = await freePort()
  let browserLog = ''
  let lastHandshakeError = ''
  browser = spawn(executable, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  browser.stdout.on('data', (chunk) => { browserLog += chunk })
  browser.stderr.on('data', (chunk) => { browserLog += chunk })
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (browser.exitCode !== null) throw new Error(`Browser exited ${browser.exitCode}:\n${browserLog}`)
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page) {
        cdp = new Cdp(page.webSocketDebuggerUrl)
        await cdp.open()
        return
      }
    } catch (error) {
      lastHandshakeError = error?.stack ?? String(error)
    }
    await sleep(150)
  }
  throw new Error(`CDP not ready; browser exit=${browser.exitCode}:\n${lastHandshakeError}\n${browserLog}`)
}

function cleanup() {
  if (cleaned) return
  cleaned = true
  cdp?.close()
  for (const child of [browser, vite]) {
    if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  }
  api?.close()
  try { rmSync(profileDir, { recursive: true, force: true }) } catch {}
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(2))

class Expectation extends Error {}
function expectValue(name, actual, expected) {
  const pass = Object.is(actual, expected)
  checks.push({ name, pass, actual, expected })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`)
  if (!pass) throw new Expectation(name)
}

async function dialogState() {
  return cdp.eval(`(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')]
    const dialog = dialogs[0]
    return {
      count: dialogs.length,
      title: dialog?.querySelector('h3')?.textContent?.trim() ?? null,
      text: dialog?.textContent ?? '',
      buttons: dialog ? [...dialog.querySelectorAll('button')].map((button) => button.textContent.trim()) : [],
      controls: dialog ? [...dialog.querySelectorAll('button')].map((button) => ({
        text: button.textContent.trim(),
        aria: button.getAttribute('aria-label'),
        disabled: button.disabled,
      })) : [],
      orderText: document.querySelector('[data-testid="order-${ORDER_ID}"]')?.textContent ?? '',
    }
  })()`)
}

async function openForm() {
  await cdp.eval(`document.querySelector('[data-testid="ship-${ORDER_ID}"]').click(); true`)
  await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent?.startsWith('发货 ·')`)
}

async function fillTracking(value = TRACKING_NO) {
  await cdp.eval(`document.querySelector('[role="dialog"] input').focus(); true`)
  await cdp.send('Input.insertText', { text: value })
  await cdp.waitFor(`document.querySelector('[role="dialog"] input')?.value === ${JSON.stringify(value)}`)
}

async function clickDialogButton(label) {
  await cdp.eval(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button')]
      .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)})
    if (!button) throw new Error('Missing dialog button ${label}')
    button.click()
    return true
  })()`)
}

async function key(key, code, virtualKey) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey })
}

async function runFinalizeFlow() {
  await cdp.waitFor(`document.querySelector('[data-testid="ship-${ORDER_ID}"]')`)
  mockState.shipDelayMs = 10000
  await openForm()
  await fillTracking(`  ${TRACKING_NO}  `)
  await clickDialogButton('确认发货')
  await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent?.startsWith('确认发货 ·')`)
  await clickDialogButton('确认发货')
  await cdp.waitFor(`[...document.querySelectorAll('[role="dialog"] button')].some((button) => button.textContent.trim() === '提交中…')`)
  const pending = await dialogState()
  await cdp.shot('01-pending-controls')
  expectValue('final confirm sends one mock request', mockState.shipCalls.length, 1)
  expectValue('pending disables header close', pending.controls.find((control) => control.aria === '关闭')?.disabled, true)
  expectValue('pending disables cancel', pending.controls.find((control) => control.text === '取消')?.disabled, true)
  expectValue('pending disables confirm', pending.controls.find((control) => control.text === '提交中…')?.disabled, true)

  await key('Escape', 'Escape', 27)
  await sleep(100)
  expectValue('pending Escape cannot dismiss request', (await dialogState()).count, 1)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1200, y: 850, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1200, y: 850, button: 'left', clickCount: 1 })
  await sleep(100)
  expectValue('pending overlay cannot dismiss request', (await dialogState()).count, 1)

  await cdp.waitFor(`!document.querySelector('[role="dialog"]')`, 15000)
  await cdp.shot('02-final-success')
  expectValue('successful final confirm stays exactly once', mockState.shipCalls.length, 1)
  expectValue('final payload has order id', mockState.shipCalls[0].input.orderId, ORDER_ID)
  expectValue('final payload trims tracking number', mockState.shipCalls[0].input.trackingNo, TRACKING_NO)
  expectValue('successful mock order moved to shipped', mockState.shippedIds.includes(ORDER_ID), true)

  mockState.shippedIds = []
  mockState.shipDelayMs = 0
  mockState.forceError = true
  await cdp.send('Page.navigate', { url: `${WEB_URL}/orders` })
  await cdp.waitFor(`document.querySelector('[data-testid="ship-${ORDER_ID}"]')`)
  await openForm()
  await fillTracking()
  await clickDialogButton('确认发货')
  await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent?.startsWith('确认发货 ·')`)
  await clickDialogButton('确认发货')
  await cdp.waitFor(`document.body.innerText.includes('PD91 mock ship rejected')`)
  const rejection = await dialogState()
  await cdp.shot('03-final-rejection')
  expectValue('rejection keeps confirmation open', rejection.count, 1)
  expectValue('rejection restores confirm CTA', rejection.buttons.includes('确认发货'), true)
  expectValue('rejection restores cancel CTA', rejection.controls.find((control) => control.text === '取消')?.disabled, false)
  expectValue('rejection is one additional mock attempt', mockState.shipCalls.length, 2)
  expectValue('rejection does not move order to shipped', mockState.shippedIds.includes(ORDER_ID), false)
  await clickDialogButton('取消')
  await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent?.startsWith('发货 ·')`)
  expectValue('rejection cancel makes no extra request', mockState.shipCalls.length, 2)
}

async function main() {
  let exitCode = 0
  let result
  try {
    mkdirSync(SHOT_DIR, { recursive: true })
    await startApi()
    await startVite()
    await startBrowser()
    if (process.env.PD91_SCENARIO === 'finalize') {
      await cdp.send('Page.navigate', { url: `${WEB_URL}/orders` })
      await runFinalizeFlow()
      result = { phase: PHASE, ok: true, url: `${WEB_URL}/orders`, mockOnly: true, scenario: 'finalize' }
      return
    }
    await cdp.send('Page.navigate', { url: `${WEB_URL}/orders` })
    await cdp.waitFor(`document.querySelector('[data-testid="ship-${ORDER_ID}"]')`)
    await cdp.shot('01-paid-list')

    await openForm()
    const first = await dialogState()
    await cdp.shot('02-independent-first-layer')
    expectValue('row click opens one independent dialog', first.count, 1)
    expectValue('first layer has cancel CTA', first.buttons.includes('取消'), true)
    expectValue('first layer has confirm CTA', first.buttons.includes('确认发货'), true)
    expectValue('first layer does not ship', mockState.shipCalls.length, 0)

    await clickDialogButton('取消')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`)
    await cdp.shot('03-first-cancel-closed')
    expectValue('first-layer cancel closes dialog', (await dialogState()).count, 0)
    expectValue('first-layer cancel does not ship', mockState.shipCalls.length, 0)

    await openForm()
    await fillTracking()
    await clickDialogButton('确认发货')
    await sleep(500)
    const gate = await dialogState()
    await cdp.shot('04-independent-confirm-gate')
    expectValue('form confirm is held before ship mutation', mockState.shipCalls.length, 0)
    expectValue('independent confirmation layer remains visible', gate.count, 1)
    expectValue('confirmation names shipped-state consequence', gate.text.includes('标记为已发货'), true)
    expectValue('confirmation shows tracking number', gate.text.includes(TRACKING_NO), true)
    expectValue('confirmation has cancel CTA', gate.buttons.includes('取消'), true)
    expectValue('confirmation has confirm CTA', gate.buttons.includes('确认发货'), true)

    await clickDialogButton('取消')
    await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent?.startsWith('发货 ·')`)
    await cdp.shot('05-confirm-cancel-returned')
    expectValue('confirmation cancel closes gate without shipping', mockState.shipCalls.length, 0)
    await clickDialogButton('取消')
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`)
    expectValue('cancel path leaves order pending', (await dialogState()).orderText.includes('待发货'), true)

    await openForm()
    await fillTracking()
    await key('Enter', 'Enter', 13)
    await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent?.startsWith('确认发货 ·')`)
    expectValue('Enter cannot bypass confirmation gate', mockState.shipCalls.length, 0)
    await key('Escape', 'Escape', 27)
    await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent?.startsWith('发货 ·')`)
    expectValue('Escape closes confirmation without shipping', mockState.shipCalls.length, 0)
    await key('Escape', 'Escape', 27)
    await cdp.waitFor(`!document.querySelector('[role="dialog"]')`)
    await cdp.shot('06-esc-closed-no-ship')
    const closed = await dialogState()
    expectValue('Escape path closes all layers', closed.count, 0)
    expectValue('Escape path leaves order pending', closed.orderText.includes('待发货'), true)
    expectValue('no ship mutation was made', mockState.shipCalls.length, 0)
    expectValue('no uncaught page exception', cdp.pageErrors.length, 0)

    result = { phase: PHASE, ok: true, url: `${WEB_URL}/orders`, mockOnly: true }
  } catch (error) {
    result = {
      phase: PHASE,
      ok: false,
      url: `${WEB_URL}/orders`,
      mockOnly: true,
      failure: error instanceof Expectation ? error.message : null,
      error: error instanceof Expectation ? null : (error?.stack ?? String(error)),
    }
    exitCode = error instanceof Expectation ? 1 : 2
  } finally {
    writeFileSync(join(HERE, `${PHASE}-result.json`), JSON.stringify({
      ...result,
      checks,
      shipMutationCalls: mockState.shipCalls,
      screenshots: SHOT_DIR,
    }, null, 2))
    writeFileSync(join(HERE, `${PHASE}-vite.log`), viteLog)
    cleanup()
  }
  process.exit(exitCode)
}

if (process.env.PD91_SERVER_ONLY === '1') {
  try {
    await startApi()
    await startVite()
    console.log(`PD91 mock ready: ${WEB_URL}/orders`)
  } catch (error) {
    console.error(error)
    process.exit(2)
  }
} else {
  await main()
}
