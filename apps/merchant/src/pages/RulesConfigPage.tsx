/**
 * 规则配置管理端口（批次 员工端2.0 · R9-F，任务书 V1.1 §四.F + V1.3 裁定）
 *
 * 冻结口径：
 * - 仅 owner：墨轨入口已按 isOwner 收起；本页再自装页内闸门（非 owner → 明确引导页，
 *   非 403 白屏）；server 端 merchantOwnerProcedure 为硬闸门（clerk/manager 403 实证）；
 * - 提成+XP 全参数可视化：双域页签（提成与绩效 / XP 成长），config.list({domain}) 拉全量规则行；
 * - 数值一律读写配置表（不落代码常量）：比例/系数/倍率 bp ↔ 展示 %/系数/倍率，
 *   定额 fen ↔ 元，拆分 bp ↔ %，分值/上限/门槛/保级线/日/时 直读直写；
 * - 置灰行（作废/备用/预留/随会员游戏化批开通）只读展示 + 状态 chip，不可编辑；
 * - 脏跟踪：仅提交有变化的 key；保存 = 危险操作 D 套（变更摘要明示 + 键入「确认保存」二次确认）
 *   → config.save；保存即生效，toast 明示 + 列表/留痕双失效刷新；
 * - 修改留痕：config.versions（谁/何时/每 key 前后值，可展开）；
 * - 新规只约束生效后的单，不回溯历史月份与已快照数据（页面小字明示）。
 */

import { usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, Empty, Field, Modal, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 类型锚点（server AppRouter 推导，构建期擦除）                          */
/* ------------------------------------------------------------------ */

type Trpc = PhiliaClient['trpc'];
type ListOut = Awaited<ReturnType<Trpc['config']['list']['query']>>;
type RuleRow = ListOut['rules'][number];
type VersionsOut = Awaited<ReturnType<Trpc['config']['versions']['query']>>;
type VersionRow = VersionsOut['versions'][number];

type RulesDomain = 'commission' | 'xp';

const DOMAIN_TABS: Array<{ key: RulesDomain; label: string }> = [
  { key: 'commission', label: '提成与绩效' },
  { key: 'xp', label: 'XP 成长' },
];

const DOMAIN_TITLE: Record<RulesDomain, string> = {
  commission: '提成与绩效规则',
  xp: 'XP 成长规则',
};

/* ------------------------------------------------------------------ */
/* 数值换算族（bp=万分比 / fen=分 / 直读直写）——展示层换算，落库值不变      */
/* ------------------------------------------------------------------ */

type NumConv = 'percent' | 'coeff' | 'multiplier' | 'yuan' | 'plain';

interface FieldMeta {
  label: string;
  conv: NumConv;
  suffix?: string;
}

/** 已知数值字段的展示族（与 server configRules.ts 的 NUMERIC_KEYS 口径对齐） */
const FIELD_META: Record<string, FieldMeta> = {
  rate_bp: { label: '比例', conv: 'percent', suffix: '%' },
  rate_bp_min: { label: '比例下限', conv: 'percent', suffix: '%' },
  rate_bp_max: { label: '比例上限', conv: 'percent', suffix: '%' },
  cap_bp: { label: '上限比例', conv: 'percent', suffix: '%' },
  coeff_bp: { label: '系数', conv: 'coeff' },
  multiplier_bp: { label: '倍率', conv: 'multiplier' },
  points: { label: '分值', conv: 'plain', suffix: 'XP' },
  cap: { label: '日上限', conv: 'plain', suffix: 'XP' },
  limit: { label: '次数上限', conv: 'plain', suffix: '次' },
  threshold: { label: '段位门槛', conv: 'plain', suffix: 'XP' },
  monthly_xp: { label: '月保级线', conv: 'plain', suffix: 'XP' },
  day: { label: '日', conv: 'plain' },
  hour: { label: '时（24 小时制）', conv: 'plain' },
  threshold_per_day: { label: '每日门槛', conv: 'plain' },
};

const MAP_LABEL: Record<string, string> = {
  fixed_fen_by_plan: '售卡定额',
  split_bp: '拆分比例',
};

const MAP_CONV: Record<string, NumConv> = {
  fixed_fen_by_plan: 'yuan',
  split_bp: 'percent',
};

const MAP_UNIT: Record<string, string> = {
  fixed_fen_by_plan: '元/单',
  split_bp: '%',
};

/** 师徒拆分成员中文签（其余 key 原样展示） */
const SPLIT_MEMBER_LABEL: Record<string, string> = {
  apprentice: '徒弟',
  mentor: '师傅',
};

const TEXT_FIELD_LABEL: Record<string, string> = {
  name: '名称',
  level: '段位',
  same_as: '口径引用',
};

/** 置灰行状态 chip（V1.3 种子口径；fallback=已停用） */
const INACTIVE_STATUS: Record<string, string> = {
  commission_stored_value_topup: '作废',
  commission_live_animal_rate: '备用',
  commission_p4_region_rate: '预留',
  xp_referral: '随会员游戏化批开通',
};

/** 危险操作 D 套：须键入的确认口令 */
const CONFIRM_PHRASE = '确认保存';

/* ------------------------------------------------------------------ */
/* 换算与格式化                                                         */
/* ------------------------------------------------------------------ */

/** 去掉浮点尾噪（如 0.30000000000000004 → 0.3） */
function trimNum(n: number): string {
  return String(Number(n.toFixed(4)));
}

/** 库内值 → 输入框展示串（2000bp→'20'；12000bp→'1.2'；500fen→'5'） */
function toDisplay(conv: NumConv, internal: number): string {
  switch (conv) {
    case 'percent':
      return trimNum(internal / 100);
    case 'coeff':
    case 'multiplier':
      return trimNum(internal / 10000);
    case 'yuan':
      return trimNum(internal / 100);
    case 'plain':
      return String(internal);
  }
}

/** 输入串 → 库内值（非法输入返回 null；整数族四舍五入到整数） */
function fromDisplay(conv: NumConv, text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const v = Number(t);
  if (!Number.isFinite(v)) return null;
  switch (conv) {
    case 'percent':
    case 'yuan':
      return Math.round(v * 100);
    case 'coeff':
    case 'multiplier':
      return Math.round(v * 10000);
    case 'plain':
      return Math.round(v);
  }
}

/** 库内值 → 人类可读（2000→'20%'；15000→'1.5 倍'；500→'5 元'） */
function fmtInternal(conv: NumConv, internal: number): string {
  switch (conv) {
    case 'percent':
      return `${trimNum(internal / 100)}%`;
    case 'coeff':
      return trimNum(internal / 10000);
    case 'multiplier':
      return `${trimNum(internal / 10000)} 倍`;
    case 'yuan':
      return internal % 100 === 0 ? `${internal / 100} 元` : `${(internal / 100).toFixed(2)} 元`;
    case 'plain':
      return String(internal);
  }
}

function mapMemberLabel(mapKey: string, subKey: string): string {
  if (mapKey === 'split_bp') return SPLIT_MEMBER_LABEL[subKey] ?? subKey;
  return subKey;
}

function fieldLabel(k: string): string {
  return FIELD_META[k]?.label ?? MAP_LABEL[k] ?? TEXT_FIELD_LABEL[k] ?? k;
}

/** 单字段值格式化（留痕 diff 用） */
function fmtScalar(key: string, v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    const meta = FIELD_META[key];
    return meta ? fmtInternal(meta.conv, v) : trimNum(v);
  }
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const conv = MAP_CONV[key] ?? 'plain';
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return '—';
    return entries
      .map(([mk, mv]) => `${mapMemberLabel(key, mk)} ${typeof mv === 'number' ? fmtInternal(conv, mv) : String(mv)}`)
      .join('、');
  }
  return '—';
}

/** 整行值摘要（置灰行只读展示用）：'比例 20% · 系数 1.2' */
function fmtValueSummary(value: Record<string, unknown>): string {
  const parts = Object.entries(value).map(([k, v]) => `${fieldLabel(k)} ${fmtScalar(k, v)}`);
  return parts.length > 0 ? parts.join(' · ') : '—（无数值参数）';
}

