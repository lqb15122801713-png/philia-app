import { Link } from 'react-router-dom'
import { BedDouble, ShowerHead, Store } from 'lucide-react'

// 首页快捷入口：洗护预约 / 寄养 / 商城
const entries = [
  { to: '/booking/grooming', label: '洗护预约', icon: ShowerHead },
  { to: '/booking/boarding', label: '寄养服务', icon: BedDouble },
  { to: '/mall', label: '宠物商城', icon: Store },
]

export default function HomePage() {
  return (
    <div className="px-4 pb-6">
      {/* 品牌头：logo + 店名 */}
      <header className="flex items-center gap-3 pt-6">
        <img src="./brand/logo-512.png" alt="菲丽亚宠物" className="h-10 w-10 rounded-card shadow-card" />
        <div>
          <h1 className="text-title-lg">菲丽亚宠物</h1>
          <p className="text-caption text-ink-secondary">Philia · 用心呵护每一只毛孩子</p>
        </div>
      </header>

      {/* 首页 banner */}
      <div className="mt-4 overflow-hidden rounded-card shadow-card">
        <img src="./brand/banner-home-1200.png" alt="菲丽亚宠物洗护" className="w-full object-cover" />
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

      {/* 推荐区块占位（P1 接数据） */}
      <section className="mt-6">
        <h2 className="text-title">附近好店</h2>
        <p className="mt-2 text-body text-ink-secondary">门店与服务推荐即将上线，敬请期待。</p>
      </section>
    </div>
  )
}
