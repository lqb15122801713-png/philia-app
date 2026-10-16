import { Link, useParams } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import { MAGAZINE_ARTICLES, magazineEntryOf, mgc } from '@/copy/magazine'

export default function MagazineArticlePage() {
  const { articleId } = useParams()
  const article = MAGAZINE_ARTICLES.find((item) => item.slug === articleId)

  if (!article) {
    return (
      <div className="px-[22px] pb-28 pt-6">
        <PageHeader title={mgc('mag.headTitle')} fallback="/philia" />
        <section className="mt-8 rounded-card bg-card p-6 text-center shadow-card" data-testid="magazine-article-missing">
          <h1 className="u1-serif text-[22px] font-black">{mgc('mag.articleMissingTitle')}</h1>
          <p className="mt-3 text-caption leading-relaxed text-ink-secondary">{mgc('mag.articleMissingSub')}</p>
          <Link to="/philia" className="mt-5 inline-block rounded-[16px] bg-brand-cta px-5 py-3 text-body-sm font-semibold text-brand-cta-on">
            {mgc('mag.backToMagazine')}
          </Link>
        </section>
      </div>
    )
  }

  const entry = magazineEntryOf(article)
  return (
    <div className="px-[22px] pb-28 pt-6">
      <PageHeader title={mgc('mag.headTitle')} fallback="/philia" />
      <article className="mt-6" data-testid="magazine-article">
        <p className="font-number text-[9.5px] uppercase tracking-[.22em] text-ink-secondary">PHILIA MAGAZINE</p>
        <h1 className="u1-serif mt-2 text-[26px] font-black leading-snug text-ink">{entry.title}</h1>
        <p className="mt-3 text-caption leading-relaxed text-ink-secondary">{entry.sub}</p>
        <div className="mt-6 space-y-4 text-body leading-7 text-ink">
          {article.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  )
}
