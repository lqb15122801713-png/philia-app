/**
 * PageHeader · 详情级统一返回条（换皮批片 5「同型归并」）
 *
 * 归并出处：
 * - apps/customer/src/components/PageHeader.tsx（基准：right slot、W1-D3 直访兜底契约）
 * - apps/staff/src/components/PageHeader.tsx（aside→right 归一、serif 页题）
 * 端内 CSS 类不落共享件：u1-ring → ring-1 ring-line-ring + shadow-hairline（1px 暖墨细线
 * ring + 近零软影，同义 token）；u1-serif → font-display（preset serif 轨）。
 *
 * 返回行为契约：
 * - to 给了 = navigate(to)（固定目标，仅交易成功页类明示场景）；
 * - 没给 = navigate(-1) 时间序回退；
 * - 仅当传了 fallback 时，history.state.idx===0（直访/刷新到栈底）兜底跳 fallback
 *   （customer 契约）；不传 fallback 则行为与 staff 版一致（始终 navigate(-1)）。
 */

import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface BackButtonProps {
  /** 明示固定返回目标（与浏览器/系统后退手势不冲突）。 */
  to?: string;
  /** 直访/刷新到栈底（idx===0）时的兜底父页；未传不启用兜底。 */
  fallback?: string;
  ariaLabel?: string;
  className?: string;
}

export function BackButton({ to, fallback, ariaLabel = '返回', className = '' }: BackButtonProps) {
  const navigate = useNavigate();
  const onBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      if (to) navigate(to);
      else navigate(-1);
    } else if (to) {
      navigate(to);
    } else if (fallback) {
      navigate(fallback);
    } else {
      navigate(-1);
    }
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid="page-back"
      onClick={onBack}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card shadow-hairline ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92 ${className}`}
    >
      <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={1.5} />
    </button>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  /** 固定返回目标；缺省 navigate(-1)。 */
  to?: string;
  /** 直访兜底父页（仅传入时启用 idx===0 兜底）。 */
  fallback?: string;
  /** 右侧 slot（状态 pill / 摘要 / 安静文字链；staff 版 aside 归一为此）。 */
  right?: ReactNode;
  /** true 时页题走 serif 展示轨（font-display + font-bold）。 */
  serif?: boolean;
  className?: string;
}

export default function PageHeader({
  title,
  to,
  fallback,
  right,
  serif = false,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`flex items-center gap-3 ${className}`}>
      <BackButton to={to} fallback={fallback} />
      <h1 className={`text-title-lg ${serif ? 'font-display font-bold' : ''}`}>{title}</h1>
      {right ? <span className="ml-auto flex items-center gap-2">{right}</span> : null}
    </header>
  );
}
