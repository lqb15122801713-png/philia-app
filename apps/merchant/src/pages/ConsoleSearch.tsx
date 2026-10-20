/**
 * 控制台改版批 片 2（产品-1012 · 刀 2）：控制台全局搜索（照 Shopify Cmd+K）
 *
 * - 唤起：MainScaffold actions 槽顶栏搜索钮 + Cmd+K（Mac）/Ctrl+K（Win）全局监听（仅控制台页挂载；
 *   弹层=既有 Modal 族件，Esc 关=Modal 内建）；
 * - 索引=前端内存索引（读端口数据自动生成，零建库零搜索引擎）：端口件 15 卡（consolePortsMeta 单源）
 *   + copy 域键全量（config.list）+ 参数域字典键（config.dictionary）+ 画布 46 屏（canvas.blocks 注册表）
 *   + 素材位（slotPort.list）；首开懒建一次，之后会话内复用；
 * - 命中即跳：端口件→该端口视图 / 端口键→文案端口该键行（initialSearch 预选+行 scrollIntoView）/
 *   画布屏→画布端口该页签（initialPageKey）/ 素材位→槽位端口；
 * - 无命中=人话空态+近义词提示 chips（小静态词族表写死，不上语义模型）；
 * - 性能：索引构建+末次筛选 performance.now() 实测读数页脚透出（闸值 <100ms 照令）。
 * 视觉零改动纪律：全用既有 Modal/Badge/Btn/inputCls 件与既有色板字号。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Modal, inputCls } from '../components/staff-admin/ui';
import { cadm } from '../copy/consoleAdmin';
import { CONSOLE_PORT_META, type ConsolePortKey } from './consolePortsMeta';

/** 命中项（五族：端口件/端口键/参数键/画布屏/素材位） */
interface SearchItem {
  kind: 'port' | 'copyKey' | 'paramKey' | 'screen' | 'slot';
  /** 主行（人话标题/键值文本） */
  title: string;
  /** 副行（键名/屏名/域等定位信息） */
  sub: string;
  /** 跳转载荷 */
  port?: ConsolePortKey;
  copyKey?: string;
  pageKey?: string;
}

/** 近义词族（写死小表=空态提示+查询扩词；高频经营词） */
const SYNONYMS: Record<string, string[]> = {
  提成: ['提成', 'commission', '佣金', '分成'],
  回馈金: ['回馈金', 'rebate', '返利'],
  押金: ['押金', 'deposit'],
  会员: ['会员', 'member', '档', '权益'],
  文案: ['文案', 'copy', '文字', '话术', '提示语'],
  画布: ['画布', 'canvas', '装修', '排版', '区块', '页面'],
  素材: ['素材', 'slot', '图片', '顶图'],
  支付: ['支付', 'pay', '通道', '收银', '收款'],
  券: ['券', 'coupon', '优惠'],
  退款: ['退款', 'refund', '售后'],
  门店: ['门店', 'store', '档案', '分店'],
  员工: ['员工', 'staff', '洗护师', '提成'],
  预约: ['预约', 'booking', '洗护', '寄养'],
};

