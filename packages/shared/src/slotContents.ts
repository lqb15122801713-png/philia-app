/**
 * 展示槽位覆盖层（端口批片 C · CJ-1002-01 · A5 落地）：
 * 读取顺序=槽位 live 值（slot_contents 表 status='live' 行）→ 码内默认（渐变/默认图 fallback）；
 * 待审 pending 不透出（新素材默认待审不上线，D-6 纪律）；只管新渲染不回溯。
 *
 * 结构=文案覆盖层同族：模块级 Map（同步可读）+ SlotContentLoader（各端 providers 挂载，
 * 启动拉 slotPort.liveMap + 120s 轮询）。
 *
 * PD-20 追加：
 * - D-42：live 透出扩字段（title_main/title_sub/cta_text/audience/priority）随 Map 同步可读；
 * - D-41：URL 探针 `slotPreview=<versionId>` 预览旁路——owner 会话经 slotPort.previewVersion
 *   读 pending 版覆写 Map（403=路人/非 owner→保持 live 不透，预览页不炸）；预览中角标读口=
 *   slotPreviewState()（客户端 home.banner 块挂「预览中」徽）。
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiBase, usePhiliaClient } from './api/client';

export interface SlotContent {
  url: string | null;
  alt: string;
  /** D-42 扩字段（可选；缺省=纯图版） */
  title_main?: string | null;
  title_sub?: string | null;
  cta_text?: string | null;
  audience?: 'all' | 'anon' | 'free' | 'anon_free' | null;
  priority?: number | null;
}

/** 槽位 live 图（key→内容；仅含 live 行） */
const slotMap = new Map<string, SlotContent>();

/** 写入槽位图（Loader 拉取后调用；整表替换） */
export function setSlotContents(rows: Array<{ key: string } & SlotContent>): void {
  slotMap.clear();
  for (const r of rows) {
    const { key, ...content } = r;
    slotMap.set(key, content);
  }
}

/** 单槽读 live 内容（无槽/无 live → undefined；调用侧自己落码内默认） */
export function slotContentOf(key: string): SlotContent | undefined {
  return slotMap.get(key);
}

/** 槽位 url 归一化：/api/* 签名件拼 API base（跨端直连），其余（/brand 等 public 路径）原样 */
export function resolveSlotUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${getApiBase()}${url}` : url;
}

/* ------------------------------------------------------------------ */
/* D-41 预览旁路状态（模块级；Loader 覆写后同步可读）                      */
/* ------------------------------------------------------------------ */

/** 预览探针参（模块装载时解析一次；canvasPreview=1 同族工艺） */
const SLOT_PREVIEW_VERSION_ID =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('slotPreview') : null;

const previewState = { versionId: SLOT_PREVIEW_VERSION_ID, active: false, denied: false };

/** 预览旁路读口：active=预览版已覆写 Map（挂「预览中」角标）；denied=非 owner/路人（保持 live 不透） */
export function slotPreviewState(): { versionId: string | null; active: boolean; denied: boolean } {
  return previewState;
}

/**
 * 槽位图拉取器（挂各端 providers.tsx，须位于 PhiliaClientContext + QueryClientProvider 内）：
 * 启动拉一次 + 120s 轮询；渲染不阻塞（首帧码内默认，live 到达只管新渲染）。
 * D-41：slotPreview 探针参在场时，额外拉 previewVersion（owner 闸）覆写该槽 Map 行。
 */
export function SlotContentLoader() {
  const { trpc } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['slotPort', 'liveMap'],
    queryFn: () => trpc.slotPort.liveMap.query(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
  useEffect(() => {
    if (q.data?.slots) setSlotContents(q.data.slots);
  }, [q.data]);

  /* D-41 预览旁路：仅探针参在场才发（零常载增发）；owner 硬闸 403=denied 保持 live */
  const previewQ = useQuery({
    queryKey: ['slotPort', 'previewVersion', SLOT_PREVIEW_VERSION_ID],
    queryFn: () => trpc.slotPort.previewVersion.query({ versionId: SLOT_PREVIEW_VERSION_ID! }),
    enabled: SLOT_PREVIEW_VERSION_ID !== null,
    retry: false,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!SLOT_PREVIEW_VERSION_ID) return;
    const row = previewQ.data?.version;
    if (row) {
      slotMap.set(row.slotKey, { ...row.contentJson });
      previewState.active = true;
      previewState.denied = false;
    } else if (previewQ.isError) {
      previewState.active = false;
      previewState.denied = true;
    }
  }, [previewQ.data, previewQ.isError]);
  return null;
}
