/**
 * CertDetailPage · /philia/certs/:appointmentId 安心证书详情卡（补缺大批片 4）
 *
 * - 数据：serviceLoop.certificateFor（首读幂等置 deliveredAt；无证书=server 404 明文
 *   「该服务未生成证书（无前后对比照）」，错误态原文透出 + 返回出口）；
 * - 卡面=PHILIA 卡：宠物名 serif + 服务 + 门店 + 完成时刻 + 六步摘要行（步名+张数）
 *   + before/after 对比图并排（PhotoWall before_after 模式）+ 全屏查看器；
 * - 留痕行 mono：「生成于 {generatedAt} · 送达 {deliveredAt}」（R10 真数据）。
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PhotoViewer, PhotoWall, friendlyError, usePhiliaClient, type PhotoWallPhoto } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { fmtDateTime } from '@/components/booking/format'
import { ErrorState, LoadingBlock } from '../components/home/common'
import { sl } from '@/copy/serviceloop'

export default function CertDetailPage() {
  const { appointmentId = '' } = useParams()
  const { trpc } = usePhiliaClient()
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)

  const certQ = useQuery({
    queryKey: ['serviceLoop', 'certificateFor', appointmentId],
    queryFn: () => trpc.serviceLoop.certificateFor.query({ appointmentId }),
    enabled: appointmentId.length > 0,
  })

  const cert = certQ.data?.certificate ?? null
  const compare: PhotoWallPhoto[] = cert
    ? [
        { id: `${cert.appointmentId}-before`, url: cert.payload.beforeUrl },
        { id: `${cert.appointmentId}-after`, url: cert.payload.afterUrl },
      ]
    : []

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回证书列表 */}
      <PageHeader title={sl('cert.cardTitle')} fallback="/philia/certs" className="pt-6" />

      <div className="mt-4">
        {certQ.isPending ? <LoadingBlock lines={3} /> : null}
        {certQ.isError ? (
          <ErrorState
            message={friendlyError(certQ.error, sl('cert.loadFail'))}
            onRetry={() => void certQ.refetch()}
            action={
              <Link
                to="/philia/certs"
                className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('cert.backList')}
              </Link>
            }
          />
        ) : null}
      </div>

      {cert ? (
        <section className="u1-ring mt-4 rounded-panel bg-card p-5" data-testid="cert-card">
          {/* PHILIA 卡面头：品牌 mono + 宠物名 serif */}
          <p className="u1-num text-center text-caption-xs tracking-[0.3em] text-ink-placeholder">
            {sl('cert.brandMark')}
          </p>
          <h2 className="u1-serif mt-2 text-center text-title-lg font-black">{cert.payload.petName}</h2>
          <p className="mt-1 text-center text-caption text-ink-secondary">
            {cert.payload.serviceName} · {cert.payload.storeName}
          </p>
          <p className="u1-num mt-1 text-center text-caption-xs text-ink-placeholder">
            {fmtDateTime(new Date(cert.payload.completedAt))}
          </p>

          {/* before/after 对比图并排（点击进全屏查看器） */}
          <div className="mt-4">
            <PhotoWall photos={compare} stepKey="before_after" onPhotoClick={(p) => setViewing(p)} />
          </div>

          {/* 六步摘要行（步名 + 张数，真数据快照） */}
          <ul className="mt-4 divide-y divide-line-divider border-t border-line-divider">
            {cert.payload.stepsSummary.map((s) => (
              <li key={s.stepKey} className="flex items-center justify-between py-2 text-caption">
                <span className="text-ink-secondary">{s.label}</span>
                <span className="u1-num text-ink-placeholder">
                  {sl('cert.stepPhotos', { count: s.photoCount })}
                </span>
              </li>
            ))}
          </ul>

          {/* 留痕行（mono）：生成/送达时刻 */}
          <p className="u1-num mt-4 text-center text-caption-xs text-ink-placeholder" data-testid="cert-trace">
            {sl('cert.traceLine', {
              generatedAt: fmtDateTime(cert.generatedAt),
              deliveredAt: fmtDateTime(cert.deliveredAt),
            })}
          </p>
        </section>
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
