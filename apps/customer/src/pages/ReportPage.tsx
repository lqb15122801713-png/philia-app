/**
 * ReportPage · /philia/reports/:appointmentId 美容报告（补缺大批片 4）
 *
 * - 数据：serviceLoop.reportFor（首读幂等置 deliveredAt；无报告=server 404 明文透出）；
 * - 报告卡=体征五项表（label+值+三态 pill：正常=卡其浅底不设绿 / 注意=淡金 /
 *   异常=赭红）+ 异常提示卡（有 abnormalText 才显）+ 下次建议（有才显）
 *   + 「美容报告 30 分钟内送达」承诺行 + 生成/送达时刻 mono 留痕行；
 * - 体征 label 按 vital.key 走 copy 键（server 快照 label 兜底）；值缺省=「本次未记录」
 *   （server 留痕口径同词），不画假读数。
 */

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { friendlyError, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { sl, type ServiceLoopCopyKey } from '@/copy/serviceloop'

/* 体征五项 key → copy 键 / 三态 → copy 键 + pill 样式（反馈件不设绿：正常=卡其浅底） */
const VITAL_LABEL_KEY: Record<string, ServiceLoopCopyKey> = {
  weight: 'report.vitalWeight',
  skin: 'report.vitalSkin',
  ear: 'report.vitalEar',
  coat: 'report.vitalCoat',
  nail: 'report.vitalNail',
}
const VITAL_STATUS: Record<string, { key: ServiceLoopCopyKey; pill: string }> = {
  normal: { key: 'report.statusNormal', pill: 'bg-brand-secondary-light text-ink' },
  attention: { key: 'report.statusAttention', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  abnormal: { key: 'report.statusAbnormal', pill: 'bg-danger-light text-danger-deep' },
}

export default function ReportPage() {
  const { appointmentId = '' } = useParams()
  const { trpc } = usePhiliaClient()

  const reportQ = useQuery({
    queryKey: ['serviceLoop', 'reportFor', appointmentId],
    queryFn: () => trpc.serviceLoop.reportFor.query({ appointmentId }),
    enabled: appointmentId.length > 0,
  })

  const report = reportQ.data?.report ?? null

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），直访兜底回预约详情 */}
      <PageHeader title={sl('report.title')} fallback={`/appointments/${appointmentId}`} className="pt-6" />

      <div className="mt-4">
        {reportQ.isPending ? <LoadingBlock lines={3} /> : null}
        {reportQ.isError ? (
          <ErrorState
            message={friendlyError(reportQ.error, sl('report.loadFail'))}
            onRetry={() => void reportQ.refetch()}
          />
        ) : null}
      </div>

      {report ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card" data-testid="report-card">
          {/* 体征五项表（label+值+三态 pill） */}
          <h2 className="text-title">{sl('report.vitalsTitle')}</h2>
          <ul className="mt-2 divide-y divide-line-divider" data-testid="report-vitals">
            {report.vitals.map((v) => {
              const meta = VITAL_STATUS[v.status] ?? VITAL_STATUS.normal!
              const labelKey = VITAL_LABEL_KEY[v.key]
              return (
                <li key={v.key} className="flex items-center gap-2 py-2.5 text-body-sm">
                  <span className="w-10 shrink-0 text-ink-secondary">
                    {labelKey ? sl(labelKey) : v.label}
                  </span>
                  <span className="u1-num min-w-0 flex-1 text-ink">
                    {v.value || sl('report.notRecorded')}
                  </span>
                  <span className={`shrink-0 rounded-chip px-[7px] py-0.5 text-caption-xs font-semibold ${meta.pill}`}>
                    {sl(meta.key)}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* 异常提示卡（有 abnormalText 才显） */}
          {report.abnormalText ? (
            <p
              className="mt-3 rounded-control bg-danger-light px-3.5 py-2.5 text-caption text-danger-deep"
              data-testid="report-abnormal"
            >
              <span className="font-semibold">{sl('report.abnormalTitle')}：</span>
              {report.abnormalText}
            </p>
          ) : null}

          {/* 下次护理建议（有才显） */}
          {report.nextAdvice ? (
            <div className="mt-3 rounded-control bg-sunken px-3.5 py-2.5">
              <p className="text-caption font-semibold text-ink">{sl('report.nextAdviceTitle')}</p>
              <p className="mt-1 text-caption text-ink-secondary">{report.nextAdvice}</p>
            </div>
          ) : null}

          {/* 承诺行 + 生成/送达时刻 mono 留痕 */}
          <p className="mt-4 text-center text-caption-xs text-ink-placeholder" data-testid="report-promise">
            {sl('report.promiseLine')}
          </p>
          <p className="u1-num mt-1 text-center text-caption-xs text-ink-placeholder">
            {sl('report.traceLine', {
              generatedAt: fmtDateTime(report.generatedAt),
              deliveredAt: fmtDateTime(report.deliveredAt),
            })}
          </p>
        </section>
      ) : null}
    </div>
  )
}
