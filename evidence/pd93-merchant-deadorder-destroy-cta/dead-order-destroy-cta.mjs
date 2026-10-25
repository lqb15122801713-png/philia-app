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
const PHASE = process.env.PD93_PHASE ?? 'after'
const SCENARIO = process.env.PD93_SCENARIO ?? 'dead'
const SHOT_DIR = join(HERE, 'shots', PHASE, SCENARIO)
const DEAD_ORDER_ID = '01M5H1E1PD93DEAD0RDER000000'
const CONTROL_ORDER_ID = '01PD93MOCKCONTROL000000001'
const BATCH_ID = '01PD93MOCKQUARANTINED000001'
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const mockState = { shipCalls: [], destroyCalls: [], quarantineCalls: [] }
const checks = []
let api = null
let vite = null
let browser = null
let cdp = null
let viteLog = ''
let webUrl = ''
let cleaned = false

const deadOrder = {
  id: DEAD_ORDER_ID,
  orderNo: 'P261022YKNXD2',
  customerId: 'pd93-mock-customer-dead',
  storeId: 'pd93-mock-store',
  items: [{ product_id: 'pd93-mock-product-dead', name: 'PD93 Mock 死单商品', quantity: 2, price_fen: 950, image: null }],
  totalFen: 1900,
  address: { receiver: 'Mock 收货人', phone: '13800000000', detail: 'Mock 地址（无真实订单）' },
  status: 'paid',
  trackingNo: null,
  deliveryMethod: 'express',
  shippedAt: null,
  createdAt: new Date('2026-10-22T01:00:00.000Z'),
  updatedAt: new Date('2026-10-22T01:00:00.000Z'),
  storeName: null,
  customerNickname: 'Mock 死单客户',
  rebateFen: 0,
}
const controlOrder = {
  ...deadOrder,
  id: CONTROL_ORDER_ID,
  orderNo: 'P261022PD93C',
  customerId: 'pd93-mock-customer-control',
  items: [{ product_id: 'pd93-mock-product-control', name: 'PD93 Mock 对照商品', quantity: 1, price_fen: 2000, image: null }],
  totalFen: 2000,
  customerNickname: 'Mock 对照客户',
}
const quarantinedBatch = {
  id: BATCH_ID,
  storeId: 'pd93-mock-store',
  productId: 'pd93-mock-expiry-product',
  batchNo: 'PD93-EXPIRED-001',
  qty: 3,
  productionDate: new Date('2026-01-01T00:00:00.000Z'),
  expiryDate: new Date('2026-10-01T00:00:00.000Z'),
  shelfLifeDays: 273,
  status: 'quarantined',
  note: 'PD93 Mock 已隔离批次',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  productName: 'PD93 Mock 效期商品',
  daysLeft: -23,
  grade: 'expired',
}

const mockProducts = [
  { id: 'pd93-mock-other-product', name: 'PD93 Mock 其他商品', stock: 5, costFen: 100 },
  { id: 'pd93-mock-expiry-product', name: 'PD93 Mock 效期商品', stock: 3, costFen: 100 },
]

function dataFor(procedure, input) {
  switch (procedure) {
    case 'auth.me':
      return {
        user: { id: 'pd93-mock-owner', nickname: '敏慧店长（Mock）', activePetId: null, storeId: 'pd93-mock-store' },
        roles: ['merchant_owner'],
        staff: null,
        store: { id: 'pd93-mock-store', name: 'PD93 Mock 门店' },
      }
    case 'mall.listStoreOrders':
      return { groups: { paid: [deadOrder, controlOrder], shipped: [], refunding: [] } }
    case 'mall.listProductsForStore':
      return { items: mockProducts, total: mockProducts.length, page: 1, pageSize: 200 }
    case 'stock2.expiryBoard':
      return { urgentDays: 7, warnDays: 30, items: [] }
    case 'stock2.batchList':
      return { items: input?.productId && input.productId !== quarantinedBatch.productId ? [] : [quarantinedBatch] }
    case 'stock2.fefoSuggestion':
      return { suggestion: null, sequence: [], note: 'PD93 Mock FEFO' }
    case 'stock2.stockAlerts':
      return { low: [], high: [] }
    case 'stock2.writeoffList':
      return []
    case 'stock2.approvalPendingCount':
      return { count: 0 }
    case 'config.activeCopyTexts':
      return { rows: [] }
    case 'slotPort.liveMap':
      return { slots: [] }
    case 'collab.selfCheck.listPending':
      return { runs: [] }
    case 'report.listMetricAppeals':
      return { pending: [] }
    case 'push.unreadCount':
      return { total: 0, byCategory: {} }
    case 'push.subscribe':
      return { ok: true }
    default:
      return {}
  }
}

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

