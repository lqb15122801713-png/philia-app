/**
 * 开单区选品面板（批次 M1）：tabs 三档（服务/商品/待收款，带计数小字）
 *
 * - P2 选品卡：试样 .good 工艺——圆角 14+ring、40px 圆角 10 浅木图标档 +
 *   名 14 + 规格小字 + 价 Montserrat；点击柠檬边反馈（active ring 1.5px）；
 *   图标按类映射：洗护 shower-head / 造型·美容 scissors / 寄养 bed-double /
 *   商品 package（lucide，无彩图标）；
 * - 待收款 tab = 试样 .pull-card：字圈 + 「宠物·服务」+「预约到店付·时间·
 *   已完成待收款」+ 金额 + 柠檬「拉入」钮；已拉入的行置灰防重（幂等：
 *   同一预约不重复入车）；
 * - 商品仅列在架（status='on'）；三态齐全（骨架 / 错误重试 / 空态安静灰字）。
 */

import { Package, type LucideIcon } from 'lucide-react'
import { fmtDateTime, type StoreProduct } from '@/components/mall-admin/format'
import { fenToYuan, serviceIcon, type PendingAppt, type StoreService } from './model'

type TabKey = 'service' | 'product' | 'pending'

function GoodCard({
  icon: Icon,
  name,
  spec,
  priceFen,
  testid,
  onClick,
}: {
  icon: LucideIcon
  name: string
  spec: string | null
  priceFen: number
  testid?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className="flex flex-col gap-2 rounded-[14px] bg-[#FFFDF6] p-3.5 text-left shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-[box-shadow,transform] duration-150 active:shadow-[0_0_0_1.5px_#FDC830]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F1E8D4] text-[rgba(74,59,46,.6)]">
        <Icon size={19} strokeWidth={1.6} aria-hidden />
      </span>
      <span className="text-body-sm font-medium leading-tight">{name}</span>
      {spec ? <span className="text-caption-xs text-[rgba(74,59,46,.42)]">{spec}</span> : null}
      <span className="font-number text-caption font-semibold tabular-nums">¥{fenToYuan(priceFen)}</span>
    </button>
  )
}

export default function PickPanel({
  tab,
  onTab,
  services,
  products,
  pending,
  loading,
  error,
  onRetry,
  pulledIds,
  onAddService,
  onAddProduct,
  onPullAppt,
}: {
  tab: TabKey
  onTab: (t: TabKey) => void
  services: StoreService[] | undefined
  products: StoreProduct[] | undefined
  pending: PendingAppt[] | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
  /** 已在车内的预约 refId 集（拉入幂等） */
  pulledIds: Set<string>
  onAddService: (s: StoreService) => void
  onAddProduct: (p: StoreProduct) => void
  onPullAppt: (a: PendingAppt) => void
}) {
  const tabs: Array<{ key: TabKey; label: string; n: number | null }> = [
    { key: 'service', label: '服务', n: services?.length ?? null },
    { key: 'product', label: '商品', n: products?.length ?? null },
    { key: 'pending', label: '待收款', n: pending?.length ?? null },
  ]

  return (
    <div>
      {/* tabs（试样 .tabs：当前=墨底米字，计数小字 Montserrat） */}
      <div className="flex gap-1.5" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`cashier-tab-${t.key}`}
            onClick={() => onTab(t.key)}
            className={`rounded-full px-3.5 py-[7px] text-caption transition-colors ${
              tab === t.key
                ? 'bg-[#4A3B2E] font-semibold text-[#F6F1E3]'
                : 'text-[rgba(74,59,46,.6)]'
            }`}
          >
            {t.label}
            {t.n !== null ? (
              <span className="ml-1 font-number text-caption-xs tabular-nums opacity-70">{t.n}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {loading ? (
          /* 骨架（禁转圈） */
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[14px] bg-[#FFFDF6] p-3.5 shadow-[0_0_0_1px_rgba(74,59,46,.09)]"
              >
                <div className="h-10 w-10 animate-pulse rounded-[10px] bg-[rgba(74,59,46,.06)]" />
                <div className="mt-2.5 h-3.5 w-3/4 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[14px] bg-[#FFFDF6] px-4 py-8 text-center shadow-[0_0_0_1px_rgba(74,59,46,.09)]">
            <p className="text-caption text-[rgba(74,59,46,.62)]">{error}</p>
            <button
              type="button"
              data-testid="cashier-pick-retry"
              onClick={onRetry}
              className="mt-3 rounded-full bg-[#FFFDF6] px-4 py-2 text-caption font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
            >
              重新加载
            </button>
          </div>
        ) : tab === 'service' ? (
          (services ?? []).length === 0 ? (
            <p className="px-2 py-8 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
              门店暂无在架服务，请到「设置」维护
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
              {(services ?? []).map((s) => (
                <GoodCard
                  key={s.id}
                  testid={`cashier-good-svc-${s.id}`}
                  icon={serviceIcon(s.name, s.type)}
                  name={s.name}
                  spec={s.durationMin ? `约 ${s.durationMin} 分钟` : null}
                  priceFen={s.priceFen}
                  onClick={() => onAddService(s)}
                />
              ))}
            </div>
          )
        ) : tab === 'product' ? (
          (products ?? []).length === 0 ? (
            <p className="px-2 py-8 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
              暂无在架商品，请到「商品」上架
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
              {(products ?? []).map((p) => (
                <GoodCard
                  key={p.id}
                  testid={`cashier-good-prod-${p.id}`}
                  icon={Package}
                  name={p.name}
                  spec={p.stock > 0 ? `库存 ${p.stock}` : '库存不足'}
                  priceFen={p.priceFen}
                  onClick={() => onAddProduct(p)}
                />
              ))}
            </div>
          )
        ) : (pending ?? []).length === 0 ? (
          <p className="px-2 py-8 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
            无待收款预约——服务完成后会出现在这里
          </p>
        ) : (
          /* 待收款：试样 .pull-card（常客纯服务 ≤3 步链路的起点） */
          <div className="flex flex-col gap-2.5">
            {(pending ?? []).map((a) => {
              const pulled = pulledIds.has(a.id)
              return (
                <div
                  key={a.id}
                  data-testid={`cashier-pull-${a.id}`}
                  className="flex items-center gap-2.5 rounded-[14px] bg-[#FFFDF6] px-3.5 py-3 shadow-[0_0_0_1px_rgba(74,59,46,.09)]"
                >
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#F1E8D4] text-caption-xs font-bold shadow-[0_0_0_1px_rgba(74,59,46,.09)]">
                    {(a.petName ?? '宠').slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-caption font-semibold">
                      {a.petName} · {a.serviceName}
                    </div>
                    <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                      预约到店付 · {a.completedAt ? fmtDateTime(a.completedAt) : '—'} · 已完成待收款
                    </div>
                  </div>
                  <span className="mr-1 font-number text-caption font-semibold tabular-nums">
                    ¥{fenToYuan(a.priceFen)}
                  </span>
                  <button
                    type="button"
                    data-testid={`cashier-pull-btn-${a.id}`}
                    disabled={pulled}
                    onClick={() => onPullAppt(a)}
                    className="rounded-full bg-brand-primary px-3.5 py-[7px] text-caption-xs font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:cursor-default disabled:opacity-40"
                  >
                    {pulled ? '已拉入' : '拉入'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
