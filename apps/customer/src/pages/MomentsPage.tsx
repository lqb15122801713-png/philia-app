/**
 * MomentsPage · /philia/moments 服务相册（T2.1；换皮批片 2 案例流取齐）
 *
 * - 数据：listMine 取 completed 预约，逐个 serviceStep.list 拿 before_after 步照片；
 *   按时间（completedAt ?? scheduledStart）倒序成册，封面 = after 图；
 * - 案例流=首页同款双列不等高网格（hv2-cases/hv2-case 同型同件，
 *   styles/home-v2.css 既有类）：白卡圆角 16 + 图不定高 + 题 13/600 两行截断
 *   + mono 9 溯源行（时刻 · 门店）；
 * - 内页：点封面展开 before/after 并排（PhotoWall 的 before_after 对比模式）；
 * - 分享：Web Share API（navigator.share），不可用则复制链接（clipboard，兜底 execCommand）；
 * - 点击照片进全屏查看器（暖深棕 90% 底，保持色温，DESIGN §6.3）；
 * - 空态三句话结构保留（是什么/为什么/去哪 + 深棕主钮出口件）。
 */

import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PhotoViewer, PhotoWall, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import type { PhotoWallPhoto } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock, formatDateCn } from '../components/home/common'
import { moc } from '@/copy/moments'

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

/** 全屏查看器：换皮批片 5 归并 @philia/shared PhotoViewer（单图 photos=[p]，无切换、无键盘） */

/** 单册相册卡（hv2-case 同型同件：图不定高 + 题 13/600 两行截断 + mono 9 溯源行） */
function AlbumCard({ album }: { album: Album }) {
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const title = moc('moments.shareTitle', { pet: album.petName ?? '毛孩子' })
    const text = moc('moments.shareText', { date: album.doneAt ? formatDateCn(album.doneAt) : '', service: album.serviceName ?? '洗护' })
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
    <article className="hv2-case">
      {/* 封面 = after 图（不定高，错落节奏）；整面=展开/收起 before/after 内页 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative block w-full text-left"
        aria-expanded={open}
      >
        <img
          src={album.cover.thumbUrl ?? album.cover.url}
          alt={`${album.petName ?? '宠物'}服务后照片`}
          className="w-full object-cover"
          loading="lazy"
        />
        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90">
          <ChevronDown
            className={`h-4 w-4 text-ink transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.5}
          />
        </span>
        <span className="tt">
          {album.petName ?? '毛孩子'} · {album.serviceName ?? '洗护服务'}
        </span>
        <span className="src">
          {album.doneAt ? formatDateCn(album.doneAt) : ''}
          {album.storeName ? ` · ${album.storeName}` : ''}
        </span>
      </button>

      {/* 内页：before/after 对比 + 分享 */}
      {open ? (
        <div className="px-3 pb-3">
          <PhotoWall
            photos={[album.before, album.after]}
            stepKey="before_after"
            onPhotoClick={(p) => setViewing(p)}
          />
          {/* 次级钮=白卡墨描边（定稿次级行动惯例） */}
          <button
            type="button"
            onClick={() => void share()}
            className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-line-strong text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" strokeWidth={1.5} />
                {moc('moments.shareCopied')}
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
                {moc('moments.shareCta')}
              </>
            )}
          </button>
        </div>
      ) : null}

      {viewing ? (
        <PhotoViewer
          photos={[viewing]}
          index={0}
          onClose={() => setViewing(null)}
          onNavigate={() => {}}
          keyboard={false}
        />
      ) : null}
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
      {/* U1-A：统一返回条（←圆钮+标题），固定返回 philia 页 */}
      <PageHeader title={moc('moments.title')} fallback="/philia" className="pt-6" />

      <div className="mt-4">
        {albumsQuery.isPending ? <LoadingBlock lines={3} /> : null}
        {albumsQuery.isError ? (
          <ErrorState message={moc('moments.loadFail')} onRetry={() => void albumsQuery.refetch()} />
        ) : null}
        {albumsQuery.data && albumsQuery.data.length === 0 ? (
          <EmptyState
            title={moc('moments.emptyTitle')}
            desc={moc('moments.emptyBody')}
            action={
              <Link
                to="/booking/grooming"
                className="inline-flex items-center rounded-control bg-philia-gradient px-[30px] py-[13px] text-body-sm font-semibold text-[#F6EFDD] shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {moc('moments.emptyCta')}
              </Link>
            }
          />
        ) : null}
      </div>

      {/* 案例流：双列不等高网格（hv2-cases 同型同件，align-items:start 错落） */}
      {albumsQuery.data && albumsQuery.data.length > 0 ? (
        <div className="hv2-cases mt-4">
          {albumsQuery.data.map((album) => (
            <AlbumCard key={album.appointmentId} album={album} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
