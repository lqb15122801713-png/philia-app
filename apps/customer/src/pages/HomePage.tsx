/**
 * HomePage · 客户端首页（T2.1）
 *
 * 保留 P0 品牌头 / banner / 快捷入口；
 * 「附近好店」接 trpc.store.listNearby（浏览器 geolocation 拿坐标，拒绝授权则不带坐标调）；
 * 「推荐服务」取最近门店 store.getWithServices 的 active 服务项（横滑卡片）。
 * 三态：loading / error / empty 均有（见 components/home）。
 */

import { useQuery } from '@tanstack/react-query'
import { BedDouble, ShowerHead, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import NearbyStores from '../components/home/NearbyStores'
import RecommendedServices from '../components/home/RecommendedServices'
import { SectionShell } from '../components/home/common'
import { useGeolocation } from '../components/home/useGeolocation'

// 首页快捷入口：洗护预约 / 寄养 / 商城
const entries = [
  { to: '/booking/grooming', label: '洗护预约', icon: ShowerHead },
  { to: '/booking/boarding', label: '寄养服务', icon: BedDouble },
  { to: '/mall', label: '宠物商城', icon: Store },
]

export default function HomePage() {
  const { trpc } = usePhiliaClient()
  const { coords, denied } = useGeolocation()

  // 坐标到达前先用无坐标请求（创建序），拿到坐标后按距离重排
  const storesQuery = useQuery({
    queryKey: ['store', 'listNearby', coords?.lat ?? null, coords?.lng ?? null],
    queryFn: () =>
      trpc.store.listNearby.query(coords ? { lat: coords.lat, lng: coords.lng } : undefined),
  })
  const stores = storesQuery.data?.stores
  const nearestStoreId = stores && stores.length > 0 ? stores[0]!.id : null

  return (
    <div className="px-4 pb-6">
      {/* 品牌头：logo + 店名 */}
      <header className="flex items-center gap-3 pt-6">
        <img src="/brand/logo-512.png" alt="菲丽亚宠物" className="h-10 w-10 rounded-card shadow-card" />
        <div>
          <h1 className="text-title-lg">菲丽亚宠物</h1>
          <p className="text-caption text-ink-secondary">Philia · 用心呵护每一只毛孩子</p>
        </div>
      </header>

      {/* 首页 banner */}
      <div className="mt-4 overflow-hidden rounded-card shadow-card">
        <img src="/brand/banner-home-1200.png" alt="菲丽亚宠物洗护" className="w-full object-cover" />
      </div>

      {/* 快捷入口 */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {entries.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-card bg-card py-4 shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            <Icon className="h-7 w-7 text-brand-primary" strokeWidth={1.5} />
            <span className="text-body">{label}</span>
          </Link>
        ))}
      </div>

      {/* 附近好店（listNearby） */}
      <SectionShell title="附近好店">
        <NearbyStores
          stores={stores}
          isPending={storesQuery.isPending}
          isError={storesQuery.isError}
          onRetry={() => void storesQuery.refetch()}
          coords={coords}
          geoDenied={denied}
        />
      </SectionShell>

      {/* 推荐服务（最近门店 getWithServices） */}
      <SectionShell title="推荐服务">
        <RecommendedServices storeId={nearestStoreId} />
      </SectionShell>
    </div>
  )
}
