import { Navigate, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import AppointmentDetailPage from './pages/AppointmentDetailPage'
import AppointmentLivePage from './pages/AppointmentLivePage'
import AppointmentsPage from './pages/AppointmentsPage'
import BookingBoardingPage from './pages/BookingBoardingPage'
import BookingGroomingPage from './pages/BookingGroomingPage'
import BookingPage from './pages/BookingPage'
import BookingSuccessPage from './pages/BookingSuccessPage'
import HomePage from './pages/HomePage'
import MallPage from './pages/MallPage'
import MePage from './pages/MePage'
import PhiliaPage from './pages/PhiliaPage'

export default function App() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="mx-auto max-w-lg pb-24">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/mall" element={<MallPage />} />
          <Route path="/philia" element={<PhiliaPage />} />
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
      </main>
      <TabBar />
    </div>
  )
}
