/**
 * TicketNewPage · /support/new 小棉花提单（补缺大批片 4）
 *
 * - 表单：类型四枚举（提建议/要吐槽/表扬/其他）+ 相关门店（store.listNearby，
 *   照预约页取店方式）+ 描述文本域 + 附图选传（≤3，shared uploadImage
 *   relDir='ticket/apply'）+ 联系方式（默认回显本人 users.phone，可改）；
 * - 服务时间公示卡：serviceLoop.serviceHours 端口值；端口无值整卡不渲染（不上假时效）；
 * - 提交 → serviceLoop.ticketCreate → 跳 /support/:id 详情（幂等单号 TK-日序 server 分配）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { friendlyError, getApiBase, uploadImage, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { sl } from '@/copy/serviceloop'

/** 附图上限（客户端口径 ≤3；server 上限 9 更宽，以本页为准） */
const MAX_PHOTOS = 3

type TicketType = 'suggest' | 'complaint' | 'praise' | 'other'

/** 待传附图：File + 本地预览 objectURL（pick 时创建，移除时 revoke） */
interface PendingPhoto {
  file: File
  preview: string
}

const TYPE_OPTIONS: Array<{ value: TicketType; key: 'ticket.typeSuggest' | 'ticket.typeComplaint' | 'ticket.typePraise' | 'ticket.typeOther' }> = [
  { value: 'suggest', key: 'ticket.typeSuggest' },
  { value: 'complaint', key: 'ticket.typeComplaint' },
  { value: 'praise', key: 'ticket.typePraise' },
  { value: 'other', key: 'ticket.typeOther' },
]

