/**
 * 员工端骨架构件库（员工端骨架整建批 · 片 1）
 * 依据=UX-2026-09-27-两端定稿语言包 V1.1 §二构件册（S1–S8/G1–G2）+§三逐屏骨架；
 * 样式全在 styles/skeleton.css（.sk 作用域）；本文件只负责结构+数据接插。
 * 文案一律走 copy/skeleton.ts 键（凡内容皆留口）；dock 四槽冻结「工位/预约/打卡/我的」。
 */

import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { skc, type SkeletonCopyKey } from '../../copy/skeleton';

/* ---- apphead（serif 屏题+mono 注） ---- */
export function SkAppHead({ title, no }: { title: string; no: string }) {
  return (
    <div className="sk-apphead">
      <span className="tt">{title}</span>
      <span className="no">{no}</span>
    </div>
  );
}

/* ---- S8 backbar（二级页；返回=时间序回退，直访 fallback） ---- */
export function SkBackBar({ title, note, fallback = '/today' }: { title: string; note?: string; fallback?: string }) {
  const navigate = useNavigate();
  const onBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  };
  return (
    <div className="sk-backbar">
      <button type="button" className="bk" aria-label={skc('sk.back')} onClick={onBack}>‹</button>
      <span className="tt">{title}</span>
      {note ? <span className="no">{note}</span> : null}
    </div>
  );
}

/* ---- G2 淡黄主行动钮（每屏至多 1 颗；副行 mono 可空） ---- */
export function SkBtnAction({
  children, sub, onClick, disabled, testId,
}: {
  children: ReactNode; sub?: string; onClick?: () => void; disabled?: boolean; testId?: string;
}) {
  return (
    <button type="button" className="sk-btn-action" onClick={onClick} disabled={disabled} data-testid={testId}>
      {children}
      {sub ? <span className="sub">{sub}</span> : null}
    </button>
  );
}

