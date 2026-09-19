/**
 * 财务 /finance（U3 批次 · 任务 L · 规格书 §11 · 母本试样 659-705 行）
 *
 * 数据源（全部现成接口，零新增）：
 * - store.financeStats({from,to})：totals（serviceFen/paidCount/pendingPaymentFen/
 *   pendingPaymentCount）+ pendingPayments 明细 + byDay（仅用于顶行「今日已收」取数）；
 * - appointment.listForStore({from,to}) 过滤 paidAt 非空 → 已收流水明细
 *   （行含 customerName/petName/serviceName/paidAt/paidFen/paymentMode）；
 * - pass.listLogs({})：次卡扣次卡计数（delta<0 且 createdAt 落在区间内；接口上限 100 条）。
 *
 * 结构：MainScaffold（title 财务 / sub 今日已收·待收·口径 / actions=期间 chips 三档
 * 今天/近 7 天/本月，当前墨底）→ u3-stat 数据卡 3 张 → u3-panel+u3-tbl 收款流水
 * （按时间倒序，已收 live / 待收 amber，待收行末「收款 ›」→ appointment.markPaid 真链路）。
 *
 * U3 取舍（红线执行）：趋势图/环比同比无日序列接口口径=花架子——TrendChart 删除
 * （git rm）；PaymentSplit/StaffTable/SummaryCards/PeriodSwitcher/EmptyState/
 * PendingPayments 一并退役出页面（git rm，待收款「确认收款」并入流水表）。
 *
 * SSE（store 频道）：appointment.paid → toast + invalidate；completed/reviewed/
 * cancelled → invalidate；断线重连全量对齐；60s 轮询兜底（沿用 T4.4 接线）。
 * v1.1-b1：/finance#pending-payments 深链 → 滚动到流水表（待收行所在面板）。
 */

import { EventType, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MainScaffold, { QuietButton } from '@/components/MainScaffold';
import Toast, { useToast } from '@/components/finance/Toast';
import { useMerchantEvents } from '@/components/finance/useMerchantEvents';
import {
  chipRange,
  formatDateTime,
  formatTime,
  formatYuan,
  type ChipMode,
} from '@/components/finance/utils';

const FINANCE_QUERY_ROOT = ['store', 'financeStats'] as const;

const MODE_LABEL: Record<ChipMode, string> = { day: '今天', '7d': '近 7 天', month: '本月' };
/** 数据卡 1 标题随期间档走 */
const CAP_RECEIVED: Record<ChipMode, string> = {
  day: '今日已收',
  '7d': '近 7 天已收',
  month: '本月已收',
};
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
}

