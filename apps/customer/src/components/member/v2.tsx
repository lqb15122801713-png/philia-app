/**
 * R11b 会员区 v2.0 构件（定稿挂规版 · 图纸=36 号档施工示意图 / 规范=34 号档条款号）
 *
 * 全部件样式在 styles/member-v2.css（.m2 作用域），本文件只负责结构+数据接插。
 * 文案一律走 copy.ts 文案键（38 号档 §三 凡内容皆留口）；数值一律读 member_plans 端口。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { mc } from './copy'

/* ------------------------------------------------------------------ */
/* 档位工具                                                              */
/* ------------------------------------------------------------------ */

/** member_plans.planKey → 定稿档序（cf-t0~t3） */
export const TIER_IDX: Record<string, 0 | 1 | 2 | 3> = {
  plan_weiguang: 0,
  plan_yinghuo: 1,
  plan_zhuguang: 2,
  plan_nuanyang: 3,
}
const TIER_NAME = ['微光', '萤火', '烛光', '暖阳'] as const
const TIER_CLAIM_KEY = [
  'card.claimWeiguang',
  'card.claimYinghuo',
  'card.claimZhuguang',
  'card.claimNuanyang',
] as const

export interface V2Plan {
  planKey: string
  label: string
  free: boolean
  priceFen: number
  rebateBp: number
  serviceDiscountBp: number
  includedPets: number
  extraPetFen: number
  maxPets: number
}

export function tierIdxOf(planKey: string): 0 | 1 | 2 | 3 {
  return TIER_IDX[planKey] ?? 0
}
export function tierNameOf(planKey: string): string {
  return TIER_NAME[tierIdxOf(planKey)]
}
export function tierClaimOf(planKey: string): string {
  return mc(TIER_CLAIM_KEY[tierIdxOf(planKey)])
}
/** 折扣 bp → 冻结口径折数文案（8800→88 / 8500→85 / 8000→8；10000=无折扣门市价） */
export function zheOf(bp: number): string | null {
  if (bp >= 10000) return null
  return String(bp / 100).replace(/0$/, '')
}
export function pctOf(bp: number): string {
  return String(bp / 100)
}
/** 每天价=档价÷365（36 号档口径：199→0.55 / 299→0.82 / 599→1.6；<1 两位小数，≥1 一位） */
export function dailyOf(priceFen: number): string {
  const v = priceFen / 100 / 365
  return v >= 1 ? v.toFixed(1) : v.toFixed(2)
}
export function yuanOf(fen: number): string {
  return (fen / 100).toFixed(2)
}

/* ------------------------------------------------------------------ */
/* 框架件                                                                */
/* ------------------------------------------------------------------ */

/** pushbar（§4.1）：返回 36 白卡墨描边 + mono 小签（aria-label=返回，导航闭环四要素） */
export function PushBar({ label, to }: { label: string; to: string }) {
  const navigate = useNavigate()
  return (
    <div className="m2-pushbar">
      <button type="button" className="back m2-press" aria-label="返回" onClick={() => navigate(to)}>
        <svg viewBox="0 0 24 24">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <span className="lb">{label}</span>
    </div>
  )
}

/** apphead（§4.1）：serif 27/900 屏题 + mono 10 右下基线注记 */
export function AppHead({ title, no }: { title: string; no?: string }) {
  return (
    <div className="m2-apphead">
      <span className="tt">{title}</span>
      {no ? <span className="no">{no}</span> : null}
    </div>
  )
}

