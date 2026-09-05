/**
 * PetsPage · /philia/pets 宠物档案（T2.1）
 *
 * - 列表：pet.list（头像/名称/品种/生日/体重/疫苗/性格标签），空态引导建档；
 * - 新增/编辑表单：pet.upsert（zod 级校验：重量 >0 ≤500、日期 YYYY-MM-DD 合法、
 *   名字 1-32 字、标签 ≤12 个每个 ≤16 字）；头像 uploadImage 上传，
 *   relDir=pets/<petId>（新建时先建档拿 id 再上传回写）；
 * - 疫苗有效期：临期（<30 天）橙色提醒、过期红色警示（寄养硬校验提示）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Cake, PawPrint, Pencil, Plus, Scale, Syringe, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { getApiBase, uploadImage, usePhiliaClient } from '@philia/shared'
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  daysUntil,
  formatDateCn,
} from '../components/home/common'

/* ------------------------------------------------------------------ */
/* 表单 zod 校验（镜像 server pet.upsert 规则）                           */
/* ------------------------------------------------------------------ */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00`).getTime()), '日期不合法')

const petFormSchema = z.object({
  name: z.string().trim().min(1, '宠物名不能为空').max(32, '名字最长 32 字'),
  species: z.enum(['dog', 'cat', 'other'], { message: '请选择物种' }),
  breed: z.string().trim().max(64, '品种最长 64 字').optional(),
  birthday: isoDate.optional(),
  weightKg: z
    .number({ message: '体重须为数字' })
    .positive('体重须大于 0')
    .max(500, '体重超出合理范围')
    .optional(),
  vaccineValidUntil: isoDate.optional(),
  neutered: z.boolean().optional(),
  temperamentTags: z
    .array(z.string().trim().min(1, '标签不能为空').max(16, '单个标签最长 16 字'))
    .max(12, '性格标签最多 12 个')
    .optional(),
})

type PetFormValues = z.infer<typeof petFormSchema>

/** 表单原始状态（输入框字符串态，提交时转换校验） */
interface FormState {
  name: string
  species: 'dog' | 'cat' | 'other'
  breed: string
  birthday: string
  weightKg: string
  vaccineValidUntil: string
  neutered: boolean
  temperamentTags: string[]
  avatarUrl: string | null
}

const EMPTY_FORM: FormState = {
  name: '',
  species: 'dog',
  breed: '',
  birthday: '',
  weightKg: '',
  vaccineValidUntil: '',
  neutered: false,
  temperamentTags: [],
  avatarUrl: null,
}

const PRESET_TAGS = ['亲人', '胆小', '活泼', '安静', '好动', '粘人', '怕生', '友好']

const SPECIES_OPTIONS: Array<{ value: FormState['species']; label: string }> = [
  { value: 'dog', label: '狗狗' },
  { value: 'cat', label: '猫咪' },
  { value: 'other', label: '其他' },
]

/* ------------------------------------------------------------------ */
/* 疫苗状态徽章                                                         */
/* ------------------------------------------------------------------ */

function VaccineBadge({ until }: { until: string | null }) {
  if (!until) {
    return (
      <span className="rounded-tag bg-sunken px-2 py-1 text-caption text-ink-placeholder">
        未登记疫苗
      </span>
    )
  }
  const days = daysUntil(until)
  if (days < 0) {
    return (
      <span className="rounded-tag bg-danger-light px-2 py-1 text-caption text-danger-deep">
        疫苗已过期 · 寄养前需补种
      </span>
    )
  }
  if (days < 30) {
    return (
      <span className="rounded-tag bg-brand-secondary-light px-2 py-1 text-caption text-brand-primary-pressed">
        疫苗 {days} 天后到期 · 寄养需有效期内
      </span>
    )
  }
  return (
    <span className="rounded-tag bg-success-light px-2 py-1 text-caption text-success-deep">
      疫苗有效至 {until}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* 新增/编辑表单                                                        */
/* ------------------------------------------------------------------ */

function PetForm({
  initial,
  editingId,
  onDone,
  onCancel,
}: {
  initial: FormState
  editingId: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const { trpc, queryClient } = usePhiliaClient()
  const [form, setForm] = useState<FormState>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      temperamentTags: f.temperamentTags.includes(tag)
        ? f.temperamentTags.filter((t) => t !== tag)
        : [...f.temperamentTags, tag],
    }))
  }

  const onPickAvatar = (file: File | null) => {
    setAvatarFile(file)
    if (avatarPreview && avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(file ? URL.createObjectURL(file) : form.avatarUrl)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: PetFormValues) => {
      // 第一步：upsert 档案（拿到 petId）
      const res = await trpc.pet.upsert.mutate({ ...values, id: editingId ?? undefined })
      const petId = res.pet.id
      // 第二步：有新头像则上传到 pets/<petId> 并回写 avatarUrl
      if (avatarFile) {
        const { url } = await uploadImage(getApiBase(), avatarFile, `pets/${petId}`)
        await trpc.pet.upsert.mutate({ ...values, id: petId, avatarUrl: url })
      }
      return petId
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pet'] })
      onDone()
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : '保存失败，请稍后重试')
    },
  })

  const onSubmit = () => {
    setSubmitError(null)
    const candidate = {
      name: form.name,
      species: form.species,
      breed: form.breed.trim() || undefined,
      birthday: form.birthday || undefined,
      weightKg: form.weightKg.trim() === '' ? undefined : Number(form.weightKg),
      vaccineValidUntil: form.vaccineValidUntil || undefined,
      neutered: form.neutered,
      temperamentTags: form.temperamentTags.length > 0 ? form.temperamentTags : undefined,
    }
    const parsed = petFormSchema.safeParse(candidate)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    saveMutation.mutate(parsed.data)
  }

  const inputCls =
    'w-full rounded-input border border-line bg-card px-3 py-2.5 text-body outline-none transition-colors focus:border-brand-primary'
  const labelCls = 'mb-1 block text-caption text-ink-secondary'
  const errCls = 'mt-1 text-caption text-danger-deep'

  return (
    <div className="rounded-card bg-card p-4 shadow-card">
      <p className="text-title">{editingId ? '编辑档案' : '新增宠物'}</p>

      {/* 头像 */}
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sunken"
          aria-label="上传头像"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="头像预览" className="h-full w-full object-cover" />
          ) : (
            <PawPrint className="h-8 w-8 text-ink-placeholder" strokeWidth={1.5} />
          )}
        </button>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full bg-brand-primary-light px-4 py-2 text-caption text-brand-primary-pressed"
          >
            {avatarPreview ? '更换头像' : '上传头像'}
          </button>
          <p className="mt-1 text-caption text-ink-placeholder">上传前自动压缩，最长边 2000px</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* 名字 / 物种 */}
      <div className="mt-4">
        <label className={labelCls} htmlFor="pet-name">名字 *</label>
        <input
          id="pet-name"
          className={inputCls}
          value={form.name}
          maxLength={32}
          placeholder="TA 的名字"
          onChange={(e) => set('name', e.target.value)}
        />
        {errors.name ? <p className={errCls}>{errors.name}</p> : null}
      </div>
      <div className="mt-4">
        <span className={labelCls}>物种 *</span>
        <div className="flex gap-2">
          {SPECIES_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('species', opt.value)}
              className={`flex-1 rounded-full border px-3 py-2 text-body transition-colors ${
                form.species === opt.value
                  ? 'border-brand-primary bg-brand-primary-light text-brand-primary-pressed'
                  : 'border-line bg-card text-ink-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {errors.species ? <p className={errCls}>{errors.species}</p> : null}
      </div>

      {/* 品种 / 生日 / 体重 / 疫苗 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="pet-breed">品种</label>
          <input
            id="pet-breed"
            className={inputCls}
            value={form.breed}
            maxLength={64}
            placeholder="如：金毛"
            onChange={(e) => set('breed', e.target.value)}
          />
          {errors.breed ? <p className={errCls}>{errors.breed}</p> : null}
        </div>
        <div>
          <label className={labelCls} htmlFor="pet-birthday">生日</label>
          <input
            id="pet-birthday"
            type="date"
            className={inputCls}
            value={form.birthday}
            onChange={(e) => set('birthday', e.target.value)}
          />
          {errors.birthday ? <p className={errCls}>{errors.birthday}</p> : null}
        </div>
        <div>
          <label className={labelCls} htmlFor="pet-weight">体重（kg）</label>
          <input
            id="pet-weight"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            className={inputCls}
            value={form.weightKg}
            placeholder="如：4.5"
            onChange={(e) => set('weightKg', e.target.value)}
          />
          {errors.weightKg ? <p className={errCls}>{errors.weightKg}</p> : null}
        </div>
        <div>
          <label className={labelCls} htmlFor="pet-vaccine">疫苗有效期至</label>
          <input
            id="pet-vaccine"
            type="date"
            className={inputCls}
            value={form.vaccineValidUntil}
            onChange={(e) => set('vaccineValidUntil', e.target.value)}
          />
          {errors.vaccineValidUntil ? <p className={errCls}>{errors.vaccineValidUntil}</p> : null}
        </div>
      </div>

      {/* 绝育 */}
      <label className="mt-4 flex items-center gap-2 text-body">
        <input
          type="checkbox"
          checked={form.neutered}
          onChange={(e) => set('neutered', e.target.checked)}
          className="h-4 w-4 accent-[#D98E5F]"
        />
        已绝育
      </label>

      {/* 性格标签 */}
      <div className="mt-4">
        <span className={labelCls}>性格标签（最多 12 个）</span>
        <div className="flex flex-wrap gap-2">
          {PRESET_TAGS.map((tag) => {
            const on = form.temperamentTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1.5 text-caption transition-colors ${
                  on
                    ? 'border-brand-primary bg-brand-primary-light text-brand-primary-pressed'
                    : 'border-line bg-card text-ink-secondary'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
        {form.temperamentTags.filter((t) => !PRESET_TAGS.includes(t)).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {form.temperamentTags
              .filter((t) => !PRESET_TAGS.includes(t))
              .map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-brand-primary-light px-3 py-1.5 text-caption text-brand-primary-pressed"
                >
                  {tag}
                  <button type="button" aria-label={`移除 ${tag}`} onClick={() => toggleTag(tag)}>
                    <X className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </span>
              ))}
          </div>
        ) : null}
        <CustomTagInput
          disabled={form.temperamentTags.length >= 12}
          onAdd={(tag) => {
            if (!form.temperamentTags.includes(tag)) {
              setForm((f) => ({ ...f, temperamentTags: [...f.temperamentTags, tag] }))
            }
          }}
        />
        {errors.temperamentTags ? <p className={errCls}>{errors.temperamentTags}</p> : null}
      </div>

      {submitError ? <p className={`${errCls} mt-3`}>{submitError}</p> : null}

      {/* 动作 */}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-line py-2.5 text-body text-ink-secondary"
        >
          取消
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={onSubmit}
          className="flex-1 rounded-full bg-brand-primary py-2.5 text-body text-white transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
        >
          {saveMutation.isPending ? '保存中…' : '保存档案'}
        </button>
      </div>
    </div>
  )
}

