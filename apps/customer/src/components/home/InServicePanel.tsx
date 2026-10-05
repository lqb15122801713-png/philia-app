/**
 * B9a 任务 B · 首页主区服务中面板（有进行中洗护预约时替换常态一键再约面板）。
 *
 * U4-B 密度补齐（批次 U4 任务书，对照试样 03 屏 .instore2 逐格）：
 * 1. r1 标题行：「{宠物} · 洗护中」（衬线展示位）+ SSE 真值状态点——
 *    connected 绿点「实时同步」/ 断线灰点「重连中」（useEventSource connected
 *    真值上行，不许常亮造假）；
 * 2. 进度条：2px 暖墨轨道 + 柠檬实底填充至「第 N/6 步」（active 步序优先，
 *    无 active 回退已完成步数；线上空白细线不可读已修）；
 * 3. r2 信息行：第 N / 6 步 · 步骤名 · 员工名（store.listStaffPublic 现成接口
 *    解析 staffId，零新接口）· 预计 HH:MM 完成（scheduledEnd 真字段）——
 *    任一段无真值即整段隐去，不造假；
 * 4. r3 过程照片缩略列：最近 3 张（56×42 圆角 6，U4 任务书口径；试样 46×32
 *    以任务书为准），无照片不渲染缩略列；「查看全程 ›」跳现行直播路由
 *    /appointments/:id/live（任务书所写 /booking/journey 非现行路由，按
 *    「现行路由口径不变」维持）。
 *
 * 数据与实时：步骤/照片来自 serviceStep.list（queryKey ['serviceStep','list',aid]，
 * 与直播页同源）；SSE 事件到达由 HomeBookingPanel 统一 invalidate 该 query。
 */

import { Link } from 'react-router-dom';
import { fmtHM } from '@/components/booking/format';

export interface InServicePanelProps {
  appointmentId: string;
  petName: string;
  /** 当前步骤展示名（如「深层清洁」；步骤数据未就绪为 null） */
  stepName: string | null;
  /** 当前 active 步序（1-6；未就绪为 null） */
  stepOrder: number | null;
  /** 总步数（六步流恒 6） */
  totalSteps: number;
  /** 已完成步数（无 active 步时的进度条回退口径） */
  doneCount: number;
  /** 最新员工照片缩略（takenAt 新→旧，最多 3 张） */
  photos: { id: string; thumbUrl: string }[];
  /** SSE 连接真值（绿点「实时同步」/ 灰点「重连中」） */
  sseConnected: boolean;
  /** 指派员工名（listStaffPublic 解析；未指派/未解析为 null → 段隐去） */
  staffName: string | null;
  /** 预计完成时刻（appointments.scheduledEnd 真字段；null → 段隐去） */
  etaEnd: Date | null;
}

export default function InServicePanel({
  appointmentId,
  petName,
  stepName,
  stepOrder,
  totalSteps,
  doneCount,
  photos,
  sseConnected,
  staffName,
  etaEnd,
}: InServicePanelProps) {
  // 进度：可视「第 N/6 步」——active 步序优先，无 active（待开工/已完结间隙）回退已完成数
  const progressStep = stepOrder ?? doneCount;
  const pct = Math.round((progressStep / totalSteps) * 100);

  return (
    <section
      data-testid="home-inservice-panel"
      className="u1-card p-4"
      aria-label="服务进行中"
    >
      {/* r1：标题 + SSE 真值状态点 */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="u1-serif text-title" data-testid="home-inservice-step">
          {petName} · 洗护中
        </h2>
        <span
          data-testid="home-inservice-sync"
          data-connected={sseConnected}
          className="flex shrink-0 items-center gap-[5px] text-caption-xs leading-4 text-ink-secondary"
        >
          <i
            className={`h-1.5 w-1.5 rounded-full ${sseConnected ? 'bg-brand-secondary' : 'bg-ink/30'}`}
            aria-hidden="true"
          />
          {sseConnected ? '实时同步' : '重连中'}
        </span>
      </div>

      {/* 进度条：2px 暖墨轨道 + 柠檬实底填充第 N/6 步（role=progressbar 保留） */}
      <div
        className="mb-[9px] mt-3 h-0.5 w-full overflow-hidden rounded-full bg-line-ring"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={progressStep}
        data-testid="home-inservice-progress"
        data-step-order={stepOrder ?? ''}
        data-done-count={doneCount}
      >
        <div
          className="h-full rounded-full bg-brand-primary transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* r2：第 N / 6 步 · 步骤名 · 员工 · 预计完成（缺真值的段整段隐去） */}
      <p className="text-caption-xs leading-4 text-ink-secondary">
        {stepOrder !== null ? (
          <>
            第{' '}
            <b className="u1-num font-semibold text-ink">
              {stepOrder} / {totalSteps}
            </b>{' '}
            步
          </>
        ) : (
          <>共 {totalSteps} 步 · 等待开工</>
        )}
        {stepName ? ` · ${stepName}` : ''}
        {staffName ? ` · ${staffName}` : ''}
        {etaEnd ? (
          <>
            {' '}
            · 预计 <b className="u1-num font-semibold text-ink">{fmtHM(new Date(etaEnd))}</b> 完成
          </>
        ) : null}
      </p>

      {/* r3：过程照片缩略列（56×42 圆角 6，最多 3 张新→旧；无照片不渲染缩略列）
          + 查看全程 ›（现行直播路由不变） */}
      <div className="mt-[11px] flex items-center gap-1.5">
        {photos.length > 0
          ? photos.map((p) => (
              <img
                key={p.id}
                src={p.thumbUrl}
                alt="服务照片"
                loading="lazy"
                data-testid="home-inservice-photos"
                className="h-[42px] w-14 rounded-chip bg-sunken object-cover"
              />
            ))
          : null}
        <Link
          to={`/appointments/${appointmentId}/live`}
          data-testid="home-inservice-live"
          className="ml-auto shrink-0 text-caption-xs font-bold leading-4 text-ink"
        >
          查看全程 ›
        </Link>
      </div>
    </section>
  );
}
