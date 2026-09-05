/**
 * 今日时间轴简表（T4.1）：appointment.listForStore 今日区间
 *
 * 每行 = 时间 / 宠物 / 服务 / 员工 / 状态胶囊，点行进预约详情；
 * 已取消行灰显；空数据态明确展示「今日暂无预约」。
 * 商家端动效纪律：仅 hover/状态过渡，不用呼吸光环（设计手册 §7）。
 */

import { PawPrint } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hhmm, type TodayApptItem } from './utils'

/** 状态胶囊（商家端版：无脉冲光环，颜色语义与员工端一致） */
const CAPSULE: Record<string, { label: string; cls: string }> = {
  pending: { label: '待确认', cls: 'bg-sunken text-ink-secondary' },
  confirmed: { label: '已确认', cls: 'bg-brand-primary-light text-brand-primary-pressed' },
  in_service: { label: '服务中', cls: 'bg-brand-primary text-white' },
  in_boarding: { label: '寄养中', cls: 'bg-brand-primary text-white' },
  completed: { label: '已完成', cls: 'bg-success-light text-success-deep' },
  cancel_requested: { label: '取消审核', cls: 'bg-danger-light text-danger-deep' },
  cancelled: { label: '已取消', cls: 'bg-sunken text-ink-placeholder' },
}

function StatusCapsule({ status }: { status: string }) {
  const c = CAPSULE[status] ?? { label: status, cls: 'bg-sunken text-ink-secondary' }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${c.cls}`}
    >
      {c.label}
    </span>
  )
}

export default function TodayTimeline({
  items,
  loading,
}: {
  items: TodayApptItem[]
  loading: boolean
}) {
  const navigate = useNavigate()

  return (
    <section className="rounded-card bg-card shadow-card">
      <header className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-title">今日时间轴</h2>
        <span className="font-number text-caption text-ink-secondary tabular-nums">
          共 {items.length} 单
        </span>
      </header>

      {loading ? (
        <p className="px-4 py-8 text-center text-body text-ink-secondary">加载中…</p>
      ) : items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-body text-ink-secondary">今日暂无预约</p>
          <p className="mt-1 text-caption text-ink-placeholder">新预约到达时会实时出现在这里</p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-line-divider pb-2">
          {items.map((item) => {
            const cancelled = item.status === 'cancelled'
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/appointments/${item.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken/60 ${
                    cancelled ? 'opacity-60' : ''
                  }`}
                >
                  <span className="w-12 shrink-0 font-number text-body font-semibold tabular-nums">
                    {hhmm(item.scheduledStart)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-body font-medium">
                      <PawPrint className="h-4 w-4 shrink-0 text-brand-primary" strokeWidth={1.5} />
                      <span className="truncate">{item.petName ?? '宠物'}</span>
                      <span className="truncate font-normal text-ink-secondary">
                        · {item.serviceName ?? '服务'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-caption text-ink-secondary">
                      {item.staffName ? (
                        <>员工：{item.staffName}</>
                      ) : (
                        <span className="text-danger-deep">未指派员工</span>
                      )}
                      {item.type === 'boarding' ? ' · 寄养' : ''}
                    </span>
                  </span>
                  <StatusCapsule status={item.status} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
