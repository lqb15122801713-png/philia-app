#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9241)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-n10')
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
const profileDir = join(tmpdir(), `philia-aesthetic-n10-${process.pid}`)

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
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp, customer.id)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navigate(cdp, '/member/open', `document.querySelectorAll('.m2-deck .cf-claim').length > 0`)
  await cdp.eval(`document.querySelector('.m2-deck .cf-claim').scrollIntoView({ block: 'center' })`)
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => ({
    claims: [...document.querySelectorAll('.m2-deck .m2-cardface')].filter((card) => card.querySelector('.cf-claim')).map((card) => {
      const claim = card.querySelector('.cf-claim')
      const claimRect = claim.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      return {
        text: claim.textContent,
        fontSize: Number.parseFloat(getComputedStyle(claim).fontSize),
        claimRect: { left: claimRect.left, top: claimRect.top, right: claimRect.right, bottom: claimRect.bottom },
        cardRect: { top: cardRect.top, bottom: cardRect.bottom, height: cardRect.height },
        withinCard: claimRect.top >= cardRect.top && claimRect.bottom <= cardRect.bottom,
      }
    }),
  }))())`))
  const minFont = Math.min(...measurements.claims.map((item) => item.fontSize))
  const allWithin = measurements.claims.every((item) => item.withinCard)
  const ok = measurements.claims.length > 0 && minFont >= 12 && allWithin
  record('N10 会员开通卡面 cf-claim 副标 ≥12px 且不溢出', ok, `副标=${measurements.claims.length} 处；最小字号=${minFont}px；均在卡内=${allWithin}`, measurements)
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-n10-member-open.png`), Buffer.from(image.data, 'base64'))
  await navigate(cdp, '/member', `document.querySelectorAll('.m2-cardface .cf-claim').length > 0`)
  const shared = JSON.parse(await cdp.eval(`JSON.stringify((() => ({
    claims: [...document.querySelectorAll('.m2-cardface .cf-claim')].map((claim) => {
      const card = claim.closest('.m2-cardface')
      const claimRect = claim.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      return {
        text: claim.textContent,
        fontSize: Number.parseFloat(getComputedStyle(claim).fontSize),
        withinCard: claimRect.top >= cardRect.top && claimRect.bottom <= cardRect.bottom,
      }
    }),
  }))())`))
  const sharedOk = shared.claims.length > 0 && shared.claims.every((item) => item.fontSize === 11 && item.withinCard)
  record('N10 范围外持有卡副标保持 11px', sharedOk, `副标=${shared.claims.length} 处；字号=${[...new Set(shared.claims.map((item) => item.fontSize))].join('/')}px`, shared)
  const sharedImage = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-n10-member-center.png`), Buffer.from(sharedImage.data, 'base64'))
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
