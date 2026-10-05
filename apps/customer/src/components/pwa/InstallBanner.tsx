/**
 * InstallBanner · PWA 安装引导条（本组件不自行挂载，由 App.tsx 主窗统一挂载）。
 *
 * - 拦截 window 'beforeinstallprompt'（preventDefault 拦存 ref），未安装且拦到时
 *   渲染引导条：固定底部 dock 上方（bottom 偏移 = dock 底 14 + 高 64 + 间隔 8，
 *   z 层级同 dock 档 z-tabbar，不与 AppDock 重叠）；
 * - 「安装」调拦存事件 prompt()，按 userChoice 收尾：accepted 收起（appinstalled
 *   另写已装标记），dismissed 仅本次收起（不持久化，下次可再出）；
 * - 「暂不」关闭并持久化 localStorage 'philia.pwaInstallDismissed'='1'（不再主动出）；
 *   'appinstalled' 后写 'philia.pwaInstalled'='1' 并永不渲染；
 * - iOS Safari 无 beforeinstallprompt：检测 iOS + Safari 且未 standalone 时
 *   改出手动指引条（「用 Safari 分享 → 添加到主屏幕」），同样可关闭持久化；
 * - 文案走 copy 域访问器 hc（apps/customer/src/copy/home.ts，HOME_COPY 表）；
 *   视觉同 dock 口径（深棕 rgba(46,35,24,.94) + blur，淡黄 #F2DFA6 点睛钮）。
 */

import { useEffect, useRef, useState } from 'react'
import { hc } from '@/copy/home'

const DISMISS_KEY = 'philia.pwaInstallDismissed'
const INSTALLED_KEY = 'philia.pwaInstalled'

/** Chromium 专有事件，lib.dom 无内置类型，此处按 W3C 草案契约声明 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** iOS Safari 判定（排除 CriOS/FxiOS 等套壳——它们同样不出 beforeinstallprompt，
 *  但分享入口文案只对 Safari 成立） */
function isIosSafari(): boolean {
  const ua = window.navigator.userAgent
  return /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** localStorage 不可用（隐私模式等）时静默退化：同 live 页 clientId 持久化口径 */
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    /* 忽略：存储不可用时引导条退化为会话态 */
  }
}

export default function InstallBanner() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosGuide, setIosGuide] = useState(false)

  useEffect(() => {
    if (readFlag(INSTALLED_KEY) || readFlag(DISMISS_KEY) || isStandalone()) return

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredRef.current = e as BeforeInstallPromptEvent
      setIosGuide(false)
      setVisible(true)
    }
    const onAppInstalled = () => {
      writeFlag(INSTALLED_KEY)
      deferredRef.current = null
      setVisible(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    /* iOS Safari：无 beforeinstallprompt，出手动指引条 */
    if (isIosSafari()) {
      setIosGuide(true)
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    writeFlag(DISMISS_KEY)
    deferredRef.current = null
    setVisible(false)
  }

  const install = async () => {
    const deferred = deferredRef.current
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferredRef.current = null
    if (outcome === 'accepted') {
      setVisible(false)
    }
  }

  return (
    <div
      data-testid="pwa-install-banner"
      className="fixed inset-x-0 bottom-[calc(86px+env(safe-area-inset-bottom))] z-tabbar"
      role="region"
      aria-label="安装应用"
    >
      <div className="mx-auto max-w-lg px-4">
        {/* 形态同 AppDock 悬浮胶囊：深棕 rgba(46,35,24,.94) + blur(18px) saturate(140%) */}
        <div
          className="flex items-center gap-3 rounded-[20px] px-4 py-3"
          style={{
            background: 'rgba(46,35,24,.94)',
            backdropFilter: 'blur(18px) saturate(140%)',
            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          }}
        >
          <span className="flex-1 text-body text-[#F6EFDD]">
            {iosGuide ? hc('home.pwaInstallIosGuide') : hc('home.pwaInstallTitle')}
          </span>
          {iosGuide ? null : (
            <button
              type="button"
              onClick={install}
              data-testid="pwa-install-banner-install"
              className="shrink-0 rounded-full bg-[#F2DFA6] px-4 py-1.5 text-body font-semibold text-[#3B2E24] transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {hc('home.pwaInstallAction')}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label={hc('home.pwaInstallDismiss')}
            data-testid="pwa-install-banner-dismiss"
            className="shrink-0 px-2 py-1.5 text-caption text-[#B9A98F]"
          >
            {hc('home.pwaInstallDismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
