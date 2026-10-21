/**
 * 商家端控制台 MerchantRail M1 深棕导航轨（产品-1015 换皮 片0-三端壳：
 * rail 十五口回归冻结——经营6+商城3+管理6+脚开发者，对齐 READY-FOR-DEV-20261015
 * §3 MerchantRail15 成稿与任务书 A3；取代 UX-08 归并稿 V1.0 十九口（改=新裁定，本片即裁定）。
 *
 * 结构（冻结）：
 * - 经营：总览·驾驶舱 / 门店端·预约 / 寄养 / 收银台 / 日结 / 退款；
 * - 商城：商城订单 / 商品 / 会员·次卡；
 * - 管理（6 口）：员工 / 运营 · 审批中心 / 监控 Hub / 报表 / 权限矩阵 / 门店档案·设置；
 *   （片0 下轨三口：排班/薪资/XP 审核——Ready W-00~W-16 帧表无对应屏，且三口
 *   无 rail 角标负载；路由全部保留可直达不删，排班另经 /settings/schedules 挂在
 *   门店设置域下。保留「运营 · 审批中心」= rail 唯一带 bd 角标口：审批+申诉+库存
 *   待办合并计数是壳层运营信号，下轨会藏待办→保）；
 * - foot=开发者管理端 /console 单入口（产品-1012 控制台改版批片 1 刀 3 裁②：规则配置/
 *   文案端口/槽位端口三重复子行收进控制台；旧路由保留可直达不删）。
 *
 * 规格（§二 M1）：宽 236px 深棕渐变 160°（tokens.gradients.philiaRail；
 * 片0 换代=Ready §2.1 brand #5C5040→pressed #4A4034）；
 * 激活=cream 3px 左条+浅金底；bd 角标=赭红胶囊；分组签 mono 8.5 宽距。样式全在
 * styles/console.css（.wrail）。断点：<xl 藏形走 ConsoleDock（桌面 rail/手机 dock 双形态互斥）。
 * clerk 分流保留（矩阵总规则②）：仅「收银台」单口。
 */

import { NavLink } from 'react-router-dom';
import { useMemo } from 'react';
import {
  BookCheck,
  CalendarDays,
  BedDouble,
  Calculator,
  ClipboardCheck,
  House,
  MonitorDot,
  Package,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SquareTerminal,
  CreditCard,
  Users,
} from 'lucide-react';
import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { roleLabelCn, useMerchantRole, type MerchantRole } from '@/lib/roles';
import { collabOf } from '@/lib/taskCollabPort';
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
 * 角色分流：clerk=仅收银台工作面（总规则②）；owner/manager=十五口+foot。
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
  /* UX-08：「运营 · 审批中心」bd 角标=审批（自检审核 pending+四类通用审批 pending）
     +申诉（指标申诉 pending）合并计数不拆口；仅管理层取数（端点同 /ops 屏数据源） */
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
  const stockApprovalQ = useQuery({
    queryKey: ['rail', 'badge', 'stockApprovals'],
    queryFn: () => trpc.stock2.approvalPendingCount.query(),
    enabled: badgeEnabled,
    staleTime: 60_000,
    retry: false,
  });
  const opsCombined =
    (approvalQ.data?.runs?.length ?? 0) + (appealQ.data?.pending?.length ?? 0) + (stockApprovalQ.data?.count ?? 0);
  const effBadges: Record<string, number> = { opsCenter: opsCombined, ...(badges ?? {}) };
  const storeName = meQ.data?.store?.name ?? '门店';
  const ownerName = meQ.data?.user?.nickname ?? '店主';
  const roleLabel = roleLabelCn(meQ.data?.roles);
  const groups = groupsFor(role);

  return (
    <nav data-testid="merchant-rail" className="wrail" aria-label="主导航">
      <div className="wm">PHILIA</div>
      {/* PD-54 NAV_CHROME_CLIP：口组区独立滚动（.wrail-body），foot「运营后台端」活动项+
          店主身份卡钉住轨底常驻视口——1280×800 进页不再裁出「我在哪／我是谁」；IA 不动 */}
      <div className="wrail-body">
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
      </div>
      {/* foot=开发者管理端（owner-only 三端口收编为其子行；clerk 经 groupsFor 分流不见） */}
      {!role.isClerk ? (
        <div className="ft" data-testid="rail-foot">
          <div className="gp">{cc('wnav.footConsole')}</div>
          <NavLink to="/console" end data-testid="rail-console" title={cc('wnav.footConsole')} className={({ isActive }) => `it${isActive ? ' on' : ''}`}>
            <SquareTerminal strokeWidth={1.6} aria-hidden />
            <span>{cc('wnav.footConsole')}</span>
          </NavLink>
          {/* 控制台改版批 片 1 刀 3（产品-1012 裁②）：规则配置/文案端口/槽位端口三重复
              收进控制台（办事卡面+高级层），侧边栏留「开发者管理端」单入口；
              旧路由 /settings/rules|copy|slots 保留可直达不删（既有书签不断） */}
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