export default function TicketNewPage() {
  const navigate = useNavigate()
  const { trpc } = usePhiliaClient()

  const [storeId, setStoreId] = useState('')
  const [type, setType] = useState<TicketType>('suggest')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [contactPhone, setContactPhone] = useState('')
  const [contactTouched, setContactTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /* 补缺修复小批 UX 销项（运营 P3-2）：字段级红标状态（空提交命中的字段） */
  const [fieldError, setFieldError] = useState<'store' | 'desc' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 门店列表=预约页同款取店口径（store.listNearby 公开读口）
  const storesQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  })
  // 客服服务时间公示（配置端口 domain='service'）
  const hoursQ = useQuery({
    queryKey: ['serviceLoop', 'serviceHours'],
    queryFn: () => trpc.serviceLoop.serviceHours.query(),
  })
  // 联系方式缺省回显=users.phone（与 server ticketCreate 缺省口径一致，可改）
  const meQ = useQuery({
    queryKey: ['auth', 'me', 'raw'],
    queryFn: () => trpc.auth.me.query(),
  })
  useEffect(() => {
    if (!contactTouched && meQ.data?.user?.phone) setContactPhone(meQ.data.user.phone)
  }, [contactTouched, meQ.data])

  const createM = useMutation({
    mutationFn: async () => {
      // 先传图（≤3，uploadImage relDir='ticket/apply'），再提单
      const photoUrls: string[] = []
      for (const p of photos) {
        const { url } = await uploadImage(getApiBase(), p.file, 'ticket/apply')
        photoUrls.push(url)
      }
      return trpc.serviceLoop.ticketCreate.mutate({
        storeId,
        type,
        description: description.trim(),
        photoUrls,
        contactPhone: contactPhone.trim() || undefined,
      })
    },
    onSuccess: (r) => {
      navigate(`/support/${r.ticket.id}`, { replace: true })
    },
    onError: (err) => {
      setFormError(friendlyError(err, sl('ticket.submitFail')))
    },
  })

  const onPickPhotos = (files: FileList | null) => {
    if (!files) return
    const picked = Array.from(files).map((file) => ({ file, preview: URL.createObjectURL(file) }))
    const next = [...photos, ...picked].slice(0, MAX_PHOTOS)
    // 超上限截掉的预览立即回收
    for (const p of [...photos, ...picked].slice(MAX_PHOTOS)) URL.revokeObjectURL(p.preview)
    setPhotos(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onSubmit = () => {
    setFormError(null)
    setFieldError(null)
    if (!storeId) {
      setFormError(sl('ticket.storeRequired'))
      setFieldError('store')
      return
    }
    if (!description.trim()) {
      setFormError(sl('ticket.descRequired'))
      setFieldError('desc')
      return
    }
    createM.mutate()
  }

  const inputCls =
    'w-full rounded-control border border-line bg-card px-3 py-2.5 text-body-sm outline-none transition-colors focus:border-brand-primary'
  /* 补缺修复小批 UX 销项（运营 P3-2）：空提交字段级红标（校验失败的字段边框转红，改值即消） */
  const fieldErrCls = 'border-danger-deep focus:border-danger-deep'
  const labelCls = 'mb-1 block text-caption text-ink-secondary'

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回工单列表 */}
      <PageHeader title={sl('ticket.newTitle')} fallback="/support" className="pt-6" />

      <div className="mt-4 flex flex-col gap-3" data-testid="ticket-form">
        {/* 类型四枚举 */}
        <div className="u1-card p-4">
          <span className={labelCls}>{sl('ticket.typeLabel')}</span>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                data-testid={`ticket-type-${opt.value}`}
                onClick={() => setType(opt.value)}
                className={`min-h-[44px] flex-1 rounded-full border px-2 py-2 text-caption transition-colors ${
                  type === opt.value
                    ? 'border-brand-primary bg-brand-primary-light font-semibold text-brand-primary-pressed'
                    : 'border-line bg-card text-ink-secondary'
                }`}
              >
                {sl(opt.key)}
              </button>
            ))}
          </div>
        </div>

        {/* 相关门店 */}
        <div className="u1-card p-4">
          <label className={labelCls} htmlFor="ticket-store">{sl('ticket.storeLabel')}</label>
          <select
            id="ticket-store"
            className={`${inputCls} ${fieldError === 'store' ? fieldErrCls : ''}`}
            aria-invalid={fieldError === 'store'}
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value)
              if (fieldError === 'store') setFieldError(null)
            }}
          >
            <option value="" disabled>
              {sl('ticket.storeRequired')}
            </option>
            {(storesQ.data?.stores ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 问题描述 */}
        <div className="u1-card p-4">
          <label className={labelCls} htmlFor="ticket-desc">{sl('ticket.descLabel')}</label>
          <textarea
            id="ticket-desc"
            className={`${inputCls} min-h-[96px] resize-y ${fieldError === 'desc' ? fieldErrCls : ''}`}
            aria-invalid={fieldError === 'desc'}
            maxLength={1000}
            placeholder={sl('ticket.descPlaceholder')}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              if (fieldError === 'desc') setFieldError(null)
            }}
          />
        </div>

        {/* 附图（选传 ≤3） */}
        <div className="u1-card p-4">
          <span className={labelCls}>{sl('ticket.photosLabel')}</span>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <span key={p.preview} className="relative h-20 w-20 overflow-hidden rounded-tag bg-sunken">
                <img src={p.preview} alt={p.file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={sl('ticket.photoRemove')}
                  onClick={() =>
                    setPhotos((cur) => {
                      URL.revokeObjectURL(cur[i]!.preview)
                      return cur.filter((_, j) => j !== i)
                    })
                  }
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-canvas"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              </span>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-tag border border-dashed border-line-strong text-ink-placeholder"
              >
                <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
                <span className="text-caption-xs">{sl('ticket.photoAdd')}</span>
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onPickPhotos(e.target.files)}
          />
        </div>

        {/* 联系方式（默认回显本人 phone，可改） */}
        <div className="u1-card p-4">
          <label className={labelCls} htmlFor="ticket-contact">{sl('ticket.contactLabel')}</label>
          <input
            id="ticket-contact"
            className={inputCls}
            inputMode="tel"
            maxLength={20}
            placeholder={sl('ticket.contactPlaceholder')}
            value={contactPhone}
            onChange={(e) => {
              setContactTouched(true)
              setContactPhone(e.target.value)
            }}
          />
        </div>

        {/* 服务时间公示（serviceHours 端口值；端口无值整卡不渲染，不上假时效） */}
        {hoursQ.data?.text ? (
          <div className="u1-card p-4" data-testid="ticket-hours">
            <p className="text-caption font-semibold text-ink">{sl('ticket.hoursTitle')}</p>
            <p className="u1-num mt-1 text-caption text-ink-secondary">
              {sl('ticket.hoursLine', { hours: hoursQ.data.text })}
            </p>
          </div>
        ) : null}

        {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}

        <button
          type="button"
          data-testid="ticket-submit"
          disabled={createM.isPending}
          onClick={onSubmit}
          className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
        >
          {createM.isPending ? sl('ticket.submitting') : sl('ticket.submit')}
        </button>
      </div>
    </div>
  )
}
