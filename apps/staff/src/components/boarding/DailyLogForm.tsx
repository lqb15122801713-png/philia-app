/**
 * 今日打卡卡（boarding.dailyLog · UPSERT by (stay_id, log_date)）
 *
 * - 喂食记录：可添加多顿（时间 + 食物 + 「已吃完」开关），≤12 顿
 * - 遛弯次数：步进器（0–99）
 * - 状态备注：≤300 字（服务端上限 500，UI 按任务规格收紧到 300）
 * - 状态照片：≤6 张，三列九宫格，uploadImage → boarding/<aid>/daily/<date>
 * - UPSERT 语义：当日已有打卡时顶部明示「今日已打卡，再次提交将更新」，
 *   按钮文案变为「更新今日打卡」；预填仅在 todayLog.id 变化时发生，
 *   避免后台轮询重取后覆盖员工正在编辑的内容。
 */

import { getApiBase, uploadImage } from '@philia/shared';
import { Camera, Info, Loader2, Minus, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { BoardingLogRow, MealItem } from './types';

interface MealDraft {
  key: string;
  time: string;
  food: string;
  amount?: string;
  finished: boolean;
}

interface PhotoDraft {
  url: string;
}

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
  /** 今日 ISO 日期 'YYYY-MM-DD' */
  today: string;
  /** 今日已有打卡（UPSERT 预填 + 提示）；undefined 表示今日未打卡 */
  todayLog: BoardingLogRow | undefined;
  submitting: boolean;
  onSubmit(input: DailyLogSubmit): void;
  onError(message: string): void;
}

const NOTE_MAX = 300;
const PHOTO_MAX = 6;
const MEAL_MAX = 12;

const nowHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const newMeal = (): MealDraft => ({ key: crypto.randomUUID(), time: nowHHmm(), food: '', finished: false });

