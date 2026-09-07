/**
 * MePage · /me 「我的」页（T2.1）
 *
 * 五区块（自上而下）：
 * 1. 用户信息卡：auth.me 原始响应（queryKey ['auth','me','raw']，与 MemberPage 同模式）
 *    —— 头像 user.avatarUrl（无则 PawPrint 占位）+ 昵称（空显示「铲屎官」）+ 加入天数；
 * 2. 我的宠物横滑卡片区：pet.list → 圆形头像 + 名字，末尾固定「添加」虚线圆按钮
 *    → /philia/pets；空态引导卡「建立宠物档案」→ /philia/pets；
 * 3. 功能入口列表：我的预约 /appointments、我的订单 /mall/orders、会员卡 /philia/member、
 *    宠物档案 /philia/pets、宠友圈 /philia/moments（路径以 App.tsx 路由表为准）；
 * 4. 设置区：意见反馈 / 关于菲丽亚（toast「即将上线，敬请期待」）+ 退出登录
 *    （确认弹窗 → logout(getApiBase()) → queryClient.clear() → /dev-login）。
 *
 * 每区块独立 loading / error / empty 三态；数据只取真实接口，禁止编造字段。
 */

import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck,
  ChevronRight,
  Crown,
  Info,
  LogOut,
  MessageSquare,
  Package,
  PawPrint,
  Plus,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getApiBase, logout, usePhiliaClient } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock, tabularNums } from '../components/home/common'

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
      className="fixed left-1/2 top-5 z-toast max-w-[86vw] -translate-x-1/2 rounded-full bg-success-light px-4 py-2.5 text-body text-success-deep shadow-elevated"
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

  return (
    <div data-testid="me-user-card" className="flex items-center gap-4 rounded-card bg-card p-4 shadow-card">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={nickname}
          className="h-16 w-16 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-secondary-light">
          <PawPrint className="h-7 w-7 text-brand-primary" strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p data-testid="me-nickname" className="truncate text-title">{nickname}</p>
        {joinDays !== null ? (
          <p className="mt-1 font-number text-caption text-ink-secondary" style={tabularNums}>
            加入菲丽亚第 {joinDays} 天
          </p>
        ) : null}
      </div>
    </div>
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
              className="mt-2 rounded-full bg-brand-primary px-5 py-2 text-body text-white"
            >
              建立宠物档案
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <section data-testid="me-pets" className="rounded-card bg-card p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-title">我的宠物</h2>
        <Link to="/philia/pets" className="text-caption text-ink-secondary">
          管理
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {pets.map((pet) => (
          <div key={pet.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            {pet.avatarUrl ? (
              <img
                src={pet.avatarUrl}
                alt={pet.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-secondary-light">
                <PawPrint className="h-6 w-6 text-brand-primary" strokeWidth={1.5} />
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
/* ------------------------------------------------------------------ */

const ENTRIES: Array<{ to: string; label: string; icon: typeof Crown }> = [
  { to: '/appointments', label: '我的预约', icon: CalendarCheck },
  { to: '/mall/orders', label: '我的订单', icon: Package },
  { to: '/philia/member', label: '会员卡', icon: Crown },
  { to: '/philia/pets', label: '宠物档案', icon: PawPrint },
  { to: '/philia/moments', label: '宠友圈', icon: Users },
]

function EntryList() {
  return (
    <nav
      data-testid="me-entries"
      aria-label="功能入口"
      className="divide-y divide-line-divider rounded-card bg-card shadow-card"
    >
      {ENTRIES.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5">
          <Icon className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
          <span className="flex-1 text-body">{label}</span>
          <ChevronRight className="h-4 w-4 text-ink-placeholder" strokeWidth={1.5} />
        </Link>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* 4. 设置区（含退出登录确认弹窗）                                        */
/* ------------------------------------------------------------------ */

function SettingsCard({
  onComingSoon,
  onRequestLogout,
}: {
  onComingSoon: () => void
  onRequestLogout: () => void
}) {
  const rowCls = 'flex w-full items-center gap-3 px-4 py-3.5 text-left'
  return (
    <div
      data-testid="me-settings"
      className="divide-y divide-line-divider rounded-card bg-card shadow-card"
    >
      <button type="button" onClick={onComingSoon} className={rowCls}>
        <MessageSquare className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
        <span className="flex-1 text-body">意见反馈</span>
        <ChevronRight className="h-4 w-4 text-ink-placeholder" strokeWidth={1.5} />
      </button>
      <button type="button" onClick={onComingSoon} className={rowCls}>
        <Info className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
        <span className="flex-1 text-body">关于菲丽亚</span>
        <ChevronRight className="h-4 w-4 text-ink-placeholder" strokeWidth={1.5} />
      </button>
      <button type="button" onClick={onRequestLogout} className={rowCls} data-testid="me-logout-btn">
        <LogOut className="h-5 w-5 text-danger-deep" strokeWidth={1.5} />
        <span className="flex-1 text-body text-danger-deep">退出登录</span>
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
      className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(61,50,41,0.4)] px-8"
      onClick={onCancel}
      role="dialog"
      aria-label="退出登录确认"
    >
      <div
        className="w-full max-w-sm rounded-card bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title">退出登录？</p>
        <p className="mt-2 text-body text-ink-secondary">退出后需要重新登录才能继续使用菲丽亚。</p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-full border border-line py-2.5 text-body text-ink-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-testid="me-logout-confirm"
            className="flex-1 rounded-full bg-danger py-2.5 text-body text-white transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
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
    <div className="px-4 pb-6">
      <header className="pt-6">
        <h1 className="text-title-lg">我的</h1>
      </header>

      <div className="mt-4 flex flex-col gap-3">
        <UserCard />
        <PetsSection />
        <EntryList />
        <SettingsCard
          onComingSoon={() => showToast('即将上线，敬请期待')}
          onRequestLogout={() => setConfirmOpen(true)}
        />
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
