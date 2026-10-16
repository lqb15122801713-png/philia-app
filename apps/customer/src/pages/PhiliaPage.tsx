/**
 * PhiliaPage · /philia PHILIA 杂志（产品-1015 换皮 片4-运营商城 · 对照 READY 帧 187:2）
 *
 * 口径写死（READY §6.9）：PHILIA＝PGC 杂志（编辑部出品），不做开放 Feed——
 * 无发帖器 / 无点赞评论 / 无无限流；条目=固定三条策展位。
 *
 * 端口轻批 批C（philia.magazine）：选题卡内容=槽位端口三槽
 * （philia.magazine.lead / .02 / .03，D-42 主副题/CTA 运营可调，壳写死）；
 * 槽行/字段缺省回退=copy 键 mag.*（与迁移 0086 槽种默认同帧）；
 * 图 url=null=品牌渐变占位（真图终摄非目标，R10 不落假图）。
 *
 * 主 CTA 纪律：封面「读本期」=平滑滚动到条目列（真实动作；条目无详情路由不挂假链）。
 *
 * 沿革（片4 换面）：旧 F-01 陪伴页（画布九块 + 下滑关闭手势 + fixed 全屏 dialog 形态）
 * 随本片退役——/philia 归位主级 Tab 常规页（dock 明面）；旧画布块 philia.* 注册表行
 * 保留不删（服务端内容，清册另批报备）；f1.* copy 键保留在端口库（同报备）；
 * HomeBookingPanel 等共享件在首页继续使用，零触。
 */

import { useRef, useState } from 'react'
import { resolveSlotUrl, slotContentOf, type SlotContent } from '@philia/shared'
import { mgc } from '../copy/magazine'

/** 杂志条目槽读口：槽位 live 值 → copy 键缺省回退（字段级） */
function entryOf(key: string, fallback: { title: string; sub: string; cta?: string }) {
  const slot: SlotContent | undefined = slotContentOf(key)
  return {
    url: slot?.url ?? null,
    alt: slot?.alt ?? fallback.title,
    title: slot?.title_main ?? fallback.title,
    sub: slot?.title_sub ?? fallback.sub,
    cta: slot?.cta_text ?? fallback.cta ?? null,
  }
}

/** 封面图（url 缺省/加载失败=品牌渐变占位；真图终摄非目标） */
function CoverArt({ url, alt, className }: { url: string | null; alt: string; className: string }) {
  const [imgOk, setImgOk] = useState(true)
  const src = resolveSlotUrl(url)
  if (src && imgOk) {
    return <img src={src} alt={alt} onError={() => setImgOk(false)} className={className} />
  }
  return (
    <div
      aria-label={alt}
      role="img"
      className={`bg-philia-gradient ${className}`}
    />
  )
}

export default function PhiliaPage() {
  const listRef = useRef<HTMLDivElement>(null)
  const lead = entryOf('philia.magazine.lead', {
    title: mgc('mag.leadTitle'),
    sub: mgc('mag.leadSub'),
    cta: mgc('mag.leadCta'),
  })
  const entries = [
    entryOf('philia.magazine.02', { title: mgc('mag.e2Title'), sub: mgc('mag.e2Sub') }),
    entryOf('philia.magazine.03', { title: mgc('mag.e3Title'), sub: mgc('mag.e3Sub') }),
  ]

  return (
    <div className="pb-28" data-testid="philia-magazine">
      {/* 页头裸段（mall/me 同工艺：serif 27 大题 + mono 注记） */}
      <div className="m2-apphead">
        <span className="tt">{mgc('mag.headTitle')}</span>
        <span className="no">{mgc('mag.headSub')}</span>
      </div>

      <div className="px-[22px]">
        {/* 封面主打（策展位一：大图 + 主副题 + CTA 滚动到条目列） */}
        <section className="mt-4 overflow-hidden rounded-card bg-card shadow-card" data-testid="philia-mag-lead">
          <div className="relative">
            <CoverArt url={lead.url} alt={lead.alt} className="aspect-[16/10] w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(44,40,34,.72)] to-transparent px-4 pb-3.5 pt-12">
              <p className="font-number text-[9.5px] uppercase tracking-[.22em] text-canvas/80">PHILIA MAGAZINE</p>
              <h1 className="u1-serif mt-1 text-[22px] font-black leading-snug text-canvas">{lead.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <p className="min-w-0 flex-1 text-caption leading-relaxed text-ink-secondary">{lead.sub}</p>
            {lead.cta ? (
              <button
                type="button"
                data-testid="philia-mag-lead-cta"
                onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="shrink-0 rounded-full bg-brand-primary px-3.5 py-2 text-caption font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {lead.cta}
              </button>
            ) : null}
          </div>
        </section>

        {/* 条目列（策展位二/三；无详情路由=展示卡不挂链） */}
        <div ref={listRef} className="mt-4 flex flex-col gap-3">
          {entries.map((e, i) => (
            <article
              key={i}
              className="flex items-center gap-3 rounded-card bg-card p-3 shadow-card"
              data-testid={`philia-mag-entry-${i + 2}`}
            >
              <CoverArt url={e.url} alt={e.alt} className="h-[72px] w-[96px] shrink-0 rounded-input object-cover" />
              <div className="min-w-0 flex-1">
                <h2 className="text-[13.5px] font-bold leading-snug text-ink">{e.title}</h2>
                <p className="mt-1 font-number text-[9.5px] tracking-wide text-ink-placeholder">{e.sub}</p>
              </div>
            </article>
          ))}
        </div>

        {/* 口径注（PGC 写死明面；非开放 Feed） */}
        <p className="mt-6 text-center font-number text-[9.5px] tracking-wide text-ink-placeholder" data-testid="philia-mag-note">
          {mgc('mag.pgcNote')}
        </p>
      </div>
    </div>
  )
}
