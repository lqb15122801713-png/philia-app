/**
 * 客服工单待办块（补缺大批片 4 · DashboardPage 右栏 TodoSection 下方）
 *
 * - 数据：serviceLoop.ticketListPending（本店 owner|manager，submitted 创建升序），
 *   查询/断线轮询兜底/重连全量在页面层统一（DashboardPage），本块纯渲染+操作；
 *   ticket.replied 为 user 频道（客户侧）事件，商家端无 store 频道推送——
 *   刷新靠重连全量 + 断线轮询兜底 + 本块操作后失效（不新增订阅，已报备）；
 * - 行：工单号（mono）+ 类型签 + 描述截断 + 联系方式 + 申请时刻；
 *   「回复」弹层（textarea 必填）→ ticketReply → toast + 失效；
 * - 空态不渲染区块；加载中骨架行（禁转圈）；失败给错误行 + 真重试。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/appointments/Modal'
import { errMsg, fmtDateTime } from '@/components/mall-admin/format'
import { dc } from '@/copy/dashboard'
import { TICKET_PENDING_QUERY_KEY, TICKET_SECTION_ID, type TicketPendingItem } from './utils'

/** 类型签 chip（u3 面板浅底工艺：sunken 底墨色字） */
const CHIP_CLS = 'rounded-md bg-sunken px-[7px] py-[2px] text-[11px] font-semibold text-ink'
/** 行内操作钮（QuietButton 同族缩小档） */
const ROW_BTN_CLS =
  'u1-ring shrink-0 rounded-full bg-card px-3.5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50'
/* 弹层按钮（ghost / 柠檬 primary，与 cashier SheetBtn 同工艺） */
const DIALOG_BTN_GHOST =
  'rounded-full bg-[#FFFDF6] px-4 py-2.5 text-caption text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50'
const DIALOG_BTN_PRIMARY =
  'rounded-full bg-brand-primary px-4 py-2.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50'

function typeLabel(type: string): string {
  switch (type) {
    case 'suggest':
      return dc('dash.ticketTypeSuggest')
    case 'complaint':
      return dc('dash.ticketTypeComplaint')
    case 'praise':
      return dc('dash.ticketTypePraise')
    default:
      return dc('dash.ticketTypeOther')
  }
}