export default function DailyLogForm({
  appointmentId,
  stayId,
  today,
  todayLog,
  submitting,
  onSubmit,
  onError,
}: DailyLogFormProps) {
  const [meals, setMeals] = useState<MealDraft[]>([]);
  const [walks, setWalks] = useState(0);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);

  // 预填只在「今日打卡记录 id 变化」时发生一次：60s 慢轮询/失效重取会产生新对象，
  // 但 id 不变，不会打断员工正在进行的编辑
  const prefilledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!todayLog || prefilledIdRef.current === todayLog.id) return;
    prefilledIdRef.current = todayLog.id;
    setMeals(
      (todayLog.meals ?? []).map((m) => ({
        key: crypto.randomUUID(),
        time: m.time || nowHHmm(),
        food: m.food ?? '',
        amount: m.amount,
        finished: m.finished ?? false,
      })),
    );
    setWalks(todayLog.walks ?? 0);
    setNote(todayLog.note ?? '');
    setPhotos((todayLog.photos ?? []).slice(0, PHOTO_MAX).map((url) => ({ url })));
  }, [todayLog]);

  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const room = PHOTO_MAX - photos.length;
    if (room <= 0) {
      onError(`状态照片最多 ${PHOTO_MAX} 张`);
      return;
    }
    for (const file of files.slice(0, room)) {
      setUploadingCount((c) => c + 1);
      try {
        const { url } = await uploadImage(getApiBase(), file, `boarding/${appointmentId}/daily/${today}`);
        setPhotos((ps) => (ps.length < PHOTO_MAX ? [...ps, { url }] : ps));
      } catch (err) {
        onError(err instanceof Error ? err.message : '照片上传失败，请重试');
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
    if (files.length > room) onError(`状态照片最多 ${PHOTO_MAX} 张，超出的已忽略`);
  };

  const patchMeal = (key: string, patch: Partial<MealDraft>) => {
    setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  };

  const anyUploading = uploadingCount > 0;

  const submit = () => {
    if (anyUploading) {
      onError('照片上传中，请稍候再提交');
      return;
    }
    const badIdx = meals.findIndex((m) => !m.food.trim());
    if (badIdx !== -1) {
      onError(`请填写第 ${badIdx + 1} 餐的食物，或删除该餐`);
      return;
    }
    onSubmit({
      stayId,
      logDate: today,
      meals: meals.map((m) => ({
        time: (m.time || nowHHmm()).slice(0, 32),
        food: m.food.trim().slice(0, 64),
        ...(m.amount ? { amount: m.amount } : {}),
        finished: m.finished,
      })),
      walks,
      note: note.trim() ? note.trim() : undefined,
      photos: photos.length > 0 ? photos.map((p) => p.url) : undefined,
    });
  };

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-title">今日打卡</h2>
        <span className="font-number text-caption text-ink-secondary">{today}</span>
      </div>

      {/* UPSERT 明示 */}
      {todayLog ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-tag bg-brand-secondary-light px-3 py-2 text-body text-ink">
          <Info className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          今日已打卡，再次提交将更新
        </p>
      ) : null}

      {/* 喂食记录 */}
      <div className="mt-4">
        <span className="text-body-lg font-medium text-ink">喂食记录</span>
        <ul className="mt-1.5 space-y-2">
          {meals.map((meal) => (
            <li key={meal.key} className="flex items-center gap-2">
              <input
                type="time"
                value={meal.time}
                onChange={(e) => patchMeal(meal.key, { time: e.target.value })}
                className="h-staff-btn w-24 shrink-0 rounded-input border border-line bg-canvas px-2 font-number text-body-lg text-ink focus:border-brand-primary focus:outline-none"
                aria-label="用餐时间"
              />
              <input
                type="text"
                value={meal.food}
                onChange={(e) => patchMeal(meal.key, { food: e.target.value.slice(0, 64) })}
                placeholder="食物，如：自带粮"
                className="h-staff-btn min-w-0 flex-1 rounded-input border border-line bg-canvas px-3 text-body-lg text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => patchMeal(meal.key, { finished: !meal.finished })}
                className={`h-12 shrink-0 rounded-full px-3 text-body ${
                  meal.finished ? 'bg-success-light text-success-deep' : 'bg-sunken text-ink-secondary'
                }`}
                aria-pressed={meal.finished}
              >
                {meal.finished ? '已吃完' : '未吃完'}
              </button>
              <button
                type="button"
                onClick={() => setMeals((ms) => ms.filter((m) => m.key !== meal.key))}
                className="flex h-12 w-12 shrink-0 items-center justify-center text-danger-deep"
                aria-label="删除该餐"
              >
                <Trash2 className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
        {meals.length < MEAL_MAX ? (
          <button
            type="button"
            onClick={() => setMeals((ms) => [...ms, newMeal()])}
            className="mt-2 flex h-12 items-center gap-1.5 rounded-full bg-brand-primary-light px-4 text-body-lg text-brand-primary"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
            添加一餐
          </button>
        ) : null}
      </div>

      {/* 遛弯步进器 */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-body-lg font-medium text-ink">遛弯次数</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWalks((w) => Math.max(0, w - 1))}
            disabled={walks <= 0}
            className="flex h-staff-btn w-14 items-center justify-center rounded-full bg-sunken text-ink disabled:opacity-40"
            aria-label="减少一次"
          >
            <Minus className="h-6 w-6" strokeWidth={1.5} />
          </button>
          <span className="w-10 text-center font-number text-title-lg">{walks}</span>
          <button
            type="button"
            onClick={() => setWalks((w) => Math.min(99, w + 1))}
            disabled={walks >= 99}
            className="flex h-staff-btn w-14 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary disabled:opacity-40"
            aria-label="增加一次"
          >
            <Plus className="h-6 w-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 状态备注 */}
      <label className="mt-4 block">
        <span className="flex items-baseline justify-between text-body-lg font-medium text-ink">
          状态备注
          <span className="font-number text-caption text-ink-placeholder">
            {note.length}/{NOTE_MAX}
          </span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          placeholder="精神、食欲、排便等情况（可空）"
          className="mt-1.5 w-full rounded-input border border-line bg-canvas px-3 py-2.5 text-body-lg text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
        />
      </label>

      {/* 状态照片（≤6，九宫格） */}
      <div className="mt-4">
        <span className="text-body-lg font-medium text-ink">状态照片（≤{PHOTO_MAX} 张）</span>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-tag bg-sunken">
              <img src={p.url} alt={`状态照片 ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((ps) => ps.filter((x) => x.url !== p.url))}
                className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(61,50,41,0.55)] text-white"
                aria-label={`删除照片 ${i + 1}`}
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ))}
          {Array.from({ length: uploadingCount }).map((_, i) => (
            <div
              key={`uploading-${i}`}
              className="flex aspect-square items-center justify-center rounded-tag bg-sunken"
            >
              <Loader2 className="h-6 w-6 animate-spin text-ink-secondary" strokeWidth={1.5} />
            </div>
          ))}
          {photos.length + uploadingCount < PHOTO_MAX ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-tag border border-dashed border-line-strong text-ink-secondary"
            >
              <Camera className="h-6 w-6" strokeWidth={1.5} />
              <span className="text-caption">拍照</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* 提交 */}
      <button
        type="button"
        onClick={submit}
        disabled={submitting || anyUploading}
        className="mt-5 h-staff-btn w-full rounded-full bg-brand-primary text-body-lg font-semibold text-white shadow-philia transition active:scale-95 disabled:opacity-50"
      >
        {submitting ? '提交中…' : todayLog ? '更新今日打卡' : '提交今日打卡'}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={onFiles}
      />
    </section>
  );
}
