/**
 * MePage · /me 「我的」页（T2.1）
 *
 * 五区块（自上而下）：
 * 1. 用户信息条：auth.me 原始响应（queryKey ['auth','me','raw']，与 MemberPage 同模式）
 *    —— 头像 user.avatarUrl（无则字圈工艺：浅木底+衬线首字，D-补3）+ 昵称（空显示「铲屎官」）
 *    + 手机号脱敏（users.phone 真实字段）· 加入天数；
 * 2. 我的宠物横滑卡片区：pet.list → 圆形头像 + 名字，末尾固定「添加」虚线圆按钮
 *    → /philia/pets；空态引导卡「建立宠物档案」→ /philia/pets；
 * 3. 功能入口列表：我的预约 /appointments、我的订单 /mall/orders、会员中心 /member（R11a）、
 *    会员卡 /me/card、宠物档案 /philia/pets、宠友圈 /philia/moments（路径以 App.tsx 路由表为准）；
 * 4. 设置区：意见反馈 / 关于菲丽亚（toast「即将上线，敬请期待」）+ 退出登录
 *    （确认弹窗 → logout(getApiBase()) → queryClient.clear() → /dev-login）。
 *
 * 每区块独立 loading / error / empty 三态；数据只取真实接口，禁止编造字段。
 */

import { useQuery } from '@tanstack/react-query'
import { LogOut, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'

const DAY_MS = 86_400_000

/* ------------------------------------------------------------------ */
/* 轻量 toast（本页自带，与商城/预约域同款固定定位胶囊提示）                 */
/* ------------------------------------------------------------------ */

function useMeToast(durationMs = 3200) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null)
  const showToast = useCallback((text: string) => setMsg({ id: Date.now(), text }), [])
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => setMsg(null), durationMs)
    return () => window.clearTimeout(t)
  }, [msg, durationMs])
  const toastEl = msg ? (
    <div
      key={msg.id}
      role="alert"
      className="fixed left-1/2 top-5 z-toast max-w-[86vw] -translate-x-1/2 rounded-full bg-success-light px-4 py-2.5 text-body-sm text-success-deep shadow-elevated"
    >
      {msg.text}
    </div>
  ) : null
  return { toastEl, showToast }
}

/* ------------------------------------------------------------------ */
/* 1. 用户信息卡                                                         */
/* ------------------------------------------------------------------ */

