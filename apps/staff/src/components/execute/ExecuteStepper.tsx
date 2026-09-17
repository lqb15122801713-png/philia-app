/**
 * U2 任务 D · 竖向六步 stepper（员工端本地副本 ExecuteStepper；共享 StepTimeline 不动）
 *
 * 规格书 §4 + 试样 .ex-steps：
 * - 连接线 2px 墨 6%；完成步=薄荷圆 ✓ + 步名（墨 60%）+ 完成时间·张数 + 64×48 缩略（点击看大图）；
 * - 当前步=柠檬圆序号 + 步名 700 +「已传 X/Y 张·还差 N 张可确认」+ 奶油底操作区
 *   （已传缩略 +「＋拍照/相册」虚线槽 64×48 + 提示「过程照实时同步给家长」）；
 * - 前后对比步（第 5 步）before/after 双槽并排（各 ≥1 强校验——张数口径由页面按钮链与服务端双重保证）；
 * - 未到步 45% 透明；打标重拍步带红旗签。
 * 工艺：字阶 11/12/14 档；圆角缩略 6/操作区 14；按下 scale 0.92 duration-120 ease-philia-spring。
 */

import { useRef } from 'react';
import { Check, Flag } from 'lucide-react';
import type { ServiceStepDef } from '@philia/shared';
import { STEP_NAME } from '../today/deck/ServiceCard';

