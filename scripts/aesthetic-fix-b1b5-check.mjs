#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9226)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'after'
const SCOPE = process.env.CHECK_SCOPE ?? 'all'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-b1b5')
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
const profileDir = join(tmpdir(), `philia-aesthetic-b1b5-${process.pid}`)

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
  const ready = await cdp.waitFor(readyExpression)
  if (!ready) throw new Error(`页面未就绪：${path}`)
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

const ARTICLE_EXPECTATIONS = {
  lead: { title: '秋日洗护季特刊', body: '换季时，先观察皮肤和被毛状态' },
  '02': { title: '猫咪换季软便怎么办', body: '换粮用七天过渡' },
  '03': { title: '狗狗脚掌护理入门', body: '外出回家先擦干趾缝' },
}

async function magazineState(cdp) {
  return JSON.parse(await cdp.eval(`JSON.stringify({
    path: location.pathname,
    article: !!document.querySelector('[data-testid="magazine-article"]'),
    title: document.querySelector('[data-testid="magazine-article"] h1')?.textContent ?? '',
    text: document.querySelector('[data-testid="magazine-article"]')?.innerText ?? '',
  })`))
}

async function checkMagazineLead(cdp) {
  await navigate(cdp, '/philia', `!!document.querySelector('[data-testid="philia-mag-lead-cta"]')`)
  const before = await cdp.eval('location.pathname')
  await cdp.eval(`document.querySelector('[data-testid="philia-mag-lead-cta"]').click()`)
  await sleep(700)
  const state = await magazineState(cdp)
  const expected = ARTICLE_EXPECTATIONS.lead
  const ok = state.path === '/philia/magazine/lead' && state.article && state.title === expected.title && state.text.includes(expected.body)
  record('D-56 读本期进入本期正文', ok, `path ${before} → ${state.path}；篇题=${state.title}`)
  await shot(cdp, 'd56-magazine-lead')
}

async function checkMagazineEntry(cdp, index) {
  const slug = String(index).padStart(2, '0')
  await navigate(cdp, '/philia', `!!document.querySelector('[data-testid="philia-mag-entry-${index}"]')`)
  const before = await cdp.eval('location.pathname')
  await cdp.eval(`document.querySelector('[data-testid="philia-mag-entry-${index}"]').click()`)
  await sleep(700)
  const state = await magazineState(cdp)
  const expected = ARTICLE_EXPECTATIONS[slug]
  const ok = state.path === `/philia/magazine/${slug}` && state.article && state.title === expected.title && state.text.includes(expected.body)
  record(`D-57 次卡 ${slug} 进入对应篇正文`, ok, `path ${before} → ${state.path}；篇题=${state.title}`)
  await shot(cdp, index === 2 ? 'd57-magazine-entry' : `d57-magazine-entry-${slug}`)
}

async function checkMissingMagazineArticle(cdp) {
  await navigate(cdp, '/philia/magazine/not-a-story', `!!document.querySelector('[data-testid="magazine-article-missing"]')`)
  const state = JSON.parse(await cdp.eval(`JSON.stringify({
    text: document.querySelector('[data-testid="magazine-article-missing"]')?.innerText ?? '',
    exit: document.querySelector('[data-testid="magazine-article-missing"] a[href="/philia"]') !== null,
  })`))
  const ok = state.text.includes('这篇内容还在整理中') && state.exit
  record('D-57 未知篇显示说明与返回出口', ok, `占位=${state.text.includes('这篇内容还在整理中')}；返回出口=${state.exit}`)
  await shot(cdp, 'd57-magazine-missing')
}

