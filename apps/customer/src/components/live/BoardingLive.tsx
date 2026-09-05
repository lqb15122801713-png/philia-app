/**
 * 寄养变体主视觉（开发方案 §8.4 寄养差异点）：
 * - 入住信息卡：房间号 / 入住称重 / 随身物品清单；
 * - 每日打卡卡：日期 / 喂食记录 / 遛弯次数 / 备注 / 照片（≤6，九宫格 PhotoWall 复用）。
 * 数据源：boarding.myStay（T2.3 新增，customer 本人）。
 */

import { PhotoWall, type PhotoWallPhoto } from '@philia/shared'
import { BedDouble, Footprints, Scale, UtensilsCrossed } from 'lucide-react'

export interface BoardingStayInfo {
  roomNo: string | null
  checkinWeightKg: number | null
  belongings: Array<{ name: string; note?: string }> | null
  checkoutAt: Date | null
}

export interface BoardingLogItem {
  id: string
  /** ISO 日期 'YYYY-MM-DD' */
  logDate: string
  meals: Array<{ time: string; food: string; amount?: string; finished?: boolean }> | null
  walks: number
  note: string | null
  photos: string[] | null
}

export interface BoardingLiveProps {
  stay: BoardingStayInfo | null
  logs: BoardingLogItem[]
  /** 照片点击（页面层全屏查看器） */
  onPhotoClick?: (photos: PhotoWallPhoto[], index: number) => void
}

/** '2026-09-04' → '9月4日 周五' */
function fmtLogDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 ${week}`
}

function StayCard({ stay }: { stay: BoardingStayInfo | null }) {
  if (!stay) {
    return (
      <section className="rounded-card bg-card p-4 shadow-card">
        <h2 className="text-title">入住信息</h2>
        <p className="mt-2 text-body text-ink-secondary">
          店员正在办理入住登记，房间与称重信息稍后可见。
        </p>
      </section>
    )
  }
  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <h2 className="text-title">入住信息</h2>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <p className="flex items-center gap-1.5 text-body text-ink">
          <BedDouble className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
          房间 <span className="font-semibold">{stay.roomNo ?? '待分配'}</span>
        </p>
        {stay.checkinWeightKg != null ? (
          <p className="flex items-center gap-1.5 text-body text-ink">
            <Scale className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
            入住称重 <span className="font-number font-semibold">{stay.checkinWeightKg} kg</span>
          </p>
        ) : null}
      </div>
      {stay.belongings && stay.belongings.length > 0 ? (
        <div className="mt-3">
          <p className="text-caption text-ink-secondary">随身物品</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {stay.belongings.map((b, i) => (
              <li
                key={`${b.name}-${i}`}
                className="rounded-tag bg-sunken px-2 py-1 text-caption text-ink"
                title={b.note}
              >
                {b.name}
                {b.note ? <span className="text-ink-secondary">（{b.note}）</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function DailyLogCard({
  log,
  onPhotoClick,
}: {
  log: BoardingLogItem
  onPhotoClick?: (photos: PhotoWallPhoto[], index: number) => void
}) {
  const wallPhotos: PhotoWallPhoto[] = (log.photos ?? []).slice(0, 6).map((url, i) => ({
    id: `${log.id}-${i}`,
    url,
  }))
  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <h3 className="text-title">{fmtLogDate(log.logDate)}</h3>
        {log.walks > 0 ? (
          <p className="flex items-center gap-1 text-caption text-ink-secondary">
            <Footprints className="h-4 w-4" strokeWidth={1.5} />
            遛弯 <span className="font-number">{log.walks}</span> 次
          </p>
        ) : null}
      </div>

      {log.meals && log.meals.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {log.meals.map((m, i) => (
            <li key={i} className="flex items-center gap-2 text-body text-ink">
              <UtensilsCrossed className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.5} />
              <span className="font-number text-ink-secondary">{m.time}</span>
              <span className="min-w-0 flex-1 truncate">
                {m.food}
                {m.amount ? <span className="text-ink-secondary"> · {m.amount}</span> : null}
              </span>
              {m.finished ? (
                <span className="shrink-0 rounded-tag bg-success-light px-1.5 py-0.5 text-caption text-success-deep">
                  已吃完
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {log.note ? <p className="mt-3 text-body text-ink-secondary">{log.note}</p> : null}

      {wallPhotos.length > 0 ? (
        <div className="mt-3">
          <PhotoWall
            photos={wallPhotos}
            onPhotoClick={(_, i) => onPhotoClick?.(wallPhotos, i)}
          />
        </div>
      ) : null}
    </section>
  )
}

export default function BoardingLive({ stay, logs, onPhotoClick }: BoardingLiveProps) {
  return (
    <div className="space-y-3">
      <StayCard stay={stay} />
      {logs.length === 0 ? (
        <section className="rounded-card bg-card p-4 shadow-card">
          <h2 className="text-title">每日打卡</h2>
          <p className="mt-2 text-body text-ink-secondary">
            今天的打卡还没来，店员照顾好后会第一时间上传照片和喂食记录。
          </p>
        </section>
      ) : (
        logs.map((log) => <DailyLogCard key={log.id} log={log} onPhotoClick={onPhotoClick} />)
      )}
    </div>
  )
}
