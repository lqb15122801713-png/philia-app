/**
 * 寄养监视面板（T4.2 监视页寄养变体；U3 任务 N 视觉对齐）：boarding.stayBoard
 * 同款信息只读展示，容器/字段行换 u3-panel + u3-field 工艺，超期签换 u3-st red。
 * - 入住信息：房间号 / 入住体重 / 随身物品 / 退住时间（appointment.get → boardingStay）；
 * - 打卡状态：最近打卡日期 + 超期标记（stayBoard 行）；
 * - 每日打卡只读流：页面在线期间经 SSE boarding.daily_update 实时累积的打卡动态。
 *   边界说明：现有接口无 merchant 可读的历史打卡明细端点（myStay=customer、
 *   stayForStaff=staff），历史明细请在「寄养管理」页查看——汇报已标注。
 */

import { PawPrint } from 'lucide-react';
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
    <div className="flex flex-col gap-3.5">
      {/* 入住信息 */}
      <section className="u3-panel">
        <div className="u3-panel-head">
          <h3>入住信息</h3>
        </div>
        {boardingStay ? (
          <div className="px-[17px] pb-3">
            <div className="u3-field">
              <span className="lb">房间号</span>
              <span className="vl">{boardingStay.roomNo ?? '待登记'}</span>
            </div>
            <div className="u3-field">
              <span className="lb">入住体重</span>
              <span className="vl font-number tabular-nums">
                {boardingStay.checkinWeightKg !== null
                  ? `${boardingStay.checkinWeightKg} kg`
                  : '未记录'}
              </span>
            </div>
            <div className="u3-field">
              <span className="lb">随身物品</span>
              <span className="vl">
                {belongings.length > 0
                  ? belongings.map((b) => `${b.name}${b.note ? `（${b.note}）` : ''}`).join('、')
                  : '无登记'}
              </span>
            </div>
            <div className="u3-field">
              <span className="lb">退住时间</span>
              <span className="vl font-number tabular-nums">
                {boardingStay.checkoutAt ? fmtDateTime(boardingStay.checkoutAt) : '在住'}
              </span>
            </div>
          </div>
        ) : (
          <p className="px-[17px] pb-4 text-caption text-[rgba(74,59,46,.62)]">
            尚未办理入住登记。
          </p>
        )}
      </section>

      {/* 每日打卡（只读流） */}
      <section className="u3-panel">
        <div className="u3-panel-head">
          <h3>每日打卡</h3>
          {boardEntry?.overdue ? <span className="u3-st red">已超期</span> : null}
        </div>
        <p className="px-[17px] text-caption-xs text-[rgba(74,59,46,.42)]">
          最近打卡：{boardEntry?.lastLogDate ?? '暂无'}
        </p>

        {liveLogs.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2 px-[17px] pb-4">
            {liveLogs.map((l, i) => (
              <li
                key={`${l.logDate}-${l.ts}-${i}`}
                className="flex items-center gap-2 rounded-chip bg-[#F6F1E3] px-3 py-2"
              >
                <PawPrint className="h-4 w-4 shrink-0 text-[#4A3B2E]" strokeWidth={1.5} />
                <span className="text-caption text-[#4A3B2E]">{l.logDate} 打卡已更新</span>
                <span className="ml-auto font-number text-caption-xs tabular-nums text-[rgba(74,59,46,.42)]">
                  {fmtDateTime(new Date(l.ts))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 px-[17px] pb-4 text-caption-xs text-[rgba(74,59,46,.42)]">
            员工打卡后会实时出现在这里；历史打卡明细请在「寄养管理」页查看。
          </p>
        )}
      </section>
    </div>
  );
}
