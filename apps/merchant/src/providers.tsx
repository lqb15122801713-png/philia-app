/**
 * 商家端 Provider 装线（契约 docs/MERCHANT-CONTRACTS.md · T4.1，照搬 apps/staff/src/providers.tsx）
 *
 * - 启动时创建 trpc client + QueryClient 单例（createPhiliaClient(getApiBase())，
 *   base 读 env VITE_API_BASE，缺省 http://localhost:7200）；
 * - PhiliaClientContext.Provider 供 @philia/shared 的 useMe / usePhiliaClient 等取用；
 * - QueryClientProvider 供页面 useQuery / useMutation / invalidateQueries。
 *
 * main.tsx 中装配：<BrowserRouter><AppProviders><App /></AppProviders></BrowserRouter>
 */

import { CanvasProbeMount, CopyOverridesLoader, createPhiliaClient, getApiBase, PhiliaClientContext, SlotContentLoader } from '@philia/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export default function AppProviders({ children }: { children: ReactNode }) {
  // useState 惰性初始化保证 StrictMode 双渲染下也是单例
  const [philia] = useState(() => createPhiliaClient(getApiBase()));

  return (
    <PhiliaClientContext.Provider value={philia}>
      <QueryClientProvider client={philia.queryClient}>
        {/* 端口批片 B：文案覆盖表启动拉取（保存即生效只管新渲染） */}
        <CopyOverridesLoader />
        {/* 端口批片 C：槽位 live 图启动拉取（待审不透出） */}
        <SlotContentLoader />
        {/* 端口批收尾片 3：画布模式探针（仅 ?canvasPreview=1 激活=点选反查+实时 patch） */}
        <CanvasProbeMount />
        {children}
      </QueryClientProvider>
    </PhiliaClientContext.Provider>
  );
}
