/**
 * 报表详情 /finance/report/:key（商家端控制台骨架批 · 片 5 段 4 · W-13 报表目录点亮）
 *
 * 按 :key 渲染 17 张报表之一：D1–D9 + N1–N6=月份口径数据表（report.* 读口，
 * merchantManagerProcedure=owner|manager；clerk 由 ClerkRouteGuard /finance 前缀拦）；
 * N7/N8=埋点预埋说明页（九类事件清单+contentEventStats 计数=预埋有效性实证，
 * 出表=瀑布流批）。
 *
 * 页骨架=MainScaffold（title=报表名）+ 月份选择器（input type=month，默认当月，
 * 预埋页不渲染）+「导出 CSV」钮（**仅店主可见**——useMerchantRole().isOwner；
 * report.exportCsv+Blob 下载工艺照 CashierRefundsPage 先例；非店主不渲染）+
 * 数据区（u3-tbl 表/u3-stat 卡照 FinancePage 惯例）+ 口径注记行（server note 透出）。
 * 大批片 2 · 三视图（owner 页头切换）：单店=门店下拉（listMine，选中店传 storeId）/
 * 分店=逐店并列（逐店传 storeId 调同一端点）/ 合计=scope:'chain'；manager 不出现切换
 * （固定本店现状，缺省入参零回归）。scope 入参=server 片 2 契约（monthInput）直连。
 *
 * 三态惯例：Loading=shared Skeleton（aria-label="加载中"，animate-pulse 禁转圈）/
 * Error=面板内文案+QuietButton 重试/空态=面板内居中明面文案。
 * N4 差评回复（reviewReply 写口 owner|manager；tags 取值集=REVIEW_TAG_SET 五值）；
 * N6 铁规两件在屏：申诉通道说明卡（gate.appealEntry 透出）+申诉队列内嵌简表
 * （listMetricAppeals）+去审批中心 Link /ops；审批动作在 /ops 不在本页。
 */

import { Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import MainScaffold, { QuietButton } from '@/components/MainScaffold';
import { storeTodayStr } from '@/components/cashier/refund';
import { formatDateTime, formatYuan } from '@/components/finance/utils';
import { rpt, type ReportCopyKey } from '@/copy/report';
import { useMerchantRole } from '@/lib/roles';

type ReportOutputs = inferRouterOutputs<AppRouter>['report'];

/** 15 张数据表读口返回联合（exportCsv dispatch 同名单） */
type SheetData =
  | ReportOutputs['d1Revenue'] | ReportOutputs['d2ServiceMix'] | ReportOutputs['d3MemberGrowth']
  | ReportOutputs['d4PassLedger'] | ReportOutputs['d5StoredValue'] | ReportOutputs['d6Refunds']
  | ReportOutputs['d7StaffPerf'] | ReportOutputs['d8Boarding'] | ReportOutputs['d9Goods']
  | ReportOutputs['n1LevelDist'] | ReportOutputs['n2Renewal'] | ReportOutputs['n3RebateRoll']
  | ReportOutputs['n4ReviewDist'] | ReportOutputs['n5Delivery'] | ReportOutputs['n6StaffQuality'];

type SheetKey =
  | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8' | 'd9'
  | 'n1' | 'n2' | 'n3' | 'n4' | 'n5' | 'n6';
type EmbedKey = 'n7' | 'n8';
type ReportKey = SheetKey | EmbedKey;

const SHEET_KEYS: readonly SheetKey[] = [
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9',
  'n1', 'n2', 'n3', 'n4', 'n5', 'n6',
];
const EMBED_KEYS: readonly EmbedKey[] = ['n7', 'n8'];
const ALL_KEYS: readonly ReportKey[] = [...SHEET_KEYS, ...EMBED_KEYS];

/** 报表读口 scope 入参（大批片 2 server 契约：缺省=本店零回归；chain=店域合计；storeId=店域内任选） */
type SheetScopeInput = { month: string; scope?: 'store' | 'chain'; storeId?: string };

/** 三视图（owner 页头切换；manager 不出现=固定本店现状） */
type ReportView = 'store' | 'stores' | 'chain';

const TITLE_COPY: Record<ReportKey, ReportCopyKey> = {
  d1: 'rpt.dirD1', d2: 'rpt.dirD2', d3: 'rpt.dirD3', d4: 'rpt.dirD4', d5: 'rpt.dirD5',
  d6: 'rpt.dirD6', d7: 'rpt.dirD7', d8: 'rpt.dirD8', d9: 'rpt.dirD9',
  n1: 'rpt.dirN1', n2: 'rpt.dirN2', n3: 'rpt.dirN3', n4: 'rpt.dirN4', n5: 'rpt.dirN5',
  n6: 'rpt.dirN6', n7: 'rpt.dirN7', n8: 'rpt.dirN8',
};

/** N4 差评原因标签取值集（=server schema REVIEW_TAG_SET，zod 硬约束五值） */
const REVIEW_TAGS = ['洗护质量', '态度', '等待', '价格', '宠物状态'] as const;

/** D6 退款类型五分列标签（schema refund_bills.type 取值） */
const REFUND_TYPE_LABEL: Record<string, string> = {
  full: '全额退款',
  partial_items: '按行退款',
  partial_amount: '按金额退款',
  boarding_nights: '寄养剩余晚',
  pass_cancel: '次卡退卡',
};

/* ---------------- 展示小件 ---------------- */

const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
const bpPct = (bp: number | null): string =>
  bp === null ? '—' : `${bp >= 0 ? '+' : ''}${(bp / 100).toFixed(1)}%`;
const yuan = (fen: number): string => `¥${formatYuan(fen)}`;

/** u3-stat 卡（FinancePage 同惯例；tone=red 红字强调=红字口径） */
function StatCard({ cap, value, sub, tone, testid }: {
  cap: string; value: string; sub?: string; tone?: 'red'; testid?: string;
}) {
  return (
    <div className="u3-stat" data-testid={testid}>
      <div className="cap">{cap}</div>
      <div className={`v ${tone === 'red' ? 'text-danger-deep' : ''}`}>{value}</div>
      {sub ? <div className="d u1-num">{sub}</div> : null}
    </div>
  );
}

/** u3-panel + u3-panel-head 面板 */
function Panel({ title, aside, children, testid }: {
  title: string; aside?: string; children: ReactNode; testid?: string;
}) {
  return (
    <div className="u3-panel mt-3.5" data-testid={testid}>
      <div className="u3-panel-head">
        <h3>{title}</h3>
        {aside ? <span className="aside">{aside}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** 面板内居中明面空态 */
function EmptyLine({ text }: { text?: string }) {
  return (
    <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-10 text-center text-body-sm text-[rgba(59,46,36,.62)]">
      {text ?? rpt('rpt.page.empty')}
    </div>
  );
}

/** 口径注记行（server note 透出） */
function NoteRow({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <p className="mt-2 px-1 text-caption-xs text-[rgba(59,46,36,.42)]">
      {rpt('rpt.page.noteLead')}
      {note}
    </p>
  );
}

/** 占比条（会员 vs 散客 / 星级分布通用；零图表库手绘 div 条） */
function RatioBar({ ratio, testid }: { ratio: number; testid?: string }) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-chip"
      style={{ background: 'rgba(59,46,36,.08)' }}
      data-testid={testid}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, height: '100%', background: 'rgba(59,46,36,.85)' }} />
    </div>
  );
}