async function startApi() {
  const port = await freePort()
  api = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
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
    const procedures = url.pathname.slice('/trpc/'.length).split(',').map((name) => decodeURIComponent(name))
    const rawInput = url.searchParams.get('input')
    const parsedInput = rawInput ? JSON.parse(rawInput) : (body ? JSON.parse(body) : null)
    const rows = procedures.map((procedure, index) => {
      const input = parsedInput?.[index]?.json ?? parsedInput?.json ?? null
      if (req.method !== 'GET' && ['mall.shipOrder', 'stock2.batchDestroy', 'stock2.batchQuarantine'].includes(procedure)) {
        const attempt = { procedure, body, at: new Date().toISOString() }
        if (procedure === 'mall.shipOrder') mockState.shipCalls.push(attempt)
        if (procedure === 'stock2.batchDestroy') mockState.destroyCalls.push(attempt)
        if (procedure === 'stock2.batchQuarantine') mockState.quarantineCalls.push(attempt)
        return { error: { json: { message: `PD93 mock blocked ${procedure}`, code: -32603, data: { code: 'FORBIDDEN', httpStatus: 403 } } } }
      }
      return { result: { data: superjson.serialize(dataFor(procedure, input)) } }
    })
    res.writeHead(rows.some((row) => row.error) ? 403 : 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(url.searchParams.get('batch') === '1' ? rows : rows[0]))
  })
  await new Promise((resolveListen, rejectListen) => {
    api.once('error', rejectListen)
    api.listen(port, '127.0.0.1', resolveListen)
  })
  return port
}

