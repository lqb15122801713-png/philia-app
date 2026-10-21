#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7100').replace(/\/$/, '')
const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://127.0.0.1:7101').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const DB_URL = process.env.PHILIA_DB_URL ?? `file:${resolve('server/data/pd59-b720-opinion.db').replaceAll('\\', '/')}`
const CDP_PORT = Number(process.env.CDP_PORT ?? 9659)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'pd59-b720-opinion')
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
const profileDir = join(tmpdir(), `philia-pd59-b720-${process.pid}`)
let browser = null

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

function fixture(mode) {
  if (!DB_URL.startsWith('file:') || !DB_URL.includes('pd59-b720-opinion')) {
    throw new Error(`拒绝在非 PD-59 专用夹具库上写数据：${DB_URL}`)
  }
  const code = `(async()=>{
    const { db, schema, client } = await import('./server/src/db/index.ts')
    const users = await db.select().from(schema.users)
    const stores = await db.select().from(schema.stores)
    const pets = await db.select().from(schema.pets)
    const services = await db.select().from(schema.services)
    const user = users.find((row) => row.kimiId === 'seed_kimi_customer')
    const store = stores[0]
    const pet = pets.find((row) => row.ownerId === user?.id)
    const service = services.find((row) => row.storeId === store?.id && row.type === 'grooming')
    if (!user || !store || !pet || !service) throw new Error('PD-59 种子夹具缺失')
    const appointmentId = 'pd59_b720_opinion_appointment'
    await client.execute({ sql: 'DELETE FROM appointment_steps WHERE appointment_id = ?', args: [appointmentId] })
    await client.execute({ sql: 'DELETE FROM appointments WHERE id = ?', args: [appointmentId] })
    if (${JSON.stringify(mode)} === 'cleanup') { client.close(); return }
    const now = new Date()
    await db.insert(schema.appointments).values({
      id: appointmentId,
      code: 'PD5901',
      customerId: user.id,
      storeId: store.id,
      petId: pet.id,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: now,
      scheduledEnd: new Date(now.getTime() + 90 * 60 * 1000),
      status: ${JSON.stringify(mode)} === 'service' ? 'in_service' : 'pending',
      priceFen: service.priceFen,
      paymentMode: 'pay_at_store',
      checkedInAt: ${JSON.stringify(mode)} === 'service' ? now : null,
      note: 'PD-59 本地页面夹具',
      createdAt: now,
      updatedAt: now,
    })
    if (${JSON.stringify(mode)} === 'service') {
      const keys = ['disinfection', 'precheck', 'grooming', 'detail', 'before_after', 'confirm']
      await db.insert(schema.appointmentSteps).values(keys.map((stepKey, index) => ({
        id: 'pd59_b720_opinion_step_' + (index + 1),
        appointmentId,
        stepKey,
        stepOrder: index + 1,
        status: index < 2 ? 'done' : index === 2 ? 'active' : 'locked',
        requiredPhotos: [1, 2, 3, 2, 2, 0][index],
        startedAt: index <= 2 ? now : null,
        doneAt: index < 2 ? now : null,
        createdAt: now,
        updatedAt: now,
      })))
    }
    client.close()
  })()`
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
      if (!message.id || !this.pending.has(message.id)) return
      const pending = this.pending.get(message.id)
      this.pending.delete(message.id)
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result)
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
      return
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
      await sleep(250)
    }
    await sleep(250)
  }
  throw new Error(`CDP 端口 ${CDP_PORT} 未就绪`)
}

function cleanup() {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' })
  browser = null
  try {
    rmSync(profileDir, { recursive: true, force: true })
  } catch {
    return
  }
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(2))

