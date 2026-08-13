import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/auth'

export default function AuthGuard() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!profile && location.pathname !== '/profil/setup') {
    return <Navigate to="/profil/setup" replace />
  }

  return <Outlet />
}