export interface StepPhotoItem {
  key: string;
  url: string;
  uploading?: boolean;
  tagLabel?: string;
  /** 服务端照片 id（active 步可删） */
  serverId?: string;
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

/** 缩略图 64×48（点击看大图；active 步服务端照片右上 × 可删） */
function Thumb({
  photo,
  onTap,
  onDelete,
}: {
  photo: StepPhotoItem;
  onTap: (url: string) => void;
  onDelete?: (serverId: string) => void;
}) {
  return (
    <span className="relative inline-block h-12 w-16 shrink-0">
      <button
        type="button"
        onClick={() => onTap(photo.url)}
        className="block h-12 w-16 overflow-hidden rounded-tag bg-sunken transition-transform duration-120 ease-philia-spring active:scale-92"
        aria-label="查看大图"
      >
        <img src={photo.url} alt={photo.tagLabel ?? '过程照'} loading="lazy" className={`h-full w-full object-cover ${photo.uploading ? 'animate-pulse opacity-80' : ''}`} />
      </button>
      {photo.tagLabel ? (
        <span className="pointer-events-none absolute left-0.5 top-0.5 rounded-chip bg-[rgba(74,59,46,.72)] px-1 py-px text-[11px] text-[#F6F1E3]">
          {photo.tagLabel}
        </span>
      ) : null}
      {photo.uploading ? (
        <span className="pointer-events-none absolute right-0.5 top-0.5 rounded-chip bg-[rgba(74,59,46,.72)] px-1 py-px text-[11px] text-[#F6F1E3]">
          上传中
        </span>
      ) : null}
      {onDelete && photo.serverId && !photo.uploading ? (
        <button
          type="button"
          aria-label="删除这张照片"
          onClick={() => onDelete(photo.serverId!)}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-[#F6F1E3] transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

/** 「＋拍照/相册」虚线槽（64×48） */
function AddSlot({ onFiles, disabled }: { onFiles: (files: FileList) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        data-testid="step-add-photo"
        className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-tag bg-card text-[11px] leading-tight text-[rgba(74,59,46,.42)] shadow-[0_0_0_1px_rgba(74,59,46,.12)] [border:1px_dashed_rgba(74,59,46,.25)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
      >
        <b className="text-body font-normal">＋</b>
        拍照/相册
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
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
          className="relative block h-16 w-full overflow-hidden rounded-tag bg-sunken transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <img src={slot.url} alt={label} className={`h-full w-full object-cover ${slot.uploading ? 'animate-pulse opacity-80' : ''}`} />
          <span className="absolute left-1 top-1 rounded-chip bg-[rgba(74,59,46,.72)] px-1.5 py-px text-[11px] text-[#F6F1E3]">{label}</span>
          {slot.uploading ? (
            <span className="absolute right-1 top-1 rounded-chip bg-[rgba(74,59,46,.72)] px-1.5 py-px text-[11px] text-[#F6F1E3]">上传中</span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          data-testid={testid}
          disabled={readOnly}
          onClick={() => inputRef.current?.click()}
          className="flex h-16 w-full items-center justify-center rounded-tag bg-card text-caption-xs text-[rgba(74,59,46,.42)] [border:1px_dashed_rgba(74,59,46,.25)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
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
}: {
  rows: ExecuteStepRow[];
  onFiles: (stepKey: string, files: FileList) => void;
  onSlotFiles: (stepKey: string, tag: 'before' | 'after', files: FileList) => void;
  onDeletePhoto: (stepKey: string, serverId: string) => void;
  onPhotoTap: (url: string) => void;
}) {
  return (
    <ol className="flex flex-col px-4 pb-5 pt-4" data-testid="execute-stepper">
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
              <i aria-hidden className="absolute bottom-0 left-[13px] top-[30px] w-0.5 bg-[rgba(74,59,46,.06)]" />
            ) : null}
            {/* 圆点：done=薄荷 ✓ / active=柠檬序号 / locked=纸面 ring 序号 */}
            <span
              className={`z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full u1-num text-caption font-bold ${
                status === 'done'
                  ? 'bg-brand-secondary text-ink'
                  : status === 'active'
                    ? 'bg-brand-primary text-ink'
                    : 'u1-ring bg-card text-[rgba(74,59,46,.42)]'
              }`}
            >
              {status === 'done' ? <Check className="h-4 w-4" strokeWidth={2.5} /> : def.stepOrder}
            </span>

            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-2 text-body-sm font-bold ${status === 'done' ? 'text-[rgba(74,59,46,.62)]' : 'text-ink'}`}>
                {name}
                <span className="text-caption-xs font-medium text-[rgba(74,59,46,.42)]">{req}</span>
                {flagged ? (
                  <span className="flex items-center gap-1 rounded-chip bg-danger-light px-1.5 py-px text-caption-xs font-bold text-danger-deep">
                    <Flag className="h-3 w-3" strokeWidth={2} />
                    待重拍
                  </span>
                ) : null}
              </p>

              {status === 'done' ? (
                <>
                  <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                    {row.doneAt ? `${fmtHM(row.doneAt)} 完成 · ` : ''}{row.serverCount > 0 ? `${row.serverCount} 张` : '无需照片'}
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
                    <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">确认后预约完成 · 家长收到通知</p>
                  ) : (
                    <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                      已传 {row.serverCount}/{def.minPhotos} 张{lack > 0 ? ` · 还差 ${lack} 张可确认` : ' · 可确认'}
                    </p>
                  )}
                  {/* 奶油底操作区 */}
                  {!isConfirm ? (
                    <div className="mt-2.5 rounded-control bg-canvas p-3">
                      {isBA ? (
                        <div className="flex gap-1.5">
                          <DualSlot label="before" testid="slot-before" slot={row.beforeSlot} onFiles={(f) => onSlotFiles(def.stepKey, 'before', f)} onTap={onPhotoTap} readOnly={false} />
                          <DualSlot label="after" testid="slot-after" slot={row.afterSlot} onFiles={(f) => onSlotFiles(def.stepKey, 'after', f)} onTap={onPhotoTap} readOnly={false} />
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.photos.map((p) => (
                            <Thumb key={p.key} photo={p} onTap={onPhotoTap} onDelete={(sid) => onDeletePhoto(def.stepKey, sid)} />
                          ))}
                          {row.serverCount + row.photos.filter((p) => p.uploading).length < def.maxPhotos ? (
                            <AddSlot onFiles={(f) => onFiles(def.stepKey, f)} />
                          ) : null}
                        </div>
                      )}
                      <p className="mt-2 text-caption-xs text-[rgba(74,59,46,.62)]">过程照实时同步给家长（服务中全程页）</p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {status === 'locked' ? (
                <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
                  {isConfirm ? '确认后预约完成 · 家长收到通知' : isBA ? '服务前、服务后各拍 1 张' : '完成上一步后解锁'}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
