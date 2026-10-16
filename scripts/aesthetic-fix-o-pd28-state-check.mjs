#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = 'E:/KIMI code/aesthetic-fix-b1b5'
const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9230)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'state-final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-o-pd28')
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
const profileDir = join(tmpdir(), `philia-pd28-state-${process.pid}`)

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
    await this.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await this.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: CUSTOMER_URL })
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

  async click(selector) {
    const point = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })()`)
    if (!point) throw new Error(`点击目标不存在：${selector}`)
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
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

async function login(cdp, phone = null) {
  let body = { phone }
  if (!phone) {
    const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
    const users = (await response.json())?.users ?? []
    const customer = users.find((user) => user.nickname === '示例客户')
    if (!customer) throw new Error('无种子客户')
    body = { userId: customer.id }
  }
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(${JSON.stringify(body)}), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`dev-login HTTP ${status}`)
}

async function loginRole(cdp, nickname) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  const users = (await response.json())?.users ?? []
  const user = users.find((item) => item.nickname === nickname)
  if (!user) throw new Error(`无种子角色 ${nickname}`)
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`${nickname} dev-login HTTP ${status}`)
}

function cancelMembershipForFixture(phone) {
  const code = `(async()=>{ const { client } = await import('./server/src/db/index.ts'); const user = await client.execute({ sql: 'SELECT id FROM users WHERE phone = ?', args: ['${phone}'] }); if (user.rows.length === 0) throw new Error('fixture user missing'); await client.execute({ sql: 'UPDATE memberships SET status = ? WHERE user_id = ?', args: ['cancelled', user.rows[0].id] }); client.close(); })()`
  execFileSync(process.execPath, ['server/node_modules/tsx/dist/cli.mjs', '-e', code], {
    cwd: ROOT,
    env: { ...process.env, PHILIA_DB_URL: 'file:server/data/aesthetic-fix-o-pd28.db' },
  })
}

function setRebateBalanceForFixture(phone, balanceFen) {
  const code = `(async()=>{ const { client } = await import('./server/src/db/index.ts'); const user = await client.execute({ sql: 'SELECT id FROM users WHERE phone = ?', args: ['${phone}'] }); if (user.rows.length === 0) throw new Error('fixture user missing'); await client.execute({ sql: 'UPDATE rebate_accounts SET balance_fen = ? WHERE user_id = ?', args: [${balanceFen}, user.rows[0].id] }); client.close(); })()`
  execFileSync(process.execPath, ['server/node_modules/tsx/dist/cli.mjs', '-e', code], {
    cwd: ROOT,
    env: { ...process.env, PHILIA_DB_URL: 'file:server/data/aesthetic-fix-o-pd28.db' },
  })
}

async function trpcQuery(cdp, path, input = null) {
  const encoded = encodeURIComponent(JSON.stringify({ 0: { json: input } }))
  const result = await cdp.eval(`fetch('${API_BASE}/trpc/${path}?batch=1&input=${encoded}', { credentials: 'include' }).then((res) => res.json())`)
  if (result?.[0]?.error) throw new Error(JSON.stringify(result[0].error))
  return result?.[0]?.result?.data?.json
}

async function trpcMutation(cdp, path, input = {}) {
  const result = await cdp.eval(`fetch('${API_BASE}/trpc/${path}?batch=1', {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ 0: { json: ${JSON.stringify(input)} } }),
  }).then((res) => res.json())`)
  if (result?.[0]?.error) throw new Error(JSON.stringify(result[0].error))
  return result?.[0]?.result?.data?.json
}

async function checkO1MemoryAndService(cdp) {
  await login(cdp, '19900000228')
  const { pet } = await trpcMutation(cdp, 'pet.upsert', { name: '测试毛孩', species: 'dog' })
  const store = (await trpcQuery(cdp, 'store.listNearby', {}))?.stores?.[0]
  const detail = await trpcQuery(cdp, 'store.getWithServices', { storeId: store.id, petId: pet.id })
  const service = detail?.services?.find((item) => item.type === 'grooming')
  await cdp.eval(`localStorage.setItem('philia:lastBooking', ${JSON.stringify(JSON.stringify({ storeId: store.id, serviceId: service.id, petId: pet.id }))})`)
  const before = await trpcQuery(cdp, 'appointment.listMine')
  const beforeCount = Object.values(before.groups).flat().length
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-rebook-panel"]')`)
  const href = await cdp.eval(`document.querySelector('[data-testid="home-rebook-cta"]').getAttribute('href')`)
  await cdp.click('[data-testid="home-rebook-cta"]')
  await cdp.waitFor(`location.pathname === '/appointments'`)
  const after = await trpcQuery(cdp, 'appointment.listMine')
  const afterCount = Object.values(after.groups).flat().length
  const ok = href === '/appointments' && beforeCount === afterCount
  record('O1 记忆态主行动只进进度且零新建预约', ok, `href=${href}；预约数 ${beforeCount} → ${afterCount}`)
  await shot(cdp, 'o1-memory-progress')

  await login(cdp)
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-live-card"]')`)
  const servicePanel = await cdp.eval(`!!document.querySelector('[data-testid="home-live-card"]')`)
  record('O1 服务中面板保持原路径', servicePanel, `home-live-card=${servicePanel}`)
  await shot(cdp, 'o1-inservice')
}

