import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from '@philia/shared'
import './index.css'
import './styles/console.css'
import App from './App.tsx'
import AppProviders from './providers.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* 批次 9a 任务 E：App 级错误边界（页级在 App.tsx 路由层，两层兜底）；
          片 4 D 股：basename=vite BASE_URL（缺省 '/' 行为不变）——生产单域路径分端
          （商家端挂 /admin 前缀）下深链路由不断链 */}
      <ErrorBoundary app="merchant">
        <AppProviders>
          <App />
        </AppProviders>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
