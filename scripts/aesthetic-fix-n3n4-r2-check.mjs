#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9236)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-n3n4-r2')
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
const profileDir = join(tmpdir(), `philia-aesthetic-n3n4-${process.pid}`)

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
        return
      }
      if (message.method === 'Fetch.requestPaused') {
        this.send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'ConnectionAborted' }).catch(() => {})
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

async function login(cdp) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const users = (await response.json())?.users ?? []
  const customer = users.find((user) => user.roles?.includes('customer'))
  if (!customer) throw new Error('无种子客户')
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function setSafeBottom(cdp, bottom) {
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom, right: 0 } })
}

async function checkN3(cdp, height, addItem = false, safeBottom = 0) {
  await setSafeBottom(cdp, safeBottom)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true })
  if (addItem) {
    await navigate(cdp, '/mall', `!!document.querySelector('button[data-testid^="mall-quickadd-"]')`)
    await cdp.eval(`document.querySelector('button[data-testid^="mall-quickadd-"]').click()`)
  }
  await navigate(cdp, '/mall/checkout', `[...document.querySelectorAll('span')].some((span) => span.textContent.startsWith('合计（1 件）')) && [...document.querySelectorAll('button')].some((button) => button.textContent.includes('提交订单'))`)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const total = [...document.querySelectorAll('span')].find((span) => span.textContent.startsWith('合计（1 件）'))
    const submit = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('提交订单'))
    const bar = submit.closest('.fixed')
    const totalRect = total.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    const x = totalRect.left + totalRect.width / 2
    const y = totalRect.top + totalRect.height / 2
    const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null
    const stylesOf = (selector, props) => {
      const style = getComputedStyle(document.querySelector(selector))
      return Object.fromEntries(props.map((prop) => [prop, style[prop]]))
    }
    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      total: { text: total.textContent, top: totalRect.top, bottom: totalRect.bottom },
      bar: { top: barRect.top, bottom: barRect.bottom },
      clearance: barRect.top - totalRect.bottom,
      fullyVisible: totalRect.top >= 0 && totalRect.bottom <= innerHeight,
      covered: totalRect.bottom > barRect.top && totalRect.top < barRect.bottom,
      clickable: hit === total || total.contains(hit),
      hitTestId: hit?.closest?.('[data-testid]')?.dataset.testid ?? hit?.tagName ?? null,
      submitExists: !!submit,
      safeBottom: ${safeBottom},
      styles: {
        page: stylesOf('.checkout-page', ['paddingTop']),
        address: stylesOf('.checkout-address-card', ['marginTop', 'paddingTop', 'paddingBottom']),
        delivery: stylesOf('.checkout-delivery', ['marginTop']),
        fields: stylesOf('.checkout-address-fields', ['marginTop', 'gap']),
        input: stylesOf('.checkout-input', ['height']),
        lines: stylesOf('.checkout-lines-card', ['marginTop', 'paddingTop', 'paddingBottom']),
        lineItem: stylesOf('.checkout-line-item', ['paddingTop', 'paddingBottom']),
        totalRow: stylesOf('.checkout-total-row', ['paddingTop', 'paddingBottom']),
      },
    }
  })())`))
  const ok = measurements.scrollY === 0 && measurements.clearance >= 8 && measurements.fullyVisible && !measurements.covered && measurements.clickable && measurements.submitExists
  record(`N3 结算零滚合计一行不被提交栏遮（390×${height}）`, ok, `scrollY=${measurements.scrollY}；inset=${safeBottom}；净空=${Math.round(measurements.clearance)}；合计=${Math.round(measurements.total.top)}–${Math.round(measurements.total.bottom)}；barTop=${Math.round(measurements.bar.top)}；遮=${measurements.covered}；命中=${measurements.hitTestId}`, measurements)
  await shot(cdp, `n3-checkout-total-${height}-inset${safeBottom}`)
}

async function checkN4(cdp, height, safeBottom = 0) {
  await setSafeBottom(cdp, safeBottom)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true })
  await navigate(cdp, '/member/open', `[...document.querySelectorAll('button')].some((button) => button.textContent.includes('对比四档权益')) && !!document.querySelector('.m2-ctabar')`)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const compare = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('对比四档权益'))
    const bar = document.querySelector('.m2-ctabar')
    const compareRect = compare.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    const x = compareRect.left + compareRect.width / 2
    const y = compareRect.top + compareRect.height / 2
    const hit = x >= 0 && x < innerWidth && y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null
    const claim = document.querySelector('.m2-deck .m2-cardface.sel .cf-claim')
    const card = document.querySelector('.m2-deck .m2-cardface.sel')
    const claimRect = claim?.getBoundingClientRect() ?? null
    const cardRect = card?.getBoundingClientRect() ?? null
    const claimVisible = !!claim && !!card && claimRect.height > 0 && claimRect.top >= cardRect.top && claimRect.bottom <= cardRect.bottom
    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      compare: { text: compare.textContent.trim(), left: compareRect.left, right: compareRect.right, top: compareRect.top, bottom: compareRect.bottom },
      bar: { top: barRect.top, bottom: barRect.bottom },
      clearance: barRect.top - compareRect.bottom,
      fullyVisible: compareRect.top >= 0 && compareRect.bottom <= innerHeight && compareRect.left >= 0 && compareRect.right <= innerWidth,
      covered: compareRect.bottom > barRect.top && compareRect.top < barRect.bottom,
      clickable: hit === compare || compare.contains(hit),
      hitTestId: hit?.closest?.('[data-testid]')?.dataset.testid ?? hit?.tagName ?? null,
      point: { x, y },
      safeBottom: ${safeBottom},
      claimText: claim?.textContent.trim() ?? '',
      claimVisible,
    }
  })())`))
  let compareOpened = false
  if (measurements.fullyVisible && !measurements.covered && measurements.clickable) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: measurements.point.x, y: measurements.point.y, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: measurements.point.x, y: measurements.point.y, button: 'left', clickCount: 1 })
    compareOpened = await cdp.waitFor(`!!document.querySelector('.m2-sheet.open[role="dialog"]')`, 3000)
    if (compareOpened) await cdp.eval(`document.querySelector('.m2-scrim').click()`)
  }
  measurements.compareOpened = compareOpened
  const ok = measurements.scrollY === 0 && measurements.clearance >= 8 && measurements.fullyVisible && !measurements.covered && measurements.clickable && compareOpened && measurements.claimVisible
  record(`N4 开通页零滚对比四档权益链完整可点（390×${height}）`, ok, `scrollY=${measurements.scrollY}；inset=${safeBottom}；净空=${Math.round(measurements.clearance)}；链=${Math.round(measurements.compare.top)}–${Math.round(measurements.compare.bottom)}；barTop=${Math.round(measurements.bar.top)}；遮=${measurements.covered}；开对比=${compareOpened}；claim=${measurements.claimVisible}`, measurements)
  await shot(cdp, `n4-member-compare-${height}-inset${safeBottom}`)
}