async function checkO9Actions(cdp) {
  await login(cdp, '19900000228')
  await navigate(cdp, '/mall', `!!document.querySelector('button[data-testid^="mall-quickadd-"]')`)
  await cdp.click('button[data-testid^="mall-quickadd-"]')
  await navigate(cdp, '/mall/cart', `!!document.querySelector('[data-testid="cart-rebate-hook"]')`)
  await cdp.eval(`document.querySelector('[role="checkbox"][aria-label="全选"][aria-checked="true"]')?.click()`)
  await cdp.click('[data-testid="cart-rebate-hook"]')
  await cdp.waitFor(`location.pathname === '/member/open'`)
  const path = await cdp.eval('location.pathname')
  const ok = path === '/member/open'
  record('O9 空车禁用结算时规则钩仍独立可达', ok, `落点=${path}；未触结算`)
  await shot(cdp, 'o9-hook-independent')

  await loginRole(cdp, '菲丽亚店主')
  const paidPhone = `199${String(Date.now() % 10000000).padStart(7, '0')}2`
  await trpcMutation(cdp, 'membership.sell', {
    phone: paidPhone,
    planKey: 'plan_yinghuo',
    petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  })
  setRebateBalanceForFixture(paidPhone, 500)
  await login(cdp, paidPhone)
  await navigate(cdp, '/mall', `!!document.querySelector('a[href*="/mall/product/"]')`)
  const productPath = await cdp.eval(`document.querySelector('a[href*="/mall/product/"]').getAttribute('href')`)
  await cdp.click('button[data-testid^="mall-quickadd-"]')
  await navigate(cdp, productPath, `!!document.querySelector('[data-testid="mall.rebateEarnCard"], [data-testid="mall.rebateEarnCardNoDay"], [data-testid="pdp-add-cart"]')`)
  const pdpRebate = await cdp.eval(`(document.body?.innerText ?? '').includes('购买返')`)
  await navigate(cdp, '/mall/cart', `!!document.querySelector('[data-testid="cart-rebate-hook"], button')`)
  const cartText = await cdp.eval(`document.body.innerText`)
  const hookCount = await cdp.eval(`document.querySelectorAll('[data-testid="cart-rebate-hook"]').length`)
  const paidOk = pdpRebate && cartText.includes('本单返') && hookCount === 0
  record('O9 付费真实返显保留且不与规则钩重复', paidOk, `PDP购买返=${pdpRebate}；Cart本单返=${cartText.includes('本单返')}；规则钩=${hookCount}`)
  await shot(cdp, 'o9-paid-rebate')

  await navigate(cdp, '/member/rebate', `!!document.querySelector('[data-block-key="w1.ring"]')`)
  const paidRing = await cdp.eval(`document.querySelector('[data-block-key="w1.ring"]').innerText`)
  const ringOk = paidRing.includes('%') && !paidRing.includes('本周期日历')
  record('O13 付费非零环保留周期百分比', ringOk, paidRing.replace(/\n/g, ' / '))
  await shot(cdp, 'o13-paid-ring')
}

async function checkO11ClipboardAndRefresh(cdp) {
  await login(cdp, '19900000228')
  await navigate(cdp, '/me/card', `!!document.querySelector('[data-testid="membercard-token"]')`)
  const oldToken = await cdp.eval(`document.querySelector('[data-testid="membercard-token"]').innerText.replace(/\\s/g, '')`)
  await cdp.click('[data-testid="membercard-copy"]')
  await cdp.waitFor(`(document.querySelector('[data-testid="membercard-copy-status"]')?.innerText ?? '').includes('已复制')`)
  const clipboard = await cdp.eval(`navigator.clipboard.readText()`)
  const contentOk = clipboard === oldToken
  record('O11 剪贴板原文等于当前 token', contentOk, `原文匹配=${contentOk}`)

  await navigate(cdp, '/me', `!!document.querySelector('[data-testid="me-qrrow"]')`)
  await navigate(cdp, '/me/card', `!!document.querySelector('[data-testid="membercard-token"]')`)
  const newToken = await cdp.eval(`document.querySelector('[data-testid="membercard-token"]').innerText.replace(/\\s/g, '')`)
  const statusGone = await cdp.eval(`!document.querySelector('[data-testid="membercard-copy-status"]')`)
  const refreshOk = newToken !== oldToken && statusGone
  record('O11 换码后旧复制状态自动失效', refreshOk, `换码=${newToken !== oldToken}；旧状态隐藏=${statusGone}`)
  await shot(cdp, 'o11-token-refresh')
}

async function checkO13NonMember(cdp) {
  await login(cdp, '19900000230')
  cancelMembershipForFixture('19900000230')
  const my = await trpcQuery(cdp, 'membership.my')
  if (my?.membership) throw new Error('非会员夹具不符：种子客户已有会员')
  await navigate(cdp, '/member/rebate', `!!document.querySelector('[data-block-key="w1.ring"]')`)
  const text = await cdp.eval(`document.querySelector('[data-block-key="w1.ring"]').innerText`)
  const ok = !text.includes('%') && text.includes('本周期日历')
  record('O13 非会员环同样不误读积累百分比', ok, text.replace(/\n/g, ' / '))
  await shot(cdp, 'o13-nonmember-ring')
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await checkO1MemoryAndService(cdp)
  await checkO9Actions(cdp)
  await checkO11ClipboardAndRefresh(cdp)
  await checkO13NonMember(cdp)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
  if (results.length !== 8) {
    console.error(`检查数不符：期望 8，实际 ${results.length}`)
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
