/**
 * MomentsPage · /philia/moments 服务相册（T2.1；换皮批片 2 案例流取齐；
 * 补缺大批片 4 数据层点亮）
 *
 * - 数据：serviceLoop.albumFeed 一次聚合（completed + in_service 本人单，六步分组
 *   + 有效照片批拉，替掉原 listMine + 逐单 serviceStep.list 的 N+1）；
 * - 进行中卡片（in_service）只显示已确认（done）步照片（server 侧口径），
 *   卡面行注「进行中 · 已确认 {n} 步」；完成单封面 = after 图；
 * - 案例流=首页同款双列不等高网格（hv2-cases/hv2-case 同型同件，
 *   styles/home-v2.css 既有类）：白卡圆角 16 + 图不定高 + 题 13/600 两行截断
 *   + mono 9 溯源行（时刻 · 门店）；
 * - 内页：点封面展开 before/after 并排（PhotoWall 的 before_after 对比模式）；
 *   无完整前后对的卡片展开为照片九宫格（真实照片，不画假件）；
 * - 分享：Web Share API（navigator.share），不可用则复制链接（clipboard，兜底 execCommand）；
 *   仅完成单卡片开放（进行中单无完成时刻，不上分享假语境）；
 * - 点击照片进全屏查看器（暖深棕 90% 底，保持色温，DESIGN §6.3）；
 * - 空态三句话结构保留（是什么/为什么/去哪 + 深棕主钮出口件）；文案全走 SL_COPY album.*。
 */

import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PhotoViewer, PhotoWall, usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import type { PhotoWallPhoto } from '@philia/shared'
import { EmptyState, ErrorState, LoadingBlock, formatDateCn } from '../components/home/common'
import { sl } from '@/copy/serviceloop'

/** 一册相册：一次服务（完成/进行中）+ 可见照片（进行中仅已确认步） */
interface Album {
  appointmentId: string
  petName: string | null
  serviceName: string | null
  storeName: string | null
  /** 完成时刻（进行中单为 null） */
  doneAt: Date | null
  /** 进行中单已确认（done）步数 */
  doneStepCount: number
  status: 'completed' | 'in_service'
  /** 全部可见照片（按拍摄时间序） */
  photos: PhotoWallPhoto[]
  /** 封面（完成单=after 图，进行中=最新可见照片） */
  cover: PhotoWallPhoto
  before: PhotoWallPhoto | null
  after: PhotoWallPhoto | null
}

/** 全屏查看器：换皮批片 5 归并 @philia/shared PhotoViewer（单图 photos=[p]，无切换、无键盘） */