export default function FinancePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();
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

  // 次卡扣次计数（接口上限 100 条，按区间过滤 delta<0）
  const logsQuery = useQuery({
    queryKey: ['pass', 'listLogs', 'finance'],
    queryFn: () => trpc.pass.listLogs.query({}),
    refetchInterval: 60_000,
  });

  const invalidateFinance = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_ROOT });
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'listForStore'] });
    void queryClient.invalidateQueries({ queryKey: ['pass', 'listLogs'] });
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
        }),
      );
    const customerById = new Map((ledgerQuery.data ?? []).map((r) => [r.id, r.customerName] as const));
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
      }),
    );
    return [...paid, ...pending, ...cashier].sort((a, b) => b.sortKey - a.sortKey);
  }, [ledgerQuery.data, data]);

  /**
   * 卡 1（M1-补2 R1③ 同源改造，消除「洗护 0 笔」矛盾）：
   * - 今日档：金额=todayTender.receivedTotalFen（统一聚合出口，与收银台头部/总览同值）；
   *   副行笔数=todayTender.counts 合并流水行数（收银 settled 单 + 预约域收款笔数）；
   * - 7 天/本月档：金额=totals.totalFen（服务+商品，与下方合并流水列表同帧）；
   *   副行笔数=收银单数（cashierPaidCount）+预约收款笔数（totals.paidCount）。
   * 旧副行「洗护 N 笔 · 寄养 N 笔」（预约域口径，与合并流水列表矛盾）随本改造删除。
   */
  const receivedCard = useMemo(() => {
    if (!data) return null;
    if (mode === 'day') {
      const t = data.todayTender;
      return {
        fen: t.receivedTotalFen,
        caption: `共 ${t.counts.paidCount} 笔（收银 ${t.counts.cashierPaidCount} 单 · 预约收款 ${t.counts.appointmentPaidCount} 笔）`,
      };
    }
    return {
      fen: data.totals.totalFen,
      caption: `收银 ${data.totals.cashierPaidCount} 单 · 预约收款 ${data.totals.paidCount} 笔`,
    };
  }, [data, mode]);

  /** 卡 3：区间内次卡扣次次数 */
  const deductCount = useMemo(
    () =>
      (logsQuery.data ?? []).filter(
        (l) => l.delta < 0 && l.createdAt.getTime() >= from.getTime() && l.createdAt.getTime() < to.getTime(),
      ).length,
    [logsQuery.data, from, to],
  );

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

  const pendingBrief =
    (data?.pendingPayments ?? [])
      .slice(0, 2)
      .map((p) => `${p.petName}·${p.serviceName} ¥${formatYuan(p.priceFen)}`)
      .join(' · ') || '无待收单';

  return (
    <MainScaffold
      title="财务"
      sub={`今日已收 ¥${todayReceivedFen !== null ? formatYuan(todayReceivedFen) : '…'} · 待收 ¥${
        data ? formatYuan(data.totals.pendingPaymentFen) : '…'
      } · 口径=收款登记（到店付）`}
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
        // 骨架（禁转圈）：3 卡 + 面板
        <div aria-label="加载中">
          <div className="grid grid-cols-3 gap-3.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="u3-stat animate-pulse">
                <div className="h-3 w-16 rounded-chip bg-[rgba(74,59,46,.08)]" />
                <div className="mt-3 h-7 w-24 rounded-chip bg-[rgba(74,59,46,.08)]" />
                <div className="mt-2.5 h-3 w-32 rounded-chip bg-[rgba(74,59,46,.06)]" />
              </div>
            ))}
          </div>
          <div className="u3-panel mt-3.5 animate-pulse">
            <div className="u3-panel-head">
              <div className="h-4 w-20 rounded-chip bg-[rgba(74,59,46,.08)]" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-3.5">
                <div className="h-3 w-full rounded-chip bg-[rgba(74,59,46,.06)]" />
              </div>
            ))}
          </div>
        </div>
      ) : statsQuery.isError ? (
        <div className="u3-panel px-[17px] py-12 text-center">
          <p className="text-body-sm text-[rgba(74,59,46,.62)]">财务数据加载失败，请检查网络后重试</p>
          <div className="mt-4">
            <QuietButton onClick={() => void statsQuery.refetch()}>重新加载</QuietButton>
          </div>
        </div>
      ) : data ? (
        <>
          {/* 数据卡 3 张（u3-stat） */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="u3-stat">
              <div className="cap">{CAP_RECEIVED[mode]}</div>
              <div className="v" data-testid="finance-received-card">
                ¥{receivedCard ? formatYuan(receivedCard.fen) : '…'}
              </div>
              <div className="d" data-testid="finance-received-count">
                {receivedCard?.caption ?? ''}
              </div>
            </div>
            <div className="u3-stat">
              <div className="cap">待收款</div>
              <div className="v">¥{formatYuan(data.totals.pendingPaymentFen)}</div>
              <div className="d">{pendingBrief}</div>
            </div>
            <div className="u3-stat">
              <div className="cap">次卡扣次（非现金）</div>
              <div className="v u1-num">{deductCount}</div>
              <div className="d">
                {mode === 'day' ? '今日' : '期内'}扣次 <b className="u1-num">{deductCount}</b> 次 · 不计入营业额
              </div>
            </div>
          </div>

          {/* 收款流水（已收 + 待收合并，按时间倒序） */}
          <div id="pending-payments" className="u3-panel mt-3.5 scroll-mt-4">
            <div className="u3-panel-head">
              <h3>收款流水</h3>
              <span className="aside">按时间倒序</span>
            </div>
            {ledgerRows.length === 0 ? (
              <div className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-12 text-center text-body-sm text-[rgba(74,59,46,.62)]">
                {MODE_LABEL[mode]}还没有收款
              </div>
            ) : (
              <table className="u3-tbl">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>项目</th>
                    <th>客户</th>
                    <th>方式</th>
                    <th>金额</th>
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
                      <td>{r.customer}</td>
                      <td className="text-[rgba(74,59,46,.62)]">{r.modeLabel}</td>
                      <td className="u1-num">¥{formatYuan(r.fen)}</td>
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
        </>
      ) : null}

      <Toast message={toast} />
    </MainScaffold>
  );
}
