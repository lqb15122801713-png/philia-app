/**
 * U3 任务 A · MerchantRail 墨轨（商家端全域唯一导航，冻结决策 #21 案 A）
 *
 * 规格书 §0：宽 190px 深棕墨底（#4A3B2E，与客户端 GUARDIAN 墨卡同族）；
 * wordmark + 4 组直达（总览｜履约[预约/寄养/监控]｜商城[收银台/日结/退款/
 * 订单/商品]｜门店[会员·次卡/员工/财务/设置]）+ 底部门店/店主卡（auth.me 真值）。
 * 当前项=柠檬 14% 底+柠檬字；分组小标题 11px 宽距 35% 透明。
 * 无 TabBar（冻结）、无二级菜单、不折叠。按下 scale 0.92 + 120ms（动效纲领）。
 */

import { NavLink } from 'react-router-dom';
import {
  BookCheck,
  CalendarDays,
  BedDouble,
  Calculator,
  House,
  MonitorDot,
  Package,
  ReceiptText,
  RotateCcw,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  CreditCard,
  Users,
} from 'lucide-react';
import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { roleLabelCn, useMerchantRole, type MerchantRole } from '@/lib/roles';

type RailItem = { to: string; label: string; icon: typeof House; testid: string };

/**
 * M1-补2 G：墨轨按角色分流（矩阵总规则② 店员不见流水与看板）：
 * - clerk：仅「收银台」工作面入口（单组单项，组标收起）；
 * - owner/manager：现状四组不动，「商城」组收银台下方插「日结」（R3 交接班/日结页）。
 */
function groupsFor(role: MerchantRole): Array<{ label: string | null; items: RailItem[] }> {
  if (role.isClerk) {
    return [
      {
        label: null,
        items: [{ to: '/cashier', label: '收银台', icon: Calculator, testid: 'rail-cashier' }],
      },
    ];
  }
  return [
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
        // 批次 M1：收银台=商城组首位（任务书 §1.7，lucide Calculator）
        { to: '/cashier', label: '收银台', icon: Calculator, testid: 'rail-cashier' },
        // M1-补2 C：日结/交接班页（owner|manager 可见；clerk 无入口）
        { to: '/cashier/close', label: '日结', icon: BookCheck, testid: 'rail-cashier-close' },
        // 批次 R12 退款专项：退款单列表页（owner|manager 可见；clerk 无入口）
        { to: '/cashier/refunds', label: '退款', icon: RotateCcw, testid: 'rail-refunds' },
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
        // 批次 员工端2.0 R9-F：规则配置管理端口（仅 owner 可见入口；server 端 merchantOwnerProcedure 硬闸门）
        ...(role.isOwner
          ? [{ to: '/settings/rules', label: '规则配置', icon: SlidersHorizontal, testid: 'rail-rules-config' }]
          : []),
      ],
    },
  ];
}

export default function MerchantRail() {
  const { trpc } = usePhiliaClient();
  const role = useMerchantRole();
  const meQ = useQuery({
    queryKey: ['auth', 'me', 'rail'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  });
  const storeName = meQ.data?.store?.name ?? '门店';
  const ownerName = meQ.data?.user?.nickname ?? '店主';
  const roleLabel = roleLabelCn(meQ.data?.roles);
  const groups = groupsFor(role);

  return (
    <nav
      data-testid="merchant-rail"
      className="flex h-full w-[56px] shrink-0 flex-col bg-ink px-1.5 py-[18px] text-[rgba(246,241,227,.72)] xl:w-[190px] xl:px-3"
    >
      {/* M1 收银台 390 降级配套：xl 以下图标轨（字标/组标/底卡收起，导航可达性保留），xl 起完整 190px */}
      <div className="hidden px-2.5 pb-4 pt-1.5 font-display text-title font-bold tracking-[.05em] text-[#F6F1E3] xl:block">
        PHILIA
      </div>
      <div className="pb-3 pt-1.5 text-center font-display text-title font-bold text-brand-primary xl:hidden" aria-hidden>
        P
      </div>
      {groups.map((g) => (
        <div key={g.label ?? 'top'}>
          {g.label ? (
            <div className="hidden px-2.5 pb-1.5 pt-3.5 text-caption-xs tracking-[.14em] text-[rgba(246,241,227,.35)] xl:block">
              {g.label}
            </div>
          ) : null}
          {g.items.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              title={label}
              className={({ isActive }) =>
                `mb-0.5 flex items-center justify-center gap-2.5 rounded-chip px-0 py-[9px] text-caption font-medium transition-transform duration-120 ease-philia-spring active:scale-92 xl:justify-start xl:px-2.5 ${
                  isActive ? 'bg-[rgba(253,200,48,.14)] font-semibold text-brand-primary' : ''
                }`
              }
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden />
              <span className="hidden xl:inline">{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
      {/* 底部：门店/账号卡（真值；M1-补2 G：三级账号角色签） */}
      <div className="mt-auto hidden px-2.5 py-2.5 text-caption-xs leading-relaxed text-[rgba(246,241,227,.4)] xl:block" data-testid="rail-foot">
        {storeName}
        <br />
        {roleLabel} · {ownerName}
      </div>
    </nav>
  );
}
