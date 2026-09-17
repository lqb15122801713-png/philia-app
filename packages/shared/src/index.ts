/**
 * @philia/shared — 三端共享包
 *
 * 设计 tokens（唯一常量来源）+ 共享组件 + 服务流程常量。
 * 组件基于 React 18 + Tailwind（类名来自 @philia/config/tailwind-preset），
 * 图标用 lucide-react，导航回退用 react-router-dom（均为各端 app 已有依赖）。
 */

// 设计 tokens
export * from './tokens';

// 六步服务流程常量
export * from './constants/steps';

// 实时事件常量（与服务端 server/src/realtime/events.ts 同步）
export * from './constants/events';

// 客户端共享 API 层（契约 docs/CLIENT-CONTRACTS.md · T2.0）
export * from './api/client';
export * from './api/upload';
export * from './api/devAuth';
// 安全 UUID（b9.1：crypto.randomUUID 仅安全上下文存在，HTTP 内测环境模板兜底）
export { safeUuid } from './lib/safeUuid';
// hooks 显式导出：EventEnvelope 以契约形（data: any）覆盖 constants/events 的同名导出
export { useMe, useEventSource, SSE_BACKOFF_DELAYS, backoffDelay } from './api/hooks';
export type { EventEnvelope } from './api/hooks';

// 共享组件
// U1-A：ConvexTabBar（五栏凸起 dock）已随客户端全局 dock 统一退役删除，
// 客户端改用 apps/customer/src/components/AppDock。
export { default as StepTimeline } from './components/StepTimeline';
export type { StepTimelineStep, StepTimelineProps } from './components/StepTimeline';

export { default as PhotoWall } from './components/PhotoWall';
export type { PhotoWallPhoto, PhotoWallProps } from './components/PhotoWall';

export { default as ErrorBoundary, PageErrorBoundary } from './components/ErrorBoundary';
export type {
  ClientErrorReport,
  ErrorBoundaryProps,
  PhiliaAppKind,
} from './components/ErrorBoundary';
export { buildClientErrorReport, reportClientError } from './components/ErrorBoundary';
