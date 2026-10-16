#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9229)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
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
const profileDir = join(tmpdir(), `philia-pd28-${process.pid}`)

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

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  const ready = await cdp.waitFor(readyExpression)
  if (!ready) throw new Error(`页面未就绪：${path}`)
}

async function login(cdp) {
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '19900000228' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

function rgb(value) {
  const parts = String(value).match(/[\d.]+/g)?.map(Number) ?? []
  return parts.slice(0, 3)
}

function luminance(value) {
  return rgb(value).map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

function contrast(fg, bg) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

async function checkO1(cdp) {
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-entry-grooming"]')`)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const mega = document.querySelector('[data-testid="home-entry-grooming"]')
    const panel = document.querySelector('[data-testid="home-booking-entry"]')
    return {
      megaVisible: !!mega && mega.getBoundingClientRect().height > 0,
      panelVisible: !!panel && panel.getBoundingClientRect().height > 0,
      megaHref: mega?.getAttribute('href') ?? null,
      panelHref: panel?.getAttribute('href') ?? null,
    }
  })())`))
  const visible = [state.megaVisible, state.panelVisible].filter(Boolean).length
  const ok = visible === 1
  record('O1 首页仅一条进洗护主路径', ok, `主入口可见=${visible}；mega=${state.megaHref}；panel=${state.panelHref}`)
  await shot(cdp, 'o1-home')
}

async function checkO2O12(cdp) {
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-idband"]')`)
  const home = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const ac = document.querySelector('[data-testid="home-idband"] .ac')
    const b = ac?.querySelector('b')
    return {
      ac: ac ? parseFloat(getComputedStyle(ac).fontSize) : 0,
      amount: b ? parseFloat(getComputedStyle(b).fontSize) : 0,
    }
  })())`))
  await navigate(cdp, '/me', `!!document.querySelector('[data-testid="me-rebate-cell"]')`)
  const me = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const cell = document.querySelector('[data-testid="me-rebate-cell"]')
    return {
      amount: parseFloat(getComputedStyle(cell.querySelector('.v')).fontSize),
      label: parseFloat(getComputedStyle(cell.querySelector('.k')).fontSize),
    }
  })())`))
  const ok = home.ac >= 12 && home.amount >= 12 && me.label >= 12 && me.amount >= 12
  record('O2+O12 回馈金／金额字阶统一可读', ok, `home=${home.ac}/${home.amount}px；me=${me.label}/${me.amount}px`)
  await shot(cdp, 'o2o12-me')
}

async function checkO3O4(cdp) {
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-pets-empty"]') && !!document.querySelector('[data-testid="home-pets-manage"]')`)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const empty = document.querySelector('[data-testid="home-pets-empty"]')
    const manage = document.querySelector('[data-testid="home-pets-manage"]')
    const rect = manage.getBoundingClientRect()
    return {
      fg: getComputedStyle(empty).color,
      bg: getComputedStyle(empty).backgroundColor,
      width: rect.width,
      height: rect.height,
    }
  })())`))
  const ratio = contrast(state.fg, state.bg)
  const o3ok = ratio >= 4.5
  const o4ok = state.width >= 44 && state.height >= 44
  record('O3 毛孩子空态正文对比≥4.5', o3ok, `对比=${ratio.toFixed(2)}；fg=${state.fg}；bg=${state.bg}`)
  record('O4 管理热区≥44×44', o4ok, `${state.width.toFixed(1)}×${state.height.toFixed(1)}`)
  await shot(cdp, 'o3o4-pets')
}

async function checkO5(cdp) {
  await navigate(cdp, '/booking/grooming', `!!document.querySelector('[data-testid="gs-confirm"]')`)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const button = document.querySelector('[data-testid="gs-confirm"]')
    return {
      fg: getComputedStyle(button).color,
      bg: getComputedStyle(button).backgroundColor,
      disabled: button.disabled,
      text: button.innerText,
    }
  })())`))
  const ratio = contrast(state.fg, state.bg)
  const ok = state.disabled && /请选择|请先|需要/.test(state.text) && ratio >= 4.5
  record('O5 预约禁用钮可读且锁因明确', ok, `对比=${ratio.toFixed(2)}；text=${state.text}`)
  await shot(cdp, 'o5-confirm')
}

async function checkO9(cdp) {
  await navigate(cdp, '/mall', `!!document.querySelector('a[href*="/mall/product/"]')`)
  const mall = await cdp.eval(`document.querySelectorAll('[data-testid="mall-rebate-hook"]').length`)
  const productPath = await cdp.eval(`document.querySelector('a[href*="/mall/product/"]').getAttribute('href')`)
  await cdp.eval(`document.querySelector('button[data-testid^="mall-quickadd-"]').click()`)
  await sleep(300)
  await navigate(cdp, productPath, `!!document.querySelector('[data-testid="pdp-add-cart"]')`)
  const pdp = await cdp.eval(`document.querySelectorAll('[data-testid="pdp-rebate-hook"]').length`)
  await navigate(cdp, '/mall/cart', `!!document.querySelector('[data-testid="cart-rebate-hook"]')`)
  const cart = await cdp.eval(`document.querySelectorAll('[data-testid="cart-rebate-hook"]').length`)
  const ok = mall === 0 && pdp === 0 && cart === 1
  record('O9 商城漏斗仅一处规则主钩', ok, `mall=${mall}；pdp=${pdp}；cart=${cart}`)
  await shot(cdp, 'o9-cart')
}

