/**
 * AgreementsPage · /settings/agreements 协议中心（客户端体验大批 片 1 · 账户体系域）
 *
 * 四件：用户协议 / 隐私政策 / 会员服务协议 / 寄养协议——列表行点开全文（BottomSheet
 * 既有件）。会员服务协议全文=copy/pay.ts PAY_AGREEMENTS 同源件（member_service，
 * 版本同源）；其余三件=copy/agreements.ts AGR_DOCS 内测期简版诚实文本（明面注记
 * 「内测期简版，正式条款以上线版本与门店公示为准」，不虚构条款）。
 * 返回=PushBar 时间序回退，直访兜底 /settings/about。文案全走 copy/agreements.ts（agc）。
 *
 * 画布化（产品-1010 片 3 末片 · 账户域轻屏组）：四块入册（agr.head/list/note/doc），
 * 块序/显隐=useCanvasLayout('agreements')（published→注册表默认序尾补，空=兜底常量）；
 * 文案键挂 CK(data-copy-key) 点选反查锚；?canvasPreview=1 探针=页首水印注记行
 * （mc.canvasExampleNote）。店锚=?canvasStore= 预览店锚 > 记忆门店 > 就近首店
 * （MePage 同口径，本屏无门店概念，仅供 useCanvasLayout/Loader）。
 * 协议正文长文位（裁死件③）：三件简版全文=copy 键 agr.docUser/docPrivacy/docBoarding
 * 渲染处取值（画布长文位可改），版本号 version 保持码内不动；member_service 正文读
 * PAY_AGREEMENTS 同源件不动（无 CK 锚，如实报备）。agr.doc=协议正文弹层块
 * （BottomSheet fixed 遮罩件，关闭态渲染 null，挂载条件照改造前=open 状态驱动）。
 * 块内逻辑零改动，data-testid 原值全保留。
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CanvasLayoutLoader, CK, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import BottomSheet from '../components/booking/single/BottomSheet'
import { PushBar } from '../components/member/v2'
import { mc } from '../components/member/copy'
import { agc, AGR_DOCS, type AgreementsCopyKey } from '../copy/agreements'
import { PAY_AGREEMENTS } from '../copy/pay'
import { readLastBooking } from '@/lib/bookingPrefill'

interface AgreementEntry {
  key: string
  title: string
  /** 展示名 copy 键（CK 反查锚） */
  titleKey: AgreementsCopyKey
  version: string
  /** 静态全文（member_service=PAY_AGREEMENTS 同源件，码内不动） */
  content: string | null
  /** 全文 copy 键（三件简版=画布长文位，渲染处取值；member_service=无键 null） */
  contentKey: AgreementsCopyKey | null
  /** 内测期简版注记（会员服务协议为正式同源件，不打简版标） */
  beta: boolean
}

const ENTRIES: readonly AgreementEntry[] = [
  ...AGR_DOCS.filter((d) => d.agreementKey === 'user').map((d) => ({
    key: d.agreementKey,
    title: agc(d.titleKey),
    titleKey: d.titleKey,
    version: d.version,
    content: null,
    contentKey: d.contentKey,
    beta: true,
  })),
  ...AGR_DOCS.filter((d) => d.agreementKey === 'privacy').map((d) => ({
    key: d.agreementKey,
    title: agc(d.titleKey),
    titleKey: d.titleKey,
    version: d.version,
    content: null,
    contentKey: d.contentKey,
    beta: true,
  })),
  ...PAY_AGREEMENTS.filter((d) => d.agreementKey === 'member_service').map((d) => ({
    key: d.agreementKey,
    title: agc('agr.memberService' as const),
    titleKey: 'agr.memberService' as AgreementsCopyKey,
    version: d.version,
    content: d.content,
    contentKey: null,
    beta: false,
  })),
  ...AGR_DOCS.filter((d) => d.agreementKey === 'boarding').map((d) => ({
    key: d.agreementKey,
    title: agc(d.titleKey),
    titleKey: d.titleKey,
    version: d.version,
    content: null,
    contentKey: d.contentKey,
    beta: true,
  })),
]

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const AGR_DEFAULT_ORDER = ['agr.head', 'agr.list', 'agr.note', 'agr.doc'] as const

