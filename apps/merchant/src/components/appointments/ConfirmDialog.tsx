/**
 * 二次确认弹层（T4.2；U3 任务 E 视觉同批）：关键操作（批准/拒绝取消、打标重拍、
 * 收款登记等）防误触。children 可放附加内容（如打标原因输入框）。
 * API 与 T4.2 一致（监控页打标同用）；按钮换 U3 件：取消=纸面细线、确认=柠檬墨字、
 * danger=功能红 #D92D20 + 纸面字（u3-st.red 同款配对，功能色不占品牌位）。
 */

import { Modal } from './Modal';
import type { ReactNode } from 'react';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmText = '确定',
  cancelText = '再想想',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} widthClass="sm:max-w-md">
      {body ? (
        <p className="text-[12px] leading-relaxed text-[rgba(74,59,46,.62)]">{body}</p>
      ) : null}
      {children}
      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="u1-ring h-11 flex-1 rounded-control bg-card text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`h-11 flex-1 rounded-control text-body-sm font-bold transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50 ${
            danger ? 'bg-[#D92D20] text-[#FFFDF6]' : 'bg-brand-primary text-ink'
          }`}
        >
          {loading ? '处理中…' : confirmText}
        </button>
      </div>
    </Modal>
  );
}
