import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, ClipboardCheck, Ticket } from 'lucide-react'
import { resolveSlotUrl, usePhiliaClient } from '@philia/shared'
import { MAGAZINE_ARTICLES, magazineEntryOf, mgc } from '../copy/magazine'
import { fenToYuan } from '../components/mall/format'

function CoverArt({
  url,
  alt,
  className,
  priority = false,
}: {
  url: string | null
  alt: string
  className: string
  priority?: boolean
}) {
  const [imgOk, setImgOk] = useState(true)
  const src = resolveSlotUrl(url)
  if (src && imgOk) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setImgOk(false)}
        className={className}
        {...(priority ? { fetchPriority: 'high' } : { loading: 'lazy' })}
      />
    )
  }
  return (
    <div
      aria-label={alt}
      role="img"
      className={`flex items-center justify-center bg-[linear-gradient(135deg,#FAF7F0_0%,#F3EEE4_52%,#E9E1D2_100%)] ${className}`}
    >
      <span className="rounded-full bg-card/75 px-2.5 py-1 text-[12px] font-medium text-ink-secondary" data-u4-secondary>
        {mgc('mag.pendingImage')}
      </span>
    </div>
  )
}

const SHORTCUTS = [
  { labelKey: 'mag.shortcutBenefits', to: '/member', Icon: BadgeCheck },
  { labelKey: 'mag.shortcutCoupons', to: '/me/coupons', Icon: Ticket },
  { labelKey: 'mag.shortcutTasks', to: '/philia/magazine/lead', Icon: ClipboardCheck },
] as const

export default function PhiliaPage() {
  const { trpc } = usePhiliaClient()
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    retry: false,
  })
  const storesQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    staleTime: 5 * 60_000,
    retry: false,
  })
  const leadArticle = MAGAZINE_ARTICLES[0]
  const lead = magazineEntryOf(leadArticle)
  const entries = MAGAZINE_ARTICLES.slice(1).map((article) => ({ article, entry: magazineEntryOf(article) }))
  const storeName = storesQ.data?.stores[0]?.name ?? '门店'
  const plan = myQ.data?.plan as { label?: string } | null | undefined
  const tierName = plan?.label ? plan.label.replace(/^会员档·/, '').replace(/：.*$/, '') : mgc('mag.memberFallback')
  const balanceFen = myQ.data?.rebate?.balanceFen ?? 0
  const pendingFen = myQ.data?.rebate?.pendingFen ?? 0
  const rebateTotal = balanceFen + pendingFen
  const settledPct = rebateTotal > 0 ? Math.round((balanceFen / rebateTotal) * 100) : 0

  return (
    <div className="pb-28" data-testid="philia-magazine">
      <div className="m2-apphead">
        <span className="tt">{mgc('mag.headTitle')}</span>
        <span className="no">{mgc('mag.brandSub')}</span>
      </div>

      <section className="mx-[22px] mt-3 rounded-[18px] bg-brand-cta px-4 py-3.5 text-brand-cta-on" data-testid="philia-member-strip">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-bold">{tierName} · 回馈金 {fenToYuan(balanceFen)}</p>
            <p className="mt-0.5 text-[12px] text-[#C9BBA0]" data-u4-secondary>{mgc('mag.rebateReady')}</p>
          </div>
          <Link to="/me/card" className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-card px-3.5 py-1.5 text-[12px] font-bold text-ink">
            {mgc('mag.memberCode')}
          </Link>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-primary" style={{ width: `${settledPct}%` }} />
        </div>
      </section>

      <nav className="mt-4 grid grid-cols-3 px-[22px]" aria-label="杂志快捷入口">
        {SHORTCUTS.map(({ labelKey, to, Icon }) => (
          <Link key={labelKey} to={to} data-testid={`philia-shortcut-${mgc(labelKey)}`} className="flex flex-col items-center gap-2 text-[12px] font-medium text-ink" data-u4-secondary>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary-light/55">
              <Icon className="h-[18px] w-[18px] text-ink-secondary" strokeWidth={1.5} aria-hidden="true" />
            </span>
            {mgc(labelKey)}
          </Link>
        ))}
      </nav>

      <div className="px-[22px]">
        <h2 className="mt-4 text-body font-extrabold text-ink">{mgc('mag.today')}</h2>
        <section className="u1-card mt-3 p-3" data-testid="philia-editorial-lead">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="h-2 w-[108px] rounded-sm bg-violet" aria-hidden="true" />
            <span className="ml-auto text-[12px] text-ink-secondary" data-u4-secondary>{mgc('mag.leadMetaDate', { store: storeName })}</span>
            <span className="text-[12px] text-ink" data-u4-secondary>{mgc('mag.leadMetaType')}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <CoverArt url={lead.url} alt={lead.alt} priority className="aspect-square w-full rounded-control object-cover" />
              <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>{mgc('mag.before')}</p>
            </div>
            <div>
              <CoverArt url={null} alt={mgc('mag.afterAlt')} className="aspect-square w-full rounded-control object-cover" />
              <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>{mgc('mag.after')}</p>
            </div>
          </div>
          <Link to={`/philia/magazine/${leadArticle.slug}`} aria-label={mgc('mag.readArticle', { title: lead.title })}>
            <h3 className="mt-2 text-body-lg font-extrabold leading-snug text-ink">{lead.title}</h3>
          </Link>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary" data-u4-secondary>{lead.sub}</p>
          {lead.cta ? (
            <Link
              to="/booking/grooming"
              data-testid="philia-mag-lead-cta"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-brand-secondary-light px-3.5 py-2 text-[12px] font-bold text-ink"
            >
              {mgc('mag.leadBookingCta')}
            </Link>
          ) : null}
        </section>

        <div className="mt-3 flex flex-col gap-3">
          {entries.map(({ article, entry }, i) => (
            <section key={article.slug} className="u1-card p-3" data-testid={`philia-mag-entry-${i + 2}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="h-2 w-14 rounded-sm bg-violet" aria-hidden="true" />
                <p className="text-[12px] font-medium text-ink" data-u4-secondary>{i === 0 ? mgc('mag.boardingTag') : entry.sub}</p>
              </div>
              <Link to={`/philia/magazine/${article.slug}`} aria-label={mgc('mag.readArticle', { title: entry.title })}>
                <CoverArt url={entry.url} alt={entry.alt} className="mt-3 aspect-[16/7] w-full rounded-control object-cover" />
                <h3 className="mt-2 text-body font-bold text-ink">{entry.title}</h3>
                <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>{entry.sub}</p>
              </Link>
            </section>
          ))}
        </div>
        <p className="mt-4 text-center text-[12px] text-ink-secondary" data-testid="philia-mag-note" data-u4-secondary>
          {mgc('mag.pgcNote')}
        </p>
      </div>
    </div>
  )
}
