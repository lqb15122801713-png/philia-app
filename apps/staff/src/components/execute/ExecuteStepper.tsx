/**
 * U2 任务 D · 竖向六步 stepper（员工端 ExecuteStepper；节点三态换皮批片 5 归并共享 StepNode，
 * 连接线/操作区（上传/删除/双槽）保留本地）
 *
 * 规格书 §4 + 试样 .ex-steps（§八 效率密度转译：页边距收紧 18，时刻/张数=mono 轨）：
 * - 连接线 2px 墨 6%；完成步=墨色圆 ✓ + 步名（墨 60%）+ 完成时刻·张数(mono) + 64×48 缩略（点击看大图）；
 * - 当前步=淡金圆序号 + 步名 700 +「已传 X/Y 张·还差 N 张可确认」(mono) + 奶油底操作区
 *   （已传缩略 +「＋拍照/相册」虚线槽 64×48 + 提示「过程照实时同步给家长」）；
 * - 前后对比步（第 5 步）before/after 双槽并排（各 ≥1 强校验——张数口径由页面按钮链与服务端双重保证）；
 * - 未到步 45% 透明；打标重拍步带红旗签。
 * 工艺：字阶 12/14 档（PD-44 U5：11px 档全抬 12）；圆角缩略 6/操作区 14；按下 scale 0.92 duration-120 ease-philia-spring；
 * 角标/虚线色走 .sk 变量（var(--ink)/var(--paper)/var(--hairline)）。
 */

import { useRef } from 'react';
import { Flag } from 'lucide-react';
import { StepNode, type ServiceStepDef } from '@philia/shared';
import { STEP_NAME } from '../today/deck/deckUtils';
import { EXECUTE_COPY } from '@/copy/execute';

export interface StepPhotoItem {
  key: string;
  url: string;
  uploading?: boolean;
  tagLabel?: string;
  /** 服务端照片 id（active 步可删） */
  serverId?: string;
  /** PD-76 状态机：本地队列记录 id（拒收态重试/重拍用） */
  queueId?: string;
  /** PD-76 状态机 rejected：服务端拒收原因原文（非空即拒收态，缩略图标红＋单处显示） */
  rejectedReason?: string;
}

export interface ExecuteStepRow {
  def: ServiceStepDef;
  status: 'locked' | 'active' | 'done';
  flagged: boolean;
  doneAt: Date | null;
  photos: StepPhotoItem[];
  /** before_after 双槽（服务端优先 + 本地队列预览） */
  beforeSlot: StepPhotoItem | null;
  afterSlot: StepPhotoItem | null;
  /** 服务端有效张数（min 校验口径，与 confirmStep 一致） */
  serverCount: number;
  beforeCount: number;
  afterCount: number;
}

const fmtHM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** 缩略图 64×48（点击看大图；active 步服务端照片右上 × 可删；圆角缩略 6/操作区 14，客户端 D2-9 同口径）。
 *  PD-76 状态机单处显示：uploading=「上传中」角标＋脉冲；rejected=红圈＋「未通过」角标
 * （原因与「重拍/重试」钮挂在照片行正下方同区一行，头卡/底钮不再重复状态）。 */
