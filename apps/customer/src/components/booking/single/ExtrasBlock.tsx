/**
 * B4-1 单屏 · 折叠区区块（收款方式 + 添加备注，默认收起）：
 * - 收款：单行选择器「收款：到店付 ▾ / 次卡扣次 · 余 N 次 ▾」，点开两行单选；
 *   有可用次卡默认次卡（页面预填），无卡置灰提示沿用 B2-7 文案；
 * - 添加备注 ▸：展开 textarea（主流程零打字，默认收起）；
 * - U1-D：指定洗护师迁出折叠区，由 GroomingSinglePage 独立「洗护师」横卡区渲染
 *   （v9.1 美容师横卡：置顶「随缘派单」默认卡 + 横滑员工卡），本组件不再含 staff。
 */

import { useState } from 'react';
import { PAYMENT_MODE_META } from '../format';

type PaymentMode = 'pay_at_store' | 'pass_deduct';

interface PassInfo {
  remainTimes: number;
}

function ChevronRow({
  label,
  summary,
  open,
  onToggle,
  testId,
}: {
  label: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={testId}
      className="flex w-full items-center justify-between py-3 text-left"
    >
      <span className="text-body text-ink-secondary">{label}</span>
      <span className="ml-3 truncate text-body font-medium">
        {summary} <span className="text-ink-placeholder">{open ? '▾' : '▸'}</span>
      </span>
    </button>
  );
}

export default function ExtrasBlock({
  paymentMode,
  onPaymentModeChange,
  usablePass,
  passLoading,
  note,
  onNoteChange,
}: {
  paymentMode: PaymentMode;
  onPaymentModeChange: (m: PaymentMode) => void;
  usablePass: PassInfo | null;
  passLoading: boolean;
  note: string;
  onNoteChange: (v: string) => void;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const paySummary =
    paymentMode === 'pass_deduct' && usablePass
      ? `次卡扣次 · 余 ${usablePass.remainTimes} 次`
      : PAYMENT_MODE_META[paymentMode].label;

  return (
    <div data-testid="gs-extras">
      {/* 收款方式（单行选择器） */}
      <ChevronRow
        label="收款"
        summary={paySummary}
        open={payOpen}
        onToggle={() => setPayOpen((v) => !v)}
        testId="gs-payment-toggle"
      />
      {payOpen ? (
        <div className="space-y-2 pb-3" data-testid="gs-payment-options">
          {(['pay_at_store', 'pass_deduct'] as const).map((m) => {
            const active = paymentMode === m;
            // B2-7（W-6）：次卡扣次需可用次卡；无卡/余额不足/过期 → 置灰 + 明确提示
            const passDisabled = m === 'pass_deduct' && !passLoading && !usablePass;
            const hint =
              m === 'pass_deduct'
                ? passLoading
                  ? '正在查询次卡余额…'
                  : usablePass
                    ? `剩余 ${usablePass.remainTimes} 次 · 预约确认后扣 1 次`
                    : '暂无可用次卡'
                : PAYMENT_MODE_META[m].hint;
            return (
              <button
                key={m}
                type="button"
                disabled={passDisabled}
                onClick={() => onPaymentModeChange(m)}
                data-testid={`gs-payment-${m}`}
                data-disabled={passDisabled ? 'true' : 'false'}
                className={`flex w-full items-center justify-between rounded-control border p-3 text-left transition active:scale-[0.99] ${
                  active ? 'border-[1.5px] border-ink' : 'border-line'
                } ${passDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span>
                  <span className="block text-body font-semibold">{PAYMENT_MODE_META[m].label}</span>
                  <span className="mt-0.5 block text-caption text-ink-secondary">{hint}</span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    active ? 'bg-ink' : 'border-[1.5px] border-line-strong'
                  }`}
                >
                  {active ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="border-t border-[rgba(74,59,46,.09)]" />

      {/* 添加备注（默认收起） */}
      <ChevronRow
        label="备注"
        summary={note.trim() ? note.trim().slice(0, 12) + (note.trim().length > 12 ? '…' : '') : '添加备注'}
        open={noteOpen}
        onToggle={() => setNoteOpen((v) => !v)}
        testId="gs-note-toggle"
      />
      {noteOpen ? (
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="毛孩子的注意事项，如怕水、需剃脚底毛…"
          data-testid="gs-note-input"
          className="mb-3 w-full rounded-control border border-line bg-canvas px-3.5 py-3 text-body placeholder:text-ink-placeholder focus:border-ink focus:outline-none"
        />
      ) : null}
    </div>
  );
}
