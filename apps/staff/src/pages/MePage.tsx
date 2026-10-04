/**
 * 我的 /me（S-04 · 员工端骨架整建批片 1 结构组；原批次 U2 任务 G）
 *
 * S-04 骨架（UX 语言包 V1.1 §三）：apphead → SkIdCard 身份卡（字像金边 + mono 工号 +
 * trio 三格账=既有绩效数据点）→ SkRows 两组链接行（提成/XP/评价 → /pay /xp /reviews｜
 * 盘点/审批/寄养/设置 → /inventory /manager /today /就地展开）。三级视界：补卡审批行仅
 * 店长/店主可见（merchant_manager/merchant_owner），有 pending 审批才亮红点（exceptionQueue
 *  gated 调用）。历史单入口摘除（归 S-02 切日态）：原「评价总览 → /history」行移除，
 * 其绩效口径数据（已评条数/均分）并入「我的评价」行右值；「打卡考勤」行移除（dock 四槽已含打卡）。
 *
 * 数据（零新接口，前端聚合，原逻辑不动）：
 * - auth.me 原始响应（staff 行：role/schedule/createdAt；store 名）；
 * - listForStaff 本月：完成单数 + 好评率（≥4 占比）+ 评价条数/均分 + 在店寄养数（in_boarding）；
 * - 本月寄养打卡数：本月 boarding 单 × stayForStaff.logs（staffId=本人）前端聚合；
 * - 帮助与规范/设置=就地展开真实内容（无对应页面，不做假跳转）；退出登录=真 logout。
 */

import { getApiBase, logout, useMe, usePhiliaClient, useToast } from '@philia/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkAppHead, SkIdCard, SkNote, SkRow, SkRows } from '@/components/skeleton';
import { dayKeyOf, SCHEDULE_DAYS, type HistoryItem } from '@/components/today/utils';
import { ME_COPY } from '@/copy/me';
import { skc } from '@/copy/skeleton';

type Schedule = Partial<Record<string, Array<{ start: string; end: string }> | null>>;

/** me 域 copy 取值 + {var} 插值 */
const mc = (key: keyof typeof ME_COPY, vars?: Record<string, string | number>): string => {
  const tpl: string = ME_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
};

