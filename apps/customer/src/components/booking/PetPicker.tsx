/**
 * 宠物选择（T2.2 · 确认屏 / 寄养第 3 屏）：
 * - 普通模式（洗护）：卡选即可；
 * - 疫苗硬校验模式（寄养，requireVaccineUntil=退房日）：vaccine_valid_until 为空或
 *   早于该日的宠物渲染为红色阻断卡，不可选，附「去补录疫苗信息」引导跳 /philia/pets
 *   （开发方案 §3.1：疫苗过期前端阻断 + 提示补录）；
 * - 无宠物：引导卡跳 /philia/pets 建档。
 */

import { Link } from 'react-router-dom';
import type { PetItem } from './types';
import { isoToDate, toISODate } from './format';

const SPECIES_LABEL: Record<string, string> = { dog: '狗狗', cat: '猫咪', other: '其他' };

export default function PetPicker({
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
      <div className="rounded-card bg-card p-5 text-center shadow-card">
        <p className="text-[28px]">🐶</p>
        <p className="mt-1 text-title">还没有宠物档案</p>
        <p className="mt-1 text-caption text-ink-secondary">先为毛孩子建一份档案，再来预约吧</p>
        <Link
          to="/philia/pets"
          className="mt-4 inline-flex h-11 items-center rounded-full bg-brand-primary px-6 text-body font-medium text-white shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
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
          // 疫苗阻断卡（红色）：不可选 + 补录引导
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
                  className="ml-3 shrink-0 rounded-full bg-danger px-3 py-2 text-caption font-medium text-white"
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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
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
