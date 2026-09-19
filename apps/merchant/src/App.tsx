/**
 * 商家端 App 壳（契约 docs/MERCHANT-CONTRACTS.md · T4.1）
 *
 * 装线：AppProviders（main.tsx）+ BrowserRouter（main.tsx）+ RequireMerchant。
 * - /dev-login 与 /login 在守卫之外，且无墨轨；
 * - P0 路由表 10 条原样保留（路径不许改），仅外包 RequireMerchant + MerchantEventsProvider；
 * - MerchantEventsProvider：全端单条 SSE 连接（store:{storeId} 频道），
 *   各页经 context 订阅 SSE，不重复建连（U3：TabBar 已退役为墨轨）。
 */

import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { PageErrorBoundary } from '@philia/shared'
import { Toaster } from '@/components/ui/sonner'
import RequireMerchant from './components/RequireMerchant'
import MerchantRail from './components/MerchantRail'
import MerchantEventsProvider from './components/dashboard/MerchantEventsProvider'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentMonitorPage from './pages/AppointmentMonitorPage'
import AppointmentsPage from './pages/AppointmentsPage'
import BoardingPage from './pages/BoardingPage'
import CashierPage from './pages/CashierPage'
import CashierRecordsPage from './pages/CashierRecordsPage'
import DashboardPage from './pages/DashboardPage'
import DevLoginPage from './pages/DevLoginPage'
import FinancePage from './pages/FinancePage'
import MonitorHubPage from './pages/MonitorHubPage'
import OrdersPage from './pages/OrdersPage'
import PassPage from './pages/PassPage'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import StaffPage from './pages/StaffPage'

// 受商家身份保护的主内容路由（P0 路由表原样保留；U3 追加 /login 与 /pass 规范名）
/** B8-B2：/live/:id → /monitor/:id 重定向（保留参数） */
function MonitorLiveRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/monitor/${id}` : '/monitor'} replace />
}

function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/appointments" element={<AppointmentsPage />} />
      <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
      <Route path="/appointments/:id/monitor" element={<AppointmentMonitorPage />} />
      {/* B8-B2：监视页独立路由补建（P4 既有实现接通，不重设计）。
          /monitor 目录页，/monitor/:id 同监视页别名；/live 系重定向到 /monitor */}
      <Route path="/monitor" element={<MonitorHubPage />} />
      <Route path="/monitor/:id" element={<AppointmentMonitorPage />} />
      <Route path="/live" element={<Navigate to="/monitor" replace />} />
      <Route path="/live/:id" element={<MonitorLiveRedirect />} />
      <Route path="/boarding" element={<BoardingPage />} />
      {/* 批次 M1：收银台（主屏三栏 + 流水屏；墨轨「商城」组首位入口） */}
      <Route path="/cashier" element={<CashierPage />} />
      <Route path="/cashier/records" element={<CashierRecordsPage />} />
      {/* U3：墨轨规范名 /pass（/passes 保留兼容深链） */}
      <Route path="/pass" element={<PassPage />} />
      <Route path="/passes" element={<Navigate to="/pass" replace />} />
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
        {/* 登录页：守卫之外，无墨轨（/login=U3 规范名，/dev-login 兼容） */}
        <Route path="/login" element={<DevLoginPage />} />
        <Route path="/dev-login" element={<DevLoginPage />} />
        <Route
          path="/*"
          element={
            <RequireMerchant>
              <MerchantEventsProvider>
                {/* U3 案 A 墨轨：左导航 190px 常驻 + 右主区滚动；页级错误边界崩一屏不塌全端 */}
                <div className="flex h-screen overflow-hidden">
                  <MerchantRail />
                  <main className="min-w-0 flex-1 overflow-y-auto bg-canvas">
                    <PageErrorBoundary app="merchant">
                      <ProtectedRoutes />
                    </PageErrorBoundary>
                  </main>
                </div>
              </MerchantEventsProvider>
            </RequireMerchant>
          }
        />
      </Routes>
      <Toaster position="top-center" richColors />
    </div>
  )
}
