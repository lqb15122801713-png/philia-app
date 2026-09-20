import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PageErrorBoundary, useMe } from '@philia/shared'
import { Toaster } from '@/components/ui/sonner'
import RequireStaff from './components/RequireStaff'
import StaffDock, { type StaffDockActive } from './components/StaffDock'
import BoardingCheckinPage from './pages/BoardingCheckinPage'
import DevLoginPage from './pages/DevLoginPage'
import ExecutePage from './pages/ExecutePage'
import HistoryPage from './pages/HistoryPage'
import MePage from './pages/MePage'
import AttendancePage from './pages/staff2/AttendancePage'
import InventoryCountPage from './pages/staff2/InventoryCountPage'
import InventoryPage from './pages/staff2/InventoryPage'
import ManagerPage from './pages/staff2/ManagerPage'
import MyReviewsPage from './pages/staff2/MyReviewsPage'
import PayPage from './pages/staff2/PayPage'
import XpPage from './pages/staff2/XpPage'
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
      {/* 批次 员工端2.0（R7~R10）：子页统一 PageHeader 返回条（W1 导航闭环） */}
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/inventory/:id" element={<InventoryCountPage />} />
      <Route path="/pay" element={<PayPage />} />
      <Route path="/xp" element={<XpPage />} />
      <Route path="/reviews" element={<MyReviewsPage />} />
      <Route path="/manager" element={<ManagerPage />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  )
}

// U2 任务 A：dock 仅主级三屏（任务台/历史/我的）；详情级（执行/打卡）走 PageHeader 返回条
const DOCK_TABS: Record<string, StaffDockActive> = { '/today': 'today', '/history': 'history', '/me': 'me' }

export default function App() {
  const { pathname } = useLocation()
  const isDevLogin = pathname === '/dev-login'
  const dockActive = DOCK_TABS[pathname]
  const { user } = useMe()

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className={`mx-auto max-w-lg ${dockActive ? 'pb-[94px]' : ''}`}>
        <Routes>
          {/* 开发登录页：守卫之外，且不显示 Dock（T3.1 新增路由，契约允许） */}
          <Route path="/dev-login" element={<DevLoginPage />} />
          <Route
            path="/*"
            element={
              <RequireStaff>
                {/* 批次 9a 任务 E：页级错误边界（执行/核销链路 /execute/:id 崩一屏不塌全端，Dock 存活） */}
                <PageErrorBoundary app="staff">
                  <ProtectedRoutes />
                </PageErrorBoundary>
              </RequireStaff>
            }
          />
        </Routes>
      </main>
      {!isDevLogin && dockActive && user?.staffId ? (
        <StaffDock active={dockActive} role={user.staffRole === 'frontdesk' ? 'frontdesk' : 'groomer'} />
      ) : null}
      <Toaster position="top-center" richColors />
    </div>
  )
}
