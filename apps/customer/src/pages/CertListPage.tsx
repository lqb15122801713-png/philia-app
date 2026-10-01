/**
 * CertListPage · /philia/certs 安心证书列表（补缺大批片 4）
 *
 * - 数据：serviceLoop.myCertificates（本人证书，生成时间倒序，上限 50）；
 * - 行=缩略图（payload.afterUrl）+ 宠物名/服务/门店 + 完成时刻 mono；
 *   点击进 /philia/certs/:appointmentId 详情卡；
 * - R10：证书=server confirmStep 末步真生成（无前后对比照不落行），本页只读真数据，
 *   无数据=空态三句话（出口=服务相册 /philia/moments），不画假证书。
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { EmptyState, ErrorState, LoadingBlock } from '../components/home/common'
import { sl } from '@/copy/serviceloop'

export default function CertListPage() {
  const { trpc } = usePhiliaClient()
  const certsQ = useQuery({
    queryKey: ['serviceLoop', 'myCertificates'],
    queryFn: () => trpc.serviceLoop.myCertificates.query(),
  })

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回 philia 页 */}
      <PageHeader title={sl('cert.listTitle')} fallback="/philia" className="pt-6" />

      <div className="mt-4">
        {certsQ.isPending ? <LoadingBlock lines={3} /> : null}
        {certsQ.isError ? (
          <ErrorState message={sl('cert.loadFail')} onRetry={() => void certsQ.refetch()} />
        ) : null}
        {certsQ.data && certsQ.data.length === 0 ? (
          <EmptyState
            title={sl('cert.emptyTitle')}
            desc={sl('cert.emptyBody')}
            action={
              /* §4.11 空态出口钮=深棕墨底淡字 */
              <Link
                to="/philia/moments"
                className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('cert.emptyCta')}
              </Link>
            }
          />
        ) : null}
      </div>

      {certsQ.data && certsQ.data.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3" data-testid="cert-list">
          {certsQ.data.map((cert) => (
            <li key={cert.id}>
              <Link
                to={`/philia/certs/${cert.appointmentId}`}
                data-testid={`cert-item-${cert.appointmentId}`}
                className="u1-ring flex items-center gap-3 rounded-card bg-card p-3 transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
              >
                <img
                  src={cert.payload.afterUrl}
                  alt={sl('album.photoAlt', { pet: cert.payload.petName })}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-control object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold">
                    {cert.payload.petName} · {cert.payload.serviceName}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-ink-secondary">
                    {cert.payload.storeName}
                  </span>
                  <span className="u1-num mt-0.5 block text-caption-xs text-ink-placeholder">
                    {fmtDateTime(new Date(cert.payload.completedAt))}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-ink-placeholder">›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
