/**
 * 薪资提成 /pay（批次 员工端2.0 · R9 · docs/staff2/R7-R10-DESIGN.md §一.4/§一.5）
 * 骨架批片 1（S-05）：外框换骨架——SkBackBar（二级页无 dock）→ 大数字卡（mono 34 +
 * trio 分项）→ S7 明细（SkRows/SkRow 分组）→ 口径注（SkNote）。数据流/权限零回退。
 *
 * 薪资/XP 面扩（coder K）：双轨注记（劳动业绩 laborTotalFen/销售业绩 salesTotalFen，
 * 快照月份无此字段=不渲染）· 协作拆分行尾注（splitBp→「协作拆得 xx%」）· 回冲明面
 * （refundClawbackTotalFen+adjustments，负=跨月回冲红/正=补调）· 工资条区
 * （payroll.mySlip：四费列+净额+已发放标记态/未发放置灰；无=空态生成中；发放=标记
 * 留痕不碰真钱）· 扣减行内申诉（active 才显示；reverted 灰态「已返还」）+ 工资条
 * 行申诉（slip_line）+ 我的申诉列表 + 复核时限注记（payroll.appealSlaHours 缺省 24）。
 * 数据口=payrollPort（server payroll/xp 申报口由 coder J 并行施工，签名冻结）。
 *
 * 仅本人页：server commission.mySummary 已硬过滤（employeeId=ctx.user，越权传参 FORBIDDEN），
 * 前端无任何选人控件。单查询渲染（<2s 约束）：整页只调一次 mySummary；
 * 历史快照展开时才懒查对应月份（同一端点带 month）。
 *
 * 金额：库内 integer 分，显示一律 fenToYuan；比例 bp → %；系数 bp → 倍。
 */

import { getApiBase, Skeleton, uploadImage, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fenToYuan } from '@/components/today/utils';
import { PAY_COPY } from '@/copy/pay';
import { pcc } from '@/copy/payroll';
import {
  listAppeals,
  payrollOf,
  readAppealSlaHours,
  type AppealTargetKind,
} from '@/lib/payrollPort';
import { SkBackBar, SkBtnAction, SkNote, SkRows } from '../../components/skeleton';
import '../../styles/skeleton.css';

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
  /** 协作拆分注记（薪资/XP 面扩）：拆分行=按比拆得；splitBp=拆分比例 bp，splitFrom=来源单/协作方（契约预留，本版不透出） */
  splitFrom?: string;
  splitBp?: number;
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
  /** active | reverted（薪资/XP 面扩；缺省按 active 透出，快照向后兼容） */
  status?: string;
}

interface AdjustmentRow {
  label: string;
  amountFen: number;
  sourceMonth: string;
}

interface MonthPayload {
  month: string;
  role: string;
  grade: string | null;
  probation: boolean;
  serviceLines: CommissionLine[];
  productLines: CommissionLine[];
  cardLines: CommissionLine[];
  cardNote: string;
  storeLines: StoreLine[];
  commissionTotalFen: number;
  performance: PerformanceBlock;
  deductions: DeductionRow[];
  /** 双轨业绩（薪资/XP 面扩；快照月份无此字段） */
  laborTotalFen?: number;
  salesTotalFen?: number;
  /** 回冲明面（薪资/XP 面扩） */
  refundClawbackTotalFen?: number;
  adjustments?: AdjustmentRow[];
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
    ? { label: PAY_COPY['pay.pool.groomer'], pool: p.performance.groomerPool }
    : { label: PAY_COPY['pay.pool.frontdesk'], pool: p.performance.frontdeskPool };
}

/* ---------------- 骨架内联样（.sk 作用域 token，一次性件不新造构件） ---------------- */

const cardSt: CSSProperties = {
  margin: '12px 22px 0',
  background: 'var(--card)',
  borderRadius: 18,
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(42, 31, 21, .05)',
};
const monoSm: CSSProperties = { fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--muted)' };
const chipSt: CSSProperties = {
  marginLeft: 4, borderRadius: 999, padding: '1px 6px', fontSize: 9, whiteSpace: 'nowrap',
};

/** S7 分组题（12.5/800 + 右 mono 注） */
function SecTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <p style={{ margin: '16px 22px 0', display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5, fontWeight: 800 }}>
      {children}
      {aside ? <span className="sk-mono" style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 500, color: 'var(--muted)' }}>{aside}</span> : null}
    </p>
  );
}

