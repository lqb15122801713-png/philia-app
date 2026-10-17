#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://127.0.0.1:7130').replace(/\/$/, '')
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:7200').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_PORT ?? 9237)
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'final'
const OUT_DIR = process.env.EVIDENCE_DIR ?? join('evidence', 'aesthetic-fix-n6n7')
const DB_URL = process.env.PHILIA_DB_URL ?? 'file:server/data/aesthetic-fix-n6n7.db'
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
const profileDir = join(tmpdir(), `philia-aesthetic-n6n7-${process.pid}`)

function record(id, ok, detail, measurements) {
  results.push({ id, ok, detail, measurements })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`)
}

function prepareFixtures() {
  if (!DB_URL.startsWith('file:') || !DB_URL.includes('aesthetic-fix-n6n7')) {
    throw new Error(`拒绝在非 PD-33 专用夹具库上写数据：${DB_URL}`)
  }
  const code = `(async()=>{ const { client } = await import('./server/src/db/index.ts'); await client.execute({ sql: "DELETE FROM pets WHERE owner_id IN (SELECT id FROM users WHERE phone = '19900000228')", args: [] }); await client.execute({ sql: "UPDATE products SET stock = 0 WHERE name = '全价成犬粮 2kg'", args: [] }); client.close(); })()`
  execFileSync(process.execPath, ['server/node_modules/tsx/dist/cli.mjs', '-e', code], {
    cwd: ROOT,
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
  await navigate(cdp, '/dev-login', `(document.body?.innerText ?? '').includes('选择种子用户登录')`)
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '19900000228' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`)
  if (status !== 200) throw new Error(`浏览器 dev-login HTTP ${status}`)
}

async function shot(cdp, name) {
  mkdirSync(OUT_DIR, { recursive: true })
  const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT_DIR, `${PREFIX}-${name}.png`), Buffer.from(image.data, 'base64'))
}

async function setViewport(cdp, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true })
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom: 34, right: 0 } })
}

