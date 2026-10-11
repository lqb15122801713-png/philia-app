/**
 * TicketNewPage · /support/new 小棉花提单（补缺大批片 4）
 *
 * - 表单：类型四枚举（提建议/要吐槽/表扬/其他）+ 相关门店（store.listNearby，
 *   照预约页取店方式）+ 描述文本域 + 附图选传（≤3，shared uploadImage
 *   relDir='ticket/apply'）+ 联系方式（默认回显本人 users.phone，可改）；
 * - 服务时间公示卡：serviceLoop.serviceHours 端口值；端口无值整卡不渲染（不上假时效）；
 * - 提交 → serviceLoop.ticketCreate → 跳 /support/:id 详情（幂等单号 TK-日序 server 分配）。
 *
 * 画布化（产品-1010 画布全屏批片 3 末片 · 工艺照 MePage/MallPage）：三块入册
 * （ticketNew.header/form/hours），块序/显隐=useCanvasLayout('ticketNew')
 * （published→注册表默认序尾补，空=TICKET_NEW_DEFAULT_ORDER 兜底）；文案键挂 CK 锚
 * （select option/textarea placeholder 等受限位挂不上，键如实入块 copyKeys）；
 * 预览=CanvasLayoutLoader+?canvasPreview=1 水印注记。店锚复用本屏既有 storesQ
 * （?canvasStore= > 记忆门店 > listNearby 首店，零增发查询）。块内逻辑/查询/状态机/
 * 提交链路零改动，data-testid 原值全保留。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { ImagePlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasLayoutLoader, CK, friendlyError, getApiBase, uploadImage, useCanvasLayout, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { readLastBooking } from '@/lib/bookingPrefill'
import { mc } from '../components/member/copy'
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

/** 画布注册表默认序兜底（=改造前 JSX 序；canvas.blocks 失败/空时用） */
const TICKET_NEW_DEFAULT_ORDER = ['ticketNew.header', 'ticketNew.form', 'ticketNew.hours'] as const

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

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  )
  /* 画布预览店锚（?canvasStore=；照 MemberCenterPage 口径优先于记忆门店/就近首店） */
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), [])
  const memoryStoreId = useMemo(() => readLastBooking()?.storeId ?? null, [])

  // 门店列表=预约页同款取店口径（store.listNearby 公开读口）
  const storesQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  })
  /* 画布布局店锚（照 MemberCenterPage 口径）：?canvasStore= 预览店锚 > readLastBooking
     记忆门店 > listNearby 首店（storesQ 为既有查询，零增发） */
  const ticketNewStoreId = previewStoreId ?? memoryStoreId ?? storesQ.data?.stores?.[0]?.id ?? null

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补） ---- */
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  })
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'ticketNew')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return items.length > 0 ? items : TICKET_NEW_DEFAULT_ORDER.map((blockKey) => ({ blockKey }))
  }, [blocksQ.data])
  const layout = useCanvasLayout('ticketNew', ticketNewStoreId, registryBlocks)

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

  /* 块渲染器（块内逻辑零改动——三块照改造前 JSX 逐字搬，文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. ticketNew.header：U1-A 统一返回条（←圆钮+标题），固定返回工单列表 */
    'ticketNew.header': () => (
      <PageHeader title={<CK k="ticket.newTitle">{sl('ticket.newTitle')}</CK>} fallback="/support" className="pt-6" />
    ),

    /* 2. ticketNew.form：提单表单整块（类型/门店/描述/附图/联系方式 + 表单错误行 + 提交钮；
          内层 flex gap-3 还原改造前卡片间距） */
    'ticketNew.form': () => (
      <div className="flex flex-col gap-3">
        {/* 类型四枚举 */}
        <div className="u1-card p-4">
          <span className={labelCls}><CK k="ticket.typeLabel">{sl('ticket.typeLabel')}</CK></span>
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
                <CK k={opt.key}>{sl(opt.key)}</CK>
              </button>
            ))}
          </div>
        </div>

        {/* 相关门店 */}
        <div className="u1-card p-4">
          <label className={labelCls} htmlFor="ticket-store"><CK k="ticket.storeLabel">{sl('ticket.storeLabel')}</CK></label>
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
          <label className={labelCls} htmlFor="ticket-desc"><CK k="ticket.descLabel">{sl('ticket.descLabel')}</CK></label>
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
          <span className={labelCls}><CK k="ticket.photosLabel">{sl('ticket.photosLabel')}</CK></span>
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
                <span className="text-caption-xs"><CK k="ticket.photoAdd">{sl('ticket.photoAdd')}</CK></span>
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
          <label className={labelCls} htmlFor="ticket-contact"><CK k="ticket.contactLabel">{sl('ticket.contactLabel')}</CK></label>
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

        {formError ? <p className="text-caption text-danger-deep">{formError}</p> : null}

        <button
          type="button"
          data-testid="ticket-submit"
          disabled={createM.isPending}
          onClick={onSubmit}
          className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
        >
          {createM.isPending ? <CK k="ticket.submitting">{sl('ticket.submitting')}</CK> : <CK k="ticket.submit">{sl('ticket.submit')}</CK>}
        </button>
      </div>
    ),

    /* 3. ticketNew.hours：服务时间公示（serviceHours 端口值；端口无值整卡不渲染，不上假时效）。
          改造前位置在表单卡与提交钮之间；入块后默认序落在 form 块（含提交钮）之后——
          仅端口配置 hours 时有感，已在 NOTES 报备 */
    'ticketNew.hours': () =>
      hoursQ.data?.text ? (
        <div className="u1-card p-4" data-testid="ticket-hours">
          <p className="text-caption font-semibold text-ink"><CK k="ticket.hoursTitle">{sl('ticket.hoursTitle')}</CK></p>
          <p className="u1-num mt-1 text-caption text-ink-secondary">
            <CK k="ticket.hoursLine">{sl('ticket.hoursLine', { hours: hoursQ.data.text })}</CK>
          </p>
        </div>
      ) : null,
  }

  return (
    <CanvasLayoutLoader pageKey="ticketNew" storeId={ticketNewStoreId}>
      <div className="px-4 pb-6">
        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="pt-3 text-center text-caption-xs text-ink-secondary" data-testid="ticket-new-canvas-preview-note">
            <CK k="mc.canvasExampleNote">{mc('mc.canvasExampleNote')}</CK>
          </p>
        ) : null}
        {/* 页头裸段置顶惯例照 MePage：header 恒置顶；form/hours 裹在原表单 flex 容器内
            （包层 section 为 flex 子项吃 gap-3，间距与改造前一致） */}
        {layout.map((b) =>
          b.visible && b.blockKey === 'ticketNew.header' ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
        <div className="mt-4 flex flex-col gap-3" data-testid="ticket-form">
          {layout.map((b) =>
            b.visible && b.blockKey !== 'ticketNew.header' ? (
              <section data-block-key={b.blockKey} key={b.blockKey}>
                {renderers[b.blockKey]?.() ?? null}
              </section>
            ) : null,
          )}
        </div>
      </div>
    </CanvasLayoutLoader>
  )
}
