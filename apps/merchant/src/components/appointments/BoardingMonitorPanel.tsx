/**
 * 寄养监视面板（T4.2 监视页寄养变体）：boarding.stayBoard 同款信息只读展示。
 * - 入住信息：房间号 / 入住体重 / 随身物品 / 退住时间（appointment.get → boardingStay）；
 * - 打卡状态：最近打卡日期 + 超期标记（stayBoard 行）；
 * - 每日打卡只读流：页面在线期间经 SSE boarding.daily_update 实时累积的打卡动态。
 *   边界说明：现有接口无 merchant 可读的历史打卡明细端点（myStay=customer、
 *   stayForStaff=staff），历史明细请在「寄养管理」页查看——汇报已标注。
 */

import { AlertTriangle, PawPrint } from 'lucide-react';
import { fmtDateTime, type AppointmentGetResult, type StayBoardEntry } from './appt-utils';

export interface LiveLogItem {
  logDate: string;
  ts: number;
}

export function BoardingMonitorPanel({
  boardingStay,
  boardEntry,
  liveLogs,
}: {
  boardingStay: AppointmentGetResult['boardingStay'];
  boardEntry: StayBoardEntry | null;
  liveLogs: LiveLogItem[];
}) {
  const belongings = boardingStay?.belongings ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* 入住信息 */}
      <section className="rounded-card bg-card p-4 shadow-card">
        <h2 className="text-title">入住信息</h2>
        {boardingStay ? (
          <div className="mt-2 divide-y divide-line-divider">
            <div className="flex items-center justify-between py-2">
              <span className="text-caption text-ink-secondary">房间号</span>
              <span className="text-body text-ink">{boardingStay.roomNo ?? '待登记'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-caption text-ink-secondary">入住体重</span>
              <span className="font-number text-body text-ink">
                {boardingStay.checkinWeightKg !== null ? `${boardingStay.checkinWeightKg} kg` : '未记录'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 py-2">
              <span className="text-caption text-ink-secondary">随身物品</span>
              <span className="text-right text-body text-ink">
                {belongings.length > 0
                  ? belongings.map((b) => `${b.name}${b.note ? `（${b.note}）` : ''}`).join('、')
                  : '无登记'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-caption text-ink-secondary">退住时间</span>
              <span className="font-number text-body text-ink">
                {boardingStay.checkoutAt ? fmtDateTime(boardingStay.checkoutAt) : '在住'}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-body text-ink-secondary">尚未办理入住登记。</p>
        )}
      </section>

      {/* 每日打卡（只读流） */}
      <section className="rounded-card bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-title">每日打卡</h2>
          {boardEntry?.overdue ? (
            <span className="flex items-center gap-1 rounded-tag bg-danger-light px-1.5 py-0.5 text-caption text-danger-deep">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
              已超期
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-caption text-ink-secondary">
          最近打卡：{boardEntry?.lastLogDate ?? '暂无'}
        </p>

        {liveLogs.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {liveLogs.map((l, i) => (
              <li
                key={`${l.logDate}-${l.ts}-${i}`}
                className="flex items-center gap-2 rounded-tag bg-sunken px-3 py-2"
              >
                <PawPrint className="h-4 w-4 shrink-0 text-brand-primary" strokeWidth={1.5} />
                <span className="text-body text-ink">{l.logDate} 打卡已更新</span>
                <span className="ml-auto font-number text-caption text-ink-secondary">
                  {fmtDateTime(new Date(l.ts))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-caption text-ink-placeholder">
            员工打卡后会实时出现在这里；历史打卡明细请在「寄养管理」页查看。
          </p>
        )}
      </section>
    </div>
  );
}
