/**
 * Skeleton · 骨架屏成件（换皮批片 5「同型归并」；B 块底座）
 *
 * 归并出处：三端散落的 animate-pulse 占位块（merchant 端现用 rgba(59,46,36,.06)≈sunken，
 * 归并即统一为 bg-sunken token）。
 * Skeleton 基础块 / ListSkeleton 列表型（圆条递减宽）/ BoardSkeleton 看板型（卡片网格占位）。
 */

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-sunken ${className}`} />;
}

export interface ListSkeletonProps {
  /** 行数，默认 3。 */
  rows?: number;
  className?: string;
}

const LIST_ROW_WIDTHS = ['w-full', 'w-5/6', 'w-2/3'] as const;

export function ListSkeleton({ rows = 3, className = '' }: ListSkeletonProps) {
  return (
    <div aria-hidden className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${LIST_ROW_WIDTHS[i % LIST_ROW_WIDTHS.length]}`} />
      ))}
    </div>
  );
}

export interface BoardSkeletonProps {
  /** 占位卡片数，默认 4。 */
  cards?: number;
  className?: string;
}

export function BoardSkeleton({ cards = 4, className = '' }: BoardSkeletonProps) {
  return (
    <div aria-hidden className={`grid grid-cols-2 gap-3 ${className}`}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-card bg-card p-3 shadow-card">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
