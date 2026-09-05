/**
 * HomePage · 附近好店（T2.1）
 *
 * 数据：trpc.store.listNearby（HomePage 传入查询结果与坐标）。
 * 门店卡：名称 / 地址 / 距离（km，有坐标且门店有坐标时显示）。
 * 点卡片进 /booking。
 */

import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingBlock, haversineKm, tabularNums } from './common'
import type { GeoCoords } from './useGeolocation'

/** 门店行结构（与 server stores 表一致，结构化声明避免循环引用） */
export interface NearbyStore {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
}

export default function NearbyStores({
  stores,
  isPending,
  isError,
  onRetry,
  coords,
  geoDenied,
}: {
  stores: NearbyStore[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  coords: GeoCoords | null
  geoDenied: boolean
}) {
  if (isPending) return <LoadingBlock lines={3} />
  if (isError) return <ErrorState message="门店列表加载失败，请检查网络后重试" onRetry={onRetry} />
  if (!stores || stores.length === 0) {
    return <EmptyState title="附近还没有门店" desc="菲丽亚正在努力开店中，敬请期待" />
  }

  return (
    <div className="flex flex-col gap-3">
      {geoDenied ? (
        <p className="text-caption text-ink-placeholder">授权定位后可按距离排序并显示距离</p>
      ) : null}
      {stores.map((s) => {
        const km = coords ? haversineKm(coords.lat, coords.lng, s.lat, s.lng) : null
        return (
          <Link
            key={s.id}
            to="/booking"
            className="flex items-center gap-3 rounded-card bg-card p-4 shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-primary-light">
              <MapPin className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold">{s.name}</span>
              <span className="mt-0.5 block truncate text-caption text-ink-secondary">
                {s.address ?? '地址待补充'}
              </span>
            </span>
            {km !== null ? (
              <span className="shrink-0 font-number text-caption text-ink-secondary" style={tabularNums}>
                {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
