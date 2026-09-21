/**
 * 商家端 App 壳（契约 docs/MERCHANT-CONTRACTS.md · T4.1）
 *
 * 装线：AppProviders（main.tsx）+ BrowserRouter（main.tsx）+ RequireMerchant。
 * - /dev-login 与 /login 在守卫之外，且无墨轨；
 * - P0 路由表 10 条原样保留（路径不许改），仅外包 RequireMerchant + MerchantEventsProvider；
 * - MerchantEventsProvider：全端单条 SSE 连接（store:{storeId} 频道），
 *   各页经 context 订阅 SSE，不重复建连（U3：TabBar 已退役为墨轨）。
 */

import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { PageErrorBoundary } from '@philia/shared'
import { Toaster } from '@/components/ui/sonner'
import RequireMerchant from './components/RequireMerchant'
import MerchantRail from './components/MerchantRail'
import RoleGuidePage from './components/RoleGuidePage'
import MerchantEventsProvider from './components/dashboard/MerchantEventsProvider'
import { CLERK_ALLOWED_PATHS, clerkGuideText, useMerchantRole } from '@/lib/roles'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentMonitorPage from './pages/AppointmentMonitorPage'
import AppointmentsPage from './pages/AppointmentsPage'
import BoardingPage from './pages/BoardingPage'
import CashierClosePage from './pages/CashierClosePage'
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
import RulesConfigPage from './pages/RulesConfigPage'
import StaffPage from './pages/StaffPage'

// 受商家身份保护的主内容路由（P0 路由表原样保留；U3 追加 /login 与 /pass 规范名）
/** B8-B2：/live/:id → /monitor/:id 重定向（保留参数） */
function MonitorLiveRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/monitor/${id}` : '/monitor'} replace />
}

/** M1-补2 G：根路径按角色分流——clerk 落地收银台（任务书：clerk 登录默认跳 /cashier） */
function RoleLanding() {
  const { isClerk } = useMerchantRole()
  return <Navigate to={isClerk ? '/cashier' : '/dashboard'} replace />
}

/**
 * M1-补2 G：clerk 路由白名单守卫（矩阵总规则②：店员只见收银台主屏；
 * 直达其他页给明确引导页，非 403 白屏）。owner/manager 原样放行。
 */
function ClerkRouteGuard({ children }: { children: React.ReactNode }) {
  const { isClerk } = useMerchantRole()
  const { pathname } = useLocation()
  if (isClerk && !CLERK_ALLOWED_PATHS.some((p) => pathname === p)) {
    const g = clerkGuideText(pathname)
    return <RoleGuidePage title={g.title} hint={g.hint} />
  }
  return <>{children}</>
}

function ProtectedRoutes() {
  return (
    <ClerkRouteGuard>
      <Routes>
        <Route path="/" element={<RoleLanding />} />
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
        {/* 批次 M1：收银台（主屏三栏 + 流水屏；墨轨「商城」组首位入口）
            M1-补2 C：日结/交接班页 /cashier/close（owner|manager 自装页；clerk 引导页） */}
        <Route path="/cashier" element={<CashierPage />} />
        <Route path="/cashier/records" element={<CashierRecordsPage />} />
        <Route path="/cashier/close" element={<CashierClosePage />} />
        {/* U3：墨轨规范名 /pass（/passes 保留兼容深链） */}
        <Route path="/pass" element={<PassPage />} />
        <Route path="/passes" element={<Navigate to="/pass" replace />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* 批次 员工端2.0 R9-F：规则配置管理端口（owner-only；clerk 由 ClerkRouteGuard 拦，manager 页内引导页，server 硬 403） */}
        <Route path="/settings/rules" element={<RulesConfigPage />} />
        <Route path="*" element={<RoleLanding />} />
      </Routes>
    </ClerkRouteGuard>
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
