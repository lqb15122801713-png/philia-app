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
 *
 * PD-44 U5 脸升档：结构全走 SkPanel/SkSec/SkRows/SkRow/SkModal/SkNote（一次性
 * 内联样式件全撤）；可读文字 ≥12px；色只取 .sk token；
 * 主行动非 cream（重试/提交申诉=SkBtnInk，行内申诉=ghost 小 pill，三屏同款）。
 */

import { getApiBase, Skeleton, uploadImage, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { fenToYuan } from '@/components/today/utils';
import { PAY_COPY } from '@/copy/pay';
import { pcc } from '@/copy/payroll';
import {
  listAppeals,
  payrollOf,
  readAppealSlaHours,
  type AppealTargetKind,
} from '@/lib/payrollPort';
import {
  SkBackBar,
  SkBtnInk,
  SkModal,
  SkNote,
  SkPanel,
  SkRow,
  SkRows,
  SkSec,
} from '../../components/skeleton';
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

/* ---------------- 行内碎样（只取 .sk token；可读文字 ≥12px） ---------------- */

/** 行内 mono 注（行内次行；12px 同 .vl 档） */
const monoNote: CSSProperties = {
  display: 'block', marginTop: 2, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)',
};

/** 行内小徽章（12px；bg/fg 只取 token 变量） */
const tagSt = (bg: string, fg: string): CSSProperties => ({
  marginLeft: 6, borderRadius: 999, padding: '2px 8px', fontSize: 12, whiteSpace: 'nowrap',
  background: bg, color: fg,
});

/** 行内申诉小钮（三屏同款：ghost 形 30 高，不占 cream 预算） */
const rowAppealSt: CSSProperties = {
  flex: 'none', minHeight: 30, padding: '0 12px', fontSize: 12, marginRight: 8,
};

/** SkSec 段题内右挂 mono 注（小计/季度） */
const secAsideSt: CSSProperties = { marginLeft: 'auto', fontWeight: 500 };

/* ---------------- 提成单列 ---------------- */