function Thumb({
  photo,
  onTap,
  onDelete,
}: {
  photo: StepPhotoItem;
  onTap: (url: string) => void;
  onDelete?: (serverId: string) => void;
}) {
  const rejected = !!photo.rejectedReason;
  return (
    <span
      className="relative inline-block h-12 w-16 shrink-0 rounded-chip"
      style={rejected ? { boxShadow: '0 0 0 2px var(--danger)' } : undefined}
      data-rejected={rejected || undefined}
    >
      <button
        type="button"
        onClick={() => onTap(photo.url)}
        className="block h-12 w-16 overflow-hidden rounded-chip bg-sunken transition-transform duration-120 ease-philia-spring active:scale-92"
        aria-label={rejected ? `照片未通过：${photo.rejectedReason}` : '查看大图'}
      >
        <img src={photo.url} alt={photo.tagLabel ?? '过程照'} loading="lazy" className={`h-full w-full object-cover ${photo.uploading && !rejected ? 'animate-pulse opacity-80' : ''}`} />
      </button>
      {photo.tagLabel ? (
        <span
          className="pointer-events-none absolute left-0.5 top-0.5 rounded-chip px-1 py-px text-[12px]"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          {photo.tagLabel}
        </span>
      ) : null}
      {photo.uploading && !rejected ? (
        <span
          className="pointer-events-none absolute right-0.5 top-0.5 rounded-chip px-1 py-px text-[12px]"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          上传中
        </span>
      ) : null}
      {rejected ? (
        <span
          className="pointer-events-none absolute right-0.5 top-0.5 rounded-chip px-1 py-px text-[12px]"
          style={{ background: 'var(--danger)', color: 'var(--card)' }}
        >
          未通过
        </span>
      ) : null}
      {onDelete && photo.serverId && !photo.uploading && !rejected ? (
        <button
          type="button"
          aria-label="删除这张照片"
          onClick={() => onDelete(photo.serverId!)}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full transition-transform duration-120 ease-philia-spring active:scale-92"
          style={{ background: 'var(--ink)', color: 'var(--paper)', fontSize: 12 }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

/** PD-76 拒收行（状态机 rejected 态唯一显示位的文字＋动作半）：原因透传＋「重试／重拍」 */
function RejectedLine({
  photo,
  onRetry,
  onDiscard,
}: {
  photo: StepPhotoItem;
  onRetry: (queueId: string) => void;
  onDiscard: (queueId: string) => void;
}) {
  if (!photo.rejectedReason || !photo.queueId) return null;
  const qid = photo.queueId;
  return (
    <div className="mt-1.5 flex items-center gap-2" data-testid={`rejected-${qid}`}>
      <p className="min-w-0 flex-1 text-caption leading-snug text-danger-deep">未通过：{photo.rejectedReason}</p>
      <button
        type="button"
        data-testid={`rejected-retry-${qid}`}
        onClick={() => onRetry(qid)}
        className="shrink-0 rounded-chip bg-ink px-2.5 py-1 text-caption font-bold text-[#F6EFDD] transition-transform duration-120 ease-philia-spring active:scale-92"
      >
        重试
      </button>
      <button
        type="button"
        data-testid={`rejected-discard-${qid}`}
        onClick={() => onDiscard(qid)}
        className="shrink-0 rounded-chip px-2.5 py-1 text-caption font-bold text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
        style={{ border: '1px solid var(--hairline)' }}
      >
        重拍
      </button>
    </div>
  );
}

/** 「＋拍照/相册」虚线槽（64×48；规格书 §4 虚线槽——单层 dashed 边，不再叠 ring 双边） */
function AddSlot({ onFiles, disabled }: { onFiles: (files: FileList) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        data-testid="step-add-photo"
        className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-chip bg-card text-caption leading-tight text-ink-placeholder transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
        style={{ border: '1px dashed var(--hairline)' }}
      >
        <b className="text-title font-normal leading-none">＋</b>
        拍照/相册
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-label="拍照或从相册选择照片"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** before/after 双槽（各 ≥1 强校验；试样 .ex-ba） */
function DualSlot({
  label,
  slot,
  onFiles,
  onTap,
  readOnly,
  testid,
}: {
  label: string;
  slot: StepPhotoItem | null;
  onFiles: (files: FileList) => void;
  onTap: (url: string) => void;
  readOnly: boolean;
  testid: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex-1">
      {slot ? (
        <button
          type="button"
          data-testid={testid}
          onClick={() => onTap(slot.url)}
          className="relative block h-16 w-full overflow-hidden rounded-chip bg-sunken transition-transform duration-120 ease-philia-spring active:scale-92"
          style={slot.rejectedReason ? { boxShadow: '0 0 0 2px var(--danger)' } : undefined}
          data-rejected={slot.rejectedReason ? true : undefined}
          aria-label={slot.rejectedReason ? `${label} 照片未通过：${slot.rejectedReason}` : undefined}
        >
          <img src={slot.url} alt={label} className={`h-full w-full object-cover ${slot.uploading && !slot.rejectedReason ? 'animate-pulse opacity-80' : ''}`} />
          <span
            className="absolute left-1 top-1 rounded-chip px-1.5 py-px text-[12px]"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            {label}
          </span>
          {slot.uploading && !slot.rejectedReason ? (
            <span
              className="absolute right-1 top-1 rounded-chip px-1.5 py-px text-[12px]"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              上传中
            </span>
          ) : null}
          {slot.rejectedReason ? (
            <span
              className="absolute right-1 top-1 rounded-chip px-1.5 py-px text-[12px]"
              style={{ background: 'var(--danger)', color: 'var(--card)' }}
            >
              未通过
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          data-testid={testid}
          disabled={readOnly}
          onClick={() => inputRef.current?.click()}
          className="flex h-16 w-full items-center justify-center rounded-chip bg-card text-caption text-ink-placeholder transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
          style={{ border: '1px dashed var(--hairline)' }}
        >
          {label} 待拍
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-label={`${label} 照片：拍照或从相册选择`}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function ExecuteStepper({
  rows,
  onFiles,
  onSlotFiles,
  onDeletePhoto,
  onPhotoTap,
  onRetryPhoto,
  onDiscardPhoto,
}: {
  rows: ExecuteStepRow[];
  onFiles: (stepKey: string, files: FileList) => void;
  onSlotFiles: (stepKey: string, tag: 'before' | 'after', files: FileList) => void;
  onDeletePhoto: (stepKey: string, serverId: string) => void;
  onPhotoTap: (url: string) => void;
  /** PD-76 状态机：拒收态「重试」（清标记补冲）/「重拍」（弃本地副本） */
  onRetryPhoto: (queueId: string) => void;
  onDiscardPhoto: (queueId: string) => void;
}) {
  return (
    <ol className="flex flex-col px-[22px] pb-5 pt-4" data-testid="execute-stepper">
      {rows.map((row, idx) => {
        const { def, status, flagged } = row;
        const name = STEP_NAME[def.stepKey] ?? def.name;
        const isBA = def.stepKey === 'before_after';
        const isConfirm = def.stepKey === 'confirm';
        const req = isConfirm ? '无需照片' : isBA ? 'before/after 各 1' : `${def.minPhotos}–${def.maxPhotos} 张`;
        const lack = Math.max(0, def.minPhotos - row.serverCount);
        return (
          <li
            key={def.stepKey}
            data-testid={`step-${def.stepKey}`}
            data-status={status}
            className={`relative flex gap-3 pb-5 ${status === 'locked' ? 'opacity-[.45]' : ''}`}
          >
            {/* 连接线 2px 墨 6% */}
            {idx < rows.length - 1 ? (
              <i aria-hidden className="absolute bottom-0 left-[13px] top-[30px] w-0.5 bg-[rgba(44,40,34,.06)]" />
            ) : null}
            {/* 圆点：共享 StepNode 三态（28px：done 墨色✓ / active 淡金序号 / locked→future 描边序号）；
                外层保留 z-[1] 抬层（压在 2px 连接线上方） */}
            <span className="z-[1] shrink-0">
              <StepNode
                state={status === 'done' ? 'done' : status === 'active' ? 'active' : 'future'}
                label={def.stepOrder}
                size={28}
              />
            </span>

            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-2 text-body-sm font-bold ${status === 'done' ? 'text-ink-secondary' : 'text-ink'}`}>
                {name}
                <span className="u1-num text-caption font-medium text-ink-placeholder">{req}</span>
                {flagged ? (
                  <span className="flex items-center gap-1 rounded-chip bg-danger-light px-1.5 py-px text-caption font-bold text-danger-deep">
                    <Flag className="h-3 w-3" strokeWidth={2} />
                    待重拍
                  </span>
                ) : null}
              </p>

              {status === 'done' ? (
                <>
                  <p className="mt-0.5 text-caption text-ink-secondary">
                    {row.doneAt ? (
                      <>
                        <span className="u1-num whitespace-nowrap">{fmtHM(row.doneAt)}</span> 完成 ·{' '}
                      </>
                    ) : null}
                    {row.serverCount > 0 ? (
                      <>
                        <span className="u1-num">{row.serverCount}</span> 张
                      </>
                    ) : (
                      '无需照片'
                    )}
                  </p>
                  {row.photos.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.photos.map((p) => (
                        <Thumb key={p.key} photo={p} onTap={onPhotoTap} />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              {status === 'active' ? (
                <>
                  {isConfirm ? (
                    <p className="mt-0.5 text-caption text-ink-secondary">确认后预约完成 · 家长收到通知</p>
                  ) : (
                    <p className="mt-0.5 text-caption text-ink-secondary">
                      已传 <span className="u1-num">{row.serverCount}/{def.minPhotos}</span> 张
                      {lack > 0 ? (
                        <>
                          {' '}· 还差 <span className="u1-num">{lack}</span> 张可确认
                        </>
                      ) : (
                        ' · 可确认'
                      )}
                    </p>
                  )}
                  {/* 奶油底操作区 */}
                  {!isConfirm ? (
                    <div className="mt-2.5 rounded-control bg-canvas p-3">
                      {isBA ? (
                        <>
                          <div className="flex gap-1.5">
                            <DualSlot label="before" testid="slot-before" slot={row.beforeSlot} onFiles={(f) => onSlotFiles(def.stepKey, 'before', f)} onTap={onPhotoTap} readOnly={false} />
                            <DualSlot label="after" testid="slot-after" slot={row.afterSlot} onFiles={(f) => onSlotFiles(def.stepKey, 'after', f)} onTap={onPhotoTap} readOnly={false} />
                          </div>
                          {[row.beforeSlot, row.afterSlot]
                            .filter((s): s is StepPhotoItem => !!s?.rejectedReason)
                            .map((s) => (
                              <RejectedLine key={s.key} photo={s} onRetry={onRetryPhoto} onDiscard={onDiscardPhoto} />
                            ))}
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {row.photos.map((p) => (
                              <Thumb key={p.key} photo={p} onTap={onPhotoTap} onDelete={(sid) => onDeletePhoto(def.stepKey, sid)} />
                            ))}
                            {row.serverCount + row.photos.filter((p) => p.uploading && !p.rejectedReason).length < def.maxPhotos ? (
                              <AddSlot onFiles={(f) => onFiles(def.stepKey, f)} />
                            ) : null}
                          </div>
                          {row.photos
                            .filter((p) => p.rejectedReason)
                            .map((p) => (
                              <RejectedLine key={p.key} photo={p} onRetry={onRetryPhoto} onDiscard={onDiscardPhoto} />
                            ))}
                        </>
                      )}
                      <p className="mt-2 text-caption text-ink-secondary">过程照实时同步给家长（服务中全程页）</p>
                      {/* 片 3 B5-2：拍照只许现场拍（诚实口径注记：服务端校验拍摄时刻，不吹「防住」） */}
                      <p className="mt-1 text-caption text-ink-placeholder">{EXECUTE_COPY['exec.photo.onsiteNote']}</p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {status === 'locked' ? (
                <>
                  <p className="mt-0.5 text-caption text-ink-secondary">
                    {isConfirm ? (
                      '确认后预约完成 · 家长收到通知'
                    ) : isBA ? (
                      <>
                        服务前、服务后各拍 <span className="u1-num">1</span> 张
                      </>
                    ) : (
                      '完成上一步后解锁'
                    )}
                  </p>
                  {/* 试样构图：locked 前后对比步也画出双槽（随父级 45% 透明；纯展示不挂交互） */}
                  {isBA ? (
                    <div className="mt-2 flex gap-1.5" aria-hidden>
                      <span
                        className="flex h-16 flex-1 items-center justify-center rounded-chip bg-card text-caption text-ink-placeholder"
                        style={{ border: '1px dashed var(--hairline)' }}
                      >
                        before 待拍
                      </span>
                      <span
                        className="flex h-16 flex-1 items-center justify-center rounded-chip bg-card text-caption text-ink-placeholder"
                        style={{ border: '1px dashed var(--hairline)' }}
                      >
                        after 待拍
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
