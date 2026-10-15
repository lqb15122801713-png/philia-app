/**
 * 商家端控制台 ConsoleDock 手机 dock 五槽（产品-1015 换皮 片0-三端壳：
 * 五槽「总览/门店/收银/报表/我的」回归冻结，对齐 READY-FOR-DEV-20261015 §1.D
 * 手机五槽成稿与任务书 A3；取代 UX-08「设置」转正（改=新裁定，本片即裁定）。
 *
 * 槽位映射：总览=/dashboard、门店=/appointments（含寄养履约域）、收银=/cashier、
 * 报表=/finance、我的=/settings（片0 过渡口径：W-我的 真页（Ready §1.D `203:5480`）
 * 属片3 脸面批不施工，码内默认键值先回「我的」、暂指门店档案·设置页；
 * 运行值注意：wnav.dockMe 在 copy_overrides 有 active 行「设置」（迁移 0049），
 * 运行时端口值优先——翻牌须产品侧走文案端口/另批迁移，本片零新迁移不动 server）。
 * 激活=顶部 22×3 cream 短划+深棕字（员工端 S1 flatdock 同工艺）；样式全在
 * styles/console.css（.wdock）。断点：<xl 显形固定底栏，≥xl 藏形走 MerchantRail
 * （桌面 rail/手机 dock 双形态互斥，App 壳同挂、CSS 互斥显隐）。
 */

import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, Calculator, House, ReceiptText, User } from 'lucide-react';
import { cc } from '@/copy/console';

type DockSlot = {
  key: 'overview' | 'store' | 'cashier' | 'report' | 'me';
  to: string;
  label: string;
  testid: string;
  icon: typeof House;
  isActive: (pathname: string) => boolean;
};

const SLOTS: DockSlot[] = [
  {
    key: 'overview', to: '/dashboard', label: cc('wnav.dockOverview'), testid: 'dock-overview', icon: House,
    isActive: (p) => p === '/' || p.startsWith('/dashboard'),
  },
  {
    key: 'store', to: '/appointments', label: cc('wnav.dockStore'), testid: 'dock-store', icon: CalendarDays,
    isActive: (p) => p.startsWith('/appointments') || p.startsWith('/boarding'),
  },
  {
    key: 'cashier', to: '/cashier', label: cc('wnav.dockCashier'), testid: 'dock-cashier', icon: Calculator,
    isActive: (p) => p.startsWith('/cashier'),
  },
  {
    key: 'report', to: '/finance', label: cc('wnav.dockReport'), testid: 'dock-report', icon: ReceiptText,
    isActive: (p) => p.startsWith('/finance'),
  },
  {
    // 「我的」槽（片0 回归 Ready 五槽：copy 键名沿用 wnav.dockMe 改键值；指向暂驻 /settings）
    key: 'me', to: '/settings', label: cc('wnav.dockMe'), testid: 'dock-me', icon: User,
    isActive: (p) => p.startsWith('/settings'),
  },
];

export default function ConsoleDock() {
  const { pathname } = useLocation();
  return (
    <nav className="wdock" data-testid="merchant-dock" aria-label="主导航">
      <div className="row">
        {SLOTS.map((s) => {
          const on = s.isActive(pathname);
          const Icon = s.icon;
          return (
            <Link key={s.key} to={s.to} data-testid={s.testid} aria-current={on ? 'page' : undefined} className={on ? 'on' : ''}>
              <Icon strokeWidth={1.6} aria-hidden />
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