async function navigate(cdp, base, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${base}${path}` })
  if (!await cdp.waitFor(readyExpression, 30000)) {
    const text = await cdp.eval(`(document.body?.innerText ?? '').slice(0, 300)`).catch(() => '')
    throw new Error(`页面未就绪：${base}${path}；正文=${text}`)
  }
  await sleep(1000)
}

async function login(cdp, base, role) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const user = users.find((item) => item.roles?.includes(role))
  if (!user?.id) throw new Error(`种子用户缺失：${role}`)
  await cdp.send('Page.navigate', { url: `${base}/dev-login` })
  await cdp.waitFor(`(document.body?.innerText ?? '').includes('登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: ${JSON.stringify(user.id)} }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`${role} dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

const HOME_PROBE = `JSON.stringify((() => {
  const visible = (el) => {
    if (!el) return false
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }
  const actions = [...document.querySelectorAll('[data-testid="home-banner-cta"], [data-testid="home-service-pickup"]')].filter(visible).map((el) => {
    const style = getComputedStyle(el)
    const parts = style.backgroundColor.match(/[\\d.]+/g)?.map(Number) ?? []
    const alpha = parts.length === 4 ? parts[3] : 1
    return {
      id: el.dataset.testid,
      background: style.backgroundColor,
      color: style.color,
      height: el.getBoundingClientRect().height,
      filled: alpha > 0,
    }
  })
  const serviceEntries = [...document.querySelectorAll('[data-testid="home-primary-grooming"], [data-testid="home-primary-boarding"], [data-testid="home-primary-mall"]')].filter(visible).map((el) => {
    const style = getComputedStyle(el)
    return {
      id: el.dataset.testid,
      background: style.backgroundColor,
      borderRadius: style.borderRadius,
      height: el.getBoundingClientRect().height,
    }
  })
  return {
    primaryIds: actions.filter((item) => item.filled).map((item) => item.id),
    actions,
    serviceEntries,
    serviceProgress: !!document.querySelector('[data-testid="home-service-progress"]'),
  }
})())`

const MERCHANT_PROBE = `JSON.stringify((() => {
  const targets = [...document.querySelectorAll('[data-testid="dash-alert"] .go')].filter((el) => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }).map((el) => {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return {
      text: el.textContent?.trim(),
      tag: el.tagName,
      height: rect.height,
      width: rect.width,
      decoration: style.textDecorationLine,
      display: style.display,
      background: style.backgroundColor,
    }
  })
  return { targets }
})())`

function secondaryServicesOk(data) {
  const expected = ['home-primary-grooming', 'home-primary-boarding', 'home-primary-mall']
  return data.serviceEntries.length === expected.length && expected.every((id) => {
    const entry = data.serviceEntries.find((item) => item.id === id)
    return entry?.background === 'rgb(255, 255, 255)' && entry.borderRadius === '16px'
  })
}

async function main() {
  if (!DB_URL.includes('pd59-b720-opinion')) throw new Error('PHILIA_DB_URL 必须指向 PD-59 专用库')
  mkdirSync(OUT_DIR, { recursive: true })
  fixture('idle')
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()

  await login(cdp, MERCHANT_URL, 'merchant_owner')
  await navigate(cdp, MERCHANT_URL, '/dashboard', `!!document.querySelector('[data-testid="wsk-alert-pending"] .go')`)
  const merchant = JSON.parse(await cdp.eval(MERCHANT_PROBE))
  const merchantOk = merchant.targets.length > 0 && merchant.targets.every((item) => item.height >= 44 && item.decoration === 'none')
  record('B-7202 待办去处理为 ≥44px 按钮', merchantOk, merchant.targets.map((item) => `${item.text}:${item.height}px/${item.decoration}`).join('；') || '无目标', merchant.targets)
  await shot(cdp, 'merchant-todo')

  await login(cdp, CUSTOMER_URL, 'customer')
  await navigate(cdp, CUSTOMER_URL, '/home?pd59=idle', `!!document.querySelector('[data-testid="home-primary-actions"]')`)
  const idle = JSON.parse(await cdp.eval(HOME_PROBE))
  const idleOk = !idle.serviceProgress && idle.primaryIds.length === 1 && idle.primaryIds[0] === 'home-banner-cta' && secondaryServicesOk(idle)
  record('B-7201 无进行中预约时 hero 单一主操作', idleOk, `primary=${idle.primaryIds.join(',') || 0}；serviceSecondary=${secondaryServicesOk(idle)}`, idle)
  await shot(cdp, 'home-idle')

  fixture('service')
  await navigate(cdp, CUSTOMER_URL, '/home?pd59=service', `!!document.querySelector('[data-testid="home-service-progress"]')`)
  const service = JSON.parse(await cdp.eval(HOME_PROBE))
  const serviceOk = service.serviceProgress && service.primaryIds.length === 1 && service.primaryIds[0] === 'home-service-pickup' && secondaryServicesOk(service)
  record('B-7201 有进行中预约时状态卡单一主操作', serviceOk, `primary=${service.primaryIds.join(',') || 0}；serviceSecondary=${secondaryServicesOk(service)}`, service)
  await shot(cdp, 'home-service')

  cdp.close()
  fixture('cleanup')
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), customer: CUSTOMER_URL, merchant: MERCHANT_URL, results }, null, 2))
  if (results.length !== 3) {
    console.error(`检查数不符：期望 3，实际 ${results.length}`)
    process.exit(2)
  }
  const failures = results.filter((item) => !item.ok).length
  console.log(`汇总：${results.length - failures}/${results.length} 通过；证据目录=${OUT_DIR}`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  try {
    fixture('cleanup')
  } catch (cleanupError) {
    console.error(`夹具清理失败：${cleanupError?.message ?? cleanupError}`)
  }
  process.exit(2)
})
