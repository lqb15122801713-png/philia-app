/**
 * MePage · /me 「我的」页（A-4 定稿山姆骨架 · 换皮批片 2）
 *
 * 骨架冻结（34 号档 §4.9）：身份大卡置顶（深棕渐变 150deg 圆角 24，min-height 312）
 * + 订单五格（白卡五列）+ 功能网格一层（4 列×2，禁多层卡片堆叠）。
 *
 * 槽位置灰（PD-15 V1.1 三规：不上数不上假件 + 注记 + data-testid）：
 * - 今年已省=「——」（省钱口径未冻结前不上数字；口径方案产品侧出）；
 * - 退款售后（orderrow）/ 优惠券 / 常用地址（grid8）=置灰槽位；
 * - 补缺大批片 4 点亮：服务相册（→/philia/moments）/ 小棉花客服（→/support/new），
 *   testid 原值保留（slot-gallery / slot-concierge）；退款售后=片 1 挂接口，本片不动；
 * 落地件：档章/回馈金余额/续费倒计时（membership.my 真值）/会员码 qrrow/订单五态入口/
 * 宠物档案/寄养预约/设置（补缺大批片 2：设置钮改导航 /me/settings 独立设置页，
 * 退出登录收进设置页——LogoutConfirmDialog 移用 components/account，逻辑零改动）。
 *
 * 功能入口保全：商城订单=商城域 /mall/orders 入口在案（M-01）；旧 EntryList 六行
 * 已由 orderrow+grid8 全量承接（预约/会员中心/会员卡/宠物/相册槽位）。
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import { fenToYuan } from '@/components/booking/format'
import { sl } from '@/copy/serviceloop'

const DAY_MS = 86_400_000

/** 槽位置灰注记（PD-15 V1.1 三规②：UX 语感=克制高级，不写「功能缺失」） */
const SLOT_NOTE = '即将点亮'

/* 定稿线图标（§五：24 网格 stroke 1.55 round；同屏同宽） */
const I = {
  calendar: <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>,
  clock: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></svg>,
  star: <svg viewBox="0 0 24 24"><path d="M12 4l2.2 4.6 5 .6-3.7 3.4 1 4.9-4.5-2.5-4.5 2.5 1-4.9L4.8 9.2l5-.6z" /></svg>,
  refund: <svg viewBox="0 0 24 24"><path d="M4 9V7a2 2 0 012-2h12a2 2 0 012 2v2M4 9h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 9v8" /></svg>,
  all: <svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h14" /></svg>,
  petDoc: <svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>,
  album: <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4 4 3 3-2 4 3" /></svg>,
  rebate: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></svg>,
  home: <svg viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z" /></svg>,
  coupon: <svg viewBox="0 0 24 24"><path d="M5 5h14v6a2 2 0 000 4v4H5v-4a2 2 0 000-4z" /><path d="M12 8v8" strokeDasharray="2.5 2.5" /></svg>,
  pin: <svg viewBox="0 0 24 24"><path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>,
  cotton: <svg viewBox="0 0 24 24"><path d="M5 18a7 7 0 0114 0" /><circle cx="12" cy="7" r="3" /></svg>,
  gear: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 01-.2 1.6l2 1.5-2 3.4-2.3-1a7 7 0 01-2.8 1.7L13.4 21h-2.8l-.3-2.5a7 7 0 01-2.8-1.6l-2.3 1-2-3.4 2-1.5A7 7 0 015 12c0-.6.1-1.1.2-1.6l-2-1.5 2-3.4 2.3 1a7 7 0 012.8-1.7L10.6 3h2.8l.3 2.5a7 7 0 012.8 1.6l2.3-1 2 3.4-2 1.5c.1.5.2 1 .2 1.6z" /></svg>,
}

