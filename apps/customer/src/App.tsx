import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import TabBar from './components/TabBar'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentLivePage from './pages/AppointmentLivePage'
import AppointmentsPage from './pages/AppointmentsPage'
import BookingBoardingPage from './pages/BookingBoardingPage'
import BookingGroomingPage from './pages/BookingGroomingPage'
import BookingPage from './pages/BookingPage'
import BookingSuccessPage from './pages/BookingSuccessPage'
import DevLoginPage from './pages/DevLoginPage'
import HomePage from './pages/HomePage'
import MallPage from './pages/MallPage'
import MePage from './pages/MePage'
import MemberPage from './pages/MemberPage'
import MomentsPage from './pages/MomentsPage'
import PetsPage from './pages/PetsPage'
import PhiliaPage from './pages/PhiliaPage'

// 受登录保护的主内容路由（P0 路由表原样保留）
function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/mall" element={<MallPage />} />
      <Route path="/philia" element={<PhiliaPage />} />
      <Route path="/philia/pets" element={<PetsPage />} />
      <Route path="/philia/member" element={<MemberPage />} />
      <Route path="/philia/moments" element={<MomentsPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/booking/grooming" element={<BookingGroomingPage />} />
      <Route path="/booking/boarding" element={<BookingBoardingPage />} />
      <Route path="/booking/success" element={<BookingSuccessPage />} />
      <Route path="/appointments" element={<AppointmentsPage />} />
      <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
      <Route path="/appointments/:id/live" element={<AppointmentLivePage />} />
      <Route path="/me" element={<MePage />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
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
          {/* 开发登录页：守卫之外，且不显示 TabBar（T2.0 新增路由，已向主代理汇报） */}
          <Route path="/dev-login" element={<DevLoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <ProtectedRoutes />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
      {!isDevLogin && <TabBar />}
    </div>
  )
}
