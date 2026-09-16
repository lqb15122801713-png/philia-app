/**
 * B9a 任务 B · 首页主区服务中面板（有进行中洗护预约时替换常态一键再约面板）。
 *
 * 内容（任务书口径）：当前步骤名 + 第 N 步/共 6 步 + 细线进度条 +
 * 最新员工照片缩略（复用 serviceStep.list 的未失效照片 + thumbUrl 缩略，不新增接口）
 * +「查看实时直播 ›」（进 /appointments/:id/live 直播页）。
 *
 * 数据与实时：步骤/照片来自 serviceStep.list（queryKey ['serviceStep','list',aid]，
 * 与直播页同源）；SSE 事件到达由 HomeBookingPanel 统一 invalidate 该 query（见容器头注）。
 *
 * 视觉同 v3 减法：hairline 分隔、缩略图 rounded-tag(8)、无 accent 色块
 * （直播入口为文字链接；全屏唯一 accent 留给常态面板 CTA / 本面板无 CTA）。
 * B9.3：面板本体按试样带一层软阴影（shadow-card），去描边。
 */

import { Link } from 'react-router-dom';

export interface InServicePanelProps {
  appointmentId: string;
  petName: string;
  /** 当前步骤展示名（如「洗澡美容」；步骤数据未就绪为 null） */
  stepName: string | null;
  /** 当前 active 步序（1-6；未就绪为 null） */
  stepOrder: number | null;
  /** 总步数（六步流恒 6） */
  totalSteps: number;
  /** 已完成步数（进度条口径：done/totalSteps） */
  doneCount: number;
  /** 最新员工照片缩略（takenAt 新→旧，最多 3 张） */
  photos: { id: string; thumbUrl: string }[];
}

export default function InServicePanel({
  appointmentId,
  petName,
  stepName,
  stepOrder,
  totalSteps,
  doneCount,
  photos,
}: InServicePanelProps) {
  const pct = Math.round((doneCount / totalSteps) * 100);

  return (
    <section
      data-testid="home-inservice-panel"
      className="rounded-card bg-card p-4 shadow-card"
      aria-label="服务进行中"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-ink-secondary">{petName} · 服务进行中</p>
          <h2 className="mt-0.5 text-title" data-testid="home-inservice-step">
            {stepName ?? '服务准备中'}
          </h2>
          <p className="mt-0.5 text-caption text-ink-secondary font-number">
            {stepOrder !== null ? `第 ${stepOrder} 步 / 共 ${totalSteps} 步` : `共 ${totalSteps} 步`}
          </p>
        </div>

        {/* 最新员工照片缩略（最多 3 张，新→旧；点击进直播页看原图） */}
        {photos.length > 0 ? (
          <Link
            to={`/appointments/${appointmentId}/live`}
            className="flex shrink-0 gap-1.5"
            data-testid="home-inservice-photos"
            aria-label="查看最新服务照片"
          >
            {photos.map((p) => (
              <img
                key={p.id}
                src={p.thumbUrl}
                alt="服务照片"
                loading="lazy"
                className="h-12 w-12 rounded-tag bg-sunken object-cover"
              />
            ))}
          </Link>
        ) : null}
      </div>

      {/* 细线进度条（已完成步数 / 共 6 步） */}
      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={doneCount}
        data-testid="home-inservice-progress"
        data-step-order={stepOrder ?? ''}
        data-done-count={doneCount}
      >
        <div
          className="h-full rounded-full bg-brand-primary transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex justify-end border-t border-[rgba(74,59,46,.09)] pt-3">
        <Link
          to={`/appointments/${appointmentId}/live`}
          data-testid="home-inservice-live"
          className="text-caption font-medium text-brand-primary"
        >
          查看实时直播 ›
        </Link>
      </div>
    </section>
  );
}
