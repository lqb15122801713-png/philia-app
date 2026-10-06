/**
 * 右栏：挂单队列（P4）+ 今日流水简表（P7）
 *
 * - P4 挂单卡：挂单号 Montserrat 12 + 会员名/散客 · 行数 + 备注行（有 note 才渲染，
 *   测试件标注醒目位，PR-3 C2b）+ 挂出时间 + 金额 +
 *   刚挂的右上角柠檬圆点；点卡=取单（resume 恢复整单）；⋯ = 撤单入口
 *   （owner-only，manager 置灰 + title 原因）；空 = 浅木圆牌「无挂单」；
 * - P7 流水行：单号短显 Montserrat + 买家 + 金额右对齐 Montserrat + 状态/方式签
 *   （已收薄荷=首支付方式 / 撤单灰 / 挂单·开单浅木）；最近 5 条 + 全部 › 进
 *   /cashier/records；
 * - 三态：骨架 / 错误重试 / 空态。
 */

import { Skeleton } from '@philia/shared'
import { MoreHorizontal } from 'lucide-react'
import { cc } from '@/copy/cashier'
import { Link } from 'react-router-dom'
import {
  BILL_STATUS_CHIP,
  fenToYuan,
  hhmm,
  PAY_METHOD_LABEL,
  shortBillNo,
  type BillListRow,
} from './model'

function PanelError({ onRetry, testid }: { onRetry: () => void; testid: string }) {
  return (
    <div className="py-4 text-center">
      <p className="text-caption-xs text-[rgba(59,46,36,.62)]">加载失败</p>
      <button
        type="button"
        data-testid={testid}
        onClick={onRetry}
        className="mt-2 rounded-full bg-[#FFFDF6] px-3 py-1.5 text-caption-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(59,46,36,.09)]"
      >
        重新加载
      </button>
    </div>
  )
}

