/**
 * TicketDetailPage · /support/:id 工单详情（补缺大批片 4 · 小棉花）
 *
 * - 数据：serviceLoop.ticketGet（本人校验，他人 403 明文透出）；
 * - 件：状态 pill + 类型 + 工单号/时刻 mono + 描述 + 附图照片墙（PhotoWall +
 *   全屏 PhotoViewer）+ 回复区（replied 态显示 replyText + repliedAt mono）
 *   + 处理进度时间线（timelineJson 只增不改留痕）。
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PhotoViewer, PhotoWall, friendlyError, usePhiliaClient, type PhotoWallPhoto } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

const STATUS_META: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  submitted: { key: 'ticket.statusSubmitted', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  replied: { key: 'ticket.statusReplied', pill: 'bg-brand-secondary-light text-ink' },
  closed: { key: 'ticket.statusClosed', pill: 'bg-sunken text-ink-placeholder' },
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
}

export default function TicketDetailPage() {
  const { id = '' } = useParams()
  const { trpc } = usePhiliaClient()
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)

  const ticketQ = useQuery({
    queryKey: ['serviceLoop', 'ticketGet', id],
    queryFn: () => trpc.serviceLoop.ticketGet.query({ ticketId: id }),
    enabled: id.length > 0,
  })

  const ticket = ticketQ.data?.ticket ?? null
  const meta = ticket ? (STATUS_META[ticket.status] ?? STATUS_META.submitted!) : null
  const wallPhotos: PhotoWallPhoto[] = (ticket?.photoUrls ?? []).map((url) => ({ id: url, url }))

  return (
    <div className="px-4 pb-6">
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
