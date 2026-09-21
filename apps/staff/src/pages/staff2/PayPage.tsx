/**
 * 薪资提成 /pay（批次 员工端2.0 · R9 · docs/staff2/R7-R10-DESIGN.md §一.4/§一.5）
 *
 * 仅本人页：server commission.mySummary 已硬过滤（employeeId=ctx.user，越权传参 FORBIDDEN），
 * 前端无任何选人控件。单查询渲染（<2s 约束）：整页只调一次 mySummary；
 * 历史快照展开时才懒查对应月份（同一端点带 month）。
 *
 * 区块：口径小字 → 本月提成三分列（服务/售卡/商品，售卡恒空明示不悬空）→
 * 绩效区（当季基数/档位/系数/预估绩效，仅本人适用池）→ 扣减记录（扣绩效不扣提成）→
 * 历史月份快照（点展开该月 payload 分列）。
 *
 * 金额：库内 integer 分，显示一律 fenToYuan；比例 bp → %；系数 bp → 倍。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Wallet } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { fenToYuan } from '@/components/today/utils';

/* ---------------- 与 server computeMonth 载荷同构的本地类型 ---------------- */

interface CommissionLine {
  billId: string;
  billNo: string;
  itemId: string;
  refId: string;
  name: string;
  date: string; // YYYY-MM-DD（账单 settled_at 本地日期）
  baseFen: number;
  rateBp: number;
  multiplierBp: number;
  amountFen: number;
  overwork: boolean;
  pendingApproval: boolean;
}

interface StoreLine {
  kind: string;
  label: string;
  baseFen: number;
  rateBp: number;
  amountFen: number;
}

interface PerfPool {
  baseFen: number;
  rateBp: number;
  amountFen: number;
}

interface PerformanceBlock {
  quarter: string;
  applicable: boolean;
  note?: string;
  grade: string; // S|A|B|C|D 或 '未评级'
  coeffBp: number | null;
  groomerPool: PerfPool;
  frontdeskPool: PerfPool;
  payableFen: number;
}

interface DeductionRow {
  id: string;
  amountFen: number;
  reason: string;
  createdBy: string;
  createdAt: string | Date; // live=Date（superjson），快照 payload 内=string
}

interface MonthPayload {
  month: string;
  role: string;
  grade: string | null;
  probation: boolean;
  serviceLines: CommissionLine[];
  productLines: CommissionLine[];
  cardLines: never[];
  cardNote: string;
  storeLines: StoreLine[];
  commissionTotalFen: number;
  performance: PerformanceBlock;
  deductions: DeductionRow[];
}

/* ---------------- 格式化小函数 ---------------- */

/** bp → 百分比（500→5%，1250→12.5%） */
const bpToPct = (bp: number): string => `${(bp / 100).toFixed(1).replace(/\.0$/, '')}%`;

