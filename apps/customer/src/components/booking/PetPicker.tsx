/**
 * 宠物选择（T2.2 · 确认屏 / 寄养第 3 屏；B9a 任务 A 单屏族减法皮）：
 * - 普通模式（洗护）：卡选即可；
 * - 疫苗硬校验模式（寄养，requireVaccineUntil=退房日）：vaccine_valid_until 为空或
 *   早于该日的宠物渲染为红色阻断卡，不可选，附「去补录疫苗信息」引导跳 /philia/pets
 *   （开发方案 §3.1：疫苗过期前端阻断 + 提示补录）；
 * - 无宠物：引导卡跳 /philia/pets 建档。
 *
 * 换皮批片 5：双胞归并——原 single/PetPickerFlat（v4.1 减法皮：去卡片化 hairline
 * 细线行 / 去阴影 / emoji 改 PawPrint 线图标 / 选中=深棕墨细线圈）与 card 皮逻辑
 * 1:1 同构，合并为单组件 + variant；single/PetPickerFlat.tsx 改转发 variant='flat'。
 * 疫苗阻断为状态必需，保留 danger 状态色；两皮各自视觉逐字保留。
 *
 * W1-D2 触控量化复核（flat 皮）：整行 <button> 可点（含圆圈与文字区）、行高 p-4
 * 实测 ≥44px、相邻行距 space-y-2=8px——满足补丁③4（HIG 44pt / WCAG 24px 取严）。
 */

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { Skeleton, useMe } from '@philia/shared';
import { bkc } from '@/copy/booking';
import type { PetItem } from './types';
import { isoToDate, toISODate } from './format';

const SPECIES_LABEL: Record<string, string> = { dog: '狗狗', cat: '猫咪', other: '其他' };

export interface PetPickerProps {
  /** 皮：'card'（旧 4 屏向导白卡投影皮）| 'flat'（单屏族 v4.1 减法皮） */
  variant?: 'card' | 'flat';
  pets: PetItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 寄养疫苗硬校验：疫苗有效期须覆盖到该日（含） */
  requireVaccineUntil?: Date | null;
  loading?: boolean;
}

