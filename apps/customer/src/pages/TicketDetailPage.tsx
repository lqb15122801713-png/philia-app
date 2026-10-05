/**
 * TicketDetailPage · /support/:id 工单详情（补缺大批片 4 · 小棉花）
 *
 * - 数据：serviceLoop.ticketGet（本人校验，他人 403 明文透出）；
 * - 件：状态 pill + 类型 + 工单号/时刻 mono + 描述 + 附图照片墙（PhotoWall +
 *   全屏 PhotoViewer）+ 回复区（replied 态显示 replyText + repliedAt mono）
 *   + 处理进度时间线（timelineJson 只增不改留痕）；
 * - 店长介入（体验批片 4 C5 · ticketEscalate）：submitted/replied 显示
 *   「申请店长介入」确认层（补充说明选填）→ escalated 态透出徽章+升级说明+
 *   升级时刻，时间线 action=escalated 渲染「申请店长介入」。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PhotoViewer, PhotoWall, friendlyError, usePhiliaClient, useToast, type PhotoWallPhoto } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

const STATUS_META: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  submitted: { key: 'ticket.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  replied: { key: 'ticket.statusReplied', pill: 'bg-brand-secondary-light text-ink' },
  closed: { key: 'ticket.statusClosed', pill: 'bg-sunken text-ink-placeholder' },
  escalated: { key: 'ticket.statusEscalated', pill: 'bg-danger-light text-danger-deep' },
}

const TYPE_LABEL: Record<string, ServiceLoopCopyKey> = {
  suggest: 'ticket.typeSuggest',
  complaint: 'ticket.typeComplaint',
  praise: 'ticket.typePraise',
  other: 'ticket.typeOther',
}

const TIMELINE_LABEL: Record<string, ServiceLoopCopyKey> = {
  submitted: 'ticket.timelineSubmitted',
  replied: 'ticket.timelineReplied',
  closed: 'ticket.timelineClosed',
  escalated: 'ticket.timelineEscalated',
}

export default function TicketDetailPage() {
  const { id = '' } = useParams()
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast({ durationMs: 3200 })
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)
  // 店长介入（体验批片 4 C5）：确认层开合 + 补充说明（选填）
  const [escalating, setEscalating] = useState(false)
  const [escalateNote, setEscalateNote] = useState('')

  const ticketQ = useQuery({
    queryKey: ['serviceLoop', 'ticketGet', id],
    queryFn: () => trpc.serviceLoop.ticketGet.query({ ticketId: id }),
    enabled: id.length > 0,
  })

  const escalateM = useMutation({
    mutationFn: () =>
      trpc.serviceLoop.ticketEscalate.mutate({
        ticketId: id,
        ...(escalateNote.trim() ? { note: escalateNote.trim() } : {}),
      }),
    onSuccess: () => {
      setEscalating(false)
      setEscalateNote('')
      void queryClient.invalidateQueries({ queryKey: ['serviceLoop', 'ticketGet', id] })
      void queryClient.invalidateQueries({ queryKey: ['serviceLoop', 'ticketListMine'] })
      showToast(sl('ticket.escalateDone'), 'info')
    },
    onError: (err) => showToast(friendlyError(err, sl('ticket.escalateFail')), 'error'),
  })

  const ticket = ticketQ.data?.ticket ?? null
  const meta = ticket ? (STATUS_META[ticket.status] ?? STATUS_META.submitted!) : null
  const wallPhotos: PhotoWallPhoto[] = (ticket?.photoUrls ?? []).map((url) => ({ id: url, url }))

  return (
    <div className="px-4 pb-6">
      {toastEl}
      {/* U1-A：统一返回条（←圆钮+标题），固定返回工单列表 */}
      <PageHeader title={sl('ticket.detailTitle')} fallback="/support" className="pt-6" />

      <div className="mt-4">
        {ticketQ.isPending ? <LoadingBlock lines={3} /> : null}
        {ticketQ.isError ? (
          <ErrorState
            message={friendlyError(ticketQ.error, sl('ticket.loadFail'))}
            onRetry={() => void ticketQ.refetch()}
            action={
              <Link
                to="/support"
                className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('ticket.backList')}
              </Link>
            }
          />
        ) : null}
      </div>

      {ticket && meta ? (
        <div className="mt-4 flex flex-col gap-3" data-testid="ticket-detail">
          {/* 主体卡：状态 + 类型 + 描述 + 单号/时刻 mono */}
          <section className="u1-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-body-sm font-semibold">{sl(TYPE_LABEL[ticket.type] ?? 'ticket.typeOther')}</p>
              <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
                {sl(meta.key)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink">{ticket.description}</p>
            {wallPhotos.length > 0 ? (
              <div className="mt-3">
                <PhotoWall photos={wallPhotos} onPhotoClick={(p) => setViewing(p)} />
              </div>
            ) : null}
            <p className="u1-num mt-3 text-caption-xs text-ink-placeholder">
              {ticket.ticketNo} · {fmtDateTime(ticket.createdAt)}
            </p>
          </section>

          {/* 回复区（replied 态显示：店员回复 + repliedAt mono） */}
          {ticket.status === 'replied' && ticket.replyText ? (
            <section className="rounded-card bg-brand-secondary-light p-4" data-testid="ticket-reply">
              <p className="text-body-sm font-semibold">{sl('ticket.replyTitle')}</p>
              <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink">{ticket.replyText}</p>
              {ticket.repliedAt ? (
                <p className="u1-num mt-2 text-caption-xs text-ink-placeholder">
                  {fmtDateTime(ticket.repliedAt)}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* 店长介入（体验批片 4 C5）：escalated 态透出徽章+升级说明+时刻 */}
          {ticket.status === 'escalated' ? (
            <section className="u1-card p-4" data-testid="ticket-escalated">
              <span className="rounded-chip bg-danger-light px-[7px] py-0.5 text-caption-xs font-semibold text-danger-deep">
                {sl('ticket.escalatedBadge')}
              </span>
              {ticket.escalateNote ? (
                <div className="mt-2">
                  <p className="text-caption-xs text-ink-placeholder">{sl('ticket.escalateNoteTitle')}</p>
                  <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink">{ticket.escalateNote}</p>
                </div>
              ) : null}
              {ticket.escalatedAt ? (
                <p className="u1-num mt-2 text-caption-xs text-ink-placeholder">
                  {sl('ticket.escalatedAtLine', { time: fmtDateTime(ticket.escalatedAt) })}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* 申请店长介入：submitted/replied 在途件可升级（已升级幂等，已关闭服务端硬拒） */}
          {ticket.status === 'submitted' || ticket.status === 'replied' ? (
            escalating ? (
              <section className="u1-card p-4" data-testid="ticket-escalate-panel">
                <p className="text-body-sm font-semibold">{sl('ticket.escalateTitle')}</p>
                <p className="mt-1 text-caption text-ink-secondary">{sl('ticket.escalateDesc')}</p>
                <p className="mt-3 text-caption text-ink-secondary">{sl('ticket.escalateNoteLabel')}</p>
                <textarea
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={sl('ticket.escalateNotePlaceholder')}
                  className="mt-1.5 w-full rounded-input border border-line bg-card px-3.5 py-2.5 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEscalating(false)}
                    className="h-11 flex-1 rounded-full bg-sunken text-body font-medium text-ink"
                  >
                    {sl('ticket.escalateCancel')}
                  </button>
                  <button
                    type="button"
                    disabled={escalateM.isPending}
                    onClick={() => escalateM.mutate()}
                    className="h-11 flex-1 rounded-full bg-brand-primary text-body font-medium text-ink disabled:opacity-60"
                  >
                    {escalateM.isPending ? sl('ticket.submitting') : sl('ticket.escalateSubmit')}
                  </button>
                </div>
              </section>
            ) : (
              <button
                type="button"
                data-testid="ticket-escalate-btn"
                onClick={() => setEscalating(true)}
                className="u1-card flex h-11 w-full items-center justify-center text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                {sl('ticket.escalateCta')}
              </button>
            )
          ) : null}

          {/* 处理进度时间线（timelineJson 只增不改） */}
          <section className="u1-card p-4" data-testid="ticket-timeline">
            <p className="text-body-sm font-semibold">{sl('ticket.timelineTitle')}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {ticket.timelineJson.map((item, i) => (
                <li key={`${item.action}-${i}`} className="flex items-baseline justify-between gap-2 text-caption">
                  <span className="text-ink">{sl(TIMELINE_LABEL[item.action] ?? 'ticket.timelineSubmitted')}</span>
                  <span className="u1-num shrink-0 text-ink-placeholder">{fmtDateTime(new Date(item.at))}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {viewing ? (
        <PhotoViewer
          photos={[viewing]}
          index={0}
          onClose={() => setViewing(null)}
          onNavigate={() => {}}
          keyboard={false}
        />
      ) : null}
    </div>
  )
}
