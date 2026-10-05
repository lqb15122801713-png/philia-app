# server 内部接口契约（P1 并行开发防冲突 · 各子代理严格遵守）

> 本文件是 T1.2 / T1.3 / T1.4 / T1.5 并行开发的唯一契约来源。
> 文件所有权：谁负责谁创建，**不许改别人名下的文件**；跨文件引用一律按本契约的签名来。

## 文件所有权矩阵

| 文件/目录 | 所有者 |
|---|---|
| src/trpc.ts、src/auth/*、src/routers/auth.ts | T1.2 coder-auth |
| src/realtime/*、src/routers/push.ts、src/routes/events.ts | T1.4 coder-realtime |
| src/storage/*、src/routes/upload.ts | T1.5 coder-upload |
| src/routers/appointment.ts、src/routers/serviceStep.ts、src/routers/boarding.ts、src/routers/pet.ts、src/routers/store.ts | T1.3 coder-appt（下一批） |
| src/routers/index.ts（appRouter 合并）、src/index.ts（Hono 入口） | T1.6 集成（最后） |
| src/db/* | 已完成（T1.1），所有人只读引用 |

## 契约 1：tRPC 基座（T1.2 创建 src/trpc.ts，其他人 import）

```ts
// src/trpc.ts 必须导出：
export interface SessionUser {
  id: string; nickname: string | null;
  roles: Array<'customer' | 'merchant_owner' | 'merchant_manager' | 'staff'>;
  staffId?: string;   // 若为 staff，其 staff 记录 id
  storeId?: string;   // staff 所属门店 / merchant 管理门店
}
export interface Context { db: Db; user: SessionUser | null; }
export const router: ...;            // t.router
export const publicProcedure: ...;   // 要求 user 非空（已登录），否则 UNAUTHORIZED
export const customerProcedure: ...; // publicProcedure + roles 含 customer
export const staffProcedure: ...;    // publicProcedure + staffId 存在（user.staffId/storeId 必已填）
export const merchantProcedure: ...; // publicProcedure + roles 含 merchant_owner|merchant_manager + storeId 存在
// 以及工具函数：
export async function assertAppointmentAccess(ctx, appointmentId): Promise<appointment 行>
// 归属校验：customer=本人预约 / staff=本店且(未指派或指派给自己) / merchant=本店；不通过抛 FORBIDDEN
```

其他代理引用方式：`import { router, staffProcedure, ... } from '../trpc'`（注意从 src/routers/* 出发的相对路径是 `../trpc`）。

## 契约 2：事件总线（T1.4 创建 src/realtime/bus.ts）

```ts
// 供业务 router 使用（T1.3 会调用）：
/** 事务内调用：写 event_outbox + notifications（按 resolveChannelTargets 解析的接收人）。返回 outbox id。 */
export function emitEvent(db: Db, channel: string, eventType: string, data: Record<string, unknown>): Promise<string>;
/** 事务提交后调用：把 outbox 事件即时广播到在线 SSE 连接。 */
export function broadcastNow(outboxId: string): void;
/** 频道 → 接收用户集合解析（user:{uid} / store:{storeId} / staff:{staffId} / appointment:{aid}）。 */
export function resolveChannelTargets(db: Db, channel: string): Promise<string[]>; // userId 数组
```

事件类型常量：T1.4 把开发方案 §7.3 的 `EventType` 常量写进 `src/realtime/events.ts` 并导出（三端共用语义，先落在 server，后续 packages/shared 再同步）。

## 契约 3：上传与签名 URL（T1.5 创建）

```ts
// src/storage/sign.ts 必须导出：
export function signImagePath(relPath: string, expiresInSec?: number): string; // 返回带签名访问路径
export function verifyImageSignature(relPath: string, sig: string, exp: number): boolean;
// src/storage/images.ts 必须导出：
export interface UploadedImage { url: string; thumbUrl: string; }
export async function processAndStoreImage(buf: Buffer, relDir: string): Promise<UploadedImage>;
// 缩略图统一 400px 最长边；存储根 server/uploads/；图片访问路由 GET /api/img/* 由 T1.5 的 src/routes/images.ts 提供（Hono handler，验签通过才给文件）
```

## 通用约定

- DB 访问一律 `import { db, schema } from '../db'`（或按需从 Context 取 db）；ULID 用 `ulid` 包。
- 时间戳：schema 是 integer timestamp（Unix 秒），JS 侧用 Date 对象读写（drizzle 自动转换）。
- `updated_at` 应用层显式写入（SQLite 无 ON UPDATE）。
- 所有 zod 输入校验；错误用 TRPCError（FORBIDDEN/NOT_FOUND/BAD_REQUEST/TOO_MANY_REQUESTS）。
- 每个交付物自带一个 `src/**/__tests__` 或 scripts/ 下的冒烟脚本证明可用（tsx 直跑），并贴验证输出进汇报。
- 端口约定：server dev 端口 7200（T1.6 才需要起整服务；各代理自己的冒烟脚本用独立临时端口或直接函数级测试）。
