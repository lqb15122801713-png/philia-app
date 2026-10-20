/**
 * 商家端控制台 ConsoleDock 手机 dock 五槽（产品-1015 换皮 片0-三端壳：
 * 五槽「总览/门店/收银/报表/我的」回归冻结，对齐 READY-FOR-DEV-20261015 §1.D
 * 手机五槽成稿与任务书 A3；取代 UX-08「设置」转正（改=新裁定，本片即裁定）。
 *
 * PD46 U7（B10b dock 映射，`figma-bro-B10b-商家手机W09-W16补帧_2026-10-18` §2）：
 * - 槽位落点：总览=/dashboard、门店=/appointments、收银=/cashier、报表=/finance、
 *   我的=/me（W-我的 店主 `203:5480` 真页，本片新建；片0 过渡暂驻 /settings 退役）。
 * - 激活归属：W-09 商城订单/W-10 商品→总览；W-11 会员次卡/W-15 门店设置→门店；
 *   W-12 员工/W-14 权限矩阵/W-16 运营后台→我的；W-13 报表→报表；
 *   其余既有路由按族归槽（/inventory /transfers /marketing→门店；/ledger→收银；
 *   /ops /payroll /xp-admin→我的）。
 * - 激活=顶部 22×3 cream 短划+深棕字；样式全在 styles/console.css（.wdock）。
 *   断点：<xl 显形固定底栏，≥xl 藏形走 MerchantRail（双形态互斥）。
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
    isActive: (p) =>
      p === '/' || p.startsWith('/dashboard') || p.startsWith('/orders') || p.startsWith('/products'),
  },
  {
    key: 'store', to: '/appointments', label: cc('wnav.dockStore'), testid: 'dock-store', icon: CalendarDays,
    isActive: (p) =>
      p.startsWith('/appointments') || p.startsWith('/boarding') || p.startsWith('/monitor') ||
      p.startsWith('/pass') || p.startsWith('/settings') || p.startsWith('/marketing') ||
      p.startsWith('/inventory') || p.startsWith('/transfers'),
  },
  {
    key: 'cashier', to: '/cashier', label: cc('wnav.dockCashier'), testid: 'dock-cashier', icon: Calculator,
    isActive: (p) => p.startsWith('/cashier') || p.startsWith('/ledger'),
  },
  {
    key: 'report', to: '/finance', label: cc('wnav.dockReport'), testid: 'dock-report', icon: ReceiptText,
    isActive: (p) => p.startsWith('/finance'),
  },
  {
    // 「我的」槽（PD46 U7：/me 真页=W-我的 店主 `203:5480`；W-12/W-14/W-16 归本槽）
    key: 'me', to: '/me', label: cc('wnav.dockMe'), testid: 'dock-me', icon: User,
    isActive: (p) =>
      p.startsWith('/me') || p.startsWith('/staff') || p.startsWith('/matrix') ||
      p.startsWith('/console') || p.startsWith('/ops') || p.startsWith('/payroll') ||
      p.startsWith('/xp-admin'),
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
