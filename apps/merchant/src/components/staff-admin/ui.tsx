/**
 * staff-admin 轻量 UI 基件（T4.3）
 *
 * 为什么不用 shadcn ui/ 与 sonner：商家端壳（providers / App / Toaster 挂载）
 * 由 T4.1 并行开发，本目录组件必须自洽可用、零跨代理依赖——故按 DESIGN.md
 * 品牌 token（preset 类名）自绘按钮 / 弹层 / 开关 / 徽章 / 迷你 toast。
 * T4.1 落地全局 Toaster 后，可一键把本模块的 toast 调用替换为 sonner。
 *
 * 用色纪律（DESIGN.md §7 商家端）：品牌色只给关键操作与状态；无呼吸光环；
 * 仅 hover / 状态过渡（160–200ms ease-out）。
 */

import { X } from 'lucide-react';
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------ */
/* 按钮                                                                */
/* ------------------------------------------------------------------ */

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'subtle';
type BtnSize = 'sm' | 'md';

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50';
const btnVariant: Record<BtnVariant, string> = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-pressed',
  ghost: 'border border-line-strong bg-card text-ink hover:bg-sunken',
  danger: 'bg-danger text-white hover:bg-danger-deep',
  subtle: 'text-brand-primary hover:bg-brand-primary-light',
};
const btnSize: Record<BtnSize, string> = {
  sm: 'px-3 py-1.5 text-caption',
  md: 'px-4 py-2 text-body',
};

export function Btn({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      type="button"
      className={`${btnBase} ${btnVariant[variant]} ${btnSize[size]} ${className}`}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* 表单                                                                */
/* ------------------------------------------------------------------ */

export const inputCls =
  'w-full rounded-input border border-line bg-card px-3 py-2 text-body text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption text-ink-secondary">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-caption text-ink-placeholder">{hint}</span> : null}
    </label>
  );
}

/** 开关（1.5px 线性风格之外的少数实心元素，语义为状态切换） */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${
        checked ? 'bg-brand-primary' : 'bg-line-strong'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-card transition-transform duration-150 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 徽章 / 标签 chips                                                    */
/* ------------------------------------------------------------------ */

type BadgeTone = 'brand' | 'success' | 'danger' | 'muted';
const badgeTone: Record<BadgeTone, string> = {
  brand: 'bg-brand-primary-light text-brand-primary-pressed',
  success: 'bg-success-light text-success-deep',
  danger: 'bg-danger-light text-danger-deep',
  muted: 'bg-sunken text-ink-secondary',
};

export function Badge({ tone = 'muted', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-tag px-2 py-0.5 text-caption ${badgeTone[tone]}`}>
      {children}
    </span>
  );
}

/** 技能标签 chip（只读展示用） */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-tag bg-brand-secondary-light px-2 py-0.5 text-caption text-ink">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 弹层（居中 Modal，平板/手机通用）                                     */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}) {
  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[85vh] w-full ${widthClass} flex-col overflow-hidden rounded-card bg-card shadow-elevated`}
      >
        <div className="flex items-center justify-between border-b border-line-divider px-5 py-4">
          <h3 className="text-title font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1 text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line-divider px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* 迷你 toast（自洽实现；T4.1 全局 Toaster 落地后可替换）                 */
/* ------------------------------------------------------------------ */

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

const toastListeners = new Set<(t: ToastItem) => void>();
let toastSeq = 1;

/** 触发一条 toast（成功/失败/信息）；失败请传服务端原文 */
export function toast(text: string, kind: ToastKind = 'success') {
  const item: ToastItem = { id: toastSeq++, kind, text };
  toastListeners.forEach((l) => l(item));
}

const toastKindCls: Record<ToastKind, string> = {
  success: 'bg-success-light text-success-deep',
  error: 'bg-danger-light text-danger-deep',
  info: 'bg-brand-primary-light text-ink',
};

/** toast 挂载点：每个页面顶层渲染一次（同一时刻仅一个页面可见，不会重复） */
export function ToasterMount() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const listener = (t: ToastItem) => {
      setItems((xs) => [...xs, t]);
      window.setTimeout(() => setItems((xs) => xs.filter((i) => i.id !== t.id)), 3600);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-72 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-input px-3 py-2 text-body shadow-elevated ${toastKindCls[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* 状态占位                                                            */
/* ------------------------------------------------------------------ */

export function Loading({ text = '加载中…' }: { text?: string }) {
  return <div className="py-12 text-center text-body text-ink-placeholder">{text}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-card bg-card py-12 text-center shadow-card">
      <div className="text-body text-ink-secondary">{title}</div>
      {hint ? <div className="mt-1 text-caption text-ink-placeholder">{hint}</div> : null}
    </div>
  );
}

/** 金额等宽数字（DESIGN.md：价格用 tabular-nums 纵向对齐） */
export const numStyle = { fontVariantNumeric: 'tabular-nums' } as const;
