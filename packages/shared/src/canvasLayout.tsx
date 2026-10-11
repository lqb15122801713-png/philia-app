/**
 * 画布布局覆盖层（端口批收尾片 3 · B 股：右栏真页预览+点选反查+拖拽排序收）：
 * 读取顺序=published 布局（page_layouts status='published'，liveLayout 透出）→
 * 注册表默认序尾补（block_registry 写死白名单，缺省全 visible）。
 *
 * 结构=文案/槽位覆盖层同族：模块级 Map（同步可读）+ CanvasLayoutLoader（真页挂载，
 * 60s staleTime+120s 轮询）+ useCanvasLayout hook（有效布局合成+patch 事件 bump）。
 *
 * CanvasProbeMount=画布模式探针（仅 ?canvasPreview=1 激活）：
 * ①click 捕获 → data-copy-key/data-block-key 命中即 postMessage 回画布页（点选反查）；
 * ②message 监听 philia-canvas-layout（布局实时 patch）/ philia-canvas-copy（文案实时
 * patch，写 copyOverrides 图）→ dispatch 'philia-canvas-patch' 触发重渲染（预览即变不刷新）。
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePhiliaClient } from './api/client';
import { patchCopyOverride } from './copyOverrides';
import { PERK_ICON_SET, resolvePerkWallCells, type PerkIconKey, type PerkIconShape, type PerkWallCellSpec } from './perkWall';

export type CanvasPageKey = 'home' | 'memberCenter' | 'cashierMarketing';

export interface CanvasBlockSpec {
  blockKey: string;
  visible: boolean;
  /** 权益墙格级布局（产品-1010 片 1：仅 mc.perksWall 块携带；格序+图标选换，白名单解析在 perkWall.ts） */
  perks?: Array<{ key: string; icon: string }>; // 契约宽松位（server $type 同形）；渲染前经 resolvePerkWallCells 收窄
}

/** 布局图（pageKey→published/预览块序；仅含已透出行） */
const layoutMap = new Map<string, CanvasBlockSpec[]>();

/** 写入布局图（Loader 拉取/探针 patch 后调用；整页替换；perks 位随行保留） */
export function setCanvasLayout(pageKey: string, blocks: CanvasBlockSpec[]): void {
  layoutMap.set(
    pageKey,
    blocks.map((b) => ({ blockKey: b.blockKey, visible: b.visible !== false, ...(b.perks ? { perks: b.perks } : {}) })),
  );
}

/** 单页读布局（无 → undefined；调用方落注册表默认序） */
export function canvasLayoutOf(pageKey: string): CanvasBlockSpec[] | undefined {
  return layoutMap.get(pageKey);
}

/** 预览 patch 事件名（探针 dispatch / useCanvasLayout 监听 bump 重渲染） */
export const CANVAS_PATCH_EVENT = 'philia-canvas-patch';

/** 点选反查挂键小件：注册表 propsJson.copyKeys 声明键位文案的包件（画布 pick 命中锚） */
export function CK({ k, children }: { k: string; children: ReactNode }) {
  return <span data-copy-key={k}>{children}</span>;
}

/**
 * 布局拉取器（真页区块渲染处挂载，须位于 PhiliaClientContext + QueryClientProvider 内）：
 * 启动拉一次 + 120s 轮询；渲染不阻塞（首帧注册表默认序，published 到达只管新渲染）。
 * storeId 未解析时跳过（enabled 闸）。
 */
export function CanvasLayoutLoader({
  pageKey,
  storeId,
  children,
}: {
  pageKey: CanvasPageKey;
  storeId: string | null;
  children?: ReactNode;
}) {
  const { trpc } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['canvas', 'liveLayout', pageKey, storeId],
    queryFn: () => trpc.canvas.liveLayout.query({ pageKey, storeId: storeId! }),
    enabled: storeId !== null,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
  useEffect(() => {
    if (q.data?.blocks) setCanvasLayout(pageKey, q.data.blocks);
  }, [q.data, pageKey]);
  return <>{children}</>;
}

/**
 * 有效布局合成：布局图（published/预览 patch 优先）∪ 注册表默认序尾补（缺省 visible=true）；
 * 重块去重保序；监听 CANVAS_PATCH_EVENT bump 强制重算（画布实时预览管道）。
 */
