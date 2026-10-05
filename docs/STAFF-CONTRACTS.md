# 员工端共享契约（P3 并行开发防冲突 · 各子代理严格遵守）

> 共享层 packages/shared 的 API 已就绪（T2.0）：`usePhiliaClient / useMe / useEventSource / uploadImage / getApiBase / EventType`，`import { ... } from '@philia/shared'`。
> 后端关键过程（已上线）：`appointment.listTodayForStaff / get / checkin`、`serviceStep.list / addPhotos / confirmStep`、`boarding.checkinStay / dailyLog / myStay(myStay 是 customerProcedure，员工勿用)`、`push.subscribe`。
> 员工端会话：staff 角色用户（种子 3 个员工），/dev-login 登录（同客户端模式）。

## 文件所有权矩阵（apps/staff/ 下）

| 文件/目录 | 所有者 |
|---|---|
| src/providers.tsx、src/components/RequireStaff.tsx、src/pages/DevLoginPage.tsx、src/main.tsx、src/App.tsx（仅装线，路由表已有） | T3.1 coder-today |
| src/pages/TodayPage.tsx、HistoryPage.tsx、MePage.tsx、src/components/today/** | T3.1 coder-today |
| src/components/scan/**（QrScanner.tsx、ManualCodeInput.tsx、useCheckin.ts） | T3.2 coder-scan |
| src/pages/ExecutePage.tsx、src/components/execute/**、src/lib/offlineQueue.ts | T3.3 coder-sixstep |
| src/pages/BoardingCheckinPage.tsx、src/components/boarding/** | T3.4 coder-boarding-staff |

## 契约 1：扫码核销（T3.2 实现，T3.1 调用）

```tsx
// components/scan/QrScanner.tsx
export interface QrScannerProps {
  open: boolean;
  onClose(): void;
  onCheckedIn(result: { appointmentId: string; nextRoute: string }): void;
}
// 全屏模态：摄像头取景（优先 BarcodeDetector；不支持则 jsQR+canvas 帧循环解码）；
// 解码成功 → useCheckin(qr=原文) → 成功回调 onCheckedIn；底部「手动输入核销码」入口（ManualCodeInput，6 位大写）；
// 错误映射：429→"尝试过多，已锁定 10 分钟"；FORBIDDEN(已指派他人/非同店)→原文案 toast；
// 二维码过期→"预约码已失效，请让客户刷新或报手机号手动核销"；幂等（已核销）→视为成功直接进入。

// components/scan/useCheckin.ts
export function useCheckin(): {
  checkin(input: { qr: string } | { code: string }): Promise<{ appointmentId: string; nextRoute: string }>;
  loading: boolean;
}
// nextRoute 直接用服务端返回（grooming→/execute/:id，boarding→/boarding/:id/checkin）
```

T3.1 的 TodayPage 顶部「扫码核销」大按钮直接渲染 `<QrScanner open={scanOpen} ... />`（懒加载 import）。

## 契约 2：弱网上传队列（T3.3 实现自用，接口留给 T3.4 复用）

```ts
// src/lib/offlineQueue.ts
export interface QueuedPhoto { id: string; aid: string; stepKey: string; blob: Blob; createdAt: number }
export function enqueuePhoto(p: Omit<QueuedPhoto, 'id' | 'createdAt'>): Promise<string>
export function pendingPhotos(aid: string, stepKey?: string): Promise<QueuedPhoto[]>
export function removePhoto(id: string): Promise<void>
export function startQueueFlusher(opts: {
  upload: (blob: Blob, relDir: string) => Promise<{ url: string; thumbUrl: string }>;
  register: (aid: string, stepKey: string, photo: { url: string; thumbUrl: string }) => Promise<void>; // serviceStep.addPhotos
  onChange?: () => void;
}): () => void
// IndexedDB 库 philia-staff-queue；在线即冲、'online' 事件即冲、失败指数退避重试；
// 冲完一条：先 upload → 再 register（addPhotos 落库）→ 才删队列记录（保证不丢）。
```

## 通用约定

- 员工端设计规格（docs/DESIGN.md §三端侧重）：手机竖屏单手、按钮 ≥56px、正文字体 ≥16px（`text-body-lg`）、拇指热区底部主按钮、大目标点击区 ≥48px。
- SSE：push.subscribe（clientId 复用 localStorage `philia.sseClientId`，appType='staff'）→ /api/events；事件到达按类型 invalidate（`appointment.assigned/rescheduled/cancelled/step_flagged` → today 列表与 execute 页）。
- 图片：拍照用 `<input type="file" accept="image/*" capture="environment">`（PWA 下最稳），多张连拍累加；上传走共享层 uploadImage（自动压缩）。
- 金额分→元显示；时间 HH:mm；全部中文文案。
- 验证约束（四个代理并行）：**只能 `npx vite build`（跳过 tsc）自检；不得起任何 server/dev 进程**；tsc 全量由主代理集成时跑。
