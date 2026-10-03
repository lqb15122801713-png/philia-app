/**
 * 展示槽位覆盖层（端口批片 C · CJ-1002-01 · A5 落地）：
 * 读取顺序=槽位 live 值（slot_contents 表 status='live' 行）→ 码内默认（渐变/默认图 fallback）；
 * 待审 pending 不透出（新素材默认待审不上线，D-6 纪律）；只管新渲染不回溯。
 *
 * 结构=文案覆盖层同族：模块级 Map（同步可读）+ SlotContentLoader（各端 providers 挂载，
 * 启动拉 slotPort.liveMap + 120s 轮询）。
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiBase, usePhiliaClient } from './api/client';

export interface SlotContent {
  url: string | null;
  alt: string;
}

/** 槽位 live 图（key→内容；仅含 live 行） */
const slotMap = new Map<string, SlotContent>();

/** 写入槽位图（Loader 拉取后调用；整表替换） */
export function setSlotContents(rows: Array<{ key: string; url: string | null; alt: string }>): void {
  slotMap.clear();
  for (const r of rows) slotMap.set(r.key, { url: r.url, alt: r.alt });
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

/**
 * 槽位图拉取器（挂各端 providers.tsx，须位于 PhiliaClientContext + QueryClientProvider 内）：
 * 启动拉一次 + 120s 轮询；渲染不阻塞（首帧码内默认，live 到达只管新渲染）。
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
  return null;
}
