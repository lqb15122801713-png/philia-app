/**
 * 我的 /me（批次 U2 任务 G · 试样 .me-* 重做）
 *
 * 规格书 §7：用户卡（头像薄荷环+角色薄荷签+入职年月+在班态）→ 三格数字
 * （本月完成单/好评率/本月寄养打卡，Montserrat 22，三连圆角 20）→
 * 列表组 1（我的排班=本周段·休日[只读]/我的评价/寄养负责中）→
 * 列表组 2（帮助与规范/设置/退出登录 danger）→ 版本小字。
 *
 * 数据（零新接口，前端聚合）：
 * - auth.me 原始响应（staff 行：role/schedule/createdAt；store 名）；
 * - listForStaff 本月：完成单数 + 好评率（≥4 占比，staffList 同口径前端自算——
 *   staffList 为 merchantProcedure 员工不可调，疑点 U2-2 在案）+ 评价条数/均分 +
 *   在店寄养数（in_boarding）；
 * - 本月寄养打卡数：本月 boarding 单 × stayForStaff.logs（staffId=本人）前端聚合
 *   （无员工可读聚合接口，零点查询但 N 小）；
 * - 帮助与规范/设置=就地展开真实内容（规范文案 / SSE 实时同步状态与重连）——
 *   无对应页面，不做假跳转（铁律）；退出登录=真 logout。
 */

import { getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  BedDouble,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  LogOut,
  PawPrint,
  Settings,
  Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast, { useToast } from '@/components/today/Toast';
import { dayKeyOf, SCHEDULE_DAYS, type HistoryItem } from '@/components/today/utils';

type Schedule = Partial<Record<string, Array<{ start: string; end: string }> | null>>;

/** 列表行（组内 hairline 分隔； › 仅真实落点） */
function ListRow({
  icon: Icon,
  label,
  sub,
  to,
  onClick,
  expanded,
  danger,
  testid,
}: {
  icon: typeof CalendarDays;
  label: string;
  sub?: string;
  to?: string;
  onClick?: () => void;
  expanded?: boolean;
  danger?: boolean;
  testid?: string;
}) {
  const inner = (
    <>
      <Icon className={`h-[22px] w-[22px] shrink-0 ${danger ? 'text-danger' : 'text-[rgba(74,59,46,.62)]'}`} strokeWidth={1.6} aria-hidden />
      <span className={`min-w-0 flex-1 text-body-sm ${danger ? 'text-danger' : 'text-ink'}`}>
        {label}
        {sub ? <small className="mt-0.5 block text-caption-xs text-[rgba(74,59,46,.42)]">{sub}</small> : null}
      </span>
      {danger ? null : to ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[rgba(74,59,46,.42)]" aria-hidden />
      ) : onClick ? (
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[rgba(74,59,46,.42)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      ) : null}
    </>
  );
  const cls = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98]`;
  if (to) {
    return (
      <Link to={to} data-testid={testid} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" data-testid={testid} onClick={onClick} className={cls} aria-expanded={onClick ? expanded : undefined}>
      {inner}
    </button>
  );
}

export default function MePage() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { user } = useMe();
  const [toast, showToast] = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [expandKey, setExpandKey] = useState<'schedule' | 'help' | 'settings' | null>(null);

  // 员工详情（staff 行：role/schedule/createdAt；store）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
  });
  const staff = meQuery.data?.staff ?? null;
  const store = meQuery.data?.store ?? null;

  // 本月我的单（绩效聚合真值来源）
  const monthFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const monthQuery = useQuery({
    queryKey: ['appointment', 'listForStaff', { from: monthFrom.getTime() }],
    queryFn: () => trpc.appointment.listForStaff.query({ from: monthFrom }),
    staleTime: 60_000,
  });
  const monthItems: HistoryItem[] = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);

  const perf = useMemo(() => {
    const done = monthItems.filter((a) => a.status === 'completed');
    const rated = done.filter((a) => a.rating !== null);
    const good = rated.filter((a) => (a.rating ?? 0) >= 4).length;
    const avg = rated.length > 0 ? rated.reduce((s, a) => s + (a.rating ?? 0), 0) / rated.length : null;
    const boardingInStore = monthItems.filter((a) => a.type === 'boarding' && a.status === 'in_boarding');
    return {
      doneCount: done.length,
      goodRate: rated.length > 0 ? good / rated.length : null,
      ratedCount: rated.length,
      avg,
      boardingInStore: boardingInStore.length,
      boardingIds: monthItems.filter((a) => a.type === 'boarding').map((a) => a.id),
    };
  }, [monthItems]);

  // 本月寄养打卡数（logs.staffId=本人，前端聚合，零新接口）
  const myStaffId = staff?.id ?? null;
  const logQueries = useQueries({
    queries: perf.boardingIds.map((aid) => ({
      queryKey: ['boarding', 'stayForStaff', aid],
      queryFn: () => trpc.boarding.stayForStaff.query({ appointmentId: aid }),
      staleTime: 60_000,
    })),
  });
  const monthLogCount = useMemo(() => {
    if (!myStaffId) return null;
    const ym = `${monthFrom.getFullYear()}-${String(monthFrom.getMonth() + 1).padStart(2, '0')}`;
    let n = 0;
    for (const q of logQueries) {
      const logs = q.data?.logs ?? [];
      n += logs.filter((l) => l.staffId === myStaffId && l.logDate.startsWith(ym)).length;
    }
    return n;
  }, [logQueries, myStaffId, monthFrom]);

  const schedule = staff?.schedule as Schedule | null | undefined;
  const todayKey = dayKeyOf(new Date());
  const todayRanges = schedule?.[todayKey] ?? [];
  const onDuty = todayRanges.length > 0;
  const offDays = SCHEDULE_DAYS.filter((d) => !(schedule?.[d.key]?.length)).map((d) => d.label.replace('周', ''));
  const roleLabel = staff?.role === 'frontdesk' ? '前台 frontdesk' : '美容师 groomer';
  const joinText = staff?.createdAt ? `入职 ${staff.createdAt.getFullYear()}-${String(staff.createdAt.getMonth() + 1).padStart(2, '0')}` : null;

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout(getApiBase());
      await queryClient.invalidateQueries();
      navigate('/dev-login', { replace: true });
    } catch {
      showToast('登出失败，请检查网络后重试');
      setLoggingOut(false);
    }
  };

  return (
    <div className="px-4 pb-6">
      {/* 用户卡：头像薄荷环 + 角色薄荷签 + 入职年月 + 在班态 */}
      <section className="u1-card mt-2.5 flex items-center gap-3.5 p-4" data-testid="me-user-card">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sunken shadow-[0_0_0_2px_#FFFDF6,0_0_0_3.5px_#7FD8BE]">
          {user && 'avatarUrl' in user && (user as { avatarUrl?: string }).avatarUrl ? (
            <img src={(user as { avatarUrl?: string }).avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <PawPrint className="h-6 w-6 text-ink" strokeWidth={1.6} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title font-extrabold">{staff?.name ?? user?.nickname ?? '员工'}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-caption-xs text-[rgba(74,59,46,.62)]">
            <b className="rounded-chip bg-brand-secondary px-1.5 py-0.5 font-bold text-ink">{roleLabel}</b>
            {joinText ? <span>· {joinText}</span> : null}
            <span>· {onDuty ? '在班' : '今日休息'}</span>
          </p>
          {store ? <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">{store.name}</p> : null}
        </div>
      </section>

      {/* 三格数字（Montserrat 22，三连圆角 20） */}
      <section className="mt-3.5 grid grid-cols-3" data-testid="me-stats">
        {[
          { v: monthQuery.isPending ? '…' : String(perf.doneCount), c: '本月完成单' },
          { v: monthQuery.isPending ? '…' : perf.goodRate !== null ? `${Math.round(perf.goodRate * 100)}%` : '—', c: '好评率' },
          { v: monthLogCount === null ? '—' : String(monthLogCount), c: '本月寄养打卡' },
        ].map((cell, i) => (
          <div
            key={cell.c}
            className={`u1-ring bg-card px-2 py-3.5 text-center ${i === 0 ? 'rounded-l-panel' : ''} ${i === 2 ? 'rounded-r-panel' : ''}`}
          >
            <div className="u1-num text-[22px] font-extrabold leading-7">{cell.v}</div>
            <div className="mt-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">{cell.c}</div>
          </div>
        ))}
      </section>

      {/* 列表组 1 */}
      <section className="u1-card mt-3.5 divide-y divide-[rgba(74,59,46,.06)]" data-testid="me-list-1">
        <ListRow
          icon={CalendarDays}
          label="我的排班"
          sub={`本周${(schedule?.[todayKey]?.map((r) => `${r.start}–${r.end}`).join(' / ')) ?? '—'}${offDays.length ? ` · 周${offDays.join('、')}休` : ''}（只读，店长排）`}
          testid="me-schedule"
          onClick={() => setExpandKey((k) => (k === 'schedule' ? null : 'schedule'))}
          expanded={expandKey === 'schedule'}
        />
        {expandKey === 'schedule' ? (
          <ul className="px-4 pb-3">
            {SCHEDULE_DAYS.map(({ key, label }) => {
              const ranges = schedule?.[key] ?? [];
              return (
                <li key={key} className={`flex items-center justify-between py-1.5 text-caption-xs ${key === todayKey ? 'font-bold text-ink' : 'text-[rgba(74,59,46,.62)]'}`}>
                  <span>{label}{key === todayKey ? '（今天）' : ''}</span>
                  <span className="u1-num">{ranges.length ? ranges.map((r) => `${r.start}–${r.end}`).join(' / ') : '休'}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <ListRow
          icon={Star}
          label="我的评价"
          sub={`近 30 天口径看历史页 · 本月已评 ${perf.ratedCount} 条${perf.avg !== null ? ` · 均分 ${perf.avg.toFixed(1)}` : ''}`}
          to="/history"
          testid="me-reviews"
        />
        <ListRow
          icon={BedDouble}
          label="寄养负责中"
          sub={`${perf.boardingInStore} 只在店（任务台全天行打卡）`}
          to="/today"
          testid="me-boarding"
        />
      </section>

      {/* 列表组 2 */}
      <section className="u1-card mt-3.5 divide-y divide-[rgba(74,59,46,.06)]" data-testid="me-list-2">
        <ListRow
          icon={CircleHelp}
          label="帮助与规范"
          sub="六步影像规范 · 核销流程"
          testid="me-help"
          onClick={() => setExpandKey((k) => (k === 'help' ? null : 'help'))}
          expanded={expandKey === 'help'}
        />
        {expandKey === 'help' ? (
          <div className="px-4 pb-3 text-caption-xs leading-relaxed text-[rgba(74,59,46,.62)]">
            <p className="font-bold text-ink">六步影像规范</p>
            <p className="mt-1">消毒 1–3 张 · 预检 2–6 张 · 洗护 3–9 张 · 精修 2–6 张 · 前后对比各 1 张；过程照实时同步家长，张数达标才能确认翻步。</p>
            <p className="mt-2 font-bold text-ink">核销流程</p>
            <p className="mt-1">客户到店出示预约码 → 前台扫码（无摄像头走手动 6 位码）→ 核销成功自动开单；寄养单核销后办理入住登记。</p>
          </div>
        ) : null}
        <ListRow
          icon={Settings}
          label="设置"
          sub="实时同步与通知"
          testid="me-settings"
          onClick={() => setExpandKey((k) => (k === 'settings' ? null : 'settings'))}
          expanded={expandKey === 'settings'}
        />
        {expandKey === 'settings' ? (
          <div className="px-4 pb-3 text-caption-xs leading-relaxed text-[rgba(74,59,46,.62)]">
            <p>实时同步：派单/改期/取消即时推送（SSE 长连接，断线自动重连 + 60s 轮询兜底）。</p>
            <p className="mt-1">通知权限：{typeof Notification !== 'undefined' ? (Notification.permission === 'granted' ? '已开启' : Notification.permission === 'denied' ? '已拒绝（浏览器地址栏可改）' : '未开启') : '当前环境不支持'}</p>
          </div>
        ) : null}
        <ListRow
          icon={LogOut}
          label={loggingOut ? '退出中…' : '退出登录'}
          danger
          testid="me-logout"
          onClick={() => void doLogout()}
        />
      </section>

      <p className="mb-6 mt-4 text-center text-caption-xs text-[rgba(74,59,46,.42)]">Philia 员工端 · 内测 v1.1</p>

      <Toast message={toast} />
    </div>
  );
}