async function checkStaffRail(cdp) {
  await navigate(cdp, '/booking/grooming', `[...document.querySelectorAll('button[data-testid^="gs-groomer-"]')].some((el) => el.dataset.testid !== 'gs-groomer-any')`)
  const initialScrollLeft = await cdp.eval(`document.querySelector('[data-testid="gs-groomer-rail"]').scrollLeft`)
  await cdp.eval(`document.querySelector('[data-testid="gs-groomer-rail"]').scrollIntoView({ block: 'center' })`)
  await sleep(700)
  const state = JSON.parse(await cdp.eval(`(() => {
    const rail = document.querySelector('[data-testid="gs-groomer-rail"]')
    const cards = [...rail.querySelectorAll('button[data-testid^="gs-groomer-"]')]
      .filter((el) => el.dataset.testid !== 'gs-groomer-any')
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const lines = el.innerText.trim().split('\\n')
        return { name: lines[1] ?? lines[0], left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      })
    return JSON.stringify({ viewport: innerWidth, height: innerHeight, scrollLeft: rail.scrollLeft, cards })
  })()`))
  const visible = state.cards.filter((card) => card.left >= 0 && card.left < state.viewport && card.right > 0 && card.bottom > 0 && card.top < state.height)
  const firstStartsOnScreen = state.cards.length > 0 && state.cards[0].left >= 0
  const ok = firstStartsOnScreen && visible.length > 0 && Math.abs(initialScrollLeft) < 1 && Math.abs(state.scrollLeft) < 1
  const detail = `scrollLeft ${initialScrollLeft} → ${state.scrollLeft}；${state.cards.map((card) => `${card.name} x=${Math.round(card.left)}`).join('，')}；视口内=${visible.map((card) => card.name).join('/') || '无'}`
  record('D-58 首屏真实洗护师卡不负 X', ok, detail)
  await shot(cdp, 'd58-staff-rail')
}

async function checkConfirmBar(cdp) {
  await navigate(cdp, '/booking/grooming', `!!document.querySelector('[data-testid="gs-time-grid"]') && !!document.querySelector('[data-testid="gs-confirm-bar"]')`)
  await cdp.eval(`document.querySelector('[data-block-key="bookingGrooming.serviceChips"]').scrollIntoView({ block: 'end' })`)
  await sleep(500)
  const background = await cdp.eval(`getComputedStyle(document.querySelector('[data-testid="gs-confirm-bar"]').firstElementChild).backgroundColor`)
  const channels = background.match(/[\d.]+/g)?.map(Number) ?? []
  const opaque = channels.length === 3 || channels[3] === 1
  record('D-59 摘要衬底不透明穿透服务卡', opaque, `background=${background}`)
  await shot(cdp, 'd59-confirm-bar')

  await cdp.eval(`document.querySelector('[data-testid="gs-time-grid"]').scrollIntoView({ block: 'end' })`)
  await sleep(700)
  const state = JSON.parse(await cdp.eval(`(() => {
    const panel = document.querySelector('[data-testid="gs-confirm-bar"]').firstElementChild.getBoundingClientRect()
    const slots = [...document.querySelectorAll('[data-testid="gs-time-grid"] button')].map((el) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const hit = centerX >= 0 && centerX < innerWidth && centerY >= 0 && centerY < innerHeight
        ? document.elementFromPoint(centerX, centerY)
        : null
      return {
        name: el.dataset.testid,
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        visible: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
        clickable: hit === el || el.contains(hit),
      }
    }).filter((slot) => slot.visible)
    return JSON.stringify({
      panelTop: panel.top,
      panelBottom: panel.bottom,
      slots: slots.map((slot) => ({
        ...slot,
        covered: slot.bottom > panel.top && slot.top < panel.bottom,
      })),
    })
  })()`))
  const covered = state.slots.filter((slot) => slot.covered)
  const clickable = state.slots.filter((slot) => slot.clickable)
  const ok = state.slots.length > 0 && covered.length === 0 && clickable.length === state.slots.length
  record('D-59/O6 确认栏不压时段格且热区可点', ok, `panelTop=${Math.round(state.panelTop)}；完整视口时段=${state.slots.length}；被压=${covered.length}；可点=${clickable.length}`)
  await shot(cdp, 'd59-time-grid')
}