export default function HoldPanel({
  held,
  todayBills,
  hideToday = false,
  loading,
  error,
  onRetry,
  freshHeldNo,
  onResume,
  onVoid,
}: {
  held: BillListRow[] | undefined
  todayBills: BillListRow[] | undefined
  /** M1-补2 G：clerk 隐藏今日流水整块（矩阵总规则② 店员不见流水） */
  hideToday?: boolean
  loading: boolean
  error: boolean
  onRetry: () => void
  /** 刚挂出的单号（柠檬点标记） */
  freshHeldNo: string | null
  onResume: (bill: BillListRow) => void
  onVoid: (bill: BillListRow) => void
}) {
  const recent = (todayBills ?? []).slice(0, 5)

  return (
    <>
      {/* ---- 挂单队列 ---- */}
      <section
        className="rounded-[20px] bg-[#FFFDF6] p-3.5 shadow-[0_0_0_1px_rgba(59,46,36,.09)]"
        data-testid="cashier-hold-queue"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <b className="text-body-sm">挂单队列</b>
          <span className="inline-flex items-center rounded-full bg-[#F1E8D4] px-2.5 py-[3px] font-number text-caption-xs tabular-nums text-[rgba(59,46,36,.62)]">
            {held?.length ?? 0} 单
          </span>
        </div>
        {loading ? (
          /* 加载中骨架块（animate-pulse，禁转圈）：挂单卡 = shared Skeleton 组合 */
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px] rounded-[14px]" />
            ))}
          </div>
        ) : error ? (
          <PanelError onRetry={onRetry} testid="cashier-held-retry" />
        ) : (held ?? []).length === 0 ? (
          <div
            className="rounded-[16px] bg-[#F1E8D4] px-3.5 py-[22px] text-center text-caption-xs text-[rgba(59,46,36,.42)]"
            data-testid="cashier-held-empty"
          >
            {cc('cashier.holdEmpty')}
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
                className="relative cursor-pointer rounded-[16px] bg-[#FFFDF6] px-3.5 py-3 shadow-[0_0_0_1px_rgba(59,46,36,.09)] transition-shadow hover:shadow-[0_0_0_1px_rgba(59,46,36,.18)]"
              >
                {b.billNo === freshHeldNo ? (
                  <span className="absolute right-3 top-2.5 h-[7px] w-[7px] rounded-full bg-brand-primary" />
                ) : null}
                <div className="font-number text-caption font-semibold tabular-nums">
                  {b.billNo}
                  {/* 片 3：挂出超 24h 徽标（按 heldAt 计算，防压单） */}
                  {b.heldAt && Date.now() - new Date(b.heldAt).getTime() > 24 * 3600 * 1000 ? (
                    <span
                      className="ml-1.5 inline-flex items-center rounded-[6px] bg-danger-light px-1.5 py-[2px] align-middle text-caption-xs font-sans font-semibold leading-none text-danger-deep"
                      data-testid={`cashier-held-over24-${b.billNo}`}
                    >
                      {cc('cashier.holdOver24')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-caption-xs">
                  {b.buyerName} · <span className="font-number tabular-nums">{b.itemCount}</span> 项
                </div>
                {/* PR-3 C2b：备注行（保留标测试件标注「测试件勿动」在队列即醒目，PD-02 反对意见①） */}
                {b.note ? (
                  <div className="mt-1 truncate text-caption-xs text-[rgba(59,46,36,.55)]" title={b.note}>
                    {b.note}
                  </div>
                ) : null}
                <div className="mt-1.5 flex items-center justify-between text-caption-xs text-[rgba(59,46,36,.42)]">
                  <span>{b.heldAt ? <><span className="font-number tabular-nums">{hhmm(b.heldAt)}</span>{' 挂出'}</> : '—'}</span>
                  <span className="font-number font-semibold tabular-nums text-ink">
                    ¥{fenToYuan(b.payableFen)}
                  </span>
                </div>
                {/* ⋯ 撤单入口（M1-补2 补丁①1：三级全开，边界=仅未支付单；本面板恒 held） */}
                <button
                  type="button"
                  aria-label={`撤单 ${b.billNo}`}
                  data-testid={`cashier-void-${b.billNo}`}
                  title="撤单（留痕）"
                  onClick={(e) => {
                    e.stopPropagation()
                    onVoid(b)
                  }}
                  className="absolute bottom-2 right-2 rounded-full p-1 text-[rgba(59,46,36,.3)] transition-colors hover:bg-[rgba(59,46,36,.05)] hover:text-[rgba(59,46,36,.6)]"
                >
                  <MoreHorizontal size={15} strokeWidth={1.8} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-caption-xs text-[rgba(59,46,36,.42)]">{cc('cashier.holdFooter')}</p>
      </section>

      {/* ---- 今日流水（最近 5 条；clerk 隐藏整块——矩阵总规则②） ---- */}
      {hideToday ? null : (
      <section
        className="rounded-[20px] bg-[#FFFDF6] p-3.5 shadow-[0_0_0_1px_rgba(59,46,36,.09)]"
        data-testid="cashier-today-flow"
      >
        <div className="mb-1.5 flex items-center justify-between">
          <b className="text-body-sm">今日流水</b>
          <Link to="/cashier/records" className="text-caption-xs text-[rgba(59,46,36,.42)] hover:text-ink">
            全部 ›
          </Link>
        </div>
        {loading ? (
          /* 加载中骨架块（animate-pulse，禁转圈）：流水行 = shared Skeleton 组合 */
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px] rounded-[14px]" />
            ))}
          </div>
        ) : error ? (
          <PanelError onRetry={onRetry} testid="cashier-flow-retry" />
        ) : recent.length === 0 ? (
          <p className="py-4 text-center text-caption-xs text-[rgba(59,46,36,.42)]">{cc('cashier.flowEmpty')}</p>
        ) : (
          <div>
            {recent.map((b) => {
              const voided = b.status === 'voided'
              const reversed = b.reversedAt != null // M1-补2 D：被冲正原单灰签
              const chip =
                b.status === 'settled'
                  ? reversed
                    ? { cls: 'u3-st done', label: '已冲正' }
                    : {
                        cls: 'bg-[#2E2318] text-[#F2DFA6]',
                        // R6-1：组合支付方式签全显（现金+微信），不再只显首方式
                        label: b.methods.length > 0 ? b.methods.map((m) => PAY_METHOD_LABEL[m] ?? m).join('+') : '已收',
                      }
                  : b.status === 'reversal'
                    ? { cls: 'u3-st done', label: '冲正' }
                    : voided
                      ? { cls: 'bg-[rgba(59,46,36,.08)] text-[rgba(59,46,36,.42)]', label: '撤' }
                      : { cls: 'bg-[#F1E8D4] text-[rgba(59,46,36,.62)]', label: BILL_STATUS_CHIP[b.status]?.label ?? b.status }
              return (
                <div
                  key={b.id}
                  data-testid={`cashier-flow-${b.billNo}`}
                  className={`flex items-center gap-2 border-b border-dashed border-[rgba(59,46,36,.09)] py-[9px] text-caption-xs last:border-b-0 ${voided ? 'opacity-55' : ''}`}
                >
                  <span className="font-number font-semibold tabular-nums">{shortBillNo(b.billNo)}</span>
                  <span className="min-w-0 flex-1 truncate text-[rgba(59,46,36,.6)]">
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
      )}
    </>
  )
}
