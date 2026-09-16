/**
 * HomePage · 客户端首页（批次 9a.3 完整改版 · v4.1 减法版式落地）
 *
 * 版式七段（试样即最终版式，任务 A 逐段口径）：
 * 1. 顶栏：philia wordmark（VI 斜体拉丁 logo 字体）+「守护每一次洗护」（小字 tracking
 *    拉宽）+ 右侧「会员码」细线框 pill（无填充无黑底，进 /philia/member）；
 * 2. 问候区：「{时段}好，{昵称}。」20px/700 ink + 一行功能性副句（muted 12.5px，
 *    数据驱动 appointment.listMine：进行中洗护→「{宠物}正在店里享受洗护」、进行中寄养
 *    →「{宠物}正在店里寄养」；否则最近完成洗护单 →「{宠物}距上次洗护已 N 天」（N≥1）；
 *    无数据时副句省略不硬凑）；
 * 3. 主区面板：批次 9a HomeBookingPanel 双态保留（一键再约/服务中/降级入口卡），
 *    版式微调为「全屏唯一白面板 + 一层软阴影」（去描边留 shadow-card，内部定义行
 *    hairline 不动）；全屏唯一 accent = 面板 CTA；
 * 4. 服务安静文字行（3+2）：到店洗护（一店一技师 · 全程可见 · ¥128 起）/ 上门接送
 *    （下单后 30 分钟内到楼下）/ 造型美容（首席造型师 · 拿图定制）+ 寄养服务 › +
 *    宠物商城 ›——名称 14.5px/600 + 规格 11.5px muted + 价格 tabular-nums + ›，
 *    hairline 分隔，无图标无卡片。落点：前三行进 /booking/grooming（接送/造型无独立
 *    流程，与洗护同链路；造型带 ?tab=style 直达口径，PR 报告说明）、寄养进
 *    /booking/boarding、商城进 /mall；
 * 5. 底部减法 dock：首页专属 HomeDock（悬浮白 pill 圆角 24，三项等宽 首页 / philia
 *    44px 柠檬黄平圆深棕墨 paw 不凸起 / 我的；active ink 600 其余 muted）——仅首页
 *    渲染，其余页面保留既有 ConvexTabBar（全局替换下批统一，PR 报告说明）；
 * 6. 下掉清单（本批逐一移除）：banner-home 大图、三入口胶囊卡、附近好店区、推荐服务
 *    横滑卡阵、GroomingReminder 复购提醒卡、促销位（本无所增）；
 * 7. 数据三态：主区面板自带 loading 骨架（版式随新规）；问候副句数据未就绪/失败时
 *    省略（不硬凑），页面级无额外交互三态。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMe, usePhiliaClient } from '@philia/shared'
import HomeBookingPanel from '../components/home/HomeBookingPanel'
import HomeDock from '../components/home/HomeDock'
import type { AppointmentListItem } from '@/components/booking/types'

/** 时段问候语（本地时区） */
function daypart(hour: number): string {
  if (hour < 12) return '上午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/**
 * 问候副句（数据驱动，无数据返回 null → 省略）：
 * 进行中洗护 > 进行中寄养 > 最近完成洗护距今 N 天（N≥1）；completedAt 为空的历史单
 * 退回 scheduledEnd（与 B4-5 同口径）。
 */
function resolveSubtitle(groups: Record<string, AppointmentListItem[]> | undefined): string | null {
  if (!groups) return null
  const inService = (groups.in_service ?? []).find((a) => a.type === 'grooming')
  if (inService) return `${inService.petName ?? '爱宠'}正在店里享受洗护`
  const inBoarding = groups.in_boarding?.[0]
  if (inBoarding) return `${inBoarding.petName ?? '爱宠'}正在店里寄养`
  const grooming = (groups.completed ?? []).filter((a) => a.type === 'grooming')
  if (grooming.length === 0) return null
  const timeOf = (a: AppointmentListItem) => (a.completedAt ?? a.scheduledEnd).getTime()
  const latest = grooming.reduce((m, a) => (timeOf(a) > timeOf(m) ? a : m))
  const days = Math.floor((Date.now() - timeOf(latest)) / 86_400_000)
  if (days < 1) return null
  return `${latest.petName ?? '爱宠'}距上次洗护已 ${days} 天`
}

// 服务安静文字行（试样口径 3+2）：名称 14.5px/600 + 规格 11.5px muted + 价格 tabular-nums + ›
const serviceRows: {
  name: string
  spec?: string
  price?: string
  to: string
  testid: string
}[] = [
  { name: '到店洗护', spec: '一店一技师 · 全程可见', price: '¥128 起', to: '/booking/grooming', testid: 'home-service-grooming' },
  { name: '上门接送', spec: '下单后 30 分钟内到楼下', to: '/booking/grooming', testid: 'home-service-pickup' },
  { name: '造型美容', spec: '首席造型师 · 拿图定制', to: '/booking/grooming?tab=style', testid: 'home-service-style' },
  { name: '寄养服务', to: '/booking/boarding', testid: 'home-service-boarding' },
  { name: '宠物商城', to: '/mall', testid: 'home-service-mall' },
]

const HAIRLINE = 'border-t border-[rgba(74,59,46,.09)]'

export default function HomePage() {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()

  // 问候副句数据源（queryKey 与主区面板/TabBar 同源，命中缓存不增发）
  const mineQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: !!user,
    staleTime: 60_000,
  })
  const subtitle = useMemo(() => resolveSubtitle(mineQ.data?.groups), [mineQ.data])

  return (
    <div className="px-4 pb-32">
      {/* 1. 顶栏：wordmark + 小字 tracking + 会员码细线框 pill */}
      <header data-testid="home-topbar" className="flex items-start justify-between pt-6">
        <div>
          <p className="font-display text-[22px] font-semibold italic leading-7">philia</p>
          <p className="mt-1 text-[11px] tracking-[0.22em] text-ink-secondary">守护每一次洗护</p>
        </div>
        <Link
          to="/philia/member"
          data-testid="home-member-code"
          className="mt-1 rounded-full border border-[rgba(74,59,46,.3)] px-3.5 py-1.5 text-[11.5px] leading-4 text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          会员码
        </Link>
      </header>

      {/* 2. 问候区：20px/700 + 数据驱动副句（无数据省略） */}
      <section data-testid="home-greeting" className="mt-7">
        <h1 className="text-[20px] font-bold leading-7">
          {daypart(new Date().getHours())}，{user?.nickname ?? '宠友'}。
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[12.5px] leading-5 text-ink-secondary" data-testid="home-greeting-sub">
            {subtitle}
          </p>
        ) : null}
      </section>

      {/* 3. 主区面板：批次 9a 双态（一键再约/服务中/降级入口卡），全屏唯一白面板 */}
      <div className="mt-5">
        <HomeBookingPanel />
      </div>

      {/* 4. 服务安静文字行（3+2，hairline 分隔，无图标无卡片） */}
      <section data-testid="home-services" className="mt-8" aria-label="服务">
        {serviceRows.map(({ name, spec, price, to, testid }, i) => (
          <Link
            key={testid}
            to={to}
            data-testid={testid}
            className={`flex items-baseline justify-between gap-3 py-3.5 ${i > 0 ? HAIRLINE : ''}`}
          >
            <span className="shrink-0 text-[14.5px] font-semibold leading-5">{name}</span>
            <span className="flex min-w-0 items-baseline gap-2">
              {spec ? (
                <span className="truncate text-[11.5px] leading-4 text-ink-secondary">
                  {spec}
                  {price ? (
                    <span className="ml-1.5 font-number text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {price}
                    </span>
                  ) : null}
                </span>
              ) : null}
              <span className="shrink-0 text-[13px] leading-4 text-ink-secondary" aria-hidden="true">
                ›
              </span>
            </span>
          </Link>
        ))}
      </section>

      {/* 5. 底部减法 dock（仅首页渲染；其余页面保留既有 TabBar） */}
      <HomeDock />
    </div>
  )
}