/** 索引构建（首开懒建一次；全量读口既有件） */
function useSearchIndex(open: boolean) {
  const { trpc } = usePhiliaClient();
  const copyQ = useQuery({
    queryKey: ['config', 'list', 'copy'],
    queryFn: () => trpc.config.list.query({ domain: 'copy' }),
    enabled: open,
    staleTime: 300_000,
  });
  const dictQ = useQuery({
    queryKey: ['config', 'dictionary', 'all'],
    queryFn: () => trpc.config.dictionary.query({}),
    enabled: open,
    staleTime: 300_000,
  });
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    enabled: open,
    staleTime: 300_000,
  });
  const slotsQ = useQuery({
    queryKey: ['slotPort', 'list'],
    queryFn: () => trpc.slotPort.list.query(),
    enabled: open,
    staleTime: 300_000,
  });

  return useMemo(() => {
    if (!copyQ.data || !dictQ.data || !blocksQ.data || !slotsQ.data) return null;
    const t0 = performance.now();
    const items: SearchItem[] = [];
    /* 端口件 15 卡（consolePortsMeta 单源） */
    for (const p of CONSOLE_PORT_META) {
      items.push({ kind: 'port', title: cadm(p.titleKey), sub: `${cadm(p.hintKey)} · 端口 ${p.port}`, port: p.port });
    }
    /* copy 域键全量（4171+ 键；title=当前文案值，sub=键名+屏名） */
    for (const r of copyQ.data.rules) {
      if (!r.active) continue;
      const text = typeof (r.valueJson as Record<string, unknown>).text === 'string' ? ((r.valueJson as Record<string, unknown>).text as string) : '';
      items.push({ kind: 'copyKey', title: text || r.ruleKey, sub: `${r.ruleKey}${r.screen ? ` · ${r.screen}` : ''}`, copyKey: r.ruleKey, port: 'copy' });
    }
    /* 参数域字典键（config.dictionary；label=中文名） */
    for (const it of dictQ.data.items) {
      items.push({ kind: 'paramKey', title: it.label || it.ruleKey, sub: `${it.ruleKey} · 参数域 ${it.domain}`, copyKey: it.ruleKey, port: 'dict' });
    }
    /* 画布 46 屏（注册表块 label 前缀=屏名；同屏去重） */
    const screenMap = new Map<string, { label: string; n: number }>();
    for (const b of blocksQ.data.items) {
      const label = b.label.includes('·') ? b.label.slice(0, b.label.indexOf('·')) : b.label;
      const cur = screenMap.get(b.pageKey);
      if (cur) cur.n += 1;
      else screenMap.set(b.pageKey, { label, n: 1 });
    }
    for (const [pageKey, s] of screenMap) {
      items.push({ kind: 'screen', title: s.label, sub: `画布屏 · ${pageKey} · ${s.n} 块`, pageKey, port: 'canvas' });
    }
    /* 素材位（slotPort.list 槽位键+线上 alt） */
    for (const s of slotsQ.data.slots) {
      items.push({ kind: 'slot', title: s.live?.contentJson?.alt ?? s.slotKey, sub: `素材位 · ${s.slotKey}`, port: 'slots' });
    }
    return { items, buildMs: performance.now() - t0, total: items.length };
  }, [copyQ.data, dictQ.data, blocksQ.data, slotsQ.data]);
}

/** 匹配打分（键名精确 > 标题含 > 副行含 > 近义扩词含；零分淘汰） */
function scoreItem(it: SearchItem, terms: string[]): number {
  const title = it.title.toLowerCase();
  const sub = it.sub.toLowerCase();
  let best = 0;
  for (const t of terms) {
    if (t === '') continue;
    let s = 0;
    if (it.copyKey === t || it.pageKey === t || it.port === t) s = 100;
    else if (title === t) s = 90;
    else if (title.includes(t)) s = 60;
    else if (sub.includes(t)) s = 30;
    if (s > best) best = s;
  }
  return best;
}

export interface ConsoleSearchProps {
  /** 命中跳转回调（宿主页 ConsolePage 注口） */
  onPickPort: (port: ConsolePortKey) => void;
  onPickCopyKey: (key: string) => void;
  onPickScreen: (pageKey: string) => void;
  onPickSlots: () => void;
  /** 直达真页（会员营销卡等） */
  onNavigate: (to: string) => void;
}

