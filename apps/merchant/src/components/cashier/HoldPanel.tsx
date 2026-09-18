/**
 * 右栏：挂单队列（P4）+ 今日流水简表（P7）
 *
 * - P4 挂单卡：挂单号 Montserrat 12 + 会员名/散客 · 行数 + 挂出时间 + 金额 +
 *   刚挂的右上角柠檬圆点；点卡=取单（resume 恢复整单）；⋯ = 撤单入口
 *   （owner-only，manager 置灰 + title 原因）；空 = 浅木圆牌「无挂单」；
 * - P7 流水行：单号短显 Montserrat + 买家 + 金额右对齐 Montserrat + 状态/方式签
 *   （已收薄荷=首支付方式 / 撤单灰 / 挂单·开单浅木）；最近 5 条 + 全部 › 进
 *   /cashier/records；
 * - 三态：骨架 / 错误重试 / 空态。
 */

import { MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BILL_STATUS_CHIP,
  fenToYuan,
  hhmm,
  PAY_METHOD_LABEL,
  shortBillNo,
  type BillListRow,
} from './model'

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[64px] animate-pulse rounded-[14px] bg-[rgba(74,59,46,.05)]" />
      ))}
    </div>
  )
}

function PanelError({ onRetry, testid }: { onRetry: () => void; testid: string }) {
  return (
    <div className="py-4 text-center">
      <p className="text-caption-xs text-[rgba(74,59,46,.62)]">加载失败</p>
      <button
        type="button"
        data-testid={testid}
        onClick={onRetry}
        className="mt-2 rounded-full bg-[#FFFDF6] px-3 py-1.5 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)]"
      >
        重新加载
      </button>
    </div>
  )
}

export default function HoldPanel({
  held,
  todayBills,
  loading,
  error,
  onRetry,
  freshHeldNo,
  isOwner,
  onResume,
  onVoid,
}: {
  held: BillListRow[] | undefined
  todayBills: BillListRow[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  /** 刚挂出的单号（柠檬点标记） */
  freshHeldNo: string | null
  isOwner: boolean
  onResume: (bill: BillListRow) => void
  onVoid: (bill: BillListRow) => void
}) {
  const recent = (todayBills ?? []).slice(0, 5)

  return (
    <>
      {/* ---- 挂单队列 ---- */}
      <section
        className="rounded-[20px] bg-[#FFFDF6] p-3.5 shadow-[0_0_0_1px_rgba(74,59,46,.09)]"
        data-testid="cashier-hold-queue"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <b className="text-body-sm">挂单队列</b>
          <span className="inline-flex items-center rounded-full bg-[#F1E8D4] px-2.5 py-[3px] text-caption-xs text-[rgba(74,59,46,.62)]">
            {held?.length ?? 0} 单
          </span>
        </div>
        {loading ? (
          <PanelSkeleton rows={2} />
        ) : error ? (
          <PanelError onRetry={onRetry} testid="cashier-held-retry" />
        ) : (held ?? []).length === 0 ? (
          <div
            className="rounded-[16px] bg-[#F1E8D4] px-3.5 py-[22px] text-center text-caption-xs text-[rgba(74,59,46,.42)]"
            data-testid="cashier-held-empty"
          >
            无挂单
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(held ?? []).map((b) => (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                data-testid={`cashier-held-${b.billNo}`}
                onClick={() => onResume(b)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onResume(b)
                }}
                className="relative cursor-pointer rounded-[16px] bg-[#FFFDF6] px-3.5 py-3 shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-shadow hover:shadow-[0_0_0_1px_rgba(74,59,46,.18)]"
              >
                {b.billNo === freshHeldNo ? (
                  <span className="absolute right-3 top-2.5 h-[7px] w-[7px] rounded-full bg-brand-primary" />
                ) : null}
                <div className="font-number text-caption font-semibold tabular-nums">{b.billNo}</div>
                <div className="mt-1 text-caption-xs">
                  {b.buyerName} · {b.itemCount} 项
                </div>
                <div className="mt-1.5 flex items-center justify-between text-caption-xs text-[rgba(74,59,46,.42)]">
                  <span>{b.heldAt ? `${hhmm(b.heldAt)} 挂出` : '—'}</span>
                  <span className="font-number font-semibold tabular-nums text-ink">
                    ¥{fenToYuan(b.payableFen)}
                  </span>
                </div>
                {/* ⋯ 撤单入口（owner-only） */}
                <button
                  type="button"
                  aria-label={`撤单 ${b.billNo}`}
                  data-testid={`cashier-void-${b.billNo}`}
                  disabled={!isOwner}
                  title={isOwner ? '撤单（留痕）' : '仅店主可撤单'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onVoid(b)
                  }}
                  className="absolute bottom-2 right-2 rounded-full p-1 text-[rgba(74,59,46,.3)] transition-colors hover:bg-[rgba(74,59,46,.05)] hover:text-[rgba(74,59,46,.6)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MoreHorizontal size={15} strokeWidth={1.8} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-caption-xs text-[rgba(74,59,46,.42)]">点卡取单续结 · ⋯ 撤单（店主）</p>
      </section>

      {/* ---- 今日流水（最近 5 条） ---- */}
      <section
        className="rounded-[20px] bg-[#FFFDF6] p-3.5 shadow-[0_0_0_1px_rgba(74,59,46,.09)]"
        data-testid="cashier-today-flow"
      >
        <div className="mb-1.5 flex items-center justify-between">
          <b className="text-body-sm">今日流水</b>
          <Link to="/cashier/records" className="text-caption-xs text-[rgba(74,59,46,.42)] hover:text-ink">
            全部 ›
          </Link>
        </div>
        {loading ? (
          <PanelSkeleton rows={3} />
        ) : error ? (
          <PanelError onRetry={onRetry} testid="cashier-flow-retry" />
        ) : recent.length === 0 ? (
          <p className="py-4 text-center text-caption-xs text-[rgba(74,59,46,.42)]">今日暂无流水</p>
        ) : (
          <div>
            {recent.map((b) => {
              const voided = b.status === 'voided'
              const chip =
                b.status === 'settled'
                  ? { cls: 'bg-[#7FD8BE] text-[#1E4D3D]', label: PAY_METHOD_LABEL[b.methods[0] ?? ''] ?? '已收' }
                  : b.status === 'voided'
                    ? { cls: 'bg-[rgba(74,59,46,.08)] text-[rgba(74,59,46,.42)]', label: '撤' }
                    : { cls: 'bg-[#F1E8D4] text-[rgba(74,59,46,.62)]', label: BILL_STATUS_CHIP[b.status]?.label ?? b.status }
              return (
                <div
                  key={b.id}
                  data-testid={`cashier-flow-${b.billNo}`}
                  className={`flex items-center gap-2 border-b border-dashed border-[rgba(74,59,46,.09)] py-[9px] text-caption-xs last:border-b-0 ${voided ? 'opacity-55' : ''}`}
                >
                  <span className="font-number font-semibold tabular-nums">{shortBillNo(b.billNo)}</span>
                  <span className="min-w-0 flex-1 truncate text-[rgba(74,59,46,.6)]">
                    {b.buyerName}
                    {voided ? ' · 已撤单' : ''}
                  </span>
                  <span className="font-number font-semibold tabular-nums">¥{fenToYuan(b.payableFen)}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-[2px] text-caption-xs ${chip.cls}`}>
                    {chip.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
