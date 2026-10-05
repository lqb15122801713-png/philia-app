/**
 * U3 任务 A · MainScaffold 主区骨架（规格书 §0）
 *
 * 顶行（标题 20/700 serif 页面题点缀（v2.0 §八 serif 退为页面题）+
 * 副行 11/400 + 右动作区：搜索=纸面细线 14 圆角、主行动=淡黄点睛钮
 * （bg-brand-primary=#F2DFA6，每屏至多一处））+ 内容区。
 * 桌面档：主区内边距收紧至 16~18（§八 间距收紧一档），圆角 20/14/6，深度=ring+近零影；
 * 触件 ≥44（钮/搜索 py-3.5 达 44）。
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
      className="rounded-control bg-brand-primary px-4 py-3.5 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
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
      className="u1-ring rounded-control bg-card px-4 py-3.5 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
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
      className="u1-ring w-56 rounded-control bg-card px-3.5 py-3.5 text-caption text-ink placeholder:text-[rgba(59,46,36,.42)] focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
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
    <div className="px-[18px] pb-6 pt-[16px]" data-testid={testid}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif-cn text-title-lg font-bold leading-7">{title}</h1>
          {sub ? <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">{sub}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