export default function PetPicker({
  variant = 'card',
  pets,
  selectedId,
  onSelect,
  requireVaccineUntil,
  loading,
}: PetPickerProps) {
  const { user } = useMe();
  /* 体验批片 4 默认选中：主人有 activePetId 且该宠在可选列表且当前未选中任何宠物时，
     经既有 onSelect 回调同步父级（不改受控协议）；只补选一次，之后尊重用户手选/父级控制 */
  const defaultPickedRef = useRef(false);
  useEffect(() => {
    if (defaultPickedRef.current || loading) return;
    if (selectedId !== null) {
      defaultPickedRef.current = true;
      return;
    }
    const activePetId = user?.activePetId;
    if (!activePetId) return;
    const target = pets.find((p) => p.id === activePetId);
    if (!target) return;
    // 疫苗硬校验模式下不越过阻断卡（红色阻断行不可选）
    if (requireVaccineUntil) {
      if (!target.vaccineValidUntil) return;
      if (toISODate(isoToDate(target.vaccineValidUntil)) < toISODate(requireVaccineUntil)) return;
    }
    defaultPickedRef.current = true;
    onSelect(activePetId);
  }, [user, pets, selectedId, loading, requireVaccineUntil, onSelect]);

  if (loading) {
    return <Skeleton className="h-20 rounded-card" />;
  }

  if (pets.length === 0) {
    return variant === 'flat' ? (
      <div className="py-4 text-center">
        <PawPrint className="mx-auto h-8 w-8 text-ink-secondary" strokeWidth={1.5} aria-hidden="true" />
        <p className="mt-1 text-title">{bkc('booking.noPetTitle')}</p>
        <p className="mt-1 text-caption text-ink-secondary">{bkc('booking.noPetBodyPicker')}</p>
        <Link
          to="/philia/pets"
          className="mt-4 inline-flex h-11 items-center rounded-card border-[1.5px] border-ink px-6 text-body font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {bkc('booking.noPetCtaPicker')}
        </Link>
      </div>
    ) : (
      <div className="rounded-card bg-card p-5 text-center shadow-card">
        <p className="text-[28px]">🐶</p>
        <p className="mt-1 text-title">{bkc('booking.noPetTitle')}</p>
        <p className="mt-1 text-caption text-ink-secondary">{bkc('booking.noPetBodyPicker')}</p>
        <Link
          to="/philia/pets"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-brand-primary px-6 text-body font-medium text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {bkc('booking.noPetCtaPicker')}
        </Link>
      </div>
    );
  }

  const vaccineOk = (p: PetItem): boolean => {
    if (!requireVaccineUntil) return true;
    if (!p.vaccineValidUntil) return false;
    // ISO 纯日期按本地日比较：须 ≥ 要求日
    return toISODate(isoToDate(p.vaccineValidUntil)) >= toISODate(requireVaccineUntil);
  };

  return (
    <div className="space-y-2">
      {pets.map((p) => {
        const ok = vaccineOk(p);
        const active = selectedId === p.id;

        if (!ok) {
          // 疫苗阻断卡（红色，状态必需）：不可选 + 补录引导
          return (
            <div key={p.id} className="rounded-card bg-danger-light p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body font-semibold text-danger-deep">
                    {p.name}
                    <span className="ml-2 text-caption font-normal">
                      {SPECIES_LABEL[p.species] ?? p.species}
                      {p.breed ? ` · ${p.breed}` : ''}
                    </span>
                  </p>
                  <p className="mt-1 text-caption text-danger-deep">
                    {p.vaccineValidUntil
                      ? bkc('booking.vaccineBlockedUntil', { date: p.vaccineValidUntil })
                      : bkc('booking.vaccineBlockedNone')}
                    {bkc('booking.vaccineBlockedSuffix')}
                  </p>
                </div>
                {variant === 'flat' ? (
                  <Link
                    to="/philia/pets"
                    className="ml-3 shrink-0 rounded-card border border-danger-deep px-3 py-2 text-caption font-medium text-danger-deep"
                  >
                    {bkc('booking.vaccineFix')}
                  </Link>
                ) : (
                  <Link
                    to="/philia/pets"
                    className="ml-3 shrink-0 rounded-full bg-danger px-3 py-2 text-caption font-medium text-white"
                  >
                    {bkc('booking.vaccineFix')}
                  </Link>
                )}
              </div>
            </div>
          );
        }

        return variant === 'flat' ? (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            /* W1-D2：整行可点（含圆圈与文字区），行高 ≥44px，相邻间距 8px（space-y-2） */
            className={`flex min-h-[44px] w-full items-center gap-3 rounded-card border p-4 text-left transition active:scale-[0.99] ${
              active ? 'border-[1.5px] border-ink' : 'border-line'
            }`}
          >
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.name} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              /* U1-D：彩色 emoji 改 VI 线图标（全域禁彩色图标） */
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sunken" aria-hidden="true">
                <PawPrint className="h-5 w-5 text-ink" strokeWidth={1.5} />
              </span>
            )}
            <span className="flex-1">
              <span className="block text-body font-semibold">{p.name}</span>
              <span className="block text-caption text-ink-secondary">
                {SPECIES_LABEL[p.species] ?? p.species}
                {p.breed ? ` · ${p.breed}` : ''}
                {p.weightKg ? ` · ${p.weightKg}kg` : ''}
                {requireVaccineUntil && p.vaccineValidUntil
                  ? ` · 疫苗至 ${p.vaccineValidUntil}`
                  : ''}
              </span>
            </span>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                active ? 'bg-ink' : 'border-[1.5px] border-line-strong'
              }`}
            >
              {active ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-card" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : null}
            </span>
          </button>
        ) : (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`flex w-full items-center gap-3 rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${
              active ? 'ring-2 ring-brand-primary' : ''
            }`}
          >
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.name} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-secondary-light text-[20px]">
                {p.species === 'cat' ? '🐱' : '🐶'}
              </span>
            )}
            <span className="flex-1">
              <span className="block text-body font-semibold">{p.name}</span>
              <span className="block text-caption text-ink-secondary">
                {SPECIES_LABEL[p.species] ?? p.species}
                {p.breed ? ` · ${p.breed}` : ''}
                {p.weightKg ? ` · ${p.weightKg}kg` : ''}
                {requireVaccineUntil && p.vaccineValidUntil
                  ? ` · 疫苗至 ${p.vaccineValidUntil}`
                  : ''}
              </span>
            </span>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                active ? 'bg-brand-primary' : 'border-[1.5px] border-line-strong'
              }`}
            >
              {active ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
