import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import MonitorDetail from './pages/MonitorDetail'
import MonitorForm from './pages/MonitorForm'
import StatusPagesList from './pages/StatusPagesList'
import StatusPageForm from './pages/StatusPageForm'
import PublicStatusPage from './pages/PublicStatusPage'
import Settings from './pages/Settings'
import Alerts from './pages/Alerts'
import Incidents from './pages/Incidents'
import Maintenance from './pages/Maintenance'
import Observability from './pages/Observability'
import Layout from './components/Layout'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<RequireGuest><Auth /></RequireGuest>} />
        <Route path="/status/:slug" element={<PublicStatusPage />} />

        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/monitors/new" element={<MonitorForm />} />
          <Route path="/dashboard/monitors/:id" element={<MonitorDetail />} />
          <Route path="/dashboard/monitors/:id/edit" element={<MonitorForm />} />
          <Route path="/dashboard/status-pages" element={<StatusPagesList />} />
          <Route path="/dashboard/status-pages/new" element={<StatusPageForm />} />
          <Route path="/dashboard/status-pages/:id/edit" element={<StatusPageForm />} />
          <Route path="/dashboard/alerts" element={<Alerts />} />
          <Route path="/dashboard/incidents" element={<Incidents />} />
          <Route path="/dashboard/maintenance" element={<Maintenance />} />
          <Route path="/dashboard/observability" element={<Observability />} />
          <Route path="/dashboard/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