export default function TicketTodoSection({
  items,
  loading,
  error,
  onRetry,
}: {
  items: TicketPendingItem[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const [replyTarget, setReplyTarget] = useState<TicketPendingItem | null>(null)

  if (error) {
    return (
      <section className="u3-panel" id={TICKET_SECTION_ID}>
        <div className="u3-panel-head">
          <h3>{dc('dash.ticketBlockTitle')}</h3>
        </div>
        <div className="flex items-center justify-between px-[17px] py-3">
          <p className="text-[12px] text-[rgba(59,46,36,.62)]">{dc('dash.ticketLoadFailed')}</p>
          <button type="button" className={ROW_BTN_CLS} onClick={onRetry} data-testid="ticket-todo-retry">
            {dc('dash.retry')}
          </button>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="u3-panel" id={TICKET_SECTION_ID}>
        <div className="u3-panel-head">
          <h3>{dc('dash.ticketBlockTitle')}</h3>
        </div>
        <div className="space-y-2 px-[17px] pb-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </section>
    )
  }

  /* 空态不渲染区块 */
  if (!items || items.length === 0) return null

  return (
    <section className="u3-panel" id={TICKET_SECTION_ID} data-testid="dash-ticket-section">
      <div className="u3-panel-head">
        <h3>{dc('dash.ticketBlockTitle')}</h3>
        <span className="aside">
          <span className="font-number tabular-nums">{items.length}</span> 笔
        </span>
      </div>
      <div>
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3"
            data-testid={`ticket-todo-row-${t.ticketNo}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-number text-caption font-semibold tabular-nums">{t.ticketNo}</span>
                <span className={CHIP_CLS}>{typeLabel(t.type)}</span>
                <span className="ml-auto font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.42)]">
                  {fmtDateTime(t.createdAt)}
                </span>
              </div>
              <p className="mt-1 truncate text-caption-xs text-[rgba(59,46,36,.62)]">{t.description}</p>
              <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">
                {t.contactPhone ?? dc('dash.ticketContactNone')}
                {t.photoUrls.length > 0 ? ` · ${dc('dash.ticketPhotoCount', { n: t.photoUrls.length })}` : ''}
              </div>
            </div>
            <button
              type="button"
              className={ROW_BTN_CLS}
              data-testid={`ticket-reply-open-${t.ticketNo}`}
              onClick={() => setReplyTarget(t)}
            >
              {dc('dash.ticketReplyCta')}
            </button>
          </div>
        ))}
      </div>
      <TicketReplyDialog ticket={replyTarget} onClose={() => setReplyTarget(null)} />
    </section>
  )
}

/** 回复弹层：textarea 必填 → ticketReply → toast + 失效（换工单即重置输入） */
function TicketReplyDialog({
  ticket,
  onClose,
}: {
  ticket: TicketPendingItem | null
  onClose: () => void
}) {
  const { trpc, queryClient } = usePhiliaClient()
  const [reply, setReply] = useState('')

  const [lastId, setLastId] = useState<string | null>(null)
  if ((ticket?.id ?? null) !== lastId) {
    setLastId(ticket?.id ?? null)
    setReply('')
  }

  const replyM = useMutation({
    mutationFn: (input: { ticketId: string; reply: string }) => trpc.serviceLoop.ticketReply.mutate(input),
    onSuccess: () => {
      if (ticket) toast.success(dc('dash.ticketReplySuccess', { no: ticket.ticketNo }))
      void queryClient.invalidateQueries({ queryKey: TICKET_PENDING_QUERY_KEY })
      onClose()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const valid = reply.trim().length > 0

  return (
    <Modal
      open={ticket !== null}
      title={ticket ? dc('dash.ticketReplyTitle', { no: ticket.ticketNo }) : ''}
      onClose={onClose}
    >
      {ticket ? (
        <div>
          {/* 工单摘要卡（全文展示，不截断） */}
          <div className="rounded-[14px] bg-[#FAF8F2] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-number text-caption font-semibold tabular-nums">{ticket.ticketNo}</span>
              <span className={CHIP_CLS}>{typeLabel(ticket.type)}</span>
              <span className="ml-auto font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.42)]">
                {fmtDateTime(ticket.createdAt)}
              </span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-caption-xs text-[rgba(59,46,36,.62)]">
              {ticket.description}
            </p>
            <div className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]">
              {ticket.contactPhone ?? dc('dash.ticketContactNone')}
              {ticket.photoUrls.length > 0
                ? ` · ${dc('dash.ticketPhotoCount', { n: ticket.photoUrls.length })}`
                : ''}
            </div>
          </div>

          <div className="mt-3 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
            {dc('dash.ticketReplyLabel')}
          </div>
          <textarea
            className="mt-1.5 min-h-[76px] w-full resize-none rounded-[14px] bg-[#FFFDF6] px-3 py-2 text-body-sm text-ink shadow-[0_0_0_1px_rgba(59,46,36,.12)] placeholder:text-[rgba(59,46,36,.3)] focus:outline-none focus:shadow-[0_0_0_1px_rgba(59,46,36,.3)]"
            data-testid="ticket-reply-input"
            placeholder={dc('dash.ticketReplyPlaceholder')}
            maxLength={1000}
            value={reply}
            disabled={replyM.isPending}
            onChange={(e) => setReply(e.target.value)}
          />
          {!valid ? (
            <p className="mt-2 text-caption-xs font-semibold text-danger-deep">{dc('dash.ticketReplyRequired')}</p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={DIALOG_BTN_GHOST} disabled={replyM.isPending} onClick={onClose}>
              {dc('dash.cancel')}
            </button>
            <button
              type="button"
              className={DIALOG_BTN_PRIMARY}
              data-testid="ticket-reply-submit"
              disabled={!valid || replyM.isPending}
              onClick={() => replyM.mutate({ ticketId: ticket.id, reply: reply.trim() })}
            >
              {replyM.isPending ? dc('dash.ticketReplySubmitting') : dc('dash.ticketReplySubmit')}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
