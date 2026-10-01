/**
 * 换绑申诉待办块（批次 R13b 大片 2 · DashboardPage 右栏 TodoSection 下方同族区）
 *
 * - 数据：authSecurity.listPhoneAppeals（merchantManagerProcedure 硬闸：店长本店+店主；
 *   clerk 由 DashboardPage enabled=role.canManage 不发查询 + 本块不渲染双保险）；
 *   submitted 升序先提先审，slaBreached（>24h）→ 赭红「超期」签；
 * - 行：申请单号 + 原号 masked → 新号 masked + 申诉说明 + 申请时刻 + SLA 签；
 *   新号明文 server 不透出（报备②），客户昵称 server 队列暂未透出（报备——透出后
 *   行内补渲昵称位，本块不画假件）；
 * - 行操作（min-h-44）：「协助换绑」= 二次确认弹层（单号 + 原号→新号复述 + R15 明面句
 *   「确认已线下核验身份，换绑后数据全保留」+ 核验说明必填）→ reviewPhoneAppeal
 *   ({approve:true,note})；「驳回」= 原因必填弹层 → reviewPhoneAppeal
 *   ({approve:false,note})；成功 toast + 失效刷新，server 错误原文透出；
 * - 空态整块不渲染（取净）；加载/错误态同样不渲染（不挡总览主链路，轮询/重连兜底续追）。
 */

import { usePhiliaClient } from '@philia/shared'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { CashierModal, SheetBtn } from '@/components/cashier/dialogs'
import { formatDateTime } from '@/components/finance/utils'
import { errMsg } from '@/components/mall-admin/format'
import { dc } from '@/copy/dashboard'
import { PHONE_APPEALS_QUERY_KEY, type PhoneAppealItem } from './utils'

/** 申诉时刻小字（mono 数据位） */
const TIME_CLS = 'font-number tabular-nums'

interface ReviewTarget {
  item: PhoneAppealItem
  mode: 'assist' | 'reject'
}

