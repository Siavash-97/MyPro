import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/auth'

export default function AuthGuard() {
  const { user, profile, loading, profileLoading } = useAuth()
  const location = useLocation()

  // Auch warten, solange das Profil noch geladen wird: sonst wird ein Reload
  // einer tiefen Route nach /profil/setup und von dort auf die Startseite
  // umgeleitet, obwohl ein Profil existiert.
  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Einstieg ist die Willkommensseite, nicht direkt die Anmeldung – von dort
  // fuehren die drei Wege ins Konto (welcome.html).
  if (!user) {
    return <Navigate to="/willkommen" state={{ from: location }} replace />
  }

  if (!profile && location.pathname !== '/profil/setup') {
    return <Navigate to="/profil/setup" replace />
  }

  return <Outlet />
}
