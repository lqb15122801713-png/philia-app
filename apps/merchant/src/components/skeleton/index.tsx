/**
 * 商家端骨架构件库（商家端控制台骨架批 · 片 5 段 0 · 地基段）
 * 依据=UX-02 两端定稿语言包 V1.1 §二构件册（M1–M8/G1–G2）+§四 W-00~W-16 逐屏骨架；
 * 样式全在 styles/console.css（.wsk 作用域，页根挂）；本文件只负责结构+数据接插。
 * 文案一律走 copy/console.ts 键（cc()；凡内容皆留口）。
 * 工艺照员工端 skeleton/index.tsx：props 传数据、testId 留锚、空态明面。
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cc, type ConsoleCopyKey } from '../../copy/console';

/* ---- wtop 页头条（标题+mono 注+右槽动作区；W-02/W-08/W-10/W-12/W-14 同件） ---- */
export function WTop({ title, note, actions, testId }: {
  title: string; note?: string; actions?: ReactNode; testId?: string;
}) {
  return (
    <div className="wsk-top" data-testid={testId}>
      <div>
        <div className="tt">{title}</div>
        {note ? <div className="no">{note}</div> : null}
      </div>
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  );
}

/* ---- M2 异常前置卡（永远第一屏第一位；赭红系+计数+跳转位） ---- */
export interface WAlertItem {
  key: string;
  text: string;
  count?: number;
  to?: string;
  onClick?: () => void;
}
export function WAlert({ items, testId }: { items: WAlertItem[]; testId?: string }) {
  return (
    <section className="wsk-alert" data-testid={testId ?? 'wsk-alert'}>
      {items.length === 0 ? <div className="empty">{cc('wsk.alertEmpty')}</div> : null}
      {items.map((it) => (
        <div className="row" key={it.key} data-testid={`wsk-alert-${it.key}`}>
          <span>{it.text}</span>
          {typeof it.count === 'number' ? <span className="n">{it.count}</span> : null}
          {it.to ? <Link className="go" to={it.to}>{cc('wsk.alertGo')}</Link> : null}
          {!it.to && it.onClick ? (
            <button type="button" className="go" onClick={it.onClick}>{cc('wsk.alertGo')}</button>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/* ---- M4 深棕合计条（大数字+竖分隔+tb-cell 分列+14 日 spark 槽） ---- */
export function WTotal({ value, cap, cells, spark, testId }: {
  value: string;
  cap?: string;
  cells?: Array<{ k: string; v: string }>;
  spark?: ReactNode;
  testId?: string;
}) {
  return (
    <section className="wsk-total" data-testid={testId ?? 'wsk-total'}>
      <div>
        {cap ? <div className="cap">{cap}</div> : null}
        <div className="big">{value}</div>
      </div>
      {cells && cells.length > 0 ? (
        <>
          <span className="sep" aria-hidden />
          <div className="cells">
            {cells.map((c) => (
              <div className="cell" key={c.k}>
                <div className="k">{c.k}</div>
                <div className="v">{c.v}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {spark ? (
        <div className="spark" data-testid="wsk-total-spark">
          <span className="lb">{cc('wsk.totalSpark')}</span>
          {spark}
        </div>
      ) : null}
    </section>
  );
}

/* ---- M6 晨报卡（eyebrow+serif 题+大数字+cr 行+serif 引言+下划线链） ---- */
export function WPostcard({ eyebrow, figure, figureCap, rows, quote, moreTo, onMore, testId }: {
  eyebrow?: string;
  figure: string;
  figureCap?: string;
  rows?: Array<{ key: string; label: string; value: string; tone?: 'red' }>;
  quote?: string;
  moreTo?: string;
  onMore?: () => void;
  testId?: string;
}) {
  return (
    <section className="wsk-postcard" data-testid={testId ?? 'wsk-postcard'}>
      <div className="eb">{eyebrow ?? cc('wsk.postcardEyebrow')}</div>
      <div className="tt">{cc('wsk.postcardTitle')}</div>
      <div className="rules" aria-hidden />
      <div className="fig">{figure}</div>
      {figureCap ? <div className="figcap">{figureCap}</div> : null}
      {rows && rows.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          {rows.map((r) => (
            <div className="cr" key={r.key}>
              <span>{r.label}</span>
              <span className={`v${r.tone === 'red' ? ' red' : ''}`}>{r.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {quote ? <div className="quote">{quote}</div> : null}
      {moreTo ? <div className="more"><Link className="wsk-go" to={moreTo}>{cc('wsk.postcardMore')}</Link></div> : null}
      {!moreTo && onMore ? (
        <div className="more"><button type="button" className="wsk-go" onClick={onMore}>{cc('wsk.postcardMore')}</button></div>
      ) : null}
    </section>
  );
}

/* ---- M7 账目件 wfolio（行式 mono 金额列；折扣红字/合计 17 深棕；储值单列不混列由调用方分行保证） ---- */
export function WFolio({ rows, testId }: {
  rows: Array<{ key: string; label: ReactNode; value: string; tone?: 'red' | 'mut' | 'total' }>;
  testId?: string;
}) {
  return (
    <section className="wsk-folio" data-testid={testId ?? 'wsk-folio'}>
      {rows.map((r) => (
        <div className={`row${r.tone === 'total' ? ' total' : ''}`} key={r.key}>
          <span>{r.label}</span>
          <span className={`v${r.tone === 'red' ? ' red' : r.tone === 'mut' ? ' mut' : ''}`}>{r.value}</span>
        </div>
      ))}
    </section>
  );
}

/* ---- wlist 行（今日预约/审批/报表目录通用；dot=赭红异常点） ---- */
export function WList({ items, emptyText, testId }: {
  items: Array<{ key: string; title: string; sub?: string; to?: string; onClick?: () => void; dot?: boolean }>;
  /** 域空态文案（不传=通用「暂无内容」） */
  emptyText?: string;
  testId?: string;
}) {
  return (
    <section className="wsk-list" data-testid={testId ?? 'wsk-list'}>
      {items.length === 0 ? <div className="wsk-empty">{emptyText ?? cc('wsk.empty')}</div> : null}
      {items.map((it) => {
        const inner = (
          <>
            {it.dot ? <span className="dotr" aria-hidden /> : null}
            <span>
              <span className="t">{it.title}</span>
              {it.sub ? <span className="s" style={{ display: 'block' }}>{it.sub}</span> : null}
            </span>
            <span className="caret" aria-hidden>›</span>
          </>
        );
        return it.to ? (
          <Link className="it" key={it.key} to={it.to} data-testid={`wsk-list-${it.key}`}>{inner}</Link>
        ) : (
          <button type="button" className="it" key={it.key} onClick={it.onClick} data-testid={`wsk-list-${it.key}`}>{inner}</button>
        );
      })}
    </section>
  );
}

/* ---- pill2 双态胶囊（hot 深棕底淡金字 / gold 淡黄底 / red 赭红边 / plain 描边） ---- */
export function WPill({ tone = 'plain', children, testId }: {
  tone?: 'hot' | 'gold' | 'red' | 'plain'; children: ReactNode; testId?: string;
}) {
  return <span className={`wsk-pill ${tone}`} data-testid={testId}>{children}</span>;
}

/* ---- M7 容量日历骨架（月格 7 列+容量点；full=赭红+「满」签） ---- */
export type WCapCalDay = {
  day: number | null; // null=月外补位格
  state?: 'ok' | 'tight' | 'full' | 'off';
};
export function WCapCal({ monthLabel, weekdays, days, testId }: {
  monthLabel: string;
  weekdays: string[];
  days: WCapCalDay[];
  testId?: string;
}) {
  return (
    <section className="wsk-capcal" data-testid={testId ?? 'wsk-capcal'}>
      <div className="hd">
        <span className="m">{monthLabel}</span>
        <span className="lg">{cc('wsk.capCalLegend')}</span>
      </div>
      <div className="grid" style={{ marginBottom: 4 }}>
        {weekdays.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontFamily: 'var(--wsk-mono)', fontSize: 8.5, color: 'var(--wsk-muted)' }}>{w}</div>
        ))}
      </div>
      <div className="grid">
        {days.map((d, i) => (
          <div key={i} className={`d${d.day === null || d.state === 'off' ? ' off' : ''}${d.state === 'tight' ? ' tight' : ''}${d.state === 'full' ? ' full' : ''}`}>
            {d.day ?? ''}
            {d.day !== null && d.state ? (
              <>
                <span className="pt" aria-hidden />
                {d.state === 'full' ? <span className="ful">{cc('wsk.capCalFull')}</span> : null}
              </>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- stepdots 六段步进（W-04 监控 Hub 单卡；S-02 同件转译：done 深棕/active 淡黄/todo 卡其描边） ---- */
export type WStepDotState = 'done' | 'active' | 'todo';
export function WStepDots({ states, testId }: { states: WStepDotState[]; testId?: string }) {
  return (
    <div className="wsk-stepdots" data-testid={testId ?? 'wsk-stepdots'} aria-hidden>
      {states.map((s, i) => (
        <i key={i} className={s} />
      ))}
    </div>
  );
}

/* ---- fdot 状态流（W-03 预约详情右栏：竖向节点 done 深棕/now 淡黄/todo 描边+mono 时间小字） ---- */
export type WFlowNode = { key: string; label: string; state: 'done' | 'now' | 'todo'; hint?: string };
export function WFlowDots({ nodes, testId }: { nodes: WFlowNode[]; testId?: string }) {
  return (
    <div className="wsk-fdot" data-testid={testId ?? 'wsk-fdot'}>
      {nodes.map((n) => (
        <div className={`nd ${n.state}`} key={n.key} data-testid={`wsk-fdot-${n.key}`}>
          <i className="dt" aria-hidden />
          <div className="tx">
            <b>{n.label}</b>
            {n.hint ? <small>{n.hint}</small> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- 红线明面带（W-06 注记四句默认；钉在收款面板下） ---- */
export function WRedline({ items, testId }: { items?: string[]; testId?: string }) {
  const list = items ?? [cc('wsk.redline1'), cc('wsk.redline2'), cc('wsk.redline3'), cc('wsk.redline4')];
  return (
    <div className="wsk-redline" data-testid={testId ?? 'wsk-redline'}>
      <span className="tt">{cc('wsk.redlineTitle')}</span>
      {list.map((t) => <span className="it" key={t}>{t}</span>)}
    </div>
  );
}

/* ---- 权限矩阵（角色×权限 四态格 ✓/—/只读/锁死；锁死区任何端不可改） ---- */
export type WMatrixCell = 'ok' | 'no' | 'readonly' | 'locked';
export function WMatrix({ roles, rows, testId }: {
  roles: string[];
  rows: Array<{ key: string; label: string; cells: WMatrixCell[] }>;
  testId?: string;
}) {
  const cellText: Record<WMatrixCell, string> = {
    ok: cc('wsk.matrixOk'),
    no: cc('wsk.matrixNo'),
    readonly: cc('wsk.matrixReadonly'),
    locked: cc('wsk.matrixLocked'),
  };
  return (
    <section className="wsk-matrix" data-testid={testId ?? 'wsk-matrix'}>
      <table>
        <thead>
          <tr>
            <th />
            {roles.map((r) => <th key={r}>{r}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              {row.cells.map((c, i) => (
                <td key={i}><span className={`mx ${c}`}>{cellText[c]}</span></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ---- M8 wc-ports 左端口目录（252 宽；域章 22 方+mono 行；激活=金左条） ---- */
export function WcPorts({ groups, active, onSelect, testId }: {
  groups: Array<{
    key: string;
    label: string;
    items: Array<{ key: string; label: string; seal: string; note?: string; to?: string }>;
  }>;
  active?: string;
  onSelect?: (key: string) => void;
  testId?: string;
}) {
  return (
    <nav className="wsk-cports" data-testid={testId ?? 'wsk-cports'} aria-label="端口目录">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="gp">{g.label}</div>
          {g.items.map((it) => {
            const cls = `it${active === it.key ? ' on' : ''}`;
            const inner = (
              <>
                <span className="seal" aria-hidden>{it.seal}</span>
                {it.label}
                {it.note ? <span className="no">{it.note}</span> : null}
              </>
            );
            return it.to ? (
              <Link key={it.key} className={cls} to={it.to} data-testid={`wsk-cports-${it.key}`}>{inner}</Link>
            ) : (
              <button key={it.key} type="button" className={cls} onClick={() => onSelect?.(it.key)} data-testid={`wsk-cports-${it.key}`}>{inner}</button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/* ---- M8 wc-pub 发布流（草稿→预览→发布推三端；当前=淡黄/已过=深棕；回滚虚线条） ---- */
export type WcPubStage = 'draft' | 'preview' | 'published';
export function WcPub({ stage, onRollback, rollbackDisabled, testId }: {
  stage: WcPubStage;
  onRollback?: () => void;
  rollbackDisabled?: boolean;
  testId?: string;
}) {
  const order: WcPubStage[] = ['draft', 'preview', 'published'];
  const labels: Record<WcPubStage, string> = {
    draft: cc('wsk.pubDraft'),
    preview: cc('wsk.pubPreview'),
    published: cc('wsk.pubPush'),
  };
  const nowIdx = order.indexOf(stage);
  return (
    <div className="wsk-cpub" data-testid={testId ?? 'wsk-cpub'}>
      {order.map((s, i) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {i > 0 ? <span className="ar" aria-hidden>→</span> : null}
          <span className={`st${i < nowIdx ? ' done' : i === nowIdx ? ' now' : ''}`}>{labels[s]}</span>
        </span>
      ))}
      {onRollback ? (
        <button type="button" className="rb" onClick={onRollback} disabled={rollbackDisabled} data-testid="wsk-cpub-rollback">
          {cc('wsk.pubRollback')}
        </button>
      ) : null}
    </div>
  );
}

/* ---- M8 wc-log 留痕行 ---- */
export function WcLog({ entries, testId }: {
  entries: Array<{ key: string; text: string; meta?: string }>;
  testId?: string;
}) {
  return (
    <section className="wsk-clog" data-testid={testId ?? 'wsk-clog'}>
      {entries.length === 0 ? <div className="empty">{cc('wsk.logEmpty')}</div> : null}
      {entries.map((e) => (
        <div className="row" key={e.key}>
          <span>{e.text}</span>
          {e.meta ? <span className="meta">{e.meta}</span> : null}
        </div>
      ))}
    </section>
  );
}

/* ---- M8 危险区（暖底+赭红题带） ---- */
export function WDanger({ title, children, testId }: {
  title?: string; children: ReactNode; testId?: string;
}) {
  return (
    <section className="wsk-danger" data-testid={testId ?? 'wsk-danger'}>
      <div className="hd">{title ?? cc('wsk.dangerTitle')}</div>
      <div className="bd">{children}</div>
    </section>
  );
}

export type { ConsoleCopyKey };
