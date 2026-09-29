/**
 * 暖色确认弹层（T5.3）：跨店加车清空确认、确认收货等破坏性/关键操作二次确认。
 * 底部动作面板，z-modal 盖过 TabBar。
 * 换皮批片 2：补齐 §4.5 弹层三件套——抓握手柄 grab 42×4 + 可点遮罩（既有）+ 滚动锁；
 * 顶角 26（§4.5 实证）；确认钮前景入 token 纪律（淡黄底配深棕墨 / 赭红底配深底主文字
 * #F6EFDD，淡黄底纯白字对比不达标已修）。
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export default function ConfirmSheet({
  open,
  title,
  desc,
  confirmText = '确认',
  cancelText = '再想想',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  desc?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  /* 滚动锁：弹层开时锁底层 body（§4.5 三件套） */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-ink/40"
        onClick={onCancel}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[26px] bg-card p-5 pb-8 shadow-elevated">
        {/* 抓握手柄 grab 42×4（§4.5） */}
        <div className="mx-auto mb-4 h-1 w-[42px] rounded-full bg-line" aria-hidden="true" />
        <p className="text-title">{title}</p>
        {desc ? <div className="mt-2 text-body text-ink-secondary">{desc}</div> : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-full bg-sunken text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-11 flex-1 rounded-full text-body font-medium transition-transform duration-120 ease-philia-spring active:scale-92 ${
              danger ? 'bg-danger text-[#F6EFDD]' : 'bg-brand-primary text-ink'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
