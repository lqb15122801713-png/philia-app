/**
 * 寄养退房结算确认弹层（T4.3 · BoardingPage）
 *
 * 确认信息：应收金额 = 预约快照价（appointment.price_fen）；
 * 提交 → boarding.checkout（幂等：已退房返回 alreadyCompleted）。
 * 到店付（pay_at_store）单额外提示：退房后请在财务页「待收款」确认收款
 * （口径见开发方案 §3.3：寄养在退房核销时由商家端 markPaid 收款）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useState } from 'react';
import { errMsg, fmtDateTime, fmtMoney } from './format';
import { PAYMENT_MODE_LABEL, type StayBoardRow } from './types';
import { Btn, Modal, numStyle, toast } from './ui';

export default function CheckoutDialog({
  row,
  open,
  onClose,
  onCheckedOut,
}: {
  row: StayBoardRow | null;
  open: boolean;
  onClose: () => void;
  onCheckedOut: () => void;
}) {
  const { trpc } = usePhiliaClient();
  const [pending, setPending] = useState(false);

  if (!row) return null;
  const { appointment, pet } = row;
  const payAtStore = appointment.paymentMode === 'pay_at_store';

  const confirm = async () => {
    setPending(true);
    try {
      const r = await trpc.boarding.checkout.mutate({ appointmentId: appointment.id });
      if (r.alreadyCompleted) {
        toast(`「${pet.name}」此前已办理过退房`, 'info');
      } else {
        toast(`「${pet.name}」已退房结算`);
      }
      if (payAtStore) {
        toast('本单为到店付：请在财务页「待收款」确认收款', 'info');
      }
      onCheckedOut();
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="退房结算确认"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            再想想
          </Btn>
          <Btn variant="primary" onClick={() => void confirm()} disabled={pending}>
            {pending ? '结算中…' : '确认退房'}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-card bg-sunken px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-body text-ink-secondary">应收金额（预约快照价）</span>
            <span className="text-price font-semibold text-ink" style={numStyle}>
              {fmtMoney(appointment.priceFen)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-caption text-ink-secondary">
            <span>收款方式</span>
            <span>{PAYMENT_MODE_LABEL[appointment.paymentMode ?? ''] ?? '未记录'}</span>
          </div>
        </div>
        <div className="space-y-1 text-caption text-ink-secondary" style={numStyle}>
          <p>宠物：{pet.name}（核销码 {appointment.code}）</p>
          <p>预计退房：{fmtDateTime(appointment.scheduledEnd)}</p>
        </div>
        {row.overdue ? (
          <p className="text-caption text-danger-deep">本单已超期，请与客户确认续住或按约结算。</p>
        ) : null}
        {payAtStore ? (
          <p className="rounded-input bg-brand-primary-light px-3 py-2 text-caption text-ink">
            本单为到店付：退房后请在财务页「待收款」确认收款，款项才会计入营业额。
          </p>
        ) : null}
        <p className="text-caption text-ink-placeholder">
          确认后预约转为「已完成」，房间立即释放；操作幂等，重复点击不会重复结算。
        </p>
      </div>
    </Modal>
  );
}
