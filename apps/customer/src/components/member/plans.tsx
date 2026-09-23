/**
 * 会员域共享件（批次 R11a 骨架批 · 任务书 §五 + docs/r11/R11a-DESIGN.md §五）
 *
 * 骨架版口径：功能全通、tokens 工艺、美观不评审（R11b 随设计规范 v2.0 换皮）。
 *
 * - MemberPlanPublic：membership.plans 端点档位公开形状（与 server planPublicShape 对齐）；
 * - 展示口径助手：价格/回馈金/服务折扣/多宠规则全部由接口数据推导，不虚构；
 * - PlanCompareTable：四档权益对照（会员页/开通页/码页共用，安心包=全员免费表述在表尾
 *   ——CJ-0922-13 落槌：非会员 ¥15 作废，来 Philia 即享）；
 * - RebateRulesList：回馈金规则明面（红线 5：比例/周期/到账日/有效期/冻结解冻/
 *   退卡清零/退货扣回/不提现不转让——全写上，不藏菜单）；
 * - fmtDateTime / DAY_MS：账本明细与到期提醒共用。
 */

import { formatFen } from '../home/common'

/** membership.plans 档位公开形状（对齐 server/src/routers/membership.ts planPublicShape） */
export interface MemberPlanPublic {
  planKey: string
  label: string
  version: number
  free: boolean
  priceFen: number
  rebateBp: number
  serviceDiscountBp: number
  includedPets: number
  extraPetFen: number
  maxPets: number
}

/** membership.plans 全局参数（结算日/回馈金有效期/会员有效期） */
export interface MemberPlanGlobals {
  rebateSettlementDay: number
  rebateValidityDays: number
  membershipValidityDays: number
}

export const DAY_MS = 86_400_000

/** 四档短名（共创会落槌档名，冻结版任务书 §二）；未知档回落 label 中「·名：」段 */
const PLAN_SHORT_NAME: Record<string, string> = {
  plan_weiguang: '微光',
  plan_yinghuo: '萤火',
  plan_zhuguang: '烛光',
  plan_nuanyang: '暖阳',
}

export function planShortName(p: Pick<MemberPlanPublic, 'planKey' | 'label'>): string {
  const known = PLAN_SHORT_NAME[p.planKey]
  if (known) return known
  const seg = p.label.split('·')[1]?.split('：')[0]?.trim()
  return seg && seg.length > 0 ? seg : p.planKey
}

/** 年费展示：免费 / ¥199/年 */
export function planPriceText(p: MemberPlanPublic): string {
  return p.free || p.priceFen === 0 ? '免费' : `¥${formatFen(p.priceFen)}/年`
}

/** 回馈金比例展示：消费 2% / 无回馈金 */
export function planRebateText(p: MemberPlanPublic): string {
  return p.rebateBp > 0 ? `商品消费 ${p.rebateBp / 100}%` : '无回馈金'
}

/** 服务折扣展示：服务 88 折 / 无服务折扣（bp/1000：8800→8.8、8000→8） */
export function planDiscountText(p: MemberPlanPublic): string {
  if (p.serviceDiscountBp >= 10000) return '无服务折扣'
  const z = p.serviceDiscountBp / 1000
  return `服务 ${Number.isInteger(z) ? z : z.toFixed(1)} 折`
}

/** 多宠规则展示（CJ-0921-12①：含 N 只，第 N+1 只起 +¥x/年/只，M 只封顶） */
export function planPetRuleText(p: MemberPlanPublic): string {
  return `含 ${p.includedPets} 只，第 ${p.includedPets + 1} 只起 +¥${formatFen(p.extraPetFen)}/年/只，${p.maxPets} 只封顶`
}

/** 多宠附加费估算（开通页选档步展示用；宠物数未选时不出） */
export function planChargeText(p: MemberPlanPublic, petCount: number): string {
  const extra = Math.max(0, petCount - p.includedPets)
  const total = p.priceFen + extra * p.extraPetFen
  return `¥${formatFen(total)}`
}

