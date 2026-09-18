/**
 * 员工 /staff（U3 批次 · 任务 K · 规格书 §10 · 母本试样 608-657 行 / .staff-card CSS 133-140）
 *
 * 数据源：store.staffList（员工 + 岗位角色 + 技能 + 排班 + 绩效聚合：完成单数/好评率/平均分）。
 * 布局：MainScaffold（title 员工 / sub 在职·角色计数·S4 派单口径 / 柠檬钮「＋ 邀请员工」）
 * → u3-panel 行式员工卡（staff-card 工艺：42 圆头像占位 + 名 + 角色签（美容师=薄荷 /
 * 前台=浅木，u3-chip 圆角 6）+ 绩效行 + 右侧排班摘要（周模板压缩「一至五 09:00–18:00」+休日）
 * + 在班态（今日排班覆盖当前时刻→今日在班）+「编辑 ›」）。
 *
 * 真链路（全部保留）：
 * - 邀请：InviteStaffDialog → store.inviteStaff（24h 明文码一次展示 + 复制）；
 * - 「编辑 ›」→ EditStaffDialog → store.updateStaff（角色 + 在职状态）；
 * - 排班摘要块（可点）→ ScheduleEditorDialog → store.setSchedule（周模板）；
 * - 停职行 55% 透明 +「启用 ›」→ store.updateStaff status=active（部分更新，role 不动）。
 *
 * 口径备注：stats.completedCount 为全部已完成预约聚合（接口无「本月」维度），
 * 故绩效行写「完成 N 单」不挂「本月」字样，避免口径虚标。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import MainScaffold, { LemonButton, QuietButton } from '../components/MainScaffold';
import EditStaffDialog from '../components/staff-admin/EditStaffDialog';
import InviteStaffDialog from '../components/staff-admin/InviteStaffDialog';
import ScheduleEditorDialog from '../components/staff-admin/ScheduleEditorDialog';
import { errMsg } from '../components/staff-admin/format';
import { toast, ToasterMount } from '../components/staff-admin/ui';
import {
  DAY_KEYS,
  DAY_SHORT,
  STAFF_ROLE_LABEL,
  type DayKey,
  type StaffRow,
  type StaffScheduleLike,
} from '../components/staff-admin/types';

/* ------------------------------------------------------------------ */
/* 文案/压缩助手                                                        */
/* ------------------------------------------------------------------ */

/** 连续工作日压缩：run ≥3 →「一至五」；短 run/单日 →「六/日」斜杠连（试样口径） */
function compressDays(days: DayKey[]): string {
  const runs: DayKey[][] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && DAY_KEYS.indexOf(d) === DAY_KEYS.indexOf(last[last.length - 1]) + 1) {
      last.push(d);
    } else {
      runs.push([d]);
    }
  }
  return runs
    .map((r) =>
      r.length >= 3
        ? `${DAY_SHORT[r[0]]}至${DAY_SHORT[r[r.length - 1]]}`
        : r.map((k) => DAY_SHORT[k]).join('/'),
    )
    .join('/');
}

/** 周模板压缩摘要：同时段的工作日合并；休日缀后（「一至五 09:00–18:00 · 休 六/日」） */
function weekSummary(schedule: StaffScheduleLike | null | undefined): string {
  if (!schedule) return '未排班';
  const working = DAY_KEYS.filter((k) => (schedule[k]?.length ?? 0) > 0);
  if (working.length === 0) return '未排班';
  const sigOf = (k: DayKey) => schedule[k]!.map((r) => `${r.start}–${r.end}`).join('/');
  const groups = new Map<string, DayKey[]>();
  for (const k of working) {
    const sig = sigOf(k);
    groups.set(sig, [...(groups.get(sig) ?? []), k]);
  }
  const parts = [...groups.entries()].map(([time, days]) => `${compressDays(days)} ${time}`);
  const rest = DAY_KEYS.filter((k) => !working.includes(k));
  if (rest.length > 0) parts.push(`休 ${compressDays(rest)}`);
  return parts.join(' · ');
}

/** 在班态：今日排班覆盖当前时刻 → 今日在班；有班未覆盖 → 今日班次；无班 → 今日休息 */
function todayStatus(schedule: StaffScheduleLike | null | undefined): { label: string; onDuty: boolean } {
  const now = new Date();
  const key = DAY_KEYS[(now.getDay() + 6) % 7];
  const ranges = schedule?.[key] ?? null;
  if (!ranges || ranges.length === 0) return { label: '今日休息', onDuty: false };
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (ranges.some((r) => toMin(r.start) <= nowMin && nowMin < toMin(r.end))) {
    return { label: '今日在班', onDuty: true };
  }
  return { label: `今日班次 ${ranges.map((r) => `${r.start}–${r.end}`).join('/')}`, onDuty: false };
}

/** 入职年月：YYYY-MM（Montserrat tabular） */
function joinMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* 角色签（美容师=薄荷 #7FD8BE / 前台=浅木 #D4B896 · 圆角 6 · 墨色字）     */
/* ------------------------------------------------------------------ */

