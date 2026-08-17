import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useAnamnese } from '../../store/anamnese'

/**
 * Wann ist eine Registrierung abgeschlossen?
 *
 * Erst nach der Anamnese. Nicht nach der Bestaetigungsmail, nicht nach dem
 * Anzeigenamen – die sind Zwischenschritte. Ohne Anamnese rechnet die App
 * mit Durchschnittswerten, und wer direkt auf der Startseite landet, sieht
 * eine App ohne Inhalt.
 *
 * Deshalb steht die Pruefung hier und nicht in den Anmeldewegen: Der
 * Waechter sitzt vor jeder geschuetzten Seite. Er sieht nur, wie weit jemand
 * ist – nicht, ob er sich per E-Mail oder ueber Google angemeldet hat. Eine
 * Ausnahme muesste man aktiv einbauen; es gibt keine, die man vergessen
 * koennte.
 *
 * Die Reihenfolge:
 *
 *   kein Konto        -> /willkommen
 *   kein Anzeigename  -> /profil/setup
 *   keine Anamnese    -> /anamnese
 *   sonst             -> die angeforderte Seite
 */
export default function AuthGuard() {
  const { user, profile, loading, profileLoading } = useAuth()
  const { fetchSessions, hasCompletedBlock } = useAnamnese()
  const location = useLocation()
  const [anamneseGeholt, setAnamneseGeholt] = useState(false)

  // Einmal je Anmeldung laden. Ohne diesen Stand wuesste der Waechter nicht,
  // ob die Anamnese schon gemacht wurde, und wuerde jemanden hineinschicken,
  // der sie laengst hinter sich hat.
  useEffect(() => {
    if (!user) {
      setAnamneseGeholt(false)
      return
    }
    // finally statt then: Scheitert das Laden – kein Netz, abgelaufene
    // Sitzung –, muss der Waechter trotzdem weitermachen. Mit .then() blieb
    // er sonst ewig im Ladekreis stehen, und die App liess sich gar nicht
    // mehr oeffnen.
    fetchSessions().finally(() => setAnamneseGeholt(true))
  }, [user, fetchSessions])

  // Auch warten, solange Profil oder Anamnese noch geladen werden: sonst wird
  // ein Reload einer tiefen Route weitergeleitet, obwohl alles vorliegt.
  // Nicht auf anamneseLaedt warten: Das Flag bleibt bei einem Fehler stehen.
  // anamneseGeholt wird in jedem Fall gesetzt und ist deshalb das
  // verlaessliche Signal.
  if (loading || profileLoading || (user && !anamneseGeholt)) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Einstieg ist die Willkommensseite, nicht direkt die Anmeldung – von dort
  // fuehren die Wege ins Konto (welcome.html).
  if (!user) {
    return <Navigate to="/willkommen" state={{ from: location }} replace />
  }

  // Geprueft wird der Anzeigename, nicht die blosse Existenz der Zeile: Ein
  // Konto ueber Google bringt seinen Namen schon mit, ein Konto ueber E-Mail
  // nicht.
  const eingerichtet = Boolean(profile?.display_name?.trim())
  if (!eingerichtet && location.pathname !== '/profil/setup') {
    return <Navigate to="/profil/setup" replace />
  }

  // Der letzte Schritt der Registrierung. Block A reicht – Block B ist
  // ausdruecklich freiwillig und laesst sich spaeter nachholen.
  if (eingerichtet && !hasCompletedBlock('a') && location.pathname !== '/anamnese') {
    return <Navigate to="/anamnese" replace />
  }

  return <Outlet />
}
