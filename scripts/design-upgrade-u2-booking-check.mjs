#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7100').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9251)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'after'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'design-upgrade-u2-booking')
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
let successFixture = null
const networkRequests = []
const profileDir = join(tmpdir(), `philia-u2-booking-${process.pid}`)

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

function mockSuccessBody(appointmentId) {
  const start = '2026-10-19T06:00:00.000Z'
  const end = '2026-10-19T07:30:00.000Z'
  const body = [{
    result: {
      data: {
        json: {
          appointment: {
            id: appointmentId,
            code: '204619',
            customerId: 'u2-mock-customer',
            storeId: 'u2-store',
            staffId: null,
            assignSource: null,
            petId: 'u2-pet',
            serviceId: 'u2-service',
            type: 'grooming',
            scheduledStart: start,
            scheduledEnd: end,
            status: 'confirmed',
            priceFen: 16800,
            paymentMode: 'pay_at_store',
            paidAt: null,
            paidFen: null,
            note: null,
          },
          pet: { id: 'u2-pet', name: '豆豆' },
          service: { id: 'u2-service', name: '标准洗护' },
          store: { id: 'u2-store', name: '静安寺店' },
          steps: [],
          boardingStay: null,
          customer: { nickname: null, phoneTail: null },
          cashierBillId: null,
          addons: [],
          rescheduleLogs: [],
        },
        meta: {
          values: {
            'appointment.scheduledStart': ['Date'],
            'appointment.scheduledEnd': ['Date'],
          },
        },
      },
    },
  }]
  return Buffer.from(JSON.stringify(body), 'utf8').toString('base64')
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
      if (message.method === 'Network.requestWillBeSent') {
        networkRequests.push(message.params.request.url)
        return
      }
      if (message.method === 'Fetch.requestPaused') {
        const requestId = message.params.requestId
        const url = message.params.request.url
        if (successFixture && url.includes('/trpc/appointment.get')) {
          this.send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'content-type', value: 'application/json' },
              { name: 'access-control-allow-origin', value: CUSTOMER_URL },
              { name: 'access-control-allow-credentials', value: 'true' },
            ],
            body: successFixture,
          }).catch(() => {})
        } else {
          this.send('Fetch.continueRequest', { requestId }).catch(() => {})
        }
        return
      }
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
      // 浏览器已断开时无需重复关闭。
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
    // 临时浏览器目录清理由系统兜底，不覆盖检查结果。
  }
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(2))

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}${path}` })
  if (!await cdp.waitFor(readyExpression)) {
    const text = await cdp.eval(`(document.body?.innerText ?? '').slice(0, 500)`).catch(() => '')
    throw new Error(`页面未就绪：${path}；正文=${text.replace(/\n/g, ' / ')}`)
  }
}

async function login(cdp) {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  const customer = (await response.json())?.users?.find((user) => (user.roles ?? []).includes('customer'))
  if (!customer?.id) throw new Error('种子客户缺失')
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: ${JSON.stringify(customer.id)} }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
  return customer.id
}

const FONT_PROBE = `((root) => {
  const rows = [...root.querySelectorAll('*')].filter((el) => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return el.children.length === 0 && el.textContent.trim() && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }).map((el) => ({ text: el.textContent.trim(), size: Number.parseFloat(getComputedStyle(el).fontSize) }))
  return { min: rows.length ? Math.min(...rows.map((row) => row.size)) : 0, rows: rows.filter((row) => row.size < 12) }
})`

async function checkDefault(cdp) {
  await navigate(cdp, '/booking/grooming', `!!document.querySelector('[data-testid="grooming-single"]') && !!document.querySelector('[data-testid="gs-time-grid"]')`)
  await sleep(500)
  const state = JSON.parse(await cdp.eval(`(() => {
    const root = document.querySelector('[data-testid="grooming-single"]')
    const chipRows = [...document.querySelectorAll('[data-testid^="u2-chip-"]')].map((el) => ({ id: el.dataset.testid, height: el.getBoundingClientRect().height }))
    const chips = chipRows.map((el) => el.id).sort()
    const confirm = document.querySelector('[data-testid="gs-confirm"]')
    const font = ${FONT_PROBE}(root)
    const firstSlot = document.querySelector('[data-testid^="gs-slot-"]')
    const columns = firstSlot ? getComputedStyle(firstSlot.parentElement).gridTemplateColumns.split(' ').filter(Boolean).length : 0
    return JSON.stringify({
      title: root.querySelector('h1')?.textContent.trim() ?? '',
      chips,
      chipRows,
      staffRail: !!root.querySelector('[data-testid="gs-groomer-rail"]'),
      extras: !!root.querySelector('[data-testid="gs-extras"]'),
      petCard: !!root.querySelector('[data-testid="gs-pet-card"]'),
      confirmText: confirm?.textContent.trim() ?? '',
      confirmDisabled: confirm?.disabled ?? true,
      pawCount: root.querySelectorAll('.lucide-paw-print').length,
      minFont: font.min,
      smallText: font.rows,
      columns,
    })
  })()`))
  const expectedChips = ['u2-chip-pet', 'u2-chip-service', 'u2-chip-staff', 'u2-chip-store']
  const structureOk = state.title === '预约'
    && expectedChips.every((id) => state.chips.includes(id))
    && !state.staffRail && !state.extras && !state.petCard
    && state.confirmText === '请先选择时段' && state.confirmDisabled
    && state.pawCount === 0
  record('U2 Default 为预填 chips＋日期时段的 2-tap 画布', structureOk, `title=${state.title}；chips=${state.chips.join('/') || '缺'}；旧区块=${state.staffRail || state.extras || state.petCard}；CTA=${state.confirmText}`, state)
  const minChipHeight = state.chipRows.length ? Math.min(...state.chipRows.map((row) => row.height)) : 0
  record('M1 预约 chips 触控高全部 ≥44px', minChipHeight >= 44, `最小高=${minChipHeight}px；${state.chipRows.map((row) => `${row.id}=${Math.round(row.height)}px`).join('，')}`, state.chipRows)
  record('U2 Default 可读副文全部 ≥12px', state.minFont >= 12, `最小=${state.minFont}px；低于 12px=${state.smallText.map((row) => `${row.text}:${row.size}`).join('，') || '无'}`, state.smallText)
  record('U2 时段为定稿四列栅格', state.columns === 4, `列数=${state.columns}`)
  await shot(cdp, 'default')
}

async function clickSelector(cdp, selector) {
  const point = JSON.parse(await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    el.scrollIntoView({ block: 'nearest', inline: 'center' })
    const rect = el.getBoundingClientRect()
    return JSON.stringify({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  })()`))
  if (!point) return false
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  return true
}