export default function AgreementsPage() {
  const { trpc } = usePhiliaClient()
  /* PD-82 登录协议可点（R17 回归）：支持 ?doc=user|privacy|member_service|boarding
     直开对应协议全文（登录页页脚真链落点；/agreements 公开路由亦同口径） */
  const [open, setOpen] = useState<AgreementEntry | null>(() => {
    const docKey = new URLSearchParams(window.location.search).get('doc')
    return ENTRIES.find((e) => e.key === docKey) ?? null
  })

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
  const agrStoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'agreements')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : AGR_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('agreements', agrStoreId, registryBlocks)

  /* 协议全文取值：三件简版=渲染处经 copy 键取（画布长文位实时预览管道）；
     member_service=静态同源件（码内不动） */
  const openContent = open ? (open.contentKey ? agc(open.contentKey) : open.content) : null

  /* 块渲染器（块内逻辑零改动——四块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. agr.head：PushBar 返回条 + m2-apphead 页头大题（页头裸段置顶惯例） */
    'agr.head': () => (
      <>
        <PushBar label={agc('agr.pushLabel')} fallback="/settings/about" />
        <div className="m2-apphead">
          <span className="tt"><CK k="agr.title">{agc('agr.title')}</CK></span>
        </div>
      </>
    ),

    /* 2. agr.list：协议四件列表（用户/隐私/会员服务/寄养；版本号+内测简版标同行） */
    'agr.list': () => (
      <div className="m2-card overflow-hidden">
        {ENTRIES.map((e) => (
          <button
            key={e.key}
            type="button"
            data-testid={`agreement-${e.key}`}
            onClick={() => setOpen(e)}
            className="flex w-full items-center gap-3 border-t border-line-divider px-4 py-3.5 text-left first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-ink"><CK k={e.titleKey}>{e.title}</CK></div>
              <div className="m2-mono mt-0.5 text-[10px] text-ink-secondary">
                <CK k="agr.version">{agc('agr.version', { version: e.version })}</CK>
                {e.beta ? (
                  <>
                    {' · '}
                    <CK k="agr.betaMark">{agc('agr.betaMark')}</CK>
                  </>
                ) : null}
              </div>
            </div>
            <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    ),

    /* 3. agr.note：内测注脚（简版诚实口径明面注记） */
    'agr.note': () => (
      <p className="m2-note mt-4 text-center"><CK k="agr.betaNote">{agc('agr.betaNote')}</CK></p>
    ),

    /* 4. agr.doc：协议正文弹层（BottomSheet fixed 遮罩件，关闭态渲染 null；
          三件简版正文=copy 键长文位（动态 CK 锚），member_service=同源件无 CK 锚） */
    'agr.doc': () =>
      open ? (
        <BottomSheet title={open.title} onClose={() => setOpen(null)} testId="agreement-sheet">
          <p className="m2-mono text-[10px] text-ink-secondary">
            <CK k="agr.version">{agc('agr.version', { version: open.version })}</CK>
            {open.beta ? (
              <>
                {' · '}
                <CK k="agr.betaMark">{agc('agr.betaMark')}</CK>
              </>
            ) : null}
          </p>
          {open.beta ? <p className="m2-note mt-2"><CK k="agr.betaNote">{agc('agr.betaNote')}</CK></p> : null}
          <div className="mt-3 whitespace-pre-line text-body-sm leading-[1.9] text-ink">
            {open.contentKey ? <CK k={open.contentKey}>{openContent}</CK> : openContent}
          </div>
        </BottomSheet>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="agreements" storeId={agrStoreId}>
      <div className="m2" data-testid="agreements-page" style={{ minHeight: '100vh' }}>
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <div className="px-[22px]" style={{ marginTop: 10 }}>
            <p className="text-center text-caption-xs text-ink-secondary" data-testid="agreements-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
          </div>
        ) : null}
        {/* 块流：agr.head=页头裸段（原结构在 m2-pad 容器外，页头按惯例置顶不参与拖序）；
            余块在 m2-pad 容器内统一块流（隐藏块整段不渲染；agr.doc 弹层块关闭态渲染
            null）——默认序下 DOM 结构零差异 */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'agr.head' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
          {layout.map((b) =>
            b.visible && b.blockKey !== 'agr.head' ? (
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
