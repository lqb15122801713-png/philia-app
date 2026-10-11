/**
 * AboutPage · /settings/about 关于（客户端体验大批 片 1 · 账户体系域）
 *
 * - 版本号：copy 键注入（about.versionValue，内测版口径）+ 内测注记；
 * - 清除缓存钮：二次确认（ConfirmDialog 既有件）→ localStorage 清 + caches API 清 +
 *   SW 注销（无 SW 注册时静默跳过）+ reload；
 * - 协议中心入口行 → /settings/agreements。
 * 返回=PushBar 时间序回退，直访兜底 /me/settings。文案全走 copy/about.ts（abc）。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域轻屏组）：四块入册（about.head/version/agreements/
 * clear），块序/显隐=useCanvasLayout('about')（published→注册表默认序尾补，空=兜底常量）；
 * 文案键挂 CK(data-copy-key) 点选反查锚；?canvasPreview=1 探针=页首水印注记行
 * （mc.canvasExampleNote）。店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店
 * （MePage 同口径，本屏无门店概念，仅供 useCanvasLayout/Loader）。
 * 拆块说明：改造前版本行与协议入口行同居一张 m2-card；按块草案拆为 about.version/
 * about.agreements 两块后各成一张卡（协议入口行摘除 border-t 分隔线类，改 mt-3 卡间距），
 * 清除缓存卡 mt-[26px] 节奏照改造前逐字保留。
 * 块内逻辑（清缓存链路）零改动，data-testid 原值全保留。
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import { ConfirmDialog } from '../components/account/common'
import { PushBar, SecH } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { abc } from '../copy/about'
import { readLastBooking } from '@/lib/bookingPrefill'

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

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const ABOUT_DEFAULT_ORDER = ['about.head', 'about.version', 'about.agreements', 'about.clear'] as const

export default function AboutPage() {
  const { trpc } = usePhiliaClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布布局店锚（MePage 口径：?canvasStore= 预览店锚 > 记忆门店 > 就近首店；
     本屏无门店概念，仅供 useCanvasLayout/Loader） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const aboutStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'about')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : ABOUT_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('about', aboutStoreId, registryBlocks)

  const doClear = async () => {
    setClearing(true)
    await clearLocalCaches()
    window.location.reload()
  }

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. about.head：PushBar 返回条 + m2-apphead 页头大题（页头裸段置顶惯例） */
    'about.head': () => (
      <>
        <PushBar label={abc('about.pushLabel')} fallback="/me/settings" />
        <div className="m2-apphead">
          <span className="tt"><CK k="about.title">{abc('about.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. about.version：版本卡（SecH 小节题 + 版本行；版本号=about.versionValue 键） */
    'about.version': () => (
      <>
        <SecH title={abc('about.versionLabel')} />
        <div className="m2-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-ink">PHILIA</div>
              <div className="mt-0.5 text-caption text-ink-secondary"><CK k="about.betaNote">{abc('about.betaNote')}</CK></div>
            </div>
            <span className="m2-mono flex-none text-[11px] text-ink-secondary" data-testid="about-version">
              <CK k="about.versionValue">{abc('about.versionValue')}</CK>
            </span>
          </div>
        </div>
      </>
    ),

    /* 3. about.agreements：协议中心入口行（→/settings/agreements；拆块后自成一卡，
          摘除原卡内 border-t 分隔线类，卡间距 mt-3） */
    'about.agreements': () => (
      <div className="m2-card mt-3 overflow-hidden">
        <Link
          to="/settings/agreements"
          data-testid="about-agreements"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="text-body font-semibold text-ink"><CK k="about.agreements">{abc('about.agreements')}</CK></div>
            <div className="m2-mono mt-0.5 truncate text-[10px] text-ink-secondary"><CK k="about.agreementsSub">{abc('about.agreementsSub')}</CK></div>
          </div>
          <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
        </Link>
      </div>
    ),

    /* 4. about.clear：清除缓存区（卡+二次确认弹层；弹层=ConfirmDialog fixed 遮罩件，
          挂载条件照改造前=confirmOpen 状态驱动；清缓存链路零改动） */
    'about.clear': () => (
      <>
        <div className="m2-card mt-[26px] overflow-hidden">
          <button
            type="button"
            data-testid="about-clear-cache"
            onClick={() => setConfirmOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-ink"><CK k="about.clearCache">{abc('about.clearCache')}</CK></div>
              <div className="m2-mono mt-0.5 text-[10px] text-ink-secondary"><CK k="about.clearCacheDesc">{abc('about.clearCacheDesc')}</CK></div>
            </div>
            <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
          </button>
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
      </>
    ),
  }

  return (
    <CanvasLayoutLoader pageKey="about" storeId={aboutStoreId}>
      <div className="m2" data-testid="about-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="about-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：about.head=页头裸段（原结构在 m2-pad 容器外，页头按惯例置顶不参与拖序）；
            余块在 m2-pad 容器内统一块流（隐藏块整段不渲染）——默认序下仅版本/协议两卡
            拆分这一点结构差（见头注），其余零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'about.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'about.head' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
      </div>
    </CanvasLayoutLoader>
  )
}