async function openStaffSheet(cdp) {
  await clickSelector(cdp, '[data-testid="u2-chip-staff"]')
  await sleep(500)
  return cdp.eval(`!!document.querySelector('[data-testid="u2-staff-sheet"]')`)
}

async function checkStaffHalf(cdp) {
  const opened = await openStaffSheet(cdp)
  const state = JSON.parse(await cdp.eval(`(() => {
    const sheet = document.querySelector('[data-testid="u2-staff-sheet"]')
    if (!sheet) return JSON.stringify({ open: false })
    const font = ${FONT_PROBE}(sheet)
    const hit = document.elementFromPoint(8, 24)
    return JSON.stringify({
      open: true,
      modal: sheet.matches('dialog:modal'),
      hero: !!sheet.querySelector('[data-testid="u2-staff-hero"]'),
      works: !!sheet.querySelector('[data-testid="u2-staff-works"]'),
      confirm: !!sheet.querySelector('[data-testid="u2-staff-confirm"]'),
      confirmVisible: (() => {
        const el = sheet.querySelector('[data-testid="u2-staff-confirm"]')
        if (!el) return false
        const rect = el.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        return rect.top >= 0 && rect.bottom <= innerHeight && (hit === el || el.contains(hit))
      })(),
      options: sheet.querySelectorAll('[data-testid^="u2-staff-option-"]').length,
      pawCount: sheet.querySelectorAll('.lucide-paw-print').length,
      backdropHit: hit === sheet || hit?.classList.contains('u2-staff-backdrop'),
      minFont: font.min,
      smallText: font.rows,
    })
  })()`))
  const structureOk = opened && state.open && state.modal && state.hero && state.works && state.confirm && state.confirmVisible && state.options >= 2 && state.pawCount === 0
  record('U2 Half 为 Modal 选人详情且结构块齐全', structureOk, `open=${opened}；modal=${state.modal}；hero=${state.hero}；works=${state.works}；options=${state.options}`, state)
  record('U2 Half 蒙层阻断底层点按', opened && state.backdropHit, `backdropHit=${state.backdropHit}`)
  record('U2 Half 可读副文全部 ≥12px', opened && state.minFont >= 12, `最小=${state.minFont}px；低于 12px=${state.smallText?.map((row) => `${row.text}:${row.size}`).join('，') || '无'}`, state.smallText)
  await shot(cdp, 'half')

  if (opened) {
    await cdp.eval(`window.scrollTo(0, 120)`)
    const wheelPoint = JSON.parse(await cdp.eval(`(() => {
      const rect = document.querySelector('[data-testid="u2-staff-confirm"]').getBoundingClientRect()
      return JSON.stringify({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    })()`))
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: wheelPoint.x, y: wheelPoint.y, deltaX: 0, deltaY: 360 })
    await sleep(300)
    const scrollState = JSON.parse(await cdp.eval(`JSON.stringify({ y: window.scrollY, open: !!document.querySelector('[data-testid="u2-staff-sheet"]'), bodyOverflow: document.body.style.overflow })`))
    record('U2 Half 打开时底层页面不随滚轮滚动', scrollState.open && Math.abs(scrollState.y - 120) < 1 && scrollState.bodyOverflow === 'hidden', `scrollY=${scrollState.y}；open=${scrollState.open}；body=${scrollState.bodyOverflow || 'auto'}`, scrollState)

    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 8, y: 24, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 8, y: 24, button: 'left', clickCount: 1 })
    await sleep(400)
    const dismiss = JSON.parse(await cdp.eval(`JSON.stringify({
      closed: !document.querySelector('[data-testid="u2-staff-sheet"]'),
      confirmText: document.querySelector('[data-testid="gs-confirm"]')?.textContent.trim() ?? '',
      bodyOverflow: document.body.style.overflow,
    })`))
    record('U2 Half 点蒙层仅关闭不误触底层', dismiss.closed && dismiss.confirmText === '请先选择时段' && dismiss.bodyOverflow !== 'hidden', `closed=${dismiss.closed}；CTA=${dismiss.confirmText}；body=${dismiss.bodyOverflow || 'auto'}`, dismiss)

    await openStaffSheet(cdp)
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await sleep(300)
    const escClosed = await cdp.eval(`!document.querySelector('[data-testid="u2-staff-sheet"]')`)
    record('U2 Half 支持 Esc 关闭', escClosed, `closed=${escClosed}`)

    await openStaffSheet(cdp)
    const picked = await cdp.eval(`(() => {
      const option = [...document.querySelectorAll('[data-testid^="u2-staff-option-"]')].find((el) => el.dataset.testid !== 'u2-staff-option-any')
      if (!option) return false
      option.click()
      const confirm = document.querySelector('[data-testid="u2-staff-confirm"]')
      confirm?.click()
      return !!confirm
    })()`)
    await sleep(400)
    const selection = JSON.parse(await cdp.eval(`JSON.stringify({
      closed: !document.querySelector('[data-testid="u2-staff-sheet"]'),
      chip: document.querySelector('[data-testid="u2-chip-staff"]')?.textContent.trim() ?? '',
    })`))
    record('U2 Half 选人后回画布并更新摘要', picked && selection.closed && selection.chip && !selection.chip.includes('系统分配'), `picked=${picked}；closed=${selection.closed}；chip=${selection.chip}`)
  } else {
    record('U2 Half 打开时底层页面不随滚轮滚动', false, 'Half 未打开')
    record('U2 Half 点蒙层仅关闭不误触底层', false, 'Half 未打开')
    record('U2 Half 支持 Esc 关闭', false, 'Half 未打开')
    record('U2 Half 选人后回画布并更新摘要', false, 'Half 未打开')
  }
}

