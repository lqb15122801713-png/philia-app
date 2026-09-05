/**
 * 商家端 App 壳（契约 docs/MERCHANT-CONTRACTS.md · T4.1）
 *
 * 装线：AppProviders（main.tsx）+ BrowserRouter（main.tsx）+ RequireMerchant。
 * - /dev-login 在守卫之外，且无 TabBar；
 * - P0 路由表 10 条原样保留（路径不许改），仅外包 RequireMerchant + MerchantEventsProvider；
 * - MerchantEventsProvider：全端单条 SSE 连接（store:{storeId} 频道），
 *   DashboardPage 与 TabBar 红点经 context 订阅，不重复建连。
 */

import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import RequireMerchant from './components/RequireMerchant'
import TabBar from './components/TabBar'
import MerchantEventsProvider from './components/dashboard/MerchantEventsProvider'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentMonitorPage from './pages/AppointmentMonitorPage'
import AppointmentsPage from './pages/AppointmentsPage'
import BoardingPage from './pages/BoardingPage'
import DashboardPage from './pages/DashboardPage'
import DevLoginPage from './pages/DevLoginPage'
import FinancePage from './pages/FinancePage'
import OrdersPage from './pages/OrdersPage'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import StaffPage from './pages/StaffPage'

// 受商家身份保护的主内容路由（P0 路由表原样保留，路径不许改）
function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/appointments" element={<AppointmentsPage />} />
      <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
      <Route path="/appointments/:id/monitor" element={<AppointmentMonitorPage />} />
      <Route path="/boarding" element={<BoardingPage />} />
      <Route path="/staff" element={<StaffPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/finance" element={<FinancePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Routes>
        {/* 开发登录页：守卫之外，且不显示 TabBar */}
        <Route path="/dev-login" element={<DevLoginPage />} />
        <Route
          path="/*"
          element={
            <RequireMerchant>
              <MerchantEventsProvider>
                {/* 平板横屏优先：内容区放宽到 max-w-5xl，手机自然单列降级 */}
                <main className="mx-auto w-full max-w-5xl pb-24">
                  <ProtectedRoutes />
                </main>
                <TabBar />
              </MerchantEventsProvider>
            </RequireMerchant>
          }
        />
      </Routes>
      <Toaster position="top-center" richColors />
    </div>
  )
}
