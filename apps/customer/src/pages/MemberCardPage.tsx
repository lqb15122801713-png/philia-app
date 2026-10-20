import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useNavigationType } from 'react-router-dom'
import { CanvasLayoutLoader, CK, useCanvasLayout, useMe, usePhiliaClient } from '@philia/shared'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { MemberBarcode, MemberQrCode } from '../components/member/MemberCodeVisual'
import { mc } from '../components/member/copy'
import { TipCard } from '../components/member/v2'
import { useMemberCardToken } from '../components/member/useMemberCardToken'
import { readLastBooking } from '@/lib/bookingPrefill'

async function writeTokenToClipboard(token: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(token)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = token
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      return document.execCommand('copy')
    } finally {
      textarea.remove()
    }
  }
}

const Q1_DEFAULT_ORDER = ['q1.cardFace', 'q1.code', 'q1.guide', 'q1.pass', 'q1.footer'] as const
const CARD_BLOCK_KEYS = new Set(['q1.cardFace', 'q1.code'])

export default function MemberCardPage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const navigate = useNavigate()
  const navigationType = useNavigationType()

  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    enabled: !!user,
  })

  const membership = myQ.data?.membership ?? null
  const plan = myQ.data?.plan ?? null
  const nickname = meRawQ.data?.user?.nickname ?? '铲屎官'
  const tierLabel = plan ? plan.label.replace(/^会员档·/, '').replace(/：.*$/, '') : mc('me.tagGuest')
  const isMember = !!user && !!membership
  const cardToken = useMemberCardToken(isMember)

  const [copyResult, setCopyResult] = useState<{ status: 'idle' | 'copied' | 'error'; token: string | null }>({ status: 'idle', token: null })
  const copyToken = async () => {
    const token = cardToken.token
    if (!token) return
    try {
      const ok = await writeTokenToClipboard(token)
      setCopyResult({ status: ok ? 'copied' : 'error', token })
    } catch {
      setCopyResult({ status: 'error', token })
    }
  }
  const copyStatus = copyResult.token === cardToken.token && !cardToken.countdown.expired ? copyResult.status : 'idle'

  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    enabled: previewStoreId === null && memoryStoreId === null,
    staleTime: 300_000,
  })
  const q1StoreId = previewStoreId ?? memoryStoreId ?? nearbyQ.data?.stores?.[0]?.id ?? null

  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((block) => block.pageKey === 'memberCard')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : Q1_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('memberCard', q1StoreId, registryBlocks)

  const closePage = () => {
    if (navigationType === 'PUSH') navigate(-1)
    else navigate('/me')
  }

  const renderers: Record<string, () => ReactNode> = {
    'q1.cardFace': () => (
      <div className="membercard-name" data-testid="membercard-tier">
        {nickname} · {tierLabel}
      </div>
    ),

    'q1.code': () => (
      <div className="membercard-code" data-testid="membercard-qr">
        {isMember ? (
          cardToken.isPending ? (
            <div className="membercard-qrbox membercard-qrbox--pending" data-u3-secondary>待换</div>
          ) : cardToken.isError ? (
            <div className="membercard-token-error">
              <p><CK k="q1.tokenFail">{mc('q1.tokenFail')}</CK></p>
              <button type="button" className="m2-link" data-testid="membercard-token-retry" onClick={cardToken.issue}>
                <CK k="q1.tokenRetry">{mc('q1.tokenRetry')}</CK>
              </button>
            </div>
          ) : cardToken.token ? (
            <>
              <div className="membercard-qrbox">
                <MemberQrCode token={cardToken.token} size={140} />
              </div>
              <button type="button" className="membercard-barcode-button" data-testid="membercard-copy" onClick={copyToken} aria-label={mc('q1.copyToken')}>
                <MemberBarcode token={cardToken.token} className="membercard-barcode" testId="membercard-barcode" />
              </button>
              <p className="membercard-scanhint" data-u3-secondary><CK k="q1.scanHint">{mc('q1.scanHint')}</CK></p>
              <span className="sr-only" data-testid="membercard-token">{cardToken.token}</span>
              {copyStatus !== 'idle' ? (
                <span className="sr-only" data-testid="membercard-copy-status" role="status" aria-live="polite">
                  {copyStatus === 'copied' ? mc('q1.copied') : mc('q1.copyFailed')}
                </span>
              ) : null}
            </>
          ) : null
        ) : null}
      </div>
    ),

    'q1.guide': () => {
      if (membership) return null
      return (
        <div className="membercard-guide">
          <TipCard>
            <CK k="q1.nonMemberGuide">{mc('q1.nonMemberGuide')}</CK>
          </TipCard>
          <button
            type="button"
            className="m2-btn-primary m2-press"
            data-testid="membercard-guide-link"
            onClick={() => navigate('/member/open')}
          >
            <CK k="q1.nonMemberCta">{mc('q1.nonMemberCta')}</CK>
          </button>
        </div>
      )
    },

    'q1.pass': () => null,

    'q1.footer': () => (
      <div className="membercard-footer" data-u3-secondary>
        <CK k="q1.autoFooter">{mc('q1.autoFooter')}</CK>
        {cardToken.token ? <span className="sr-only">{mc('q1.refreshNote', { mm: cardToken.countdown.mm, ss: cardToken.countdown.ss })}</span> : null}
      </div>
    ),
  }

  const visibleCardBlocks = layout.filter((block) => block.visible && CARD_BLOCK_KEYS.has(block.blockKey))
  const firstVisibleCardKey = visibleCardBlocks[0]?.blockKey ?? null

  return (
    <CanvasLayoutLoader pageKey="memberCard" storeId={q1StoreId}>
      <div className="m2 m2--vi membercard-full" data-testid="member-card-page">
        <div className="membercard-top">
          <button type="button" className="membercard-close" data-testid="membercard-close" onClick={closePage}>
            <CK k="q1.close">{mc('q1.close')}</CK>
          </button>
        </div>

        {isCanvasPreview ? (
          <p className="membercard-preview-note" data-testid="membercard-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
        ) : null}

        {myQ.isPending || meRawQ.isPending ? (
          <div className="membercard-flow">
            <div className="membercard-panel membercard-panel--state"><LoadingBlock lines={3} /></div>
          </div>
        ) : myQ.isError || meRawQ.isError ? (
          <div className="membercard-flow">
            <div className="membercard-panel membercard-panel--state">
              <ErrorState
                message={mc('common.memberLoadFail')}
                onRetry={() => {
                  void myQ.refetch()
                  void meRawQ.refetch()
                }}
              />
            </div>
          </div>
        ) : (
          <div className="membercard-flow">
            {layout.map((block) => {
              if (!block.visible) return null
              if (CARD_BLOCK_KEYS.has(block.blockKey)) {
                if (block.blockKey !== firstVisibleCardKey) return null
                return (
                  <div className="membercard-panel" data-testid="membercard-panel" key="membercard-panel">
                    {visibleCardBlocks.map((item) => (
                      <section data-block-key={item.blockKey} key={item.blockKey}>
                        {renderers[item.blockKey]?.() ?? null}
                      </section>
                    ))}
                  </div>
                )
              }
              return (
                <section data-block-key={block.blockKey} key={block.blockKey}>
                  {renderers[block.blockKey]?.() ?? null}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </CanvasLayoutLoader>
  )
}