async function checkN6(cdp, height) {
  await setViewport(cdp, height)
  await navigate(cdp, '/mall', `!!document.querySelector('[data-testid="app-dock"]') && [...document.querySelectorAll('.u1-card')].some((card) => card.innerText.includes('全价成犬粮'))`)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const card = [...document.querySelectorAll('.u1-card')].find((item) => item.innerText.includes('全价成犬粮'))
    const price = card.querySelector('.u1-num')
    const soldOut = [...card.querySelectorAll('span')].find((span) => span.textContent.includes('已售罄'))
    const dock = document.querySelector('[data-testid="app-dock"]').firstElementChild.firstElementChild
    const priceRect = price.getBoundingClientRect()
    const soldOutRect = soldOut?.getBoundingClientRect() ?? null
    const dockRect = dock.getBoundingClientRect()
    const hit = document.elementFromPoint(priceRect.left + priceRect.width / 2, priceRect.top + priceRect.height / 2)
    const imgFit = getComputedStyle(card.querySelector('img')).objectFit
    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      productName: card.innerText.split('\\n')[0],
      price: { text: price.textContent, top: priceRect.top, bottom: priceRect.bottom },
      soldOut: soldOutRect ? { text: soldOut.textContent, top: soldOutRect.top, bottom: soldOutRect.bottom } : null,
      dock: { top: dockRect.top, bottom: dockRect.bottom },
      priceClearance: dockRect.top - priceRect.bottom,
      soldOutClearance: soldOutRect ? dockRect.top - soldOutRect.bottom : null,
      priceCovered: priceRect.bottom > dockRect.top && priceRect.top < dockRect.bottom,
      soldOutCovered: soldOutRect ? soldOutRect.bottom > dockRect.top && soldOutRect.top < dockRect.bottom : null,
      priceClickable: hit === price || price.contains(hit),
      hitTestId: hit?.closest?.('[data-testid]')?.dataset.testid ?? hit?.tagName ?? null,
      imgFit,
      bannerPresent: !!document.querySelector('[data-testid="pwa-install-banner"]'),
    }
  })())`))
  const fitOk = height > 804 || measurements.imgFit === 'contain'
  const ok = measurements.scrollY === 0 && measurements.soldOut && measurements.priceClearance >= 8 && measurements.soldOutClearance >= 8
    && !measurements.priceCovered && !measurements.soldOutCovered && measurements.priceClickable && fitOk && !measurements.bannerPresent
  record(`N6 商城首行价与已售罄清出 AppDock（390×${height}）`, ok, `scrollY=${measurements.scrollY}；价净空=${Math.round(measurements.priceClearance)}；售罄净空=${Math.round(measurements.soldOutClearance)}；dockTop=${Math.round(measurements.dock.top)}；fit=${measurements.imgFit}；安装条=${measurements.bannerPresent}；命中=${measurements.hitTestId}`, measurements)
  await shot(cdp, `n6-mall-price-${height}`)
}

async function checkN7(cdp, height) {
  await setViewport(cdp, height)
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-pets-empty"]') && !!document.querySelector('[data-testid="home-pets-manage"]')`)
  await cdp.eval('window.scrollTo(0, 0)')
  await sleep(300)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const guide = document.querySelector('[data-testid="home-pets-empty"]')
    const manage = document.querySelector('[data-testid="home-pets-manage"]')
    const dock = document.querySelector('[data-testid="app-dock"]').firstElementChild.firstElementChild
    const central = document.querySelector('[data-testid="app-dock-philia"]')
    const guideRect = guide.getBoundingClientRect()
    const manageRect = manage.getBoundingClientRect()
    const dockRect = dock.getBoundingClientRect()
    const centralRect = central.getBoundingClientRect()
    const overlapsCentralX = guideRect.right >= centralRect.left && guideRect.left <= centralRect.right
    const obstructionTop = overlapsCentralX ? centralRect.top - 3 : dockRect.top
    const hitAt = (rect) => document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const guideHit = hitAt(guideRect)
    const manageHit = hitAt(manageRect)
    return {
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      guide: { text: guide.textContent.trim(), top: guideRect.top, bottom: guideRect.bottom },
      manage: { width: manageRect.width, height: manageRect.height, top: manageRect.top, bottom: manageRect.bottom },
      dock: { top: dockRect.top, bottom: dockRect.bottom },
      central: { top: centralRect.top, bottom: centralRect.bottom, left: centralRect.left, right: centralRect.right },
      obstructionTop,
      clearance: obstructionTop - guideRect.bottom,
      covered: guideRect.bottom > obstructionTop && guideRect.top < dockRect.bottom,
      guideClickable: guideHit === guide || guide.contains(guideHit),
      manageClickable: manageHit === manage || manage.contains(manageHit),
      manageVisible: manageRect.width >= 44 && manageRect.height >= 44 && manageRect.top >= 0 && manageRect.bottom <= innerHeight,
      manageGuideOverlap: manageRect.bottom > guideRect.top && manageRect.top < guideRect.bottom,
      distinctTargets: guide !== manage,
      hitTestId: guideHit?.closest?.('[data-testid]')?.dataset.testid ?? guideHit?.tagName ?? null,
      manageHitTestId: manageHit?.closest?.('[data-testid]')?.dataset.testid ?? manageHit?.tagName ?? null,
      bannerPresent: !!document.querySelector('[data-testid="pwa-install-banner"]'),
    }
  })())`))
  const ok = measurements.scrollY === 0 && measurements.clearance >= 8 && !measurements.covered && measurements.guideClickable && measurements.manageVisible && measurements.manageClickable && !measurements.manageGuideOverlap && measurements.distinctTargets && !measurements.bannerPresent
  record(`N7 首页空宠引导清出 AppDock 且管理仍可见（390×${height}）`, ok, `scrollY=${measurements.scrollY}；净空=${Math.round(measurements.clearance)}；中央顶=${Math.round(measurements.obstructionTop)}；管理命中=${measurements.manageHitTestId}；管理=${measurements.manage.width}×${measurements.manage.height}；安装条=${measurements.bannerPresent}；命中=${measurements.hitTestId}`, measurements)
  await shot(cdp, `n7-home-empty-pets-${height}`)
}

async function checkBannerCopy(cdp, height) {
  await setViewport(cdp, height)
  await navigate(cdp, '/home', `!!document.querySelector('[data-testid="home-pets-empty"]')`)
  await cdp.eval(`(() => {
    if (document.querySelector('[data-testid="home-banner-copy"]')) return
    const banner = document.querySelector('[data-testid="home-banner"]')
    const copy = document.createElement('div')
    copy.dataset.testid = 'home-banner-copy'
    copy.className = 'absolute inset-x-0 bottom-[100px] z-[3] px-6'
    copy.innerHTML = '<p class="text-title-lg font-bold text-ink">本周上新</p><p class="mt-1 text-caption text-ink-secondary">给它们更好的</p><span class="mt-2 inline-block rounded-full bg-[#F2DC8C] px-3 py-1 text-caption-xs font-bold text-ink">去看看</span>'
    banner.appendChild(copy)
  })()`)
  await sleep(200)
  const measurements = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const copy = document.querySelector('[data-testid="home-banner-copy"]')
    const notify = document.querySelector('[data-testid="home-notify-entry"]')
    const guide = document.querySelector('[data-testid="home-pets-empty"]')
    const manage = document.querySelector('[data-testid="home-pets-manage"]')
    const central = document.querySelector('[data-testid="app-dock-philia"]')
    const dock = document.querySelector('[data-testid="app-dock"]').firstElementChild.firstElementChild
    const idband = document.querySelector('[data-testid="home-idband"]')
    const memberCode = document.querySelector('[data-testid="home-member-code"]')
    const entryCard = document.querySelector('[data-testid="home-entry-card"]')
    const copyRect = copy.getBoundingClientRect()
    const notifyRect = notify.getBoundingClientRect()
    const guideRect = guide.getBoundingClientRect()
    const manageRect = manage.getBoundingClientRect()
    const centralRect = central.getBoundingClientRect()
    const dockRect = dock.getBoundingClientRect()
    const idbandRect = idband.getBoundingClientRect()
    const memberCodeRect = memberCode.getBoundingClientRect()
    const acRect = idband.querySelector('.ac').getBoundingClientRect()
    const entryRect = entryCard.getBoundingClientRect()
    const hitAt = (rect) => document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const notifyHit = hitAt(notifyRect)
    const guideHit = hitAt(guideRect)
    const manageHit = hitAt(manageRect)
    const memberCodeHit = hitAt(memberCodeRect)
    const idbandTextHit = hitAt(idbandRect)
    const overlapsCentralX = guideRect.right >= centralRect.left && guideRect.left <= centralRect.right
    const obstructionTop = overlapsCentralX ? centralRect.top - 3 : dockRect.top
    return {
      copy: { top: copyRect.top, bottom: copyRect.bottom },
      notify: { top: notifyRect.top, bottom: notifyRect.bottom },
      overlap: copyRect.bottom > notifyRect.top && copyRect.top < notifyRect.bottom,
      notifyClickable: notifyHit === notify || notify.contains(notifyHit),
      guide: { top: guideRect.top, bottom: guideRect.bottom },
      clearance: obstructionTop - guideRect.bottom,
      guideClickable: guideHit === guide || guide.contains(guideHit),
      manageClickable: manageHit === manage || manage.contains(manageHit),
      idbandTextClickable: idbandTextHit === idband || idband.contains(idbandTextHit),
      idbandTextHitTestId: idbandTextHit?.closest?.('[data-testid]')?.dataset.testid ?? idbandTextHit?.tagName ?? null,
      acCoveredByEntry: entryRect.bottom > acRect.top && entryRect.top < acRect.bottom,
      memberCodeCoveredByEntry: entryRect.bottom > memberCodeRect.top && entryRect.top < memberCodeRect.bottom,
      memberCodeClickable: memberCodeHit === memberCode || memberCode.contains(memberCodeHit),
      memberCodeHitTestId: memberCodeHit?.closest?.('[data-testid]')?.dataset.testid ?? memberCodeHit?.tagName ?? null,
      obstructionTop,
      hitTestId: notifyHit?.closest?.('[data-testid]')?.dataset.testid ?? notifyHit?.tagName ?? null,
      guideHitTestId: guideHit?.closest?.('[data-testid]')?.dataset.testid ?? guideHit?.tagName ?? null,
      manageHitTestId: manageHit?.closest?.('[data-testid]')?.dataset.testid ?? manageHit?.tagName ?? null,
      bannerSpaceHeight: document.querySelector('.hv2-banner-space').getBoundingClientRect().height,
      bannerPresent: !!document.querySelector('[data-testid="pwa-install-banner"]'),
    }
  })())`))
  const ok = !measurements.overlap && measurements.notifyClickable && measurements.bannerSpaceHeight === 165 && measurements.clearance >= 8 && measurements.guideClickable && measurements.manageClickable && measurements.idbandTextClickable && measurements.memberCodeClickable && !measurements.acCoveredByEntry && !measurements.memberCodeCoveredByEntry && !measurements.bannerPresent
  record('N7 有运营文案时 banner、引导与管理均不被遮', ok, `文案=${Math.round(measurements.copy.top)}–${Math.round(measurements.copy.bottom)}；通知=${Math.round(measurements.notify.top)}–${Math.round(measurements.notify.bottom)}；引导净空=${Math.round(measurements.clearance)}；引导命中=${measurements.guideHitTestId}；管理命中=${measurements.manageHitTestId}；身份带命中=${measurements.idbandTextHitTestId}；ac叠=${measurements.acCoveredByEntry}；会员码叠=${measurements.memberCodeCoveredByEntry}；banner高=${measurements.bannerSpaceHeight}`, measurements)
  await shot(cdp, `n7-home-banner-copy-${height}`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  prepareFixtures()
  const wsUrl = await launchBrowser()
  const cdp = new Cdp(wsUrl)
  await cdp.open()
  await login(cdp)
  await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
  for (const height of [844, 804, 803, 751, 750, 700, 667]) await checkN6(cdp, height)
  for (const height of [844, 766, 767, 700, 667]) await checkN7(cdp, height)
  await checkBannerCopy(cdp, 700)
  await checkBannerCopy(cdp, 667)
  cdp.close()
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({
    at: new Date().toISOString(),
    base: CUSTOMER_URL,
    results,
  }, null, 2))
  if (results.length !== 14) {
    console.error(`检查数不符：期望 14，实际 ${results.length}；拒绝空跑假绿`)
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
