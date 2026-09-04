import { Navigate, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentMonitorPage from './pages/AppointmentMonitorPage'
import AppointmentsPage from './pages/AppointmentsPage'
import BoardingPage from './pages/BoardingPage'
import DashboardPage from './pages/DashboardPage'
import FinancePage from './pages/FinancePage'
import OrdersPage from './pages/OrdersPage'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import StaffPage from './pages/StaffPage'

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="pb-20">
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
      </main>
      <TabBar />
    </div>
  )
}
