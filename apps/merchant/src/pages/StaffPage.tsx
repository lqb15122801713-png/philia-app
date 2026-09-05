/**
 * 员工管理（/staff · T4.3 · coder-staff-admin）
 *
 * 数据源：store.staffList（员工 + 技能 + 排班 + 绩效聚合：完成单数/好评率/平均分）。
 * 操作：
 * - 「邀请员工」→ InviteStaffDialog → store.inviteStaff（明文邀请码一次展示 + 复制）。
 * - 「排班」→ ScheduleEditorDialog → store.setSchedule（周模板，每天休息/至多 4 时段）。
 *
 * 已知服务端缺口（本页只读展示，勿加交互）：
 * - 技能标签（skills）与在职状态（status）无 merchant 更新接口
 *   （store.ts 仅有 staffList / inviteStaff / setSchedule），v2 补齐后再开编辑。
 *
 * 布局（契约）：平板 lg+ 信息密度优先用表格；手机降级为紧凑卡片列表。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, UserPlus } from 'lucide-react';
import { useState } from 'react';
import InviteStaffDialog from '../components/staff-admin/InviteStaffDialog';
import ScheduleEditorDialog from '../components/staff-admin/ScheduleEditorDialog';
import { fmtAvg, fmtRate, scheduleSummary } from '../components/staff-admin/format';
import { SKILL_LABEL, type StaffRow } from '../components/staff-admin/types';
import { Badge, Btn, Chip, Empty, Loading, ToasterMount } from '../components/staff-admin/ui';

function SkillChips({ skills }: { skills: string[] | null }) {
  if (!skills || skills.length === 0) {
    return <span className="text-caption text-ink-placeholder">未设置</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {skills.map((s) => (
        <Chip key={s}>{SKILL_LABEL[s] ?? s}</Chip>
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <Badge tone="success">在职</Badge>
  ) : (
    <Badge tone="muted">已停用</Badge>
  );
}

export default function StaffPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const staffQuery = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<StaffRow | null>(null);

  const staff = (staffQuery.data?.staff ?? []) as StaffRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <ToasterMount />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-title-lg font-semibold text-ink">员工管理</h1>
          <p className="mt-0.5 text-caption text-ink-secondary">
            共 {staff.length} 人 · 绩效取本店全部已完成预约聚合
          </p>
        </div>
        <Btn variant="primary" onClick={() => setInviteOpen(true)}>
          <UserPlus size={16} strokeWidth={1.5} />
          邀请员工
        </Btn>
      </div>

      {staffQuery.isPending ? (
        <Loading />
      ) : staffQuery.isError ? (
        <Empty title="员工列表加载失败" hint="请检查网络后下拉刷新或重新进入" />
      ) : staff.length === 0 ? (
        <Empty title="还没有员工" hint="点右上角「邀请员工」生成邀请码，员工在员工端输入邀请码即可入职" />
      ) : (
        <>
          {/* 平板/桌面：表格（信息密度优先；辅助档 13px 用 text-caption） */}
          <div className="hidden overflow-hidden rounded-card bg-card shadow-card lg:block">
            <table className="w-full text-left text-body">
              <thead>
                <tr className="border-b border-line-divider text-caption text-ink-secondary">
                  <th className="px-4 py-3 font-medium">花名</th>
                  <th className="px-4 py-3 font-medium">技能标签</th>
                  <th className="px-4 py-3 font-medium">排班</th>
                  <th className="px-4 py-3 font-medium">完成单数</th>
                  <th className="px-4 py-3 font-medium">好评率</th>
                  <th className="px-4 py-3 font-medium">平均分</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-line-divider last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                    <td className="px-4 py-3">
                      <SkillChips skills={s.skills} />
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{scheduleSummary(s.schedule)}</td>
                    <td className="px-4 py-3 text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.stats.completedCount}
                    </td>
                    <td className="px-4 py-3 text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRate(s.stats.goodRate)}
                    </td>
                    <td className="px-4 py-3 text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtAvg(s.stats.avgRating)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Btn variant="subtle" size="sm" onClick={() => setScheduleFor(s)}>
                        <CalendarClock size={14} strokeWidth={1.5} />
                        排班
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 手机：紧凑卡片列表 */}
          <div className="space-y-3 lg:hidden">
            {staff.map((s) => (
              <div key={s.id} className="rounded-card bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-title font-semibold text-ink">{s.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-2">
                  <SkillChips skills={s.skills} />
                </div>
                <div className="mt-2 text-caption text-ink-secondary">排班：{scheduleSummary(s.schedule)}</div>
                <div
                  className="mt-2 flex gap-4 text-caption text-ink-secondary"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <span>完成 {s.stats.completedCount} 单</span>
                  <span>好评率 {fmtRate(s.stats.goodRate)}</span>
                  <span>平均 {fmtAvg(s.stats.avgRating)}</span>
                </div>
                <div className="mt-3">
                  <Btn variant="ghost" size="sm" onClick={() => setScheduleFor(s)}>
                    <CalendarClock size={14} strokeWidth={1.5} />
                    编辑排班
                  </Btn>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-caption text-ink-placeholder">
            技能标签与在职状态暂为只读（服务端暂无员工资料更新接口，v2 补齐后开放编辑）；排班可直接编辑。
          </p>
        </>
      )}

      <InviteStaffDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ScheduleEditorDialog
        staff={scheduleFor}
        open={scheduleFor !== null}
        onClose={() => setScheduleFor(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['store', 'staffList'] })}
      />
    </div>
  );
}
