/**
 * 文案端口覆盖层（端口批片 B · CJ-1002-01 内容层全端口化）：
 * 读取顺序=端口值（copy_overrides 表 active 行）→ 码内默认（copy 键 fallback 不改码）；
 * 不存在的键=只读提示不拦截（覆盖行若码内无此键=永不命中，零副作用）；
 * 保存即生效=只管新渲染（覆盖表启动拉取+120s 轮询，回溯截图证据不管）。
 *
 * 结构：模块级 Map（同步可读——copy 访问器是纯同步函数不能 await）+
 * withCopyOverrides 代理包装（三端 copy 表统一一行接入，staff 端直取字典处零改动）+
 * <CopyOverridesLoader/>（各端 providers.tsx 挂载，拉取写图）。
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePhiliaClient } from './api/client';

/** 端口值图（key→当前生效文案；仅含 copy_overrides active 行） */
const overrideMap = new Map<string, string>();

/** 写入覆盖表（Loader 拉取后调用；整表替换） */
export function setCopyOverrides(rows: Array<{ key: string; text: string }>): void {
  overrideMap.clear();
  for (const r of rows) {
    if (typeof r.text === 'string') overrideMap.set(r.key, r.text);
  }
}

/** 单键读端口值（无覆盖 → undefined；读侧不存在的键静默跳过=只读提示不拦截） */
export function copyOverrideOf(key: string): string | undefined {
  return overrideMap.get(key);
}

/**
 * 画布实时 patch（端口批收尾片 3 · 画布端口预览管道）：单键写入覆盖图，不落库；
 * 配合 window 'philia-canvas-patch' 事件触发重渲染（保存成功后真值经 Loader 整表对齐）。
 */
export function patchCopyOverride(key: string, text: string): void {
  overrideMap.set(key, text);
}

/**
 * copy 表代理包装：键命中覆盖图 → 端口值，否则落码内默认。
 * 用法（copy 文件一行接入）：
 *   const REFUND_COPY_TABLE = { ... } as const;
 *   export const REFUND_COPY = withCopyOverrides(REFUND_COPY_TABLE);
 */
export function withCopyOverrides<T extends Record<string, string>>(table: T): T {
  return new Proxy(table, {
    get(t, p) {
      if (typeof p === 'string' && Object.prototype.hasOwnProperty.call(t, p)) {
        return overrideMap.get(p) ?? t[p as keyof T];
      }
      return Reflect.get(t as object, p);
    },
  }) as T;
}

/**
 * 覆盖表拉取器（挂各端 providers.tsx，须位于 PhiliaClientContext + QueryClientProvider 内）：
 * 启动拉一次 + 120s 轮询兜底；渲染不阻塞（首帧用码内默认，覆盖到达只管新渲染）。
 */
export function CopyOverridesLoader() {
  const { trpc } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['copyOverrides', 'active'],
    queryFn: () => trpc.config.activeCopyTexts.query(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
  useEffect(() => {
    if (q.data?.rows) setCopyOverrides(q.data.rows);
  }, [q.data]);
  return null;
}