/** 截面标题 sec-h */
export function SecH({ title, more }: { title: string; more?: string }) {
  return (
    <div className="m2-sec-h">
      <h3>{title}</h3>
      {more ? <span className="more">{more}</span> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 卡面 cardface（§4.8/§1.3；虚线槽位框=标注件已移除，真件入槽待素材通道）        */
/* ------------------------------------------------------------------ */

export function CardFace({
  planKey,
  priceText,
  claimText,
  noText,
  stamp,
  height,
  padding,
  nameSize = 26,
  selectable = false,
  selected = false,
  onClick,
  testId,
}: {
  planKey: string
  /** 价位行（mono）；免费档传「免费注册」 */
  priceText: string
  claimText: string
  noText?: string
  /** 状态章（冻结态=「已冻结 · 续费即解冻」，蜡封槽位同位复用——CJ-0923-16⑤） */
  stamp?: string
  height: number
  /** deck 内卡=18/20（320×204）；持有态大卡=20/22（212 高）；码屏横卡=16/18（92 高） */
  padding?: string
  nameSize?: number
  selectable?: boolean
  selected?: boolean
  onClick?: () => void
  testId?: string
}) {
  const t = tierIdxOf(planKey)
  return (
    <div
      className={`m2-cardface m2-cf-t${t}${selectable ? ' selable' : ''}${selected ? ' sel' : ''}`}
      style={{ height, padding: padding ?? (height >= 200 ? '20px 22px' : '16px 18px') }}
      onClick={onClick}
      role={selectable ? 'button' : undefined}
      aria-pressed={selectable ? selected : undefined}
      data-testid={testId}
    >
      <div className="cf-logo">{mc('card.logo')}</div>
      {stamp ? <div className="cf-stamp">{stamp}</div> : null}
      <div className="cf-name" style={{ fontSize: nameSize, marginTop: height >= 200 ? 16 : 10 }}>
        {tierNameOf(planKey)}会员
      </div>
      <div className="cf-price" style={{ fontSize: height >= 200 ? 13 : 12, marginTop: 6 }}>
        {priceText}
      </div>
      <div className="cf-claim" style={{ marginTop: 9 }}>
        {claimText}
      </div>
      {noText ? <div className="cf-no">{noText}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 三格账 ledger（§4.8）                                                  */
/* ------------------------------------------------------------------ */

export function Ledger({ cells, onCellClick }: {
  cells: { v: string; k: string }[]
  onCellClick?: (idx: number) => void
}) {
  return (
    <div className="m2-ledger">
      {cells.map((c, i) => (
        <div
          key={c.k}
          onClick={onCellClick ? () => onCellClick(i) : undefined}
          role={onCellClick ? 'button' : undefined}
          style={onCellClick ? { cursor: 'pointer' } : undefined}
        >
          <div className="v">{c.v}</div>
          <div className="k">{c.k}</div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 权益墙 perks（§4.8：8 枚扫得完；副签按档取值，数值读端口）                    */
/* ------------------------------------------------------------------ */

const PERK_ICONS = [
  /* 多宠覆盖（爪印线性） */
  <path key="p" d="M12 13.5c-2.8 0-5 2-5 4.2 0 1.4 1 2.3 2.4 2.3 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.4 0 2.4-.9 2.4-2.3 0-2.2-2.2-4.2-5-4.2z M6.5 10m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0 M10 7.5m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M14 7.5m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M17.5 10m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0" />,
  /* 服务折扣（山形+基线） */
  <path key="d" d="M4 16l5-9 4 6 3-4 4 7z M4 20h16" />,
  /* 回馈金（圆+指针） */
  <g key="r">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7v5l3.5 2" />
  </g>,
  /* 专属洗护师 */
  <g key="g">
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 20c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5" />
  </g>,
  /* 生日礼遇（星） */
  <path key="b" d="M12 4l2.2 4.6 5 .6-3.7 3.4 1 4.9-4.5-2.5-4.5 2.5 1-4.9L4.8 9.2l5-.6z" />,
  /* 皮毛检测（靶） */
  <g key="s">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </g>,
  /* 寄养折扣（屋） */
  <path key="h" d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z" />,
  /* 年度档案 */
  <g key="a">
    <rect x="5" y="4" width="14" height="16" rx="2" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </g>,
]

export function PerksWall({ plan }: { plan: V2Plan }) {
  const zhe = zheOf(plan.serviceDiscountBp)
  const items = [
    { t: mc('perk.pets'), s: mc('perk.petsSub', { n: plan.includedPets }) },
    { t: mc('perk.discount'), s: zhe ? mc('perk.discountSub', { zhe }) : mc('perk.discountNone') },
    { t: mc('perk.rebate'), s: plan.rebateBp > 0 ? mc('perk.rebateSub', { pct: pctOf(plan.rebateBp) }) : mc('perk.rebateNone') },
    { t: mc('perk.groomer'), s: mc('perk.groomerSub') },
    { t: mc('perk.birthday'), s: mc('perk.birthdaySub') },
    { t: mc('perk.skin'), s: mc('perk.skinSub') },
    { t: mc('perk.boarding'), s: mc('perk.boardingSub') },
    { t: mc('perk.archive'), s: mc('perk.archiveSub') },
  ]
  return (
    <div className="m2-perks">
      {items.map((it, i) => (
        <div className="m2-perk" key={it.t}>
          <div className="ic">
            <svg viewBox="0 0 24 24">{PERK_ICONS[i]}</svg>
          </div>
          <div className="t">{it.t}</div>
          <div className="s">{it.s}</div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 规则明面 rules（§4.8 · 红线 5 承载位：全量八条，数值读端口）                 */
/* ------------------------------------------------------------------ */

export function RulesBlock({
  plan,
  settlementDay,
  validityDays,
  allPcts,
}: {
  /** 当前档（可为空=未购态，按通用口径展示） */
  plan: V2Plan | null
  settlementDay: number
  validityDays: number
  /** 付费三档回馈金比例文案（如「2/5/10」） */
  allPcts: string
}) {
  const tier = plan ? tierNameOf(plan.planKey) : ''
  const lines = [
    plan && plan.rebateBp > 0
      ? mc('rules.r1', { pct: pctOf(plan.rebateBp), tier })
      : mc('rules.r1Free', { pcts: allPcts }),
    mc('rules.r2', { day: settlementDay }),
    mc('rules.r3', { days: validityDays }),
    mc('rules.r4'),
    mc('rules.r5'),
    mc('rules.r6'),
    mc('rules.r7'),
    mc('rules.r8'),
  ]
  return (
    <div className="m2-rules">
      <div className="h">{mc('rules.title')}</div>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 多宠氛围卡 famcard（§4.8 · 仅暖阳档；真件=素材通道，本批素色占位渐变）          */
/* ------------------------------------------------------------------ */

export function FamCard({ text }: { text: string }) {
  return (
    <div className="m2-famcard">
      <div className="fc-img" role="img" aria-label={text} />
      <div className="fc">{text}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 提示卡（§1.4 暖底）：到期提醒条                                          */
/* ------------------------------------------------------------------ */

export function TipCard({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="m2-tipcard" data-testid={testId} style={{ margin: '14px 0 0' }}>
      {children}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* 底部弹层 sheet（§4.5 三件套：抓握手柄+可点遮罩+滚动锁；挂 frame 层）          */
/* ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  note,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  note?: string
  children: ReactNode
}) {
  /* 滚动锁（开时锁底层 body） */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return (
    <>
      <div className="m2-scrim open" onClick={onClose} aria-hidden="true" />
      <div className="m2-sheet open" role="dialog" aria-label={title}>
        <div className="grab" />
        <div className="sh-h">
          <h4>{title}</h4>
          {note ? <span className="mono">{note}</span> : null}
        </div>
        {children}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 空态 emptyc（§4.11 三句话结构）                                          */
/* ------------------------------------------------------------------ */

export function EmptyC({
  title,
  desc,
  ctaText,
  onCta,
}: {
  title: string
  desc: string
  ctaText: string
  onCta: () => void
}) {
  return (
    <div className="m2-emptyc m2-card">
      <div className="paw">
        <svg viewBox="0 0 24 24">
          <path d="M12 13.5c-2.8 0-5 2-5 4.2 0 1.4 1 2.3 2.4 2.3 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.4 0 2.4-.9 2.4-2.3 0-2.2-2.2-4.2-5-4.2z" />
          <circle cx="6.5" cy="10" r="1.6" />
          <circle cx="10" cy="7.5" r="1.7" />
          <circle cx="14" cy="7.5" r="1.7" />
          <circle cx="17.5" cy="10" r="1.6" />
        </svg>
      </div>
      <div className="t">{title}</div>
      <div className="d">{desc}</div>
      <button type="button" className="m2-btn-primary m2-press" onClick={onCta}>
        {ctaText}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* deckdots（§4.8：当前=淡黄长圆 16×5，点睛位）                              */
/* ------------------------------------------------------------------ */

export function DeckDots({ count, active }: { count: number; active: number }) {
  return (
    <div className="m2-deckdots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i === active ? 'on' : ''} />
      ))}
    </div>
  )
}

/** deck 横滑选中跟踪：scroll 命中最近卡 + 点卡居中（卡即选择器 §4.8） */
export function useDeckSelect(count: number, initial: number) {
  const [active, setActive] = useState(initial)
  const deckRef = useRef<HTMLDivElement | null>(null)

  const scrollTo = (idx: number) => {
    const el = deckRef.current?.children.item(idx) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
  const onScroll = () => {
    const deck = deckRef.current
    if (!deck) return
    const mid = deck.scrollLeft + deck.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    Array.from(deck.children).forEach((c, i) => {
      const el = c as HTMLElement
      const center = el.offsetLeft + el.offsetWidth / 2
      const d = Math.abs(center - mid)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    if (best !== active) setActive(best)
  }
  const pick = (idx: number) => {
    setActive(idx)
    scrollTo(idx)
  }
  return { active, pick, deckRef, onScroll, count }
}
