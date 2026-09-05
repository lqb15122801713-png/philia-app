import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import RequireStaff from './components/RequireStaff'
import TabBar from './components/TabBar'
import BoardingCheckinPage from './pages/BoardingCheckinPage'
import DevLoginPage from './pages/DevLoginPage'
import ExecutePage from './pages/ExecutePage'
import HistoryPage from './pages/HistoryPage'
import MePage from './pages/MePage'
import TodayPage from './pages/TodayPage'

// 受员工身份保护的主内容路由（P0 路由表原样保留，路径不许改）
function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/execute/:appointmentId" element={<ExecutePage />} />
      <Route path="/boarding/:id/checkin" element={<BoardingCheckinPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/me" element={<MePage />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const isDevLogin = pathname === '/dev-login'

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-lg pb-24">
        <Routes>
          {/* 开发登录页：守卫之外，且不显示 TabBar（T3.1 新增路由，契约允许） */}
          <Route path="/dev-login" element={<DevLoginPage />} />
          <Route
            path="/*"
            element={
              <RequireStaff>
                <ProtectedRoutes />
              </RequireStaff>
            }
          />
        </Routes>
      </main>
      {!isDevLogin && <TabBar />}
      <Toaster position="top-center" richColors />
    </div>
  )
}