/** SkRows 内的空态/说明行（muted） */
function EmptyRow({ text }: { text: string }) {
  return (
    <div className="row">
      <span className="lb" style={{ color: 'var(--muted)', fontSize: 11 }}>{text}</span>
    </div>
  );
}

/* ---------------- 提成单列 ---------------- */

function LineRow({ line, probation }: { line: CommissionLine; probation: boolean }) {
  return (
    <div className="row">
      <span className="lb" style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.name}</span>
        <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
          {line.date.slice(5)} · {PAY_COPY['pay.line.billNo']} {line.billNo}
          {line.pendingApproval ? (
            <span style={{ ...chipSt, background: 'var(--gold-pale)', color: 'var(--ink-deep)' }}>{PAY_COPY['pay.line.pending']}</span>
          ) : line.overwork ? (
            <span style={{ ...chipSt, background: 'var(--gold)', color: 'var(--ink-deep)' }}>{PAY_COPY['pay.line.overwork']}</span>
          ) : null}
          {probation && line.multiplierBp !== 10000 ? (
            <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--muted)' }}>{PAY_COPY['pay.line.probation']}</span>
          ) : null}
          {line.splitBp != null ? (
            <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--ink)' }}>
              {pcc('prl.line.splitLead')} {bpToPct(line.splitBp)}
            </span>
          ) : null}
        </span>
        <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
          {PAY_COPY['pay.line.base']} {fenToYuan(line.baseFen)} × {bpToPct(line.rateBp)}
        </span>
      </span>
      <span className="vl">{fenToYuan(line.amountFen)}</span>
    </div>
  );
}