/** 顶栏搜索钮+弹层一体件（ConsolePage actions 槽挂载；Cmd+K 监听内挂） */
export function ConsoleSearch({ onPickPort, onPickCopyKey, onPickScreen, onPickSlots, onNavigate }: ConsoleSearchProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useSearchIndex(open);
  const [lastMs, setLastMs] = useState<number | null>(null);

  /* Cmd+K（Mac）/Ctrl+K（Win）唤起（仅控制台页=本件挂载处生效） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* 弹层开=输入框聚焦 */
  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!index) return { groups: [] as Array<{ kind: SearchItem['kind']; items: SearchItem[] }>, ms: 0 };
    const t0 = performance.now();
    const query = q.trim().toLowerCase();
    if (query === '') return { groups: [], ms: 0 };
    const terms = [query, ...(SYNONYMS[q.trim()] ?? []).map((s) => s.toLowerCase())];
    const scored = index.items
      .map((it) => ({ it, s: scoreItem(it, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    const top = scored.slice(0, 30).map((x) => x.it);
    const kindOrder: SearchItem['kind'][] = ['port', 'screen', 'slot', 'paramKey', 'copyKey'];
    const groups = kindOrder
      .map((kind) => ({ kind, items: top.filter((it) => it.kind === kind).slice(0, kind === 'copyKey' ? 12 : 6) }))
      .filter((g) => g.items.length > 0);
    return { groups, ms: performance.now() - t0 };
  }, [index, q]);

  useEffect(() => {
    if (q.trim() !== '') setLastMs(results.ms);
  }, [q, results.ms]);

  const pick = (it: SearchItem) => {
    setOpen(false);
    if (it.kind === 'port' && it.port) {
      /* 直达真页卡（会员营销等 to 口）=跳真页，不进端口视图 */
      const to = CONSOLE_PORT_META.find((p) => p.port === it.port)?.to;
      if (to) onNavigate(to);
      else onPickPort(it.port);
    }
    else if (it.kind === 'screen' && it.pageKey) onPickScreen(it.pageKey);
    else if (it.kind === 'slot') onPickSlots();
    else if (it.kind === 'copyKey' && it.copyKey) onPickCopyKey(it.copyKey);
    else if (it.kind === 'paramKey') onPickPort('dict');
  };

  const KIND_LABEL: Record<SearchItem['kind'], string> = {
    port: cadm('cadm.searchGroupPort'),
    copyKey: cadm('cadm.searchGroupKey'),
    paramKey: cadm('cadm.searchGroupParam'),
    screen: cadm('cadm.searchGroupScreen'),
    slot: cadm('cadm.searchGroupSlot'),
  };

  return (
    <>
      {/* 顶栏触发钮（MainScaffold actions 槽；视觉=既有点缀件） */}
      <button
        type="button"
        data-testid="console-search-open"
        onClick={() => setOpen(true)}
        className="u1-ring flex items-center gap-2 rounded-input bg-card px-3 py-[7px] text-caption-xs text-[rgba(44,40,34,.42)] transition-colors hover:bg-canvas"
      >
        <span>{cadm('cadm.searchCta')}</span>
        <kbd className="rounded-chip bg-canvas px-1.5 py-0.5 font-number text-[12px] text-[rgba(44,40,34,.42)]">⌘K</kbd>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={cadm('cadm.searchTitle')}
        footer={
          <span className="text-caption-xs text-[rgba(44,40,34,.42)]" data-testid="console-search-perf">
            {index
              ? cadm('cadm.searchPerf', {
                  total: index.total,
                  buildMs: index.buildMs.toFixed(1),
                  ms: (lastMs ?? 0).toFixed(1),
                })
              : cadm('cadm.searchIndexing')}
          </span>
        }
      >
        <div data-testid="console-search-modal">
          <input
            ref={inputRef}
            className={inputCls}
            data-testid="console-search-input"
            placeholder={cadm('cadm.searchPlaceholder')}
            value={q}
            maxLength={64}
            onChange={(e) => setQ(e.target.value)}
          />
          <p className="mt-1.5 text-caption-xs text-[rgba(44,40,34,.42)]">{cadm('cadm.searchHint')}</p>

          <div className="mt-3 max-h-[420px] overflow-y-auto">
            {q.trim() !== '' && index && results.groups.length === 0 ? (
              /* 无命中=人话空态+近义词提示 chips */
              <div className="py-4 text-center" data-testid="console-search-empty">
                <p className="text-body-sm text-ink-secondary">{cadm('cadm.searchEmpty', { q: q.trim() })}</p>
                <p className="mt-2 text-caption-xs text-[rgba(44,40,34,.42)]">{cadm('cadm.searchEmptyTry')}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {['提成', '回馈金', '押金', '文案', '画布'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      data-testid={`console-search-try-${w}`}
                      className="rounded-full bg-canvas px-3 py-1 text-caption-xs text-[rgba(44,40,34,.62)]"
                      onClick={() => setQ(w)}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {results.groups.map((g) => (
              <div key={g.kind} className="mb-3">
                <div className="mb-1 text-caption-xs font-semibold text-[rgba(44,40,34,.42)]">{KIND_LABEL[g.kind]}</div>
                {g.items.map((it, i) => (
                  <button
                    key={`${it.kind}-${it.copyKey ?? it.pageKey ?? it.port ?? i}`}
                    type="button"
                    data-testid={`console-search-hit-${it.copyKey ?? it.pageKey ?? it.port ?? i}`}
                    className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors hover:bg-canvas"
                    onClick={() => pick(it)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold text-ink">{it.title}</span>
                      <span className="block truncate text-caption-xs text-[rgba(44,40,34,.42)]">{it.sub}</span>
                    </span>
                    <Badge tone="muted">{KIND_LABEL[it.kind]}</Badge>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