async function checkSelected(cdp) {
  await cdp.eval(`document.querySelector('[data-testid^="gs-slot-"][data-available="true"]')?.click()`)
  await sleep(400)
  const state = JSON.parse(await cdp.eval(`(() => {
    const confirm = document.querySelector('[data-testid="gs-confirm"]')
    return JSON.stringify({
      text: confirm?.textContent.trim() ?? '',
      disabled: confirm?.disabled ?? true,
      summary: document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent.trim() ?? '',
    })
  })()`))
  const ok = state.text === '确认预约' && !state.disabled && state.summary.includes('已选') && state.summary.includes('¥')
  record('U2 已选态只待第二 tap，确认钮不携带多余文案', ok, `CTA=${state.text}；disabled=${state.disabled}；summary=${state.summary}`, state)
  await shot(cdp, 'selected')
}

async function checkSuccess(cdp) {
  const id = process.env.U2_APPT_ID ?? 'u2-mock-success'
  successFixture = mockSuccessBody(id)
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/trpc/appointment.get*', requestStage: 'Request' }] })
  await navigate(cdp, `/booking/success?aid=${encodeURIComponent(id)}`, `(document.body?.innerText ?? '').includes('预约成功')`)
  await sleep(800)
  const state = JSON.parse(await cdp.eval(`(() => {
    const root = document.querySelector('[data-testid="u2-success"]')
    const process = document.querySelector('[data-testid="u2-success-process"]')
    return JSON.stringify({
      root: !!root,
      text: document.body.innerText,
      processHref: process ? new URL(process.href).pathname : '',
      done: !!document.querySelector('[data-testid="u2-success-done"]'),
      dock: !!document.querySelector('[data-testid="app-dock"]'),
      qr: (document.body.innerText.includes('到店核销码') || !!document.querySelector('img[alt="预约二维码"]')),
      calendar: document.body.innerText.includes('添加到日历'),
    })
  })()`))
  const copyOk = ['已为豆豆锁定档期', '豆豆 · 标准洗护', '静安寺店'].every((text) => state.text.includes(text))
  const ok = state.root && copyOk && state.processHref === `/appointments/${id}/live` && state.done && state.dock && !state.qr && !state.calendar
  record('U2 成功态对齐摘要＋服务过程入口锚＋完成出口', ok, `root=${state.root}；copy=${copyOk}；process=${state.processHref}；done=${state.done}；dock=${state.dock}；qr=${state.qr}`, { ...state, text: undefined })
  await shot(cdp, 'success')
  successFixture = null
  await cdp.send('Fetch.disable').catch(() => {})
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  await checkDefault(cdp)
  await checkStaffHalf(cdp)
  await checkSelected(cdp)
  await checkSuccess(cdp)
  const forbiddenHits = networkRequests.filter((url) => url.includes('/trpc/appointment.create') || url.includes('/trpc/pay.') || url.includes('/api/pay'))
  record('U2 验证全程无提交预约／支付请求', forbiddenHits.length === 0, `命中=${forbiddenHits.join('，') || '无'}`, forbiddenHits)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: CUSTOMER_URL, results }, null, 2))
  const expected = 14
  if (results.length !== expected) {
    console.error(`检查数不符：期望 ${expected}，实际 ${results.length}；拒绝空跑假绿`)
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
