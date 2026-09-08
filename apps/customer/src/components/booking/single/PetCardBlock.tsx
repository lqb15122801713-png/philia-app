/**
 * B4-1 单屏 · 宠物卡区块（B4-2 寄养单屏复用）：
 * - 已选：头像 + 「名字·品种」+ 上次洗护行 + 体重行，点按弹底部半屏宠物列表（不跳页）；
 * - 未选（多宠不替选）：占位卡「请选择宠物」；
 * - 无宠物：「先建档」岔路卡（保留旧向导现状逻辑：可「随便看看」仅浏览，
 *   确认按钮会因缺宠物置灰——双保险）。
 * - 寄养用法：传 requireVaccineUntil=退房日，底部半屏选宠列表启用疫苗硬校验
 *   （不满足的宠物渲染红色阻断卡，PetPicker 现状能力，仅透传）。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PetPicker from '../PetPicker';
import BottomSheet from './BottomSheet';
import type { PetItem } from '../types';

const SPECIES_LABEL: Record<string, string> = { dog: '狗狗', cat: '猫咪', other: '其他' };

export default function PetCardBlock({
  pets,
  selectedId,
  onSelect,
  lastGroomingLabel,
  loading,
  requireVaccineUntil,
  pickerHint,
}: {
  pets: PetItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 选中宠物的上次洗护摘要（如「上次洗护 8.23 · 基础洗护」），无则隐藏该行 */
  lastGroomingLabel?: string | null;
  loading?: boolean;
  /** B4-2 寄养：底部半屏选宠列表启用疫苗硬校验（须覆盖至退房日），不满足的宠物渲染红色阻断卡 */
  requireVaccineUntil?: Date | null;
  /** 未选占位卡副文案（默认「点按选择要洗护的毛孩子」，寄养传「寄养」版） */
  pickerHint?: string;
}) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [forkDismissed, setForkDismissed] = useState(false);

  if (loading) {
    return <div className="h-20 animate-pulse rounded-card bg-sunken" data-testid="gs-pet-loading" />;
  }

  /* 无宠物 → 先建档岔路卡（保留现状逻辑） */
  if (pets.length === 0 && !forkDismissed) {
    return (
      <div
        className="flex flex-col items-center rounded-card bg-card px-4 py-6 text-center shadow-card"
        data-testid="gs-no-pet-fork"
      >
        <img src="/brand/empty-appointments-800.png" alt="还没有宠物档案" className="w-40 max-w-full rounded-card" />
        <p className="mt-3 text-title">还没有宠物档案</p>
        <p className="mt-1 text-caption text-ink-secondary">预约前需要先为毛孩子建立档案</p>
        <button
          type="button"
          onClick={() => navigate('/philia/pets')}
          className="mt-4 flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          先建立宠物档案
        </button>
        <button
          type="button"
          onClick={() => setForkDismissed(true)}
          className="mt-3 text-caption text-ink-secondary underline-offset-2 hover:underline"
        >
          随便看看
        </button>
      </div>
    );
  }

  const pet = pets.find((p) => p.id === selectedId) ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        data-testid="gs-pet-card"
        className={`flex w-full items-center gap-3 rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${
          pet ? '' : 'border border-dashed border-line-strong'
        }`}
      >
        {pet ? (
          <>
            {pet.avatarUrl ? (
              <img src={pet.avatarUrl} alt={pet.name} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-secondary-light text-[22px]">
                {pet.species === 'cat' ? '🐱' : '🐶'}
              </span>
            )}
            <span className="flex-1">
              <span className="block text-body font-semibold">
                {pet.name}
                <span className="ml-2 text-caption font-normal text-ink-secondary">
                  {SPECIES_LABEL[pet.species] ?? pet.species}
                  {pet.breed ? ` · ${pet.breed}` : ''}
                </span>
              </span>
              <span className="mt-0.5 block text-caption text-ink-secondary">
                {lastGroomingLabel ??
                  [pet.weightKg ? `${pet.weightKg}kg` : null, pet.breed ?? null].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="text-caption text-brand-primary">更换 ▸</span>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-[22px]">🐾</span>
            <span className="flex-1">
              <span className="block text-body font-semibold text-ink-secondary">请选择宠物</span>
              <span className="mt-0.5 block text-caption text-ink-placeholder">{pickerHint ?? '点按选择要洗护的毛孩子'}</span>
            </span>
            <span className="text-caption text-brand-primary">选择 ▸</span>
          </>
        )}
      </button>

      {sheetOpen ? (
        <BottomSheet title="选择宠物" onClose={() => setSheetOpen(false)} testId="gs-pet-sheet">
          <PetPicker
            pets={pets}
            selectedId={selectedId}
            onSelect={(id) => {
              onSelect(id);
              setSheetOpen(false);
            }}
            requireVaccineUntil={requireVaccineUntil}
          />
        </BottomSheet>
      ) : null}
    </>
  );
}
