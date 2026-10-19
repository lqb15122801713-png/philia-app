#!/usr/bin/env node
/**
 * PD-44 U5 员工脸点验脚本（CDP 实测 + 截图证据）
 * 对照：Ready §1.B（S-00~S-12 + StaffDock）/ §2 Token / §3 组件 / §6.4 S-02 状态机
 * 硬闸：结构块齐、可读文字全量 ≥12px、cream 主钮每屏 ≤2、爪印=0、无支付/提交预约请求。
 * 前置：server dev(7200) + staff vite(7102) 运行中；已跑 server/scripts/u5-demo-appointments.ts。
 * 运行：node scripts/design-upgrade-u5-staff-check.mjs
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const STAFF_URL = (process.env.STAFF_URL ?? 'http://localhost:7102').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9252)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'u5'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'design-upgrade-u5-staff')
const BROWSER = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((path) => existsSync(path))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = []
const networkRequests = []
let browser = null
const profileDir = join(tmpdir(), `philia-u5-staff-${process.pid}`)

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
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
    try { this.ws.close() } catch { /* 浏览器已断开 */ }
  }
}

async function launchBrowser() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome 可执行文件')
  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* CDP 未就绪继续等 */ }
    await sleep(500)
  }
  throw new Error(`CDP 端口 ${CDP_PORT} 未就绪`)
}

function cleanup() {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' })
  browser = null
  try { rmSync(profileDir, { recursive: true, force: true }) } catch { /* 临时目录系统兜底 */ }
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(2))

async function navigate(cdp, path, readyExpression) {
  await cdp.send('Page.navigate', { url: `${STAFF_URL}${path}` })
  if (!await cdp.waitFor(readyExpression)) {
    const text = await cdp.eval(`(document.body?.innerText ?? '').slice(0, 400)`).catch(() => '')
    throw new Error(`页面未就绪：${path}；正文=${text.replace(/\n/g, ' / ')}`)
  }
}

async function seedUsers() {
  const response = await fetch(`${API_BASE}/api/auth/dev-seed-users`)
  if (!response.ok) throw new Error(`种子用户接口 HTTP ${response.status}`)
  return (await response.json())?.users ?? []
}

async function login(cdp, userId) {
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择员工账号')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: ${JSON.stringify(userId)} }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function logout(cdp) {
  await cdp.eval(`fetch('${API_BASE}/api/auth/logout', { method: 'POST', credentials: 'include' }).then((res) => res.status).catch(() => 0)`)
}

const FONT_PROBE = `(() => {
  const rows = [...document.querySelectorAll('*')].filter((el) => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return el.children.length === 0 && el.textContent.trim() && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }).map((el) => ({ text: el.textContent.trim().slice(0, 24), size: Number.parseFloat(getComputedStyle(el).fontSize) }))
  return { min: rows.length ? Math.min(...rows.map((row) => row.size)) : 0, rows: rows.filter((row) => row.size < 12) }
})()`

