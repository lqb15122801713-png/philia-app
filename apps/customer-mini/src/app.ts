import type { PropsWithChildren } from 'react';
import './app.css';

/**
 * Philia 客户端小程序入口（批次 7.1 任务 A）
 * 全局 Provider（登录态等）在任务 B 装配；本批仅页面骨架。
 */
function App({ children }: PropsWithChildren) {
  return children;
}

export default App;
