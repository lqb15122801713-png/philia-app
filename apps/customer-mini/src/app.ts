import type { PropsWithChildren } from 'react';
import Taro, { useLaunch } from '@tarojs/taro';
import { fetchMe } from './lib/auth';
import './app.css';

/**
 * Philia 客户端小程序入口（批次 7.1 任务 B）
 * 启动守卫：auth.me 探活，未登录/会话失效 → reLaunch 登录页（登录 → 进首页口径）。
 */
function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    fetchMe().catch(() => {
      const pages = Taro.getCurrentPages();
      const route = pages.length ? pages[pages.length - 1]!.route : '';
      if (route !== 'pages/login/index') {
        Taro.reLaunch({ url: '/pages/login/index' });
      }
    });
  });
  return children;
}

export default App;
