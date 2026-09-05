/**
 * HomePage · 推荐服务（T2.1）
 *
 * 数据：最近门店（listNearby 首条）的 trpc.store.getWithServices active 服务项。
 * 横滑卡片区：图用 /brand/ 占位、服务名、时长、价格（元）；
 * 点卡片进 /booking/grooming?serviceId=（boarding 类进 /booking/boarding?serviceId=）。
 */

import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock, formatFen, tabularNums } from './common'

export default function RecommendedServices({ storeId }: { storeId: string | null }) {
  const { trpc } = usePhiliaClient()
  const query = useQuery({
    queryKey: ['store', 'getWithServices', storeId],
    queryFn: () => trpc.store.getWithServices.query({ storeId: storeId! }),
    enabled: storeId !== null,
  })

  if (storeId === null) return null // 无门店时整区不渲染（附近好店已展示空态）
  if (query.isPending) return <LoadingBlock lines={2} />
  if (query.isError) {
    return <ErrorState message="推荐服务加载失败" onRetry={() => void query.refetch()} />
  }

  // getWithServices 只返回 active 服务项（服务端已过滤），boarding 无时长按「按天计」展示
  const services = query.data.services
  if (services.length === 0) {
    return <EmptyState title="门店服务准备中" desc="该门店还没有上架服务，先看看其他门店吧" />
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex gap-3" style={{ width: 'max-content' }}>
        {services.map((svc) => {
          const target =
            svc.type === 'boarding'
              ? `/booking/boarding?serviceId=${svc.id}&storeId=${svc.storeId}`
              : `/booking/grooming?serviceId=${svc.id}&storeId=${svc.storeId}`
          return (
            <Link
              key={svc.id}
              to={target}
              className="block w-40 shrink-0 overflow-hidden rounded-card bg-card shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.97]"
            >
              <img
                src="/brand/banner-home-1200.png"
                alt=""
                className="h-24 w-full object-cover"
                loading="lazy"
              />
              <div className="p-3">
                <p className="truncate text-body font-semibold">{svc.name}</p>
                <p className="mt-1 flex items-center gap-1 text-caption text-ink-secondary">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {svc.type === 'boarding'
                    ? (svc.boardingRoomType ?? '寄养') + ' · 按天计'
                    : `约 ${svc.durationMin ?? 60} 分钟`}
                </p>
                <p className="mt-1 font-number text-price text-brand-primary" style={tabularNums}>
                  ¥{formatFen(svc.priceFen)}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
