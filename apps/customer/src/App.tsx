import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { PageErrorBoundary } from '@philia/shared'
import RequireAuth from './components/RequireAuth'
import AppDock from './components/AppDock'
import InstallBanner from './components/pwa/InstallBanner'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentLivePage from './pages/AppointmentLivePage'
import AppointmentsPage from './pages/AppointmentsPage'
import BookingBoardingPage from './pages/BookingBoardingPage'
import BookingGroomingPage from './pages/BookingGroomingPage'
import BookingSuccessPage from './pages/BookingSuccessPage'
import BoardingSinglePage from './pages/BoardingSinglePage'
import CartPage from './pages/CartPage'
import CertDetailPage from './pages/CertDetailPage'
import CertListPage from './pages/CertListPage'
import CheckoutPage from './pages/CheckoutPage'
import CouponsPage from './pages/CouponsPage'
import DevLoginPage from './pages/DevLoginPage'
import GroomingSinglePage from './pages/GroomingSinglePage'
import HomePage from './pages/HomePage'
import InvoiceApplyPage from './pages/InvoiceApplyPage'
import InvoiceDetailPage from './pages/InvoiceDetailPage'
import InvoiceListPage from './pages/InvoiceListPage'
import MallOrdersPage from './pages/MallOrdersPage'
import MallPage from './pages/MallPage'
import MePage from './pages/MePage'
import SettingsPage from './pages/SettingsPage'
import DeactivatePage from './pages/DeactivatePage'
import ChangePhonePage from './pages/ChangePhonePage'
import PhoneAppealPage from './pages/PhoneAppealPage'
import DevicesPage from './pages/DevicesPage'
import PrivacyPage from './pages/PrivacyPage'
import MemberCardPage from './pages/MemberCardPage'
import MemberCenterPage from './pages/MemberCenterPage'
import MemberChangePage from './pages/MemberChangePage'
import MemberOpenPage from './pages/MemberOpenPage'
import MemberCheckoutPage from './pages/MemberCheckoutPage'
import PayReconcilePage from './pages/PayReconcilePage'
import PayStatePage from './pages/PayStatePage'
import MemberRebatePage from './pages/MemberRebatePage'
import MemberUpgradePage from './pages/MemberUpgradePage'
import MomentsPage from './pages/MomentsPage'
import NotifyCenterPage from './pages/NotifyCenterPage'
import NotifyPrefsPage from './pages/NotifyPrefsPage'
import PetsPage from './pages/PetsPage'
import PetHealthPage from './pages/PetHealthPage'
import PhiliaPage from './pages/PhiliaPage'
import ProductDetailPage from './pages/ProductDetailPage'
import RefundApplyPage from './pages/RefundApplyPage'
import RefundDetailPage from './pages/RefundDetailPage'
import RefundListPage from './pages/RefundListPage'
import ReportPage from './pages/ReportPage'
import TicketDetailPage from './pages/TicketDetailPage'
import TicketListPage from './pages/TicketListPage'
import TicketNewPage from './pages/TicketNewPage'
import ProfileEditPage from './pages/ProfileEditPage'
import AddressesPage from './pages/AddressesPage'
import AboutPage from './pages/AboutPage'
import AgreementsPage from './pages/AgreementsPage'
import InvoiceTitlesPage from './pages/InvoiceTitlesPage'
import RecordsPage from './pages/RecordsPage'

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
      {/* 补缺批片 1 退款售后：表单双路由同组件双 orderKind 参数化 + 列表/进度详情 */}
      <Route path="/mall/orders/:id/refund" element={<RefundApplyPage orderKind="order" />} />
      <Route path="/appointments/:id/refund" element={<RefundApplyPage orderKind="appointment" />} />
      <Route path="/refunds" element={<RefundListPage />} />
      <Route path="/refunds/:id" element={<RefundDetailPage />} />
      <Route path="/philia" element={<PhiliaPage />} />
      <Route path="/philia/pets" element={<PetsPage />} />
      {/* 体验批片 4：宠物健康档案（健康记录族+体重趋势；详情级无 dock；
          申报锚点=「健康档案」，双表已申报 check-nav-closure/smoke-routes） */}
      <Route path="/philia/pets/:id/health" element={<PetHealthPage />} />
      {/* R11a 裁定：旧路由 /philia/member 退役——重定向往 /member 会员中心（路径保留，
          兼容旧深链与 check-nav-closure 既有申报行） */}
      <Route path="/philia/member" element={<Navigate to="/member" replace />} />
      <Route path="/philia/moments" element={<MomentsPage />} />
      {/* 补缺大批片 4（服务闭环点亮）：安心证书 / 美容报告 / 小棉花工单 / 发票申请
          （9 条新路由；双表申报 8 行=/invoices/:id 详情行报备补登） */}
      <Route path="/philia/certs" element={<CertListPage />} />
      <Route path="/philia/certs/:appointmentId" element={<CertDetailPage />} />
      <Route path="/philia/reports/:appointmentId" element={<ReportPage />} />
      <Route path="/support" element={<TicketListPage />} />
      <Route path="/support/new" element={<TicketNewPage />} />
      <Route path="/support/:id" element={<TicketDetailPage />} />
      <Route path="/invoices" element={<InvoiceListPage />} />
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      <Route path="/invoice/apply/:kind/:id" element={<InvoiceApplyPage />} />
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
      {/* 补缺大批片 2 账户安全：设置 + 五子页（详情级无 dock，PushBar 返回条；
          新路由已申报 check-nav-closure/smoke-routes 双表） */}
      <Route path="/me/settings" element={<SettingsPage />} />
      <Route path="/me/settings/deactivate" element={<DeactivatePage />} />
      <Route path="/me/settings/phone" element={<ChangePhonePage />} />
      <Route path="/me/settings/phone/appeal" element={<PhoneAppealPage />} />
      <Route path="/me/settings/devices" element={<DevicesPage />} />
      <Route path="/me/settings/privacy" element={<PrivacyPage />} />
      {/* 客户端体验大批 片 1（账户体系+支付售后面）：六屏新路由（详情级无 dock，
          PushBar 返回条；已申报 check-nav-closure/smoke-routes 双表） */}
      <Route path="/settings/profile" element={<ProfileEditPage />} />
      <Route path="/settings/addresses" element={<AddressesPage />} />
      <Route path="/settings/about" element={<AboutPage />} />
      <Route path="/settings/agreements" element={<AgreementsPage />} />
      <Route path="/settings/invoice-titles" element={<InvoiceTitlesPage />} />
      <Route path="/records" element={<RecordsPage />} />
      {/* U1-H：会员卡页新路由（信息展示 v0；详情级——无 dock，统一返回条） */}
      <Route path="/me/card" element={<MemberCardPage />} />
      {/* 客户端体验大批 片 3：优惠券+心愿单（详情级无 dock，PushBar 返回条兜底 /me；
          心愿单并入本页 tab 取少路由；申报锚点=「优惠券」） */}
      <Route path="/me/coupons" element={<CouponsPage />} />
      {/* R11a 骨架批：会员中心/开通页新路由（详情级无 dock，统一返回条固定回 /me、/member；
          申报锚点=页面标题「会员中心」「开通会员」） */}
      <Route path="/member" element={<MemberCenterPage />} />
      <Route path="/member/open" element={<MemberOpenPage />} />
      {/* R11b 视觉批：回馈金账本拆独立推送页（36 号档 §四 W-01；申报锚点=「回馈金」） */}
      <Route path="/member/rebate" element={<MemberRebatePage />} />
      {/* 补缺批片 3 会员域：升档试算 / 到期换档预约（详情级无 dock，返回条兜底 /member；
          申报锚点=「升级会员」/「预约下期档位」） */}
      <Route path="/member/upgrade" element={<MemberUpgradePage />} />
      <Route path="/member/change" element={<MemberChangePage />} />
      {/* 补缺批片 5 站内信：消息中心+订阅管理（详情级无 dock，统一返回条；
          申报锚点=「消息」「订阅管理」） */}
      <Route path="/notifications" element={<NotifyCenterPage />} />
      <Route path="/notifications/prefs" element={<NotifyPrefsPage />} />
      {/* 补缺批片 6 线上收单骨架（Mock 通道）：确认订单/支付态/掉单自助查询
          （申报锚点=「确认订单」「付了没开」；/pay/reconcile 静态段优先于 /pay/:payNo 动态段） */}
      <Route path="/member/checkout" element={<MemberCheckoutPage />} />
      <Route path="/pay/reconcile" element={<PayReconcilePage />} />
      <Route path="/pay/:payNo" element={<PayStatePage />} />
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
      {/* 体验批片 4：PWA 安装引导条（beforeinstallprompt 拦存+自定义条；
          登录守卫内全页可出，自身持关闭/已装持久化，非主级页不吃 isMainPath 限制） */}
      {!isDevLogin && <InstallBanner />}
    </div>
  )
}
