/**
 * 商家端登录页 /login（路由 /dev-login 同组件）· U3 批次重做（试样屏 1 · 居中 400px 卡）
 *
 * 规格书 §1：米白 #F6F1E3 画布 → 400px 纸面卡（#FFFDF6 / rounded-20 / 1px ring）→
 * wordmark「PHILIA · 商家端」→ 衬线宣言「店里的每一件小事，都值得被认真对待」（font-serif-cn）→
 * 双字段位 + 柠檬主钮「进入门店」+ 协议小字。
 *
 * ⚠️ 内测现实（不造假按钮）：
 * - 试样「手机号」字段位 → 种子账号列表（店主角色，GET /api/auth/dev-seed-users 动态拉取，
 *   v1.1-b1 不硬编码 ULID）；柠檬主钮：唯一店主种子→直接登录；多个→滚动/聚焦账号列表。
 * - 「内测口令」字段 = 批次 6 B2 真实口令门：401/403 → 必须口令，Enter 或主钮提交加载账号；
 *   登录请求 body 携带 code。
 * - 已登录态：当前账号 + 进入门店 / 退出登录。
 * dev-login 种子登录链路（invalidateQueries + 回跳 from 或 /dashboard）不回归。
 */

import { devLogin, getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared'
import { KeyRound, LogOut, Store } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'

interface SeedUser {
  id: string
  nickname: string
  roles: string[]
}

const ROLE_LABEL: Record<string, string> = {
  merchant_owner: '店主 · merchant_owner',
  merchant_admin: '店员管理 · merchant_admin',
  staff: '员工',
  customer: '客户',
}
const roleLabel = (roles: string[]) => roles.map((r) => ROLE_LABEL[r] ?? r).join(' / ')

/* 试样 .fld 字段工艺：米白底 + 内描边 1px ring + 14 圆角 */
const FLD =
  'bg-[#F6F1E3] rounded-[14px] shadow-[inset_0_0_0_1px_rgba(74,59,46,0.09)]'

export default function DevLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const { queryClient } = usePhiliaClient()
  const { user, refetch } = useMe()

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [manualId, setManualId] = useState('')
  const [error, setError] = useState<string | null>(null)

  /* ---- v1.1-b1：动态拉取种子用户（仅店主角色） ---- */
  const [seeds, setSeeds] = useState<SeedUser[] | null>(null)
  const [seedsError, setSeedsError] = useState<string | null>(null)
  /* ---- 批次 6 任务 B2：内测口令门（服务端 BETA_GATE_CODE 设置后须带口令） ---- */
  const [gateRequired, setGateRequired] = useState(false)
  const [gateCode, setGateCode] = useState('')
  const [gateError, setGateError] = useState<string | null>(null)
  const accountsRef = useRef<HTMLDivElement>(null)

  const loadSeeds = (code?: string) => {
    const qs = code ? `?code=${encodeURIComponent(code)}` : ''
    fetch(`${getApiBase()}/api/auth/dev-seed-users${qs}`)
      .then(async (r) => {
        if (r.status === 401) {
          // 服务端要求内测口令 → 口令字段转为必填
          setGateRequired(true)
          setGateError(null)
          return null
        }
        if (r.status === 403) {
          setGateRequired(true)
          setGateError('内测口令错误，请重新输入')
          return null
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as { users?: SeedUser[] }
      })
      .then((d) => {
        if (d) {
          setSeeds(d.users ?? [])
          setSeedsError(null)
          setGateError(null)
        }
      })
      .catch((e) => {
        setSeedsError(e instanceof Error ? e.message : '拉取失败')
      })
  }

  useEffect(() => {
    loadSeeds()
    // 仅首挂载拉一次；口令提交由 submitGate 显式触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitGate = () => {
    const code = gateCode.trim()
    if (!code) return
    loadSeeds(code)
  }
  const merchantSeeds = (seeds ?? []).filter((u) => u.roles.includes('merchant_owner'))

  const doLogin = async (userId: string) => {
    setPendingId(userId)
    setError(null)
    try {
      await devLogin(getApiBase(), userId, gateCode.trim() || undefined)
      await queryClient.invalidateQueries()
      // M1-补2 G：缺省落地改走 / 由 RoleLanding 按角色分流（clerk → /cashier）
      navigate(from && from !== '/dev-login' && from !== '/login' ? from : '/', {
        replace: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败'
      // 口令缺失/错误 → 口令字段转为必填
      if (msg.includes('口令')) setGateRequired(true)
      setError(msg)
    } finally {
      setPendingId(null)
    }
  }

  const doLogout = async () => {
    setError(null)
    try {
      await logout(getApiBase())
      await queryClient.invalidateQueries()
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登出失败')
    }
  }

  /* 柠檬主钮：口令挡路→提交口令；唯一店主种子→直接登录；多个→滚动/聚焦账号列表 */
  const handlePrimary = () => {
    if (gateRequired && seeds === null) {
      submitGate()
      return
    }
    if (merchantSeeds.length === 1) {
      void doLogin(merchantSeeds[0].id)
      return
    }
    accountsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    accountsRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }

  const primaryBusy = pendingId !== null

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* 400px 登录卡（试样 .login-card：#FFFDF6 / rounded-20 / 1px ring / 34·32 内边距） */}
        <div
          data-testid="login-gate"
          className="rounded-[20px] bg-[#FFFDF6] px-8 pb-8 pt-[34px] text-center shadow-[0_0_0_1px_rgba(74,59,46,0.09)]"
        >
          <p className="font-display text-[14px] font-bold tracking-[.3em] text-[rgba(74,59,46,0.42)]">
            PHILIA · 商家端
          </p>
          <h1 className="u1-serif mt-3.5 text-[20px] font-bold leading-[34px]">
            店里的每一件小事，
            <br />
            都值得被认真对待
          </h1>
          <p className="mt-1.5 text-[12px] text-[rgba(74,59,46,0.62)]">
            菲丽亚宠物 · 门店经营后台（内测）
          </p>

          {user ? (
            /* ---- 已登录态：当前账号 + 进入门店 / 退出登录 ---- */
            <div className="mt-6">
              <div className={`${FLD} flex items-center gap-3 px-4 py-3.5 text-left`}>
                <Store size={16} strokeWidth={1.8} className="shrink-0 text-[rgba(74,59,46,0.62)]" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">
                    {user.nickname ?? user.id}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[rgba(74,59,46,0.42)]">
                    {user.roles.join(' / ')}
                  </span>
                </span>
              </div>
              <button
                type="button"
                data-testid="login-primary"
                onClick={() => navigate('/dashboard')}
                className="mt-3 w-full rounded-[14px] bg-brand-primary py-3.5 text-[14px] font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                进入门店
              </button>
              <button
                type="button"
                onClick={doLogout}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#FFFDF6] py-3 text-[12px] font-semibold text-[rgba(74,59,46,0.62)] shadow-[inset_0_0_0_1px_rgba(74,59,46,0.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                <LogOut size={13} strokeWidth={1.8} />
                退出登录
              </button>
            </div>
          ) : (
            /* ---- 未登录态：种子账号列表（试样手机号位）+ 内测口令 + 柠檬主钮 ---- */
            <div className="mt-6">
              {/* 种子账号列表 = 试样「手机号」字段位（内测登录真链路） */}
              <div ref={accountsRef} className="scroll-mt-6 text-left">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[rgba(74,59,46,0.42)]">
                  <Store size={12} strokeWidth={1.8} />
                  店主账号
                </p>
                {gateRequired && seeds === null ? (
                  <p className={`${FLD} px-4 py-3.5 text-[12px] text-[rgba(74,59,46,0.42)]`}>
                    内测环境需先在下方输入口令
                  </p>
                ) : seeds === null && seedsError === null ? (
                  <div className="space-y-2">
                    {[1].map((i) => (
                      <div key={i} className="h-[52px] animate-pulse rounded-[14px] bg-sunken" />
                    ))}
                  </div>
                ) : merchantSeeds.length > 0 ? (
                  <ul className="space-y-2">
                    {merchantSeeds.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={primaryBusy}
                          onClick={() => void doLogin(u.id)}
                          className={`${FLD} flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-60`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-semibold">
                              {u.nickname}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-[rgba(74,59,46,0.42)]">
                              {roleLabel(u.roles)}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] text-[rgba(74,59,46,0.62)]">
                            {pendingId === u.id ? '登录中…' : '登录 ›'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-[14px] bg-danger-light px-4 py-3 text-[11px] text-danger-deep">
                    {seedsError
                      ? `种子用户拉取失败（${seedsError}），请确认 server 已启动，或手动输入 userId`
                      : '未拉到店主种子用户，请重跑 server 的 db:seed，或手动输入 userId'}
                  </p>
                )}
              </div>

              {/* 内测口令字段（批次 6 B2 真实链路；Enter 提交加载账号） */}
              <div className="mt-3 text-left">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[rgba(74,59,46,0.42)]">
                  <KeyRound size={12} strokeWidth={1.8} />
                  内测口令{gateRequired ? '（必填）' : '（如服务端已开启口令门）'}
                </p>
                <Input
                  type="password"
                  value={gateCode}
                  onChange={(e) => setGateCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitGate()
                  }}
                  placeholder="内测口令"
                  className="h-[46px] rounded-[14px] border-0 bg-[#F6F1E3] px-4 text-body-sm shadow-[inset_0_0_0_1px_rgba(74,59,46,0.09)] focus-visible:ring-1 focus-visible:ring-[rgba(74,59,46,0.3)] focus-visible:ring-offset-0"
                />
                {gateError ? (
                  <p className="mt-1.5 text-[11px] text-danger-deep">{gateError}</p>
                ) : null}
              </div>

              {/* 柠檬主钮 */}
              <button
                type="button"
                data-testid="login-primary"
                disabled={primaryBusy || (gateRequired && seeds === null && gateCode.trim().length === 0)}
                onClick={handlePrimary}
                className="mt-3.5 w-full rounded-[14px] bg-brand-primary py-3.5 text-[14px] font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-60"
              >
                {pendingId !== null ? '登录中…' : '进入门店'}
              </button>
            </div>
          )}

          {/* 协议小字（试样所印 10px 越字阶闸门 → 11，员工端 E-19 同口径映射） */}
          <p className="mt-3.5 text-caption-xs leading-relaxed text-[rgba(74,59,46,0.42)]">
            登录即同意《商家内测协议》· 遇到问题联系 philia 小助手
          </p>
        </div>

        {/* 卡外兜底：手动输入 userId（重跑 db:seed 后 ID 变化时备用） */}
        {!user ? (
          <div className="mt-4">
            <div className="flex gap-2">
              <Input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="手动输入 userId（ULID）兜底"
                className="h-11 rounded-[14px] border-0 bg-[#FFFDF6] px-4 text-[12px] shadow-[0_0_0_1px_rgba(74,59,46,0.09)] focus-visible:ring-1 focus-visible:ring-[rgba(74,59,46,0.3)] focus-visible:ring-offset-0"
              />
              <button
                type="button"
                disabled={primaryBusy || manualId.trim().length === 0}
                onClick={() => void doLogin(manualId.trim())}
                className="h-11 shrink-0 rounded-[14px] bg-[#FFFDF6] px-4 text-[12px] font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,0.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
              >
                登录
              </button>
            </div>
            {error ? (
              <p className="mt-3 rounded-[14px] bg-danger-light px-4 py-3 text-[12px] text-danger-deep">
                {error}
              </p>
            ) : null}
            <p className="mt-4 text-center text-[11px] leading-relaxed text-[rgba(74,59,46,0.42)]">
              仅开发环境：dev-login 仅允许种子用户（kimi_id 以 seed_ 前缀），会话 cookie 有效期 7 天。
              非商家账号登录后会被引导回本页切换。
            </p>
          </div>
        ) : null}

        {user && error ? (
          <p className="mt-3 rounded-[14px] bg-danger-light px-4 py-3 text-[12px] text-danger-deep">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
