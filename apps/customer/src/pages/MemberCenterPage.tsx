/**
 * MemberCenterPage · /member 会员中心（批次 R11a 骨架批 · 27 号任务书冻结版 V1.0 §五
 * + docs/r11/R11a-DESIGN.md §五；申报锚点=页面标题「会员中心」）
 *
 * 骨架版口径：功能全通、tokens 工艺、美观不评审（R11b 随设计规范 v2.0 换皮）。
 *
 * 双态：
 * - 非会员态：开通指引卡（微光一键注册 membership.openFree，即开即会员；内测期付费档
 *   明示「到店收银台开通」）+ 四档权益对照 + 回馈金规则明面（规则对非会员同样公开，
 *   红线 5 不藏菜单）；
 * - 会员态：身份大卡（档位/有效期至/状态：生效·冻结·退会）+ 回馈金账本（当前余额/
 *   本期预计/五类明细：发放·抵扣·扣回·冻结·清零，含前后余额+时间+单号）+ 到期提醒条
 *   （到期前 30/7 天，非自动续费，续费=到店指引）+ 权益对照（当前档标记）+ 规则明面
 *   + 续费/退会指引（退会=「请联系门店」纯文案，cancel 在商家端，不做假按钮——
 *   任务书 §六 退会审批档 manager|owner）。
 *
 * 数据源：membership.my（会员+账本+本期明细）+ membership.plans（档位与全局参数）。
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { usePhiliaClient } from '@philia/shared'
import PageHeader from '@/components/PageHeader'
import { friendlyError, useToast } from '@/components/booking/Toast'
import { ErrorState, LoadingBlock, formatDateCn, formatFen } from '../components/home/common'
import {
  DAY_MS,
  PlanCompareTable,
  RebateRulesList,
  fmtDateTime,
  planShortName,
} from '../components/member/plans'

/* ------------------------------------------------------------------ */
/* 状态与流水类型展示映射                                                 */
/* ------------------------------------------------------------------ */

const STATUS_META: Record<string, { text: string; cls: string }> = {
  active: { text: '生效中', cls: 'bg-success-light text-success-deep' },
  frozen: { text: '已冻结', cls: 'bg-danger-light text-danger-deep' },
  cancelled: { text: '已退会', cls: 'bg-sunken text-ink-secondary' },
}

const LOG_TYPE_LABEL: Record<string, string> = {
  grant: '发放',
  deduct: '抵扣',
  clawback: '扣回',
  freeze: '冻结',
  clear: '清零',
}

/** 小区块外壳（标题 + 内容，骨架版统一节距） */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-title">{title}</h2>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 非会员态：开通指引（微光一键注册）                                      */
/* ------------------------------------------------------------------ */

