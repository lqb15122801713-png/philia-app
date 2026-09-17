/**
 * U3 任务 A · MerchantRail 墨轨（商家端全域唯一导航，冻结决策 #21 案 A）
 *
 * 规格书 §0：宽 190px 深棕墨底（#4A3B2E，与客户端 GUARDIAN 墨卡同族）；
 * wordmark + 4 组 10 项直达（总览｜履约[预约/寄养/监控]｜商城[订单/商品]｜
 * 门店[会员·次卡/员工/财务/设置]）+ 底部门店/店主卡（auth.me 真值）。
 * 当前项=柠檬 14% 底+柠檬字；分组小标题 11px 宽距 35% 透明。
 * 无 TabBar（冻结）、无二级菜单、不折叠。按下 scale 0.92 + 120ms（动效纲领）。
 */

import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  BedDouble,
  House,
  MonitorDot,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  CreditCard,
  Users,
} from 'lucide-react';
import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';

const GROUPS: Array<{ label: string | null; items: Array<{ to: string; label: string; icon: typeof House; testid: string }> }> = [
  { label: null, items: [{ to: '/dashboard', label: '总览', icon: House, testid: 'rail-dashboard' }] },
  {
    label: '履约',
    items: [
      { to: '/appointments', label: '预约', icon: CalendarDays, testid: 'rail-appointments' },
      { to: '/boarding', label: '寄养', icon: BedDouble, testid: 'rail-boarding' },
      { to: '/monitor', label: '监控', icon: MonitorDot, testid: 'rail-monitor' },
    ],
  },
  {
    label: '商城',
    items: [
      { to: '/orders', label: '订单', icon: ShoppingBag, testid: 'rail-orders' },
      { to: '/products', label: '商品', icon: Package, testid: 'rail-products' },
    ],
  },
  {
    label: '门店',
    items: [
      { to: '/pass', label: '会员·次卡', icon: CreditCard, testid: 'rail-pass' },
      { to: '/staff', label: '员工', icon: Users, testid: 'rail-staff' },
      { to: '/finance', label: '财务', icon: ReceiptText, testid: 'rail-finance' },
      { to: '/settings', label: '设置', icon: Settings, testid: 'rail-settings' },
    ],
  },
];

export default function MerchantRail() {
  const { trpc } = usePhiliaClient();
  const meQ = useQuery({
    queryKey: ['auth', 'me', 'rail'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  });
  const storeName = meQ.data?.store?.name ?? '门店';
  const ownerName = meQ.data?.user?.nickname ?? '店主';

  return (
    <nav
      data-testid="merchant-rail"
      className="flex h-full w-[190px] shrink-0 flex-col bg-ink px-3 py-[18px] text-[rgba(246,241,227,.72)]"
    >
      <div className="px-2.5 pb-4 pt-1.5 font-display text-body-lg font-extrabold tracking-[.05em] text-[#F6F1E3]">
        PHILIA
      </div>
      {GROUPS.map((g) => (
        <div key={g.label ?? 'top'}>
          {g.label ? (
            <div className="px-2.5 pb-1.5 pt-3.5 text-caption-xs tracking-[.14em] text-[rgba(246,241,227,.35)]">
              {g.label}
            </div>
          ) : null}
          {g.items.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={({ isActive }) =>
                `mb-0.5 flex items-center gap-2.5 rounded-chip px-2.5 py-[9px] text-caption font-medium transition-transform duration-120 ease-philia-spring active:scale-92 ${
                  isActive ? 'bg-[rgba(253,200,48,.14)] font-semibold text-brand-primary' : ''
                }`
              }
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      ))}
      {/* 底部：门店/店主卡（真值） */}
      <div className="mt-auto px-2.5 py-2.5 text-caption-xs leading-relaxed text-[rgba(246,241,227,.4)]" data-testid="rail-foot">
        {storeName}
        <br />
        店主 · {ownerName}
      </div>
    </nav>
  );
}