export default function MePage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()

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
    staleTime: 60_000,
  })
  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: !!user,
  })

  const nickname = meRawQ.data?.user?.nickname ?? '铲屎官'
  const avatarUrl = meRawQ.data?.user?.avatarUrl ?? null
  const membership = myQ.data?.membership ?? null
  const plan = myQ.data?.plan ?? null
  const tierLabel = plan ? plan.label.replace(/^会员档·/, '').replace(/：.*$/, '') : '菲丽亚宠友'
  const rebateBalance = myQ.data?.rebate?.balanceFen ?? 0
  /* 续费倒计时（PD-15：落地件=纯展示，membership.expiresAt 真值；非会员不上数） */
  const renewDaysLeft = membership
    ? Math.max(0, Math.ceil((new Date(membership.expiresAt).getTime() - Date.now()) / DAY_MS))
    : null
  const petCount = (petsQ.data ?? []).length
  const firstPetName = (petsQ.data ?? [])[0]?.name ?? null

  return (
    <div className="pb-28">
      {/* apphead：serif 27/900 大题 + mono 注记（§4.1） */}
      <div className="m2-apphead">
        <span className="tt">我的</span>
        <span className="no">MY PHILIA</span>
      </div>

      <div className="px-[22px]" style={{ marginTop: 14 }}>
        {/* 1. 身份大卡 mehero（置顶约 40%；骨架冻结件） */}
        <section className="me2-hero" data-testid="me-hero" aria-label="会员身份">
          <div className="r1">
            {avatarUrl ? (
              <img className="av" src={avatarUrl} alt={nickname} />
            ) : (
              <span className="av" style={{ display: 'grid', placeItems: 'center', background: '#F4EDDC' }} aria-hidden="true">
                <span style={{ fontFamily: 'var(--v2serif)', fontSize: 20, fontWeight: 900, color: '#3B2E24' }}>
                  {nickname.slice(0, 1)}
                </span>
              </span>
            )}
            <div>
              <div className="nm">{nickname}</div>
              <span className="tier">{tierLabel}</span>
            </div>
            {membership ? (
              <Link to="/member" className="renew" data-testid="me-renew-link">续费 ›</Link>
            ) : null}
          </div>
          <div className="nums">
            {/* 今年已省=槽位置灰不上数（PD-15 V1.1 槽位 1：省钱口径未冻结前「——」） */}
            <div className="dim" data-testid="me-saved-slot">
              <div className="v">——</div>
              <div className="k">今年已省 · {SLOT_NOTE}</div>
            </div>
            <div data-testid="me-rebate-cell">
              <div className="v">{fenToYuan(rebateBalance)}</div>
              <div className="k">回馈金</div>
            </div>
            <div data-testid="me-renew-countdown">
              {renewDaysLeft !== null ? (
                <>
                  <div className="v">{renewDaysLeft} <em>天</em></div>
                  <div className="k">续费倒计时</div>
                </>
              ) : (
                <>
                  <div className="v">——</div>
                  <div className="k">开通会员解锁</div>
                </>
              )}
            </div>
          </div>
          <Link to={membership ? '/me/card' : '/member/open'} className="me2-qrrow" data-testid="me-qrrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><path d="M14 14h2.5v2.5H14zM20 14v6M14 20h6" /></svg>
            出示会员码
            <span className="c">到店即扫</span>
          </Link>
        </section>

        {/* 2. 订单五格（五态入口；退款售后=槽位置灰 PD-15 V1.1 槽位 10） */}
        <nav className="me2-orderrow" data-testid="me-orderrow" aria-label="订单五态">
          <Link to="/appointments?tab=confirmed" className="o">{I.calendar}待到店</Link>
          <Link to="/appointments?tab=serving" className="o">{I.clock}服务中</Link>
          <Link to="/appointments?tab=history" className="o">{I.star}待评价</Link>
          <span className="o slot" data-testid="slot-refund" aria-disabled="true">
            {I.refund}退款售后
            <span className="sk">{SLOT_NOTE}</span>
          </span>
          <Link to="/appointments?tab=history" className="o">{I.all}全部订单</Link>
        </nav>

        {/* 3. 功能网格（4 列×2 一层；置灰四件=PD-15 V1.1 槽位 2/3/4/11） */}
        <nav className="me2-grid8" data-testid="me-grid8" aria-label="功能网格">
          <Link to="/philia/pets" className="g">{I.petDoc}<div className="t">宠物档案<small>{firstPetName ?? (petCount > 0 ? `${petCount} 只` : '去建档')}</small></div></Link>
          {/* 补缺大批片 4：服务相册点亮（testid 原值保留，置灰样式+「即将点亮」注记摘除） */}
          <Link to="/philia/moments" className="g" data-testid="slot-gallery">{I.album}<div className="t">{sl('album.meEntryTitle')}<small>{sl('album.meEntrySub')}</small></div></Link>
          <Link to="/member/rebate" className="g">{I.rebate}<div className="t">回馈金账本<small>{fenToYuan(rebateBalance)}</small></div></Link>
          <Link to="/booking/boarding" className="g">{I.home}<div className="t">寄养预约<small>按晚</small></div></Link>
          <span className="g slot" data-testid="slot-coupons" aria-disabled="true">{I.coupon}<div className="t">优惠券<small>{SLOT_NOTE}</small></div></span>
          <span className="g slot" data-testid="slot-address" aria-disabled="true">{I.pin}<div className="t">常用地址<small>{SLOT_NOTE}</small></div></span>
          {/* 补缺大批片 4：小棉花客服点亮（testid 原值保留） */}
          <Link to="/support/new" className="g" data-testid="slot-concierge">{I.cotton}<div className="t">{sl('ticket.meEntryTitle')}<small>{sl('ticket.meEntrySub')}</small></div></Link>
          <Link to="/me/settings" className="g" data-testid="me-settings">
            {I.gear}<div className="t">设置<small>账号 · 安全</small></div>
          </Link>
        </nav>
      </div>
    </div>
  )
}
