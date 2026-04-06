import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Campaigns from './pages/Campaigns'
import CampaignNew from './pages/CampaignNew'
import CampaignDetail from './pages/CampaignDetail'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Redirect root to campaigns */}
      <Route path="/" element={<Navigate to="/campaigns" replace />} />

      {/* Private */}
      <Route element={<PrivateRoute />}>
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<CampaignNew />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/campaigns" replace />} />
    </Routes>
  )
}