function NonMemberGuide({
  guide,
  openPending,
  onOpenFree,
}: {
  guide: string | null
  openPending: boolean
  onOpenFree: () => void
}) {
  return (
    <section data-testid="member-guide" className="u1-card p-5">
      <p className="text-caption-xs font-semibold tracking-[0.22em] text-ink-placeholder">
        PHILIA MEMBERSHIP
      </p>
      <h2 className="u1-serif mt-2 text-title">开通菲丽亚会员</h2>
      <p className="mt-1.5 text-caption leading-[1.7] text-ink-secondary">
        {guide ?? '开通会员享商品回馈金与服务折扣；微光档免费，一键开通（手机号即会员）'}
      </p>
      {/* 微光一键注册：membership.openFree（免费 0 元，幂等；即开即会员） */}
      <button
        type="button"
        data-testid="member-open-free"
        onClick={onOpenFree}
        disabled={openPending}
        className="mt-4 w-full rounded-control bg-brand-primary py-[13px] text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.99] disabled:opacity-60"
      >
        {openPending ? '开通中…' : '一键免费开通微光会员'}
      </button>
      <Link
        to="/member/open"
        className="mt-3 block text-center text-caption text-ink-secondary"
      >
        查看全部档位与开通流程 ›
      </Link>
      <p className="mt-3 text-caption-xs leading-[1.6] text-ink-placeholder">
        内测期付费三档（萤火/烛光/暖阳）请到店收银台开通（现金/微信/支付宝）；微光档免费，线上即开即会员。
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 会员态：到期提醒条（30/7 天，非自动续费）                               */
/* ------------------------------------------------------------------ */

function RenewReminder({ status, expiresAt }: { status: string; expiresAt: Date }) {
  if (status === 'cancelled') return null
  if (status === 'frozen') {
    return (
      <p
        data-testid="member-renew-reminder"
        className="rounded-card bg-danger-light px-4 py-3 text-caption leading-[1.7] text-danger-deep"
      >
        会员已到期冻结：回馈金余额保留但暂不可用。续费请到店收银台办理，续费后解冻恢复、有效期顺延。
      </p>
    )
  }
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS)
  if (daysLeft > 30) return null
  const urgent = daysLeft <= 7
  return (
    <p
      data-testid="member-renew-reminder"
      className={`rounded-card px-4 py-3 text-caption leading-[1.7] ${
        urgent ? 'bg-danger-light text-danger-deep' : 'bg-oak-light text-ink'
      }`}
    >
      会员将于 {formatDateCn(expiresAt)} 到期（剩 {Math.max(daysLeft, 0)} 天）。
      到期不自动续费，续费请到店收银台办理。
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* 会员态：身份大卡（档位/有效期至/状态）                                   */
/* ------------------------------------------------------------------ */

function IdentityCard({
  planKey,
  planLabel,
  status,
  expiresAt,
  petCount,
  paidFen,
}: {
  planKey: string
  planLabel: string | null
  status: string
  expiresAt: Date
  petCount: number
  paidFen: number
}) {
  const meta = STATUS_META[status] ?? { text: status, cls: 'bg-sunken text-ink-secondary' }
  const name = planLabel ? planShortName({ planKey, label: planLabel }) : planKey
  return (
    <section data-testid="member-identity" className="u1-card p-5" aria-label="会员身份">
      <div className="flex items-center gap-2">
        <p className="text-caption-xs font-semibold tracking-[0.22em] text-ink-placeholder">
          PHILIA MEMBERSHIP
        </p>
        <span className={`ml-auto rounded-chip px-2 py-0.5 text-caption-xs ${meta.cls}`}>
          {meta.text}
        </span>
      </div>
      <h2 className="u1-serif mt-2 text-title-lg">{name}会员</h2>
      <dl className="mt-3 flex flex-col gap-1.5 border-t border-[rgba(74,59,46,.06)] pt-3 text-caption">
        <div className="flex justify-between">
          <dt className="text-ink-secondary">有效期至</dt>
          <dd className="u1-num text-ink">{formatDateCn(expiresAt)}</dd>
        </div>
        {petCount > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-secondary">名下宠物</dt>
            <dd className="u1-num text-ink">{petCount} 只</dd>
          </div>
        ) : null}
        {paidFen > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-secondary">本期实付</dt>
            <dd className="u1-num text-ink">¥{formatFen(paidFen)}</dd>
          </div>
        ) : null}
      </dl>
      <Link to="/me/card" className="mt-3 block text-right text-caption text-ink-secondary">
        会员码 ›
      </Link>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 会员态：回馈金账本（余额/本期预计/五类明细）                             */
/* ------------------------------------------------------------------ */

interface RebateLogRow {
  id: string
  type: string
  deltaFen: number
  beforeFen: number
  afterFen: number
  sourceId: string
  period: string | null
  settlementId: string | null
  note: string | null
  createdAt: Date | string
}

function RebateLedger({
  balanceFen,
  pendingFen,
  accountStatus,
  period,
  logs,
}: {
  balanceFen: number
  pendingFen: number
  accountStatus: string
  period: string
  logs: RebateLogRow[]
}) {
  const frozen = accountStatus === 'frozen'
  return (
    <div data-testid="member-rebate-ledger" className="u1-card p-5">
      <div className="flex items-baseline gap-2">
        <p className="text-caption text-ink-secondary">当前余额</p>
        {frozen ? (
          <span className="rounded-chip bg-danger-light px-2 py-0.5 text-caption-xs text-danger-deep">
            已冻结不可用
          </span>
        ) : null}
      </div>
      <p className="u1-num mt-1 text-[28px] font-bold leading-8 text-ink">
        ¥{formatFen(balanceFen)}
      </p>
      <p className="mt-1.5 text-caption text-ink-secondary">
        本期预计 <span className="u1-num text-ink">+¥{formatFen(pendingFen)}</span>
        <span className="text-ink-placeholder">（期次 {period}，统一次月到账）</span>
      </p>

      <div className="mt-4 border-t border-[rgba(74,59,46,.06)] pt-3">
        <p className="text-caption font-semibold text-ink">本期明细</p>
        {logs.length === 0 ? (
          <p className="mt-2 text-caption text-ink-placeholder">本期暂无回馈金明细</p>
        ) : (
          <ul className="mt-1 divide-y divide-[rgba(74,59,46,.06)]">
            {logs.map((l) => {
              const positive = l.deltaFen > 0
              const zero = l.deltaFen === 0
              return (
                <li key={l.id} className="py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-caption font-semibold text-ink">
                      {LOG_TYPE_LABEL[l.type] ?? l.type}
                    </span>
                    {l.type === 'grant' && !l.settlementId ? (
                      <span className="rounded-chip bg-sunken px-1.5 py-px text-caption-xs text-ink-placeholder">
                        次月到账
                      </span>
                    ) : null}
                    <span
                      className={`u1-num ml-auto text-caption font-semibold ${
                        zero ? 'text-ink-placeholder' : positive ? 'text-success-deep' : 'text-danger-deep'
                      }`}
                    >
                      {zero ? '—' : `${positive ? '+' : '−'}¥${formatFen(Math.abs(l.deltaFen))}`}
                    </span>
                  </div>
                  <p className="u1-num mt-1 text-caption-xs text-ink-placeholder">
                    {fmtDateTime(l.createdAt)} · 单号 {l.sourceId} · 余额 ¥{formatFen(l.beforeFen)} → ¥
                    {formatFen(l.afterFen)}
                  </p>
                  {l.note ? (
                    <p className="mt-0.5 text-caption-xs leading-[1.6] text-ink-secondary">{l.note}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 会员态：续费/退会指引（到店口径，退会不做假按钮——cancel 在商家端）        */
/* ------------------------------------------------------------------ */

function RenewAndQuitGuide({ membershipValidityDays }: { membershipValidityDays: number }) {
  return (
    <div data-testid="member-renew-quit" className="u1-card divide-y divide-[rgba(74,59,46,.06)] px-4">
      <p className="py-3.5 text-caption leading-[1.7] text-ink-secondary">
        <span className="font-semibold text-ink">续费：</span>
        请到店收银台办理（内测期到店付）；到期不自动续费，续费后有效期顺延{' '}
        {membershipValidityDays} 天，冻结的回馈金同步解冻。
      </p>
      <p className="py-3.5 text-caption leading-[1.7] text-ink-secondary">
        <span className="font-semibold text-ink">退会：</span>
        退会请联系门店办理。年费按剩余整月 × 月均价折算退回（内测期线下原路退回），
        回馈金余额清零、档位终止，全程留痕。
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 页面                                                                 */
/* ------------------------------------------------------------------ */

export default function MemberCenterPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const { toastEl, showToast } = useToast()

  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
  })
  const plansQ = useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => trpc.membership.plans.query(),
    staleTime: 60_000,
  })

  /* 微光一键注册（openFree 幂等；成功后作废 membership 域缓存刷新双态） */
  const openFreeM = useMutation({
    mutationFn: () => trpc.membership.openFree.mutate(),
    onSuccess: (r) => {
      showToast(r.idempotent ? '你已是会员' : '微光会员已开通，欢迎加入', 'info')
      void queryClient.invalidateQueries({ queryKey: ['membership'] })
    },
    onError: (err) => showToast(friendlyError(err, '开通失败，请稍后再试')),
  })

  /** 权益对照 + 规则明面（双态共用段；档位查询三态就地渲染） */
  const plansAndRules = (currentPlanKey?: string | null) =>
    plansQ.isPending ? (
      <LoadingBlock lines={3} />
    ) : plansQ.isError ? (
      <ErrorState message="档位信息加载失败" onRetry={() => void plansQ.refetch()} />
    ) : (
      <>
        <Section title="权益对照">
          <PlanCompareTable plans={plansQ.data.plans} currentPlanKey={currentPlanKey} />
        </Section>
        <Section title="回馈金规则">
          <RebateRulesList plans={plansQ.data.plans} globals={plansQ.data} />
        </Section>
      </>
    )

  return (
    <div data-testid="member-center-page" className="px-[22px] pb-10 pt-4">
      {toastEl}
      {/* 导航闭环：统一返回条固定回 /me（MePage 功能入口组落点） */}
      <PageHeader title="会员中心" to="/me" />

      {myQ.isPending ? (
        <div className="mt-5">
          <LoadingBlock lines={4} />
        </div>
      ) : myQ.isError ? (
        <div className="mt-5">
          <ErrorState message="会员信息加载失败" onRetry={() => void myQ.refetch()} />
        </div>
      ) : (
        (() => {
          const data = myQ.data
          const m = data.membership
          return (
            <div className="mt-4 flex flex-col gap-6">
              {m ? (
                <>
                  <RenewReminder status={m.status} expiresAt={m.expiresAt} />
                  <IdentityCard
                    planKey={m.planKey}
                    planLabel={data.plan?.label ?? null}
                    status={m.status}
                    expiresAt={m.expiresAt}
                    petCount={m.petCount}
                    paidFen={m.paidFen}
                  />
                  <Section title="回馈金账本">
                    <RebateLedger
                      balanceFen={data.rebate?.balanceFen ?? 0}
                      pendingFen={data.rebate?.pendingFen ?? 0}
                      accountStatus={data.rebate?.status ?? 'active'}
                      period={data.period}
                      logs={data.periodLogs}
                    />
                  </Section>
                  {plansAndRules(m.planKey)}
                  <RenewAndQuitGuide
                    membershipValidityDays={plansQ.data?.membershipValidityDays ?? 365}
                  />
                </>
              ) : (
                <>
                  <NonMemberGuide
                    guide={data.guide}
                    openPending={openFreeM.isPending}
                    onOpenFree={() => openFreeM.mutate()}
                  />
                  {plansAndRules()}
                </>
              )}
            </div>
          )
        })()
      )}
    </div>
  )
}