/** 系数 bp → 倍（12000→1.2，10000→1） */
const bpToCoeff = (bp: number): string =>
  (bp / 10000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

/** Date | string → 'MM-DD HH:mm' */
function fmtTs(t: string | Date): string {
  const d = typeof t === 'string' ? new Date(t) : t;
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 本人适用绩效池（同 server：groomer/G 档→操作池，其余→接待池） */
function pickPool(p: MonthPayload): { label: string; pool: PerfPool } {
  const isGroomer = p.role === 'groomer' || (p.grade ?? '').startsWith('G');
  return isGroomer
    ? { label: '美容师绩效池（本人操作洗美营收·门市价）', pool: p.performance.groomerPool }
    : { label: '前台绩效池（本人接待归属洗美营收·门市价）', pool: p.performance.frontdeskPool };
}

/* ---------------- 提成单列 ---------------- */

function LineRow({ line, probation }: { line: CommissionLine; probation: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-bold text-ink">{line.name}</p>
        <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.62)]">
          <span className="u1-num">{line.date.slice(5)}</span> · 单号 <span className="u1-num">{line.billNo}</span>
          {line.pendingApproval ? (
            <span className="ml-1 rounded-chip bg-brand-primary-light px-1 py-0.5 text-ink">超产能·待店长批准</span>
          ) : line.overwork ? (
            <span className="ml-1 rounded-chip bg-brand-secondary-light px-1 py-0.5 text-ink">超产能·1.5 倍已批准</span>
          ) : null}
          {probation && line.multiplierBp !== 10000 ? (
            <span className="ml-1 rounded-chip bg-sunken px-1 py-0.5 text-[rgba(74,59,46,.62)]">试用期 ×50%</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
          基数 <span className="u1-num">{fenToYuan(line.baseFen)}</span> × {bpToPct(line.rateBp)}
        </p>
      </div>
      <span className="u1-num shrink-0 text-body-sm font-bold text-ink">{fenToYuan(line.amountFen)}</span>
    </li>
  );
}

/** 分列小节（标题+逐行+小节合计；空态文案可选） */
function Section({
  title,
  lines,
  emptyNote,
  probation,
  testid,
}: {
  title: string;
  lines: CommissionLine[];
  emptyNote?: string;
  probation: boolean;
  testid: string;
}) {
  const total = lines.reduce((s, l) => s + l.amountFen, 0);
  return (
    <section className="u1-card mt-3.5 px-4 py-3.5" data-testid={testid}>
      <header className="flex items-baseline">
        <h2 className="text-body-sm font-bold">{title}</h2>
        <span className="ml-auto text-caption-xs text-[rgba(74,59,46,.42)]">
          小计 <b className="u1-num text-ink">{fenToYuan(total)}</b>
        </span>
      </header>
      {lines.length === 0 ? (
        <p className="py-3 text-caption-xs text-[rgba(74,59,46,.42)]">
          {emptyNote ?? '本月暂无此类计提单'}
        </p>
      ) : (
        <ul className="divide-y divide-[rgba(74,59,46,.06)]">
          {lines.map((l) => (
            <LineRow key={l.itemId} line={l} probation={probation} />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- 历史快照行（点展开懒查该月 payload） ---------------- */

function SnapshotRow({ period, kind, totalFen }: { period: string; kind: string; totalFen: number }) {
  const { trpc } = usePhiliaClient();
  const [open, setOpen] = useState(false);
  const expandable = kind === 'commission' && /^\d{4}-\d{2}$/.test(period);
  const detailQuery = useQuery({
    queryKey: ['commission', 'mySummary', period],
    queryFn: () => trpc.commission.mySummary.query({ month: period }),
    enabled: open && expandable,
    staleTime: 300_000, // 快照冻结月份不变
  });
  const detail = detailQuery.data
    ? (detailQuery.data.payload as unknown as MonthPayload)
    : null;

  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-bold text-ink">
          <span className="u1-num">{period}</span>
          <span className="ml-1.5 text-caption-xs font-normal text-[rgba(74,59,46,.62)]">
            {kind === 'commission' ? '提成月结' : '绩效季结'}
          </span>
        </p>
        <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
          <span className="rounded-chip bg-success-light px-1 py-0.5 text-success-deep">已结算</span>
          {expandable ? '' : ' · 季度绩效快照'}
        </p>
      </div>
      <span className="u1-num shrink-0 text-body-sm font-bold text-ink">{fenToYuan(totalFen)}</span>
      {expandable ? (
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[rgba(74,59,46,.42)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      ) : null}
    </>
  );

  return (
    <li>
      {expandable ? (
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          data-testid={`snapshot-${period}`}
        >
          {inner}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3.5">{inner}</div>
      )}
      {open && expandable ? (
        <div className="px-4 pb-3 text-caption-xs text-[rgba(74,59,46,.62)]">
          {detailQuery.isPending ? (
            <p>快照明细加载中…</p>
          ) : detailQuery.isError || !detail ? (
            <p>明细加载失败，请稍后重试</p>
          ) : (
            <p className="u1-num leading-relaxed">
              服务 {fenToYuan(detail.serviceLines.reduce((s, l) => s + l.amountFen, 0))}
              {' · '}商品 {fenToYuan(detail.productLines.reduce((s, l) => s + l.amountFen, 0))}
              {detail.storeLines.length > 0
                ? ` · 全店 ${fenToYuan(detail.storeLines.reduce((s, l) => s + l.amountFen, 0))}`
                : ''}
              {' · '}提成合计 {fenToYuan(detail.commissionTotalFen)}
              {' · '}绩效应付 {fenToYuan(detail.performance.payableFen)}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

/* ---------------- 页面 ---------------- */

export default function PayPage() {
  const { trpc } = usePhiliaClient();

  // 单查询渲染（<2s 约束）：口径小字/三分列/绩效/扣减/历史快照全在此响应内
  const summaryQuery = useQuery({
    queryKey: ['commission', 'mySummary', 'current'],
    queryFn: () => trpc.commission.mySummary.query({}),
  });

  const data = summaryQuery.data;
  // 快照月份 payload 落库为 JSON（Record），与 live 载荷同构——此处断言回结构
  const payload = data ? (data.payload as unknown as MonthPayload) : null;
  const perf = payload?.performance ?? null;
  const my = payload ? pickPool(payload) : null;

  return (
    <div className="pb-6">
      <PageHeader
        title="薪资提成"
        backTo="/me"
        aside={
          data ? (
            <span>
              <span className="u1-num">{data.month}</span>
              {data.frozen ? ' · 已快照冻结' : ' · 实时计算'}
            </span>
          ) : null
        }
      />

      <div className="px-[22px]">
        {summaryQuery.isPending ? (
          <div className="mt-2 space-y-2.5" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="u1-card p-4">
                <div className="h-5 w-28 animate-pulse rounded-chip bg-sunken" />
                <div className="mt-2 h-4 w-44 animate-pulse rounded-chip bg-sunken" />
              </div>
            ))}
          </div>
        ) : summaryQuery.isError || !data || !payload || !perf || !my ? (
          <div className="u1-card mt-2 p-6 text-center">
            <p className="text-body-sm text-ink-secondary">薪资提成加载失败，请检查网络后重试</p>
            <button
              type="button"
              onClick={() => void summaryQuery.refetch()}
              className="mt-4 h-12 min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              重新加载
            </button>
          </div>
        ) : (
          <>
            {/* 口径小字（server policyNote：计提时点/冲减/次月结算日/每月快照，数值读规则表） */}
            <section className="u1-card mt-2 p-4" data-testid="pay-policy">
              <p className="text-caption-xs leading-relaxed text-[rgba(74,59,46,.42)]">{data.policyNote}</p>
            </section>

            {/* 本月提成合计 */}
            <section className="u1-card mt-3.5 p-4 text-center" data-testid="pay-total">
              <p className="text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">本月提成合计</p>
              <p className="u1-num mt-1 text-detail-lg font-bold text-ink">
                {fenToYuan(payload.commissionTotalFen)}
              </p>
              {payload.probation ? (
                <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">试用期：商品/售卡类提成 ×50%</p>
              ) : null}
            </section>

            {/* 三分列：服务 / 售卡 / 商品 */}
            <Section
              title="服务提成"
              lines={payload.serviceLines}
              emptyNote="本月暂无服务计提单"
              probation={payload.probation}
              testid="pay-service"
            />
            <Section
              title="售卡提成"
              lines={[...payload.cardLines]}
              emptyNote={payload.cardNote /* server 明示：随会员前置批开通（不悬空、不虚构行） */}
              probation={payload.probation}
              testid="pay-card"
            />
            <Section
              title="商品提成"
              lines={payload.productLines}
              emptyNote="本月暂无商品计提单"
              probation={payload.probation}
              testid="pay-product"
            />

            {/* 全店提成（G4/P3 档才出；计入口径随行 label 明示） */}
            {payload.storeLines.length > 0 ? (
              <section className="u1-card mt-3.5 px-4 py-3.5" data-testid="pay-store">
                <h2 className="text-body-sm font-bold">全店提成</h2>
                <ul className="divide-y divide-[rgba(74,59,46,.06)]">
                  {payload.storeLines.map((l) => (
                    <li key={l.kind} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm font-bold text-ink">{l.label}</p>
                        <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                          基数 <span className="u1-num">{fenToYuan(l.baseFen)}</span> × {bpToPct(l.rateBp)}
                        </p>
                      </div>
                      <span className="u1-num shrink-0 text-body-sm font-bold text-ink">{fenToYuan(l.amountFen)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* 绩效区：当季基数/档位/系数/预估绩效，仅本人适用池（两池不并显） */}
            <section className="u1-card mt-3.5 px-4 py-3.5" data-testid="pay-performance">
              <header className="flex items-baseline">
                <h2 className="text-body-sm font-bold">绩效</h2>
                <span className="ml-auto text-caption-xs text-[rgba(74,59,46,.42)]">
                  <span className="u1-num">{perf.quarter}</span> 季度
                </span>
              </header>
              {!perf.applicable ? (
                <p className="py-3 text-caption-xs text-[rgba(74,59,46,.42)]">{perf.note ?? '试用期不设绩效与全勤'}</p>
              ) : (
                <>
                  <p className="mt-2 text-caption-xs text-[rgba(74,59,46,.42)]">{my.label}</p>
                  <div className="mt-2 grid grid-cols-3 rounded-control bg-sunken px-2 py-3 text-center">
                    <div>
                      <div className="u1-num text-title font-bold leading-6">{fenToYuan(my.pool.baseFen)}</div>
                      <div className="mt-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">当季基数</div>
                    </div>
                    <div>
                      <div className="u1-num text-title font-bold leading-6">{perf.grade}</div>
                      <div className="mt-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">档位</div>
                    </div>
                    <div>
                      <div className="u1-num text-title font-bold leading-6">
                        {perf.coeffBp === null ? '—' : `×${bpToCoeff(perf.coeffBp)}`}
                      </div>
                      <div className="mt-1 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">系数</div>
                    </div>
                  </div>
                  <p className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
                      预估绩效（基数 × {bpToPct(my.pool.rateBp)} × 系数，季度发放）
                    </span>
                    <span className="u1-num text-body-sm font-bold text-ink">{fenToYuan(perf.payableFen)}</span>
                  </p>
                  {perf.coeffBp === null ? (
                    <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">本季尚未评级，评级后核算应付绩效</p>
                  ) : null}
                </>
              )}
            </section>

            {/* 扣减记录（只扣绩效不扣提成） */}
            <section className="u1-card mt-3.5 px-4 py-3.5" data-testid="pay-deductions">
              <h2 className="text-body-sm font-bold">扣减记录</h2>
              {payload.deductions.length === 0 ? (
                <p className="py-3 text-caption-xs text-[rgba(74,59,46,.42)]">本月无扣减</p>
              ) : (
                <ul className="divide-y divide-[rgba(74,59,46,.06)]">
                  {payload.deductions.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm font-bold text-ink">{d.reason}</p>
                        <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                          <span className="u1-num">{fmtTs(d.createdAt)}</span> · 录入人 <span className="u1-num">{d.createdBy.slice(-6)}</span>
                        </p>
                      </div>
                      <span className="u1-num shrink-0 text-body-sm font-bold text-danger">−{fenToYuan(d.amountFen)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="pt-1 text-caption-xs text-[rgba(74,59,46,.42)]">扣减只扣绩效，不扣提成</p>
            </section>

            {/* 历史月份快照（新→旧；提成月结点展开分列明细） */}
            <section className="u1-card mt-3.5 divide-y divide-[rgba(74,59,46,.06)]" data-testid="pay-history">
              <h2 className="px-4 pt-3.5 text-body-sm font-bold">历史月份</h2>
              {data.snapshots.length === 0 ? (
                <p className="px-4 py-3 text-caption-xs text-[rgba(74,59,46,.42)]">
                  暂无历史快照——每月结算后自动生成
                </p>
              ) : (
                <ul className="divide-y divide-[rgba(74,59,46,.06)]">
                  {data.snapshots.map((s) => (
                    <SnapshotRow key={`${s.period}-${s.kind}`} period={s.period} kind={s.kind} totalFen={s.totalFen} />
                  ))}
                </ul>
              )}
              <p className="px-4 pb-3.5 pt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                已快照月份按冻结口径展示，冲减差额进当月调整项
              </p>
            </section>

            <p className="mb-6 mt-4 flex items-center justify-center gap-1 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
              <Wallet className="h-3.5 w-3.5" aria-hidden /> 仅本人可见 · 规则版本 <span className="u1-num">v{data.ruleVersion}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