export function useCanvasLayout(
  pageKey: CanvasPageKey,
  storeId: string | null,
  registryBlocks: ReadonlyArray<{ blockKey: string }>,
): CanvasBlockSpec[] {
  const { trpc } = usePhiliaClient();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const h = () => setBump((x) => x + 1);
    window.addEventListener(CANVAS_PATCH_EVENT, h);
    return () => window.removeEventListener(CANVAS_PATCH_EVENT, h);
  }, []);
  const q = useQuery({
    queryKey: ['canvas', 'liveLayout', pageKey, storeId],
    queryFn: () => trpc.canvas.liveLayout.query({ pageKey, storeId: storeId! }),
    enabled: storeId !== null,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
  useEffect(() => {
    if (q.data?.blocks) setCanvasLayout(pageKey, q.data.blocks);
  }, [q.data, pageKey]);
  return useMemo(() => {
    /* 布局图优先（探针 patch 直写图=预览即变；query 到达经 Loader/本 hook 同步入图） */
    const live = canvasLayoutOf(pageKey) ?? q.data?.blocks ?? null;
    const out: CanvasBlockSpec[] = [];
    const seen = new Set<string>();
    if (live) {
      for (const b of live) {
        if (seen.has(b.blockKey)) continue;
        seen.add(b.blockKey);
        out.push({ blockKey: b.blockKey, visible: b.visible !== false, ...(b.perks ? { perks: b.perks } : {}) });
      }
    }
    for (const r of registryBlocks) {
      if (!seen.has(r.blockKey)) {
        seen.add(r.blockKey);
        out.push({ blockKey: r.blockKey, visible: true });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, q.data, registryBlocks, bump]);
}

/**
 * 画布模式探针（挂各端 providers）：仅当 location.search 含 canvasPreview=1 时激活——
 * 在画布页 iframe 内把真页变成可点选/可热 patch 的预览面。非预览模式零挂载零开销。
 */
export function CanvasProbeMount() {
  const [active] = useState(
    () => typeof window !== 'undefined' && window.location.search.includes('canvasPreview=1'),
  );
  useEffect(() => {
    if (!active) return;
    /* ①点选反查：捕获阶段命中 data-copy-key/data-block-key → 回挂画布页+阻断真跳转 */
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-copy-key],[data-block-key]') as HTMLElement | null;
      if (!el) return;
      const copyKey = el.getAttribute('data-copy-key');
      const blockEl = el.hasAttribute('data-block-key') ? el : (el.closest('[data-block-key]') as HTMLElement | null);
      const blockKey = blockEl?.getAttribute('data-block-key') ?? null;
      window.parent?.postMessage({ type: 'philia-canvas-pick', copyKey, blockKey }, '*');
      e.preventDefault();
      e.stopPropagation();
    };
    /* ②实时 patch：布局（重排/显隐）与文案（保存后预览同步）→ 写图+bump 重渲染 */
    const onMsg = (e: MessageEvent) => {
      const d = e.data as Record<string, unknown> | null;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'philia-canvas-layout' && typeof d.pageKey === 'string' && Array.isArray(d.blocks)) {
        setCanvasLayout(d.pageKey, d.blocks as CanvasBlockSpec[]);
        window.dispatchEvent(new CustomEvent(CANVAS_PATCH_EVENT));
      } else if (d.type === 'philia-canvas-copy' && typeof d.key === 'string' && typeof d.text === 'string') {
        patchCopyOverride(d.key, d.text);
        window.dispatchEvent(new CustomEvent(CANVAS_PATCH_EVENT));
      }
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('message', onMsg);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('message', onMsg);
    };
  }, [active]);
  return null;
}


/* ------------------------------------------------------------------ */
/* 权益墙格级读口+图标渲染件（产品-1010 片 1；数据=./perkWall 纯数据件）      */
/* ------------------------------------------------------------------ */

/** SVG 形状递归渲染（PerkIconShape 数据→SVG 子元素） */
function renderShapes(shapes: readonly PerkIconShape[]): ReactNode {
  return shapes.map((s, i) => {
    if (s.tag === 'g') return <g key={i}>{renderShapes(s.children ?? [])}</g>;
    if (s.tag === 'circle') return <circle key={i} {...(s.attrs as Record<string, string | number> | undefined)} />;
    if (s.tag === 'rect') return <rect key={i} {...(s.attrs as Record<string, string | number> | undefined)} />;
    return <path key={i} {...(s.attrs as Record<string, string | number> | undefined)} />;
  });
}

/** 权益墙图标渲染件（白名单选换；线性统一 stroke；调用方给尺寸/色） */
export function PerkIcon({ icon, className }: { icon: PerkIconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {renderShapes(PERK_ICON_SET[icon])}
    </svg>
  );
}

/**
 * 权益墙格序读口 hook（产品-1010 片 1 · 双屏同帧单源）：读会员中心 published 布局的
 * mc.perksWall 块 perks 位（会员中心页=权益墙格序的归属页/编辑面）——开通页等无画布注册的
 * 页读本行=双屏同序。预览 patch 优先（CANVAS_PATCH_EVENT bump 重算=画布实时预览管道）。
 */
export function usePerkWallCells(storeId: string | null): PerkWallCellSpec[] {
  const { trpc } = usePhiliaClient();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const h = () => setBump((x) => x + 1);
    window.addEventListener(CANVAS_PATCH_EVENT, h);
    return () => window.removeEventListener(CANVAS_PATCH_EVENT, h);
  }, []);
  const q = useQuery({
    queryKey: ['canvas', 'liveLayout', 'memberCenter', storeId],
    queryFn: () => trpc.canvas.liveLayout.query({ pageKey: 'memberCenter', storeId: storeId! }),
    enabled: storeId !== null,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
  useEffect(() => {
    if (q.data?.blocks) setCanvasLayout('memberCenter', q.data.blocks);
  }, [q.data]);
  return useMemo(() => {
    const live = canvasLayoutOf('memberCenter') ?? q.data?.blocks ?? null;
    const wall = live?.find((b) => b.blockKey === 'mc.perksWall');
    return resolvePerkWallCells(wall?.perks ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, bump]);
}