/** 自定义标签输入（回车/按钮添加，≤16 字） */
function CustomTagInput({ onAdd, disabled }: { onAdd: (tag: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('')
  const add = () => {
    const tag = value.trim().slice(0, 16)
    if (tag) onAdd(tag)
    setValue('')
  }
  return (
    <div className="mt-2 flex gap-2">
      <input
        className="flex-1 rounded-input border border-line bg-card px-3 py-2 text-caption outline-none focus:border-brand-primary"
        placeholder={disabled ? '标签已达上限' : '自定义标签，回车添加'}
        value={value}
        maxLength={16}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
      <button
        type="button"
        onClick={add}
        disabled={disabled || !value.trim()}
        className="rounded-full bg-brand-primary-light px-4 text-caption text-brand-primary-pressed disabled:opacity-50"
      >
        添加
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 页面                                                                 */
/* ------------------------------------------------------------------ */

export default function PetsPage() {
  const { trpc } = usePhiliaClient()
  const petsQuery = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
  })
  const [editing, setEditing] = useState<{ id: string | null; initial: FormState } | null>(null)

  const openCreate = () => setEditing({ id: null, initial: EMPTY_FORM })
  const openEdit = (pet: NonNullable<typeof petsQuery.data>[number]) =>
    setEditing({
      id: pet.id,
      initial: {
        name: pet.name,
        species: (pet.species as FormState['species']) ?? 'dog',
        breed: pet.breed ?? '',
        birthday: pet.birthday ?? '',
        weightKg: pet.weightKg !== null ? String(pet.weightKg) : '',
        vaccineValidUntil: pet.vaccineValidUntil ?? '',
        neutered: pet.neutered,
        temperamentTags: pet.temperamentTags ?? [],
        avatarUrl: pet.avatarUrl,
      },
    })

  return (
    <div className="px-4 pb-6">
      <header className="flex items-center gap-2 pt-6">
        <Link
          to="/philia"
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card"
        >
          <ArrowLeft className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
        </Link>
        <h1 className="text-title-lg">宠物档案</h1>
      </header>

      <div className="mt-4 flex flex-col gap-3">
        {petsQuery.isPending ? <LoadingBlock lines={3} /> : null}
        {petsQuery.isError ? (
          <ErrorState message="宠物档案加载失败" onRetry={() => void petsQuery.refetch()} />
        ) : null}
        {petsQuery.data && petsQuery.data.length === 0 && !editing ? (
          <EmptyState
            title="还没有宠物档案"
            desc="建立档案后，预约洗护与寄养更省心"
            action={
              <button
                type="button"
                onClick={openCreate}
                className="mt-2 rounded-full bg-brand-primary px-5 py-2 text-body text-white"
              >
                建立档案
              </button>
            }
          />
        ) : null}

        {petsQuery.data?.map((pet) => (
          <article key={pet.id} className="rounded-card bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              {pet.avatarUrl ? (
                <img
                  src={pet.avatarUrl}
                  alt={pet.name}
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-secondary-light">
                  <PawPrint className="h-6 w-6 text-brand-primary" strokeWidth={1.5} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-body font-semibold">{pet.name}</p>
                  <button
                    type="button"
                    onClick={() => openEdit(pet)}
                    aria-label={`编辑 ${pet.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken"
                  >
                    <Pencil className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
                  </button>
                </div>
                <p className="mt-0.5 text-caption text-ink-secondary">
                  {{ dog: '狗狗', cat: '猫咪', other: '其他' }[pet.species] ?? '其他'}
                  {pet.breed ? ` · ${pet.breed}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-secondary">
                  {pet.birthday ? (
                    <span className="flex items-center gap-1">
                      <Cake className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {formatDateCn(`${pet.birthday}T00:00:00`)}
                    </span>
                  ) : null}
                  {pet.weightKg !== null ? (
                    <span className="flex items-center gap-1">
                      <Scale className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {pet.weightKg} kg
                    </span>
                  ) : null}
                  {pet.neutered ? <span>已绝育</span> : null}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Syringe className="h-3.5 w-3.5 text-ink-placeholder" strokeWidth={1.5} />
                  <VaccineBadge until={pet.vaccineValidUntil} />
                </div>
                {pet.temperamentTags && pet.temperamentTags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pet.temperamentTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-brand-secondary-light px-2 py-0.5 text-caption text-ink"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}

        {editing ? (
          <PetForm
            initial={editing.initial}
            editingId={editing.id}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : petsQuery.data && petsQuery.data.length > 0 ? (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center gap-1.5 rounded-card border border-dashed border-line-strong bg-card py-3.5 text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            新增宠物
          </button>
        ) : null}
      </div>
    </div>
  )
}
