import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useAnamnese } from '../../store/anamnese'
import { wohin } from '../../lib/wegweiser'

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
  const { user, profile, profilBekannt, loading, profileLoading } = useAuth()
  const { fetchSessions, blockOffen } = useAnamnese()
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
    // Beim Kontowechsel gehoert die Ladewand wieder hoch: Ohne das bliebe
    // `anamneseGeholt` aus der Sitzung des vorigen Kontos auf true.
    setAnamneseGeholt(false)
    fetchSessions().finally(() => setAnamneseGeholt(true))
    // user?.id, nicht user: Supabase liefert bei jeder Token-Erneuerung und
    // bei jedem Wiedereintritt in die App ein NEUES Objekt fuer denselben
    // Menschen. Mit `user` lief das Laden deshalb staendig neu - und damit
    // staendig das Risiko, dass eine Abfrage bei schwachem Netz scheitert.
  }, [user?.id, fetchSessions])

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

  // Die Entscheidung selbst steht in `lib/wegweiser.ts` und ist dort
  // geprueft. Hier steht nur noch, WIE umgeleitet wird - die Komponente
  // laesst sich ohne Testumgebung nicht rendern, die reine Funktion schon.
  const ziel = wohin({
    angemeldet: Boolean(user),
    profilBekannt,
    anzeigename: profile?.display_name,
    blockAOffen: blockOffen('a'),
    pfad: location.pathname,
  })

  if (ziel) {
    // `from` wird mitgegeben, WIRKT heute aber nicht: Der Zustand geht an
    // /willkommen, und Welcome.tsx verlinkt /login mit einem einfachen
    // <Link> ohne State - Login.tsx liest also nichts. Nach der Anmeldung
    // landet man auf /. Nachgesehen vom Agenten `pruefung` am 25.08.2026,
    // nachdem hier zuvor das Gegenteil behauptet stand.
    //
    // Es bleibt trotzdem stehen: Das Verhalten ist unveraendert gegenueber
    // vorher, und Welcome den Zustand durchreichen zu lassen waere ein
    // mitgenommener Umbau. Steht als offener Punkt im Bericht.
    return ziel === '/willkommen' ? (
      <Navigate to={ziel} state={{ from: location }} replace />
    ) : (
      <Navigate to={ziel} replace />
    )
  }

  return <Outlet />
}
