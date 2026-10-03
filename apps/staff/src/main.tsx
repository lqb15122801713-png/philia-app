import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from '@philia/shared'
import './index.css'
// 员工端骨架整建批片 1：骨架样式库（.sk 作用域；照 index.css 同位全局挂载惯例）
import './styles/skeleton.css'
import App from './App.tsx'
import AppProviders from './providers.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* 批次 9a 任务 E：App 级错误边界（页级在 App.tsx 路由层，两层兜底） */}
      <ErrorBoundary app="staff">
        <AppProviders>
          <App />
        </AppProviders>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