async function checkO11(cdp) {
  await navigate(cdp, '/me', `!!document.querySelector('[data-testid="me-qrrow"]')`)
  const entryText = await cdp.eval(`document.querySelector('[data-testid="me-qrrow"]').innerText`)
  await navigate(cdp, '/me/card', `!!document.querySelector('[data-testid="membercard-token"]')`)
  await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: CUSTOMER_URL })
  const hasCopy = await cdp.eval(`!!document.querySelector('[data-testid="membercard-copy"]')`)
  if (hasCopy) await cdp.eval(`document.querySelector('[data-testid="membercard-copy"]').click()`)
  const state = { hasCopy }
  await sleep(300)
  const copyStatus = await cdp.eval(`document.querySelector('[data-testid="membercard-copy-status"]')?.innerText ?? ''`)
  const ok = !entryText.includes('扫') && state.hasCopy && copyStatus.includes('已复制')
  record('O11 会员码入口与落地示能一致', ok, `入口=${entryText.replace(/\n/g, '/')}；复制钮=${state.hasCopy}；状态=${copyStatus || '无'}`)
  await shot(cdp, 'o11-member-card')
}

async function checkO13(cdp) {
  await navigate(cdp, '/member/rebate', `!!document.querySelector('[data-block-key="w1.ring"]')`)
  const text = await cdp.eval(`document.querySelector('[data-block-key="w1.ring"]').innerText`)
  const ok = !text.includes('%') && text.includes('本周期日历') && /周期过半|周期未过半/.test(text)
  record('O13 免费档环不误读已攒进度', ok, text.replace(/\n/g, ' / '))
  await shot(cdp, 'o13-rebate')
}

async function checkO14AndO6(cdp) {
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="app-dock-booking"]')`)
  await cdp.eval(`document.querySelector('[data-testid="app-dock-booking"]').click()`)
  await cdp.waitFor(`location.pathname === '/booking/grooming' && !!document.querySelector('[data-testid="gs-confirm-bar"]')`)
  const state = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const dockEl = document.querySelector('[data-testid="app-dock"]')
    const booking = document.querySelector('[data-testid="app-dock-booking"]')
    const confirm = document.querySelector('[data-testid="gs-confirm-bar"]').getBoundingClientRect()
    const dock = dockEl?.firstElementChild.firstElementChild.getBoundingClientRect() ?? null
    return {
      path: location.pathname,
      dockExists: !!dockEl,
      ariaCurrent: booking?.getAttribute('aria-current') ?? null,
      overlap: dock ? confirm.bottom > dock.top && confirm.top < dock.bottom : false,
    }
  })())`))
  const ok = state.path === '/booking/grooming' && state.dockExists && state.ariaCurrent === 'page' && !state.overlap
  record('O14 预约进洗护 dock 常驻且选中', ok, `path=${state.path}；dock=${state.dockExists}；current=${state.ariaCurrent}；确认栏相交=${state.overlap}`)
  await shot(cdp, 'o14-booking-dock')

  await cdp.eval(`document.querySelector('[data-testid="gs-time-grid"]').scrollIntoView({ block: 'end' })`)
  await sleep(500)
  const o6 = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const confirm = document.querySelector('[data-testid="gs-confirm-bar"]').firstElementChild.getBoundingClientRect()
    const dockEl = document.querySelector('[data-testid="app-dock"]')
    const dock = dockEl?.firstElementChild.firstElementChild.getBoundingClientRect() ?? null
    const slots = [...document.querySelectorAll('[data-testid="gs-time-grid"] button')].map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        visible: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
        coveredByConfirm: rect.bottom > confirm.top && rect.top < confirm.bottom,
        coveredByDock: dock ? rect.bottom > dock.top && rect.top < dock.bottom : false,
      }
    }).filter((slot) => slot.visible)
    return { count: slots.length, confirm: slots.filter((slot) => slot.coveredByConfirm).length, dock: slots.filter((slot) => slot.coveredByDock).length }
  })())`))
  const o6ok = o6.count > 0 && o6.confirm === 0 && o6.dock === 0
  record('O6 回归：确认栏与 dock 均不压时段格', o6ok, `视口时段=${o6.count}；确认栏压=${o6.confirm}；dock压=${o6.dock}`)
  await shot(cdp, 'o14-o6-time-grid')
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  await checkO1(cdp)
  await checkO2O12(cdp)
  await checkO3O4(cdp)
  await checkO5(cdp)
  await checkO9(cdp)
  await checkO11(cdp)
  await checkO13(cdp)
  await checkO14AndO6(cdp)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
  if (results.length !== 10) {
    console.error(`检查数不符：期望 10，实际 ${results.length}`)
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