function mediaBlockAfter(text, marker) {
  const markerIndex = text.indexOf(marker)
  if (markerIndex < 0) return null
  const mediaIndex = text.indexOf('@media', markerIndex)
  const open = text.indexOf('{', mediaIndex)
  if (mediaIndex < 0 || open < 0) return null
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1
    if (text[index] === '}') {
      depth -= 1
      if (depth === 0) return text.slice(mediaIndex, index + 1)
    }
  }
  return null
}

function checkCssCompatibility() {
  const n3Block = mediaBlockAfter(readFileSync('apps/customer/src/index.css', 'utf8'), '/* N3：')
  const n4Block = mediaBlockAfter(readFileSync('apps/customer/src/styles/member-v2.css', 'utf8'), '/* N4：')
  const n3UsesMax = n3Block ? /\bmax\(/.test(n3Block) : null
  const n4UsesMax = n4Block ? /\bmax\(/.test(n4Block) : null
  const ok = n3UsesMax === false && n4UsesMax === false
  record('N3/N4 避让不依赖 CSS max()', ok, `N3max=${n3UsesMax}；N4max=${n4UsesMax}`, { n3UsesMax, n4UsesMax, blocksFound: { n3: !!n3Block, n4: !!n4Block } })
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  checkCssCompatibility()
  await checkN3(cdp, 844, true)
  for (const height of [793, 792, 737, 736, 700]) await checkN3(cdp, height)
  await checkN3(cdp, 700, false, 34)
  await checkN3(cdp, 793, false, 34)
  await checkN3(cdp, 844, false, 34)
  await checkN4(cdp, 844)
  for (const height of [765, 764, 737, 736, 700]) await checkN4(cdp, height)
  await checkN4(cdp, 700, 34)
  await checkN4(cdp, 765, 34)
  await checkN4(cdp, 844, 34)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({
    at: new Date().toISOString(),
    base: CUSTOMER_URL,
    results,
  }, null, 2))
  if (results.length !== 19) {
    console.error(`检查数不符：期望 19，实际 ${results.length}；拒绝空跑假绿`)
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
