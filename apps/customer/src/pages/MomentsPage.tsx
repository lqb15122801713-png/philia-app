/**
 * MomentsPage · /philia/moments 服务相册（T2.1）
 *
 * - 数据：listMine 取 completed 预约，逐个 serviceStep.list 拿 before_after 步照片；
 *   按时间（completedAt ?? scheduledStart）倒序成册，封面 = after 图；
 * - 内页：before/after 并排（PhotoWall 的 before_after 对比模式）；
 * - 分享：Web Share API（navigator.share），不可用则复制链接（clipboard，兜底 execCommand）；
 * - 点击照片进全屏查看器（暖深棕 90% 底，保持色温，DESIGN §6.3）。
 */

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronDown, Share2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PhotoWall, usePhiliaClient } from '@philia/shared'
import type { PhotoWallPhoto } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock, formatDateCn } from '../components/home/common'

/** 一册相册：一次完成服务 + 前后对比照 */
interface Album {
  appointmentId: string
  petName: string | null
  serviceName: string | null
  storeName: string | null
  doneAt: Date | null
  cover: PhotoWallPhoto // after 图
  before: PhotoWallPhoto
  after: PhotoWallPhoto
}

/** 全屏照片查看器（90% 暖深棕底） */
function PhotoViewer({ photo, onClose }: { photo: PhotoWallPhoto; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(61,50,41,0.9)] p-4"
      onClick={onClose}
      role="dialog"
      aria-label="查看照片"
    >
      <img
        src={photo.url}
        alt={photo.tag ?? '照片'}
        className="max-h-full max-w-full rounded-card object-contain"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-card"
      >
        <X className="h-5 w-5 text-ink" strokeWidth={1.5} />
      </button>
    </div>
  )
}

/** 单册相册卡片 */
function AlbumCard({ album }: { album: Album }) {
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const title = `${album.petName ?? '毛孩子'}的变美记录`
    const text = `${album.doneAt ? formatDateCn(album.doneAt) : ''} 在菲丽亚完成了${album.serviceName ?? '洗护'}，看看前后对比！`
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (err) {
        // 用户取消分享不视为失败；其他异常走复制链接兜底
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // 剪贴板不可用（非安全上下文）：选中兜底
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <article className="overflow-hidden rounded-card bg-card shadow-card">
      {/* 封面 = after 图 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative block w-full"
        aria-expanded={open}
      >
        <img
          src={album.cover.thumbUrl ?? album.cover.url}
          alt={`${album.petName ?? '宠物'}服务后照片`}
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-[rgba(61,50,41,0.65)] to-transparent p-3 text-left">
          <span>
            <span className="block text-body font-semibold text-white">
              {album.petName ?? '毛孩子'} · {album.serviceName ?? '洗护服务'}
            </span>
            <span className="mt-0.5 block text-caption text-white/85">
              {album.doneAt ? formatDateCn(album.doneAt) : ''}
              {album.storeName ? ` · ${album.storeName}` : ''}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.5}
          />
        </span>
      </button>

      {/* 内页：before/after 对比 + 分享 */}
      {open ? (
        <div className="p-3">
          <PhotoWall
            photos={[album.before, album.after]}
            stepKey="before_after"
            onPhotoClick={(p) => setViewing(p)}
          />
          <button
            type="button"
            onClick={() => void share()}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-primary-light py-2.5 text-body text-brand-primary-pressed transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" strokeWidth={1.5} />
                链接已复制
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
                分享这份美好
              </>
            )}
          </button>
        </div>
      ) : null}

      {viewing ? <PhotoViewer photo={viewing} onClose={() => setViewing(null)} /> : null}
    </article>
  )
}

export default function MomentsPage() {
  const { trpc } = usePhiliaClient()
  const albumsQuery = useQuery({
    queryKey: ['philia', 'moments'],
    queryFn: async (): Promise<Album[]> => {
      const { groups } = await trpc.appointment.listMine.query()
      const completed = groups.completed.slice(0, 12)
      const albums: Album[] = []
      for (const appt of completed) {
        try {
          const steps = await trpc.serviceStep.list.query({ appointmentId: appt.id })
          const ba = steps.find((s) => s.stepKey === 'before_after')
          if (!ba) continue
          const before = ba.photos.find((p) => p.tag === 'before')
          const after = [...ba.photos].reverse().find((p) => p.tag === 'after')
          if (!before || !after) continue
          albums.push({
            appointmentId: appt.id,
            petName: appt.petName,
            serviceName: appt.serviceName,
            storeName: appt.storeName ?? null,
            doneAt: appt.completedAt ?? appt.scheduledStart,
            cover: { id: after.id, url: after.url, thumbUrl: after.thumbUrl ?? undefined },
            before: { id: before.id, url: before.url, thumbUrl: before.thumbUrl ?? undefined },
            after: { id: after.id, url: after.url, thumbUrl: after.thumbUrl ?? undefined },
          })
        } catch {
          // 单册读取失败不阻断整本相册
        }
      }
      // 按完成时间倒序
      albums.sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0))
      return albums
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
        <h1 className="text-title-lg">服务相册</h1>
      </header>

      <div className="mt-4 flex flex-col gap-4">
        {albumsQuery.isPending ? <LoadingBlock lines={3} /> : null}
        {albumsQuery.isError ? (
          <ErrorState message="相册加载失败" onRetry={() => void albumsQuery.refetch()} />
        ) : null}
        {albumsQuery.data && albumsQuery.data.length === 0 ? (
          <EmptyState
            title="相册还是空的"
            desc="完成洗护服务后，前后对比照会自动收进这里"
            action={
              <Link
                to="/booking/grooming"
                className="mt-2 rounded-full bg-brand-primary px-5 py-2 text-body text-white"
              >
                去预约洗护
              </Link>
            }
          />
        ) : null}
        {albumsQuery.data?.map((album) => <AlbumCard key={album.appointmentId} album={album} />)}
      </div>
    </div>
  )
}