/** 规则名取首段作短签（全名作 hint 保留） */
function shortLabel(label: string): string {
  const m = /^[^：:（(]+/.exec(label);
  return m ? m[0].trim() : label;
}

/* ------------------------------------------------------------------ */
/* 编辑器模型：把 valueJson 摊成可编辑字段 + 只读注记                      */
/* ------------------------------------------------------------------ */

interface NumEditor {
  kind: 'num';
  path: string;
  key: string;
  meta: FieldMeta;
  original: number;
}

interface MapEntry {
  sub: string;
  subLabel: string;
  path: string;
  original: number;
}

interface MapEditor {
  kind: 'map';
  key: string;
  mapLabel: string;
  conv: NumConv;
  unitHint: string;
  entries: MapEntry[];
}

interface TextEditor {
  kind: 'text';
  path: string;
  key: string;
  label: string;
  original: string;
}

type Editor = NumEditor | MapEditor | TextEditor;

interface RuleModel {
  editors: Editor[];
  /** 结构性字段只读注记（level 段位序号 / same_as 口径引用等，不做假控件） */
  notes: string[];
}

function buildModel(value: Record<string, unknown>): RuleModel {
  const editors: Editor[] = [];
  const notes: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    if (k === 'fixed_fen_by_plan' || k === 'split_bp') {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const entries: MapEntry[] = [];
        for (const [mk, mv] of Object.entries(v as Record<string, unknown>)) {
          if (typeof mv === 'number' && Number.isFinite(mv)) {
            entries.push({ sub: mk, subLabel: mapMemberLabel(k, mk), path: `${k}::${mk}`, original: mv });
          }
        }
        if (entries.length > 0) {
          editors.push({
            kind: 'map',
            key: k,
            mapLabel: MAP_LABEL[k] ?? k,
            conv: MAP_CONV[k] ?? 'plain',
            unitHint: MAP_UNIT[k] ?? '',
            entries,
          });
        }
      }
      continue;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const meta = FIELD_META[k];
      if (meta) {
        editors.push({ kind: 'num', path: k, key: k, meta, original: v });
      } else if (k === 'level') {
        notes.push(`段位 Lv.${v}`);
      } else {
        // 未知数值字段：按直读直写放开（server 按 key 族校验兜底，页面不阻断合法演进）
        editors.push({ kind: 'num', path: k, key: k, meta: { label: k, conv: 'plain' }, original: v });
      }
      continue;
    }
    if (typeof v === 'string') {
      if (k === 'name') {
        editors.push({ kind: 'text', path: k, key: k, label: TEXT_FIELD_LABEL.name!, original: v });
      } else if (k === 'same_as') {
        notes.push(`口径引用：${v}（同前台规则，无数值参数）`);
      } else {
        notes.push(`${k}：${v}`);
      }
    }
  }
  return { editors, notes };
}