/** 单册相册卡（hv2-case 同型同件：图不定高 + 题 13/600 两行截断 + mono 9 溯源行） */
function AlbumCard({ album }: { album: Album }) {
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<PhotoWallPhoto | null>(null)
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const title = sl('album.shareTitle', { pet: album.petName ?? sl('album.petFallback') })
    const text = sl('album.shareText', {
      date: album.doneAt ? formatDateCn(album.doneAt) : '',
      service: album.serviceName ?? sl('album.serviceFallback'),
    })
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

  const inService = album.status === 'in_service'

  return (
    <article className="hv2-case" data-testid={`album-card-${album.appointmentId}`}>
      {/* 封面 = after 图（进行中=最新已确认步照片；不定高，错落节奏）；整面=展开/收起内页 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative block w-full text-left"
        aria-expanded={open}
      >
        <img
          src={album.cover.thumbUrl ?? album.cover.url}
          alt={sl('album.photoAlt', { pet: album.petName ?? sl('album.petFallback') })}
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
          {album.petName ?? sl('album.petFallback')} · {album.serviceName ?? sl('album.serviceFallback')}
        </span>
        <span className="src">
          {inService
            ? sl('album.inProgressNote', { n: album.doneStepCount })
            : album.doneAt
              ? formatDateCn(album.doneAt)
              : ''}
          {album.storeName ? ` · ${album.storeName}` : ''}
        </span>
      </button>

      {/* 内页：完成单优先 before/after 对比，否则照片九宫格；进行中单同九宫格（仅已确认步照片） */}
      {open ? (
        <div className="px-3 pb-3">
          {album.before && album.after ? (
            <PhotoWall
              photos={[album.before, album.after]}
              stepKey="before_after"
              onPhotoClick={(p) => setViewing(p)}
            />
          ) : (
            <PhotoWall photos={album.photos} onPhotoClick={(p) => setViewing(p)} />
          )}
          {/* 次级钮=白卡墨描边（定稿次级行动惯例）；进行中单不上分享（无完成时刻假语境） */}
          {!inService ? (
            <button
              type="button"
              onClick={() => void share()}
              className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-line-strong text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={1.5} />
                  {sl('album.shareCopied')}
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" strokeWidth={1.5} />
                  {sl('album.shareCta')}
                </>
              )}
            </button>
          ) : null}
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
      // 补缺大批片 4：albumFeed 一次聚合（预约/步骤/照片各一次查询，替掉逐单 N+1）
      const feed = await trpc.serviceLoop.albumFeed.query({ limit: 12 })
      const albums: Album[] = []
      for (const item of feed) {
        const photos: PhotoWallPhoto[] = []
        let before: PhotoWallPhoto | null = null
        let after: PhotoWallPhoto | null = null
        let doneStepCount = 0
        for (const step of item.steps) {
          if (step.status === 'done') doneStepCount += 1
          step.photos.forEach((p, i) => {
            const photo: PhotoWallPhoto = {
              id: `${item.appointmentId}-${step.stepKey}-${i}`,
              url: p.url,
              thumbUrl: p.thumbUrl ?? undefined,
            }
            photos.push(photo)
            if (step.stepKey === 'before_after') {
              if (p.tag === 'before' && !before) before = photo
              if (p.tag === 'after') after = photo // 取最新一张 after（照片按拍摄时间升序）
            }
          })
        }
        const cover = after ?? photos[photos.length - 1]
        if (!cover) continue // 无可见照片的单不成册（R10：不画假封面）
        albums.push({
          appointmentId: item.appointmentId,
          petName: item.petName,
          serviceName: item.serviceName,
          storeName: item.storeName ?? null,
          doneAt: item.completedAt ?? null,
          doneStepCount,
          status: item.status === 'in_service' ? 'in_service' : 'completed',
          photos,
          cover,
          before,
          after,
        })
      }
      return albums
    },
  })

  return (
    <div className="px-4 pb-6">
      {/* U1-A：统一返回条（←圆钮+标题），固定返回 philia 页 */}
      <PageHeader title={sl('album.title')} fallback="/philia" className="pt-6" />

      <div className="mt-4">
        {albumsQuery.isPending ? <LoadingBlock lines={3} /> : null}
        {albumsQuery.isError ? (
          <ErrorState message={sl('album.loadFail')} onRetry={() => void albumsQuery.refetch()} />
        ) : null}
        {albumsQuery.data && albumsQuery.data.length === 0 ? (
          <EmptyState
            title={sl('album.emptyTitle')}
            desc={sl('album.emptyBody')}
            action={
              <Link
                to="/booking/grooming"
                className="inline-flex items-center rounded-control bg-philia-gradient px-[30px] py-[13px] text-body-sm font-semibold text-[#F6EFDD] shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {sl('album.emptyCta')}
              </Link>
            }
          />
        ) : null}
      </div>

      {/* 案例流：双列不等高网格（hv2-cases 同型同件，align-items:start 错落） */}
      {albumsQuery.data && albumsQuery.data.length > 0 ? (
        <div className="hv2-cases mt-4" data-testid="album-feed">
          {albumsQuery.data.map((album) => (
            <AlbumCard key={album.appointmentId} album={album} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
