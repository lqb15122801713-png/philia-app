/**
 * U3 任务 A · MainScaffold 主区骨架（规格书 §0）
 *
 * 顶行（标题 20/700（试样所印 19/800 越字阶闸门+超自托管字重上限，U4 映射）+
 * 副行 11/400 + 右动作区：搜索=纸面细线 14 圆角、主行动=柠檬钮——每屏至多一个柠檬钮）+ 内容区。
 * 桌面档：主区内边距 22~26（任务书冻结），圆角 20/14/6，深度=ring+近零影。
 */

import type { ReactNode } from 'react';

export function LemonButton({
  children,
  onClick,
  testid,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  testid?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className="rounded-control bg-brand-primary px-4 py-2.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  onClick,
  testid,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  testid?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className="u1-ring rounded-control bg-card px-4 py-2.5 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SearchInput({
  placeholder,
  value,
  onChange,
  testid,
}: {
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
  testid?: string;
}) {
  return (
    <input
      type="search"
      data-testid={testid}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      className="u1-ring w-56 rounded-control bg-card px-3.5 py-2 text-caption text-ink placeholder:text-[rgba(74,59,46,.42)] focus:outline-none focus:ring-[rgba(74,59,46,.25)]"
    />
  );
}

export default function MainScaffold({
  title,
  sub,
  actions,
  children,
  testid,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  testid?: string;
}) {
  return (
    <div className="px-[26px] pb-8 pt-[22px]" data-testid={testid}>
      <div className="mb-[18px] flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title-lg font-bold leading-7">{title}</h1>
          {sub ? <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">{sub}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
