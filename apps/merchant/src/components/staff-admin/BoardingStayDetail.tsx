/**
 * 寄养详情面板（T4.3 · BoardingPage 右侧栏 / 手机选中展开）
 *
 * 内容：宠物与客户、入住信息（房间/称重/物品清单/日期）、最近打卡、结算区。
 *
 * 已知服务端缺口：每日打卡明细（日期/喂食/遛弯/照片）对 merchant 无查询接口——
 * boarding.stayBoard 仅回 lastLogDate；myStay 是 customerProcedure、stayForStaff
 * 是 staffProcedure，商家均不可调。故「每日打卡历史」暂展示最近打卡日期 +
 * 缺口说明，待服务端补 merchant 视角接口（v2）后接入 PhotoWall 时间线。
 */

import { DoorOpen, Scale, Luggage, ClipboardList } from 'lucide-react';
import { fmtDate, fmtDateTime, fmtIsoDate, fmtMoney } from './format';
import { PetAvatar } from './BoardingStayCard';
import { PAYMENT_MODE_LABEL, SPECIES_LABEL, type StayBoardRow } from './types';
import { Badge, Btn, numStyle } from './ui';

function InfoRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-caption text-ink-placeholder">{label}</span>
      <span
        className={`text-body ${danger ? 'font-medium text-danger-deep' : 'text-ink'}`}
        style={numStyle}
      >
        {value}
      </span>
    </div>
  );
}

export default function BoardingStayDetail({
  row,
  onCheckout,
}: {
  row: StayBoardRow;
  onCheckout: () => void;
}) {
  const { stay, appointment, pet, customer } = row;
  return (
    <div className="flex h-full flex-col rounded-card bg-card shadow-card">
      {/* 宠物与客户 */}
      <div className="flex items-center gap-3 border-b border-line-divider px-4 py-4">
        <PetAvatar url={pet.avatarUrl} name={pet.name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-title font-semibold text-ink">{pet.name}</span>
            {row.overdue ? <Badge tone="danger">已超期</Badge> : <Badge tone="success">在店</Badge>}
          </div>
          <div className="mt-0.5 text-caption text-ink-secondary">
            {SPECIES_LABEL[pet.species] ?? pet.species}
            {pet.breed ? ` · ${pet.breed}` : ''}
            {pet.weightKg != null ? ` · 档案 ${pet.weightKg}kg` : ''}
          </div>
          <div className="mt-0.5 text-caption text-ink-secondary">
            客户：{customer.nickname ?? '—'}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* 入住信息 */}
        <div className="mb-1 flex items-center gap-1.5 text-caption font-medium text-ink-secondary">
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
        <div className="mb-1 mt-3 flex items-center gap-1.5 text-caption font-medium text-ink-secondary">
          <Luggage size={14} strokeWidth={1.5} />
          随身物品
        </div>
        {stay.belongings && stay.belongings.length > 0 ? (
          <ul className="space-y-1">
            {stay.belongings.map((b, i) => (
              <li key={i} className="flex items-baseline justify-between text-body">
                <span className="text-ink">{b.name}</span>
                {b.note ? <span className="text-caption text-ink-placeholder">{b.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-caption text-ink-placeholder">无登记物品</p>
        )}

        {/* 每日打卡（明细为服务端缺口，见文件头注释） */}
        <div className="mb-1 mt-3 flex items-center gap-1.5 text-caption font-medium text-ink-secondary">
          <ClipboardList size={14} strokeWidth={1.5} />
          每日打卡
        </div>
        <InfoRow label="最近打卡" value={fmtIsoDate(row.lastLogDate)} />
        <p className="mt-1 rounded-input bg-sunken px-3 py-2 text-caption text-ink-placeholder">
          打卡明细（喂食 / 遛弯 / 照片墙）的商家查看接口待服务端补齐（v2）；
          目前明细可在员工端寄养打卡页查看。
        </p>

        {/* 称重记录（入住称重之上无更多历史，保持简洁） */}
        {stay.checkinWeightKg != null ? (
          <p className="mt-2 flex items-center gap-1 text-caption text-ink-placeholder">
            <Scale size={12} strokeWidth={1.5} />
            入住称重为登记时一次性记录
          </p>
        ) : null}
      </div>

      {/* 结算区 */}
      <div className="border-t border-line-divider px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-caption text-ink-secondary">
            应收金额 · {PAYMENT_MODE_LABEL[appointment.paymentMode ?? ''] ?? '未记录'}
          </span>
          <span className="text-price font-semibold text-ink" style={numStyle}>
            {fmtMoney(appointment.priceFen)}
          </span>
        </div>
        <Btn variant="primary" className="w-full" onClick={onCheckout}>
          退房结算
        </Btn>
      </div>
    </div>
  );
}