async function faceCheck(cdp, id, opts = {}) {
  const state = JSON.parse(await cdp.eval(`JSON.stringify({
    font: ${FONT_PROBE},
    paw: document.querySelectorAll('.lucide-paw-print').length,
    cream: [...document.querySelectorAll('.sk-btn-action')].filter((el) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }).length,
  })`))
  record(`${id} 可读副文全部 ≥12px`, state.font.min >= 12,
    `最小=${state.font.min}px；低于 12px=${state.font.rows.map((row) => `${row.text}:${row.size}`).join('，') || '无'}`, state.font.rows)
  record(`${id} 无爪印冒充`, state.paw === 0, `paw=${state.paw}`)
  if (!opts.skipCream) record(`${id} cream 主钮 ≤2/屏`, state.cream <= 2, `cream=${state.cream}`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const users = await seedUsers()
  const byNick = (nick) => users.find((user) => user.nickname === nick)?.id
  const [aqiang, xiaomei] = [byNick('阿强'), byNick('小美')]
  if (!aqiang || !xiaomei) throw new Error('种子员工缺失（阿强/小美）——请先 db:seed')

  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()

  /* ---------- S-00 登录（未登录态） ---------- */
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('被托付的小生命')`)
  await sleep(600)
  const s00 = JSON.parse(await cdp.eval(`JSON.stringify({
    hero: (() => { const img = document.querySelector('.sk img'); return !!img && img.getBoundingClientRect().height > 100 })(),
    serif: !!document.querySelector('h1'),
    cta: !!document.querySelector('[data-testid="login-primary"]'),
    accounts: (document.body?.innerText ?? '').includes('选择员工账号'),
    ctaText: document.querySelector('[data-testid="login-primary"]')?.textContent.trim() ?? '',
  })`))
  record('S-00 登录结构（主视觉/serif 宣言/cream 主钮/账号区）', s00.hero && s00.serif && s00.cta && s00.accounts, JSON.stringify(s00), s00)
  record('S-00 主钮文案不冒充（选择员工账号登录）', s00.ctaText.includes('选择员工账号登录'), `CTA=${s00.ctaText}`)
  await faceCheck(cdp, 'S-00')
  await shot(cdp, 's00-login')

  /* ---------- 阿强（groomer）登录 ---------- */
  await login(cdp, aqiang)

  /* ---------- S-01 工位台（六步 now Workcard） ---------- */
  await navigate(cdp, '/today', `!!document.querySelector('[data-testid="sk-workcard"]') || !!document.querySelector('[data-testid="deck-empty"]')`)
  await sleep(900)
  const s01 = JSON.parse(await cdp.eval(`JSON.stringify({
    workcard: !!document.querySelector('[data-testid="sk-workcard"]'),
    steps: document.querySelectorAll('[data-testid="sk-stepgrid"] .st').length,
    now: document.querySelectorAll('[data-testid="sk-stepgrid"] .st.now').length,
    done: document.querySelectorAll('[data-testid="sk-stepgrid"] .st.done').length,
    cta: !!document.querySelector('[data-testid^="svc-continue-"]'),
    dockLinks: [...document.querySelectorAll('[data-testid="staff-dock"] a')].map((el) => { const c = el.cloneNode(true); c.querySelectorAll('.bdg').forEach((b) => b.remove()); return c.textContent.trim() }),
    dockActive: document.querySelector('[data-testid="staff-dock"] a.on')?.dataset.testid ?? '',
    dockDash: getComputedStyle(document.querySelector('[data-testid="staff-dock"] a.on'), '::before').backgroundColor,
    dockPaw: document.querySelectorAll('[data-testid="staff-dock"] .lucide-paw-print').length,
  })`))
  record('S-01 Workcard 六步 now（done=2/now=1/cream 主钮在）',
    s01.workcard && s01.steps === 6 && s01.now === 1 && s01.done === 2 && s01.cta,
    `steps=${s01.steps} done=${s01.done} now=${s01.now} cta=${s01.cta}`, s01)
  record('StaffDock 四槽冻结「工位/预约/打卡/我的」＋cream 短划激活',
    s01.dockLinks.join('/') === '工位/预约/打卡/我的' && s01.dockActive === 'dock-work' && s01.dockDash === 'rgb(242, 220, 140)' && s01.dockPaw === 0,
    `tabs=${s01.dockLinks.join('/')} active=${s01.dockActive} dash=${s01.dockDash}`, s01)
  await faceCheck(cdp, 'S-01')
  await shot(cdp, 's01-today')

  /* ---------- S-02 预约官方三态 ---------- */
  await navigate(cdp, '/schedule', `!!document.querySelector('[data-testid="sk-daygrid"]') || (document.body?.innerText ?? '').includes('这一天没有预约')`)
  await sleep(900)
  const s02 = JSON.parse(await cdp.eval(`JSON.stringify({
    chipRow: (() => { const row = document.querySelector('[data-testid="sk-daychip"]'); const pick = document.querySelector('[data-testid="sk-datepick"]'); return !!row && !!pick && pick.parentElement === row })(),
    chips: [...document.querySelectorAll('[data-testid="sk-daychip"] .sk-chip')].map((el) => el.textContent.trim().slice(0, 4)),
    half: !!document.querySelector('[data-testid^="sk-appt-"][data-level="half"]'),
    halfPanel: !!document.querySelector('[data-testid="sk-aphalf"]'),
    continueCta: !!document.querySelector('[data-testid^="appt-continue-"]'),
    startPills: [...document.querySelectorAll('[data-testid^="appt-start-"]')].map((el) => ({ disabled: el.disabled })),
    thinDone: document.querySelectorAll('[data-testid^="sk-appt-"][data-level="thin"]').length,
  })`))
  record('S-02 G1 日期片（昨/今/明＋日历 chip 同一行）', s02.chipRow && s02.chips.length === 4, `chips=${s02.chips.join('/')}`, s02)
  record('S-02 半展=dock 默认（服务中卡 half＋摘要＋继续执行）', s02.half && s02.halfPanel && s02.continueCta, JSON.stringify({ half: s02.half, halfPanel: s02.halfPanel, continueCta: s02.continueCta }), s02)
  record('S-02 互斥：待接「开始」pill 停用（同时仅一单服务中）', s02.startPills.length >= 1 && s02.startPills.every((pill) => pill.disabled), `pills=${JSON.stringify(s02.startPills)}`, s02.startPills)
  record('S-02 已完成/待接保持薄行', s02.thinDone >= 2, `thin=${s02.thinDone}`)
  await faceCheck(cdp, 'S-02')
  await shot(cdp, 's02-half')

  /* 全展：点 caret → 六步只读全表 */
  await cdp.eval(`(() => { const card = document.querySelector('[data-testid^="sk-appt-"][data-level="half"]'); card?.querySelector('.caret')?.click(); return true })()`)
  await sleep(700)
  const s02full = JSON.parse(await cdp.eval(`JSON.stringify({
    full: !!document.querySelector('[data-testid^="sk-appt-"][data-level="full"]'),
    oplist: document.querySelectorAll('.sk-oplist .sk-opstep').length,
  })`))
  record('S-02 全展=六步只读全表', s02full.full && s02full.oplist === 6, `full=${s02full.full} opstep=${s02full.oplist}`, s02full)
  await shot(cdp, 's02-full')

  /* S-12 切日：昨天 */
  await cdp.eval(`document.querySelector('[data-testid="sk-daychip-yesterday"]')?.click()`)
  await sleep(1200)
  const s12 = JSON.parse(await cdp.eval(`JSON.stringify({
    dayfoot: !!document.querySelector('.sk-dayfoot'),
    thin: document.querySelectorAll('[data-testid^="sk-appt-"][data-level="thin"]').length,
    half: document.querySelectorAll('[data-testid^="sk-appt-"][data-level="half"]').length,
  })`))
  record('S-12 切日历史（全薄行＋班结行）', s12.thin >= 1 && s12.half === 0, JSON.stringify(s12), s12)
  await faceCheck(cdp, 'S-12')
  await shot(cdp, 's12-past')

  /* ---------- S-03 打卡 ---------- */
  await navigate(cdp, '/attendance', `!!document.querySelector('[data-testid="sk-punch"]')`)
  await sleep(700)
  const s03 = JSON.parse(await cdp.eval(`JSON.stringify({
    punch: !!document.querySelector('[data-testid="sk-punch"]'),
    clock: (document.querySelector('[data-testid="sk-punch"] .clock')?.textContent ?? '').length >= 4,
    dockActive: document.querySelector('[data-testid="staff-dock"] a.on')?.dataset.testid ?? '',
  })`))
  record('S-03 打卡卡（大钟＋主钮；dock 打卡激活）', s03.punch && s03.clock && s03.dockActive === 'dock-punch', JSON.stringify(s03), s03)
  await faceCheck(cdp, 'S-03')
  await shot(cdp, 's03-punch')

  /* ---------- S-04 我的 ---------- */
  await navigate(cdp, '/me', `!!document.querySelector('[data-testid="sk-idcard"]')`)
  await sleep(700)
  const s04 = JSON.parse(await cdp.eval(`JSON.stringify({
    idcard: !!document.querySelector('[data-testid="sk-idcard"]'),
    trio: document.querySelectorAll('[data-testid="sk-idcard"] .trio .c').length,
    dockActive: document.querySelector('[data-testid="staff-dock"] a.on')?.dataset.testid ?? '',
  })`))
  record('S-04 身份卡＋三格账（dock 我的激活）', s04.idcard && s04.trio === 3 && s04.dockActive === 'dock-me', JSON.stringify(s04), s04)
  await faceCheck(cdp, 'S-04')
  await shot(cdp, 's04-me')

  /* ---------- S-05/06/07/08 脸面 ---------- */
  for (const [id, path, name] of [
    ['S-05', '/pay', 's05-pay'],
    ['S-06', '/xp', 's06-xp'],
    ['S-07', '/reviews', 's07-reviews'],
    ['S-08', '/inventory', 's08-inventory'],
  ]) {
    await navigate(cdp, path, `!!document.querySelector('.sk-backbar')`)
    await sleep(800)
    const has = await cdp.eval(`!!document.querySelector('.sk-backbar')`)
    record(`${id} 脸面（backbar＋sk 体系）`, has, `backbar=${has}`)
    await faceCheck(cdp, id)
    await shot(cdp, name)
  }

  /* ---------- 执行页（六步；隐藏拍照 input 不动） ---------- */
  const inServiceId = JSON.parse(await cdp.eval(`fetch('${API_BASE}/trpc/appointment.listTodayForStaff?input=%7B%22json%22%3A%7B%7D%7D', { credentials: 'include' })
    .then((res) => res.json())
    .then((body) => { const items = (Array.isArray(body) ? body[0] : body)?.result?.data?.json ?? []; const hit = items.find((i) => i.status === 'in_service'); return JSON.stringify(hit?.id ?? null) })
    .catch(() => 'null')`))
  if (inServiceId) {
    await navigate(cdp, `/execute/${inServiceId}`, `!!document.querySelector('.sk-backbar')`)
    await sleep(900)
    const exec = JSON.parse(await cdp.eval(`JSON.stringify({
      backbar: !!document.querySelector('.sk-backbar'),
      steps: document.querySelectorAll('ol li').length,
      hiddenFileInputs: [...document.querySelectorAll('input[type="file"]')].filter((el) => el.classList.contains('hidden') || getComputedStyle(el).display === 'none').length,
    })`))
    record('执行页脸面（backbar＋六步清单）', exec.backbar && exec.steps >= 6, JSON.stringify(exec), exec)
    record('执行页拍照隐藏 input 保持原样（待证项未动）', exec.hiddenFileInputs >= 1, `hidden=${exec.hiddenFileInputs}`)
    await faceCheck(cdp, 'EXEC')
    await shot(cdp, 'execute')
  } else {
    record('执行页脸面（backbar＋六步清单）', false, '夹具缺 in_service 单')
    record('执行页拍照隐藏 input 保持原样（待证项未动）', false, '夹具缺 in_service 单')
  }

  /* ---------- S-10 寄养打卡 ---------- */
  const boardingId = JSON.parse(await cdp.eval(`fetch('${API_BASE}/trpc/appointment.listTodayForStaff?input=%7B%22json%22%3A%7B%7D%7D', { credentials: 'include' })
    .then((res) => res.json())
    .then((body) => { const items = (Array.isArray(body) ? body[0] : body)?.result?.data?.json ?? []; const hit = items.find((i) => i.type === 'boarding'); return JSON.stringify(hit?.id ?? null) })
    .catch(() => 'null')`))
  if (boardingId) {
    await navigate(cdp, `/boarding/${boardingId}/checkin`, `!!document.querySelector('.sk-backbar')`)
    await sleep(900)
    await faceCheck(cdp, 'S-10')
    await shot(cdp, 's10-boarding')
  } else {
    record('S-10 寄养打卡脸面', false, '夹具缺寄养单')
  }

  /* ---------- 小美（frontdesk＋merchant_manager） ---------- */
  await logout(cdp)
  await login(cdp, xiaomei)
  await navigate(cdp, '/today', `!!document.querySelector('[data-testid="sk-workcard"]')`)
  await sleep(900)
  const fd = JSON.parse(await cdp.eval(`JSON.stringify({
    workcard: !!document.querySelector('[data-testid="sk-workcard"]'),
    scanCta: !!document.querySelector('[data-testid="frontdesk-scan"]'),
    waiting: !!document.querySelector('[data-testid="frontdesk-waiting"]'),
  })`))
  record('S-01 前台核销大卡（扫码主钮＋待核销分组）', fd.workcard && fd.scanCta, JSON.stringify(fd), fd)
  await faceCheck(cdp, 'S-01-FD')
  await shot(cdp, 's01-frontdesk')

  await navigate(cdp, '/manager', `!!document.querySelector('.sk-backbar')`)
  await sleep(900)
  const mgr = JSON.parse(await cdp.eval(`JSON.stringify({
    backbar: !!document.querySelector('.sk-backbar'),
    attendance: (document.body?.innerText ?? '').includes('考勤'),
    noNative: true,
  })`))
  record('S-11 店长审批脸面（考勤审批等分区）', mgr.backbar && mgr.attendance, JSON.stringify(mgr), mgr)
  await faceCheck(cdp, 'S-11')
  await shot(cdp, 's11-manager')

  /* ---------- 纪律：全程无真付/提交预约 ---------- */
  const forbiddenHits = networkRequests.filter((url) => url.includes('/trpc/appointment.create') || url.includes('/trpc/pay.') || url.includes('/api/pay'))
  record('U5 验证全程无提交预约／支付请求', forbiddenHits.length === 0, `命中=${forbiddenHits.join('，') || '无'}`, forbiddenHits)

  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: STAFF_URL, results }, null, 2))
  const failures = results.filter((result) => !result.ok).length
  console.log(`汇总：${results.length - failures}/${results.length} 通过；证据目录=${OUT_DIR}`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(`环境异常：${error?.message ?? error}`)
  process.exit(2)
})
