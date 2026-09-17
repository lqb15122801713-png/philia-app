/**
 * 今日预约表（U3 §2 左栏 · 母本 .panel + .tbl）：appointment.listForStore 今日区间
 *
 * 列 = 时间（u1-num Montserrat 加粗）/ 宠物·服务（副行：客户昵称 · 到店付/次卡抵扣）/
 * 员工（副行：派单来源小签，assignSourceLabel 口径 auto=自动派单 / merchant=商家改派）/
 * 状态胶囊（u3-st：live=服务中·寄养中、wait=待到店·待确认、done=已完成·已取消、amber=取消申请）；
 * 行点击进入 /appointments/:id；已取消行灰显；
 * 空态 = 规格书原文「今天还没有预约——把预约页分享给老客，或等自动接单」；
 * 加载中骨架行（禁转圈）。
 */

import { useNavigate } from 'react-router-dom'
import { assignSourceLabel, paymentModeLabel } from '@/components/appointments/appt-utils'
import { hhmm, type TodayApptItem } from './utils'

/** 状态 → 胶囊（u3-st 变体；confirmed 按母本口径写作「待到店」） */
const CAPSULE: Record<string, { label: string; cls: string }> = {
  pending: { label: '待确认', cls: 'u3-st wait' },
  confirmed: { label: '待到店', cls: 'u3-st wait' },
  in_service: { label: '服务中', cls: 'u3-st live' },
  in_boarding: { label: '寄养中', cls: 'u3-st live' },
  completed: { label: '已完成', cls: 'u3-st done' },
  cancel_requested: { label: '取消申请', cls: 'u3-st amber' },
  cancelled: { label: '已取消', cls: 'u3-st done' },
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td>
        <div className="h-3 w-9 rounded-md bg-[rgba(74,59,46,.08)]" />
      </td>
      <td>
        <div className="h-3 w-32 rounded-md bg-[rgba(74,59,46,.08)]" />
        <div className="mt-1.5 h-2.5 w-24 rounded-md bg-[rgba(74,59,46,.06)]" />
      </td>
      <td>
        <div className="h-3 w-14 rounded-md bg-[rgba(74,59,46,.08)]" />
      </td>
      <td>
        <div className="h-4 w-12 rounded-md bg-[rgba(74,59,46,.08)]" />
      </td>
    </tr>
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
    <section className="u3-panel">
      <div className="u3-panel-head">
        <h3>今日预约</h3>
        <span className="aside">按时间 · {items.length} 单</span>
      </div>

      {loading ? (
        <table className="u3-tbl">
          <tbody>
            {[0, 1, 2, 3].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      ) : items.length === 0 ? (
        <p className="px-[17px] pb-7 pt-3 text-center text-[12px] leading-6 text-[rgba(74,59,46,.62)]">
          今天还没有预约——把预约页分享给老客，或等自动接单
        </p>
      ) : (
        <table className="u3-tbl">
          <thead>
            <tr>
              <th>时间</th>
              <th>宠物 / 服务</th>
              <th>员工</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cancelled = item.status === 'cancelled'
              const capsule = CAPSULE[item.status] ?? { label: item.status, cls: 'u3-st wait' }
              const payText = item.paymentMode ? paymentModeLabel(item.paymentMode) : null
              const srcText = assignSourceLabel(item.assignSource)
              return (
                <tr
                  key={item.id}
                  className={`rowlink ${cancelled ? 'opacity-50' : ''}`}
                  onClick={() => navigate(`/appointments/${item.id}`)}
                >
                  <td className="u1-num font-bold">{hhmm(item.scheduledStart)}</td>
                  <td>
                    {item.petName ?? '宠物'} · {item.serviceName ?? '服务'}
                    <div className="mt-0.5 text-[11px] text-[rgba(74,59,46,.42)]">
                      {item.customerName ?? '客户'}
                      {payText ? ` · ${payText}` : ''}
                    </div>
                  </td>
                  <td>
                    {item.staffName ?? '未指派'}
                    {srcText ? (
                      <div className="mt-0.5 text-[11px] text-[rgba(74,59,46,.42)]">{srcText}</div>
                    ) : null}
                  </td>
                  <td>
                    <span className={capsule.cls}>{capsule.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
