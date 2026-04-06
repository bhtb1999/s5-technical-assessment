import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Layout from './Layout'

export default function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
