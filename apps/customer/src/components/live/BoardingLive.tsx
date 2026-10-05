/**
 * 寄养变体主视觉（开发方案 §8.4 寄养差异点；换皮批片 2 取齐 H-02 寄养日报）：
 * - 入住信息卡：房间号 / 入住称重 / 随身物品清单；
 * - 每日打卡卡：日期题 + 喂食/遛弯行件（rowx：题 13/600 + 右 mono 10 时刻，
 *   发丝线分隔，screens.css 实证值，件级样式落 styles/live-v2.css）+ 备注 + 照片
 *   （≤6，九宫格 PhotoWall 复用——定稿「照片挂时刻」因 boarding log 照片无时刻
 *   字段不落位，数据口径不动，已报备）；
 * - 卡件统一 u1-card（细线 ring + 近零影，v2.0 层级纪律）。
 * 数据源：boarding.myStay（T2.3 新增，customer 本人）；
 * 安心卡（体验批片 4 B17）=boarding.assuranceCard 聚合读口（房间/入住体重/随身物品
 * + 最新打卡摘要 + 拆封留痕列表），stay=null 显示「待入住登记」空态。
 */

import { PhotoWall, type PhotoWallPhoto } from '@philia/shared'
import { format } from 'date-fns'
import { BedDouble, PackageOpen, Scale } from 'lucide-react'
import { apc } from '../../copy/appointments'
import '../../styles/live-v2.css'

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

/** 安心卡聚合信息（boarding.assuranceCard 透出列，页面层组装） */
export interface BoardingAssuranceInfo {
  stay: BoardingStayInfo | null
  latestLog: { logDate: string; note: string | null } | null
  unsealLogs: Array<{ id: string; itemName: string; note: string | null; createdAt: Date }>
}

export interface BoardingLiveProps {
  stay: BoardingStayInfo | null
  logs: BoardingLogItem[]
  /** 安心卡数据；undefined=未取到（不渲染安心卡） */
  assurance?: BoardingAssuranceInfo
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
      <section className="u1-card p-4">
        <h2 className="text-title">入住信息</h2>
        <p className="mt-2 text-body text-ink-secondary">
          店员正在办理入住登记，房间与称重信息稍后可见。
        </p>
      </section>
    )
  }
  return (
    <section className="u1-card p-4">
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

/** 安心卡（体验批片 4 B17）：房间/入住体重/随身物品 + 最新打卡摘要 + 拆封留痕（物品+时刻）；
    stay=null=「待入住登记」空态；拆封零记录=诚实空态「暂无拆封记录」 */
function AssuranceCard({ info }: { info: BoardingAssuranceInfo }) {
  return (
    <section className="u1-card p-4" data-testid="boarding-assurance-card">
      <h2 className="text-title">{apc('appointments.assuranceTitle')}</h2>
      {!info.stay ? (
        <div className="mt-2">
          <p className="text-body font-medium text-ink">{apc('appointments.assuranceEmpty')}</p>
          <p className="mt-1 text-caption text-ink-secondary">{apc('appointments.assuranceEmptyBody')}</p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <p className="flex items-center gap-1.5 text-body text-ink">
              <BedDouble className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
              {apc('appointments.assuranceRoom')}{' '}
              <span className="font-semibold">{info.stay.roomNo ?? apc('appointments.roomPending')}</span>
            </p>
            {info.stay.checkinWeightKg != null ? (
              <p className="flex items-center gap-1.5 text-body text-ink">
                <Scale className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
                {apc('appointments.assuranceWeight')}{' '}
                <span className="font-number font-semibold">{info.stay.checkinWeightKg} kg</span>
              </p>
            ) : null}
          </div>
          {info.stay.belongings && info.stay.belongings.length > 0 ? (
            <div className="mt-3">
              <p className="text-caption text-ink-secondary">{apc('appointments.assuranceBelongings')}</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {info.stay.belongings.map((b, i) => (
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
          <div className="mt-3">
            <p className="text-caption text-ink-secondary">{apc('appointments.assuranceLatestLog')}</p>
            {info.latestLog ? (
              <p className="mt-1 text-body-sm text-ink">
                {fmtLogDate(info.latestLog.logDate)}
                {info.latestLog.note
                  ? ` · ${info.latestLog.note}`
                  : ` · ${apc('appointments.assuranceLogDone')}`}
              </p>
            ) : (
              <p className="mt-1 text-caption text-ink-secondary">{apc('appointments.assuranceNoLog')}</p>
            )}
          </div>
          <div className="mt-3 border-t border-line-divider pt-3" data-testid="boarding-unseal-list">
            <p className="flex items-center gap-1.5 text-caption text-ink-secondary">
              <PackageOpen className="h-4 w-4" strokeWidth={1.5} />
              {apc('appointments.assuranceUnsealTitle')}
            </p>
            {info.unsealLogs.length === 0 ? (
              <p className="mt-1 text-caption text-ink-secondary">{apc('appointments.assuranceUnsealEmpty')}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {info.unsealLogs.map((u) => (
                  <li key={u.id} className="flex items-baseline justify-between gap-2 text-caption">
                    <span className="text-ink">
                      {u.itemName}
                      {u.note ? <span className="text-ink-secondary">（{u.note}）</span> : null}
                    </span>
                    <span className="u1-num shrink-0 text-ink-placeholder">
                      {format(u.createdAt, 'M月d日 HH:mm')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
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
    <section className="u1-card p-4">
      <h3 className="text-title">{fmtLogDate(log.logDate)}</h3>

      {/* H-02 照护日志行件：喂食/遛弯 rowx（mono 时刻右侧，发丝线分隔） */}
      {log.meals?.length || log.walks > 0 ? (
        <div className="mt-1">
          {(log.meals ?? []).map((m, i) => (
            <div key={i} className="lv2-rowx">
              <span className="k">
                {m.food}
                {m.amount ? <span className="text-ink-secondary"> · {m.amount}</span> : null}
              </span>
              <span className="v">
                {m.time}
                {m.finished ? ' · 吃完 ✓' : ''}
              </span>
            </div>
          ))}
          {log.walks > 0 ? (
            <div className="lv2-rowx">
              <span className="k">遛弯</span>
              <span className="v">{log.walks} 次</span>
            </div>
          ) : null}
        </div>
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

export default function BoardingLive({ stay, logs, assurance, onPhotoClick }: BoardingLiveProps) {
  return (
    <div className="space-y-3">
      <StayCard stay={stay} />
      {assurance ? <AssuranceCard info={assurance} /> : null}
      {logs.length === 0 ? (
        <section className="u1-card p-4">
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
