import { Calendar, Home, Store, User } from 'lucide-react'
import { ConvexTabBar } from '@philia/shared'
import type { ConvexTabBarItem } from '@philia/shared'

// 客户端五栏凸起 TabBar：左 2 + philia 凸起按钮 + 右 2（规格见 docs/DESIGN.md §6.1）
const items: ConvexTabBarItem[] = [
  { key: 'home', label: '首页', icon: Home, path: '/home' },
  { key: 'mall', label: '商城', icon: Store, path: '/mall' },
  { key: 'booking', label: '预约', icon: Calendar, path: '/booking' },
  { key: 'me', label: '我的', icon: User, path: '/me' },
]

export default function TabBar() {
  // TODO(P1)：activeService 由「是否有进行中服务」接口驱动，为 true 时 philia 按钮出现呼吸光环
  return <ConvexTabBar items={items} philiaPath="/philia" activeService={false} />
}
