/**
 * 商家端控制台 ConsoleDock 手机 dock 五槽（UX-08 归并稿正式版 V1.0 · 老板 10-06 两拍转正：
 * 五槽「总览/门店/收银/报表/设置」冻结，改=新裁定）。
 *
 * 槽位映射：总览=/dashboard、门店=/appointments（含寄养履约域）、收银=/cashier、
 * 报表=/finance、设置=/settings（原「我的」槽转正改名「设置」，指向不变；
 * 候补「我的」页=方案 B 归补缺专项不施工）。
 * 激活=顶部 22×3 淡黄短划+深棕字（员工端 S1 flatdock 同工艺）；样式全在
 * styles/console.css（.wdock）。断点：<xl 显形固定底栏，≥xl 藏形走 MerchantRail
 * （桌面 rail/手机 dock 双形态互斥，App 壳同挂、CSS 互斥显隐）。
 */

import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, Calculator, House, ReceiptText, Settings } from 'lucide-react';
import { cc } from '@/copy/console';

type DockSlot = {
  key: 'overview' | 'store' | 'cashier' | 'report' | 'settings';
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
    // 「设置」槽（UX-08 转正：原「我的」槽改名，指向 /settings 不变；copy 键名沿用 wnav.dockMe 改键值）
    key: 'settings', to: '/settings', label: cc('wnav.dockMe'), testid: 'dock-settings', icon: Settings,
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
