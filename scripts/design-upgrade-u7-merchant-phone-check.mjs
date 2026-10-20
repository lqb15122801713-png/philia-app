#!/usr/bin/env node
/**
 * PD46 U7 商家手机 phone-v57 点验脚本（CDP 实测 390×844 + 截图证据）
 * 对照：figma bro B10/B10b 补帧（五槽壳 198:374/203:5219/198:445/203:5365/203:5480
 * ＋高频 212:2/73/144/220/291/362＋低频 213:2/84/166/248/330/412/494/576）＋VI 193:2。
 * 硬闸：结构块齐、可读文字全量 ≥12px、爪印=0、cream 主钮 ≤2/屏、页面零横向溢出、
 * dock 五槽激活归属＝B10b 映射、无支付/退款/预约提交请求。
 * 前置：server dev(7200) + merchant vite(7101) 运行中；已 db:migrate + db:seed。
 * 运行：node scripts/design-upgrade-u7-merchant-phone-check.mjs
 * （node 20 需 --experimental-websocket 启用全局 WebSocket）
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7101').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9257)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'u7'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'design-upgrade-u7-merchant-phone')
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
const profileDir = join(tmpdir(), `philia-u7-phone-${process.pid}`)

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
  await cdp.send('Page.navigate', { url: `${MERCHANT_URL}${path}` })
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
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('商家')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: ${JSON.stringify(userId)} }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

const FONT_PROBE = `(() => {
  const rows = [...document.querySelectorAll('*')].filter((el) => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return el.children.length === 0 && el.textContent.trim() && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }).map((el) => ({ text: el.textContent.trim().slice(0, 24), size: Number.parseFloat(getComputedStyle(el).fontSize) }))
  const min = rows.reduce((acc, row) => (row.size < acc ? row.size : acc), rows.length ? rows[0].size : 0)
  return { min, rows: rows.filter((row) => row.size < 12).slice(0, 40) }
})()`

const DOCK_PROBE = `(() => {
  const links = [...document.querySelectorAll('[data-testid="merchant-dock"] a')]
  const on = document.querySelector('[data-testid="merchant-dock"] a.on')
  return {
    labels: links.map((el) => el.textContent.trim()),
    active: on?.dataset.testid ?? '',
    dash: on ? getComputedStyle(on, '::before').backgroundColor : '',
    paw: document.querySelectorAll('[data-testid="merchant-dock"] .lucide-paw-print').length,
  }
})()`

async function faceCheck(cdp, id, opts = {}) {
  const state = JSON.parse(await cdp.eval(`JSON.stringify({
    font: ${FONT_PROBE},
    paw: document.querySelectorAll('.lucide-paw-print').length,
    cream: [...document.querySelectorAll('button.bg-brand-primary')].filter((el) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }).length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  })`))
  record(`${id} 可读副文全部 ≥12px`, state.font.min >= 12,
    `最小=${state.font.min}px；低于 12px=${state.font.rows.map((row) => `${row.text}:${row.size}`).join('，') || '无'}`, state.font.rows)
  record(`${id} 无爪印冒充`, state.paw === 0, `paw=${state.paw}`)
  record(`${id} cream 主钮 ≤2/屏`, state.cream <= 2, `cream=${state.cream}`)
  record(`${id} 页面零横向溢出`, state.overflowX <= 1, `overflowX=${state.overflowX}px`)
  if (!opts.skipDock) {
    const dock = JSON.parse(await cdp.eval(`JSON.stringify(${DOCK_PROBE})`))
    record(`${id} dock 激活＝${opts.dock}`, dock.active === `dock-${opts.dock}`, `active=${dock.active || '无'}`)
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const users = await seedUsers()
  const owner = users.find((user) => user.roles.includes('merchant_owner'))?.id
  if (!owner) throw new Error('种子店主缺失（merchant_owner）——请先 db:seed')

  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()

  await login(cdp, owner)

  /* ---------- dock 五槽冻结标签＋cream 短划（总览首站） ---------- */
  await navigate(cdp, '/dashboard', `!!document.querySelector('[data-testid="merchant-dock"]')`)
  await sleep(900)
  const dock0 = JSON.parse(await cdp.eval(`JSON.stringify(${DOCK_PROBE})`))
  record('dock 五槽冻结「总览/门店/收银/报表/我的」', JSON.stringify(dock0.labels) === JSON.stringify(['总览', '门店', '收银', '报表', '我的']),
    `labels=${dock0.labels.join('/')}`)
  record('dock 激活＝cream 顶短划 #F2DC8C', dock0.dash === 'rgb(242, 220, 140)', `dash=${dock0.dash}`)
  record('dock 无爪印', dock0.paw === 0, `paw=${dock0.paw}`)

  /* ---------- 五槽壳＋高频＋低频逐屏 ---------- */
  const screens = [
    {
      path: '/dashboard', id: 'W-01 驾驶舱', node: '212:2', dock: 'overview', shotName: 'w01-cockpit',
      ready: `!!document.querySelector('[data-testid="dash-alert"]')`,
      probe: `JSON.stringify({
        alert: !!document.querySelector('[data-testid="dash-alert"]'),
        m3: !!document.querySelector('[data-testid="dash-m3"], [data-testid="dash-m3-chain"]'),
        total: !!document.querySelector('[data-testid="wsk-total"]'),
        today: !!document.querySelector('[data-testid="dash-today-list"]'),
        postcard: !!document.querySelector('[data-testid="dash-postcard"]'),
      })`,
      expect: (s) => s.alert && s.m3 && s.total && s.today && s.postcard,
      desc: 'WAlert＋M3 KPI＋合计条＋今日预约＋晨报卡',
    },
    {
      path: '/appointments', id: 'W-02 预约台账', node: '212:73', dock: 'store', shotName: 'w02-ledger',
      ready: `!!document.querySelector('[data-testid="appointments-page"]')`,
      probe: `JSON.stringify({
        chips: document.querySelectorAll('.u3-chipf').length >= 4,
        tbl: !!document.querySelector('.u3-noscrollx.overflow-x-auto .u3-tbl, .u3-noscrollx .u3-tbl'),
      })`,
      expect: (s) => s.chips && s.tbl,
      desc: '筛选 chips＋台账表横滑容器',
    },
    {
      path: '/monitor', id: 'W-04 监控 Hub', node: '212:144', dock: 'store', shotName: 'w04-monitor',
      ready: `!!document.querySelector('[data-testid="monitor-hub-page"]')`,
      probe: `JSON.stringify({
        alert: !!document.querySelector('[data-testid="mon-alert"]'),
        singleCol: (() => { const c = document.querySelector('[data-testid^="monitor-card-"]'); const g = c?.closest('.grid'); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length === 1 : false })(),
      })`,
      expect: (s) => s.alert && s.singleCol,
      desc: '预警卡＋卡列 390 单列',
    },
    {
      path: '/cashier', id: 'W-06 收银台', node: '212:220', dock: 'cashier', shotName: 'w06-cashier',
      ready: `!!document.querySelector('[data-testid="cashier-page"]')`,
      probe: `JSON.stringify({
        mtabs: ['pick', 'cart', 'queue'].every((k) => !!document.querySelector('[data-testid="cashier-mtab-' + k + '"]')),
      })`,
      expect: (s) => s.mtabs,
      desc: '390 单栏三 tab（开单/购物车/挂单流水）',
      clickSel: '[data-testid="cashier-mtab-cart"]',
      clickReady: `!!document.querySelector('[data-testid="wsk-redline"]') && document.querySelector('[data-testid="wsk-redline"]').getBoundingClientRect().height > 0`,
      probe2: `JSON.stringify({
        redlineText: (document.querySelector('[data-testid="wsk-redline"]')?.textContent ?? '').includes('扣次非现金'),
      })`,
      expect2: (s) => s.redlineText,
      desc2: '购物车 tab：红线明面带钉在收款面板下（含「扣次非现金」）',
      shotName2: 'w06-cashier-cart',
    },
    {
      path: '/cashier/close', id: 'W-07 日结', node: '212:291', dock: 'cashier', shotName: 'w07-dayclose',
      ready: `!!document.querySelector('[data-testid="cashier-close-page"]')`,
      probe: `JSON.stringify({
        split: !!document.querySelector('[data-testid="tender-split-panel"]'),
        form: !!document.querySelector('[data-testid="dayclose-form"]'),
        list: !!document.querySelector('[data-testid="dayclose-list"]'),
      })`,
      expect: (s) => s.split && s.form && s.list,
      desc: '四分列＋日结表单＋日结单列表',
    },
    {
      path: '/cashier/refunds', id: 'W-08 退款', node: '212:362', dock: 'cashier', shotName: 'w08-refund',
      ready: `!!document.querySelector('[data-testid="cashier-refunds-page"]')`,
      probe: `JSON.stringify({
        policy: !!document.querySelector('[data-testid="refund-policy-card"]'),
        tbl: !!document.querySelector('.u3-noscrollx .u3-tbl'),
      })`,
      expect: (s) => s.policy && s.tbl,
      desc: '退款单表（DRAFT→EXECUTED）＋口径卡（涉储值锁死）',
    },
    {
      path: '/orders', id: 'W-09 商城订单', node: '213:2', dock: 'overview', shotName: 'w09-orders',
      ready: `!!document.querySelector('[data-testid="orders-page"]')`,
      probe: `JSON.stringify({
        tabs: !!document.querySelector('[data-testid="orders-tab-paid"]'),
        rebate: !!document.querySelector('[data-testid="orders-rebate-note"]'),
        tbl: !!document.querySelector('.u3-noscrollx .u3-tbl'),
      })`,
      expect: (s) => s.tabs && s.rebate && s.tbl,
      desc: '队列 chips＋回馈金仅抵商品口径明面＋订单表',
    },
    {
      path: '/products', id: 'W-10 商品', node: '213:84', dock: 'overview', shotName: 'w10-products',
      ready: `!!document.querySelector('[data-testid="products-page"]')`,
      probe: `JSON.stringify({
        search: !!document.querySelector('[data-testid="products-search"]'),
        create: !!document.querySelector('[data-testid="products-create"]'),
        tbl: !!document.querySelector('.u3-noscrollx .u3-tbl'),
      })`,
      expect: (s) => s.search && s.create && s.tbl,
      desc: '类目 chips＋台账表（低库存红字/日盘档列）',
    },
    {
      path: '/pass', id: 'W-11 会员·次卡', node: '213:166', dock: 'store', shotName: 'w11-pass',
      ready: `!!document.querySelector('[data-testid="pass-page"]')`,
      probe: `JSON.stringify({
        stats: !!document.querySelector('[data-testid="pass-stats"]'),
        tbl: !!document.querySelector('.u3-noscrollx .u3-tbl'),
        note: !!document.querySelector('[data-testid="pass-dual-home-note"]'),
      })`,
      expect: (s) => s.stats && s.tbl && s.note,
      desc: '三本账 KPI＋持卡列表＋双归属注',
    },
    {
      path: '/staff', id: 'W-12 员工', node: '213:248', dock: 'me', shotName: 'w12-staff',
      ready: `!!document.querySelector('[data-testid="staff-page"]')`,
      probe: `JSON.stringify({
        tbl: !!document.querySelector('.u3-noscrollx .u3-tbl'),
        perm: !!document.querySelector('[data-testid="staff-perm-card"]'),
      })`,
      expect: (s) => s.tbl && s.perm,
      desc: '在职员工表＋权限口径卡',
    },
    {
      path: '/finance', id: 'W-13 报表', node: '213:330', dock: 'report', shotName: 'w13-reports',
      ready: `!!document.querySelector('[data-testid="finance-page"]')`,
      probe: `JSON.stringify({
        quad: !!document.querySelector('[data-testid="finance-quad-stored"]'),
        dir: !!document.querySelector('[data-testid="report-dir"]'),
        dirD: (document.querySelector('[data-testid="report-dir"]')?.textContent ?? '').includes('D1'),
        tbl: !!document.querySelector('.u3-noscrollx .u3-tbl'),
      })`,
      expect: (s) => s.quad && s.dir && s.dirD && s.tbl,
      desc: 'KPI 四格＋月结快照＋D1–D9 目录＋台账表',
    },
    {
      path: '/matrix', id: 'W-14 权限矩阵', node: '213:412', dock: 'me', shotName: 'w14-perms',
      ready: `!!document.querySelector('[data-testid="matrix-page"]')`,
      probe: `JSON.stringify({
        phoneCards: !!document.querySelector('[data-testid="wsk-matrix-phone"]'),
        roles: document.querySelectorAll('[data-testid^="wsk-matrix-role-"]').length,
        locked: !!document.querySelector('[data-testid="matrix-locked-pill"]'),
      })`,
      expect: (s) => s.phoneCards && s.roles >= 3 && s.locked,
      desc: '手机分区卡列（非桌面缩略）＋锁死区红签',
    },
    {
      path: '/settings', id: 'W-15 门店设置', node: '213:494', dock: 'store', shotName: 'w15-settings',
      ready: `!!document.querySelector('[data-testid="settings-page"]')`,
      probe: `JSON.stringify({
        entries: !!document.querySelector('[data-testid="settings-entries"]'),
      })`,
      expect: (s) => s.entries,
      desc: '档案/营业/开关＋管理入口面板',
    },
    {
      path: '/console', id: 'W-16 运营后台', node: '213:576', dock: 'me', shotName: 'w16-ops',
      ready: `!!document.querySelector('[data-testid="console-page"]')`,
      probe: `JSON.stringify({
        home: !!document.querySelector('[data-testid="console-home"]'),
        opsName: (document.body?.innerText ?? '').includes('运营后台'),
        devWord: (document.body?.innerText ?? '').includes('开发者'),
      })`,
      expect: (s) => s.home && s.opsName && !s.devWord,
      desc: '端口卡面 home；展示名运营后台·无「开发者」',
      clickSel: '[data-testid="console-card-copy"]',
      clickReady: `!!document.querySelector('[data-testid="console-ports"]')`,
      probe2: `JSON.stringify({
        ports: !!document.querySelector('[data-testid="console-ports"]'),
        danger: !!document.querySelector('[data-testid="console-danger"]'),
        dangerText: (document.querySelector('[data-testid="console-danger"]')?.textContent ?? '').length > 4,
      })`,
      expect2: (s) => s.ports && s.danger && s.dangerText,
      desc2: '口视图：A–E 域端口目录＋危险区',
      shotName2: 'w16-ops-port',
    },
    {
      path: '/me', id: 'W-我的 店主', node: '203:5480', dock: 'me', shotName: 'w00-me',
      ready: `!!document.querySelector('[data-testid="me-page"]')`,
      probe: `JSON.stringify({
        identity: !!document.querySelector('[data-testid="me-identity"]'),
        store: (document.querySelector('[data-testid="me-store-name"]')?.textContent ?? '').length > 1,
        ops: !!document.querySelector('[data-testid="me-ops-list"]'),
        books: !!document.querySelector('[data-testid="me-books-list"]'),
        system: !!document.querySelector('[data-testid="me-system-list"]'),
        consoleEntry: !!document.querySelector('[data-testid="wsk-list-console"]'),
      })`,
      expect: (s) => s.identity && s.store && s.ops && s.books && s.system && s.consoleEntry,
      desc: '身份卡＋经营/账本/系统三组入口（owner 见运营后台端）',
    },
  ]

  for (const screen of screens) {
    await navigate(cdp, screen.path, screen.ready)
    await sleep(900)
    const state = JSON.parse(await cdp.eval(screen.probe))
    record(`${screen.id}（${screen.node}）结构：${screen.desc}`, screen.expect(state), JSON.stringify(state), state)
    await faceCheck(cdp, screen.id, { dock: screen.dock })
    await shot(cdp, screen.shotName)
    if (screen.clickSel) {
      await cdp.eval(`document.querySelector(${JSON.stringify(screen.clickSel)})?.click()`)
      if (!await cdp.waitFor(screen.clickReady)) {
        record(`${screen.id} 二态：${screen.desc2}`, false, `未就绪：${screen.clickSel}`)
      } else {
        await sleep(600)
        const state2 = JSON.parse(await cdp.eval(screen.probe2))
        record(`${screen.id} 二态：${screen.desc2}`, screen.expect2(state2), JSON.stringify(state2), state2)
        await faceCheck(cdp, `${screen.id} 二态`, { skipDock: true })
        if (screen.shotName2) await shot(cdp, screen.shotName2)
      }
    }
  }

  /* ---------- 交易请求红线（全程禁真付/退款/预约提交/开会员） ---------- */
  const forbidden = networkRequests.filter((url) =>
    /settle|refund.*(execute|approve)|appointment\/(create|book)|membership\/(sell|buy)|order.*checkout/i.test(url))
  record('全程无真付/真退/提交预约/开会员请求', forbidden.length === 0, `命中=${forbidden.length} 条`)

  const passed = results.filter((r) => r.ok).length
  const total = results.length
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ passed, total, results }, null, 2))
  console.log(`\n${passed}/${total} 通过；截图与结果已写入 ${OUT_DIR}`)
  cdp.close()
  process.exit(passed === total ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ fatal: String(error), results }, null, 2))
  process.exit(1)
})
