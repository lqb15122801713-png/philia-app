/**
 * U2 任务 E · 今日打卡表单卡（boarding.dailyLog · UPSERT by (stay_id, log_date) 幂等）
 *
 * 规格书 §5 + 试样 .bd-form：标题「今日打卡 · M月d日」+ 副行「提交后实时推送给家长
 * （照片+文字）」；喂食 segment（未喂/1/2/3 餐，墨底选中）；遛狗 − N ＋ stepper
 * （副行「次 · 每次约 15 分钟」）；今日照片 ≥1 张（缩略 64×48 + ＋拍照虚线槽）；
 * 备注选填多行（提示家长可见）；吸底柠檬主钮「提交今日打卡」（副行「同日重复提交=
 * 更新当日记录（幂等）」；已打卡则主钮文案「更新今日打卡」）。
 *
 * 数据口径注记：server mealItem.food 必填（min 1）——segment 餐次映射为
 * N × { time: 提交时刻, food: '正餐' }（餐次计数语义，食物明细 v1 不采，规格书同）；
 * 预填仅在 todayLog.id 变化时发生（轮询重取不打断编辑，沿用旧口径）。
 */

import { getApiBase, uploadImage } from '@philia/shared';
import { Camera, Minus, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { BoardingLogRow, MealItem } from './types';

export interface DailyLogSubmit {
  stayId: string;
  logDate: string;
  meals: MealItem[];
  walks: number;
  note?: string;
  photos?: string[];
}

export interface DailyLogFormProps {
  appointmentId: string;
  stayId: string;
  today: string;
  todayLog: BoardingLogRow | undefined;
  submitting: boolean;
  onSubmit(input: DailyLogSubmit): void;
  onError(message: string): void;
}

const PHOTO_MAX = 6;
/** 喂食 segment 档：0=未喂 / 1–3 餐（试样四档） */
const MEAL_SEGS = ['未喂', '1 餐', '2 餐', '3 餐'] as const;

const nowHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function DailyLogForm({
  appointmentId,
  stayId,
  today,
  todayLog,
  submitting,
  onSubmit,
  onError,
}: DailyLogFormProps) {
  const [mealCount, setMealCount] = useState(0);
  const [walks, setWalks] = useState(0);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // 预填只在「今日打卡记录 id 变化」时发生一次
  const prefilledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!todayLog || prefilledIdRef.current === todayLog.id) return;
    prefilledIdRef.current = todayLog.id;
    setMealCount(Math.min(3, todayLog.meals?.length ?? 0));
    setWalks(todayLog.walks ?? 0);
    setNote(todayLog.note ?? '');
    setPhotos((todayLog.photos ?? []).slice(0, PHOTO_MAX));
  }, [todayLog]);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const room = PHOTO_MAX - photos.length;
    if (room <= 0) {
      onError(`今日照片最多 ${PHOTO_MAX} 张`);
      return;
    }
    for (const file of files.slice(0, room)) {
      setUploadingCount((c) => c + 1);
      try {
        const { url } = await uploadImage(getApiBase(), file, `boarding/${appointmentId}/daily/${today}`);
        setPhotos((ps) => (ps.length < PHOTO_MAX ? [...ps, url] : ps));
      } catch (err) {
        onError(err instanceof Error ? err.message : '照片上传失败，请重试');
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
    if (files.length > room) onError(`今日照片最多 ${PHOTO_MAX} 张，超出的已忽略`);
  };

  const anyUploading = uploadingCount > 0;

  const submit = () => {
    if (anyUploading) {
      onError('照片上传中，请稍候再提交');
      return;
    }
    if (photos.length < 1) {
      onError('今日照片至少 1 张——家长等着看 TA 呢');
      return;
    }
    const meals: MealItem[] = Array.from({ length: mealCount }, () => ({
      time: nowHHmm(),
      food: '正餐',
    }));
    onSubmit({
      stayId,
      logDate: today,
      meals,
      walks,
      note: note.trim() ? note.trim().slice(0, 500) : undefined,
      photos,
    });
  };

  return (
    <>
      <section className="u1-card mx-[22px] mt-3.5 p-4" data-testid="daily-log-form">
        <h2 className="text-body-sm font-bold">今日打卡 · {Number(today.slice(5, 7))}月{Number(today.slice(8, 10))}日</h2>
        <p className="mb-3.5 mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">提交后实时推送给家长（照片+文字）</p>

        {/* 喂食 segment（墨底选中） */}
        <div className="mb-3.5">
          <p className="mb-2 text-caption-xs font-bold">
            喂食 <small className="font-medium text-[rgba(74,59,46,.42)]">· 实际餐次</small>
          </p>
          <div className="flex gap-2" role="group" aria-label="喂食餐次">
            {MEAL_SEGS.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={mealCount === i}
                onClick={() => setMealCount(i)}
                /* W1-D2 触控量化：segment 整钮可点 + 目标高 ≥44px，相邻间距 8px（gap-2） */
                className={`min-h-[44px] flex-1 rounded-control py-2.5 text-caption font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 ${
                  mealCount === i ? 'bg-ink text-[#F6F1E3]' : 'u1-ring bg-canvas text-[rgba(74,59,46,.62)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 遛狗 stepper */}
        <div className="mb-3.5">
          <p className="mb-2 text-caption-xs font-bold">
            遛狗 <small className="font-medium text-[rgba(74,59,46,.42)]">· 实际次数</small>
          </p>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setWalks((w) => Math.max(0, w - 1))}
              disabled={walks <= 0}
              aria-label="减少一次"
              className="u1-ring flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <span className="u1-num min-w-7 text-center text-title-lg font-bold">{walks}</span>
            <button
              type="button"
              onClick={() => setWalks((w) => Math.min(99, w + 1))}
              disabled={walks >= 99}
              aria-label="增加一次"
              className="u1-ring flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <span className="text-caption-xs text-[rgba(74,59,46,.42)]">次 · 每次约 15 分钟</span>
          </div>
        </div>

        {/* 今日照片（≥1 张） */}
        <div className="mb-3.5">
          <p className="mb-2 text-caption-xs font-bold">
            今日照片 <small className="font-medium text-[rgba(74,59,46,.42)]">· 至少 1 张</small>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {photos.map((url, i) => (
              <span key={url} className="relative inline-block h-12 w-16">
                <img src={url} alt={`今日照片 ${i + 1}`} className="h-12 w-16 rounded-chip object-cover" loading="lazy" />
                <button
                  type="button"
                  aria-label={`删除照片 ${i + 1}`}
                  onClick={() => setPhotos((ps) => ps.filter((x) => x !== url))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-[#F6F1E3] transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </span>
            ))}
            {photos.length + uploadingCount < PHOTO_MAX ? (
              <button
                type="button"
                data-testid="daily-add-photo"
                onClick={() => fileRef.current?.click()}
                className="flex h-12 w-16 flex-col items-center justify-center rounded-chip bg-card text-caption-xs leading-tight text-[rgba(74,59,46,.42)] [border:1px_dashed_rgba(74,59,46,.25)] transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <b className="text-title font-normal leading-none">＋</b>
                拍照
              </button>
            ) : null}
            {Array.from({ length: uploadingCount }).map((_, i) => (
              <span key={`up-${i}`} className="h-12 w-16 animate-pulse rounded-chip bg-sunken" aria-label="上传中" />
            ))}
          </div>
        </div>

        {/* 备注（选填，家长可见） */}
        <div>
          <p className="mb-2 text-caption-xs font-bold">
            备注 <small className="font-medium text-[rgba(74,59,46,.42)]">· 选填，家长可见</small>
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="今天胃口很好，中午在院子里跑了二十分钟…"
            className="h-16 w-full resize-none rounded-control bg-canvas px-3.5 py-3 text-caption text-ink shadow-[inset_0_0_0_1px_rgba(74,59,46,.09)] placeholder:text-[rgba(74,59,46,.42)] focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(74,59,46,.25)]"
          />
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} />
      </section>

      {/* 吸底柠檬主钮（幂等副行常驻；试样底栏 padding 12px 22px 14px） */}
      <div className="sticky bottom-0 mt-3 bg-card px-[22px] pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-1px_0_rgba(74,59,46,.06)]">
        <button
          type="button"
          data-testid="daily-submit"
          onClick={submit}
          disabled={submitting || anyUploading}
          className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-primary py-3.5 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-60"
        >
          <Camera className="h-4 w-4" strokeWidth={1.8} />
          {submitting ? '提交中…' : todayLog ? '更新今日打卡' : '提交今日打卡'}
        </button>
        <p className="mt-1.5 text-center text-caption-xs text-[rgba(74,59,46,.42)]">同日重复提交=更新当日记录（幂等）</p>
      </div>
    </>
  );
}
