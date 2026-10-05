/**
 * ActivePetSwitcher · 多宠物全局切换器（客户端体验大批片 4）
 *
 * - 数据源：useMe（user.activePetId）+ trpc.pet.list（queryKey ['pet','list']，
 *   与 PetsPage 同键共享缓存，不产生额外请求）；
 * - 当前选定宠物头像+名 pill，点击展开底部 sheet（复用 booking/single BottomSheet）
 *   列全部宠物 +「全部宠物」项（petId=null，清除选定=回落全部口径）；
 * - 选定调 pet.setActive 后 invalidate ['auth','me']（useMe 实际 queryKey）与
 *   宠物相关查询（['pet'] / ['petHealth']）；
 * - 单宠用户：显示当前宠物 pill 不展开（附注记）；零宠不渲染。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, PawPrint } from 'lucide-react'
import { useState } from 'react'
import { useMe, usePhiliaClient, useToast } from '@philia/shared'
import BottomSheet from '@/components/booking/single/BottomSheet'
import { pc } from '@/copy/pets'
import type { PetItem } from '@/components/booking/types'

/** 24px 迷你头像：有图出图，无图出字圈（浅木底+衬线首字，同 PetsPage 无头像口径） */
function MiniAvatar({ pet }: { pet: PetItem }) {
  if (pet.avatarUrl) {
    return <img src={pet.avatarUrl} alt={pet.name} className="h-6 w-6 rounded-full object-cover" />
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-oak-light">
      <span className="u1-serif text-caption-xs font-semibold text-ink">{pet.name.slice(0, 1)}</span>
    </span>
  )
}

export default function ActivePetSwitcher() {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const { toastEl, showToast } = useToast({ durationMs: 2500 })
  const [open, setOpen] = useState(false)

  const petsQuery = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: !!user,
  })

  const setActiveM = useMutation({
    mutationFn: (petId: string | null) => trpc.pet.setActive.mutate({ petId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      void queryClient.invalidateQueries({ queryKey: ['pet'] })
      void queryClient.invalidateQueries({ queryKey: ['petHealth'] })
      setOpen(false)
    },
    onError: () => showToast(pc('pets.switcherFail')),
  })

  const pets = petsQuery.data ?? []
  const activePetId = user?.activePetId ?? null
  const current = pets.find((p) => p.id === activePetId) ?? null

  /* 零宠不渲染；未登录不渲染 */
  if (!user || pets.length === 0) return null

  const onPick = (petId: string | null) => {
    if (petId === activePetId) {
      setOpen(false)
      return
    }
    setActiveM.mutate(petId)
  }

  /* 单宠：pill 仅展示不展开（注记），无 sheet */
  if (pets.length === 1) {
    return (
      <div className="mt-3 flex items-center gap-2" data-testid="active-pet-switcher">
        <span className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 ring-1 ring-line-ring">
          <MiniAvatar pet={pets[0]} />
          <span className="text-caption font-semibold">{pets[0].name}</span>
        </span>
        <span className="text-caption-xs text-ink-placeholder">{pc('pets.switcherSingleNote')}</span>
        {toastEl}
      </div>
    )
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="active-pet-switcher"
        className="flex min-h-[44px] items-center gap-2 rounded-full bg-card px-3 py-1.5 ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92"
      >
        {current ? (
          <MiniAvatar pet={current} />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sunken">
            <PawPrint className="h-3.5 w-3.5 text-ink" strokeWidth={1.5} />
          </span>
        )}
        <span className="text-caption font-semibold">{current ? current.name : pc('pets.switcherAll')}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-secondary" strokeWidth={1.5} />
      </button>

      {open ? (
        <BottomSheet title={pc('pets.switcherTitle')} onClose={() => setOpen(false)} testId="active-pet-sheet">
          <ul className="flex flex-col gap-2">
            {/* 「全部宠物」项：petId=null 清除选定 */}
            <li>
              <button
                type="button"
                onClick={() => onPick(null)}
                disabled={setActiveM.isPending}
                data-testid="active-pet-all"
                className="flex min-h-[44px] w-full items-center gap-3 rounded-control border border-line p-3 text-left transition active:scale-[0.99] disabled:opacity-60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sunken">
                  <PawPrint className="h-4 w-4 text-ink" strokeWidth={1.5} />
                </span>
                <span className="flex-1 text-body-sm font-semibold">{pc('pets.switcherAll')}</span>
                {activePetId === null ? (
                  <Check className="h-4 w-4 text-brand-primary-pressed" strokeWidth={2} />
                ) : null}
              </button>
            </li>
            {pets.map((pet) => (
              <li key={pet.id}>
                <button
                  type="button"
                  onClick={() => onPick(pet.id)}
                  disabled={setActiveM.isPending}
                  data-testid={`active-pet-item-${pet.id}`}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-control border border-line p-3 text-left transition active:scale-[0.99] disabled:opacity-60"
                >
                  {pet.avatarUrl ? (
                    <img src={pet.avatarUrl} alt={pet.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-oak-light">
                      <span className="u1-serif text-body-sm font-semibold text-ink">{pet.name.slice(0, 1)}</span>
                    </span>
                  )}
                  <span className="flex-1 text-body-sm font-semibold">{pet.name}</span>
                  {activePetId === pet.id ? (
                    <Check className="h-4 w-4 text-brand-primary-pressed" strokeWidth={2} />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      ) : null}
      {toastEl}
    </div>
  )
}