async function startVite(apiPort) {
  const webPort = await freePort()
  webUrl = `http://127.0.0.1:${webPort}`
  vite = spawn(process.execPath, [
    join(ROOT, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1',
    '--port', String(webPort),
    '--strictPort',
  ], {
    cwd: join(ROOT, 'apps/merchant'),
    env: { ...process.env, VITE_API_BASE: `http://127.0.0.1:${apiPort}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  vite.stdout.on('data', (chunk) => { viteLog += chunk })
  vite.stderr.on('data', (chunk) => { viteLog += chunk })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (vite.exitCode !== null) throw new Error(`Vite exited ${vite.exitCode}:\n${viteLog}`)
    try {
      const response = await fetch(webUrl)
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
    await this.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
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

async function startBrowser() {
  const executable = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((path) => existsSync(path))
  if (!executable) throw new Error('Edge/Chrome not found')
  const cdpPort = await freePort()
  const profileDir = join(tmpdir(), `philia-pd93-${process.pid}`)
  let browserLog = ''
  browser = spawn(executable, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  browser.stdout.on('data', (chunk) => { browserLog += chunk })
  browser.stderr.on('data', (chunk) => { browserLog += chunk })
  browser.once('exit', () => {
    try { rmSync(profileDir, { recursive: true, force: true }) } catch {}
  })
  let lastHandshakeError = ''
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (browser.exitCode !== null) throw new Error(`Browser exited ${browser.exitCode}:\n${browserLog}`)
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()
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
  throw new Error(`CDP not ready:\n${lastHandshakeError}\n${browserLog}`)
}

function cleanup() {
  if (cleaned) return
  cleaned = true
  cdp?.close()
  for (const child of [browser, vite]) {
    if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  }
  api?.close()
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

async function runDeadOrder() {
  await cdp.send('Page.navigate', { url: `${webUrl}/orders` })
  await cdp.waitFor(`document.querySelector('[data-testid="ship-${CONTROL_ORDER_ID}"]')`)
  await cdp.shot('01-orders')
  expectValue('DEAD_ORDER_ID_NOT_SEEN', await cdp.eval(`document.body.innerText.includes('P261022YKNXD2')`), true)
  await cdp.waitFor(`document.querySelector('[data-testid="order-${DEAD_ORDER_ID}"]')`)
  const rowText = await cdp.eval(`document.querySelector('[data-testid="order-${DEAD_ORDER_ID}"]').textContent`)
  expectValue('dead order literal and read-only state are visible', rowText.includes('死单') && rowText.includes('只读'), true)
  expectValue('dead order is included in the paid chip count', await cdp.eval(`document.querySelector('[data-testid="orders-tab-paid"]').textContent.trim()`), '待发货 2')
  expectValue('dead order is included in the subtitle count', await cdp.eval(`document.querySelector('[data-testid="orders-page"]').textContent.includes('待发货 2 · 已发货 0 · 售后 0')`), true)
  expectValue('dead ship is visibly disabled', await cdp.eval(`document.querySelector('[data-testid="dead-order-ship-${DEAD_ORDER_ID}"]')?.disabled`), true)
  expectValue('dead refund is visibly disabled', await cdp.eval(`document.querySelector('[data-testid="dead-order-refund-${DEAD_ORDER_ID}"]')?.disabled`), true)
  expectValue('normal paid order keeps its ship action', await cdp.eval(`document.querySelector('[data-testid="ship-${CONTROL_ORDER_ID}"]')?.disabled`), false)
  await cdp.eval(`document.querySelector('[data-testid="dead-order-ship-${DEAD_ORDER_ID}"]').click(); document.querySelector('[data-testid="dead-order-refund-${DEAD_ORDER_ID}"]').click(); true`)
  expectValue('dead controls cannot open a shipment or refund layer', await cdp.eval(`document.querySelectorAll('[role="dialog"]').length`), 0)
  await cdp.eval(`document.querySelector('[data-testid="ship-${CONTROL_ORDER_ID}"]').click(); true`)
  await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent.startsWith('发货 · P261022PD93C')`)
  expectValue('normal order retains the existing shipment layer', await cdp.eval(`document.querySelectorAll('[role="dialog"]').length`), 1)
  await cdp.eval(`[...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent.trim() === '取消').click(); true`)
  await cdp.waitFor(`document.querySelectorAll('[role="dialog"]').length === 0`)
  expectValue('normal shipment cancel makes no mutation', mockState.shipCalls.length, 0)
  expectValue('no uncaught page exception', cdp.pageErrors.length, 0)
}

async function runDestroy() {
  await cdp.send('Page.navigate', { url: `${webUrl}/inventory` })
  await cdp.waitFor(`document.querySelector('[data-testid="inventory-batch-row-${BATCH_ID}"]')`)
  await cdp.waitFor(`document.querySelector('[data-testid="inventory-batch-filter"] option[value="pd93-mock-other-product"]')`)
  await cdp.shot('01-empty-expiry')
  expectValue('expiry board is the reported empty state', await cdp.eval(`document.querySelector('[data-testid="inventory-expiry"]')?.textContent.includes('暂无临期 / 过期批次')`), true)
  await cdp.eval(`(() => {
    const select = document.querySelector('[data-testid="inventory-batch-filter"]')
    select.value = 'pd93-mock-other-product'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await cdp.waitFor(`!document.querySelector('[data-testid="inventory-batch-row-${BATCH_ID}"]')`)
  expectValue('unrelated batch filter hides the target in the batch panel', true, true)
  expectValue('DESTROY_CTA_NOT_SEEN', await cdp.eval(`Boolean(document.querySelector('[data-testid="inventory-destroy-open"]'))`), true)
  await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-open"]').click(); true`)
  await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent === '销毁登记'`)
  await cdp.waitFor(`document.querySelector('[data-testid="inventory-destroy-batch"]')`)
  expectValue('destroy candidates ignore the unrelated batch filter', await cdp.eval(`Boolean(document.querySelector('[data-testid="inventory-destroy-batch"] option[value="${BATCH_ID}"]'))`), true)
  expectValue('destroy opens an independent confirmation layer', await cdp.eval(`document.querySelectorAll('[role="dialog"]').length`), 1)
  expectValue('opening destroy makes no mutation', mockState.destroyCalls.length + mockState.quarantineCalls.length, 0)
  expectValue('confirm is blocked before a target and reason', await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-submit"]')?.disabled`), true)
  await cdp.eval(`(() => {
    const select = document.querySelector('[data-testid="inventory-destroy-batch"]')
    select.value = '${BATCH_ID}'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await cdp.waitFor(`document.querySelector('[data-testid="inventory-destroy-summary"]')?.textContent.includes('PD93-EXPIRED-001')`)
  await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-note"]').focus(); true`)
  await cdp.send('Input.insertText', { text: '   ' })
  await cdp.waitFor(`document.querySelector('[data-testid="inventory-destroy-note"]')?.value.length === 3`)
  expectValue('whitespace-only reason keeps confirm disabled', await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-submit"]')?.disabled`), true)
  await cdp.send('Input.insertText', { text: 'PD93 Mock 销毁确认（不提交）' })
  await cdp.waitFor(`document.querySelector('[data-testid="inventory-destroy-note"]')?.value.trim().length > 0`)
  expectValue('valid target and reason enable but do not submit confirm', await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-submit"]')?.disabled`), false)
  const dialogText = await cdp.eval(`document.querySelector('[role="dialog"]').textContent`)
  expectValue('confirmation identifies the quarantined batch', dialogText.includes('PD93-EXPIRED-001') && dialogText.includes('已隔离'), true)
  expectValue('confirmation names the inventory consequence', dialogText.includes('数量清零'), true)
  await cdp.shot('02-destroy-confirm')
  expectValue('pre-confirm still makes no destroy mutation', mockState.destroyCalls.length, 0)
  await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-cancel"]').click(); true`)
  await cdp.waitFor(`document.querySelectorAll('[role="dialog"]').length === 0`)
  await cdp.shot('03-cancel-closed')
  checks.push({ name: 'cancel acted and closed the destroy layer', pass: true, actual: 'acted+closed', expected: 'acted+closed' })
  expectValue('cancel makes no destroy or quarantine mutation', mockState.destroyCalls.length + mockState.quarantineCalls.length, 0)
  expectValue('no shipment mutation was made', mockState.shipCalls.length, 0)
  expectValue('no uncaught page exception', cdp.pageErrors.length, 0)
}

async function runDestroyA11y() {
  await cdp.send('Page.navigate', { url: `${webUrl}/inventory` })
  await cdp.waitFor(`document.querySelector('[data-testid="inventory-destroy-open"]')`)
  await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-open"]').click(); true`)
  await cdp.waitFor(`document.querySelector('[role="dialog"] h3')?.textContent === '销毁登记'`)
  expectValue('destroy dialog has an accessible name', await cdp.eval(`document.querySelector('[role="dialog"]')?.getAttribute('aria-label')`), '销毁登记')
  await cdp.eval(`document.querySelector('[data-testid="inventory-destroy-cancel"]').click(); true`)
  await cdp.waitFor(`document.querySelectorAll('[role="dialog"]').length === 0`)
  expectValue('accessible-name check makes no destroy mutation', mockState.destroyCalls.length, 0)
}

async function main() {
  let exitCode = 0
  let result
  try {
    mkdirSync(SHOT_DIR, { recursive: true })
    const apiPort = await startApi()
    await startVite(apiPort)
    await startBrowser()
    if (SCENARIO === 'dead') await runDeadOrder()
    else if (SCENARIO === 'destroy') await runDestroy()
    else if (SCENARIO === 'destroy-a11y') await runDestroyA11y()
    else throw new Error(`Unknown scenario: ${SCENARIO}`)
    result = { phase: PHASE, scenario: SCENARIO, ok: true, mockOnly: true, hit: false }
  } catch (error) {
    result = {
      phase: PHASE,
      scenario: SCENARIO,
      ok: false,
      mockOnly: true,
      hit: false,
      failure: error instanceof Expectation ? error.message : null,
      error: error instanceof Expectation ? null : (error?.stack ?? String(error)),
    }
    exitCode = error instanceof Expectation ? 1 : 2
  } finally {
    writeFileSync(join(HERE, `${PHASE}-${SCENARIO}-result.json`), JSON.stringify({ ...result, checks, ...mockState, screenshots: SHOT_DIR }, null, 2))
    writeFileSync(join(HERE, `${PHASE}-${SCENARIO}-vite.log`), viteLog)
    cleanup()
  }
  process.exit(exitCode)
}

if (process.env.PD93_SERVER_ONLY === '1') {
  try {
    const apiPort = await startApi()
    await startVite(apiPort)
    console.log(`PD93 mock ready: ${webUrl}`)
  } catch (error) {
    console.error(error)
    process.exit(2)
  }
} else {
  await main()
}