function LineRow({ line, probation }: { line: CommissionLine; probation: boolean }) {
  return (
    <div className="row">
      <span className="lb" style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.name}</span>
        <span style={monoNote}>
          {line.date.slice(5)} · {PAY_COPY['pay.line.billNo']} {line.billNo}
          {line.pendingApproval ? (
            <span style={tagSt('var(--gold-pale)', 'var(--ink-deep)')}>{PAY_COPY['pay.line.pending']}</span>
          ) : line.overwork ? (
            <span style={tagSt('var(--gold)', 'var(--ink-deep)')}>{PAY_COPY['pay.line.overwork']}</span>
          ) : null}
          {probation && line.multiplierBp !== 10000 ? (
            <span style={tagSt('var(--paper)', 'var(--muted)')}>{PAY_COPY['pay.line.probation']}</span>
          ) : null}
          {line.splitBp != null ? (
            <span style={tagSt('var(--paper)', 'var(--ink)')}>
              {pcc('prl.line.splitLead')} {bpToPct(line.splitBp)}
            </span>
          ) : null}
        </span>
        <span style={monoNote}>
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
      <SkSec>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {title}
          <span className="sk-mono" style={secAsideSt}>{PAY_COPY['pay.sec.subtotal']} {fenToYuan(total)}</span>
        </span>
      </SkSec>
      <SkRows testId={testid}>
        {lines.length === 0 ? (
          <div className="row">
            <span className="lb" style={{ color: 'var(--muted)' }}>{emptyNote ?? PAY_COPY['pay.empty.default']}</span>
          </div>
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
          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>
            {kind === 'commission' ? PAY_COPY['pay.history.kind.commission'] : PAY_COPY['pay.history.kind.perf']}
          </span>
        </span>
        <span style={monoNote}>
          <span style={{ ...tagSt('var(--paper)', 'var(--ink)'), marginLeft: 0 }}>{PAY_COPY['pay.history.settled']}</span>
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
        <div className="sk-mono" style={{ padding: '0 0 11px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
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

/* ---------------- 申诉弹层（reason 必填 + 附图选传 ≤3；SkModal=蒙层点按/Esc 取消+滚锁） ---------------- */

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
    <SkModal title={pcc('prl.appeal.title')} onClose={onClose} testId="pay-appeal-modal">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder={pcc('prl.appeal.reasonPh')}
        data-testid="pay-appeal-reason"
        className="sk-textarea"
        style={{ marginTop: 10 }}
      />
      {/* 附图（选传 ≤3，现场拍） */}
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {photos.map((p) => (
          <span key={p.url} style={{ position: 'relative', display: 'inline-block', width: 64, height: 48, flex: 'none' }}>
            <img src={p.thumbUrl} alt="附图" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
            <button
              type="button"
              aria-label="删除这张附图"
              onClick={() => setPhotos((prev) => prev.filter((x) => x.url !== p.url))}
              style={{
                position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                background: 'var(--ink)', color: 'var(--paper)', fontSize: 12, lineHeight: 1,
                border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
              }}
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
            style={{
              height: 48, borderRadius: 8, padding: '0 12px', background: 'var(--card)',
              border: '1px dashed var(--hairline)', color: 'var(--muted)', fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
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
      <div className="acts">
        <button type="button" className="sk-btn-ghost" onClick={onClose}>
          {pcc('prl.appeal.cancel')}
        </button>
        <SkBtnInk
          disabled={busy || uploading}
          onClick={() => void submit()}
          testId="pay-appeal-submit"
        >
          {busy ? pcc('prl.appeal.submitting') : pcc('prl.appeal.submit')}
        </SkBtnInk>
      </div>
    </SkModal>
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
            <SkPanel key={i}>
              <Skeleton className="h-5 w-28 !rounded-chip" />
              <Skeleton className="mt-2 h-4 w-44 !rounded-chip" />
            </SkPanel>
          ))}
        </div>
      ) : summaryQuery.isError || !data || !payload || !perf || !my ? (
        <SkPanel>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{PAY_COPY['pay.load.fail']}</p>
            <div style={{ marginTop: 12 }}>
              <SkBtnInk onClick={() => void summaryQuery.refetch()} testId="sk-pay-retry">
                {PAY_COPY['pay.retry']}
              </SkBtnInk>
            </div>
          </div>
        </SkPanel>
      ) : (
        <>
          {/* 大数字卡（mono 34 合计 + trio 分项） */}
          <SkPanel testId="pay-total">
            <div style={{ textAlign: 'center' }}>
              <p className="sk-mono" style={{ fontSize: 12, letterSpacing: '.12em', color: 'var(--muted)' }}>
                {PAY_COPY['pay.total.label']}
              </p>
              <p className="sk-mono" style={{ marginTop: 4, fontSize: 34, fontWeight: 700, letterSpacing: '.02em' }}>
                {fenToYuan(payload.commissionTotalFen)}
              </p>
              {payload.probation ? (
                <p style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{PAY_COPY['pay.probation.note']}</p>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 14, borderTop: '1px solid var(--hairline-soft)', paddingTop: 12 }}>
                {trioCells.map((c, i) => (
                  <div key={c.k} style={i > 0 ? { boxShadow: 'inset 1px 0 0 var(--hairline-soft)' } : undefined}>
                    <div className="sk-mono" style={{ fontSize: 13, fontWeight: 700 }}>{c.v}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>{c.k}</div>
                  </div>
                ))}
              </div>
              {/* 双轨注记：劳动业绩/销售业绩（快照月份无字段=不渲染） */}
              {payload.laborTotalFen != null || payload.salesTotalFen != null ? (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--hairline-soft)', paddingTop: 10 }} data-testid="pay-dual-track">
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>{pcc('prl.track.labor')}</span>
                    <span className="sk-mono" style={{ fontWeight: 700 }}>{fenToYuan(payload.laborTotalFen ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>{pcc('prl.track.sales')}</span>
                    <span className="sk-mono" style={{ fontWeight: 700 }}>{fenToYuan(payload.salesTotalFen ?? 0)}</span>
                  </div>
                  <p style={{ ...monoNote, marginTop: 6 }}>{pcc('prl.track.note')}</p>
                </div>
              ) : null}
            </div>
          </SkPanel>

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
              <SkSec>{PAY_COPY['pay.sec.store']}</SkSec>
              <SkRows testId="pay-store">
                {payload.storeLines.map((l) => (
                  <div className="row" key={l.kind}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>{l.label}</span>
                      <span style={monoNote}>
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
          <SkSec>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {PAY_COPY['pay.sec.perf']}
              <span className="sk-mono" style={secAsideSt}>{perf.quarter} {PAY_COPY['pay.perf.quarterTail']}</span>
            </span>
          </SkSec>
          <SkRows testId="pay-performance">
            {!perf.applicable ? (
              <div className="row">
                <span className="lb" style={{ color: 'var(--muted)' }}>{perf.note ?? PAY_COPY['pay.perf.na']}</span>
              </div>
            ) : (
              <>
                <div className="row">
                  <span className="lb" style={{ color: 'var(--muted)' }}>{my.label}</span>
                </div>
                <SkRow label={PAY_COPY['pay.perf.base']} value={fenToYuan(my.pool.baseFen)} />
                <SkRow label={PAY_COPY['pay.perf.grade']} value={perf.grade} />
                <SkRow label={PAY_COPY['pay.perf.coeff']} value={perf.coeffBp === null ? '—' : `×${bpToCoeff(perf.coeffBp)}`} />
                <SkRow
                  label={`${PAY_COPY['pay.perf.estimateLead']} ${bpToPct(my.pool.rateBp)} ${PAY_COPY['pay.perf.estimateTail']}`}
                  value={fenToYuan(perf.payableFen)}
                />
                {perf.coeffBp === null ? (
                  <div className="row">
                    <span className="lb" style={{ color: 'var(--muted)' }}>{PAY_COPY['pay.perf.noGrade']}</span>
                  </div>
                ) : null}
              </>
            )}
          </SkRows>

          {/* 扣减记录（只扣绩效不扣提成；active 行行内申诉，reverted 灰态已返还） */}
          <SkSec>{PAY_COPY['pay.sec.deductions']}</SkSec>
          <SkRows testId="pay-deductions">
            {payload.deductions.length === 0 ? (
              <div className="row">
                <span className="lb" style={{ color: 'var(--muted)' }}>{PAY_COPY['pay.deductions.empty']}</span>
              </div>
            ) : (
              payload.deductions.map((d) => {
                const reverted = d.status === 'reverted';
                return (
                  <div className="row" key={d.id} style={reverted ? { opacity: 0.55 } : undefined}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>
                        {d.reason}
                        {reverted ? (
                          <span style={tagSt('var(--paper)', 'var(--muted)')}>{pcc('prl.deduction.reverted')}</span>
                        ) : null}
                      </span>
                      <span style={monoNote}>
                        {fmtTs(d.createdAt)} · {PAY_COPY['pay.deductions.creatorLead']} {d.createdBy.slice(-6)}
                      </span>
                    </span>
                    {!reverted ? (
                      <button
                        type="button"
                        className="sk-btn-ghost"
                        style={rowAppealSt}
                        onClick={() => setAppealTarget({ kind: 'deduction', targetId: d.id })}
                        data-testid={`pay-appeal-${d.id}`}
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
              <SkSec>{pcc('prl.sec.refund')}</SkSec>
              <SkRows testId="pay-refunds">
                {(payload.refundClawbackTotalFen ?? 0) !== 0 ? (
                  <SkRow
                    label={<span style={{ fontWeight: 700 }}>{pcc('prl.refund.row')}</span>}
                    value={`−${fenToYuan(Math.abs(payload.refundClawbackTotalFen ?? 0))}`}
                    tone="red"
                  />
                ) : null}
                {(payload.adjustments ?? []).map((a, i) => (
                  <div className="row" key={`${a.label}-${a.sourceMonth}-${i}`}>
                    <span className="lb" style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700 }}>{a.label}</span>
                      <span style={monoNote}>
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
          <SkSec>{pcc('prl.sec.slip')}</SkSec>
          <SkRows testId="pay-slip">
            {slipQuery.isPending ? (
              <div className="row"><span className="lb"><Skeleton className="h-4 w-40 !rounded-chip" /></span></div>
            ) : !slip ? (
              <div className="row">
                <span className="lb" style={{ color: 'var(--muted)' }}>{pcc('prl.slip.empty')}——{pcc('prl.slip.emptyBody')}</span>
              </div>
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
                        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--hairline-soft)', paddingTop: 10, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pcc('prl.slip.netLabel')}</span>
                    <span className="sk-mono" style={{ marginLeft: 8, fontSize: 24, fontWeight: 700 }}>{fenToYuan(slip.netFen)}</span>
                    {slip.markedAt ? (
                      <span style={{ ...tagSt('var(--gold-pale)', 'var(--ink-deep)'), fontWeight: 700 }}>
                        {pcc('prl.slip.marked')} {fmtTs(slip.markedAt)}
                      </span>
                    ) : (
                      <span style={tagSt('var(--paper)', 'var(--muted)')}>{pcc('prl.slip.unmarked')}</span>
                    )}
                  </div>
                </div>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="sk-btn-ghost"
                    style={{ minHeight: 30, padding: '0 14px', fontSize: 12 }}
                    onClick={() => setAppealTarget({ kind: 'slip_line', targetId: slip.id ?? slip.month })}
                    data-testid="pay-slip-appeal"
                  >
                    {pcc('prl.slip.appeal')}
                  </button>
                </div>
              </>
            )}
          </SkRows>
          <SkNote>{pcc('prl.slip.markNote')}</SkNote>

          {/* 我的申诉（状态/复核注/返还额透出 + 复核时限注记） */}
          <SkSec>{pcc('prl.sec.myAppeals')}</SkSec>
          <SkRows testId="pay-appeals">
            {appealsQuery.isPending ? (
              <div className="row"><span className="lb"><Skeleton className="h-4 w-40 !rounded-chip" /></span></div>
            ) : appealsQuery.isError ? (
              <div className="row">
                <span className="lb" style={{ color: 'var(--muted)' }}>{pcc('prl.appeals.loadFail')}</span>
              </div>
            ) : appeals.length === 0 ? (
              <div className="row">
                <span className="lb" style={{ color: 'var(--muted)' }}>{pcc('prl.appeals.empty')}</span>
              </div>
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
                          style={
                            a.status === 'approved'
                              ? tagSt('var(--gold-pale)', 'var(--ink-deep)')
                              : tagSt('var(--paper)', 'var(--muted)')
                          }
                        >
                          {a.status === 'approved'
                            ? pcc('prl.appeals.statusApproved')
                            : a.status === 'rejected'
                              ? pcc('prl.appeals.statusRejected')
                              : pcc('prl.appeals.statusPending')}
                        </span>
                      </span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--ink)', fontWeight: 400 }}>{a.reason}</span>
                      <span style={monoNote}>
                        <span className="sk-mono">{a.month}</span> · {fmtTs(a.createdAt)}
                        {a.reviewNote ? ` · ${pcc('prl.appeals.reviewLead')}：${a.reviewNote}` : ''}
                      </span>
                    </span>
                    {a.refundFen != null && a.refundFen > 0 ? (
                      <span className="vl">
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
          <SkSec>{PAY_COPY['pay.sec.history']}</SkSec>
          <SkRows testId="pay-history">
            {data.snapshots.length === 0 ? (
              <div className="row">
                <span className="lb" style={{ color: 'var(--muted)' }}>{PAY_COPY['pay.history.empty']}</span>
              </div>
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
