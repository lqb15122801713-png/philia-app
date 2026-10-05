/**
 * 全局错误边界（批次 9a · 任务 E）：渲染崩溃不再白屏
 *
 * 背景：批次 8 残余缺陷——应用内跳转白屏（数据/时序依赖型，沙箱未复现）。
 * 本组件为根治取证：任何渲染崩溃 → 统一出错页（VI 空态插画 + 友好文案 +
 * 错误摘要 + 重试/回首页），并把错误摘要上报 POST /api/client-error。
 *
 * 两层用法（三端统一）：
 *   1. App 级：<ErrorBoundary app="customer"> 包 main.tsx 根（塌到最外层也有兜底）；
 *   2. 页级：<PageErrorBoundary app="customer"> 包 Routes（按 pathname key 重置，
 *      崩一屏不塌全端：TabBar 与相邻路由不受影响；切路由即自愈）。
 *
 * 错误摘要采集：路由、message 首行、堆栈首帧、组件栈首帧、时间、UA、端。
 * 同步 console.error 一行（生产可读：端 + 路由 + message + 首帧，单行 JSON 友好）。
 *
 * 零新依赖：插画复用各端 public/brand/empty-appointments-800.png（既有 VI 空态资产）；
 * className 全部来自 @philia/config/tailwind-preset 既有 token；上报地址复用
 * ../api/client 的 getApiBase()。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiBase } from '../api/client';

/** 端标识（与上报端点白名单一致） */
export type PhiliaAppKind = 'customer' | 'merchant' | 'staff';

/** 客户端错误上报载荷（与 server /api/client-error 契约一致） */
export interface ClientErrorReport {
  app: PhiliaAppKind;
  /** 出错路由（pathname + search） */
  route: string;
  /** error.message 首行 */
  message: string;
  /** JS 堆栈首帧（at ... 行），取不到为 null */
  stackFirstFrame: string | null;
  /** React 组件栈首帧，取不到为 null */
  componentStackFirstFrame: string | null;
  /** 客户端发生时间（ISO） */
  time: string;
  /** navigator.userAgent */
  ua: string;
}

/** 取堆栈首帧：跳过 message 行，找首条 `at ` 帧 */
function firstFrame(stack: string | undefined | null): string | null {
  if (!stack) return null;
  for (const line of stack.split('\n')) {
    const t = line.trim();
    if (t.startsWith('at ')) return t.slice(3);
  }
  return null;
}

/** 组装错误摘要（纯函数，便于测试） */
export function buildClientErrorReport(
  app: PhiliaAppKind,
  error: Error,
  info: ErrorInfo,
): ClientErrorReport {
  return {
    app,
    route: `${window.location.pathname}${window.location.search}`,
    message: (error?.message || String(error)).split('\n')[0] ?? 'unknown error',
    stackFirstFrame: firstFrame(error?.stack),
    componentStackFirstFrame: firstFrame(info?.componentStack),
    time: new Date().toISOString(),
    ua: navigator.userAgent,
  };
}

/** 上报：console 同步一行（生产可读）+ POST /api/client-error（尽力而为，绝不二次出错） */
export function reportClientError(report: ClientErrorReport): void {
  // 生产可读单行：端 / 路由 / message / 首帧 / 时间
  console.error(
    `[client-error] ${report.app} ${report.route} :: ${report.message}` +
      ` @ ${report.componentStackFirstFrame ?? report.stackFirstFrame ?? 'unknown'} (${report.time})`,
  );
  try {
    void fetch(`${getApiBase()}/api/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      // 页面即将跳转/卸载时也尽量发出；不带会话 cookie（崩溃可能发生在未登录态）
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    // 上报失败绝不影响出错页渲染
  }
}

export interface ErrorBoundaryProps {
  app: PhiliaAppKind;
  children: ReactNode;
  /** 「回首页」目标，缺省 '/'（各端根路由均重定向到各自首页） */
  homePath?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** 出错时的组件栈首帧（出错页摘要展示用） */
  componentStackFirstFrame: string | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, componentStackFirstFrame: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const report = buildClientErrorReport(this.props.app, error, info);
    this.setState({ componentStackFirstFrame: report.componentStackFirstFrame });
    reportClientError(report);
  }

  private readonly handleRetry = (): void => {
    this.setState({ error: null, componentStackFirstFrame: null });
  };

  private readonly handleGoHome = (): void => {
    // 整页跳转：彻底脱离出错现场（含任何损坏的内存态），各端 '/' 均重定向到首页
    window.location.assign(this.props.homePath ?? '/');
  };

  override render(): ReactNode {
    const { error, componentStackFirstFrame } = this.state;
    if (!error) return this.props.children;

    const message = (error.message || String(error)).split('\n')[0];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-8 py-10 text-center">
        {/* VI 空态插画（复用既有 empty 资产，不重设计） */}
        <img src="/brand/empty-appointments-800.png" alt="" className="w-40 max-w-full rounded-card" />
        <h1 className="mt-6 text-title text-ink">页面出了点小状况</h1>
        <p className="mt-2 text-body text-ink-secondary">
          这次错误已经自动记录，我们会尽快排查。
        </p>
        {/* 错误摘要：message 首行 + 组件栈首帧 */}
        <div className="mt-4 w-full max-w-sm rounded-input bg-sunken px-4 py-3 text-left">
          <p className="break-all text-caption text-ink-secondary">{message}</p>
          {componentStackFirstFrame ? (
            <p className="mt-1 break-all text-caption text-ink-placeholder">
              at {componentStackFirstFrame}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="h-11 rounded-full bg-brand-primary px-8 text-body font-medium text-ink shadow-card transition-colors duration-120 hover:bg-brand-primary-hover active:bg-brand-primary-pressed"
          >
            重试
          </button>
          <button
            type="button"
            onClick={this.handleGoHome}
            className="h-11 rounded-full border-[1.5px] border-line-strong bg-card px-8 text-body font-medium text-ink transition-colors duration-120 hover:bg-sunken"
          >
            回首页
          </button>
        </div>
      </div>
    );
  }
}

/**
 * 页级错误边界：按路由 pathname key 化，切路由自动重置（崩一屏不塌全端）。
 * 需挂在 Router 上下文内（react-router-dom 为 shared peerDependency，各端均有）。
 */
export function PageErrorBoundary({ app, children, homePath }: ErrorBoundaryProps) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} app={app} homePath={homePath}>
      {children}
    </ErrorBoundary>
  );
}
