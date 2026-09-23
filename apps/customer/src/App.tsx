import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { PageErrorBoundary } from '@philia/shared'
import RequireAuth from './components/RequireAuth'
import AppDock from './components/AppDock'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentLivePage from './pages/AppointmentLivePage'
import AppointmentsPage from './pages/AppointmentsPage'
import BookingBoardingPage from './pages/BookingBoardingPage'
import BookingGroomingPage from './pages/BookingGroomingPage'
import BookingSuccessPage from './pages/BookingSuccessPage'
import BoardingSinglePage from './pages/BoardingSinglePage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import DevLoginPage from './pages/DevLoginPage'
import GroomingSinglePage from './pages/GroomingSinglePage'
import HomePage from './pages/HomePage'
import MallOrdersPage from './pages/MallOrdersPage'
import MallPage from './pages/MallPage'
import MePage from './pages/MePage'
import MemberCardPage from './pages/MemberCardPage'
import MemberCenterPage from './pages/MemberCenterPage'
import MemberOpenPage from './pages/MemberOpenPage'
import MemberPage from './pages/MemberPage'
import MomentsPage from './pages/MomentsPage'
import PetsPage from './pages/PetsPage'
import PhiliaPage from './pages/PhiliaPage'
import ProductDetailPage from './pages/ProductDetailPage'

// B9.3 任务 B：/booking 中间层（类型选择 hub）退役——直接重定向单屏；
// 兼容旧深链 ?type=boarding → 寄养单屏，?storeId= 透传（首页门店卡深链口径保留）。
function BookingRedirect() {
  const [searchParams] = useSearchParams()
  const base = searchParams.get('type') === 'boarding' ? '/booking/boarding' : '/booking/grooming'
  const storeId = searchParams.get('storeId')
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''
  return <Navigate to={`${base}${query}`} replace />
}

// 受登录保护的主内容路由（P0 路由表原样保留）
function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/mall" element={<MallPage />} />
      {/* T5.3 商城子路由（契约允许新增子路由，已向主代理汇报） */}
      <Route path="/mall/product/:id" element={<ProductDetailPage />} />
      <Route path="/mall/cart" element={<CartPage />} />
      <Route path="/mall/checkout" element={<CheckoutPage />} />
      <Route path="/mall/orders" element={<MallOrdersPage />} />
      <Route path="/philia" element={<PhiliaPage />} />
      <Route path="/philia/pets" element={<PetsPage />} />
      <Route path="/philia/member" element={<MemberPage />} />
      <Route path="/philia/moments" element={<MomentsPage />} />
      {/* B9.3 任务 B：hub 退役，/booking 直达洗护单屏（?type=boarding 兼容深链寄养） */}
      <Route path="/booking" element={<BookingRedirect />} />
      {/* B4-1：默认路由换新单屏；旧 4 屏向导保留隐藏路由 /wizard（回滚保障，下批次再删） */}
      <Route path="/booking/grooming" element={<GroomingSinglePage />} />
      <Route path="/booking/grooming/wizard" element={<BookingGroomingPage />} />
      {/* B4-2：寄养同上——默认路由换单屏，旧向导保留隐藏路由 /booking/boarding/wizard */}
      <Route path="/booking/boarding" element={<BoardingSinglePage />} />
      <Route path="/booking/boarding/wizard" element={<BookingBoardingPage />} />
      <Route path="/booking/success" element={<BookingSuccessPage />} />
      <Route path="/appointments" element={<AppointmentsPage />} />
      <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
      <Route path="/appointments/:id/live" element={<AppointmentLivePage />} />
      <Route path="/me" element={<MePage />} />
      {/* U1-H：会员卡页新路由（信息展示 v0；详情级——无 dock，统一返回条） */}
      <Route path="/me/card" element={<MemberCardPage />} />
      {/* R11a 骨架批：会员中心/开通页新路由（详情级无 dock，统一返回条固定回 /me、/member；
          申报锚点=页面标题「会员中心」「开通会员」） */}
      <Route path="/member" element={<MemberCenterPage />} />
      <Route path="/member/open" element={<MemberOpenPage />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const isDevLogin = pathname === '/dev-login'
  // U1-A：全局 dock 统一为 <AppDock>，仅主级页面渲染（首页/商城/我的/philia）；
  // 预约单屏等详情级页面一律不渲染 dock，走统一返回条（components/PageHeader）。
  // 旧 ConvexTabBar（五栏凸起）与 9a.3 HomeDock（首页三栏 pill）已退役删除。
  const isMainPath =
    pathname === '/' ||
    pathname === '/home' ||
    pathname === '/mall' ||
    pathname === '/me' ||
    pathname === '/philia'

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-lg pb-24">
        <Routes>
          {/* 开发登录页：守卫之外，且不显示 dock（T2.0 新增路由，已向主代理汇报） */}
          <Route path="/dev-login" element={<DevLoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                {/* 批次 9a 任务 E：页级错误边界（按路由 key 重置，崩一屏不塌全端，dock 存活） */}
                <PageErrorBoundary app="customer">
                  <ProtectedRoutes />
                </PageErrorBoundary>
              </RequireAuth>
            }
          />
        </Routes>
      </main>
      {!isDevLogin && isMainPath && <AppDock />}
    </div>
  )
}