function UserCard() {
  const { trpc } = usePhiliaClient()
  // auth.me 原始响应（含 user.createdAt / avatarUrl；useMe 映射结构不含，故另起 key 直查）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 60_000,
  })

  if (meQuery.isPending) return <LoadingBlock lines={2} />
  if (meQuery.isError) {
    return <ErrorState message="用户信息加载失败" onRetry={() => void meQuery.refetch()} />
  }

  const { user } = meQuery.data
  const nickname = user.nickname ?? '铲屎官'
  const createdAt = user.createdAt
  const joinDays = createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS) + 1)
    : null
  /* U4-D3：手机号=auth.me 真实字段（users.phone），脱敏展示 138****8888 口径；无号段隐去 */
  const phone = user.phone
  const phoneMasked = phone && phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : null

  /* U4-D3 对齐试样 10 .me-user：直上画布不套卡；头像 54 全圆+细线 ring；
     无头像=字圈工艺（D-补3：浅木底+衬线首字，D1 洗护师字圈同口径） */
  return (
    <div data-testid="me-user-card" className="flex items-center gap-3.5 pt-3.5">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={nickname}
          className="h-[54px] w-[54px] shrink-0 rounded-full object-cover ring-1 ring-line-ring"
        />
      ) : (
        <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-oak-light ring-1 ring-line-ring">
          <span className="u1-serif text-title-lg font-semibold text-ink">{nickname.slice(0, 1)}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p data-testid="me-nickname" className="u1-serif truncate text-title">{nickname}</p>
        <p className="mt-[3px] text-caption-xs text-ink-secondary">
          {phoneMasked ? <span className="u1-num">{phoneMasked}</span> : null}
          {phoneMasked && joinDays !== null ? ' · ' : ''}
          {joinDays !== null ? (
            <>
              加入 <span className="u1-num">{joinDays}</span> 天
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 1.5 U1-H 纸面细线会员卡（GUARDIAN CARD · 三真数；档名/守护值无真实来源——
 *     同 U1-C/F 口径不出现；已省行无折扣引擎算不出 → 整行隐去）            */
/* ------------------------------------------------------------------ */

function GuardianCard() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const meRawQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const mineQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user,
    staleTime: 60_000,
  })

  if (meRawQ.isPending || mineQ.isPending) return <LoadingBlock lines={2} />
  if (meRawQ.isError || mineQ.isError) {
    return (
      <ErrorState
        message="会员卡加载失败"
        onRetry={() => {
          void meRawQ.refetch()
          void mineQ.refetch()
        }}
      />
    )
  }

  const createdAt = meRawQ.data.user.createdAt
  const joinDays = createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / DAY_MS) + 1)
    : null
  const completed = mineQ.data.groups.completed
  const totalFen = completed.reduce((s, a) => s + a.priceFen, 0)

  const stats = [
    { label: '陪伴天数', value: joinDays !== null ? `${joinDays}` : null },
    { label: '服务次数', value: completed.length > 0 ? `${completed.length}` : null },
    { label: '累计消费', value: totalFen > 0 ? `¥${(totalFen / 100).toFixed(totalFen % 100 === 0 ? 0 : 2)}` : null },
  ].filter((s) => s.value !== null)

  /* U4-D3 对齐试样 10 .gcardQ 素卡工艺：纸面细线卡（深棕墨大卡已退役）；
     档名/守护值/折扣副题无真实字段不出（裁定 #23 口径维持）；
     三真数=左对齐 Montserrat 17/700（试样 800 字重→自托管仅 400/600/700，取 700 登记），
     小标签 11px；右下「会员码 ›」=真路由 /me/card 入口 */
  return (
    <Link
      to="/me/card"
      data-testid="me-guardian-card"
      className="u1-card block px-5 py-[18px] transition-transform duration-120 ease-philia-spring active:scale-[0.99]"
    >
      <p className="text-caption-xs font-semibold tracking-[0.22em] text-ink-placeholder">GUARDIAN CARD</p>
      {stats.length > 0 ? (
        <div className="mt-3.5 flex gap-[30px] border-t border-[rgba(74,59,46,.06)] pt-[13px]">
          {stats.map((s) => (
            <p key={s.label}>
              <span className="u1-num block text-title font-bold leading-6">{s.value}</span>
              <span className="mt-[3px] block text-caption-xs leading-4 text-ink-placeholder">{s.label}</span>
            </p>
          ))}
          <span className="ml-auto self-end text-caption-xs text-ink-placeholder" aria-hidden="true">
            会员码 ›
          </span>
        </div>
      ) : (
        <p className="mt-2 text-caption text-ink-secondary">会员细则以门店公布为准</p>
      )}
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* 2. 我的宠物横滑卡片区                                                  */
/* ------------------------------------------------------------------ */

function PetsSection() {
  const { trpc } = usePhiliaClient()
  const petsQuery = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
  })

  if (petsQuery.isPending) return <LoadingBlock lines={2} />
  if (petsQuery.isError) {
    return <ErrorState message="宠物列表加载失败" onRetry={() => void petsQuery.refetch()} />
  }

  const pets = petsQuery.data

  // 空态：引导建立宠物档案（pets=[] 时渲染此分支）
  if (pets.length === 0) {
    return (
      <div data-testid="me-pets" data-empty="true">
        <EmptyState
          title="还没有宠物档案"
          desc="建立档案后，预约洗护与寄养更省心"
          action={
            <Link
              to="/philia/pets"
              className="inline-flex items-center rounded-control bg-brand-primary px-[30px] py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              建立宠物档案
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <section data-testid="me-pets" className="u1-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-title">我的宠物</h2>
        <Link to="/philia/pets" className="text-caption text-ink-secondary">
          管理
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pets.map((pet) => (
          <div key={pet.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            {pet.avatarUrl ? (
              <img
                src={pet.avatarUrl}
                alt={pet.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              /* D-补3 字圈工艺：浅木底 + 衬线首字（D1 洗护师字圈同口径），不再用 PawPrint 图标占位 */
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-oak-light ring-1 ring-line-ring">
                <span className="u1-serif text-title-lg font-semibold text-ink">{pet.name.slice(0, 1)}</span>
              </span>
            )}
            <p className="w-full truncate text-center text-caption">{pet.name}</p>
          </div>
        ))}
        {/* 末尾固定「添加」虚线圆按钮 */}
        <Link
          to="/philia/pets"
          aria-label="添加宠物"
          className="flex w-16 shrink-0 flex-col items-center gap-1.5"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-line-strong bg-sunken">
            <Plus className="h-6 w-6 text-ink-secondary" strokeWidth={1.5} />
          </span>
          <span className="text-caption text-ink-secondary">添加</span>
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 3. 功能入口列表                                                       */
/*    U4-D3 对齐试样 10 .svc-list：细线列表行直上画布（去卡壳去图标），      */
/*    行名衬线 14/600（试样 serif 14.5→字阶 14），右位 › 墨 placeholder；  */
/*    行距 padding 16px 0 + hairline 分隔（试样 ink-06）。                 */
/*    入口仅保留真实路由：试样「优惠券/联系客服」无字段无路由不出（登记）。   */
/* ------------------------------------------------------------------ */

const ENTRIES: Array<{ to: string; label: string }> = [
  { to: '/appointments', label: '我的预约' },
  { to: '/mall/orders', label: '商城订单' },
  // R11a 骨架批：会员中心入口（/member 新路由，申报锚点=页标题「会员中心」）
  { to: '/member', label: '会员中心' },
  // U1-H：会员卡入口指向新路由 /me/card（信息展示 v0）
  { to: '/me/card', label: '会员卡' },
  { to: '/philia/pets', label: '我的宠物' },
  { to: '/philia/moments', label: '宠友圈' },
]

function EntryList() {
  return (
    <nav
      data-testid="me-entries"
      aria-label="功能入口"
      className="divide-y divide-[rgba(74,59,46,.06)] border-b border-[rgba(74,59,46,.06)]"
    >
      {ENTRIES.map(({ to, label }) => (
        <Link key={to} to={to} className="flex items-center py-4">
          <span className="u1-serif flex-1 text-body-sm font-semibold">{label}</span>
          <span className="text-caption-xs text-ink-placeholder" aria-hidden="true">›</span>
        </Link>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* 4. 设置区（含退出登录确认弹窗）                                        */
/*    U1-H：意见反馈/关于菲丽亚为 toast「即将上线」假按钮——按老板铁则          */
/*    「每个按钮要么通真实链路、要么不存在」整行移除，不留花架子。              */
/* ------------------------------------------------------------------ */

function SettingsCard({
  onRequestLogout,
}: {
  onRequestLogout: () => void
}) {
  return (
    <div data-testid="me-settings" className="u1-card">
      <button
        type="button"
        onClick={onRequestLogout}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        data-testid="me-logout-btn"
      >
        <LogOut className="h-5 w-5 text-danger-deep" strokeWidth={1.5} />
        <span className="flex-1 text-body-sm text-danger-deep">退出登录</span>
      </button>
    </div>
  )
}

/** 退出登录确认弹窗 */
function LogoutConfirmDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-ink/40 px-8"
      onClick={onCancel}
      role="dialog"
      aria-label="退出登录确认"
    >
      <div
        className="w-full max-w-sm rounded-panel bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title">退出登录？</p>
        <p className="mt-2 text-body-sm text-ink-secondary">退出后需要重新登录才能继续使用菲丽亚。</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-full border border-line py-2.5 text-body-sm text-ink-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid="me-logout-confirm"
            className="flex-1 rounded-full bg-danger py-2.5 text-body-sm text-destructive-foreground transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            {pending ? '正在退出…' : '退出登录'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 页面                                                                 */
/* ------------------------------------------------------------------ */

export default function MePage() {
  const navigate = useNavigate()
  const { queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useMeToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)

  const doLogout = async () => {
    setLogoutPending(true)
    try {
      await logout(getApiBase())
      queryClient.clear()
      navigate('/dev-login', { replace: true })
    } catch (err) {
      setLogoutPending(false)
      setConfirmOpen(false)
      showToast(err instanceof Error ? err.message : '退出失败，请稍后再试')
    }
  }

  return (
    /* U4-D3：页边距 22px；题「我的」=衬线 17/600 宽距（试样 10 wordmark serif .14em）。
       试样右上「设置」无真实路由/功能——不出（登记）。 */
    <div className="px-[22px] pb-6">
      <header className="pt-3">
        <h1 className="u1-serif text-title tracking-[0.14em]">我的</h1>
      </header>

      <div className="flex flex-col gap-3">
        <UserCard />
        {/* U1-H：纸面细线会员卡（GUARDIAN CARD·三真数 → /me/card）；已省行隐去（无折扣引擎） */}
        <GuardianCard />
        <PetsSection />
        <EntryList />
        <SettingsCard onRequestLogout={() => setConfirmOpen(true)} />
      </div>

      {confirmOpen ? (
        <LogoutConfirmDialog
          pending={logoutPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void doLogout()}
        />
      ) : null}
      {toastEl}
    </div>
  )
}
