#!/usr/bin/env node
// PD-43.1 · U4 杂志／商城触控高≥44 实测闸：逐枚读取 getBoundingClientRect().height，
// 阈值 ≥44px。M1 杂志 lead CTA／M2 会员码 Link／M3 页头购物袋 CartLink／M4 商城 hero CTA。
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7100').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9261)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'after'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'pd43-1-touch-44')
const BROWSER = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((p) => existsSync(p))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = []
let browser = null
const profileDir = join(tmpdir(), `philia-pd43-1-${process.pid}`)

function record(id, ok, detail, state = undefined) {
  results.push({ id, ok, detail, state })
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
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
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

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  const ready = await cdp.waitFor(readyExpression, 30000)
  if (!ready) {
    const text = await cdp.eval(`(document.body?.innerText ?? '').slice(0, 200)`).catch(() => '')
    throw new Error(`页面未就绪：${path}；body=${JSON.stringify(text)}`)
  }
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

const measure = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)})
  return el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : null
})()`

async function checkMagazine(cdp) {
  await navigate(cdp, '/philia', `!!document.querySelector('[data-testid="philia-member-strip"]')`)
  await sleep(500)
  const m1 = await cdp.eval(measure('[data-testid="philia-mag-lead-cta"]'))
  const m2 = await cdp.eval(measure('[data-testid="philia-member-strip"] a[href="/me/card"]'))
  record('M1 杂志「去预约同款洗护」触控高≥44', m1 !== null && m1 >= 44, `实测=${m1 === null ? '缺元素' : `${m1}px`}`, { m1 })
  record('M2 杂志「会员码」触控高≥44', m2 !== null && m2 >= 44, `实测=${m2 === null ? '缺元素' : `${m2}px`}`, { m2 })
  await shot(cdp, 'philia')
}

async function checkMall(cdp) {
  await navigate(cdp, '/mall', `!!document.querySelector('[data-testid="mall-hero"]')`)
  await sleep(500)
  const m3 = await cdp.eval(measure('a[href="/mall/cart"]'))
  const m4 = await cdp.eval(measure('[data-testid="mall-hero-cta"]'))
  record('M3 商城页头「购物袋」触控高≥44', m3 !== null && m3 >= 44, `实测=${m3 === null ? '缺元素' : `${m3}px`}`, { m3 })
  record('M4 商城 hero「去逛逛」触控高≥44', m4 !== null && m4 >= 44, `实测=${m4 === null ? '缺元素' : `${m4}px`}`, { m4 })
  await shot(cdp, 'mall')
}

const checks = [checkMagazine, checkMall]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  for (const check of checks) await check(cdp)
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
