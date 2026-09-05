/**
 * tRPC client 工厂 + QueryClient（契约 docs/CLIENT-CONTRACTS.md · T2.0）
 *
 * - createPhiliaClient(baseUrl)：返回 { trpc, queryClient }。
 *   httpBatchLink + superjson + fetch credentials:'include'（httpOnly 会话 cookie）。
 * - AppRouter 用 type-only 相对路径 import（server 不在 workspaces，仅类型引用，
 *   构建期擦除，无运行时开销）。
 * - getApiBase()：读 import.meta.env.VITE_API_BASE，缺省 http://localhost:7200。
 * - PhiliaClientContext / usePhiliaClient：各端 providers.tsx 装入单例，
 *   页面 hooks（useMe 等）与组件经 context 取 trpc 实例。
 */

import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, type CreateTRPCClient } from '@trpc/client';
import { createContext, useContext } from 'react';
import superjson from 'superjson';
import type { AppRouter } from '../../../../server/src/routers/index.js';

/** 服务端 AppRouter 类型锚点（仅类型 re-export，无运行时开销） */
export type { AppRouter };

/**
 * 会话用户（镜像服务端 SessionUser 结构：server/src/trpc.ts；
 * useMe 把 auth.me 的 { user, roles, staff, store } 响应映射为本结构）
 */
export interface SessionUser {
  id: string;
  nickname: string | null;
  roles: Array<'customer' | 'merchant_owner' | 'merchant_manager' | 'staff'>;
  /** 若为 staff，其 staff 记录 id */
  staffId?: string;
  /** staff 所属门店 / merchant 管理门店 */
  storeId?: string;
}

/** createPhiliaClient 返回体（契约签名） */
export interface PhiliaClient {
  trpc: CreateTRPCClient<AppRouter>;
  queryClient: QueryClient;
}

/** API base：env VITE_API_BASE（import.meta.env 读取），缺省 http://localhost:7200 */
export function getApiBase(): string {
  // node（冒烟脚本 / tsx）环境下 import.meta.env 不存在，需可选链兜底
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const fromEnv = env?.VITE_API_BASE;
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'http://localhost:7200';
}

/** 创建 trpc client + QueryClient 单例（契约签名；由各端 providers.tsx 调用一次） */
export function createPhiliaClient(baseUrl: string): PhiliaClient {
  const trpc = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        transformer: superjson,
        // 会话为 httpOnly cookie，跨域（7100 → 7200）必须携带凭证
        fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
      }),
    ],
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 10_000,
      },
    },
  });

  return { trpc, queryClient };
}

/** 客户端单例 context（providers.tsx 提供；hooks/页面组件经 usePhiliaClient 取） */
export const PhiliaClientContext = createContext<PhiliaClient | null>(null);

/** 取 trpc/queryClient 单例；未装 Provider 时抛错（提示检查 providers.tsx 装配） */
export function usePhiliaClient(): PhiliaClient {
  const client = useContext(PhiliaClientContext);
  if (!client) {
    throw new Error(
      'usePhiliaClient 必须在 <PhiliaClientContext.Provider> 内使用（见 apps/customer/src/providers.tsx）',
    );
  }
  return client;
}