/** 迷你 SVG 条图（D4 近 6 月扣次趋势 · 手绘零图表库） */
function MiniBars({ items, testid }: { items: Array<{ label: string; value: number }>; testid?: string }) {
  if (items.length === 0) return null;
  const W = 560;
  const H = 108;
  const PADB = 18;
  const PADT = 14;
  const max = Math.max(...items.map((i) => i.value), 1);
  const slot = W / items.length;
  const bw = slot * 0.56;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-24 w-full" role="img" data-testid={testid}>
      {items.map((it, i) => {
        const x = slot * i + (slot - bw) / 2;
        const h = (it.value / max) * (H - PADB - PADT);
        return (
          <g key={it.label}>
            {it.value > 0 ? (
              <rect x={x} y={H - PADB - h} width={bw} height={h} rx={3} fill="rgba(59,46,36,.75)" />
            ) : null}
            <text x={x + bw / 2} y={H - PADB - h - 4} textAnchor="middle" fontSize={11} fill="rgba(59,46,36,.75)">
              {it.value}
            </text>
            <text x={x + bw / 2} y={H - 5} textAnchor="middle" fontSize={11} fill="rgba(59,46,36,.55)">
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 环比/同比签（≥0 live / <0 amber / 无基数 wait） */
function DeltaBadge({ label, bp, testid }: { label: string; bp: number | null; testid?: string }) {
  if (bp === null) {
    return <span className="u3-st wait" data-testid={testid}>{label} {rpt('rpt.d1.noBase')}</span>;
  }
  return (
    <span className={`u3-st ${bp >= 0 ? 'live' : 'amber'}`} data-testid={testid}>
      {label} {bpPct(bp)}
    </span>
  );
}

/* ---------------- D1–D9 ---------------- */

function D1Body({ d }: { d: ReportOutputs['d1Revenue'] }) {
  const share = d.memberVsGuest.memberShare;
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StatCard cap={rpt('rpt.d1.cashCard')} value={yuan(d.cashFen)} sub={rpt('rpt.d1.cashSub')} testid="d1-cash" />
        <StatCard cap={rpt('rpt.d1.amortCard')} value={yuan(d.amortizedFen)} sub={rpt('rpt.d1.amortSub')} testid="d1-amortized" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="d1-deltas">
        <DeltaBadge label={rpt('rpt.d1.momLabel')} bp={d.momBp} testid="d1-mom" />
        <DeltaBadge label={rpt('rpt.d1.yoyLabel')} bp={d.yoyBp} testid="d1-yoy" />
      </div>
      <Panel title={rpt('rpt.d1.memberShareTitle')} testid="d1-member-share">
        <div className="px-[17px] py-4">
          {share === null ? (
            <div className="text-center text-body-sm text-[rgba(59,46,36,.62)]">{rpt('rpt.page.empty')}</div>
          ) : (
            <>
              <RatioBar ratio={share} testid="d1-member-bar" />
              <div className="mt-2 flex justify-between text-caption-xs text-[rgba(59,46,36,.62)]">
                <span>{rpt('rpt.d1.memberLabel')} {yuan(d.memberVsGuest.memberFen)} · {pct(share)}</span>
                <span>{rpt('rpt.d1.guestLabel')} {yuan(d.memberVsGuest.nonMemberFen)} · {pct(1 - share)}</span>
              </div>
            </>
          )}
        </div>
      </Panel>
      <Panel title={rpt('rpt.d1.byDayTitle')} testid="d1-byday">
        <table className="u3-tbl">
          <thead>
            <tr>
              <th>日期</th>
              <th className="text-right">营收</th>
            </tr>
          </thead>
          <tbody>
            {d.byDay.map((row) => (
              <tr key={row.date}>
                <td className="u1-num font-bold">{row.date}</td>
                <td className="u1-num text-right font-bold">{yuan(row.totalFen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <NoteRow
        note={rpt('rpt.d1.nonCashNote', {
          pass: yuan(d.breakdown.passFen),
          sv: yuan(d.breakdown.storedValueFen),
          rb: yuan(d.breakdown.rebateFen),
        })}
      />
    </>
  );
}

function D2Body({ d }: { d: ReportOutputs['d2ServiceMix'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StatCard
          cap={rpt('rpt.d2.attachCard')}
          value={pct(d.addon.attachRate)}
          sub={rpt('rpt.d2.attachSub', { n: d.addon.attachCount, t: d.totalCount, amt: yuan(d.addon.addonFen) })}
          testid="d2-attach"
        />
        <StatCard cap="服务营收合计" value={yuan(d.totalFen)} sub={`${d.totalCount} 笔`} testid="d2-total" />
      </div>
      <Panel title={rpt('rpt.d2.tableTitle')} aside={d.addon.benchmark} testid="d2-byservice">
        {d.byService.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>服务项</th>
                <th className="text-right">笔数</th>
                <th className="text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              {d.byService.map((s) => (
                <tr key={s.name}>
                  <td className="font-semibold">{s.name}</td>
                  <td className="u1-num text-right">{s.count}</td>
                  <td className="u1-num text-right font-bold">{yuan(s.fen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function D3Body({ d }: { d: ReportOutputs['d3MemberGrowth'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard cap={rpt('rpt.d3.newCard')} value={String(d.newCount)} testid="d3-new" />
        <StatCard cap={rpt('rpt.d3.activeCard')} value={String(d.activeTotal)} testid="d3-active" />
        <StatCard
          cap={rpt('rpt.d3.active90Card')}
          value={pct(d.active90dRate)}
          sub={rpt('rpt.d3.active90Sub', { n: d.active90dCount, t: d.activeTotal })}
          testid="d3-active90"
        />
      </div>
      <Panel title={rpt('rpt.d3.byPlanTitle')} testid="d3-byplan">
        {d.newByPlan.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>档位</th>
                <th className="text-right">新增数</th>
              </tr>
            </thead>
            <tbody>
              {d.newByPlan.map((p) => (
                <tr key={p.planKey}>
                  <td className="font-semibold">{p.planName ?? p.planKey}</td>
                  <td className="u1-num text-right font-bold">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

function D4Body({ d }: { d: ReportOutputs['d4PassLedger'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard cap={rpt('rpt.d4.grantedCard')} value={`${d.grantedTimesInMonth} 次`} testid="d4-granted" />
        <StatCard cap={rpt('rpt.d4.deductedCard')} value={`${d.deductedTimesInMonth} 次`} testid="d4-deducted" />
        <StatCard
          cap={rpt('rpt.d4.remainCard')}
          value={`${d.remainTimes} 次`}
          sub={rpt('rpt.d4.stockSub', { n: d.passCount, t: d.totalTimes })}
          testid="d4-remain"
        />
      </div>
      <Panel title={rpt('rpt.d4.trendTitle')} testid="d4-trend">
        <div className="px-[17px] py-4">
          <MiniBars
            items={d.consumeTrend6m.map((t) => ({ label: t.month.slice(2), value: t.deductedTimes }))}
            testid="d4-trend-bars"
          />
        </div>
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

function D5Body({ d }: { d: ReportOutputs['d5StoredValue'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard cap={rpt('rpt.d5.rechargeCard')} value={yuan(d.rechargeFen)} testid="d5-recharge" />
        <StatCard cap={rpt('rpt.d5.consumeCard')} value={yuan(d.consumeFen)} testid="d5-consume" />
        <StatCard cap={rpt('rpt.d5.liabilityCard')} value={yuan(d.liabilityFen)} testid="d5-liability" />
      </div>
      {/* 预收负债总额行（储值+回馈金合并，红字强调=红字口径） */}
      <div
        className="u3-panel mt-3.5 flex flex-wrap items-center justify-between gap-2 px-[17px] py-3.5"
        data-testid="d5-prepaid-row"
      >
        <span className="text-caption font-semibold">
          {rpt('rpt.d5.prepaidRow', { sv: formatYuan(d.liabilityFen), rb: formatYuan(d.rebateLiabilityFen) })}
        </span>
        <span className="u1-num text-body-lg font-bold text-danger-deep">{yuan(d.prepaidLiabilityTotalFen)}</span>
      </div>
      <NoteRow note={d.note} />
    </>
  );
}

function D6Body({ d }: { d: ReportOutputs['d6Refunds'] }) {
  return (
    <>
      {/* 环比突增预警行（warn=true → amber 签 + 红字透出） */}
      {d.spike.warn ? (
        <div
          className="u3-panel mb-3.5 flex flex-wrap items-center gap-2 px-[17px] py-3 text-caption"
          data-testid="d6-spike-warn"
        >
          <span className="u3-st amber">预警</span>
          <span className="font-semibold text-danger-deep">
            {rpt('rpt.d6.spikeWarn', {
              pct: bpPct(d.spike.momBp),
              th: `${(d.spike.thresholdBp / 100).toFixed(0)}%`,
            })}
          </span>
        </div>
      ) : (
        <p className="mb-3.5 px-1 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="d6-spike-ok">
          {d.spike.momBp === null
            ? rpt('rpt.d6.spikeNa')
            : rpt('rpt.d6.spikeOk', { pct: bpPct(d.spike.momBp), th: `${(d.spike.thresholdBp / 100).toFixed(0)}%` })}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard cap={rpt('rpt.d6.countCard')} value={String(d.count)} testid="d6-count" />
        <StatCard cap={rpt('rpt.d6.amountCard')} value={yuan(d.amountFen)} tone={d.amountFen > 0 ? 'red' : undefined} testid="d6-amount" />
        <StatCard
          cap={rpt('rpt.d6.rejectCard')}
          value={pct(d.requests.rejectRate)}
          sub={rpt('rpt.d6.rejectSub', { r: d.requests.rejected, t: d.requests.total })}
          testid="d6-reject"
        />
      </div>
      <Panel title={rpt('rpt.d6.byTypeTitle')} aside={rpt('rpt.d6.linkedBad', { n: d.linkedBadReviews })} testid="d6-bytype">
        {d.byType.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>类型</th>
                <th className="text-right">笔数</th>
                <th className="text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              {d.byType.map((t) => (
                <tr key={t.type}>
                  <td className="font-semibold">{REFUND_TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="u1-num text-right">{t.count}</td>
                  <td className="u1-num text-right font-bold text-danger-deep">−{yuan(t.amountFen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title={rpt('rpt.d6.reasonTitle')} testid="d6-reasons">
        {d.reasonCluster.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>申请原因</th>
                <th className="text-right">件数</th>
              </tr>
            </thead>
            <tbody>
              {d.reasonCluster.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="u1-num text-right font-bold">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function D7Body({ d }: { d: ReportOutputs['d7StaffPerf'] }) {
  return (
    <>
      <Panel title={rpt('rpt.d7.tableTitle')} testid="d7-table">
        {d.rows.length === 0 ? (
          <EmptyLine />
        ) : (
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[860px]">
              <thead>
                <tr>
                  <th>员工</th>
                  <th className="text-right">营收</th>
                  <th className="text-right">完成单数</th>
                  <th className="text-right">差评率</th>
                  <th className="text-right">报告时效</th>
                  <th className="text-right">复购率</th>
                  <th className="text-right">申诉数</th>
                  <th className="text-right">纠错数</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((s) => (
                  <tr key={s.staffId}>
                    <td className="font-semibold">{s.staffName}</td>
                    <td className="u1-num text-right font-bold">{yuan(s.serviceFen)}</td>
                    <td className="u1-num text-right">{s.completedCount}</td>
                    <td className="u1-num text-right">{pct(s.badRate)}</td>
                    <td className="u1-num text-right">
                      {s.reportAvgMinutes === null ? '—' : rpt('rpt.n4.minutesVal', { n: s.reportAvgMinutes })}
                    </td>
                    <td className="u1-num text-right">{pct(s.repurchaseRate)}</td>
                    <td className="u1-num text-right">{s.appealCount}</td>
                    <td className="u1-num text-right">{s.correctedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {/* 海底捞警示注记行（guard.note 透出） */}
      <p className="mt-2 px-1 text-caption-xs text-[rgba(59,46,36,.42)]" data-testid="d7-guard-note">
        {d.guard.note}
      </p>
    </>
  );
}

function D8Body({ d }: { d: ReportOutputs['d8Boarding'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          cap={rpt('rpt.d8.occCard')}
          value={pct(d.occupancyRate)}
          sub={rpt('rpt.d8.occSub', { pets: d.petNights, cap: d.capacityNights })}
          testid="d8-occ"
        />
        <StatCard cap={rpt('rpt.d8.nightsCard')} value={String(d.petNights)} testid="d8-nights" />
        <StatCard
          cap={rpt('rpt.d8.perNightCard')}
          value={d.revenuePerPetNightFen === null ? '—' : yuan(d.revenuePerPetNightFen)}
          testid="d8-pernight"
        />
        <StatCard cap={rpt('rpt.d8.attachCard')} value={pct(d.addonAttachRate)} testid="d8-attach" />
        <StatCard
          cap={rpt('rpt.d8.overdueCard')}
          value={String(d.overdueCount)}
          tone={d.overdueCount > 0 ? 'red' : undefined}
          testid="d8-overdue"
        />
      </div>
      <NoteRow note={d.note} />
    </>
  );
}

function D9Body({ d }: { d: ReportOutputs['d9Goods'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          cap={rpt('rpt.d9.unitsCard')}
          value={String(d.unitsSold)}
          sub={rpt('rpt.d9.ordersSub', { n: d.orderCount })}
          testid="d9-units"
        />
        <StatCard cap={rpt('rpt.d9.salesCard')} value={yuan(d.salesFen)} testid="d9-sales" />
        <StatCard cap={rpt('rpt.d9.sellThroughCard')} value={pct(d.sellThroughRate)} testid="d9-sellthrough" />
        <StatCard
          cap={rpt('rpt.d9.turnoverCard')}
          value={d.turnoverDays === null ? '—' : `${d.turnoverDays} 天`}
          testid="d9-turnover"
        />
      </div>
      <Panel title={rpt('rpt.d9.byProductTitle')} testid="d9-byproduct">
        {d.byProduct.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>商品</th>
                <th className="text-right">销量</th>
                <th className="text-right">销售额</th>
              </tr>
            </thead>
            <tbody>
              {d.byProduct.map((p) => (
                <tr key={p.name}>
                  <td className="font-semibold">{p.name}</td>
                  <td className="u1-num text-right">{p.qty}</td>
                  <td className="u1-num text-right font-bold">{yuan(p.fen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

/* ---------------- 大批片 5：D9 排行/滞销 + 周报 ---------------- */

/** D9 旁「排行/滞销」块（d9TopGoods：ranking 榜 top20 + slowMoving 表；同 sheet 三视图入参透传） */
function D9TopSection({ month, scope, storeId }: { month: string; scope?: 'store' | 'chain'; storeId?: string }) {
  const { trpc } = usePhiliaClient();
  const topQ = useQuery({
    queryKey: ['report', 'd9TopGoods', month, scope ?? null, storeId ?? null],
    queryFn: () => {
      const m: SheetScopeInput = { month };
      if (scope) m.scope = scope;
      if (storeId) m.storeId = storeId;
      return trpc.report.d9TopGoods.query(m);
    },
  });

  if (topQ.isPending) {
    return (
      <div aria-label="加载中">
        <Panel title={rpt('rpt.d9top.rankTitle')} testid="d9top-rank">
          <div className="space-y-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 rounded-chip" />
            ))}
          </div>
        </Panel>
      </div>
    );
  }
  if (topQ.isError || !topQ.data) {
    return (
      <div className="u3-panel mt-3.5 px-[17px] py-12 text-center">
        <p className="text-body-sm text-[rgba(59,46,36,.62)]">{rpt('rpt.page.loadError')}</p>
        <div className="mt-4">
          <QuietButton testid="d9top-retry" onClick={() => void topQ.refetch()}>
            {rpt('rpt.page.retry')}
          </QuietButton>
        </div>
      </div>
    );
  }
  const d = topQ.data;
  return (
    <>
      <Panel title={rpt('rpt.d9top.rankTitle')} testid="d9top-rank">
        {d.ranking.length === 0 ? (
          <EmptyLine text={rpt('rpt.d9top.rankEmpty')} />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>商品</th>
                <th className="text-right">销量</th>
                <th className="text-right">销售额</th>
              </tr>
            </thead>
            <tbody>
              {d.ranking.map((r, i) => (
                <tr key={r.productId} data-testid={`d9top-rank-${r.productId}`}>
                  <td className="u1-num font-bold">{i + 1}</td>
                  <td className="font-semibold">{r.name}</td>
                  <td className="u1-num text-right">{r.qty}</td>
                  <td className="u1-num text-right font-bold">{yuan(r.salesFen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title={rpt('rpt.d9top.slowTitle')} testid="d9top-slow">
        {d.slowMoving.length === 0 ? (
          <EmptyLine text={rpt('rpt.d9top.slowEmpty')} />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>商品</th>
                <th className="text-right">在库</th>
                <th className="text-right">月销</th>
              </tr>
            </thead>
            <tbody>
              {d.slowMoving.map((s) => (
                <tr key={s.productId} data-testid={`d9top-slow-${s.productId}`}>
                  <td className="font-semibold">{s.name}</td>
                  <td className="u1-num text-right">{s.stock}</td>
                  <td className="u1-num text-right">
                    <span className="u3-st amber">{s.monthQty}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

/** 周报卡（weeklySummary：本周 vs 上周 + 环比徽 + byDay 序列；页头「周报」切换点亮） */
function WeeklySection({ scope, storeId }: { scope?: 'store' | 'chain'; storeId?: string }) {
  const { trpc } = usePhiliaClient();
  const weekQ = useQuery({
    queryKey: ['report', 'weeklySummary', scope ?? null, storeId ?? null],
    queryFn: () =>
      trpc.report.weeklySummary.query({
        ...(scope ? { scope } : {}),
        ...(storeId ? { storeId } : {}),
      }),
  });

  if (weekQ.isPending) {
    return (
      <div aria-label="加载中">
        <SheetSkeleton />
      </div>
    );
  }
  if (weekQ.isError || !weekQ.data) {
    return (
      <div className="u3-panel px-[17px] py-12 text-center">
        <p className="text-body-sm text-[rgba(59,46,36,.62)]">{rpt('rpt.page.loadError')}</p>
        <div className="mt-4">
          <QuietButton testid="weekly-retry" onClick={() => void weekQ.refetch()}>
            {rpt('rpt.page.retry')}
          </QuietButton>
        </div>
      </div>
    );
  }
  const d = weekQ.data;
  return (
    <div data-testid="weekly-section">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StatCard
          cap={rpt('rpt.weekly.curCard')}
          value={yuan(d.current.totalFen)}
          sub={`${rpt('rpt.weekly.count', { n: d.current.paidCount })} · ${rpt('rpt.weekly.serviceShop', { sv: yuan(d.current.serviceFen), sp: yuan(d.current.shopFen) })}`}
          testid="weekly-current"
        />
        <StatCard
          cap={rpt('rpt.weekly.prevCard')}
          value={yuan(d.previous.totalFen)}
          sub={`${rpt('rpt.weekly.count', { n: d.previous.paidCount })} · ${rpt('rpt.weekly.serviceShop', { sv: yuan(d.previous.serviceFen), sp: yuan(d.previous.shopFen) })}`}
          testid="weekly-previous"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="weekly-wow">
        <DeltaBadge
          label={rpt('rpt.weekly.wowLabel')}
          bp={d.wow === null ? null : Math.round(d.wow * 10000)}
          testid="weekly-wow-badge"
        />
        <span className="text-caption-xs text-[rgba(59,46,36,.42)]">
          {rpt('rpt.weekly.title')} · {d.weekStart}
        </span>
      </div>
      <Panel title={rpt('rpt.weekly.byDayTitle')} testid="weekly-byday">
        {d.current.byDay.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>日期</th>
                <th className="text-right">营收</th>
              </tr>
            </thead>
            <tbody>
              {d.current.byDay.map((row) => (
                <tr key={row.date}>
                  <td className="u1-num font-bold">{row.date}</td>
                  <td className="u1-num text-right font-bold">{yuan(row.serviceFen + row.shopFen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <NoteRow note={d.note} />
    </div>
  );
}

/* ---------------- N1–N6 ---------------- */

function N1Body({ d }: { d: ReportOutputs['n1LevelDist'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard cap={rpt('rpt.n1.exitCard')} value={String(d.exitCount)} testid="n1-exit" />
        <StatCard
          cap={rpt('rpt.n1.upgradeCard')}
          value={pct(d.upgradeRate)}
          sub={rpt('rpt.n1.upDownSub', { u: d.upgradeCount, d: d.downgradeCount })}
          testid="n1-upgrade"
        />
        <StatCard cap={rpt('rpt.n1.downgradeCard')} value={pct(d.downgradeRate)} testid="n1-downgrade" />
      </div>
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Panel title={rpt('rpt.n1.stockTitle')} testid="n1-stock">
          {d.stock.length === 0 ? (
            <EmptyLine />
          ) : (
            <table className="u3-tbl">
              <thead>
                <tr>
                  <th>档位</th>
                  <th className="text-right">存量</th>
                </tr>
              </thead>
              <tbody>
                {d.stock.map((s) => (
                  <tr key={s.planKey}>
                    <td className="font-semibold">{s.planName}</td>
                    <td className="u1-num text-right font-bold">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title={rpt('rpt.n1.newTitle')} testid="n1-new">
          {d.newInMonth.length === 0 ? (
            <EmptyLine />
          ) : (
            <table className="u3-tbl">
              <thead>
                <tr>
                  <th>档位</th>
                  <th className="text-right">新增</th>
                </tr>
              </thead>
              <tbody>
                {d.newInMonth.map((s) => (
                  <tr key={s.planKey}>
                    <td className="font-semibold">{s.planName}</td>
                    <td className="u1-num text-right font-bold">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
      <Panel title={rpt('rpt.n1.cohortTitle')} testid="n1-cohort">
        {d.cohorts.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>入会月份</th>
                <th className="text-right">当期新增</th>
                <th className="text-right">至今仍活跃</th>
              </tr>
            </thead>
            <tbody>
              {d.cohorts.map((c) => (
                <tr key={c.cohort}>
                  <td className="u1-num font-bold">{c.cohort}</td>
                  <td className="u1-num text-right">{c.count}</td>
                  <td className="u1-num text-right font-bold">{c.retained}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

function N2Body({ d }: { d: ReportOutputs['n2Renewal'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StatCard
          cap={rpt('rpt.n2.paybackCard')}
          value={pct(d.payback.avgRate)}
          sub={rpt('rpt.n2.paybackSub', {
            n: d.payback.members,
            paid: formatYuan(d.payback.paidFen),
            saved: formatYuan(d.payback.savedFen),
          })}
          testid="n2-payback"
        />
      </div>
      <Panel title={rpt('rpt.n2.cohortTitle')} testid="n2-cohort">
        {d.cohorts.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>到期月份</th>
                <th className="text-right">到期数</th>
                <th className="text-right">续费数</th>
                <th className="text-right">续费率</th>
              </tr>
            </thead>
            <tbody>
              {d.cohorts.map((c) => (
                <tr key={c.month}>
                  <td className="u1-num font-bold">{c.month}</td>
                  <td className="u1-num text-right">{c.dueCount}</td>
                  <td className="u1-num text-right">{c.renewedCount}</td>
                  <td className="u1-num text-right font-bold">{pct(c.renewRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title={rpt('rpt.n2.warnTitle')} testid="n2-warn">
        {d.warnList.length === 0 ? (
          <EmptyLine text={rpt('rpt.n2.warnEmpty')} />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>会员</th>
                <th>档位</th>
                <th className="text-right">到期日</th>
              </tr>
            </thead>
            <tbody>
              {d.warnList.map((w) => (
                <tr key={w.userId}>
                  <td className="u1-num">{w.userId.slice(-4)}</td>
                  <td className="font-semibold">{w.planName}</td>
                  <td className="u1-num text-right">
                    <span className="u3-st amber">{formatDateTime(w.expiresAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title={rpt('rpt.n2.paybackDetailTitle')} testid="n2-payback-detail">
        {d.payback.detail.length === 0 ? (
          <EmptyLine />
        ) : (
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[720px]">
              <thead>
                <tr>
                  <th>会员</th>
                  <th>档位</th>
                  <th className="text-right">年费</th>
                  <th className="text-right">实省</th>
                  <th className="text-right">回本率</th>
                </tr>
              </thead>
              <tbody>
                {d.payback.detail.map((m) => (
                  <tr key={m.userId}>
                    <td className="font-semibold">{m.nickname ?? m.userId.slice(-4)}</td>
                    <td>{m.planKey}</td>
                    <td className="u1-num text-right">{yuan(m.paidFen)}</td>
                    <td className="u1-num text-right">{yuan(m.savedFen)}</td>
                    <td className="u1-num text-right font-bold">{pct(m.paybackRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

function N3Body({ d }: { d: ReportOutputs['n3RebateRoll'] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StatCard
          cap={rpt('rpt.n3.redeemCard')}
          value={pct(d.redeemRate)}
          sub={rpt('rpt.n3.redeemSub', { g: formatYuan(d.grantTotalFen), d: formatYuan(d.deductTotalFen) })}
          testid="n3-redeem"
        />
        <StatCard cap={rpt('rpt.n3.closingCard')} value={yuan(d.closingLiabilityFen)} tone="red" testid="n3-closing" />
      </div>
      <Panel title={rpt('rpt.n3.rollTitle')} aside={rpt('rpt.n3.rollNote')} testid="n3-roll">
        {d.periods.length === 0 ? (
          <EmptyLine />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>期次</th>
                <th className="text-right">发行</th>
                <th className="text-right">核销</th>
                <th className="text-right">追回</th>
                <th className="text-right">过期清零</th>
              </tr>
            </thead>
            <tbody>
              {d.periods.map((p) => (
                <tr key={p.period}>
                  <td className="u1-num font-bold">{p.period}</td>
                  <td className="u1-num text-right">{yuan(p.grantFen)}</td>
                  <td className="u1-num text-right">{p.deductFen > 0 ? `−${yuan(p.deductFen)}` : '—'}</td>
                  <td className="u1-num text-right">{p.clawbackFen > 0 ? `−${yuan(p.clawbackFen)}` : '—'}</td>
                  <td className="u1-num text-right">{p.clearFen > 0 ? `−${yuan(p.clearFen)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

function N4Body({ d }: { d: ReportOutputs['n4ReviewDist'] }) {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast({ durationMs: 2500 });
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyTags, setReplyTags] = useState<Set<string>>(new Set());

  /* 差评明细=badReviewAgg.recent（近十条全时段口径，非同月过滤——面板 aside 明面注；
     大批片 2 起入参必填对象（scope 契约），{}=缺省本店零回归） */
  const badQ = useQuery({
    queryKey: ['report', 'badReviewAgg'],
    queryFn: () => trpc.report.badReviewAgg.query({}),
  });

  const replyM = useMutation({
    mutationFn: (input: { reviewId: string; reply: string; tags?: string[] }) =>
      trpc.report.reviewReply.mutate(input),
    onSuccess: () => {
      showToast(rpt('rpt.n4.replyDone'));
      setReplyTarget(null);
      setReplyText('');
      setReplyTags(new Set());
      void queryClient.invalidateQueries({ queryKey: ['report'] });
    },
    onError: (e) => showToast(e instanceof TRPCClientError ? e.message : rpt('rpt.page.actionFail')),
  });

  const toggleTag = (t: string) => {
    setReplyTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else if (next.size < 5) next.add(t);
      return next;
    });
  };

  const maxDist = Math.max(...d.dist.map((x) => x.count), 1);
  const recent = badQ.data?.recent ?? [];

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard cap={rpt('rpt.n4.badRateCard')} value={pct(d.badRate)} testid="n4-badrate" />
        <StatCard cap={rpt('rpt.n4.avgCard')} value={d.avgRating === null ? '—' : d.avgRating.toFixed(2)} testid="n4-avg" />
        <StatCard cap={rpt('rpt.n4.replyRateCard')} value={pct(d.reply.replyRate)} testid="n4-replyrate" />
        <StatCard
          cap={rpt('rpt.n4.replyTimeCard')}
          value={d.reply.avgMinutes === null ? '—' : rpt('rpt.n4.minutesVal', { n: d.reply.avgMinutes })}
          testid="n4-replytime"
        />
      </div>
      {/* 纠错扣减明示行（correctedCount>0 时显示） */}
      {d.correctedCount > 0 ? (
        <p className="mt-3 px-1 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]" data-testid="n4-corrected-row">
          {rpt('rpt.n4.correctedRow', { n: d.correctedCount })}
        </p>
      ) : null}
      <Panel title={rpt('rpt.n4.distTitle')} aside={`共 ${d.total} 条`} testid="n4-dist">
        <div className="space-y-2 px-[17px] py-4">
          {d.dist.map((row) => (
            <div key={row.star} className="flex items-center gap-3">
              <span className="u1-num w-10 text-caption-xs">{row.star} 星</span>
              <div className="flex-1">
                <RatioBar ratio={row.count / maxDist} testid={`n4-dist-${row.star}`} />
              </div>
              <span className="u1-num w-8 text-right text-caption-xs font-bold">{row.count}</span>
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid items-start gap-3.5 lg:grid-cols-3">
        <Panel title={rpt('rpt.n4.tagTitle')} testid="n4-tags">
          {d.tagCluster.length === 0 ? (
            <EmptyLine />
          ) : (
            <table className="u3-tbl">
              <tbody>
                {d.tagCluster.map((t) => (
                  <tr key={t.tag}>
                    <td>{t.tag}</td>
                    <td className="u1-num text-right font-bold">{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title={rpt('rpt.n4.byStaffTitle')} testid="n4-bystaff">
          {d.byStaff.length === 0 ? (
            <EmptyLine />
          ) : (
            <table className="u3-tbl">
              <thead>
                <tr>
                  <th>员工</th>
                  <th className="text-right">评价</th>
                  <th className="text-right">差评</th>
                </tr>
              </thead>
              <tbody>
                {d.byStaff.map((s) => (
                  <tr key={s.staffId}>
                    <td className="font-semibold">{s.staffName}</td>
                    <td className="u1-num text-right">{s.total}</td>
                    <td className="u1-num text-right font-bold">{s.bad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title={rpt('rpt.n4.byServiceTitle')} testid="n4-byservice">
          {d.byService.length === 0 ? (
            <EmptyLine />
          ) : (
            <table className="u3-tbl">
              <thead>
                <tr>
                  <th>服务</th>
                  <th className="text-right">评价</th>
                  <th className="text-right">差评</th>
                </tr>
              </thead>
              <tbody>
                {d.byService.map((s) => (
                  <tr key={s.serviceName}>
                    <td className="font-semibold">{s.serviceName}</td>
                    <td className="u1-num text-right">{s.total}</td>
                    <td className="u1-num text-right font-bold">{s.bad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
      {/* 差评列表 + 回复弹层（reviewReply 写口 owner|manager） */}
      <Panel title={rpt('rpt.n4.recentTitle')} aside={rpt('rpt.n4.recentAside')} testid="n4-recent">
        {badQ.isPending ? (
          <div className="space-y-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-4" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 rounded-chip" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyLine text={rpt('rpt.n4.recentEmpty')} />
        ) : (
          <div>
            {recent.map((r) => (
              <div
                key={r.id}
                className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3.5"
                data-testid={`n4-review-${r.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="u3-st amber">{r.rating} 星</span>
                  <span className="text-caption-xs text-[rgba(59,46,36,.62)]">
                    {r.staffName} · {r.customerLabel} · {formatDateTime(r.createdAt)}
                  </span>
                  {r.replied ? (
                    <span className="u3-st live">{rpt('rpt.n4.repliedBadge')}</span>
                  ) : (
                    <button
                      type="button"
                      className="ml-auto text-caption-xs font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.92]"
                      data-testid={`n4-reply-${r.id}`}
                      onClick={() => {
                        setReplyTarget(replyTarget === r.id ? null : r.id);
                        setReplyText('');
                        setReplyTags(new Set());
                      }}
                    >
                      {rpt('rpt.n4.replyCta')}
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-body-sm">{r.text}</p>
                {r.replied && r.replyText ? (
                  <p className="mt-1.5 rounded-control bg-[rgba(59,46,36,.04)] px-3 py-2 text-caption text-[rgba(59,46,36,.62)]">
                    {r.replyText}
                  </p>
                ) : null}
                {replyTarget === r.id ? (
                  <div className="mt-2.5 rounded-control bg-[rgba(59,46,36,.04)] p-3" data-testid={`n4-replybox-${r.id}`}>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={rpt('rpt.n4.replyPlaceholder')}
                      data-testid={`n4-replytext-${r.id}`}
                      className="u1-ring w-full rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
                    />
                    <div className="mt-2 text-caption-xs text-[rgba(59,46,36,.42)]">{rpt('rpt.n4.replyTagsLabel')}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {REVIEW_TAGS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`u3-chipf ${replyTags.has(t) ? 'on' : ''}`}
                          data-testid={`n4-replytag-${t}`}
                          onClick={() => toggleTag(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <QuietButton
                        testid={`n4-replysubmit-${r.id}`}
                        disabled={!replyText.trim() || replyM.isPending}
                        onClick={() =>
                          replyM.mutate({
                            reviewId: r.id,
                            reply: replyText.trim(),
                            tags: replyTags.size > 0 ? [...replyTags] : undefined,
                          })
                        }
                      >
                        {rpt('rpt.n4.replySubmit')}
                      </QuietButton>
                      <QuietButton onClick={() => setReplyTarget(null)}>{rpt('rpt.n4.replyCancel')}</QuietButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <NoteRow note={d.note} />
      {toastEl}
    </>
  );
}

function N5Body({ d }: { d: ReportOutputs['n5Delivery'] }) {
  const buckets: Array<{ key: string; label: string; count: number }> = [
    { key: 'within5', label: rpt('rpt.n5.bucket5'), count: d.deliveryBuckets.within5 },
    { key: 'within30', label: rpt('rpt.n5.bucket30'), count: d.deliveryBuckets.within30 },
    { key: 'within120', label: rpt('rpt.n5.bucket120'), count: d.deliveryBuckets.within120 },
    { key: 'over120', label: rpt('rpt.n5.bucketOver'), count: d.deliveryBuckets.over120 },
    { key: 'unread', label: rpt('rpt.n5.bucketUnread'), count: d.deliveryBuckets.unread },
  ];
  const maxBucket = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard cap={rpt('rpt.n5.completedCard')} value={String(d.completedCount)} testid="n5-completed" />
        <StatCard
          cap={rpt('rpt.n5.photoCard')}
          value={pct(d.photoCoverage)}
          sub={rpt('rpt.n5.photoSub', { n: d.photosTotal })}
          testid="n5-photo"
        />
        <StatCard cap={rpt('rpt.n5.sampleCard')} value={pct(d.sampleRate)} testid="n5-sample" />
        <StatCard
          cap={rpt('rpt.n5.actualCard')}
          value={d.actualMinutesAvg === null ? '—' : rpt('rpt.n4.minutesVal', { n: d.actualMinutesAvg })}
          testid="n5-actual"
        />
        <StatCard
          cap={rpt('rpt.n5.stdCard')}
          value={d.stdMinutesAvg === null ? '—' : rpt('rpt.n4.minutesVal', { n: d.stdMinutesAvg })}
          testid="n5-std"
        />
      </div>
      <Panel title={rpt('rpt.n5.bucketsTitle')} aside={`报告 ${d.reportCount} 份`} testid="n5-buckets">
        <div className="space-y-2 px-[17px] py-4">
          {buckets.map((b) => (
            <div key={b.key} className="flex items-center gap-3" data-testid={`n5-bucket-${b.key}`}>
              <span className="w-20 text-caption-xs">{b.label}</span>
              <div className="flex-1">
                <RatioBar ratio={b.count / maxBucket} />
              </div>
              <span className="u1-num w-8 text-right text-caption-xs font-bold">{b.count}</span>
            </div>
          ))}
        </div>
      </Panel>
      <NoteRow note={d.note} />
    </>
  );
}

function N6Body({ d }: { d: ReportOutputs['n6StaffQuality'] }) {
  const { trpc } = usePhiliaClient();
  /* 申诉队列内嵌简表（审批动作在 /ops 审批中心，本页只读透出） */
  const appealsQ = useQuery({
    queryKey: ['report', 'listMetricAppeals'],
    queryFn: () => trpc.report.listMetricAppeals.query(),
  });
  const appeals = [...(appealsQ.data?.pending ?? []), ...(appealsQ.data?.reviewed ?? [])];

  const statusBadge = (status: string) => {
    if (status === 'pending') return <span className="u3-st amber">{rpt('rpt.n6.statusPending')}</span>;
    if (status === 'approved') return <span className="u3-st live">{rpt('rpt.n6.statusApproved')}</span>;
    return <span className="u3-st done">{rpt('rpt.n6.statusRejected')}</span>;
  };

  return (
    <>
      {/* 铁规两件在屏：①申诉通道说明卡（gate.appealEntry 透出） */}
      <div className="u3-panel mb-3.5 px-[17px] py-3.5" data-testid="n6-gate">
        <div className="text-caption font-semibold">{rpt('rpt.n6.gateTitle')}</div>
        <div className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.62)]">
          ① {d.gate.appealEntry}
        </div>
        <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">② {d.gate.note}</div>
      </div>
      <Panel title={rpt('rpt.n6.tableTitle')} testid="n6-table">
        {d.rows.length === 0 ? (
          <EmptyLine />
        ) : (
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[720px]">
              <thead>
                <tr>
                  <th>员工</th>
                  <th className="text-right">评价数</th>
                  <th className="text-right">差评率</th>
                  <th className="text-right">报告时效</th>
                  <th className="text-right">复购率</th>
                  <th className="text-right">申诉数</th>
                  <th className="text-right">纠错数</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((s) => (
                  <tr key={s.staffId}>
                    <td className="font-semibold">{s.staffName}</td>
                    <td className="u1-num text-right">{s.reviewCount}</td>
                    <td className="u1-num text-right">{pct(s.badRate)}</td>
                    <td className="u1-num text-right">
                      {s.reportAvgMinutes === null ? '—' : rpt('rpt.n4.minutesVal', { n: s.reportAvgMinutes })}
                    </td>
                    <td className="u1-num text-right">{pct(s.repurchaseRate)}</td>
                    <td className="u1-num text-right">{s.appealCount}</td>
                    <td className="u1-num text-right">{s.correctedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {/* 铁规②申诉队列入口：内嵌简表 + 去审批中心 Link */}
      <Panel title={rpt('rpt.n6.queueTitle')} testid="n6-appeals">
        <div className="flex items-center justify-end border-t border-[rgba(59,46,36,.06)] px-[17px] py-2">
          <Link
            to="/ops"
            className="text-caption-xs font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.92]"
            data-testid="n6-appeals-go"
          >
            {rpt('rpt.n6.queueGo')}
          </Link>
        </div>
        {appealsQ.isPending ? (
          <div className="space-y-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-4" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-9 rounded-chip" />
            ))}
          </div>
        ) : appeals.length === 0 ? (
          <EmptyLine text={rpt('rpt.n6.queueEmpty')} />
        ) : (
          <div className="u3-noscrollx overflow-x-auto">
            <table className="u3-tbl min-w-[760px]">
              <thead>
                <tr>
                  <th>员工</th>
                  <th>申诉理由</th>
                  <th>状态</th>
                  <th>复核意见</th>
                  <th>纠错留痕</th>
                  <th className="text-right">复核时间</th>
                </tr>
              </thead>
              <tbody>
                {appeals.map((a) => (
                  <tr key={a.id} data-testid={`n6-appeal-${a.id}`}>
                    <td className="font-semibold">{a.staffName}</td>
                    <td className="max-w-56 truncate">{a.reason}</td>
                    <td>{statusBadge(a.status)}</td>
                    <td className="max-w-48 truncate text-[rgba(59,46,36,.62)]">{a.reviewNote ?? '—'}</td>
                    <td className="max-w-48 truncate text-caption-xs text-[rgba(59,46,36,.62)]">
                      {a.correctionJson ? JSON.stringify(a.correctionJson) : '—'}
                    </td>
                    <td className="u1-num text-right text-caption-xs">
                      {a.reviewedAt ? formatDateTime(a.reviewedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/* ---------------- N7/N8 埋点预埋说明页 ---------------- */

/** 九类预埋事件（名单写死=content_events 表头注/server trackContentEvent 枚举同序） */
const EMBED_EVENT_COPY: Array<{ eventType: string; copyKey: ReportCopyKey }> = [
  { eventType: 'case_impression', copyKey: 'rpt.embed.ev1' },
  { eventType: 'case_detail_view', copyKey: 'rpt.embed.ev2' },
  { eventType: 'case_dwell', copyKey: 'rpt.embed.ev3' },
  { eventType: 'case_read_finish', copyKey: 'rpt.embed.ev4' },
  { eventType: 'case_interact', copyKey: 'rpt.embed.ev5' },
  { eventType: 'book_same_impression', copyKey: 'rpt.embed.ev6' },
  { eventType: 'book_same_click', copyKey: 'rpt.embed.ev7' },
  { eventType: 'booking_attributed', copyKey: 'rpt.embed.ev8' },
  { eventType: 'booking_verified', copyKey: 'rpt.embed.ev9' },
];

function EmbedBody() {
  const { trpc } = usePhiliaClient();
  /* 预埋有效性实证=contentEventStats 当前计数透出（owner|manager） */
  const statsQ = useQuery({
    queryKey: ['report', 'contentEventStats'],
    queryFn: () => trpc.report.contentEventStats.query(),
  });
  const countOf = new Map((statsQ.data?.byType ?? []).map((r) => [r.eventType, r.count] as const));
  const totalEvents = (statsQ.data?.byType ?? []).reduce((s, r) => s + r.count, 0);

  return (
    <>
      <div className="u3-panel px-[17px] py-4 text-body-sm text-[rgba(59,46,36,.62)]" data-testid="embed-intro">
        {rpt('rpt.embed.intro')}
      </div>
      <Panel title={rpt('rpt.embed.eventsTitle')} testid="embed-events">
        <ul className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3.5">
          {EMBED_EVENT_COPY.map((e) => (
            <li key={e.eventType} className="py-1 text-caption">
              <span className="u1-num text-[rgba(59,46,36,.62)]">{e.eventType}</span>
              <span className="ml-2">{rpt(e.copyKey).replace(`${e.eventType} `, '')}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={rpt('rpt.embed.statsTitle')} testid="embed-stats">
        {statsQ.isPending ? (
          <div className="space-y-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-4" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 rounded-chip" />
            ))}
          </div>
        ) : totalEvents === 0 ? (
          <EmptyLine text={rpt('rpt.embed.statsEmpty')} />
        ) : (
          <table className="u3-tbl">
            <thead>
              <tr>
                <th>事件类型</th>
                <th className="text-right">计数</th>
              </tr>
            </thead>
            <tbody>
              {EMBED_EVENT_COPY.map((e) => (
                <tr key={e.eventType} data-testid={`embed-stat-${e.eventType}`}>
                  <td className="u1-num">{e.eventType}</td>
                  <td className="u1-num text-right font-bold">{countOf.get(e.eventType) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <NoteRow note={statsQ.data?.note} />
      <p className="mt-1 px-1 text-caption-xs text-[rgba(59,46,36,.42)]">{rpt('rpt.embed.outNote')}</p>
    </>
  );
}

/* ---------------- 页体 ---------------- */

/** 加载中骨架块（animate-pulse，禁转圈）：卡组 + 面板 = shared Skeleton 组合 */
function SheetSkeleton() {
  return (
    <div aria-label="加载中">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="u3-stat">
            <Skeleton className="h-3 w-16 rounded-chip" />
            <Skeleton className="mt-3 h-7 w-24 rounded-chip" />
          </div>
        ))}
      </div>
      <div className="u3-panel mt-3.5">
        <div className="u3-panel-head">
          <Skeleton className="h-4 w-24 rounded-chip" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3.5">
            <Skeleton className="h-3 w-full rounded-chip" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 数据体表体 dispatch（SheetData 联合 ↔ DxBody/NxBody 一一对应） */
function SheetBody({ sheetKey, data }: { sheetKey: SheetKey; data: SheetData }) {
  switch (sheetKey) {
    case 'd1': return <D1Body d={data as ReportOutputs['d1Revenue']} />;
    case 'd2': return <D2Body d={data as ReportOutputs['d2ServiceMix']} />;
    case 'd3': return <D3Body d={data as ReportOutputs['d3MemberGrowth']} />;
    case 'd4': return <D4Body d={data as ReportOutputs['d4PassLedger']} />;
    case 'd5': return <D5Body d={data as ReportOutputs['d5StoredValue']} />;
    case 'd6': return <D6Body d={data as ReportOutputs['d6Refunds']} />;
    case 'd7': return <D7Body d={data as ReportOutputs['d7StaffPerf']} />;
    case 'd8': return <D8Body d={data as ReportOutputs['d8Boarding']} />;
    case 'd9': return <D9Body d={data as ReportOutputs['d9Goods']} />;
    case 'n1': return <N1Body d={data as ReportOutputs['n1LevelDist']} />;
    case 'n2': return <N2Body d={data as ReportOutputs['n2Renewal']} />;
    case 'n3': return <N3Body d={data as ReportOutputs['n3RebateRoll']} />;
    case 'n4': return <N4Body d={data as ReportOutputs['n4ReviewDist']} />;
    case 'n5': return <N5Body d={data as ReportOutputs['n5Delivery']} />;
    case 'n6': return <N6Body d={data as ReportOutputs['n6StaffQuality']} />;
  }
}

/** 单块报表（查询+三态+表体）：单店=storeId / 合计=scope:'chain' / 缺省=本店零回归。
    15 张读口同一 monthInput 契约（{month, scope?, storeId?}），dispatch 与 SheetData 联合同步 */
function SheetSection({ sheetKey, month, scope, storeId }: {
  sheetKey: SheetKey; month: string; scope?: 'store' | 'chain'; storeId?: string;
}) {
  const { trpc } = usePhiliaClient();
  const sheetQ = useQuery({
    queryKey: ['report', 'sheet', sheetKey, month, scope ?? null, storeId ?? null],
    queryFn: (): Promise<SheetData> => {
      const m: SheetScopeInput = { month };
      if (scope) m.scope = scope;
      if (storeId) m.storeId = storeId;
      switch (sheetKey) {
        case 'd1': return trpc.report.d1Revenue.query(m);
        case 'd2': return trpc.report.d2ServiceMix.query(m);
        case 'd3': return trpc.report.d3MemberGrowth.query(m);
        case 'd4': return trpc.report.d4PassLedger.query(m);
        case 'd5': return trpc.report.d5StoredValue.query(m);
        case 'd6': return trpc.report.d6Refunds.query(m);
        case 'd7': return trpc.report.d7StaffPerf.query(m);
        case 'd8': return trpc.report.d8Boarding.query(m);
        case 'd9': return trpc.report.d9Goods.query(m);
        case 'n1': return trpc.report.n1LevelDist.query(m);
        case 'n2': return trpc.report.n2Renewal.query(m);
        case 'n3': return trpc.report.n3RebateRoll.query(m);
        case 'n4': return trpc.report.n4ReviewDist.query(m);
        case 'n5': return trpc.report.n5Delivery.query(m);
        case 'n6': return trpc.report.n6StaffQuality.query(m);
      }
    },
  });

  if (sheetQ.isPending) return <SheetSkeleton />;
  if (sheetQ.isError || !sheetQ.data) {
    return (
      <div className="u3-panel px-[17px] py-12 text-center">
        <p className="text-body-sm text-[rgba(59,46,36,.62)]">{rpt('rpt.page.loadError')}</p>
        <div className="mt-4">
          <QuietButton testid="report-retry" onClick={() => void sheetQ.refetch()}>
            {rpt('rpt.page.retry')}
          </QuietButton>
        </div>
      </div>
    );
  }
  return (
    <>
      <SheetBody sheetKey={sheetKey} data={sheetQ.data} />
      {/* 大批片 5：D9 页旁「排行/滞销」块（d9TopGoods，同三视图入参透传） */}
      {sheetKey === 'd9' ? <D9TopSection month={month} scope={scope} storeId={storeId} /> : null}
    </>
  );
}

export default function ReportPage() {
  const { trpc } = usePhiliaClient();
  const { showToast, toastEl } = useToast({ durationMs: 2500 });
  const role = useMerchantRole();
  const { key: rawKey } = useParams<{ key: string }>();
  const key = (rawKey ?? '').toLowerCase() as ReportKey;
  const valid = (ALL_KEYS as readonly string[]).includes(key);
  const isSheet = (SHEET_KEYS as readonly string[]).includes(key);

  const [month, setMonth] = useState(() => storeTodayStr().slice(0, 7));
  const [exporting, setExporting] = useState(false);
  /* 大批片 5：页头「周报」切换（weeklySummary 卡点亮/熄灭；照既有视图切换工艺 u3-chipf） */
  const [weeklyOn, setWeeklyOn] = useState(false);

  /* 大批片 2 · 三视图（owner）：单店=门店下拉传 storeId / 分店=逐店并列 / 合计=scope:'chain'；
     manager 不出现切换（固定本店现状，sheet 查询零入参加回=零回归） */
  const [view, setView] = useState<ReportView>('store');
  const [pickedStoreId, setPickedStoreId] = useState<string | null>(null);
  const mineQ = useQuery({
    enabled: role.isOwner && valid && isSheet,
    queryKey: ['store', 'listMine'],
    queryFn: () => trpc.store.listMine.query(),
  });
  const mineStores = mineQ.data?.stores ?? [];
  const effStoreId =
    pickedStoreId && mineStores.some((s) => s.id === pickedStoreId)
      ? pickedStoreId
      : mineStores.some((s) => s.id === role.storeId)
        ? role.storeId
        : mineStores[0]?.id;

  /** 导出 CSV（仅店主 · 总规则③）：query 端点直调 + Blob 浏览器下载（照 CashierRefundsPage 工艺） */
  const doExport = async () => {
    setExporting(true);
    try {
      const r = await trpc.report.exportCsv.query({ report: key as SheetKey, month });
      const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(rpt('rpt.page.exportDone', { name: r.filename, n: r.rows }));
    } catch (e) {
      showToast(e instanceof TRPCClientError ? e.message : rpt('rpt.page.exportFail'));
    } finally {
      setExporting(false);
    }
  };

  if (!valid) {
    return (
      <MainScaffold title={rpt('rpt.page.unknown')} testid="report-page-unknown">
        <div className="u3-panel px-[17px] py-12 text-center">
          <p className="text-body-sm text-[rgba(59,46,36,.62)]">{rawKey}</p>
          <div className="mt-4">
            <Link to="/finance" className="text-caption font-bold text-ink" data-testid="report-back">
              {rpt('rpt.page.backToDir')}
            </Link>
          </div>
        </div>
      </MainScaffold>
    );
  }

  const renderSheet = () => {
    if (role.isOwner && view === 'stores') {
      /* 分店视图：逐店并列（每店一块题 + 对应 sheet 数据，逐店传 storeId 调同一端点） */
      if (mineQ.isPending) return <SheetSkeleton />;
      return (
        <div data-testid="report-stores-view">
          {mineStores.map((s, i) => (
            <div key={s.id} className={i > 0 ? 'mt-7' : ''} data-testid={`report-store-${s.id}`}>
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <h3 className="text-body-sm font-bold">{s.name}</h3>
              </div>
              <SheetSection sheetKey={key as SheetKey} month={month} storeId={s.id} />
            </div>
          ))}
        </div>
      );
    }
    if (role.isOwner && view === 'chain') {
      /* 合计视图：店域合计（scope:'chain'） */
      return (
        <div data-testid="report-chain-view">
          <div className="mb-2 flex items-baseline gap-2 px-1">
            <h3 className="text-body-sm font-bold">{rpt('rpt.view.chain')}</h3>
            <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{rpt('rpt.view.chainAside')}</span>
          </div>
          <SheetSection sheetKey={key as SheetKey} month={month} scope="chain" />
        </div>
      );
    }
    /* 单店视图（owner 下拉选店传 storeId；manager 无切换=effStoreId 不参与，缺省本店零回归） */
    return (
      <SheetSection
        sheetKey={key as SheetKey}
        month={month}
        storeId={role.isOwner ? effStoreId : undefined}
      />
    );
  };

  /* 大批片 5：周报块按当前三视图同口径渲染（store=选中店 / stores=逐店 / chain=合计；manager 缺省本店） */
  const renderWeekly = () => {
    if (role.isOwner && view === 'stores') {
      if (mineQ.isPending) return <SheetSkeleton />;
      return (
        <div data-testid="weekly-stores-view">
          {mineStores.map((s, i) => (
            <div key={s.id} className={i > 0 ? 'mt-7' : ''}>
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <h3 className="text-body-sm font-bold">{s.name}</h3>
              </div>
              <WeeklySection storeId={s.id} />
            </div>
          ))}
        </div>
      );
    }
    if (role.isOwner && view === 'chain') {
      return <WeeklySection scope="chain" />;
    }
    return <WeeklySection storeId={role.isOwner ? effStoreId : undefined} />;
  };

  return (
    <MainScaffold
      title={rpt(TITLE_COPY[key])}
      sub={isSheet ? month : undefined}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/finance"
            className="text-caption font-semibold text-[rgba(59,46,36,.62)]"
            data-testid="report-back"
          >
            {rpt('rpt.page.backToDir')}
          </Link>
          {/* 大批片 5：页头「周报」切换（u3-chipf 同视图切换工艺；weeklySummary 卡点亮/熄灭） */}
          {isSheet ? (
            <button
              type="button"
              className={`u3-chipf${weeklyOn ? ' on' : ''}`}
              aria-pressed={weeklyOn}
              data-testid="report-weekly-toggle"
              onClick={() => setWeeklyOn((v) => !v)}
            >
              {rpt('rpt.weekly.toggle')}
            </button>
          ) : null}
          {isSheet ? (
            <label className="flex items-center gap-2 text-caption text-[rgba(59,46,36,.62)]">
              {rpt('rpt.page.monthLabel')}
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
                data-testid="report-month"
                className="u1-ring rounded-control bg-card px-3 py-2 font-number text-caption tabular-nums text-ink focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
              />
            </label>
          ) : null}
          {/* 大批片 2 · 三视图切换（仅 owner；滤签工艺照 StatusChips u3-chipf；manager 不出现） */}
          {role.isOwner && isSheet ? (
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="报表视图">
              {(
                [
                  ['store', 'rpt.view.store'],
                  ['stores', 'rpt.view.stores'],
                  ['chain', 'rpt.view.chain'],
                ] as const
              ).map(([v, ck]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={`u3-chipf${view === v ? ' on' : ''}`}
                  data-testid={`report-view-${v}`}
                  onClick={() => setView(v)}
                >
                  {rpt(ck)}
                </button>
              ))}
            </div>
          ) : null}
          {/* 单店视图门店下拉（listMine 店集合，选中店传 storeId；缺省=当前店） */}
          {role.isOwner && isSheet && view === 'store' ? (
            <label className="flex items-center gap-2 text-caption text-[rgba(59,46,36,.62)]">
              {rpt('rpt.view.storePick')}
              <select
                value={effStoreId ?? ''}
                onChange={(e) => setPickedStoreId(e.target.value || null)}
                data-testid="report-store-pick"
                className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
              >
                {mineStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {/* 导出 CSV 仅店主可见可点（总规则③；非店主不渲染，server exportCsv 同闸 403） */}
          {role.isOwner && isSheet ? (
            <QuietButton
              testid="report-export"
              disabled={exporting}
              onClick={() => void doExport()}
            >
              {exporting ? rpt('rpt.page.exporting') : rpt('rpt.page.exportCta')}
            </QuietButton>
          ) : null}
        </div>
      }
      testid={`report-page-${key}`}
    >
      {/* 大批片 5：周报卡（切换点亮时置于月报体上方） */}
      {isSheet && weeklyOn ? <div className="mb-6">{renderWeekly()}</div> : null}
      {isSheet ? renderSheet() : <EmbedBody />}
      {toastEl}
    </MainScaffold>
  );
}