/** 按当前规则行初始化草稿（输入框展示串） */
function initDrafts(rules: RuleRow[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const r of rules) {
    if (!r.active) continue;
    const model = buildModel(r.valueJson);
    const d: Record<string, string> = {};
    for (const ed of model.editors) {
      if (ed.kind === 'num') d[ed.path] = toDisplay(ed.meta.conv, ed.original);
      else if (ed.kind === 'map') for (const e of ed.entries) d[e.path] = toDisplay(ed.conv, e.original);
      else d[ed.path] = ed.original;
    }
    out[r.ruleKey] = d;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 脏跟踪：草稿 vs 现值 → 待保存变更（仅变化的 key）+ 校验错误              */
/* ------------------------------------------------------------------ */

interface PendingField {
  label: string;
  beforeText: string;
  afterText: string;
}

interface PendingChange {
  ruleKey: string;
  short: string;
  after: Record<string, unknown>;
  fields: PendingField[];
}

interface PendingResult {
  pending: PendingChange[];
  /** ruleKey → fieldPath → 错误文案（有任一错误则禁止进入重确认） */
  errors: Record<string, Record<string, string>>;
  errorCount: number;
}

function computePending(activeRules: RuleRow[], drafts: Record<string, Record<string, string>>): PendingResult {
  const pending: PendingChange[] = [];
  const errors: Record<string, Record<string, string>> = {};
  let errorCount = 0;

  const putErr = (rk: string, path: string, msg: string) => {
    (errors[rk] ??= {})[path] = msg;
    errorCount += 1;
  };

  for (const r of activeRules) {
    const rk = r.ruleKey;
    const draft = drafts[rk] ?? {};
    const model = buildModel(r.valueJson);
    const after: Record<string, unknown> = { ...r.valueJson };
    const fields: PendingField[] = [];

    for (const ed of model.editors) {
      if (ed.kind === 'text') {
        const text = (draft[ed.path] ?? '').trim();
        if (text === '') {
          putErr(rk, ed.path, '名称不能为空');
          continue;
        }
        if (text !== ed.original) {
          fields.push({ label: ed.label, beforeText: ed.original, afterText: text });
          after[ed.key] = text;
        }
        continue;
      }

      if (ed.kind === 'num') {
        const parsed = fromDisplay(ed.meta.conv, draft[ed.path] ?? '');
        if (parsed === null) {
          putErr(rk, ed.path, '请输入有效数字');
          continue;
        }
        if (parsed < 0) {
          // 与 server 口径一致：仅差评扣分键允许负分值
          const allowNeg = ed.key === 'points' && rk === 'xp_penalty_low_star';
          if (!allowNeg) {
            putErr(rk, ed.path, '不允许为负');
            continue;
          }
        }
        if (parsed !== ed.original) {
          fields.push({
            label: ed.meta.label,
            beforeText: fmtInternal(ed.meta.conv, ed.original),
            afterText: fmtInternal(ed.meta.conv, parsed),
          });
          after[ed.key] = parsed;
        }
        continue;
      }

      // map 族（fixed_fen_by_plan / split_bp）
      const origMap = (r.valueJson[ed.key] ?? {}) as Record<string, unknown>;
      const newMap: Record<string, number> = { ...(origMap as Record<string, number>) };
      let sum = 0;
      let mapValid = true;
      for (const e of ed.entries) {
        const parsed = fromDisplay(ed.conv, draft[e.path] ?? '');
        if (parsed === null) {
          putErr(rk, e.path, '请输入有效数字');
          mapValid = false;
          continue;
        }
        if (parsed < 0) {
          putErr(rk, e.path, '不允许为负');
          mapValid = false;
          continue;
        }
        sum += parsed;
        if (parsed !== e.original) {
          fields.push({
            label: `${ed.mapLabel}·${e.subLabel}`,
            beforeText: fmtInternal(ed.conv, e.original),
            afterText: fmtInternal(ed.conv, parsed),
          });
          newMap[e.sub] = parsed;
        }
      }
      // 师徒拆分合计须为 100%（bp 10000），否则钱会被放大/缩水——前端拦截
      if (ed.key === 'split_bp' && mapValid && sum !== 10000) {
        putErr(rk, ed.key, `拆分合计应为 100%（当前 ${trimNum(sum / 100)}%）`);
      }
      if (fields.length > 0) after[ed.key] = newMap;
    }

    if (fields.length > 0) {
      pending.push({ ruleKey: rk, short: shortLabel(r.label), after, fields });
    }
  }
  return { pending, errors, errorCount };
}

/** 留痕 diff：before/after valueJson → 逐字段「label：旧 → 新」 */
function diffEntries(before: unknown, after: unknown): string[] {
  const b = before && typeof before === 'object' && !Array.isArray(before) ? (before as Record<string, unknown>) : {};
  const a = after && typeof after === 'object' && !Array.isArray(after) ? (after as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const lines: string[] = [];
  for (const k of keys) {
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    if ((k === 'fixed_fen_by_plan' || k === 'split_bp') && bv && av && typeof bv === 'object' && typeof av === 'object') {
      const conv = MAP_CONV[k] ?? 'plain';
      const subs = new Set([...Object.keys(bv), ...Object.keys(av as object)]);
      for (const mk of subs) {
        const sb = (bv as Record<string, unknown>)[mk];
        const sa = (av as Record<string, unknown>)[mk];
        if (JSON.stringify(sb) === JSON.stringify(sa)) continue;
        const sbText = typeof sb === 'number' ? fmtInternal(conv, sb) : '—';
        const saText = typeof sa === 'number' ? fmtInternal(conv, sa) : '—';
        lines.push(`${mapMemberLabel(k, mk)}：${sbText} → ${saText}`);
      }
    } else {
      lines.push(`${fieldLabel(k)}：${fmtScalar(k, bv)} → ${fmtScalar(k, av)}`);
    }
  }
  return lines.length > 0 ? lines : ['（值无明细差异）'];
}

/* ------------------------------------------------------------------ */
/* 小组件                                                              */
/* ------------------------------------------------------------------ */

/** 数值输入（无 w-full，定宽；label + 后缀单位 + 错误小字） */
function NumInput({
  label,
  suffix,
  text,
  error,
  onChange,
}: {
  label: string;
  suffix?: string;
  text: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption-xs text-[rgba(74,59,46,.62)]">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          className={`w-24 rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 focus:outline-none ${
            error
              ? 'ring-danger focus:ring-danger'
              : 'ring-line-ring focus:ring-[rgba(74,59,46,.25)]'
          }`}
          style={numStyle}
          inputMode="decimal"
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? <span className="shrink-0 text-caption-xs text-[rgba(74,59,46,.42)]">{suffix}</span> : null}
      </span>
      {error ? <span className="mt-1 block text-caption-xs text-danger-deep">{error}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* 域面板（每个页签一份：规则编辑 + 保存条 + 重确认弹层 + 修改留痕）          */
/* ------------------------------------------------------------------ */

function DomainPanel({ domain }: { domain: RulesDomain }) {
  const { trpc, queryClient } = usePhiliaClient();

  const rulesQuery = useQuery({
    queryKey: ['config', 'list', domain],
    queryFn: () => trpc.config.list.query({ domain }),
  });
  const versionsQuery = useQuery({
    queryKey: ['config', 'versions', domain],
    queryFn: () => trpc.config.versions.query({ domain, limit: 20 }),
  });

  const rows = useMemo(() => rulesQuery.data?.rules ?? [], [rulesQuery.data]);
  const activeRules = useMemo(() => rows.filter((r) => r.active), [rows]);
  const currentVersion = rulesQuery.data?.currentVersion ?? 0;

  /* 置灰行：无 active 版本的 key 取最新一条只读展示（被替换下来的历史版本由留痕区覆盖） */
  const inactiveRules = useMemo(() => {
    const activeKeys = new Set(activeRules.map((r) => r.ruleKey));
    const latest = new Map<string, RuleRow>();
    for (const r of rows) {
      if (r.active || activeKeys.has(r.ruleKey)) continue;
      const cur = latest.get(r.ruleKey);
      if (!cur || r.version > cur.version) latest.set(r.ruleKey, r);
    }
    return [...latest.values()];
  }, [rows, activeRules]);

  /* ruleKey → 现行 label（留痕区显名用；含置灰行，active 在前先命中） */
  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (!m.has(r.ruleKey)) m.set(r.ruleKey, r.label);
    return m;
  }, [rows]);

  /* 草稿：数据源身份变化（首载/保存后刷新）时整体重置（渲染期回填，同 SettingsPage 口径） */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [draftsSource, setDraftsSource] = useState<unknown>(null);
  if (rulesQuery.data && rulesQuery.data !== draftsSource) {
    setDraftsSource(rulesQuery.data);
    setDrafts(initDrafts(rulesQuery.data.rules));
  }

  const { pending, errors, errorCount } = useMemo(
    () => computePending(activeRules, drafts),
    [activeRules, drafts],
  );

  const setDraft = (ruleKey: string, path: string, text: string) =>
    setDrafts((prev) => ({ ...prev, [ruleKey]: { ...prev[ruleKey], [path]: text } }));

  const resetDrafts = () => setDrafts(initDrafts(activeRules));

  /* ---------------- 保存（危险操作 D 套：重确认弹层） ---------------- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [saving, setSaving] = useState(false);

  const openConfirm = () => {
    if (pending.length === 0) return;
    if (errorCount > 0) {
      toast('有参数格式不正确，请先修正标红项', 'error');
      return;
    }
    setConfirmText('');
    setConfirmOpen(true);
  };

  const doSave = async () => {
    if (confirmText.trim() !== CONFIRM_PHRASE) return;
    setSaving(true);
    try {
      const r = await trpc.config.save.mutate({
        domain,
        changes: pending.map((p) => ({ ruleKey: p.ruleKey, valueJson: p.after })),
      });
      toast(`已保存并立即生效（${DOMAIN_TITLE[domain]} 版本 v${r.version}）`);
      setConfirmOpen(false);
      setConfirmText('');
      await queryClient.invalidateQueries({ queryKey: ['config', 'list', domain] });
      await queryClient.invalidateQueries({ queryKey: ['config', 'versions', domain] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- 留痕展开 ---------------- */
  const [openVersionId, setOpenVersionId] = useState<string | null>(null);

  /* ---------------- 渲染 ---------------- */
  if (rulesQuery.isPending) {
    // 骨架（禁转圈）
    return (
      <div className="u3-panel animate-pulse" aria-label="加载中">
        <div className="u3-panel-head">
          <div className="h-4 w-24 rounded-chip bg-[rgba(74,59,46,.08)]" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-4">
            <div className="h-3 rounded-chip bg-[rgba(74,59,46,.06)]" style={{ width: `${46 + i * 9}%` }} />
            <div className="mt-2 h-8 w-2/3 rounded-control bg-[rgba(74,59,46,.05)]" />
          </div>
        ))}
      </div>
    );
  }

  if (rulesQuery.isError) {
    return (
      <Empty
        title={`规则加载失败：${errMsg(rulesQuery.error)}`}
        hint="仅店主可读取规则配置；请确认登录态后重试"
      />
    );
  }

  return (
    <>
      {/* 规则面板 */}
      <div className="u3-panel" data-testid={`rules-panel-${domain}`}>
        <div className="u3-panel-head">
          <h3>{DOMAIN_TITLE[domain]}</h3>
          <span className="aside">
            当前生效版本 <span className="u1-num">v{currentVersion}</span> · 保存即生效
          </span>
        </div>

        {activeRules.map((r) => {
          const model = buildModel(r.valueJson);
          const rowErrors = errors[r.ruleKey] ?? {};
          return (
            <div key={r.id} className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-[13px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-caption font-semibold text-ink">{shortLabel(r.label)}</div>
                  <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]">{r.label}</div>
                  <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]" style={numStyle}>
                    自 {fmtDateTime(r.effectiveFrom)} 起生效
                    {r.creatorNickname ? ` · 由 ${r.creatorNickname} 设置` : ''}
                    {model.notes.length > 0 ? ` · ${model.notes.join(' · ')}` : ''}
                  </div>
                </div>
                <Badge tone="muted">v{r.version}</Badge>
              </div>

              {model.editors.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-start gap-x-4 gap-y-2.5">
                  {model.editors.map((ed) => {
                    if (ed.kind === 'num') {
                      return (
                        <NumInput
                          key={ed.path}
                          label={ed.meta.label}
                          suffix={ed.meta.suffix}
                          text={drafts[r.ruleKey]?.[ed.path] ?? ''}
                          error={rowErrors[ed.path]}
                          onChange={(v) => setDraft(r.ruleKey, ed.path, v)}
                        />
                      );
                    }
                    if (ed.kind === 'map') {
                      return (
                        <div key={ed.key} className="min-w-0">
                          <div className="mb-1 flex items-baseline gap-2">
                            <span className="text-caption-xs font-semibold text-[rgba(74,59,46,.62)]">
                              {ed.mapLabel}
                            </span>
                            {ed.key === 'split_bp' ? (
                              <span className="text-caption-xs text-[rgba(74,59,46,.42)]">合计须为 100%</span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-start gap-3">
                            {ed.entries.map((e) => (
                              <NumInput
                                key={e.path}
                                label={e.subLabel}
                                suffix={ed.unitHint}
                                text={drafts[r.ruleKey]?.[e.path] ?? ''}
                                error={rowErrors[e.path]}
                                onChange={(v) => setDraft(r.ruleKey, e.path, v)}
                              />
                            ))}
                          </div>
                          {rowErrors[ed.key] ? (
                            <div className="mt-1 text-caption-xs text-danger-deep">{rowErrors[ed.key]}</div>
                          ) : null}
                        </div>
                      );
                    }
                    return (
                      <label key={ed.path} className="block">
                        <span className="mb-1 block text-caption-xs text-[rgba(74,59,46,.62)]">{ed.label}</span>
                        <input
                          className={`w-32 rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 focus:outline-none ${
                            rowErrors[ed.path]
                              ? 'ring-danger focus:ring-danger'
                              : 'ring-line-ring focus:ring-[rgba(74,59,46,.25)]'
                          }`}
                          maxLength={20}
                          value={drafts[r.ruleKey]?.[ed.path] ?? ''}
                          onChange={(e) => setDraft(r.ruleKey, ed.path, e.target.value)}
                        />
                        {rowErrors[ed.path] ? (
                          <span className="mt-1 block text-caption-xs text-danger-deep">{rowErrors[ed.path]}</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-caption-xs text-[rgba(74,59,46,.42)]">无可调数值参数（口径见规则名）</div>
              )}
            </div>
          );
        })}

        {/* 置灰行（只读 + 状态 chip） */}
        {inactiveRules.length > 0 ? (
          <>
            <div className="border-t border-[rgba(74,59,46,.06)] px-[17px] pb-1 pt-3 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">
              已停用 / 备用 / 预留（只读，不参与计提与计分）
            </div>
            {inactiveRules.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 border-t border-[rgba(74,59,46,.06)] px-[17px] py-[13px] opacity-70"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-caption text-[rgba(74,59,46,.62)]">{shortLabel(r.label)}</div>
                  <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]">{r.label}</div>
                  <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]" style={numStyle}>
                    {fmtValueSummary(r.valueJson)}
                  </div>
                </div>
                <Badge tone="muted">{INACTIVE_STATUS[r.ruleKey] ?? '已停用'}</Badge>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {/* 待保存条（有变更才浮出） */}
      {pending.length > 0 ? (
        <div
          className="u1-ring sticky bottom-4 z-10 mt-3.5 flex items-center justify-between gap-3 rounded-panel bg-card px-4 py-3 shadow-elevated"
          data-testid="rules-save-bar"
        >
          <span className="text-caption text-ink">
            待保存修改 <b style={numStyle}>{pending.length}</b> 项
            {errorCount > 0 ? <span className="ml-2 text-danger-deep">（{errorCount} 项格式有误）</span> : null}
          </span>
          <div className="flex shrink-0 gap-2">
            <Btn variant="subtle" size="sm" onClick={resetDrafts} disabled={saving}>
              放弃修改
            </Btn>
            <Btn
              variant="primary"
              size="sm"
              data-testid="rules-open-confirm"
              onClick={openConfirm}
              disabled={saving}
            >
              复核并保存
            </Btn>
          </div>
        </div>
      ) : null}

      {/* 修改留痕 */}
      <div className="u3-panel mt-3.5" data-testid="rules-versions">
        <div className="u3-panel-head">
          <h3>修改留痕</h3>
          <span className="aside">谁 / 何时 / 前后值（最近 20 条）</span>
        </div>
        {versionsQuery.isPending ? (
          <div className="space-y-2 px-[17px] py-4" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-control bg-canvas" />
            ))}
          </div>
        ) : versionsQuery.isError ? (
          <div className="px-[17px] py-4 text-caption-xs text-danger-deep">
            留痕加载失败：{errMsg(versionsQuery.error)}
            <button
              type="button"
              className="ml-2 font-bold text-ink underline underline-offset-2"
              onClick={() => void versionsQuery.refetch()}
            >
              重试
            </button>
          </div>
        ) : (versionsQuery.data?.versions.length ?? 0) === 0 ? (
          <div className="px-[17px] py-6 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
            暂无修改记录（当前为初始种子版本）
          </div>
        ) : (
          versionsQuery.data!.versions.map((v: VersionRow) => {
            const open = openVersionId === v.id;
            return (
              <div key={v.id} className="border-t border-[rgba(74,59,46,.06)]">
                <button
                  type="button"
                  onClick={() => setOpenVersionId(open ? null : v.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-[17px] py-[13px] text-left transition-colors duration-150 hover:bg-[rgba(74,59,46,.03)]"
                >
                  <Badge tone="brand">v{v.version}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-caption text-ink">
                      {v.changerNickname ?? '店主'} 修改了 {v.changesJson.length} 项参数
                    </div>
                    <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]" style={numStyle}>
                      {fmtDateTime(v.createdAt)}
                    </div>
                  </div>
                  <span className="shrink-0 text-caption-xs font-bold text-[rgba(74,59,46,.62)]">
                    {open ? '收起 ›' : '前后值 ›'}
                  </span>
                </button>
                {open ? (
                  <div className="space-y-2 px-[17px] pb-4 pt-1">
                    {v.changesJson.map((ch) => (
                      <div key={ch.rule_key} className="rounded-control bg-canvas px-3 py-2">
                        <div className="text-caption font-semibold text-ink">
                          {shortLabel(labelByKey.get(ch.rule_key) ?? ch.rule_key)}
                        </div>
                        <ul className="mt-1 space-y-0.5 text-caption-xs text-[rgba(74,59,46,.62)]" style={numStyle}>
                          {ch.before === null ? (
                            <li>新增规则：{fmtValueSummary((ch.after ?? {}) as Record<string, unknown>)}</li>
                          ) : (
                            diffEntries(ch.before, ch.after).map((line, i) => <li key={i}>{line}</li>)
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* 口径小字（V1.3 冻结：不回溯） */}
      <p className="mt-3 px-1 text-caption-xs text-[rgba(74,59,46,.42)]">
        小字口径：规则保存即生效；新规只约束生效后的单，不回溯历史月份与已快照数据。本页仅店主可见可改，每次修改全留痕。
      </p>

      {/* 危险操作 D 套：重确认弹层（变更摘要 + 键入口令） */}
      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
        title="确认保存规则修改"
        widthClass="max-w-xl"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              再想想
            </Btn>
            <Btn
              variant="danger"
              data-testid="rules-confirm-submit"
              onClick={() => void doSave()}
              disabled={saving || confirmText.trim() !== CONFIRM_PHRASE}
            >
              {saving ? '保存中…' : '确认保存并生效'}
            </Btn>
          </>
        }
      >
        <div className="space-y-3" data-testid="rules-confirm-modal">
          <p className="rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep">
            危险操作：保存后立即生效，影响全员提成与 XP 核算。新规只约束生效后的单，不回溯历史月份与已快照数据。
          </p>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.ruleKey} className="rounded-control bg-canvas px-3 py-2">
                <div className="text-caption font-semibold text-ink">{p.short}</div>
                <ul className="mt-1 space-y-0.5 text-caption-xs text-[rgba(74,59,46,.62)]" style={numStyle}>
                  {p.fields.map((f, i) => (
                    <li key={i}>
                      {f.label}：{f.beforeText} → <span className="font-semibold text-ink">{f.afterText}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Field label={`请输入「${CONFIRM_PHRASE}」以继续`} hint="防误触：口令与按钮双重确认">
            <input
              className="w-full rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(74,59,46,.25)]"
              data-testid="rules-confirm-input"
              placeholder={CONFIRM_PHRASE}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={saving}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 页签 + 页内 owner 闸门                                                */
/* ------------------------------------------------------------------ */

function OwnerRulesConfig() {
  const [domain, setDomain] = useState<RulesDomain>('commission');
  return (
    <MainScaffold
      title="规则配置管理"
      sub="提成与 XP 全参数 · 页面可改 · 保存即生效 · 每次修改留痕版本化"
      testid="rules-config-page"
    >
      <ToasterMount />
      <div className="mb-3.5 flex gap-1.5" role="tablist">
        {DOMAIN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={domain === t.key}
            data-testid={`rules-tab-${t.key}`}
            onClick={() => setDomain(t.key)}
            className={`rounded-full px-3.5 py-[7px] text-caption transition-colors ${
              domain === t.key ? 'bg-[#4A3B2E] font-semibold text-[#F6F1E3]' : 'text-[rgba(74,59,46,.6)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <DomainPanel key={domain} domain={domain} />
    </MainScaffold>
  );
}

export default function RulesConfigPage() {
  const role = useMerchantRole();
  if (!role.isOwner) {
    return <RoleGuidePage title="规则配置仅店主可用" hint="提成与 XP 参数的调整入口只对店主开放。" />;
  }
  return <OwnerRulesConfig />;
}
