/**
 * 寄养详情面板（U3 任务 G · BoardingPage 右侧栏 / 窄屏选中展开）
 *
 * 内容：宠物与客户、入住信息（房间/称重/物品清单/日期）、最近打卡、结算区。
 * 工艺：纸面 #FFFDF6 + ring+近零影 + 圆角 20，字段行走 u3-field，状态走
 * u3-st 五态胶囊；不再引用 staff-admin/ui 的 Btn/Badge（Btn 含 text-white
 * 违规，本批只允许 red 胶囊与墨轨用浅色字——故退房钮改自绘禁用态）。
 *
 * 已知服务端缺口：每日打卡明细（日期/喂食/遛弯/照片）对 merchant 无查询接口——
 * boarding.stayBoard 仅回 lastLogDate；myStay 是 customerProcedure、stayForStaff
 * 是 staffProcedure，商家均不可调。故「每日打卡历史」暂展示最近打卡日期 +
 * 缺口说明，待服务端补 merchant 视角接口（v2）后接入 PhotoWall 时间线。
 *
 * 结算口径（B3-5 A-P2-14）：boarding.checkout 为 staffProcedure，商家端不办
 * 退房——结算钮恒禁用并附说明；到店付收款仍走财务页 markPaid。
 */

import { ClipboardList, DoorOpen, Luggage, Scale } from 'lucide-react';
import { fmtDate, fmtDateTime, fmtIsoDate, fmtMoney } from './format';
import { PetAvatar } from './BoardingStayCard';
import { PAYMENT_MODE_LABEL, SPECIES_LABEL, type StayBoardRow } from './types';
import { numStyle } from './ui';

function InfoRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="u3-field">
      <span className="lb">{label}</span>
      <span className={`vl ${danger ? 'text-danger' : ''}`} style={numStyle}>
        {value}
      </span>
    </div>
  );
}

export default function BoardingStayDetail({
  row,
}: {
  row: StayBoardRow;
}) {
  const { stay, appointment, pet, customer } = row;
  return (
    <div className="flex h-full flex-col rounded-panel bg-[#FFFDF6] shadow-[0_0_0_1px_rgba(74,59,46,.09),0_1px_2px_rgba(61,50,41,.04)]">
      {/* 宠物与客户 */}
      <div className="flex items-center gap-3 border-b border-[rgba(74,59,46,.06)] px-[17px] py-4">
        <PetAvatar url={pet.avatarUrl} name={pet.name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-body-sm font-extrabold text-ink">{pet.name}</span>
            {row.overdue ? (
              <span className="u3-st red">应退未退</span>
            ) : (
              <span className="u3-st live">在店</span>
            )}
          </div>
          <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
            {SPECIES_LABEL[pet.species] ?? pet.species}
            {pet.breed ? ` · ${pet.breed}` : ''}
            {pet.weightKg != null ? ` · 档案 ${pet.weightKg}kg` : ''}
          </div>
          <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
            客户：{customer.nickname ?? '—'}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[17px] py-3">
        {/* 入住信息 */}
        <div className="mb-1 flex items-center gap-1.5 text-caption-xs font-semibold text-[rgba(74,59,46,.62)]">
          <DoorOpen size={14} strokeWidth={1.5} />
          入住信息
        </div>
        <InfoRow label="房间号" value={stay.roomNo ?? '未排房'} />
        <InfoRow label="入住日期" value={fmtDate(stay.createdAt)} />
        <InfoRow label="预计退房" value={fmtDateTime(appointment.scheduledEnd)} danger={row.overdue} />
        <InfoRow label="预约开始" value={fmtDateTime(appointment.scheduledStart)} />
        <InfoRow
          label="入住称重"
          value={stay.checkinWeightKg != null ? `${stay.checkinWeightKg} kg` : '未称重'}
        />

        {/* 物品清单 */}
        <div className="mb-1 mt-3 flex items-center gap-1.5 text-caption-xs font-semibold text-[rgba(74,59,46,.62)]">
          <Luggage size={14} strokeWidth={1.5} />
          随身物品
        </div>
        {stay.belongings && stay.belongings.length > 0 ? (
          <ul className="space-y-1">
            {stay.belongings.map((b, i) => (
              <li key={i} className="flex items-baseline justify-between text-caption">
                <span className="font-semibold text-ink">{b.name}</span>
                {b.note ? <span className="text-[rgba(74,59,46,.42)]">{b.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-caption-xs text-[rgba(74,59,46,.42)]">无登记物品</p>
        )}

        {/* 每日打卡（明细为服务端缺口，见文件头注释） */}
        <div className="mb-1 mt-3 flex items-center gap-1.5 text-caption-xs font-semibold text-[rgba(74,59,46,.62)]">
          <ClipboardList size={14} strokeWidth={1.5} />
          每日打卡
        </div>
        <InfoRow label="最近打卡" value={fmtIsoDate(row.lastLogDate)} />
        <p className="mt-1 rounded-control bg-canvas px-3 py-2 text-caption-xs text-[rgba(74,59,46,.42)]">
          打卡明细（喂食 / 遛弯 / 照片墙）的商家查看接口待服务端补齐（v2）；
          目前明细可在员工端寄养打卡页查看。
        </p>

        {/* 称重记录（入住称重之上无更多历史，保持简洁） */}
        {stay.checkinWeightKg != null ? (
          <p className="mt-2 flex items-center gap-1 text-caption-xs text-[rgba(74,59,46,.42)]">
            <Scale size={12} strokeWidth={1.5} />
            入住称重为登记时一次性记录
          </p>
        ) : null}
      </div>

      {/* 结算区（商家端不办退房，钮恒禁用；收款仍由财务页 markPaid 完成） */}
      <div className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
            应收金额 · {PAYMENT_MODE_LABEL[appointment.paymentMode ?? ''] ?? '未记录'}
          </span>
          <span className="font-number text-title font-extrabold tabular-nums text-ink" style={numStyle}>
            {fmtMoney(appointment.priceFen)}
          </span>
        </div>
        <button
          type="button"
          disabled
          title="退房核销由员工办理"
          className="w-full cursor-not-allowed rounded-control bg-[rgba(74,59,46,.06)] px-4 py-2.5 text-caption font-semibold text-[rgba(74,59,46,.42)]"
        >
          退房结算
        </button>
        <p className="mt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
          退房核销由员工在员工端办理（v1.1 起）；员工退房后本单转入「已完成」，
          {appointment.paymentMode === 'pay_at_store' ? '到店付请到财务页「待收款」确认收款。' : '款项以店内结算为准。'}
        </p>
      </div>
    </div>
  );
}
