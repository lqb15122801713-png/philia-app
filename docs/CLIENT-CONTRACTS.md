# 客户端共享层契约（P2 并行开发防冲突 · 各子代理严格遵守）

> T2.0 负责实现本契约并验证可用；T2.1/T2.2/T2.3 只 import 使用，**不得改动共享层文件**。
> 后端事实来源：`server/src/routers/index.ts` 的 `AppRouter`（7 域：auth/pet/store/appointment/serviceStep/boarding/push），tRPC v11 + superjson，会话用 httpOnly cookie（credentials: 'include'），SSE 端点 `GET /api/events`，上传 `POST /api/upload`，图片签名 URL 由后端返回可直接 `<img src>`。

## 共享层导出（packages/shared/src/api/ 下，经 @philia/shared re-export）

```ts
// api/client.ts
export function createPhiliaClient(baseUrl: string): PhiliaClient
// 返回 { trpc: createTRPCClient<AppRouter> 实例, queryClient: QueryClient }
// AppRouter 用 type-only 相对路径 import（server 不在 workspaces，仅类型引用，构建期擦除）
// httpBatchLink + superjson + fetch credentials:'include'

// api/hooks.ts
export function useMe(): { user: SessionUser | null; loading: boolean; refetch(): void }
// 内部用 trpc.auth.me；未登录（401）返回 user=null 不报错
export function useEventSource(opts: {
  url: string | null;                 // null 则不连接
  onEvent: (envelope: EventEnvelope) => void;
  onReconnect?: () => void;           // 重连成功回调（页面应在此全量对齐）
}): { connected: boolean; lastEventId: string | null }
// 原生 EventSource 封装：指数退避 1s/2s/5s/15s 封顶；window 'online' 立即重连；
// 解析 SSE 帧为 EventEnvelope；EventSource 原生带 Last-Event-ID
export interface EventEnvelope { id: string; type: string; channel: string; data: any; ts: number }

// api/upload.ts
export async function uploadImage(baseUrl: string, file: Blob, relDir: string): Promise<{ url: string; thumbUrl: string }>
// POST /api/upload multipart；上传前 canvas 重采样最长边 2000（jpeg 0.85）

// api/devAuth.ts（开发期，生产移除）
export async function devLogin(baseUrl: string, userId: string): Promise<void>
export async function logout(baseUrl: string): Promise<void>
```

## 约定

- 客户端 env：`VITE_API_BASE`（缺省 `http://localhost:7200`），经 `import.meta.env` 读取，封装在 shared 的 `getApiBase()`。
- 页面数据一律 TanStack Query（useQuery/useMutation + invalidateQueries）；SSE 事件到达时按事件类型精确 invalidate（如 step_updated → invalidate ['serviceStep','list',aid] 并同时乐观 append 照片）。
- 类型：SessionUser 镜像服务端结构（id/nickname/roles/staffId/storeId）；EventType 常量在 packages/shared/src/constants/events.ts（与服务端 src/realtime/events.ts 同步，T2.0 抄一份并注释保持同步）。
- 六步常量已在 packages/shared/src/constants/steps.ts（P0 建的 STEP_DEFS）——展示层复用。
- 文件所有权：T2.0 = packages/shared/src/api/** + constants/events.ts + apps/customer/src/providers.tsx + pages/DevLoginPage.tsx + vite env 类型；T2.1 = pages/HomePage/PhiliaPage/PetsPage/MemberPage/MomentsPage 及相关 components；T2.2 = pages/Booking*/Appointments*/AppointmentDetailPage + 相关 components；T2.3 = pages/AppointmentLivePage + live 相关 components。**页面占位文件已存在（P0 空壳），在原地改，路由表不许动**（新增子路由需汇报）。
- 设计 token 与组件（ConvexTabBar/StepTimeline/PhotoWall）已就绪，直接 import；视觉遵循 docs/DESIGN.md。
