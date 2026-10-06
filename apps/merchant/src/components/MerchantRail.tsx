/**
 * 商家端控制台 MerchantRail M1 深棕导航轨（UX-08 归并稿正式版 V1.0 · 老板 10-06 两拍转正：
 * rail 十九口冻结结构，改=新裁定）。
 *
 * 结构（冻结）：
 * - 经营：总览·驾驶舱 / 门店端·预约 / 寄养 / 收银台 / 日结 / 退款；
 * - 商城：商城订单 / 商品 / 会员·次卡；
 * - 管理（9 口）：员工 / 排班 / 薪资 / XP 审核 / 运营 · 审批中心 / 监控 Hub / 报表 / 权限矩阵 / 门店档案·设置；
 *   （批次扩口组整组撤销：四口归位——排班/薪资/XP 审核入管理组，「运营」与「审批中心」
 *   双入口消歧合为一口「运营 · 审批中心」→ /ops，同名同图同屏、落屏单高亮，
 *   bd 角标=审批（自检审核 pending）+申诉（指标申诉 pending）合并计数不拆口）；
 * - foot=开发者管理端 /console（owner-only 规则配置/文案端口/槽位端口三口收编为其子行）。
 *
 * 规格（§二 M1）：宽 236px 深棕渐变 160°（tokens.gradients.philiaRail）；
 * 激活=淡金 3px 左条+浅金底；bd 角标=赭红胶囊；分组签 mono 8.5 宽距。样式全在
 * styles/console.css（.wrail）。断点：<xl 藏形走 ConsoleDock（桌面 rail/手机 dock 双形态互斥）。
 * clerk 分流保留（矩阵总规则②）：仅「收银台」单口。
 */

import { NavLink } from 'react-router-dom';
import { useMemo } from 'react';
import {
  BookCheck,
  CalendarDays,
  CalendarRange,
  BedDouble,
  Calculator,
  ClipboardCheck,
  House,
  Image,
  MonitorDot,
  Package,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  SquareTerminal,
  Type,
  CreditCard,
  Users,
  Wallet,
} from 'lucide-react';
import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { roleLabelCn, useMerchantRole, type MerchantRole } from '@/lib/roles';
import { collabOf } from '@/lib/taskCollabPort';
import { cp } from '@/copy/copyPort';
import { cc } from '@/copy/console';

type RailItem = {
  to: string;
  key: string;
  label: string;
  icon: typeof House;
  testid: string;
  /** 激活口径=精确匹配（子路径不联动高亮，如 /cashier vs /cashier/close） */
  end?: boolean;
};

type RailGroup = { key: string; label: string | null; note?: string; items: RailItem[] };

/**
 * 角色分流：clerk=仅收银台工作面（总规则②）；owner/manager=十九口+foot。
 */
function groupsFor(role: MerchantRole): RailGroup[] {
  if (role.isClerk) {
    return [
      {
        key: 'clerk',
        label: null,
        items: [{ to: '/cashier', key: 'cashier', label: cc('wnav.cashier'), icon: Calculator, testid: 'rail-cashier', end: true }],
      },
    ];
  }
  return [
    {
      key: 'ops',
      label: cc('wnav.groupOps'),
      items: [
        { to: '/dashboard', key: 'dashboard', label: cc('wnav.overview'), icon: House, testid: 'rail-dashboard', end: true },
        { to: '/appointments', key: 'appointments', label: cc('wnav.appts'), icon: CalendarDays, testid: 'rail-appointments' },
        { to: '/boarding', key: 'boarding', label: cc('wnav.boarding'), icon: BedDouble, testid: 'rail-boarding' },
        { to: '/cashier', key: 'cashier', label: cc('wnav.cashier'), icon: Calculator, testid: 'rail-cashier', end: true },
        { to: '/cashier/close', key: 'close', label: cc('wnav.close'), icon: BookCheck, testid: 'rail-cashier-close', end: true },
        { to: '/cashier/refunds', key: 'refunds', label: cc('wnav.refunds'), icon: RotateCcw, testid: 'rail-refunds', end: true },
      ],
    },
    {
      key: 'mall',
      label: cc('wnav.groupMall'),
      items: [
        { to: '/orders', key: 'orders', label: cc('wnav.orders'), icon: ShoppingBag, testid: 'rail-orders' },
        { to: '/products', key: 'products', label: cc('wnav.products'), icon: Package, testid: 'rail-products' },
        { to: '/pass', key: 'pass', label: cc('wnav.pass'), icon: CreditCard, testid: 'rail-pass' },
      ],
    },
    {
      key: 'admin',
      label: cc('wnav.groupAdmin'),
      items: [
        { to: '/staff', key: 'staff', label: cc('wnav.staff'), icon: Users, testid: 'rail-staff' },
        { to: '/settings/schedules', key: 'schedules', label: cc('wnav.schedules'), icon: CalendarRange, testid: 'rail-schedules', end: true },
        { to: '/payroll', key: 'payroll', label: cc('wnav.payroll'), icon: Wallet, testid: 'rail-payroll' },
        { to: '/xp-admin', key: 'xpAdmin', label: cc('wnav.xpAdmin'), icon: Sparkles, testid: 'rail-xp-admin' },
        { to: '/ops', key: 'opsCenter', label: cc('wnav.ops'), icon: ClipboardCheck, testid: 'rail-ops' },
        { to: '/monitor', key: 'monitor', label: cc('wnav.monitor'), icon: MonitorDot, testid: 'rail-monitor' },
        { to: '/finance', key: 'finance', label: cc('wnav.finance'), icon: ReceiptText, testid: 'rail-finance' },
        { to: '/matrix', key: 'matrix', label: cc('wnav.matrix'), icon: ShieldCheck, testid: 'rail-matrix', end: true },
        { to: '/settings', key: 'settings', label: cc('wnav.settings'), icon: Settings, testid: 'rail-settings', end: true },
      ],
    },
  ];
}