function RoleChip({ role }: { role: string }) {
  const bg = role === 'frontdesk' ? '#D4B896' : '#7FD8BE';
  return (
    <span
      className="rounded-chip px-[7px] py-[2px] text-caption-xs font-bold text-ink"
      style={{ background: bg }}
    >
      {STAFF_ROLE_LABEL[role] ?? role}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function StaffPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const staffQuery = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<StaffRow | null>(null);
  const [editFor, setEditFor] = useState<StaffRow | null>(null);
  /** 正在启用中的停职行（行级 loading，防重复点击） */
  const [enablingId, setEnablingId] = useState<string | null>(null);

  const staff = (staffQuery.data?.staff ?? []) as StaffRow[];
  const invalidateStaff = () => void queryClient.invalidateQueries({ queryKey: ['store', 'staffList'] });

  const active = staff.filter((s) => s.status === 'active');
  const groomerCount = active.filter((s) => s.role === 'groomer').length;
  const frontdeskCount = active.filter((s) => s.role === 'frontdesk').length;

  const enableStaff = async (s: StaffRow) => {
    setEnablingId(s.id);
    try {
      await trpc.store.updateStaff.mutate({ staffId: s.id, status: 'active' });
      toast(`已启用：${s.name} 恢复在职`);
      invalidateStaff();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setEnablingId(null);
    }
  };

  return (
    <MainScaffold
      title="员工"
      sub={`在职 ${active.length} · 美容师 ${groomerCount} · 前台 ${frontdeskCount} · 自动派单按排班+负荷（S4）`}
      actions={<LemonButton onClick={() => setInviteOpen(true)}>＋ 邀请员工</LemonButton>}
      testid="staff-page"
    >
      <ToasterMount />

      <div className="u3-panel">
        <div className="u3-panel-head">
          <h3>在职员工</h3>
          <span className="aside">排班=自动派单与可约判定之源</span>
        </div>

        {staffQuery.isPending ? (
          // 骨架（禁转圈）：三条脉冲行
          <div aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-[13px] border-t border-[rgba(74,59,46,.06)] px-[17px] py-3"
              >
                <div className="h-[42px] w-[42px] rounded-full bg-[rgba(74,59,46,.08)]" />
                <div className="flex-1">
                  <div className="h-3.5 w-28 rounded-chip bg-[rgba(74,59,46,.08)]" />
                  <div className="mt-2 h-3 w-44 rounded-chip bg-[rgba(74,59,46,.06)]" />
                </div>
                <div className="h-3 w-32 rounded-chip bg-[rgba(74,59,46,.06)]" />
              </div>
            ))}
          </div>
        ) : staffQuery.isError ? (
          <div className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(74,59,46,.62)]">员工列表加载失败，请检查网络后重试</p>
            <div className="mt-4">
              <QuietButton onClick={() => void staffQuery.refetch()}>重新加载</QuietButton>
            </div>
          </div>
        ) : staff.length === 0 ? (
          <div className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(74,59,46,.62)]">还没有员工</p>
            <div className="mt-4">
              <LemonButton onClick={() => setInviteOpen(true)}>去邀请第一位员工</LemonButton>
            </div>
          </div>
        ) : (
          staff.map((s) => {
            const suspended = s.status !== 'active';
            const duty = todayStatus(s.schedule);
            return (
              <div
                key={s.id}
                className="flex items-center gap-[13px] border-t border-[rgba(74,59,46,.06)] px-[17px] py-3 text-caption"
                style={suspended ? { opacity: 0.55 } : undefined}
              >
                {/* 头像 42 圆（staff 表无 avatarUrl 字段 → 试样占位口径：纯墨 12% 圆，不堆图标） */}
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-[rgba(74,59,46,.12)]" />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-bold text-ink">{s.name}</span>
                    <RoleChip role={s.role} />
                  </div>
                  <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.62)]">
                    {suspended ? (
                      <>
                        入职 <span className="u1-num">{joinMonth(s.createdAt)}</span> · 停职中不可派单/核销
                      </>
                    ) : (
                      <>
                        入职 <span className="u1-num">{joinMonth(s.createdAt)}</span> · 完成{' '}
                        <span className="u1-num">{s.stats.completedCount}</span> 单 · 好评{' '}
                        <span className="u1-num">
                          {s.stats.goodRate !== null ? `${Math.round(s.stats.goodRate * 100)}%` : '—'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 右侧排班摘要（点击 → 排班编辑器，setSchedule 真链路） */}
                <button
                  type="button"
                  onClick={() => setScheduleFor(s)}
                  className="ml-auto shrink-0 rounded-chip px-2 py-1 text-right transition-colors duration-150 hover:bg-[rgba(74,59,46,.04)]"
                  aria-label={`编辑${s.name}的排班`}
                >
                  <div className="text-caption-xs text-[rgba(74,59,46,.62)]">排班 {weekSummary(s.schedule)}</div>
                  <div
                    className={`mt-[2px] text-caption-xs ${
                      suspended
                        ? 'text-[rgba(74,59,46,.42)]'
                        : duty.onDuty
                          ? 'font-semibold text-ink'
                          : 'text-[rgba(74,59,46,.42)]'
                    }`}
                  >
                    {suspended ? '已停职' : duty.label}
                  </div>
                </button>

                {/* 行动作=纯文字 12/700 墨字（试样「编辑 ›」11.5/700 映射入闸门；按下 120ms） */}
                <span className="ml-3.5 shrink-0">
                  {suspended ? (
                    <button
                      type="button"
                      disabled={enablingId === s.id}
                      onClick={() => void enableStaff(s)}
                      className="text-caption font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                    >
                      {enablingId === s.id ? '启用中…' : '启用 ›'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditFor(s)}
                      className="text-caption font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
                    >
                      编辑 ›
                    </button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      <InviteStaffDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <EditStaffDialog
        staff={editFor}
        open={editFor !== null}
        onClose={() => setEditFor(null)}
        onSaved={invalidateStaff}
      />
      <ScheduleEditorDialog
        staff={scheduleFor}
        open={scheduleFor !== null}
        onClose={() => setScheduleFor(null)}
        onSaved={invalidateStaff}
      />
    </MainScaffold>
  );
}
