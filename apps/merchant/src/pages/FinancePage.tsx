/**
 * 报表 /finance（商家端控制台骨架批 · 片 5 段 3 · W-13 重建；底版=U3 批次任务 L）
 *
 * 区块序（UX-02 语言包 §四 W-13，路由 /finance 不动）：
 *   wtop（MainScaffold：title/sub 今日已收·待收 + 期间 chips 三档——chips 只驱动
 *   台账区间，四格恒取本月口径）
 *   → M3 四格：本月营收（financeStats 月档真值）/ 储值负债（无店级聚合读口，
 *     段 2 已核 → 置灰「读口待补」不造假）/ 回馈金负债（同置灰）/ 本月退款红
 *     （refund.list 月区间真值，已执行+已实退口径同日结单列）
 *   → R12 当日退款汇总一行（refund.dayStats 真值，当日净额=已收−退款，原位保留）
 *   → 左 M5 月度台账（现状流水重排：日期/类型/金额/支付方式/单号 + 状态/操作，
 *     已收 live / 待收 amber +「收款 ›」markPaid 真链路，#pending-payments 深链不动）
 *   → 右报表目录 wlist D1–D9（开口项=18 号档 E4「D1-D9 报表口径/导出 🆕立项」
 *     → 全量置灰「立项待供给」R10 不画假件）+ 月结快照/三本账永不混列注。
 *
 * 数据源（全部现成接口，零新增）：store.financeStats（期间档 + 月档）/
 * appointment.listForStore / refund.dayStats / refund.list（月区间）。
 * U3 退役件口径不变（TrendChart 等已 git rm）；旧「已收/待收/扣次」三卡随四格
 * 冻结布局收起（待收进台账状态列+sub，扣次口径见日结页）。
 *
 * SSE（store 频道）：appointment.paid → toast + invalidate；completed/reviewed/
 * cancelled → invalidate；refund.executed/settled/rejected → 退款汇总行+月格联动刷新；
 * 断线重连全量对齐；60s 轮询兜底（沿用 T4.4 接线）。
 */

import { EventType, Skeleton, usePhiliaClient, useToast, type EventEnvelope } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MainScaffold, { QuietButton } from '@/components/MainScaffold';
import { REFUND_DAY_STATS_KEY, storeTodayStr } from '@/components/cashier/refund';
import { useMerchantEvents } from '@/components/finance/useMerchantEvents';
import { WList } from '@/components/skeleton';
import {
  chipRange,
  formatDateTime,
  formatTime,
  formatYuan,
  type ChipMode,
} from '@/components/finance/utils';
import { fc } from '@/copy/finance';
import { rpt } from '@/copy/report';

const FINANCE_QUERY_ROOT = ['store', 'financeStats'] as const;

const MODE_LABEL: Record<ChipMode, string> = { day: '今天', '7d': '近 7 天', month: '本月' };
const PAYMENT_MODE_LABEL: Record<string, string> = { pay_at_store: '到店付', pass_deduct: '次卡扣次' };
/** M1-补2 R5/R6-1：收银流水方式五分列标签（组合支付全显；储值单列不计已收） */
const CASHIER_METHOD_LABEL: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  pass: '次卡扣次',
  stored_value: '储值',
};

/** 流水行（已收 + 待收 + 收银台并入合并视图）；sortKey 已收=paidAt/settledAt，待收=completedAt??scheduledStart */
interface LedgerRow {
  id: string;
  pending: boolean;
  sortKey: number;
  time: Date | null;
  item: string;
  customer: string;
  modeLabel: string;
  fen: number;
  /** 批次 M1：来源签（'cashier'=收银台 settled 单；预约行不标） */
  source?: 'cashier';
  /** 单号（W-13 台账列）：收银台=billNo；预约行=预约 code（无则 —） */
  code: string | null;
}

/** 报表目录 D1–D9（开口项：18 号档 E4 立项待供给，全量置灰不画假件） */
const REPORT_DIR_ITEMS = [
  { key: 'd1', title: rpt('rpt.dirD1') },
  { key: 'd2', title: rpt('rpt.dirD2') },
  { key: 'd3', title: rpt('rpt.dirD3') },
  { key: 'd4', title: rpt('rpt.dirD4') },
  { key: 'd5', title: rpt('rpt.dirD5') },
  { key: 'd6', title: rpt('rpt.dirD6') },
  { key: 'd7', title: rpt('rpt.dirD7') },
  { key: 'd8', title: rpt('rpt.dirD8') },
  { key: 'd9', title: rpt('rpt.dirD9') },
].map((d) => ({ ...d, sub: rpt('rpt.dirPending') }));