/** Date/ISO → 'YYYY-MM-DD HH:mm'（账本明细时间） */
export function fmtDateTime(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ------------------------------------------------------------------ */
/* 四档权益对照表（会员页/开通页/码页共用）                                */
/* ------------------------------------------------------------------ */

export function PlanCompareTable({
  plans,
  currentPlanKey,
}: {
  plans: MemberPlanPublic[]
  /** 会员态传入本人档位键，命中行标「当前档」 */
  currentPlanKey?: string | null
}) {
  return (
    <div data-testid="member-plan-compare" className="u1-card overflow-hidden">
      <ul className="divide-y divide-[rgba(74,59,46,.06)]">
        {plans.map((p) => (
          <li key={p.planKey} className="px-4 py-3.5" data-plan-key={p.planKey}>
            <div className="flex items-baseline gap-2">
              <p className="u1-serif text-body-sm font-semibold">{planShortName(p)}</p>
              <span className="u1-num text-caption text-ink">{planPriceText(p)}</span>
              {currentPlanKey === p.planKey ? (
                <span className="ml-auto rounded-chip bg-success-light px-2 py-0.5 text-caption-xs text-success-deep">
                  当前档
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-caption leading-[1.7] text-ink-secondary">
              {planRebateText(p)} · {planDiscountText(p)}
              <br />
              多宠：{planPetRuleText(p)}
            </p>
          </li>
        ))}
      </ul>
      {/* 安心包=全员免费（CJ-0922-13 落槌：来 Philia 即享，非会员 ¥15 作废） */}
      <p className="border-t border-[rgba(74,59,46,.06)] px-4 py-3 text-caption text-ink-secondary">
        安心包：全员免费（来店即享，会员与非会员同享）
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 回馈金规则明面（红线 5：全部写在页面上，不藏菜单）                       */
/* ------------------------------------------------------------------ */

export function RebateRulesList({
  plans,
  globals,
}: {
  plans: MemberPlanPublic[]
  globals: MemberPlanGlobals
}) {
  const paidPlans = plans.filter((p) => p.rebateBp > 0)
  const rebateSummary =
    paidPlans.length > 0
      ? paidPlans.map((p) => `${planShortName(p)} ${p.rebateBp / 100}%`).join(' / ')
      : '以门店公布为准'
  const rules: string[] = [
    `回馈比例：商品消费按档返（${rebateSummary}），按商品实收金额计提，无月上限；微光档无回馈金。用回馈金支付的部分不再返。`,
    `结算周期：上月 26 日至本月 25 日为一期，统一次月到账（次月 ${globals.rebateSettlementDay} 日为执行基准，系统故障顺延不超过 3 天）。`,
    `有效期：回馈金自到账起 ${globals.rebateValidityDays} 天有效；会员有效期 ${globals.membershipValidityDays} 天（自开通日起算，到期日不重算）。`,
    '使用范围：回馈金 1:1 抵扣商品金额，仅限商品（服务/寄养不可用）；余额不足可与现金/微信/支付宝混搭支付。',
    '到期不自动续费：到期即冻结，回馈金余额保留但暂不可用；到店续费后解冻恢复，有效期顺延。',
    '退会清零：退会即回馈金余额清零、档位终止；年费按剩余整月 × 月均价折算退回（内测期线下原路退回，请联系门店办理）。',
    '退货扣回：商品退货时按该单已发回馈金比例扣回；余额不足扣至 0，不产生负账。',
    '回馈金不提现、不转让、不产息；会员费为权益服务费，与储值、XP 三本账互不通用。',
  ]
  return (
    <ul data-testid="member-rebate-rules" className="u1-card divide-y divide-[rgba(74,59,46,.06)] px-4">
      {rules.map((r) => (
        <li key={r} className="py-3 text-caption leading-[1.7] text-ink-secondary">
          {r}
        </li>
      ))}
    </ul>
  )
}