export default function MePage() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { user } = useMe();
  const { showToast, toastEl } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [expandKey, setExpandKey] = useState<'schedule' | 'help' | 'settings' | null>(null);

  // 员工详情（staff 行：role/schedule/createdAt；store）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
  });
  const staff = meQuery.data?.staff ?? null;

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
  const roleLabel = staff?.role === 'frontdesk' ? '前台 frontdesk' : '美容师 groomer';
  const joinDate = staff?.createdAt ? `${staff.createdAt.getFullYear()}-${String(staff.createdAt.getMonth() + 1).padStart(2, '0')}` : null;

  /* ---- 三级视界：补卡审批仅店长/店主可见；红点=有 pending 才点（gated 调用，员工不触merchantManager接口） ---- */
  const isManager = (user?.roles ?? []).some((r) => r === 'merchant_manager' || r === 'merchant_owner');
  const exceptionQ = useQuery({
    queryKey: ['attendance', 'exceptionQueue'],
    queryFn: () => trpc.attendance.exceptionQueue.query(),
    enabled: isManager,
    staleTime: 60_000,
  });
  const pendingApprovals = exceptionQ.data?.approvals.length ?? 0;

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

  const avatarUrl = user && 'avatarUrl' in user ? ((user as { avatarUrl?: string | null }).avatarUrl ?? null) : null;
  const idShort = (staff?.id ?? user?.staffId ?? user?.id ?? '').slice(-8).toUpperCase() || '—';

  return (
    <div className="sk pb-6">
      <SkAppHead title={skc('sk.meTitle')} no={skc('sk.meNo')} />

      {/* 身份卡（字像金边 + mono 工号 + trio 三格账=既有绩效数据点） */}
      <div data-testid="me-user-card">
        <div data-testid="me-stats">
          <SkIdCard
            name={staff?.name ?? user?.nickname ?? '员工'}
            no={`${roleLabel} · ${mc('me.idcard.no', { no: idShort })}${joinDate ? ` · ${mc('me.joined', { ym: joinDate })}` : ''} · ${onDuty ? mc('me.onDuty') : mc('me.offDuty')}`}
            photoUrl={avatarUrl}
            cells={[
              { v: monthQuery.isPending ? '…' : String(perf.doneCount), k: mc('me.stat.done') },
              { v: monthQuery.isPending ? '…' : perf.goodRate !== null ? `${Math.round(perf.goodRate * 100)}%` : '—', k: mc('me.stat.goodRate') },
              { v: monthLogCount === null ? '—' : String(monthLogCount), k: mc('me.stat.boardingLogs') },
            ]}
          />
        </div>
      </div>

      {/* 组 A：提成 / XP / 评价 */}
      <SkRows testId="me-list-staff2">
        <SkRow
          to="/pay"
          testId="me-pay"
          label={
            <span>
              {mc('me.row.pay')}
              <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">{mc('me.row.paySub')}</small>
            </span>
          }
          value="›"
        />
        <SkRow
          to="/xp"
          testId="me-xp"
          label={
            <span>
              {mc('me.row.xp')}
              <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">{mc('me.row.xpSub')}</small>
            </span>
          }
          value="›"
        />
        <SkRow
          to="/reviews"
          testId="me-reviews-list"
          label={
            <span>
              {ME_COPY['me.myReviews']}
              <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">{ME_COPY['me.myReviewsSub']}</small>
            </span>
          }
          value={`${ME_COPY['me.reviewMonthLead']} ${perf.ratedCount} ${ME_COPY['me.reviewSummaryUnit']}${perf.avg !== null ? ` · ${ME_COPY['me.reviewSummaryAvg']} ${perf.avg.toFixed(1)}` : ''}`}
        />
      </SkRows>

      {/* 组 B：盘点 / 审批（店长视界+红点）/ 寄养 / 设置（+我的排班=既有只读排班保留） */}
      <SkRows testId="me-list-2">
        <SkRow
          testId="me-schedule"
          onClick={() => setExpandKey((k) => (k === 'schedule' ? null : 'schedule'))}
          label={mc('me.row.schedule')}
          value={todayRanges.length ? todayRanges.map((r) => `${r.start}–${r.end}`).join(' / ') : '—'}
        />
        {expandKey === 'schedule' ? (
          <ul className="px-1 pb-3">
            {SCHEDULE_DAYS.map(({ key, label }) => {
              const ranges = schedule?.[key] ?? [];
              return (
                <li key={key} className={`flex items-center justify-between py-1.5 text-caption-xs ${key === todayKey ? 'font-bold text-ink' : 'text-[rgba(59,46,36,.62)]'}`}>
                  <span>{label}{key === todayKey ? '（今天）' : ''}</span>
                  <span className="u1-num">{ranges.length ? ranges.map((r) => `${r.start}–${r.end}`).join(' / ') : '休'}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <SkRow
          to="/inventory"
          testId="me-inventory"
          label={
            <span>
              {mc('me.row.inventory')}
              <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">{mc('me.row.inventorySub')}</small>
            </span>
          }
          value="›"
        />
        {isManager ? (
          <SkRow
            to="/manager"
            testId="me-manager"
            dot={pendingApprovals > 0}
            label={
              <span>
                {mc('me.row.manager')}
                <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">{mc('me.row.managerSub')}</small>
              </span>
            }
            value={pendingApprovals > 0 ? `${pendingApprovals} 待审` : '›'}
          />
        ) : null}
        <SkRow
          to="/today"
          testId="me-boarding"
          label={mc('me.row.boarding')}
          value={mc('me.row.boardingSub', { n: perf.boardingInStore })}
        />
        <SkRow
          testId="me-settings"
          onClick={() => setExpandKey((k) => (k === 'settings' ? null : 'settings'))}
          label={
            <span>
              {mc('me.row.settings')}
              <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">{mc('me.row.settingsSub')}</small>
            </span>
          }
          value={expandKey === 'settings' ? '⌄' : '›'}
        />
        {expandKey === 'settings' ? (
          <div className="px-1 pb-3 text-caption-xs leading-relaxed text-[rgba(59,46,36,.62)]">
            <p>{ME_COPY['me.settings.sync']}</p>
            <p className="mt-1">通知权限：{typeof Notification !== 'undefined' ? (Notification.permission === 'granted' ? '已开启' : Notification.permission === 'denied' ? '已拒绝（浏览器地址栏可改）' : '未开启') : '当前环境不支持'}</p>
          </div>
        ) : null}
      </SkRows>

      {/* 组 C：帮助与规范（就地展开）+ 退出登录（真 logout） */}
      <SkRows testId="me-list-help">
        <SkRow
          testId="me-help"
          onClick={() => setExpandKey((k) => (k === 'help' ? null : 'help'))}
          label={
            <span>
              {mc('me.row.help')}
              <small className="mt-0.5 block text-caption-xs text-[rgba(59,46,36,.42)]">{mc('me.row.helpSub')}</small>
            </span>
          }
          value={expandKey === 'help' ? '⌄' : '›'}
        />
        {expandKey === 'help' ? (
          <div className="px-1 pb-3 text-caption-xs leading-relaxed text-[rgba(59,46,36,.62)]">
            <p className="font-bold text-ink">{ME_COPY['me.help.specTitle']}</p>
            <p className="mt-1">{ME_COPY['me.help.specBody']}</p>
            <p className="mt-2 font-bold text-ink">{ME_COPY['me.help.flowTitle']}</p>
            <p className="mt-1">{ME_COPY['me.help.flowBody']}</p>
          </div>
        ) : null}
        <SkRow
          testId="me-logout"
          onClick={() => void doLogout()}
          label={loggingOut ? mc('me.row.loggingOut') : mc('me.row.logout')}
          value=""
        />
      </SkRows>

      <SkNote>{mc('me.version')}</SkNote>

      {toastEl}
    </div>
  );
}
