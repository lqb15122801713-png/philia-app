/**
 * B9a 任务 A · v4.1 减法版宠物选择（单屏族样式副本）：
 * 逻辑 1:1 复刻共享件 ../PetPicker（普通卡选 / 寄养疫苗硬校验阻断 / 空档引导），
 * 仅视觉按设计规格 v3 §1 重做——去卡片化（hairline 细线行）、去阴影、
 * 无彩色图标底块（emoji 直接呈现）、选中态=深棕墨细线圈（不铺色块）、
 * 圆角收敛 14~18px。共享件 PetPicker 被旧 4 屏向导 /wizard 共用，不动。
 * 疫苗阻断为状态必需，保留 danger 状态色；「去补录」退让为细线按钮（避免新增 text-white）。
 */

import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import type { PetItem } from '../types';
import { isoToDate, toISODate } from '../format';

const SPECIES_LABEL: Record<string, string> = { dog: '狗狗', cat: '猫咪', other: '其他' };

export default function PetPickerFlat({
  pets,
  selectedId,
  onSelect,
  requireVaccineUntil,
  loading,
}: {
  pets: PetItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 寄养疫苗硬校验：疫苗有效期须覆盖到该日（含） */
  requireVaccineUntil?: Date | null;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="h-20 animate-pulse rounded-card bg-sunken" />;
  }

  if (pets.length === 0) {
    return (
      <div className="py-4 text-center">
        <PawPrint className="mx-auto h-8 w-8 text-ink-secondary" strokeWidth={1.5} aria-hidden="true" />
        <p className="mt-1 text-title">还没有宠物档案</p>
        <p className="mt-1 text-caption text-ink-secondary">先为毛孩子建一份档案，再来预约吧</p>
        <Link
          to="/philia/pets"
          className="mt-4 inline-flex h-11 items-center rounded-card border-[1.5px] border-ink px-6 text-body font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          去建宠物档案
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
                      ? `疫苗有效期至 ${p.vaccineValidUntil}，已不满足寄养要求`
                      : '档案中还没有疫苗有效期记录'}
                    ，寄养需疫苗在有效期内
                  </p>
                </div>
                <Link
                  to="/philia/pets"
                  className="ml-3 shrink-0 rounded-card border border-danger-deep px-3 py-2 text-caption font-medium text-danger-deep"
                >
                  去补录
                </Link>
              </div>
            </div>
          );
        }

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`flex w-full items-center gap-3 rounded-card border p-4 text-left transition active:scale-[0.99] ${
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
        );
      })}
    </div>
  );
}