export default function FinancePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast({ durationMs: 2500 });
  const [mode, setMode] = useState<ChipMode>('day');
  /** 切档即回当前（今天/含今天的近 7 天/本月），不再支持历史翻页 */
  const [anchor, setAnchor] = useState(() => new Date());

  const { from, to } = useMemo(() => chipRange(mode, anchor), [mode, anchor]);

  const statsQuery = useQuery({
    queryKey: [...FINANCE_QUERY_ROOT, mode, from.getTime(), to.getTime()],
    queryFn: () => trpc.store.financeStats.query({ from, to }),
    refetchInterval: 60_000, // SSE 断线兜底轮询
  });

  // 已收流水明细：区间内预约（scheduledStart 口径）过滤 paidAt 非空
  const ledgerQuery = useQuery({
    queryKey: ['appointment', 'listForStore', mode, from.getTime(), to.getTime()],
    queryFn: () => trpc.appointment.listForStore.query({ from, to }),
    refetchInterval: 60_000,
  });

  // R12：当日退款汇总（refund.dayStats · 当日净额=已收−退款；最小侵入一行，不自建大块）
  const refundDayQ = useQuery({
    queryKey: [...REFUND_DAY_STATS_KEY, storeTodayStr()],
    queryFn: () => trpc.refund.dayStats.query({ date: storeTodayStr() }),
    refetchInterval: 60_000,
  });

  /* ---- W-13 M3 四格数据源（月口径恒取本月，不随期间档漂移） ---- */
  const monthRange = useMemo(() => chipRange('month', new Date()), []);
  // 本月营收：financeStats 月档（key 与「本月」chip 同形，切档即共享缓存）
  const monthStatsQ = useQuery({
    queryKey: [...FINANCE_QUERY_ROOT, 'month', monthRange.from.getTime(), monthRange.to.getTime()],
    queryFn: () => trpc.store.financeStats.query({ from: monthRange.from, to: monthRange.to }),
    refetchInterval: 60_000,
  });
  // 本月退款：refund.list 月区间真值（与退款单列表页同源；已执行+已实退口径同日结单列）
  const monthStr = storeTodayStr().slice(0, 7);
  const refundMonthQ = useQuery({
    queryKey: ['refund', 'list', 'month', monthStr],
    queryFn: () => trpc.refund.list.query({ from: `${monthStr}-01`, to: storeTodayStr() }),
    refetchInterval: 60_000,
  });
  const monthRefund = useMemo(() => {
    const rows = (refundMonthQ.data ?? []).filter((r) => r.status === 'executed' || r.status === 'settled');
    return { count: rows.length, fen: rows.reduce((s, r) => s + r.amountFen, 0) };
  }, [refundMonthQ.data]);

  const invalidateFinance = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_ROOT });
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'listForStore'] });
    void queryClient.invalidateQueries({ queryKey: ['pass', 'listLogs'] });
    void queryClient.invalidateQueries({ queryKey: REFUND_DAY_STATS_KEY });
    void queryClient.invalidateQueries({ queryKey: ['refund', 'list'] });
  }, [queryClient]);

  // 事件去重（续传补发 / 多端同事件会重复到达）
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] });
  const markSeen = useCallback((id: string): boolean => {
    const s = seenRef.current;
    if (s.set.has(id)) return false;
    s.set.add(id);
    s.queue.push(id);
    if (s.queue.length > 500) {
      const oldest = s.queue.shift();
      if (oldest) s.set.delete(oldest);
    }
    return true;
  }, []);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      if (!markSeen(envelope.id)) return;
      switch (envelope.type) {
        case EventType.AppointmentPaid:
          showToast('有一笔收款到账');
          invalidateFinance();
          break;
        // 批次 M1：收银台结账 → 财务三卡/流水并入刷新（billHeld/Voided 不触及
        // 财务口径——open/held 不进 financeStats，settled 不可撤，故不订阅）
        case EventType.CashierBillSettled:
          showToast('收银台有一笔收款到账');
          invalidateFinance();
          break;
        // M1-补2 D：反结账冲正影响已收口径（原单不再计入；冲正单不计）→ 全量对齐
        case EventType.CashierBillReversed:
          showToast('收银台有一笔反结账冲正');
          invalidateFinance();
          break;
        // R12：退款落账/实退 → 当日净额=已收−退款口径联动（退款单列刷新）
        case EventType.RefundExecuted:
          showToast('有一笔退款落账（退款单列）');
          invalidateFinance();
          break;
        case EventType.RefundSettled:
        case EventType.RefundRejected:
          invalidateFinance();
          break;
        case EventType.AppointmentCompleted:
        case EventType.AppointmentReviewed:
        case EventType.AppointmentCancelled:
          invalidateFinance();
          break;
        default:
          break;
      }
    },
    [invalidateFinance, markSeen, showToast],
  );

  useMerchantEvents({ onEvent, onReconnect: invalidateFinance });

  const data = statsQuery.data;

  /* ---------------- 已收/待收合并流水 ---------------- */
  const ledgerRows = useMemo<LedgerRow[]>(() => {
    const paid = (ledgerQuery.data ?? [])
      .filter((r) => r.paidAt !== null)
      .map(
        (r): LedgerRow => ({
          id: r.id,
          pending: false,
          sortKey: r.paidAt!.getTime(),
          time: r.paidAt,
          item: `${r.petName} · ${r.serviceName}`,
          customer: r.customerName ?? '—',
          modeLabel: PAYMENT_MODE_LABEL[r.paymentMode ?? ''] ?? '到店付',
          fen: r.paidFen ?? r.priceFen,
          code: r.code ?? null,
        }),
      );
    const customerById = new Map((ledgerQuery.data ?? []).map((r) => [r.id, r.customerName] as const));
    const codeById = new Map((ledgerQuery.data ?? []).map((r) => [r.id, r.code ?? null] as const));
    const pending = (data?.pendingPayments ?? []).map(
      (p): LedgerRow => ({
        id: p.id,
        pending: true,
        sortKey: (p.completedAt ?? p.scheduledStart).getTime(),
        time: null, // 待收单未收款，时间列显「—」（试样口径）
        item: `${p.petName} · ${p.serviceName}`,
        customer: customerById.get(p.id) ?? '—',
        modeLabel: PAYMENT_MODE_LABEL[p.paymentMode ?? ''] ?? '到店付',
        fen: p.priceFen,
        code: codeById.get(p.id) ?? null,
      }),
    );
    // 批次 M1（任务书 §1.5.5，零结构改动）：收银台 settled 单并入流水表，来源签「收银台」。
    // 金额取 payableFen（应收=实收，M1-补1 起 settled 即全额已收）；预约行金额不进
    // cashierLedger（随预约翻转口径认领，禁止双头记账——server loadCashierFinance 头注）。
    const cashier = (data?.cashierLedger ?? []).map(
      (c): LedgerRow => ({
        id: c.billNo,
        pending: false,
        sortKey: c.time?.getTime() ?? 0,
        time: c.time,
        item: c.summary,
        customer: c.buyer,
        modeLabel:
          c.methods.map((m) => CASHIER_METHOD_LABEL[m] ?? m).join('、') ||
          '—',
        fen: c.payableFen,
        source: 'cashier',
        code: c.billNo,
      }),
    );
    return [...paid, ...pending, ...cashier].sort((a, b) => b.sortKey - a.sortKey);
  }, [ledgerQuery.data, data]);

  /** 顶行「今日已收」（M1-补2 R1）：恒为今日同源口径（todayTender.receivedTotalFen），
      不随期间档漂移；与收银台头部/经营总览三处同数。 */
  const todayReceivedFen = data ? data.todayTender.receivedTotalFen : null;

  /* ---------------- 待收行「收款 ›」（markPaid 真链路，原 PendingPayments 并入） ---------------- */
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const markPaid = useMutation({
    mutationFn: (appointmentId: string) => trpc.appointment.markPaid.mutate({ appointmentId }),
    onSuccess: (_r, appointmentId) => {
      setSettlingId(null);
      const row = ledgerRows.find((i) => i.id === appointmentId);
      showToast(row ? `已确认收款 ¥${formatYuan(row.fen)}` : '已确认收款');
      invalidateFinance();
    },
    onError: (err) => {
      setSettlingId(null);
      showToast(err instanceof TRPCClientError ? err.message : '收款失败，请重试');
    },
  });

  // v1.1-b1：/finance#pending-payments 深链——数据就绪后滚动到流水面板
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== '#pending-payments' || !data) return;
    const id = window.setTimeout(() => {
      document.getElementById('pending-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(id);
  }, [hash, data]);

  return (
    <MainScaffold
      title={fc('fin.title')}
      sub={fc('fin.sub', {
        received: todayReceivedFen !== null ? formatYuan(todayReceivedFen) : '…',
        pending: data ? formatYuan(data.totals.pendingPaymentFen) : '…',
      })}
      actions={
        <div className="flex gap-2">
          {(Object.keys(MODE_LABEL) as ChipMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`u3-chipf ${mode === m ? 'on' : ''}`}
              onClick={() => {
                setMode(m);
                setAnchor(new Date());
              }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      }
      testid="finance-page"
    >
      {statsQuery.isPending ? (
        // 加载中骨架块（animate-pulse，禁转圈）：四格 + 面板 = shared Skeleton 组合
        <div aria-label="加载中">
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="u3-stat">
                <Skeleton className="h-3 w-16 rounded-chip" />
                <Skeleton className="mt-3 h-7 w-24 rounded-chip" />
                <Skeleton className="mt-2.5 h-3 w-32 rounded-chip" />
              </div>
            ))}
          </div>
          <div className="u3-panel mt-3.5">
            <div className="u3-panel-head">
              <Skeleton className="h-4 w-20 rounded-chip" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3.5">
                <Skeleton className="h-3 w-full rounded-chip" />
              </div>
            ))}
          </div>
        </div>
      ) : statsQuery.isError ? (
        <div className="u3-panel px-[17px] py-12 text-center">
          <p className="text-body-sm text-[rgba(59,46,36,.62)]">财务数据加载失败，请检查网络后重试</p>
          <div className="mt-4">
            <QuietButton onClick={() => void statsQuery.refetch()}>重新加载</QuietButton>
          </div>
        </div>
      ) : data ? (
        <>
          {/* M3 四格（W-13：本月营收真值 / 储值负债·回馈金负债置灰读口待补 / 本月退款红真值） */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="u3-stat">
              <div className="cap">{rpt('rpt.quadRevenue')}</div>
              <div className="v" data-testid="finance-received-card">
                ¥{monthStatsQ.data ? formatYuan(monthStatsQ.data.totals.totalFen) : '…'}
              </div>
              <div className="d u1-num" data-testid="finance-received-count">
                {monthStatsQ.data
                  ? `收银 ${monthStatsQ.data.totals.cashierPaidCount} 单 · 预约收款 ${monthStatsQ.data.totals.paidCount} 笔`
                  : ''}
              </div>
            </div>
            <div className="u3-stat opacity-60" data-testid="finance-quad-stored" aria-disabled="true">
              <div className="cap">{rpt('rpt.quadStored')}</div>
              <div className="v text-[rgba(59,46,36,.42)]">—</div>
              <div className="d">{rpt('rpt.quadPending')} · {rpt('rpt.quadStoredNote')}</div>
            </div>
            <div className="u3-stat opacity-60" data-testid="finance-quad-rebate" aria-disabled="true">
              <div className="cap">{rpt('rpt.quadRebate')}</div>
              <div className="v text-[rgba(59,46,36,.42)]">—</div>
              <div className="d">{rpt('rpt.quadPending')} · {rpt('rpt.quadRebateNote')}</div>
            </div>
            <div className="u3-stat" data-testid="finance-quad-refund">
              <div className="cap">{rpt('rpt.quadRefund')}</div>
              <div className={`v ${monthRefund.fen > 0 ? 'text-danger-deep' : ''}`}>
                {refundMonthQ.data ? (monthRefund.fen > 0 ? `−¥${formatYuan(monthRefund.fen)}` : '¥0') : '…'}
              </div>
              <div className="d u1-num">{rpt('rpt.quadRefundCount', { n: monthRefund.count })}</div>
            </div>
          </div>

          {/* 期间档 chips 只驱动下方台账区间（四格恒取本月口径，不随档漂移） */}

          {/* R12：当日退款汇总一行（同口径退款列：当日净额=已收−退款；最小侵入不自建大块）。
              退款笔数/金额=refund.dayStats（biz_date=执行日，executed|settled 口径）；
              已收=todayTender.receivedTotalFen（R1 同源出口），前端做差。 */}
          {refundDayQ.data ? (
            <div
              className="u3-panel mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-[17px] py-3 text-caption"
              data-testid="finance-refund-strip"
            >
              <span className="font-semibold">{fc('fin.refundStripTitle')}</span>
              <span className="u1-num">
                {refundDayQ.data.count} 笔 ·{' '}
                <b className={refundDayQ.data.totalFen > 0 ? 'text-danger-deep' : ''}>
                  {refundDayQ.data.totalFen > 0 ? `−¥${formatYuan(refundDayQ.data.totalFen)}` : '¥0'}
                </b>
              </span>
              <span className="text-[rgba(59,46,36,.42)]">｜</span>
              <span className="text-[rgba(59,46,36,.62)]">
                {fc('fin.refundNetLead')}
                <b className="u1-num text-ink">
                  ¥{todayReceivedFen !== null ? formatYuan(todayReceivedFen) : '…'} − ¥
                  {formatYuan(refundDayQ.data.totalFen)} = ¥
                  {todayReceivedFen !== null
                    ? formatYuan(Math.max(0, todayReceivedFen - refundDayQ.data.totalFen))
                    : '…'}
                </b>
              </span>
              <span className="text-caption-xs text-[rgba(59,46,36,.42)]">
                {fc('fin.refundStripNote', { amt: formatYuan(refundDayQ.data.segments.cashFen) })}
              </span>
            </div>
          ) : null}

          {/* 左 M5 月度台账 ｜ 右报表目录（W-13 双列） */}
          <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-[1.7fr_1fr]">
            {/* 月度台账（现状流水重排：日期/类型/金额/支付方式/单号 + 状态/操作） */}
            <div id="pending-payments" className="u3-panel scroll-mt-4">
              <div className="u3-panel-head">
                <h3>{rpt('rpt.ledgerTitle')}</h3>
                <span className="aside">{rpt('rpt.ledgerAside')}</span>
              </div>
              {ledgerRows.length === 0 ? (
                <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center text-body-sm text-[rgba(59,46,36,.62)]">
                  {fc('fin.ledgerEmpty', { period: MODE_LABEL[mode] })}
                </div>
              ) : (
                <table className="u3-tbl">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>类型</th>
                      <th className="text-right">金额</th>
                      <th>支付方式</th>
                      <th>单号</th>
                      <th>状态</th>
                      <th aria-label="操作" />
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((r) => (
                      <tr key={`${r.pending ? 'p' : 'r'}-${r.id}`}>
                        <td className="u1-num font-bold">
                          {r.time ? (mode === 'day' ? formatTime(r.time) : formatDateTime(r.time)) : '—'}
                        </td>
                        <td className="font-semibold">
                          {/* 批次 M1：来源签「收银台」（最小渲染分支，其余结构不动） */}
                          {r.source === 'cashier' ? (
                            <span className="u3-st wait mr-1.5">收银台</span>
                          ) : null}
                          {r.item}
                        </td>
                        <td className="u1-num whitespace-nowrap text-right font-bold">¥{formatYuan(r.fen)}</td>
                        <td className="text-[rgba(59,46,36,.62)]">{r.modeLabel}</td>
                        <td className="u1-num text-[rgba(59,46,36,.62)]">{r.code ?? '—'}</td>
                        <td>
                          {r.pending ? (
                            <span className="u3-st amber">待收</span>
                          ) : (
                            <span className="u3-st live">已收</span>
                          )}
                        </td>
                        <td>
                          {r.pending ? (
                            <button
                              type="button"
                              disabled={settlingId === r.id}
                              onClick={() => {
                                setSettlingId(r.id);
                                markPaid.mutate(r.id);
                              }}
                              className="text-caption-xs font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.92] disabled:opacity-50"
                            >
                              {settlingId === r.id ? '收款中…' : '收款 ›'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 报表目录 wlist D1–D9（开口项全量置灰「立项待供给」）+ 口径注 */}
            <div className="wsk">
              <div className="wsk-hd">
                <span className="t">{rpt('rpt.dirTitle')}</span>
                <span className="a">{rpt('rpt.dirPending')}</span>
              </div>
              <div className="pointer-events-none opacity-60" aria-disabled="true">
                <WList items={REPORT_DIR_ITEMS} testId="report-dir" />
              </div>
              <p className="wsk-note mt-2.5 px-1">{rpt('rpt.dirNote')}</p>
              <p className="wsk-note mt-1 px-1">
                {rpt('rpt.monthCloseNote')} · {rpt('rpt.threeBooksNote')}
              </p>
            </div>
          </div>
        </>
      ) : null}

      {toastEl}
    </MainScaffold>
  );
}
