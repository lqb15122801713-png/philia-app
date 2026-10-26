import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import superjson from 'superjson'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const DIST = join(ROOT, 'apps', 'merchant', 'dist')
const PHASE = process.env.PD96_PHASE ?? 'after'
const ROLE = process.env.PD96_ROLE ?? 'manager'
if (!['manager', 'owner'].includes(ROLE)) throw new Error(`Invalid PD96_ROLE: ${ROLE}`)
const SHOT_DIR = join(HERE, 'shots', PHASE, ROLE)
const STORE_ID = 'pd96-mock-store'
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const store = {
  id: STORE_ID,
  name: '敏慧门店（Mock）',
  storeType: 'store',
  hqId: STORE_ID,
  status: 'active',
  groupName: null,
}
const mockState = { closeCalls: [], reopenCalls: [], cloneCalls: [], stores: [store] }
const checks = []
let server = null
let browser = null
let cdp = null
let webUrl = ''
let cleaned = false

const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8')
const bundleName = /\/assets\/(index-[^"]+\.js)/.exec(indexHtml)?.[1] ?? null
if (!bundleName) throw new Error('merchant dist bundle not found')
const bundleBytes = readFileSync(join(DIST, 'assets', bundleName))
const bundle = {
  name: bundleName,
  size: bundleBytes.length,
  sha256: createHash('sha256').update(bundleBytes).digest('hex'),
}

function dataFor(procedure) {
  switch (procedure) {
    case 'auth.me': {
      const owner = ROLE === 'owner'
      return {
        user: {
          id: `pd96-mock-${ROLE}`,
          nickname: owner ? '敏慧店主（Mock）' : '敏慧店长（Mock）',
          activePetId: null,
          storeId: STORE_ID,
        },
        roles: [owner ? 'merchant_owner' : 'merchant_manager'],
        staff: owner ? null : { id: 'pd96-mock-manager-staff', storeId: STORE_ID, role: 'frontdesk' },
        store,
      }
    }
    case 'store.listMine':
      return { stores: [store] }
    case 'stock2.approvalPendingCount':
      return { count: 0 }
    case 'collab.selfCheck.listPending':
      return { runs: [] }
    case 'report.listMetricAppeals':
      return { pending: [] }
    case 'push.unreadCount':
      return { total: 0, byCategory: {} }
    case 'push.subscribe':
      return { ok: true }
    case 'config.activeCopyTexts':
      return { rows: [] }
    case 'slotPort.liveMap':
      return { slots: [] }
    default:
      return {}
  }
}

async function freePort() {
  const probe = createNetServer()
  await new Promise((resolveListen, rejectListen) => {
    probe.once('error', rejectListen)
    probe.listen(0, '127.0.0.1', resolveListen)
  })
  const port = probe.address().port
  await new Promise((resolveClose) => probe.close(resolveClose))
  return port
}

function contentType(path) {
  const ext = extname(path)
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json' || ext === '.webmanifest') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.woff2') return 'font/woff2'
  return 'application/octet-stream'
}

async function startServer() {
  const port = await freePort()
  webUrl = `http://127.0.0.1:${port}`
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', webUrl)
    if (url.pathname === '/__mock/state') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(mockState))
      return
    }
    if (url.pathname === '/api/events') {
      res.writeHead(204)
      res.end()
      return
    }
    if (url.pathname.startsWith('/trpc/')) {
      let body = ''
      for await (const chunk of req) body += chunk
      const procedures = url.pathname.slice('/trpc/'.length).split(',').map((name) => decodeURIComponent(name))
      const rawInput = url.searchParams.get('input')
      const parsedInput = rawInput ? JSON.parse(rawInput) : (body ? JSON.parse(body) : null)
      const rows = procedures.map((procedure, index) => {
        const input = parsedInput?.[index]?.json ?? parsedInput?.json ?? null
        const attempt = { procedure, input, method: req.method, at: new Date().toISOString() }
        if (procedure === 'store.closeStore') mockState.closeCalls.push(attempt)
        if (procedure === 'store.reopenStore') mockState.reopenCalls.push(attempt)
        if (procedure === 'store.cloneStore') mockState.cloneCalls.push(attempt)
        if (['store.closeStore', 'store.reopenStore', 'store.cloneStore'].includes(procedure)) {
          return { error: { json: { message: `PD96 mock blocked ${procedure}`, code: -32603, data: { code: 'FORBIDDEN', httpStatus: 403 } } } }
        }
        return { result: { data: superjson.serialize(dataFor(procedure)) } }
      })
      res.writeHead(rows.some((row) => row.error) ? 403 : 200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(url.searchParams.get('batch') === '1' ? rows : rows[0]))
      return
    }
    const requested = decodeURIComponent(url.pathname)
    const candidate = resolve(DIST, `.${requested}`)
    const safe = candidate.startsWith(`${resolve(DIST)}${sep}`)
    const file = safe && existsSync(candidate) && !candidate.endsWith(sep) ? candidate : join(DIST, 'index.html')
    try {
      const bytes = readFileSync(file)
      res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' })
      res.end(bytes)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, '127.0.0.1', resolveListen)
  })
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

  async waitFor(expression, timeoutMs = 12000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (await this.eval(`Boolean(${expression})`)) return
      await sleep(100)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async click(expression) {
    const rect = await this.eval(`(() => {
      const element = (${expression})
      if (!element) return null
      element.scrollIntoView({ block: 'center', inline: 'center' })
      const r = element.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    if (!rect) throw new Error(`Click target not found: ${expression}`)
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...rect, button: 'left', clickCount: 1 })
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rect, button: 'left', clickCount: 1 })
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
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].find((path) => existsSync(path))
  if (!executable) throw new Error('Edge/Chrome not found')
  const cdpPort = await freePort()
  const profileDir = join(tmpdir(), `philia-pd96-${ROLE}-${process.pid}`)
  let browserLog = ''
  browser = spawn(executable, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    '--window-size=1440,1000',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  browser.stdout.on('data', (chunk) => { browserLog += chunk })
  browser.stderr.on('data', (chunk) => { browserLog += chunk })
  browser.once('exit', () => {
    try { rmSync(profileDir, { recursive: true, force: true }) } catch {}
  })
  let lastHandshakeError = ''
  for (let attempt = 0; attempt < 80; attempt += 1) {
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

async function cleanup() {
  if (cleaned) return
  cleaned = true
  if (cdp) await Promise.race([cdp.send('Browser.close').catch(() => {}), sleep(1000)])
  cdp?.close()
  server?.close()
}
process.on('exit', () => {
  cdp?.close()
  server?.close()
})
process.on('SIGINT', () => {
  void cleanup().finally(() => process.exit(2))
})

class Expectation extends Error {}
function expectValue(name, actual, expected) {
  const pass = Object.is(actual, expected)
  checks.push({ name, pass, actual, expected })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`)
  if (!pass) throw new Expectation(name)
}

async function runScenario() {
  await cdp.send('Page.navigate', { url: `${webUrl}/matrix` })
  await cdp.waitFor(`document.querySelector('[data-testid="matrix-page"]') && document.querySelector('[data-testid="merchant-rail"]')`)
  expectValue('scenario starts outside HQ', await cdp.eval('location.pathname'), '/matrix')
  await cdp.shot('01-rail-before-navigation')
  expectValue('HQ_SIDEBAR_ENTRY_NOT_SEEN', await cdp.eval(`Boolean(document.querySelector('[data-testid="rail-hq-console"]'))`), true)
  expectValue('sidebar HQ entry has a visible native link', await cdp.eval(`(() => {
    const link = document.querySelector('[data-testid="rail-hq-console"]')
    if (!link) return false
    const r = link.getBoundingClientRect()
    const style = getComputedStyle(link)
    return link.tagName === 'A' && link.getAttribute('href') === '/hq' && r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  })()`), true)
  await cdp.click(`document.querySelector('[data-testid="rail-hq-console"]')`)
  await cdp.waitFor(`location.pathname === '/hq' && document.querySelector('[data-testid="hq-page"]')`)
  expectValue('sidebar click reaches HQ', await cdp.eval('location.pathname'), '/hq')
  expectValue('HQ close CTA remains visible after sidebar navigation', await cdp.eval(`Boolean(document.querySelector('[data-testid="hq-close-open-${STORE_ID}"]'))`), true)
  await cdp.shot('02-hq-via-sidebar')

  await cdp.click(`document.querySelector('[data-testid="hq-close-open-${STORE_ID}"]')`)
  await cdp.waitFor(`document.querySelector('[data-testid="hq-close-modal"]')`)
  expectValue('existing close confirmation opens', await cdp.eval(`document.querySelectorAll('[role="dialog"]').length`), 1)
  expectValue('opening confirmation does not close the store', mockState.closeCalls.length, 0)
  expectValue('final close remains blocked before acknowledgement', await cdp.eval(`document.querySelector('[data-testid="hq-close-submit"]')?.disabled`), true)
  await cdp.shot('03-close-confirmation')

  await cdp.click(`document.querySelector('[data-testid="hq-close-cancel"]')`)
  await cdp.waitFor(`document.querySelectorAll('[role="dialog"]').length === 0`)
  checks.push({ name: 'cancel acted and closed the confirmation layer', pass: true, actual: 'acted+closed', expected: 'acted+closed' })
  console.log('PASS cancel acted and closed the confirmation layer')
  await cdp.shot('04-after-cancel')
  expectValue('cancel makes no close mutation', mockState.closeCalls.length, 0)
  expectValue('no close, reopen, or clone mutation occurred', mockState.closeCalls.length + mockState.reopenCalls.length + mockState.cloneCalls.length, 0)
  const finalState = await cdp.eval(`fetch('/__mock/state').then((response) => response.json())`)
  expectValue('the same store remains active', finalState.stores.find((row) => row.id === STORE_ID)?.status, 'active')
  expectValue('no second store was created', finalState.stores.length, 1)
  expectValue('no uncaught page exception', cdp.pageErrors.length, 0)
}

if (process.env.PD96_SERVER_ONLY === '1') {
  await startServer()
  console.log(`PD96 mock ready: ${webUrl}`)
} else {
  let exitCode = 0
  let result
  try {
    mkdirSync(SHOT_DIR, { recursive: true })
    await startServer()
    await startBrowser()
    await runScenario()
    result = { phase: PHASE, role: ROLE, ok: true, mockOnly: true, hit: false, entryPath: '/matrix', destinationPath: '/hq', bundle }
  } catch (error) {
    result = {
      phase: PHASE,
      role: ROLE,
      ok: false,
      mockOnly: true,
      hit: false,
      entryPath: '/matrix',
      destinationPath: '/hq',
      bundle,
      failure: error instanceof Expectation ? error.message : null,
      error: error instanceof Expectation ? null : (error?.stack ?? String(error)),
    }
    exitCode = error instanceof Expectation ? 1 : 2
  } finally {
    writeFileSync(join(HERE, `${PHASE}-${ROLE}-result.json`), JSON.stringify({ ...result, checks, closeCalls: mockState.closeCalls, reopenCalls: mockState.reopenCalls, cloneCalls: mockState.cloneCalls, screenshots: SHOT_DIR }, null, 2))
    await cleanup()
  }
  process.exit(exitCode)
}