export default function PhoneAppealSection({ items }: { items: PhoneAppealItem[] }) {
  const [target, setTarget] = useState<ReviewTarget | null>(null)

  // 空态整块不渲染（hook 先于早退，序稳定）
  if (items.length === 0) return null

  return (
    <section className="u3-panel" id="phone-appeals" data-testid="phone-appeals-block">
      <div className="u3-panel-head">
        <h3>{dc('dash.appealBlockTitle')}</h3>
        <span className="aside">
          <span className={TIME_CLS}>{items.length}</span> {dc('dash.appealCountUnit')}
        </span>
      </div>
      <div>
        {items.map((item) => (
          <div
            key={item.id}
            data-testid={`phone-appeal-row-${item.requestNo}`}
            className="border-t border-line-divider px-[17px] py-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`${TIME_CLS} text-caption font-semibold`}>{item.requestNo}</span>
              <span className={`${TIME_CLS} text-caption-xs text-ink-secondary`}>
                {formatDateTime(item.createdAt)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption">
              <span className={TIME_CLS}>{item.oldPhoneMasked}</span>
              <span aria-hidden className="text-ink-secondary">
                →
              </span>
              <span className={TIME_CLS}>{item.newPhoneMasked}</span>
              {item.slaBreached ? (
                <span className="rounded-chip bg-danger-light px-1.5 py-0.5 text-caption-xs font-semibold text-danger-deep">
                  {dc('dash.appealSlaOverdue')}
                </span>
              ) : null}
            </div>
            {item.note ? <p className="mt-1 text-caption-xs text-ink-secondary">{item.note}</p> : null}
            <div className="mt-2 flex gap-2">
              <SheetBtn
                variant="primary"
                className="min-h-[44px] flex-1"
                data-testid={`phone-appeal-assist-${item.requestNo}`}
                onClick={() => setTarget({ item, mode: 'assist' })}
              >
                {dc('dash.appealAssistCta')}
              </SheetBtn>
              <SheetBtn
                variant="danger-outline"
                className="min-h-[44px] flex-1"
                data-testid={`phone-appeal-reject-${item.requestNo}`}
                onClick={() => setTarget({ item, mode: 'reject' })}
              >
                {dc('dash.appealRejectCta')}
              </SheetBtn>
            </div>
          </div>
        ))}
      </div>
      <AppealReviewDialog target={target} onClose={() => setTarget(null)} />
    </section>
  )
}

/** 审批弹层（assist=协助换绑二次确认 / reject=驳回原因；双态 note 均必填，客户端可见） */
function AppealReviewDialog({ target, onClose }: { target: ReviewTarget | null; onClose: () => void }) {
  const { trpc, queryClient } = usePhiliaClient()
  const [note, setNote] = useState('')

  // 换单/换态即重置输入（lastNo 模式同既有弹层）
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = target ? `${target.item.id}:${target.mode}` : null
  if (key !== lastKey) {
    setLastKey(key)
    setNote('')
  }

  const reviewM = useMutation({
    mutationFn: (inp: { requestId: string; approve: boolean; note: string }) =>
      trpc.authSecurity.reviewPhoneAppeal.mutate(inp),
    onSuccess: (_r, vars) => {
      toast.success(vars.approve ? dc('dash.appealAssistSuccess') : dc('dash.appealRejectSuccess'))
      void queryClient.invalidateQueries({ queryKey: PHONE_APPEALS_QUERY_KEY })
      onClose()
    },
    // server 错误原文透出（撞号闸/已处理重复审批等）
    onError: (e) => toast.error(errMsg(e)),
  })

  if (!target) return null
  const { item, mode } = target
  const assist = mode === 'assist'
  const valid = note.trim().length > 0

  return (
    <CashierModal
      open={target !== null}
      onClose={onClose}
      title={assist ? dc('dash.appealAssistConfirmTitle') : dc('dash.appealRejectTitle')}
      testid={assist ? 'appeal-assist-dialog' : 'appeal-reject-dialog'}
      footer={
        <>
          <SheetBtn className="min-h-[44px]" disabled={reviewM.isPending} onClick={onClose}>
            {dc('dash.appealCancelCta')}
          </SheetBtn>
          <SheetBtn
            variant={assist ? 'primary' : 'danger-outline'}
            className="min-h-[44px]"
            data-testid="appeal-review-submit"
            disabled={!valid || reviewM.isPending}
            title={!valid ? dc(assist ? 'dash.appealAssistNoteRequired' : 'dash.appealRejectNoteRequired') : undefined}
            onClick={() => {
              if (!valid) return
              reviewM.mutate({ requestId: item.id, approve: assist, note: note.trim() })
            }}
          >
            {assist ? dc('dash.appealAssistSubmit') : dc('dash.appealRejectSubmit')}
          </SheetBtn>
        </>
      }
    >
      {/* 复述卡：单号 + 原号 masked → 新号 masked（新号明文 server 不透出） */}
      <div className="rounded-control bg-canvas px-3.5 py-3">
        <div className={`${TIME_CLS} text-caption font-semibold`} data-testid="appeal-review-no">
          {item.requestNo}
        </div>
        <div className={`mt-1 ${TIME_CLS} text-caption text-ink`}>
          {item.oldPhoneMasked} → {item.newPhoneMasked}
        </div>
        {item.note ? <div className="mt-1 text-caption-xs text-ink-secondary">{item.note}</div> : null}
      </div>

      {/* R15 明面句（仅协助换绑态） */}
      {assist ? (
        <p className="mt-2 rounded-[10px] bg-brand-primary-light px-3 py-2 text-caption-xs font-semibold text-ink">
          {dc('dash.appealAssistNotice')}
        </p>
      ) : null}

      <div className="mt-3">
        <div className="text-caption-xs font-semibold text-ink-secondary">
          {assist ? dc('dash.appealAssistNoteLabel') : dc('dash.appealRejectNoteLabel')}
        </div>
        <textarea
          className="mt-1.5 min-h-[76px] w-full resize-none rounded-control border border-line bg-card px-3 py-2 text-body-sm text-ink placeholder:text-ink-placeholder focus:border-line-strong focus:outline-none disabled:opacity-50"
          data-testid="appeal-review-note"
          placeholder={assist ? dc('dash.appealAssistNotePlaceholder') : dc('dash.appealRejectNotePlaceholder')}
          maxLength={200}
          value={note}
          disabled={reviewM.isPending}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </CashierModal>
  )
}
