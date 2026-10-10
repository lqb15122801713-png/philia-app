/**
 * 画布端口内核（端口批收尾片 3 · B 股 · ConsolePage F1 直嵌件）。
 *
 * 三屏页签（home 客户端首页 / memberCenter 会员中心 / cashierMarketing 收银营销位），左右分栏：
 * - 左栏 canvas-block-list：当前编辑布局（canvas.getLayout 的 editing；无则注册表默认序）
 *   块行=手写 pointer 拖拽柄（pointerdown 记起点→pointermove 按行高算目标位→pointerup 提交
 *   重排，零 dnd 库）+块 label+显隐 Switch+注册表 copyKeys 行内文案编辑（config.save copy 域；
 *   高危键走口令复核弹层=CopyConfigPage 工艺简化版；成功后 postMessage 预览 patch）+
 *   槽位块「当前素材」缩图（slotContentOf live 值）+「去槽位端口更换」link；
 * - 右栏 canvas-preview：iframe 真页预览（?canvasPreview=1 激活探针；URL 推导=纯函数件
 *   canvasPreviewUrl.ts[会员链路片 4 D 股死链修复：生产单域路径分端分支]，三轨=路径分端
 *   /dev 双轨/Host 前缀）+key={reloadKey} 控制刷新；
 * - philia-canvas-pick 点选反查 → 块行高亮滚动（canvas-picked-${blockKey} 类）+copy input 聚焦；
 * - 拖拽/显隐本地变更即 postMessage philia-canvas-layout（预览即变不刷新）；
 * - 「保存草稿」canvas.saveLayout /「发布」canvas.publishLayout（确认弹层，发布即 reloadKey
 *   bump=客户端生效实证）/版本时间轴 +「回退上一版」canvas.revertLayout（server 只支持回
 *   上一版——逐版「回到此版」无口，报备）；红线条=注册表写死白名单，自由排版不做。
 */

import { Skeleton, usePhiliaClient, type PhiliaClient, slotContentOf, resolveSlotUrl } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, Field, inputCls, Modal, numStyle, Switch, toast, ToasterMount } from '../components/staff-admin/ui';
import { cv } from '../copy/canvas';
import { canvasPreviewUrl, parsePreviewPortMap } from './canvasPreviewUrl';
import { PERK_WALL_ITEMS, PerkIcon, PERK_ICON_SET, resolvePerkWallCells, type CanvasBlockSpec, type CanvasPageKey, type PerkWallCellSpec } from '@philia/shared';

type Trpc = PhiliaClient['trpc'];
type BlocksOut = Awaited<ReturnType<Trpc['canvas']['blocks']['query']>>;
type RegistryBlock = BlocksOut['items'][number];
type LayoutOut = Awaited<ReturnType<Trpc['canvas']['getLayout']['query']>>;
type LayoutVersion = LayoutOut['versions'][number];
type CopyRow = Awaited<ReturnType<Trpc['config']['list']['query']>>['rules'][number];

const PAGE_TABS: Array<{ key: CanvasPageKey; label: string }> = [
  { key: 'home', label: cv('canvas.tabHome') },
  { key: 'memberCenter', label: cv('canvas.tabMemberCenter') },
  { key: 'cashierMarketing', label: cv('canvas.tabCashierMarketing') },
];

/**
 * 预览 iframe URL（选型报备）：推导内核=纯函数 ./canvasPreviewUrl.ts（片 4 D 股抽出可测件；
 * 四轨=单域路径分端[片 4]/端口分端[急修 1008=生产真拓扑]/dev 截图双轨[既有]/Host 前缀[保留]），
 * 本壳只注入 window.location + import.meta.env.DEV + 端口映射表（copy 端口键
 * canvas.previewPortMap，改拓扑零代码）。
 */
function previewUrl(pageKey: CanvasPageKey, storeId: string | null, portMap?: Record<string, string>): string {
  return canvasPreviewUrl(pageKey, storeId, window.location, import.meta.env.DEV, portMap);
}

const STATUS_LABEL: Record<string, string> = {
  draft: cv('canvas.statusDraft'),
  published: cv('canvas.statusPublished'),
  archived: cv('canvas.statusArchived'),
};