async function checkOrderRow(cdp) {
  const measure = () => cdp.eval(`JSON.stringify((() => {
    const dock = document.querySelector('[data-testid="app-dock"]').getBoundingClientRect()
    const items = [...document.querySelector('[data-testid="me-orderrow"]').children].map((el) => {
      const rect = el.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return {
        text: el.innerText.trim().replace(/\\n/g, '/'),
        top: rect.top, bottom: rect.bottom,
        inViewport: rect.top >= 0 && rect.bottom <= innerHeight,
        covered: rect.bottom > dock.top && rect.top < dock.bottom,
        clickable: hit === el || el.contains(hit),
      }
    })
    return { dockTop: dock.top, items }
  })())`).then(JSON.parse)
  const summarize = (state) => ({
    covered: state.items.filter((item) => item.covered),
    visible: state.items.filter((item) => item.inViewport),
    clickable: state.items.filter((item) => item.clickable),
  })

  await navigate(cdp, '/me', `!!document.querySelector('[data-testid="me-orderrow"]') && !!document.querySelector('[data-testid="app-dock"]')`)
  await cdp.eval(`document.querySelector('[data-testid="me-orderrow"]').scrollIntoView({ block: 'end' })`)
  await sleep(500)
  const scrolled = await measure()
  const scrolledSummary = summarize(scrolled)
  const scrollOk = scrolled.items.length === 5 && scrolledSummary.covered.length === 0 && scrolledSummary.visible.length === 5 && scrolledSummary.clickable.length === 5
  record('D-60 微滚后订单五态行完整可见可点', scrollOk, `dockTop=${Math.round(scrolled.dockTop)}；五格=${scrolled.items.length}；完整=${scrolledSummary.visible.length}；被遮=${scrolledSummary.covered.length}；可点=${scrolledSummary.clickable.length}`)
  await shot(cdp, 'd60-me-orderrow')

  await navigate(cdp, '/me', `!!document.querySelector('[data-testid="me-orderrow"]') && !!document.querySelector('[data-testid="app-dock"]')`)
  await cdp.eval(`document.querySelector('[data-testid="me-orderrow"] a:last-child').focus()`)
  await sleep(500)
  const focused = await measure()
  const focusedSummary = summarize(focused)
  const focusOk = focused.items.length === 5 && focusedSummary.covered.length === 0 && focusedSummary.visible.length === 5 && focusedSummary.clickable.length === 5
  record('D-60 聚焦后订单五态行完整可见可点', focusOk, `dockTop=${Math.round(focused.dockTop)}；五格=${focused.items.length}；完整=${focusedSummary.visible.length}；被遮=${focusedSummary.covered.length}；可点=${focusedSummary.clickable.length}`)
  await shot(cdp, 'd60-me-orderrow-focus')
}

async function main() {
  const expectedCount = { all: 9, magazine: 4, layout: 5 }[SCOPE]
  if (!expectedCount) throw new Error(`非法 CHECK_SCOPE=${SCOPE}；可选 all/magazine/layout`)
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  if (SCOPE === 'all' || SCOPE === 'magazine') {
    await checkMagazineLead(cdp)
    await checkMagazineEntry(cdp, 2)
    await checkMagazineEntry(cdp, 3)
    await checkMissingMagazineArticle(cdp)
  }
  if (SCOPE === 'all' || SCOPE === 'layout') {
    await checkStaffRail(cdp)
    await checkConfirmBar(cdp)
    await checkOrderRow(cdp)
  }
  cdp.close()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({
    at: new Date().toISOString(),
    base: CUSTOMER_URL,
    results,
  }, null, 2))
  if (results.length !== expectedCount) {
    console.error(`检查数不符：期望 ${expectedCount}，实际 ${results.length}；拒绝空跑假绿`)
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
