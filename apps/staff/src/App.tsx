import { Navigate, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import BoardingCheckinPage from './pages/BoardingCheckinPage'
import ExecutePage from './pages/ExecutePage'
import HistoryPage from './pages/HistoryPage'
import MePage from './pages/MePage'
import TodayPage from './pages/TodayPage'

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-lg pb-20">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/execute/:appointmentId" element={<ExecutePage />} />
          <Route path="/boarding/:id/checkin" element={<BoardingCheckinPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
