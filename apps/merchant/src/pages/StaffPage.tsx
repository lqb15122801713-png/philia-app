/**
 * 员工管理（/staff · T4.3 · coder-staff-admin）
 *
 * 数据源：store.staffList（员工 + 岗位角色 + 技能 + 排班 + 绩效聚合：完成单数/好评率/平均分）。
 * 操作：
 * - 「邀请员工」→ InviteStaffDialog → store.inviteStaff（明文邀请码一次展示 + 复制）。
 * - 「编辑」→ EditStaffDialog → store.updateStaff（批次 S1：角色 frontdesk/groomer 下拉
 *   + 在职状态切换，保存 toast + invalidate；技能标签仍只读，留 S4）。
 * - 「排班」→ ScheduleEditorDialog → store.setSchedule（周模板，每天休息/至多 4 时段）。
 *
 * 布局（契约）：平板 lg+ 信息密度优先用表格；手机降级为紧凑卡片列表。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, UserPen, UserPlus } from 'lucide-react';
import { useState } from 'react';
import EditStaffDialog from '../components/staff-admin/EditStaffDialog';
import InviteStaffDialog from '../components/staff-admin/InviteStaffDialog';
import ScheduleEditorDialog from '../components/staff-admin/ScheduleEditorDialog';
import { fmtAvg, fmtRate, scheduleSummary } from '../components/staff-admin/format';
import { SKILL_LABEL, STAFF_ROLE_LABEL, type StaffRow } from '../components/staff-admin/types';
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

/** 岗位角色徽章（批次 S1：frontdesk=前台 / groomer=美容师） */
function RoleBadge({ role }: { role: string }) {
  return role === 'frontdesk' ? (
    <Badge tone="brand">{STAFF_ROLE_LABEL[role]}</Badge>
  ) : (
    <Badge tone="muted">{STAFF_ROLE_LABEL[role] ?? role}</Badge>
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
  const [editFor, setEditFor] = useState<StaffRow | null>(null);

  const staff = (staffQuery.data?.staff ?? []) as StaffRow[];
  const invalidateStaff = () => void queryClient.invalidateQueries({ queryKey: ['store', 'staffList'] });

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
                  <th className="px-4 py-3 font-medium">角色</th>
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
                      <RoleBadge role={s.role} />
                    </td>
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
                      <div className="flex gap-1">
                        <Btn variant="subtle" size="sm" onClick={() => setEditFor(s)}>
                          <UserPen size={14} strokeWidth={1.5} />
                          编辑
                        </Btn>
                        <Btn variant="subtle" size="sm" onClick={() => setScheduleFor(s)}>
                          <CalendarClock size={14} strokeWidth={1.5} />
                          排班
                        </Btn>
                      </div>
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
                  <span className="flex items-center gap-1.5">
                    <RoleBadge role={s.role} />
                    <StatusBadge status={s.status} />
                  </span>
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
                <div className="mt-3 flex gap-1">
                  <Btn variant="ghost" size="sm" onClick={() => setEditFor(s)}>
                    <UserPen size={14} strokeWidth={1.5} />
                    编辑
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setScheduleFor(s)}>
                    <CalendarClock size={14} strokeWidth={1.5} />
                    编辑排班
                  </Btn>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-caption text-ink-placeholder">
            角色与在职状态可从「编辑」入口修改（保存即时生效）；技能标签暂为只读（S4 派单批开放）；排班可直接编辑。
          </p>
        </>
      )}

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
    </div>
  );
}