export function CanvasPortBody() {
  const { trpc, queryClient } = usePhiliaClient();

  /* ---------------- 数据源 ---------------- */
  const meQ = useQuery({ queryKey: ['auth', 'me', 'full'], queryFn: () => trpc.auth.me.query() });
  const storeId = meQ.data?.store?.id ?? null;
  const [pageKey, setPageKey] = useState<CanvasPageKey>('home');

  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registry = useMemo(
    () => (blocksQ.data?.items ?? []).filter((b) => b.pageKey === pageKey).sort((a, b) => a.sortOrder - b.sortOrder),
    [blocksQ.data, pageKey],
  );
  const registryByKey = useMemo(() => new Map(registry.map((b) => [b.blockKey, b])), [registry]);

  const layoutQ = useQuery({
    queryKey: ['canvas', 'getLayout', pageKey],
    queryFn: () => trpc.canvas.getLayout.query({ pageKey }),
  });

  /* copy 域现值图（画布文案编辑初值+高危标；config.list copy 全量一拉） */
  const copyQ = useQuery({
    queryKey: ['config', 'list', 'copy'],
    queryFn: () => trpc.config.list.query({ domain: 'copy' }),
    staleTime: 60_000,
  });
  const copyByKey = useMemo(() => {
    const m = new Map<string, { text: string; highRisk: boolean }>();
    for (const r of (copyQ.data?.rules ?? []) as CopyRow[]) {
      if (!r.active) continue;
      m.set(r.ruleKey, {
        text: typeof (r.valueJson as Record<string, unknown>).text === 'string' ? ((r.valueJson as Record<string, unknown>).text as string) : '',
        highRisk: r.highRisk === true,
      });
    }
    return m;
  }, [copyQ.data]);

  /* ---------------- 编辑态（布局/文案草稿；数据源身份变化=页签切换/保存后 整体重置） ---------------- */
  const [editBlocks, setEditBlocks] = useState<CanvasBlockSpec[]>([]);
  const [editSource, setEditSource] = useState<unknown>(null);
  const editingLayout = layoutQ.data?.editing ?? null;
  /** 基准布局（editing=草稿优先/线上顶替 + 注册表默认序尾补；脏判定与重置共用） */
  const baseBlocks = useMemo(() => {
    const fromLayout = (editingLayout?.blocksJson ?? []) as CanvasBlockSpec[];
    const seen = new Set(fromLayout.map((b) => b.blockKey));
    return [
      ...fromLayout.map((b) => ({ blockKey: b.blockKey, visible: b.visible !== false })),
      ...registry.filter((r) => !seen.has(r.blockKey)).map((r) => ({ blockKey: r.blockKey, visible: true })),
    ];
  }, [editingLayout, registry]);
  if (layoutQ.data && layoutQ.data !== editSource && registry.length > 0) {
    setEditSource(layoutQ.data);
    setEditBlocks(baseBlocks);
  }
  const dirty = useMemo(
    () => editBlocks.length > 0 && JSON.stringify(editBlocks) !== JSON.stringify(baseBlocks),
    [editBlocks, baseBlocks],
  );
  const dirtyCount = useMemo(() => {
    if (!dirty) return 0;
    let n = 0;
    for (let i = 0; i < Math.max(editBlocks.length, baseBlocks.length); i++) {
      const a = editBlocks[i];
      const b = baseBlocks[i];
      if (!a || !b || a.blockKey !== b.blockKey || a.visible !== b.visible) n++;
    }
    return n;
  }, [dirty, editBlocks, baseBlocks]);

  const markDirty = (next: CanvasBlockSpec[]) => {
    setEditBlocks(next);
    postLayout(next);
  };

  /* ---------------- 预览 iframe + 实时 patch ---------------- */
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const postLayout = (blocks: CanvasBlockSpec[]) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'philia-canvas-layout', pageKey, blocks }, '*');
  };
  const postCopy = (key: string, text: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'philia-canvas-copy', key, text }, '*');
  };

  /* ---------------- 点选反查（philia-canvas-pick → 块行高亮滚动+copy input 聚焦） ---------------- */
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const copyInputRefs = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => {
    const h = (e: MessageEvent) => {
      const d = e.data as { type?: string; copyKey?: string | null; blockKey?: string | null } | null;
      if (!d || d.type !== 'philia-canvas-pick') return;
      if (d.blockKey) {
        setPickedKey(d.blockKey);
        rowRefs.current.get(d.blockKey)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      if (d.copyKey) copyInputRefs.current.get(d.copyKey)?.focus();
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  /* ---------------- 手写 pointer 拖拽（零 dnd 库：down 记起点→move 按行高算位→up 提交） ---------------- */
  const dragRef = useRef<{ from: number; startY: number; rowH: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const onDragStart = (idx: number) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    const row = (e.currentTarget as HTMLElement).closest('[data-canvas-row]') as HTMLElement | null;
    const rowH = row?.getBoundingClientRect().height ?? 64;
    dragRef.current = { from: idx, startY: e.clientY, rowH: Math.max(rowH, 32) };
    setDragFrom(idx);
    setDragOver(idx);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = Math.round((e.clientY - d.startY) / d.rowH);
    setDragOver(Math.min(editBlocks.length - 1, Math.max(0, d.from + delta)));
  };
  const onDragEnd = () => {
    const d = dragRef.current;
    if (d && dragOver !== null && dragOver !== d.from) {
      const next = [...editBlocks];
      const [moved] = next.splice(d.from, 1);
      next.splice(dragOver, 0, moved!);
      markDirty(next);
    }
    dragRef.current = null;
    setDragFrom(null);
    setDragOver(null);
  };

  /* ---------------- 显隐开关 ---------------- */
  const toggleVisible = (blockKey: string, visible: boolean) => {
    markDirty(editBlocks.map((b) => (b.blockKey === blockKey ? { ...b, visible } : b)));
  };

  /* ---------------- 文案编辑（config.save copy 域；高危键口令复核弹层=CopyConfigPage 简化版） ---------------- */
  const [copyDrafts, setCopyDrafts] = useState<Record<string, string>>({});
  const [copyBusy, setCopyBusy] = useState<string | null>(null);
  const [riskAsk, setRiskAsk] = useState<{ copyKey: string; text: string } | null>(null);
  const [riskPhrase, setRiskPhrase] = useState('');

  const doCopySave = async (copyKey: string, text: string) => {
    setCopyBusy(copyKey);
    try {
      await trpc.config.save.mutate({
        domain: 'copy',
        changes: [{ ruleKey: copyKey, valueJson: { text } }],
        confirmedHighRisk: copyByKey.get(copyKey)?.highRisk ? [copyKey] : [],
      });
      toast(cv('canvas.copySaved'));
      postCopy(copyKey, text);
      setCopyDrafts((prev) => {
        const next = { ...prev };
        delete next[copyKey];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['config', 'list', 'copy'] });
      await queryClient.invalidateQueries({ queryKey: ['copyOverrides'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setCopyBusy(null);
      setRiskAsk(null);
      setRiskPhrase('');
    }
  };

  const copySave = (copyKey: string) => {
    const text = (copyDrafts[copyKey] ?? copyByKey.get(copyKey)?.text ?? '').trim();
    if (text === '') return;
    if (copyByKey.get(copyKey)?.highRisk) {
      setRiskPhrase('');
      setRiskAsk({ copyKey, text });
      return;
    }
    void doCopySave(copyKey, text);
  };

  /* ---------------- 权益墙格级（产品-1010 片 1：mc.perksWall 块专属；格序=布局数据 perks 位） ---------------- */
  const wallSpec = editBlocks.find((b) => b.blockKey === 'mc.perksWall');
  const wallCells = resolvePerkWallCells(wallSpec?.perks ?? null);
  const setWallCells = (cells: PerkWallCellSpec[]) =>
    markDirty(editBlocks.map((b) => (b.blockKey === 'mc.perksWall' ? { ...b, perks: cells } : b)));
  const moveWallCell = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= wallCells.length) return;
    const next = [...wallCells];
    const [moved] = next.splice(idx, 1);
    next.splice(j, 0, moved!);
    setWallCells(next);
  };
  const setWallCellIcon = (key: string, icon: string) =>
    setWallCells(wallCells.map((c) => (c.key === key ? { ...c, icon: icon as PerkWallCellSpec['icon'] } : c)));

  /* ---------------- 保存草稿 / 发布 / 回退 ---------------- */
  const [busy, setBusy] = useState(false);
  const [publishAsk, setPublishAsk] = useState(false);
  const invalidateLayout = () => void queryClient.invalidateQueries({ queryKey: ['canvas', 'getLayout', pageKey] });

  const saveDraft = async () => {
    setBusy(true);
    try {
      const r = await trpc.canvas.saveLayout.mutate({ pageKey, blocks: editBlocks });
      toast(cv('canvas.draftSaved', { version: r.layout.version }));
      invalidateLayout();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const draftVersion = layoutQ.data?.draft ?? null;
  const doPublish = async () => {
    if (!draftVersion) return;
    setBusy(true);
    try {
      const r = await trpc.canvas.publishLayout.mutate({ versionId: draftVersion.id });
      toast(cv('canvas.publishDone', { version: r.version }));
      setPublishAsk(false);
      invalidateLayout();
      setReloadKey((k) => k + 1); /* 发布即客户端生效实证：iframe 重载拉 published */
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRevert = async () => {
    if (!window.confirm(cv('canvas.revertConfirm'))) return;
    setBusy(true);
    try {
      const r = await trpc.canvas.revertLayout.mutate({ pageKey });
      toast(cv('canvas.revertDone', { version: r.version }));
      invalidateLayout();
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const resetEdits = () => {
    setEditBlocks(baseBlocks);
    postLayout(baseBlocks);
  };

  /* ---------------- 渲染 ---------------- */
  const versions = layoutQ.data?.versions ?? [];

  return (
    <>
      <ToasterMount />
      <section className="wsk-card" data-testid="console-canvas-port">
        <div className="wsk-hd">
          <span className="t">{cv('canvas.title')}</span>
          <span className="a">{cv('canvas.aside')}</span>
        </div>

        {/* 红线条（注册表写死白名单；自由排版不做） */}
        <p className="mb-3 rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep" data-testid="canvas-redline">
          {cv('canvas.redline')}
        </p>

        {/* 三屏页签 */}
        <div className="mb-3 flex gap-1.5" role="tablist">
          {PAGE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={pageKey === t.key}
              data-testid={`canvas-tab-${t.key}`}
              onClick={() => {
                setPageKey(t.key);
                setEditSource(null);
                setEditBlocks([]);
                setPickedKey(null);
              }}
              className={`rounded-full px-3.5 py-[7px] text-caption transition-colors ${
                pageKey === t.key ? 'bg-[#3B2E24] font-semibold text-[#FAF8F2]' : 'text-[rgba(59,46,36,.6)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!storeId ? (
          <p className="py-3 text-center text-caption-xs text-[rgba(59,46,36,.42)]">{cv('canvas.noStore')}</p>
        ) : layoutQ.isPending || blocksQ.isPending ? (
          <div className="space-y-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 rounded-control" />
            ))}
          </div>
        ) : layoutQ.isError ? (
          <p className="py-3 text-center text-caption-xs text-danger-deep">
            {cv('canvas.loadFail')}：{errMsg(layoutQ.error)}
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3.5 xl:flex-row">
            {/* 左栏：块列表（拖拽/显隐/文案/槽位） */}
            <div className="w-full min-w-0 flex-1" data-testid="canvas-block-list">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-caption font-semibold text-ink">{cv('canvas.blockListTitle')}</span>
                <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{cv('canvas.blockListAside')}</span>
              </div>
              {editBlocks.map((b, idx) => {
                const reg: RegistryBlock | undefined = registryByKey.get(b.blockKey);
                const copyKeys = reg?.propsJson.copyKeys ?? [];
                const slotKey = reg?.propsJson.slotKey;
                const picked = pickedKey === b.blockKey;
                return (
                  <div
                    key={b.blockKey}
                    data-canvas-row="true"
                    ref={(el) => {
                      if (el) rowRefs.current.set(b.blockKey, el);
                      else rowRefs.current.delete(b.blockKey);
                    }}
                    data-testid={`canvas-row-${b.blockKey}`}
                    className={`mb-2 rounded-panel bg-canvas px-3 py-2.5 ${picked ? `canvas-picked-${b.blockKey} ring-2 ring-brand-primary` : ''} ${
                      dragFrom === idx ? 'opacity-60' : ''
                    } ${dragOver === idx && dragFrom !== null && dragFrom !== idx ? 'ring-1 ring-line-strong' : ''}`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* 拖拽柄（手写 pointer 工艺；title=键名锚） */}
                      <button
                        type="button"
                        data-testid={`canvas-drag-${b.blockKey}`}
                        aria-label={`drag ${b.blockKey}`}
                        onPointerDown={onDragStart(idx)}
                        onPointerMove={onDragMove}
                        onPointerUp={onDragEnd}
                        onPointerCancel={onDragEnd}
                        className="u1-ring shrink-0 cursor-grab touch-none rounded-chip bg-card px-2 py-1.5 text-caption-xs font-bold text-[rgba(59,46,36,.62)] active:cursor-grabbing"
                      >
                        ⠿
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-caption font-semibold text-ink">{reg?.label ?? b.blockKey}</div>
                        <div className="mt-[1px] text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                          {b.blockKey}
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-caption-xs text-[rgba(59,46,36,.62)]">
                        {cv('canvas.visibleLabel')}
                        <span data-testid={`canvas-visible-${b.blockKey}`} className="inline-flex">
                          <Switch
                            checked={b.visible}
                            onChange={(v) => toggleVisible(b.blockKey, v)}
                            label={cv('canvas.visibleLabel')}
                          />
                        </span>
                      </span>
                    </div>

                    {/* 槽位块：当前素材缩图 + 去槽位端口更换 */}
                    {slotKey ? (
                      <div className="mt-2 flex items-center gap-2.5 border-t border-[rgba(59,46,36,.06)] pt-2">
                        {slotContentOf(slotKey)?.url ? (
                          <img
                            src={resolveSlotUrl(slotContentOf(slotKey)?.url) ?? ''}
                            alt={slotContentOf(slotKey)?.alt ?? ''}
                            className="h-10 w-16 rounded-chip object-cover"
                            data-testid={`canvas-slot-${slotKey}`}
                          />
                        ) : (
                          <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{cv('canvas.slotEmpty')}</span>
                        )}
                        <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{cv('canvas.slotCurrent')}</span>
                        <Link to="/settings/slots" className="ml-auto text-caption-xs font-bold text-ink underline underline-offset-2">
                          {cv('canvas.slotGoto')}
                        </Link>
                      </div>
                    ) : null}

                    {/* 端口化 copy 键行内编辑（现值=config.list copy 域；高危键口令复核） */}
                    {copyKeys.map((k) => {
                      const cur = copyByKey.get(k);
                      const draft = copyDrafts[k] ?? cur?.text ?? '';
                      const changed = copyDrafts[k] !== undefined && copyDrafts[k] !== (cur?.text ?? '');
                      return (
                        <div key={k} className="mt-2 flex items-center gap-2 border-t border-[rgba(59,46,36,.06)] pt-2">
                          <span className="w-40 shrink-0 truncate text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                            {k}
                            {cur?.highRisk ? (
                              <Badge tone="danger">{cv('canvas.copyHighRiskWarn')}</Badge>
                            ) : null}
                          </span>
                          <input
                            className={inputCls}
                            data-testid={`canvas-copy-${k}`}
                            ref={(el) => {
                              if (el) copyInputRefs.current.set(k, el);
                              else copyInputRefs.current.delete(k);
                            }}
                            value={draft}
                            maxLength={2000}
                            /* 注册表声明但码内无此键（home.entryNote / perk.boarding 留口先例）→「—」兜底 */
                            placeholder={cur ? undefined : '—'}
                            onChange={(e) => setCopyDrafts((prev) => ({ ...prev, [k]: e.target.value }))}
                          />
                          <Btn
                            variant="subtle"
                            size="sm"
                            data-testid={`canvas-copy-save-${k}`}
                            disabled={!changed || copyBusy === k}
                            onClick={() => copySave(k)}
                          >
                            {cv('canvas.copySave')}
                          </Btn>
                        </div>
                      );
                    })}

                    {/* 产品-1010 片 1：权益墙格级子区（mc.perksWall 专属）——格序 ↑↓ 移入布局数据+
                        图标白名单选换+格名/副签=copy 键行内编辑（perk.* 高危族口令复核照既有闸）+
                        数值面=档端口透出（跳口不改数） */}
                    {b.blockKey === 'mc.perksWall' && pageKey === 'memberCenter' ? (
                      <div className="mt-2 border-t border-[rgba(59,46,36,.06)] pt-2" data-testid="canvas-perkwall-cells">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">权益墙格子（七格）</span>
                          <span className="text-caption-xs text-[rgba(59,46,36,.42)]">格序/图标进布局；几折/几%/含几只=数值走会员档端口</span>
                          <Link to="/console?port=member_plans" className="ml-auto text-caption-xs font-bold text-ink underline underline-offset-2" data-testid="canvas-perkwall-goto-plans">
                            去会员档改数 ›
                          </Link>
                        </div>
                        {wallCells.map((cell, ci) => {
                          const def = PERK_WALL_ITEMS.find((i) => i.key === cell.key)!;
                          return (
                            <div key={cell.key} className="mb-2 rounded-control bg-card px-2 py-2 ring-1 ring-line-ring" data-testid={`canvas-perkcell-${cell.key}`}>
                              <div className="flex items-center gap-2">
                                <span className="flex shrink-0 flex-col">
                                  <button type="button" aria-label={`up ${cell.key}`} data-testid={`canvas-perkcell-up-${cell.key}`} disabled={ci === 0} onClick={() => moveWallCell(ci, -1)} className="text-caption-xs text-[rgba(59,46,36,.62)] disabled:opacity-30">▲</button>
                                  <button type="button" aria-label={`down ${cell.key}`} data-testid={`canvas-perkcell-down-${cell.key}`} disabled={ci === wallCells.length - 1} onClick={() => moveWallCell(ci, 1)} className="text-caption-xs text-[rgba(59,46,36,.62)] disabled:opacity-30">▼</button>
                                </span>
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-canvas">
                                  <PerkIcon icon={cell.icon} className="h-4 w-4 text-[rgba(59,46,36,.75)]" />
                                </span>
                                <span className="text-caption-xs font-semibold text-ink">{def.label}</span>
                                <select
                                  className="ml-auto rounded-control bg-card px-2 py-1 text-caption-xs text-ink ring-1 ring-line-ring"
                                  value={cell.icon}
                                  onChange={(e) => setWallCellIcon(cell.key, e.target.value)}
                                  data-testid={`canvas-perkcell-icon-${cell.key}`}
                                >
                                  {Object.keys(PERK_ICON_SET).map((ik) => (
                                    <option key={ik} value={ik}>{ik}</option>
                                  ))}
                                </select>
                              </div>
                              {[def.titleCopyKey, def.subCopyKey, def.subFreeCopyKey, def.subNoneCopyKey].filter((k): k is string => !!k).map((k) => {
                                const cur = copyByKey.get(k);
                                const draft = copyDrafts[k] ?? cur?.text ?? '';
                                const changed = copyDrafts[k] !== undefined && copyDrafts[k] !== (cur?.text ?? '');
                                return (
                                  <div key={k} className="mt-1.5 flex items-center gap-2">
                                    <span className="w-40 shrink-0 truncate text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                                      {k}
                                      {cur?.highRisk ? <Badge tone="danger">{cv('canvas.copyHighRiskWarn')}</Badge> : null}
                                    </span>
                                    <input
                                      className={inputCls}
                                      data-testid={`canvas-copy-${k}`}
                                      ref={(el) => {
                                        if (el) copyInputRefs.current.set(k, el);
                                        else copyInputRefs.current.delete(k);
                                      }}
                                      value={draft}
                                      maxLength={2000}
                                      placeholder={cur ? undefined : '—'}
                                      onChange={(e) => setCopyDrafts((prev) => ({ ...prev, [k]: e.target.value }))}
                                    />
                                    <Btn variant="subtle" size="sm" data-testid={`canvas-copy-save-${k}`} disabled={!changed || copyBusy === k} onClick={() => copySave(k)}>
                                      {cv('canvas.copySave')}
                                    </Btn>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {/* 脏条 + 保存草稿/发布 */}
              {dirty ? (
                <div
                  className="u1-ring sticky bottom-4 z-10 mt-2 flex items-center justify-between gap-3 rounded-panel bg-card px-4 py-3 shadow-elevated"
                  data-testid="canvas-dirty-bar"
                >
                  <span className="text-caption text-ink">{cv('canvas.dirtyBar', { n: dirtyCount })}</span>
                  <Btn variant="subtle" size="sm" onClick={resetEdits} disabled={busy}>
                    {cv('canvas.resetCta')}
                  </Btn>
                </div>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <Btn variant="subtle" size="sm" data-testid="canvas-save-draft" disabled={busy || !dirty} onClick={() => void saveDraft()}>
                  {cv('canvas.saveDraft')}
                </Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  data-testid="canvas-publish"
                  disabled={busy || !draftVersion}
                  onClick={() => setPublishAsk(true)}
                >
                  {cv('canvas.publishCta')}
                </Btn>
                {!draftVersion ? (
                  <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{cv('canvas.publishNoDraft')}</span>
                ) : null}
              </div>

              {/* 版本时间轴 */}
              <div className="mt-4" data-testid="canvas-versions">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-caption font-semibold text-ink">{cv('canvas.versionsTitle')}</span>
                  <Btn variant="subtle" size="sm" data-testid="canvas-revert" disabled={busy || !layoutQ.data?.live} onClick={() => void doRevert()}>
                    {cv('canvas.revertCta')}
                  </Btn>
                </div>
                {versions.length === 0 ? (
                  <p className="py-3 text-center text-caption-xs text-[rgba(59,46,36,.42)]">{cv('canvas.versionsEmpty')}</p>
                ) : (
                  versions.map((v: LayoutVersion) => (
                    <div key={v.id} className="flex items-center gap-2 border-t border-[rgba(59,46,36,.06)] py-2 first:border-t-0">
                      <Badge tone={v.status === 'published' ? 'success' : v.status === 'draft' ? 'warn' : 'muted'}>
                        {STATUS_LABEL[v.status] ?? v.status}
                      </Badge>
                      <span className="text-caption font-semibold text-ink" style={numStyle}>
                        v{v.version}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                        {v.creatorNickname ?? '—'} · {fmtDateTime(v.actedAt ?? v.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 右栏：真页预览 iframe（canvasPreview=1 激活探针；reloadKey 控刷新；
                端口分端映射=copy 端口键 canvas.previewPortMap 读值[改拓扑零代码]，缺省=生产实测 7202/7201→7200） */}
            <div className="w-full shrink-0 xl:w-[420px]" data-testid="canvas-preview">
              <iframe
                key={reloadKey}
                ref={iframeRef}
                data-testid="canvas-iframe"
                title={cv('canvas.title')}
                src={previewUrl(pageKey, storeId, parsePreviewPortMap(copyByKey.get('canvas.previewPortMap')?.text))}
                className="u1-ring h-[720px] w-full rounded-panel bg-card"
              />
            </div>
          </div>
        )}
      </section>

      {/* 高危键口令复核弹层（CopyConfigPage 工艺简化版） */}
      <Modal
        open={riskAsk !== null}
        onClose={() => {
          if (!copyBusy) setRiskAsk(null);
        }}
        title={cv('canvas.copyHighRiskWarn')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setRiskAsk(null)} disabled={copyBusy !== null}>
              {cv('canvas.cancelCta')}
            </Btn>
            <Btn
              variant="danger"
              data-testid="canvas-risk-submit"
              disabled={copyBusy !== null || riskPhrase.trim() !== cv('canvas.confirmPhrase')}
              onClick={() => (riskAsk ? void doCopySave(riskAsk.copyKey, riskAsk.text) : undefined)}
            >
              {cv('canvas.confirmCta')}
            </Btn>
          </>
        }
      >
        {riskAsk ? (
          <div className="space-y-3" data-testid="canvas-risk-modal">
            <p className="rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep">
              {cv('canvas.copyHighRiskWarn')}
            </p>
            <div className="rounded-control bg-canvas px-3 py-2 text-caption text-ink" style={numStyle}>
              {riskAsk.copyKey} → {riskAsk.text}
            </div>
            <Field label={cv('canvas.confirmPhrase')} hint={cv('canvas.confirmHint')}>
              <input
                className={inputCls}
                data-testid="canvas-risk-input"
                placeholder={cv('canvas.confirmPhrase')}
                value={riskPhrase}
                onChange={(e) => setRiskPhrase(e.target.value)}
                disabled={copyBusy !== null}
              />
            </Field>
          </div>
        ) : null}
      </Modal>

      {/* 发布确认弹层 */}
      <Modal
        open={publishAsk}
        onClose={() => {
          if (!busy) setPublishAsk(false);
        }}
        title={cv('canvas.publishTitle')}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setPublishAsk(false)} disabled={busy}>
              {cv('canvas.cancelCta')}
            </Btn>
            <Btn variant="danger" data-testid="canvas-publish-confirm" disabled={busy} onClick={() => void doPublish()}>
              {cv('canvas.confirmCta')}
            </Btn>
          </>
        }
      >
        <p className="text-caption text-ink" data-testid="canvas-publish-modal">
          {cv('canvas.publishBody', { version: draftVersion?.version ?? 0 })}
        </p>
      </Modal>
    </>
  );
}
