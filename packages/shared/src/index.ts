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
// hooks 显式导出：EventEnvelope 以契约形（data: any）覆盖 constants/events 的同名导出
export { useMe, useEventSource, SSE_BACKOFF_DELAYS, backoffDelay } from './api/hooks';
export type { EventEnvelope } from './api/hooks';

// 共享组件
export { default as ConvexTabBar } from './components/ConvexTabBar';
export type { ConvexTabBarItem, ConvexTabBarProps } from './components/ConvexTabBar';

export { default as StepTimeline } from './components/StepTimeline';
export type { StepTimelineStep, StepTimelineProps } from './components/StepTimeline';

export { default as PhotoWall } from './components/PhotoWall';
export type { PhotoWallPhoto, PhotoWallProps } from './components/PhotoWall';
