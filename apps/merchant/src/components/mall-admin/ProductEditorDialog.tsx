/**
 * 新增 / 编辑商品弹层（T5.2 · ProductsPage）
 *
 * - 字段：名称 / 分类（主粮/零食/玩具/清洁/其他）/ 描述 / 价格（元输入→分提交）/
 *   库存 / 上下架状态 / 商品图（最多 5 张，首张为主图）。
 * - 图片上传：共享层 uploadImage → POST /api/upload，relDir=`products/<storeId>`；
 *   每张图带「设为封面 / 删除」，上传中禁用提交。
 * - 价格口径：yuanToFen 严格解析（最多两位小数），非法输入不提交；
 *   提交 mall.upsertProduct（带 productId=编辑 / 不带=新增），错误原文 toast。
 */

import { getApiBase, uploadImage, useMe, usePhiliaClient } from '@philia/shared'
import { ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  errMsg,
  fenToYuanInput,
  MAX_PRODUCT_IMAGES,
  PRODUCT_CATEGORIES,
  PRODUCTS_KEY,
  yuanToFen,
  type StoreProduct,
} from './format'
import { Btn, Field, inputCls, Modal, Switch } from './ui'

export interface ProductEditorProps {
  open: boolean
  /** null = 新增；否则编辑该商品 */
  product: StoreProduct | null
  onClose: () => void
}

export default function ProductEditorDialog({ open, product, onClose }: ProductEditorProps) {
  const { trpc, queryClient } = usePhiliaClient()
  const { user } = useMe()
  const storeId = user?.storeId

  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [priceYuan, setPriceYuan] = useState('')
  const [stock, setStock] = useState('')
  const [onShelf, setOnShelf] = useState(true)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(0)
  const [pending, setPending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 每次打开按编辑对象初始化（新增则重置为空表单）
  useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setCategory(product?.category ?? PRODUCT_CATEGORIES[0])
    setDescription(product?.description ?? '')
    setPriceYuan(product ? fenToYuanInput(product.priceFen) : '')
    setStock(product ? String(product.stock) : '')
    setOnShelf(product ? product.status === 'on' : true)
    setImages(product?.images ?? [])
    setUploading(0)
    setPending(false)
  }, [open, product])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY })

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !storeId) return
    const room = MAX_PRODUCT_IMAGES - images.length
    const batch = Array.from(files).slice(0, room)
    if (files.length > room) {
      toast.error(`最多 ${MAX_PRODUCT_IMAGES} 张图，已超出 ${files.length - room} 张未上传`)
    }
    setUploading((n) => n + batch.length)
    for (const file of batch) {
      try {
        const { url } = await uploadImage(getApiBase(), file, `products/${storeId}`)
        setImages((xs) => (xs.length < MAX_PRODUCT_IMAGES ? [...xs, url] : xs))
      } catch (e) {
        toast.error(errMsg(e))
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const setCover = (idx: number) =>
    setImages((xs) => {
      if (idx <= 0 || idx >= xs.length) return xs
      const next = [...xs]
      const [hit] = next.splice(idx, 1)
      next.unshift(hit!)
      return next
    })

  const removeImage = (idx: number) => setImages((xs) => xs.filter((_, i) => i !== idx))

  const submit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return toast.error('请输入商品名称')
    const priceFen = yuanToFen(priceYuan)
    if (priceFen === null) return toast.error('价格需为非负数字，最多两位小数（元）')
    const stockNum = Number(stock.trim())
    if (!/^\d+$/.test(stock.trim()) || stockNum > 1_000_000) {
      return toast.error('库存需为 0 ~ 1000000 的整数')
    }
    if (uploading > 0) return toast.error('图片上传中，请稍候')
    setPending(true)
    try {
      await trpc.mall.upsertProduct.mutate({
        productId: product?.id,
        category,
        name: trimmedName,
        description: description.trim() || undefined,
        images,
        priceFen,
        stock: stockNum,
        status: onShelf ? 'on' : 'off',
      })
      toast.success(product ? '商品已更新' : '商品已创建')
      await invalidate()
      onClose()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? '编辑商品' : '新增商品'}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" onClick={() => void submit()} disabled={pending || uploading > 0}>
            {pending ? '保存中…' : uploading > 0 ? '图片上传中…' : '保存'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="商品名称" required>
          <input
            className={inputCls}
            value={name}
            maxLength={128}
            placeholder="如：鸡肉冻干全价猫粮 1.5kg"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="分类" required>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="库存" required>
            <input
              className={inputCls}
              value={stock}
              inputMode="numeric"
              placeholder="0"
              onChange={(e) => setStock(e.target.value)}
            />
          </Field>
        </div>

        <Field label="价格（元）" required hint="最多两位小数，提交时自动换算为分">
          <input
            className={inputCls}
            value={priceYuan}
            inputMode="decimal"
            placeholder="如 39.90"
            onChange={(e) => setPriceYuan(e.target.value)}
          />
        </Field>

        <Field label="商品描述">
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            value={description}
            maxLength={2000}
            placeholder="规格、适用阶段、配料等（选填）"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field
          label={`商品图（${images.length}/${MAX_PRODUCT_IMAGES}，首张为主图）`}
          hint={storeId ? undefined : '门店信息加载中，暂不能上传'}
        >
          <div className="grid grid-cols-5 gap-2">
            {images.map((url, idx) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-tag border border-line">
                <img src={url} alt={`商品图 ${idx + 1}`} className="h-full w-full object-cover" />
                {idx === 0 ? (
                  <span className="absolute left-0 top-0 flex items-center gap-0.5 rounded-br-tag bg-brand-primary px-1 py-0.5 text-[10px] text-white">
                    <Star size={10} strokeWidth={2} />
                    主图
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-ink/45 py-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {idx !== 0 ? (
                    <button
                      type="button"
                      onClick={() => setCover(idx)}
                      className="rounded-full bg-card px-1.5 py-0.5 text-[10px] text-ink"
                    >
                      设为封面
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    aria-label="删除图片"
                    className="rounded-full bg-card p-1 text-danger"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
            {images.length + uploading < MAX_PRODUCT_IMAGES ? (
              <button
                type="button"
                disabled={!storeId || uploading > 0}
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-tag border border-dashed border-line-strong text-ink-secondary transition-colors hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus size={18} strokeWidth={1.5} />
                <span className="text-[10px]">上传</span>
              </button>
            ) : null}
            {Array.from({ length: uploading }).map((_, i) => (
              <div
                key={`uploading-${i}`}
                className="flex aspect-square items-center justify-center rounded-tag bg-sunken"
              >
                <Loader2 size={18} className="animate-spin text-ink-secondary" />
              </div>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void pickFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </Field>

        <div className="flex items-center justify-between rounded-input bg-sunken px-3 py-2.5">
          <div>
            <div className="text-body text-ink">上架销售</div>
            <div className="text-caption text-ink-secondary">关闭后客户端商城立即不可见</div>
          </div>
          <Switch checked={onShelf} onChange={setOnShelf} label="上架销售" />
        </div>
      </div>
    </Modal>
  )
}