/** 分列小节（题+小计 → SkRows 逐行；空态文案可选） */
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
    <>
      <SecTitle aside={<>{PAY_COPY['pay.sec.subtotal']} {fenToYuan(total)}</>}>{title}</SecTitle>
      <SkRows testId={testid}>
        {lines.length === 0 ? (
          <EmptyRow text={emptyNote ?? PAY_COPY['pay.empty.default']} />
        ) : (
          lines.map((l) => <LineRow key={l.itemId} line={l} probation={probation} />)
        )}
      </SkRows>
    </>
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
      <span className="lb" style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700 }}>
          <span className="sk-mono">{period}</span>
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400, color: 'var(--muted)' }}>
            {kind === 'commission' ? PAY_COPY['pay.history.kind.commission'] : PAY_COPY['pay.history.kind.perf']}
          </span>
        </span>
        <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
          <span style={{ ...chipSt, marginLeft: 0, background: 'var(--paper)', color: 'var(--ink)' }}>{PAY_COPY['pay.history.settled']}</span>
          {expandable ? '' : ` · ${PAY_COPY['pay.history.quarterTag']}`}
        </span>
      </span>
      <span className="vl">{fenToYuan(totalFen)}</span>
      {expandable ? (
        <span
          aria-hidden
          style={{
            width: 26, height: 26, borderRadius: '50%', background: 'var(--paper)', flex: 'none',
            display: 'grid', placeItems: 'center', color: 'var(--ink)',
            transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s',
          }}
        >
          ›
        </span>
      ) : null}
    </>
  );

  const resetBtn: CSSProperties = {
    background: 'none', border: 0, font: 'inherit', color: 'inherit', textAlign: 'left', width: '100%', cursor: 'pointer',
  };

  return (
    <div>
      {expandable ? (
        <button
          type="button"
          className="row"
          style={resetBtn}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={PAY_COPY['pay.history.expand']}
          data-testid={`snapshot-${period}`}
        >
          {inner}
        </button>
      ) : (
        <div className="row">{inner}</div>
      )}
      {open && expandable ? (
        <div className="sk-mono" style={{ padding: '0 0 11px', fontSize: 9.5, color: 'var(--muted)', lineHeight: 1.8 }}>
          {detailQuery.isPending ? (
            PAY_COPY['pay.history.loading']
          ) : detailQuery.isError || !detail ? (
            PAY_COPY['pay.history.fail']
          ) : (
            <>
              {PAY_COPY['pay.snap.service']} {fenToYuan(detail.serviceLines.reduce((s, l) => s + l.amountFen, 0))}
              {' · '}{PAY_COPY['pay.snap.product']} {fenToYuan(detail.productLines.reduce((s, l) => s + l.amountFen, 0))}
              {detail.storeLines.length > 0
                ? ` · ${PAY_COPY['pay.snap.store']} ${fenToYuan(detail.storeLines.reduce((s, l) => s + l.amountFen, 0))}`
                : ''}
              {' · '}{PAY_COPY['pay.snap.commission']} {fenToYuan(detail.commissionTotalFen)}
              {' · '}{PAY_COPY['pay.snap.perf']} {fenToYuan(detail.performance.payableFen)}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- 申诉弹层（reason 必填 + 附图选传 ≤3；弹层三件套之滚动锁） ---------------- */

const MAX_APPEAL_PHOTOS = 3;
const APPEALS_KEY = ['payroll', 'myAppeals'] as const;

function AppealModal({
  month,
  target,
  port,
  showToast,
  onClose,
}: {
  month: string;
  target: { kind: AppealTargetKind; targetId: string };
  port: ReturnType<typeof payrollOf>;
  showToast: (text: string) => void;
  onClose: () => void;
}) {
  const { queryClient } = usePhiliaClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<Array<{ url: string; thumbUrl: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  /* 弹层打开期间锁底层 body 滚动 */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onFiles = async (files: FileList) => {
    const room = MAX_APPEAL_PHOTOS - photos.length;
    if (room <= 0) {
      showToast(pcc('prl.appeal.photoFull', { max: MAX_APPEAL_PHOTOS }));
      return;
    }
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, room)) {
        const up = await uploadImage(getApiBase(), f, 'payroll/appeal');
        setPhotos((prev) => [...prev, { url: up.url, thumbUrl: up.thumbUrl }]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : pcc('prl.appeals.loadFail'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!reason.trim()) {
      showToast(pcc('prl.appeal.reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await port.payroll.raiseAppeal.mutate({
        targetKind: target.kind,
        targetId: target.targetId,
        month,
        reason: reason.trim(),
        ...(photos.length > 0 ? { evidenceUrls: photos.map((p) => p.url) } : {}),
      });
      showToast(pcc('prl.appeal.submitted'));
      void queryClient.invalidateQueries({ queryKey: APPEALS_KEY });
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : pcc('prl.appeals.loadFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center px-6" role="dialog" aria-modal="true" aria-label={pcc('prl.appeal.title')}>
      <button type="button" aria-label={pcc('prl.appeal.cancel')} className="absolute inset-0 bg-[rgba(59,46,36,.4)]" onClick={onClose} />
      <div className="u1-card relative w-full max-w-sm p-4" data-testid="pay-appeal-modal">
        <p className="text-title text-ink">{pcc('prl.appeal.title')}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={pcc('prl.appeal.reasonPh')}
          data-testid="pay-appeal-reason"
          className="u1-ring mt-2 w-full rounded-input bg-card px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder"
        />
        {/* 附图（选传 ≤3，现场拍） */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {photos.map((p) => (
            <span key={p.url} className="relative inline-block h-12 w-16 shrink-0">
              <img src={p.thumbUrl} alt="附图" className="h-full w-full rounded-chip object-cover" />
              <button
                type="button"
                aria-label="删除这张附图"
                onClick={() => setPhotos((prev) => prev.filter((x) => x.url !== p.url))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-[#FAF8F2]"
              >
                ×
              </button>
            </span>
          ))}
          {photos.length < MAX_APPEAL_PHOTOS ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              data-testid="pay-appeal-photo-add"
              className="flex h-12 items-center rounded-chip bg-card px-3 text-caption-xs text-[rgba(59,46,36,.42)] [border:1px_dashed_rgba(59,46,36,.25)] disabled:opacity-50"
            >
              {pcc('prl.appeal.photoCta', { max: MAX_APPEAL_PHOTOS })}
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void onFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 min-h-[44px] flex-1 rounded-control bg-sunken text-body-sm font-semibold text-[rgba(59,46,36,.62)]"
          >
            {pcc('prl.appeal.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || uploading}
            onClick={() => void submit()}
            data-testid="pay-appeal-submit"
            className="h-11 min-h-[44px] flex-1 rounded-control bg-brand-primary text-body-sm font-semibold text-ink disabled:opacity-50"
          >
            {busy ? pcc('prl.appeal.submitting') : pcc('prl.appeal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 页面 ---------------- */

export default function PayPage() {
  const { trpc } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const port = useMemo(() => payrollOf(trpc), [trpc]);

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

  /* ---- 薪资域扩：工资条 / 我的申诉 / 申诉时限（端口读，缺省 24） ---- */
  const slipQuery = useQuery({
    queryKey: ['payroll', 'mySlip', data?.month],
    queryFn: () => port.payroll.mySlip.query({ month: data!.month }),
    enabled: !!data,
  });
  const appealsQuery = useQuery({
    queryKey: APPEALS_KEY,
    queryFn: () => port.payroll.myAppeals.query(),
    enabled: !!data,
  });
  const slaQuery = useQuery({
    queryKey: ['payroll', 'appealSlaHours'],
    queryFn: () => readAppealSlaHours(port),
    staleTime: 300_000,
    enabled: !!data,
  });
  const slip = slipQuery.data?.item ?? null;
  const appeals = useMemo(() => listAppeals(appealsQuery.data), [appealsQuery.data]);
  const slaHours = slaQuery.data ?? 24;

  /* 申诉弹层目标（deduction 行 id / slip_line 行 / adjustment 行 label） */
  const [appealTarget, setAppealTarget] = useState<{ kind: AppealTargetKind; targetId: string } | null>(null);

  const trioCells = payload
    ? [
        { k: PAY_COPY['pay.trio.service'], v: fenToYuan(payload.serviceLines.reduce((s, l) => s + l.amountFen, 0)) },
        { k: PAY_COPY['pay.trio.card'], v: fenToYuan(payload.cardLines.reduce((s, l) => s + l.amountFen, 0)) },
        { k: PAY_COPY['pay.trio.product'], v: fenToYuan(payload.productLines.reduce((s, l) => s + l.amountFen, 0)) },
      ]
    : [];

  return (
    <div className="sk">
      <SkBackBar
        title={PAY_COPY['pay.title']}
        fallback="/me"
        note={data ? `${data.month} · ${data.frozen ? PAY_COPY['pay.aside.frozen'] : PAY_COPY['pay.aside.realtime']}` : undefined}
      />

      {summaryQuery.isPending ? (
        <div style={{ margin: '12px 22px 0', display: 'grid', gap: 10 }} aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <div key={i} style={cardSt}>
              <Skeleton className="h-5 w-28 !rounded-chip" />
              <Skeleton className="mt-2 h-4 w-44 !rounded-chip" />
            </div>
          ))}
        </div>
      ) : summaryQuery.isError || !data || !payload || !perf || !my ? (
        <div style={{ ...cardSt, textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{PAY_COPY['pay.load.fail']}</p>
          <div style={{ marginTop: 12 }}>
            <SkBtnAction onClick={() => void summaryQuery.refetch()} testId="sk-pay-retry">
              {PAY_COPY['pay.retry']}
            </SkBtnAction>
          </div>
        </div>
      ) : (
        <>
          {/* 大数字卡（mono 34 合计 + trio 分项） */}
          <section style={{ ...cardSt, borderRadius: 20, padding: '18px 20px', textAlign: 'center' }} data-testid="pay-total">
            <p className="sk-mono" style={{ fontSize: 9.5, letterSpacing: '.12em', color: 'var(--muted)' }}>
              {PAY_COPY['pay.total.label']}
            </p>
            <p className="sk-mono" style={{ marginTop: 4, fontSize: 34, fontWeight: 700, letterSpacing: '.02em' }}>
              {fenToYuan(payload.commissionTotalFen)}
            </p>
            {payload.probation ? (
              <p style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>{PAY_COPY['pay.probation.note']}</p>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 14, borderTop: '1px solid var(--hairline-soft)', paddingTop: 12 }}>
              {trioCells.map((c, i) => (
                <div key={c.k} style={i > 0 ? { boxShadow: 'inset 1px 0 0 var(--hairline-soft)' } : undefined}>
                  <div className="sk-mono" style={{ fontSize: 13, fontWeight: 700 }}>{c.v}</div>
                  <div style={{ marginTop: 2, fontSize: 10, color: 'var(--muted)' }}>{c.k}</div>
                </div>
              ))}
            </div>
            {/* 双轨注记：劳动业绩/销售业绩（快照月份无字段=不渲染） */}
            {payload.laborTotalFen != null || payload.salesTotalFen != null ? (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--hairline-soft)', paddingTop: 10 }} data-testid="pay-dual-track">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)' }}>{pcc('prl.track.labor')}</span>
                  <span className="sk-mono" style={{ fontWeight: 700 }}>{fenToYuan(payload.laborTotalFen ?? 0)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)' }}>{pcc('prl.track.sales')}</span>
                  <span className="sk-mono" style={{ fontWeight: 700 }}>{fenToYuan(payload.salesTotalFen ?? 0)}</span>
                </div>
                <p style={{ ...monoSm, marginTop: 6 }}>{pcc('prl.track.note')}</p>
              </div>
            ) : null}
          </section>

          {/* S7 明细：服务 / 售卡 / 商品 */}
          <Section
            title={PAY_COPY['pay.sec.service']}
            lines={payload.serviceLines}
            emptyNote={PAY_COPY['pay.empty.service']}
            probation={payload.probation}
            testid="pay-service"
          />
          <Section
            title={PAY_COPY['pay.sec.card']}
            lines={[...payload.cardLines]}
            emptyNote={payload.cardNote /* server 明示：随会员前置批开通（不悬空、不虚构行） */}
            probation={payload.probation}
            testid="pay-card"
          />
          <Section
            title={PAY_COPY['pay.sec.product']}
            lines={payload.productLines}
            emptyNote={PAY_COPY['pay.empty.product']}
            probation={payload.probation}
            testid="pay-product"
          />

          {/* 全店提成（G4/P3 档才出；计入口径随行 label 明示） */}
          {payload.storeLines.length > 0 ? (
            <>
              <SecTitle>{PAY_COPY['pay.sec.store']}</SecTitle>
              <SkRows testId="pay-store">
                {payload.storeLines.map((l) => (
                  <div className="row" key={l.kind}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>{l.label}</span>
                      <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
                        {PAY_COPY['pay.line.base']} {fenToYuan(l.baseFen)} × {bpToPct(l.rateBp)}
                      </span>
                    </span>
                    <span className="vl">{fenToYuan(l.amountFen)}</span>
                  </div>
                ))}
              </SkRows>
            </>
          ) : null}

          {/* 绩效区：当季基数/档位/系数/预估绩效，仅本人适用池（两池不并显） */}
          <SecTitle aside={`${perf.quarter} ${PAY_COPY['pay.perf.quarterTail']}`}>{PAY_COPY['pay.sec.perf']}</SecTitle>
          <SkRows testId="pay-performance">
            {!perf.applicable ? (
              <EmptyRow text={perf.note ?? PAY_COPY['pay.perf.na']} />
            ) : (
              <>
                <div className="row">
                  <span className="lb" style={{ color: 'var(--muted)', fontSize: 11 }}>{my.label}</span>
                </div>
                <div className="row">
                  <span className="lb">{PAY_COPY['pay.perf.base']}</span>
                  <span className="vl">{fenToYuan(my.pool.baseFen)}</span>
                </div>
                <div className="row">
                  <span className="lb">{PAY_COPY['pay.perf.grade']}</span>
                  <span className="vl">{perf.grade}</span>
                </div>
                <div className="row">
                  <span className="lb">{PAY_COPY['pay.perf.coeff']}</span>
                  <span className="vl">{perf.coeffBp === null ? '—' : `×${bpToCoeff(perf.coeffBp)}`}</span>
                </div>
                <div className="row">
                  <span className="lb" style={{ fontSize: 11 }}>
                    {PAY_COPY['pay.perf.estimateLead']} {bpToPct(my.pool.rateBp)} {PAY_COPY['pay.perf.estimateTail']}
                  </span>
                  <span className="vl">{fenToYuan(perf.payableFen)}</span>
                </div>
                {perf.coeffBp === null ? <EmptyRow text={PAY_COPY['pay.perf.noGrade']} /> : null}
              </>
            )}
          </SkRows>

          {/* 扣减记录（只扣绩效不扣提成；active 行行内申诉，reverted 灰态已返还） */}
          <SecTitle>{PAY_COPY['pay.sec.deductions']}</SecTitle>
          <SkRows testId="pay-deductions">
            {payload.deductions.length === 0 ? (
              <EmptyRow text={PAY_COPY['pay.deductions.empty']} />
            ) : (
              payload.deductions.map((d) => {
                const reverted = d.status === 'reverted';
                return (
                  <div className="row" key={d.id} style={reverted ? { opacity: 0.55 } : undefined}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>
                        {d.reason}
                        {reverted ? (
                          <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--muted)' }}>{pcc('prl.deduction.reverted')}</span>
                        ) : null}
                      </span>
                      <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
                        {fmtTs(d.createdAt)} · {PAY_COPY['pay.deductions.creatorLead']} {d.createdBy.slice(-6)}
                      </span>
                    </span>
                    {!reverted ? (
                      <button
                        type="button"
                        onClick={() => setAppealTarget({ kind: 'deduction', targetId: d.id })}
                        data-testid={`pay-appeal-${d.id}`}
                        style={{
                          flex: 'none', marginRight: 8, borderRadius: 999, background: 'var(--paper)',
                          padding: '3px 10px', fontSize: 10, color: 'var(--ink)', border: 0, cursor: 'pointer',
                        }}
                      >
                        {pcc('prl.deduction.appeal')}
                      </button>
                    ) : null}
                    <span className="vl red">−{fenToYuan(d.amountFen)}</span>
                  </div>
                );
              })
            )}
          </SkRows>
          <SkNote>{PAY_COPY['pay.deductions.note']}</SkNote>

          {/* 回冲与调整（refundClawbackTotalFen/adjustments；负=跨月回冲红、正=补调） */}
          {(payload.refundClawbackTotalFen ?? 0) !== 0 || (payload.adjustments?.length ?? 0) > 0 ? (
            <>
              <SecTitle>{pcc('prl.sec.refund')}</SecTitle>
              <SkRows testId="pay-refunds">
                {(payload.refundClawbackTotalFen ?? 0) !== 0 ? (
                  <div className="row">
                    <span className="lb" style={{ fontWeight: 700 }}>{pcc('prl.refund.row')}</span>
                    <span className="vl red">−{fenToYuan(Math.abs(payload.refundClawbackTotalFen ?? 0))}</span>
                  </div>
                ) : null}
                {(payload.adjustments ?? []).map((a, i) => (
                  <div className="row" key={`${a.label}-${a.sourceMonth}-${i}`}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>{a.label}</span>
                      <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
                        {pcc('prl.adjust.sourceLead')} {a.sourceMonth}
                      </span>
                    </span>
                    <span className={`vl${a.amountFen < 0 ? ' red' : ''}`}>
                      {a.amountFen < 0 ? `−${fenToYuan(Math.abs(a.amountFen))}` : `+${fenToYuan(a.amountFen)}`}
                    </span>
                  </div>
                ))}
              </SkRows>
              <SkNote>{pcc('prl.adjust.note')}</SkNote>
            </>
          ) : null}

          {/* 工资条（payroll.mySlip；发放=标记留痕，不碰真钱口径） */}
          <SecTitle>{pcc('prl.sec.slip')}</SecTitle>
          <SkRows testId="pay-slip">
            {slipQuery.isPending ? (
              <div className="row"><span className="lb"><Skeleton className="h-4 w-40 !rounded-chip" /></span></div>
            ) : !slip ? (
              <EmptyRow text={`${pcc('prl.slip.empty')}——${pcc('prl.slip.emptyBody')}`} />
            ) : (
              <>
                <div className="row" style={{ display: 'block' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center' }}>
                    {([
                      [pcc('prl.slip.commission'), slip.commissionFen],
                      [pcc('prl.slip.performance'), slip.performanceFen],
                      [pcc('prl.slip.deduction'), slip.deductionFen],
                      [pcc('prl.slip.adjustment'), slip.adjustmentFen],
                    ] as Array<[string, number]>).map(([k, v], i) => (
                      <div key={k} style={i > 0 ? { boxShadow: 'inset 1px 0 0 var(--hairline-soft)' } : undefined}>
                        <div className="sk-mono" style={{ fontSize: 12, fontWeight: 700 }}>{fenToYuan(v)}</div>
                        <div style={{ marginTop: 2, fontSize: 9.5, color: 'var(--muted)' }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--hairline-soft)', paddingTop: 10, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{pcc('prl.slip.netLabel')}</span>
                    <span className="sk-mono" style={{ marginLeft: 8, fontSize: 24, fontWeight: 700 }}>{fenToYuan(slip.netFen)}</span>
                    {slip.markedAt ? (
                      <span style={{ ...chipSt, background: 'var(--gold-pale)', color: 'var(--ink-deep)', fontWeight: 700 }}>
                        {pcc('prl.slip.marked')} {fmtTs(slip.markedAt)}
                      </span>
                    ) : (
                      <span style={{ ...chipSt, background: 'var(--paper)', color: 'var(--muted)' }}>{pcc('prl.slip.unmarked')}</span>
                    )}
                  </div>
                </div>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setAppealTarget({ kind: 'slip_line', targetId: slip.id ?? slip.month })}
                    data-testid="pay-slip-appeal"
                    style={{
                      borderRadius: 999, background: 'var(--paper)', padding: '4px 14px',
                      fontSize: 10.5, color: 'var(--ink)', border: 0, cursor: 'pointer',
                    }}
                  >
                    {pcc('prl.slip.appeal')}
                  </button>
                </div>
              </>
            )}
          </SkRows>
          <SkNote>{pcc('prl.slip.markNote')}</SkNote>

          {/* 我的申诉（状态/复核注/返还额透出 + 复核时限注记） */}
          <SecTitle>{pcc('prl.sec.myAppeals')}</SecTitle>
          <SkRows testId="pay-appeals">
            {appealsQuery.isPending ? (
              <div className="row"><span className="lb"><Skeleton className="h-4 w-40 !rounded-chip" /></span></div>
            ) : appealsQuery.isError ? (
              <EmptyRow text={pcc('prl.appeals.loadFail')} />
            ) : appeals.length === 0 ? (
              <EmptyRow text={pcc('prl.appeals.empty')} />
            ) : (
              appeals.map((a) => {
                const targetLabel =
                  a.targetKind === 'deduction'
                    ? pcc('prl.appeals.target.deduction')
                    : a.targetKind === 'adjustment'
                      ? pcc('prl.appeals.target.adjustment')
                      : pcc('prl.appeals.target.slipLine');
                return (
                  <div className="row" key={a.id}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>
                        {targetLabel}
                        <span
                          style={{
                            ...chipSt,
                            background: a.status === 'approved' ? 'var(--gold-pale)' : 'var(--paper)',
                            color: a.status === 'approved' ? 'var(--ink-deep)' : 'var(--muted)',
                          }}
                        >
                          {a.status === 'approved'
                            ? pcc('prl.appeals.statusApproved')
                            : a.status === 'rejected'
                              ? pcc('prl.appeals.statusRejected')
                              : pcc('prl.appeals.statusPending')}
                        </span>
                      </span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--ink)', fontWeight: 400 }}>{a.reason}</span>
                      <span style={{ ...monoSm, display: 'block', marginTop: 2 }}>
                        <span className="sk-mono">{a.month}</span> · {fmtTs(a.createdAt)}
                        {a.reviewNote ? ` · ${pcc('prl.appeals.reviewLead')}：${a.reviewNote}` : ''}
                      </span>
                    </span>
                    {a.refundFen != null && a.refundFen > 0 ? (
                      <span className="vl" style={{ color: 'var(--ink-deep)' }}>
                        {pcc('prl.appeals.refundLead')} {fenToYuan(a.refundFen)}
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </SkRows>
          <SkNote>{pcc('prl.appeals.slaNote', { h: slaHours })}</SkNote>

          {/* 历史月份快照（新→旧；提成月结点展开分列明细） */}
          <SecTitle>{PAY_COPY['pay.sec.history']}</SecTitle>
          <SkRows testId="pay-history">
            {data.snapshots.length === 0 ? (
              <EmptyRow text={PAY_COPY['pay.history.empty']} />
            ) : (
              data.snapshots.map((s) => (
                <SnapshotRow key={`${s.period}-${s.kind}`} period={s.period} kind={s.kind} totalFen={s.totalFen} />
              ))
            )}
          </SkRows>
          <SkNote>{PAY_COPY['pay.history.note']}</SkNote>

          {/* 口径注（server policyNote：计提时点/冲减/次月结算日/每月快照，数值读规则表） */}
          <div data-testid="pay-policy">
            <SkNote>{data.policyNote}</SkNote>
          </div>
          <p className="sk-note" style={{ textAlign: 'center', paddingBottom: 32 }}>
            {PAY_COPY['pay.footer.lead']} v{data.ruleVersion}
          </p>
        </>
      )}

      {/* 申诉弹层（deduction 行内 / slip_line 行） */}
      {appealTarget && data ? (
        <AppealModal
          month={data.month}
          target={appealTarget}
          port={port}
          showToast={showToast}
          onClose={() => setAppealTarget(null)}
        />
      ) : null}
      {toastEl}
    </div>
  );
}