/* ---- G1 选择片 chips ---- */
export function SkChips<T extends string>({
  options, value, onChange, testId,
}: {
  options: Array<{ key: T; label: string }>; value: T; onChange: (k: T) => void; testId?: string;
}) {
  return (
    <div className="sk-chips" data-testid={testId} role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`sk-chip${value === o.key ? ' on' : ''}`}
          data-testid={`${testId ?? 'sk-chip'}-${o.key}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- S1 平铺 dock（四槽冻结；激活=深棕字+顶淡黄短划；badges=未读徽数（片 3，如「我的」槽）） ---- */
export type SkDockActive = 'work' | 'appt' | 'punch' | 'me';
export function SkDock({ active, badges }: { active: SkDockActive; badges?: Partial<Record<SkDockActive, number>> }) {
  const tabs: Array<{ key: SkDockActive; to: string; label: string; testId: string; icon: ReactNode }> = [
    {
      key: 'work', to: '/today', label: skc('sk.dockWork'), testId: 'dock-work',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>,
    },
    {
      key: 'appt', to: '/schedule', label: skc('sk.dockAppt'), testId: 'dock-appt',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>,
    },
    {
      key: 'punch', to: '/attendance', label: skc('sk.dockPunch'), testId: 'dock-punch',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></svg>,
    },
    {
      key: 'me', to: '/me', label: skc('sk.dockMe'), testId: 'dock-me',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="3.4" /><path d="M5 19c.8-3.4 3.6-5 7-5s6.2 1.6 7 5" /></svg>,
    },
  ];
  return (
    <nav className="sk-dock" data-testid="staff-dock" aria-label="主导航">
      <div className="row">
        {tabs.map((t) => (
          <Link key={t.key} to={t.to} data-testid={t.testId} aria-current={active === t.key ? 'page' : undefined} className={active === t.key ? 'on' : ''}>
            {t.icon}
            {t.label}
            {(badges?.[t.key] ?? 0) > 0 ? (
              <span className="bdg" data-testid={`${t.testId}-badge`} aria-label={`${badges![t.key]} 条未读`}>
                {badges![t.key]! > 99 ? '99+' : badges![t.key]}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ---- S2 工位大卡 ---- */
export interface SkStep {
  key: string;
  name: string;
  state: 'done' | 'now' | 'future';
}
export function SkWorkCard({
  tag, photoUrl, name, sub, steps, countText, cta, onCta, ctaTestId,
}: {
  tag: string;
  photoUrl?: string | null;
  name: string;
  sub: string;
  steps: SkStep[];
  countText: string;
  cta: string;
  onCta?: () => void;
  ctaTestId?: string;
}) {
  return (
    <section className="sk-workcard" data-testid="sk-workcard">
      <div className="wk-tag"><span className="dot" />{tag}</div>
      <div className="wk-main">
        {photoUrl ? (
          <img className="wk-photo" src={photoUrl} alt={name} />
        ) : (
          <span className="wk-photo" aria-hidden>{name.slice(0, 1)}</span>
        )}
        <div>
          <div className="wk-name">{name}</div>
          <div className="wk-sub">{sub}</div>
        </div>
      </div>
      <div className="sk-stepgrid" data-testid="sk-stepgrid">
        {steps.map((s, i) => (
          <div key={s.key} className={`st ${s.state}`} data-testid={`sk-step-${s.key}`}>
            <span className="pt">{s.state === 'done' ? '✓' : i + 1}</span>
            <span className="nm">{s.name}</span>
          </div>
        ))}
      </div>
      <div className="wk-count">{countText}</div>
      <SkBtnAction onClick={onCta} testId={ctaTestId}>{cta}</SkBtnAction>
    </section>
  );
}

/* ---- 下一单 nextrow ---- */
export function SkNextRow({ title, sub, to, testId }: { title: string; sub: string; to?: string; testId?: string }) {
  const inner = (
    <>
      <div>
        <div className="t">{title}</div>
        <div className="s">{sub}</div>
      </div>
      <span className="caret" aria-hidden>›</span>
    </>
  );
  return to ? (
    <Link className="sk-nextrow" to={to} data-testid={testId}>{inner}</Link>
  ) : (
    <div className="sk-nextrow" data-testid={testId} style={{ cursor: 'default' }}>{inner}</div>
  );
}

/* ---- 排队行 que / 今日胶囊 clockrow / 班结行 dayfoot ---- */
export function SkQueRow({ text }: { text: string }) {
  return <div className="sk-que"><span className="qchip">{text}</span></div>;
}
export function SkClockRow({ text }: { text: string }) {
  return <div style={{ padding: '10px 22px 0' }}><span className="sk-clockrow"><span className="pt" />{text}</span></div>;
}
export function SkDayFoot({ text }: { text: string }) {
  return <div className="sk-dayfoot">{text}</div>;
}

/* ---- S5 功能三格 trio（红点 dotr=审批仅店长视界） ---- */
export function SkTrio({ items }: {
  items: Array<{ key: string; title: string; sub: string; to: string; dot?: boolean; testId?: string }>;
}) {
  return (
    <div className="sk-trio">
      {items.map((it) => (
        <Link key={it.key} to={it.to} data-testid={it.testId ?? `sk-trio-${it.key}`}>
          {it.dot ? <span className="dotr" aria-hidden /> : null}
          <span className="t">{it.title}</span>
          <span className="s">{it.sub}</span>
        </Link>
      ))}
    </div>
  );
}

/* ---- S7 清单行 rows/row（to/onClick=链接行/展开行；dot=红点（审批仅店长视界）） ---- */
export function SkRows({ children, testId }: { children: ReactNode; testId?: string }) {
  return <div className="sk-rows" data-testid={testId}>{children}</div>;
}
export function SkRow({ label, value, tone, to, onClick, dot, testId }: {
  label: ReactNode; value: ReactNode; tone?: 'red' | 'mut';
  to?: string; onClick?: () => void; dot?: boolean; testId?: string;
}) {
  const inner = (
    <>
      <span className="lb">
        {dot ? <span aria-hidden style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', marginRight: 6, verticalAlign: 1 }} /> : null}
        {label}
      </span>
      <span className={`vl${tone ? ` ${tone}` : ''}`}>{value}</span>
    </>
  );
  if (to) return <Link className="row" to={to} data-testid={testId} style={{ textDecoration: 'none' }}>{inner}</Link>;
  if (onClick) return <button type="button" className="row" data-testid={testId} onClick={onClick} style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>{inner}</button>;
  return (
    <div className="row" data-testid={testId}>{inner}</div>
  );
}

/* ---- S6 打卡卡 punch ---- */
export function SkPunchCard({
  clock, shiftLine, fence, cta, onCta, ctaDisabled, ctaTestId,
}: {
  clock: string;
  shiftLine: string;
  fence?: { text: string; ok: boolean } | null;
  cta: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
  ctaTestId?: string;
}) {
  return (
    <section className="sk-punch" data-testid="sk-punch">
      <div className="clock sk-mono">{clock}</div>
      <div className="shift">{shiftLine}</div>
      {fence ? <div><span className={`fence ${fence.ok ? 'ok' : 'bad'}`}>{fence.text}</span></div> : null}
      <SkBtnAction onClick={onCta} disabled={ctaDisabled} testId={ctaTestId}>{cta}</SkBtnAction>
    </section>
  );
}

/* ---- S-04 身份卡（字像金边+mono 工号+三格账） ---- */
export function SkIdCard({ name, no, cells, photoUrl }: {
  name: string;
  no: string;
  cells: Array<{ v: string; k: string }>;
  photoUrl?: string | null;
}) {
  return (
    <section className="sk-idcard" data-testid="sk-idcard">
      <div className="id-main">
        {photoUrl ? <img className="av" src={photoUrl} alt={name} /> : <span className="av" aria-hidden>{name.slice(0, 1)}</span>}
        <div>
          <div className="nm">{name}</div>
          <div className="no">{no}</div>
        </div>
      </div>
      <div className="trio">
        {cells.map((c) => (
          <div key={c.k} className="c">
            <div className="v">{c.v}</div>
            <div className="k">{c.k}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- S3 班轴预约卡（含 S4 六步展开） ---- */
export function SkApptCard({
  time, title, sub, stateLabel, state, expanded, onToggle, children, testId,
}: {
  time: string;
  title: ReactNode;
  sub: string;
  stateLabel: string;
  state: 'done' | 'now' | 'future';
  expanded?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="dg">
      <div className="dg-time sk-mono">{time}</div>
      <div className="dg-rail">
        <span className={`dg-node ${state}`} aria-hidden />
        <div className={`sk-appt ${state}`} data-testid={testId}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="t">{title}</div>
              <div className="s">{sub}</div>
            </div>
            <span className={`st2 ${state}`}>{stateLabel}</span>
            {onToggle ? (
              <button type="button" className={`caret${expanded ? ' open' : ''}`} aria-label="展开" aria-expanded={expanded} onClick={onToggle}>›</button>
            ) : null}
          </div>
          {expanded ? children : null}
        </div>
      </div>
    </div>
  );
}

/* ---- S4 操作步（oplist/opstep） ---- */
export function SkOpStep({ name, state, stateText, action, onAction, actionTestId }: {
  name: string;
  state: 'done' | 'now' | 'future';
  stateText: string;
  action?: string;
  onAction?: () => void;
  actionTestId?: string;
}) {
  return (
    <div className={`sk-opstep ${state}`}>
      <span className="pt">{state === 'done' ? '✓' : ''}</span>
      <span className="nm">{name}</span>
      {action && state === 'now' ? (
        <button type="button" className="oact" data-testid={actionTestId} onClick={onAction}>{action}</button>
      ) : (
        <span className="st">{stateText}</span>
      )}
    </div>
  );
}
export function SkOpList({ children }: { children: ReactNode }) {
  return <div className="sk-oplist">{children}</div>;
}

/* ---- 扫码框（深棕框+淡黄角标，9-27 拍） ---- */
export function SkScanFrame({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="sk-scanframe" data-testid={testId}>
      <span className="ck" aria-hidden />
      {children}
    </div>
  );
}

/* ---- 空态/注记 ---- */
export function SkEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="sk-empty">
      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      {body ? <div style={{ fontSize: 11 }}>{body}</div> : null}
    </div>
  );
}
export function SkNote({ children }: { children: ReactNode }) {
  return <p className="sk-note">{children}</p>;
}

export type { SkeletonCopyKey };
