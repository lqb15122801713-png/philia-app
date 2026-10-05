/**
 * AboutPage · /settings/about 关于（客户端体验大批 片 1 · 账户体系域）
 *
 * - 版本号：copy 键注入（about.versionValue，内测版口径）+ 内测注记；
 * - 清除缓存钮：二次确认（ConfirmDialog 既有件）→ localStorage 清 + caches API 清 +
 *   SW 注销（无 SW 注册时静默跳过）+ reload；
 * - 协议中心入口行 → /settings/agreements。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/about.ts（abc）。
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { abc } from '../copy/about'

/** 清除本机缓存：localStorage + Cache Storage + SW 注销（逐件防御，失败不阻断重载） */
async function clearLocalCaches(): Promise<void> {
  try {
    window.localStorage.clear()
  } catch {
    /* 隐私模式等写失败：跳过 */
  }
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys()
      await Promise.all(keys.map((k) => window.caches.delete(k)))
    }
  } catch {
    /* Cache API 不可用：跳过 */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    /* SW 不可用：跳过 */
  }
}

export default function AboutPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const doClear = async () => {
    setClearing(true)
    await clearLocalCaches()
    window.location.reload()
  }

  return (
    <div className="m2" data-testid="about-page" style={{ minHeight: '100vh' }}>
      <PushBar label={abc('about.pushLabel')} fallback="/me/settings" />
      <div className="m2-apphead">
        <span className="tt">{abc('about.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        <SecH title={abc('about.versionLabel')} />
        <div className="m2-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-ink">PHILIA</div>
              <div className="mt-0.5 text-caption text-ink-secondary">{abc('about.betaNote')}</div>
            </div>
            <span className="m2-mono flex-none text-[11px] text-ink-secondary" data-testid="about-version">
              {abc('about.versionValue')}
            </span>
          </div>
          <Link
            to="/settings/agreements"
            data-testid="about-agreements"
            className="flex w-full items-center gap-3 border-t border-line-divider px-4 py-3.5 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-ink">{abc('about.agreements')}</div>
              <div className="m2-mono mt-0.5 truncate text-[10px] text-ink-secondary">{abc('about.agreementsSub')}</div>
            </div>
            <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
          </Link>
        </div>

        <div className="m2-card mt-[26px] overflow-hidden">
          <button
            type="button"
            data-testid="about-clear-cache"
            onClick={() => setConfirmOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-ink">{abc('about.clearCache')}</div>
              <div className="m2-mono mt-0.5 text-[10px] text-ink-secondary">{abc('about.clearCacheDesc')}</div>
            </div>
            <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <ConfirmDialog
          title={abc('about.clearConfirmTitle')}
          body={abc('about.clearConfirmBody')}
          okText={clearing ? abc('about.clearing') : abc('about.clearOk')}
          cancelText={abc('about.clearCancel')}
          pending={clearing}
          danger={false}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void doClear()}
          okTestId="about-clear-confirm"
        />
      ) : null}
    </div>
  )
}
