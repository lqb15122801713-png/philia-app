/**
 * 会员码核验卡（端口批收尾片 3 · 股 3 · 收银台 MemberSearch 旁挂点，owner|manager）
 *
 * 「扫码/录码核验（与手机号检索并列通道）」：粘贴自动去空格 → membership.verifyCardToken
 * （验签+时效+档透出，merchantManager 硬闸）→ 命中后预热 membership.forUser 同键缓存
 * （MemberSearch 选中即自动取明细=既有正式通道，不重复造读口）→ 映射 CashierMember 调
 * onIdentified（缺字段 phoneMasked/次卡/储值/预约数=null/0 占位+注记「码通道带出=档位/
 * 状态为主」，不报假值）；失败明文展示（过期/篡改/越界统一 server 原文）。
 */

import { usePhiliaClient } from '@philia/shared'
import { TRPCClientError } from '@trpc/client'
import { ScanLine } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MEMBER_FOR_USER_KEY } from './membership'
import type { CashierMember } from './model'
import { cc } from '@/copy/cashier'

export default function ScanVerifyCard({ onIdentified }: { onIdentified: (m: CashierMember) => void }) {
  const { trpc, queryClient } = usePhiliaClient()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verify = async () => {
    /* 粘贴自动去空格（扫码枪/手输混贴容错） */
    const t = token.replace(/\s+/g, '')
    if (!t || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await trpc.membership.verifyCardToken.mutate({ token: t })
      /* 明细=既有 forUser 正式通道（MemberSearch 选中后自动取；此处预热同键缓存零增发） */
      void queryClient.prefetchQuery({
        queryKey: MEMBER_FOR_USER_KEY(r.userId),
        queryFn: () => trpc.membership.forUser.query({ userId: r.userId }),
      })
      toast.success(cc('cashier.scanDone'))
      onIdentified({
        id: r.userId,
        nickname: null,
        phoneMasked: null,
        passRemainTimes: 0,
        storedValueBalanceFen: 0,
        appointmentCount: 0,
      })
      setToken('')
    } catch (e) {
      setError(e instanceof TRPCClientError ? e.message : cc('cashier.scanFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-[rgba(59,46,36,.06)] pt-3" data-testid="cashier-scan-card">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ScanLine size={14} strokeWidth={1.8} className="text-ink" aria-hidden />
        <span className="text-caption font-semibold text-ink">{cc('cashier.scanTitle')}</span>
        <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{cc('cashier.scanHint')}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          data-testid="cashier-scan-input"
          value={token}
          onChange={(e) => {
            setToken(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void verify()
          }}
          placeholder={cc('cashier.scanInputPh')}
          className="flex-1 rounded-full bg-[#FFFDF6] px-4 py-2.5 text-body-sm text-ink shadow-[0_0_0_1px_rgba(59,46,36,.09)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.25)]"
        />
        <button
          type="button"
          data-testid="cashier-scan-verify"
          disabled={busy || token.replace(/\s+/g, '') === ''}
          onClick={() => void verify()}
          className="shrink-0 rounded-full bg-brand-primary px-4 py-2.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? cc('cashier.scanVerifying') : cc('cashier.scanVerifyCta')}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-caption-xs font-semibold text-danger-deep" data-testid="cashier-scan-error">
          {error}
        </p>
      ) : null}
      <p className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]">{cc('cashier.scanNote')}</p>
    </div>
  )
}
