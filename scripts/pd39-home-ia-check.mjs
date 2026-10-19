#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7100').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const DB_URL = process.env.PHILIA_DB_URL ?? `file:${resolve('server/data/pd39-home-ia.db').replaceAll('\\', '/')}`
const CDP_PORT = Number(process.env.CDP_PORT ?? 9251)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'design-upgrade-u1-home')
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
const profileDir = join(tmpdir(), `philia-pd39-home-${process.pid}`)
let browser = null

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

function fixture(mode) {
  if (!DB_URL.startsWith('file:') || !DB_URL.includes('pd39-home-ia')) {
    throw new Error(`拒绝在非 PD-39 专用夹具库上写数据：${DB_URL}`)
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
    if (!user || !store || !pet || !service) throw new Error('PD-39 种子夹具缺失')
    const appointmentId = 'pd39_home_ia_appointment'
    await client.execute({ sql: 'DELETE FROM appointment_steps WHERE appointment_id = ?', args: [appointmentId] })
    await client.execute({ sql: 'DELETE FROM appointments WHERE id = ?', args: [appointmentId] })
    const now = new Date()
    await db.insert(schema.appointments).values({
      id: appointmentId,
      code: 'PD3901',
      customerId: user.id,
      storeId: store.id,
      petId: pet.id,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: now,
      scheduledEnd: new Date(now.getTime() + 90 * 60 * 1000),
      status: ${JSON.stringify(mode)} === 'service' ? 'in_service' : 'confirmed',
      priceFen: service.priceFen,
      paymentMode: 'pay_at_store',
      checkedInAt: ${JSON.stringify(mode)} === 'service' ? now : null,
      note: 'PD-39 本地页面夹具',
      createdAt: now,
      updatedAt: now,
    })
    if (${JSON.stringify(mode)} === 'service') {
      const keys = ['disinfection', 'precheck', 'grooming', 'detail', 'before_after', 'confirm']
      await db.insert(schema.appointmentSteps).values(keys.map((stepKey, index) => ({
        id: 'pd39_home_ia_step_' + (index + 1),
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

async function navigate(cdp, path) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  if (!await cdp.waitFor(`!!document.querySelector('[data-testid="home-page"]')`)) {
    throw new Error(`首页未就绪：${path}`)
  }
  await sleep(1000)
}

async function login(cdp) {
  const seedResponse = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  const customer = (await seedResponse.json())?.users?.find((user) => user.roles?.includes('customer'))
  if (!customer?.id) throw new Error('种子客户缺失')
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}/dev-login` })
  await cdp.waitFor(`(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: ${JSON.stringify(customer.id)} }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

function inspectPageExpression() {
  return `JSON.stringify((() => {
    const one = (id) => document.querySelector('[data-testid="' + id + '"]')
    const all = (id) => [...document.querySelectorAll('[data-testid="' + id + '"]')]
    const link = (id) => ({ text: one(id)?.textContent?.replace(/\\s+/g, ' ').trim() ?? null, href: one(id)?.getAttribute('href') ?? null })
    const orderIds = ['home-banner', 'home-service-progress', 'home-primary-actions', 'home-secondary-actions', 'home-member-strip', 'home-featured', 'home-activities', 'home-stories']
    const order = orderIds.map((id) => ({ id, present: !!one(id), top: one(id)?.getBoundingClientRect().top ?? null }))
    const subFonts = [...document.querySelectorAll('[data-testid="home-page"] .hv2-sub, [data-testid="home-page"] .hv2-new-badge, [data-testid="home-page"] .hv2-image-label')].map((el) => ({
      text: el.textContent?.replace(/\\s+/g, ' ').trim(), size: Number.parseFloat(getComputedStyle(el).fontSize),
    }))
    const dock = one('app-dock')?.firstElementChild?.firstElementChild
    const dockTabs = ['home', 'booking', 'philia', 'mall', 'me'].map((key) => {
      const el = one('app-dock-' + key)
      const rect = el?.getBoundingClientRect()
      return { key, text: el?.textContent?.trim() ?? null, current: el?.getAttribute('aria-current') ?? null, left: rect?.left ?? null, top: rect?.top ?? null, transform: el ? getComputedStyle(el).transform : null }
    })
    const indicator = one('app-dock-home-indicator')
    const textRect = (el, text) => {
      const node = [...(el?.childNodes ?? [])].find((item) => item.textContent?.trim() === text)
      if (!node) return null
      const range = document.createRange()
      range.selectNodeContents(node)
      return range.getBoundingClientRect()
    }
    const pendingRect = textRect(one('home-banner-img'), '待换')
    const subRect = one('home-banner-sub')?.getBoundingClientRect() ?? null
    return {
      order,
      banner: link('home-banner-cta'),
      bannerCtaBottom: one('home-banner-cta')?.getBoundingClientRect().bottom ?? null,
      bannerPending: pendingRect !== null,
      bannerPendingTop: pendingRect?.top ?? null,
      bannerPendingBottom: pendingRect?.bottom ?? null,
      bannerSubTop: subRect?.top ?? null,
      bannerSubBottom: subRect?.bottom ?? null,
      storeChip: one('home-store-chip')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
      primary: ['grooming', 'boarding', 'mall'].map((key) => link('home-primary-' + key)),
      secondary: ['rebate', 'coupons', 'groupbuy', 'store'].map((key) => link('home-secondary-' + key)),
      memberCode: link('home-member-code'),
      memberStrip: !!one('home-member-strip'),
      memberText: one('home-member-strip')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
      featured: all('home-featured-card').length,
      activities: all('home-activity-card').length,
      stories: all('home-story-card').length,
      oldBlocks: ['home-entry-card', 'home-idband', 'home-stats-row', 'home-pets-row'].filter((id) => !!one(id)),
      subFonts,
      dockBackground: dock ? getComputedStyle(dock).backgroundColor : null,
      dockTabs,
      indicator: indicator ? { background: getComputedStyle(indicator).backgroundColor, height: indicator.getBoundingClientRect().height } : null,
      progress: one('home-service-progress')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
      progressTop: one('home-service-progress')?.getBoundingClientRect().top ?? null,
      progressDots: document.querySelectorAll('[data-testid="home-service-progress"] .hv2-progress-dot').length,
      pickup: link('home-service-pickup'),
    }
  })())`
}

function checkIdle(data) {
  const required = ['home-banner', 'home-primary-actions', 'home-secondary-actions', 'home-member-strip', 'home-featured', 'home-activities', 'home-stories']
  const positions = required.map((id) => data.order.find((item) => item.id === id))
  const orderOk = positions.every((item) => item?.present) && positions.every((item, index) => index === 0 || item.top >= positions[index - 1].top)
  record('B5 Banner 季主题、立即预约与门店 chip', data.banner.href === '/booking/grooming' && !!data.banner.text && !!data.storeChip, `CTA=${data.banner.text}/${data.banner.href}；门店=${data.storeChip}`, { banner: data.banner, storeChip: data.storeChip })
  const pendingClear = !data.bannerPending || (typeof data.bannerPendingBottom === 'number' && typeof data.bannerSubTop === 'number' && data.bannerPendingBottom <= data.bannerSubTop) || (typeof data.bannerPendingTop === 'number' && typeof data.bannerSubBottom === 'number' && data.bannerPendingTop >= data.bannerSubBottom)
  record('D1 Banner 待换标不与副文重叠', pendingClear, `待换=${data.bannerPendingTop}~${data.bannerPendingBottom}；副文=${data.bannerSubTop}~${data.bannerSubBottom}`)
  record('B1 三主入口 ×3', data.primary.map((item) => item.href).join('|') === '/booking/grooming|/booking/boarding|/mall', data.primary.map((item) => `${item.text}→${item.href}`).join('；'), data.primary)
  record('C2 四次入口 ×4', data.secondary.length === 4 && data.secondary.every((item) => item.text && item.href?.startsWith('/')), data.secondary.map((item) => `${item.text}→${item.href}`).join('；'), data.secondary)
  record('C1 细会员条与会员码一键', data.memberStrip && data.memberCode.href === '/me/card' && data.memberCode.text === '会员码' && data.memberText?.includes('微光'), `会员条=${data.memberStrip}；会员码=${data.memberCode.text}/${data.memberCode.href}；文本=${data.memberText}`)
  record('B2/B3/B4 精选、活动、守护结构', data.featured >= 2 && data.activities === 3 && data.stories === 2, `精选=${data.featured}；活动=${data.activities}；守护=${data.stories}`)
  record('D2 空闲 IA 固定顺序且旧主轴退出', orderOk && data.oldBlocks.length === 0 && !data.order.find((item) => item.id === 'home-service-progress')?.present, `顺序=${orderOk}；旧块=${data.oldBlocks.join(',') || 0}`, data.order)
  const badFonts = data.subFonts.filter((item) => item.size < 12)
  record('副文 ≥12px', data.subFonts.length > 0 && badFonts.length === 0, `副文=${data.subFonts.length}；低于12px=${badFonts.length}`, badFonts)
  const tabOrderOk = data.dockTabs.every((tab, index) => index === 0 || tab.left > data.dockTabs[index - 1].left)
  const rgb = data.dockBackground?.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
  const lightDock = (rgb[0] + rgb[1] + rgb[2]) / 3 > 180
  const philia = data.dockTabs.find((tab) => tab.key === 'philia')
  record('U0 浅浮岛五栏、顺序与激活短划', lightDock && tabOrderOk && data.dockTabs[0]?.current === 'page' && philia?.transform === 'none' && !!data.indicator && data.indicator.height <= 4, `底=${data.dockBackground}；顺序=${tabOrderOk}；中央transform=${philia?.transform}；短划=${JSON.stringify(data.indicator)}`, { tabs: data.dockTabs, indicator: data.indicator })
}

function checkService(data) {
  const required = ['home-banner', 'home-service-progress', 'home-primary-actions', 'home-secondary-actions', 'home-member-strip', 'home-featured', 'home-activities', 'home-stories']
  const positions = required.map((id) => data.order.find((item) => item.id === id))
  const skeletonOk = positions.every((item) => item?.present) && positions.every((item, index) => index === 0 || item.top >= positions[index - 1].top)
  const liveCopyOk = !!data.progress && data.progress.includes('服务进行中') && !data.progress.includes('LIVE')
  record('B6 服务中首屏进度卡与同骨架', skeletonOk && data.oldBlocks.length === 0 && data.featured >= 2 && data.activities === 3 && data.stories === 2 && liveCopyOk, `同骨架=${skeletonOk}；旧块=${data.oldBlocks.join(',') || 0}；进度=${data.progress}`, data.order)
  record('B6 六步步骤豆与到店领入口', data.progressDots === 6 && data.progress?.includes('3 / 6') && data.pickup.href?.startsWith('/appointments/'), `步骤豆=${data.progressDots}；到店领=${data.pickup.href}；文案=${data.progress}`, { dots: data.progressDots, pickup: data.pickup })
  record('B6 Banner CTA 与进度卡无重叠', typeof data.bannerCtaBottom === 'number' && typeof data.progressTop === 'number' && data.bannerCtaBottom <= data.progressTop, `CTA底=${data.bannerCtaBottom}；进度卡顶=${data.progressTop}`)
}

async function checkDockClicks(cdp) {
  const steps = [
    ['booking', '/booking/grooming'],
    ['philia', '/philia'],
    ['mall', '/mall'],
    ['me', '/me'],
    ['home', '/home'],
  ]
  const seen = []
  for (const [key, path] of steps) {
    await cdp.click(`[data-testid="app-dock-${key}"]`)
    const landed = await cdp.waitFor(`location.pathname === ${JSON.stringify(path)}`)
    const current = landed ? await cdp.eval(`document.querySelector('[data-testid="app-dock-${key}"]')?.getAttribute('aria-current') ?? ''`) : ''
    seen.push(`${key}→${path}/${current || '无激活'}`)
    if (!landed || current !== 'page') return { ok: false, detail: seen.join('；') }
    await sleep(250)
  }
  return { ok: true, detail: seen.join('；') }
}

async function checkGroupbuyLanding(cdp) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}/home?pd39=groupbuy` })
  if (!await cdp.waitFor(`!!document.querySelector('[data-testid="home-secondary-groupbuy"]')`)) return { ok: false, detail: '四次入口未就绪' }
  await cdp.click('[data-testid="home-secondary-groupbuy"]')
  const landed = await cdp.waitFor(`location.pathname === '/mall' && location.search.includes('channel=groupbuy') && (document.body?.innerText ?? '').includes('团购活动待上线')`)
  if (!landed) {
    const missText = await cdp.eval(`(document.body?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 160)`)
    return { ok: false, detail: `团购落点未命中：${missText}` }
  }
  await cdp.click('[data-testid="mall-groupbuy-pending"] a[href="/mall"]')
  const backOk = await cdp.waitFor(`location.pathname === '/mall' && !location.search.includes('channel=groupbuy') && (document.body?.innerText ?? '').includes('本周上新')`)
  const text = await cdp.eval(`(document.body?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 160)`)
  return { ok: backOk && text.includes('本周上新'), detail: `返回后=${text}` }
}

async function main() {
  if (!DB_URL.includes('pd39-home-ia')) throw new Error('PHILIA_DB_URL 必须指向 PD-39 专用库')
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  fixture('idle')
  await navigate(cdp, '/home?pd39=idle')
  const idle = JSON.parse(await cdp.eval(inspectPageExpression()))
  checkIdle(idle)
  await shot(cdp, 'idle')
  const dockClicks = await checkDockClicks(cdp)
  record('U0 五栏实点切换', dockClicks.ok, dockClicks.detail)
  const groupbuy = await checkGroupbuyLanding(cdp)
  record('C2 团购落点诚实可见', groupbuy.ok, groupbuy.detail)
  fixture('service')
  await navigate(cdp, '/home?pd39=service')
  const service = JSON.parse(await cdp.eval(inspectPageExpression()))
  checkService(service)
  await shot(cdp, 'service')
  cdp.close()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: CUSTOMER_URL, results }, null, 2))
  if (results.length !== 14) {
    console.error(`检查数不符：期望 14，实际 ${results.length}`)
    process.exit(2)
  }
  const passed = results.filter((item) => item.ok).length
  console.log(`汇总：${passed}/${results.length} 通过；证据目录=${OUT_DIR}`)
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