export default function MerchantRail({ badges }: { badges?: Record<string, number> }) {
  const { trpc } = usePhiliaClient();
  const role = useMerchantRole();
  const meQ = useQuery({
    queryKey: ['auth', 'me', 'rail'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  });
  /* UX-08：「运营 · 审批中心」bd 角标=审批（自检审核 pending）+申诉（指标申诉 pending）
     合并计数不拆口；仅管理层取数（端点=merchantManagerProcedure 同 /ops 屏数据源） */
  const collab = useMemo(() => collabOf(trpc), [trpc]);
  const badgeEnabled = role.canManage;
  const approvalQ = useQuery({
    queryKey: ['rail', 'badge', 'approvals'],
    queryFn: () => collab.selfCheck.listPending.query(),
    enabled: badgeEnabled,
    staleTime: 60_000,
    retry: false,
  });
  const appealQ = useQuery({
    queryKey: ['rail', 'badge', 'appeals'],
    queryFn: () => trpc.report.listMetricAppeals.query(),
    enabled: badgeEnabled,
    staleTime: 60_000,
    retry: false,
  });
  const opsCombined =
    (approvalQ.data?.runs?.length ?? 0) + (appealQ.data?.pending?.length ?? 0);
  const effBadges: Record<string, number> = { opsCenter: opsCombined, ...(badges ?? {}) };
  const storeName = meQ.data?.store?.name ?? '门店';
  const ownerName = meQ.data?.user?.nickname ?? '店主';
  const roleLabel = roleLabelCn(meQ.data?.roles);
  const groups = groupsFor(role);

  return (
    <nav data-testid="merchant-rail" className="wrail" aria-label="主导航">
      <div className="wm">PHILIA</div>
      {groups.map((g) => (
        <div key={g.key}>
          {g.label ? (
            <div className="gp">
              {g.label}
              {g.note ? <span className="nt">{g.note}</span> : null}
            </div>
          ) : null}
          {g.items.map(({ to, key, label, icon: Icon, testid, end }) => (
            <NavLink
              key={`${to}-${key}`}
              to={to}
              end={end}
              data-testid={testid}
              title={label}
              className={({ isActive }) => `it${isActive ? ' on' : ''}`}
            >
              <Icon strokeWidth={1.6} aria-hidden />
              <span>{label}</span>
              {(effBadges[key] ?? 0) > 0 ? (
                <span className="bd" data-testid={`${testid}-badge`} aria-label={`${effBadges[key]} 条待处理`}>
                  {effBadges[key]! > 99 ? '99+' : effBadges[key]}
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
      ))}
      {/* foot=开发者管理端（owner-only 三端口收编为其子行；clerk 经 groupsFor 分流不见） */}
      {!role.isClerk ? (
        <div className="ft" data-testid="rail-foot">
          <div className="gp">{cc('wnav.footConsole')}</div>
          <NavLink to="/console" end data-testid="rail-console" title={cc('wnav.footConsole')} className={({ isActive }) => `it${isActive ? ' on' : ''}`}>
            <SquareTerminal strokeWidth={1.6} aria-hidden />
            <span>{cc('wnav.footConsole')}</span>
          </NavLink>
          {role.isOwner ? (
            <>
              <NavLink to="/settings/rules" end data-testid="rail-rules-config" title={cc('wnav.footRules')} className={({ isActive }) => `it${isActive ? ' on' : ''}`}>
                <SlidersHorizontal strokeWidth={1.6} aria-hidden />
                <span>{cc('wnav.footRules')}</span>
              </NavLink>
              <NavLink to="/settings/copy" end data-testid="rail-copy-config" title={cp('copyport.pageTitle')} className={({ isActive }) => `it${isActive ? ' on' : ''}`}>
                <Type strokeWidth={1.6} aria-hidden />
                <span>{cp('copyport.pageTitle')}</span>
              </NavLink>
              <NavLink to="/settings/slots" end data-testid="rail-slot-port" title={cp('slotport.pageTitle')} className={({ isActive }) => `it${isActive ? ' on' : ''}`}>
                <Image strokeWidth={1.6} aria-hidden />
                <span>{cp('slotport.pageTitle')}</span>
              </NavLink>
            </>
          ) : null}
          <div className="card">
            {storeName}
            <br />
            {roleLabel} · {ownerName}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
