#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9242)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-n11n12')
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
const profileDir = join(tmpdir(), `philia-aesthetic-n11n12-${process.pid}`)

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

const DB_URL = process.env.PHILIA_DB_URL ?? 'file:server/data/aesthetic-fix-n11n12.db'

function prepareMemberFixture(userId) {
  if (!DB_URL.startsWith('file:') || !DB_URL.includes('aesthetic-fix-n11n12')) {
    throw new Error(`拒绝在非 PD-38 专用夹具库上写数据：${DB_URL}`)
  }
  const now = Date.now()
  const sql = `INSERT INTO memberships (id, user_id, plan_key, started_at, expires_at, status, pet_count, paid_fen, created_at, updated_at)
    SELECT ?, ?, 'plan_weiguang', ?, ?, 'active', 0, 0, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = ?)`
  const args = ['01M56K1YPD38N11N12MEMBER01', userId, now, 4102444799000, now, now, userId]
  const code = `(async()=>{ const { client } = await import('./server/src/db/index.ts'); await client.execute({ sql: ${JSON.stringify(sql)}, args: ${JSON.stringify(args)} }); client.close(); })()`
  execFileSync(process.execPath, ['server/node_modules/tsx/dist/cli.mjs', '-e', code], {
    cwd: process.cwd(),
    env: { ...process.env, PHILIA_DB_URL: DB_URL },
    stdio: 'inherit',
  })
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

async function main() {
  const seedResponse = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  const customer = (await seedResponse.json())?.users?.find((user) => user.roles?.includes('customer'))
  if (!customer?.id) throw new Error('种子客户缺失')
  prepareMemberFixture(customer.id)
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp, customer.id)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-entry-grooming"] .s') && !!document.querySelector('[data-testid="home-rebate-guide"] .cap')`)
  await cdp.eval(`document.querySelector('[data-testid="home-entry-card"]').scrollIntoView({ block: 'center' })`)
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const rectOf = (el) => {
      const rect = el.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
    }
    const services = ['home-entry-grooming', 'home-entry-boarding'].map((id) => {
      const el = document.querySelector('[data-testid="' + id + '"] .s')
      return { id, text: el.textContent, fontSize: Number.parseFloat(getComputedStyle(el).fontSize), rect: rectOf(el) }
    })
    const rebateEl = document.querySelector('[data-testid="home-rebate-guide"] .cap')
    return {
      services,
      rebate: { text: rebateEl.textContent, fontSize: Number.parseFloat(getComputedStyle(rebateEl).fontSize), rect: rectOf(rebateEl) },
    }
  })())`))
  const minServiceFont = Math.min(...measurements.services.map((item) => item.fontSize))
  const n11Ok = measurements.services.length === 2 && minServiceFont >= 12 && measurements.services.every((item) => item.text.includes('起'))
  record('N11 首页双栏服务副文 ≥12px', n11Ok, `双栏=${measurements.services.length}；最小字号=${minServiceFont}px`, measurements.services)
  const n12Ok = measurements.rebate.fontSize >= 12 && measurements.rebate.text.includes('余额') && measurements.rebate.text.includes('到账')
  record('N12 首页回馈金账本副文 ≥12px', n12Ok, `字号=${measurements.rebate.fontSize}px；文案=${measurements.rebate.text}`, measurements.rebate)
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-n11n12-home.png`), Buffer.from(image.data, 'base64'))
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: CUSTOMER_URL, results }, null, 2))
  if (results.length !== 2) {
    console.error(`检查数不符：期望 2，实际 ${results.length}；拒绝空跑假绿`)
    process.exit(2)
  }
  const passed = results.filter((item) => item.ok).length
  console.log(`汇总：${passed}/${results.length} 通过；证据目录=${OUT_DIR}`)
  process.exit(passed === 2 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
