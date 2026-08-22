import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import AppShell from './components/layout/AppShell'
import AuthGuard from './components/auth/AuthGuard'
import Welcome from './pages/Welcome'
import { Terms, Privacy } from './pages/Legal'
import Login from './pages/Login'
import Register from './pages/Register'
import ConfirmEmail from './pages/ConfirmEmail'
import ProfileSetup from './pages/ProfileSetup'
import Home from './pages/Home'
import History from './pages/History'
import Training from './pages/Training'
import ExerciseDetail from './pages/ExerciseDetail'
import RunningPlan from './pages/RunningPlan'
import MicroRoutine from './pages/MicroRoutine'
import RunAnalysis from './pages/RunAnalysis'
import InsolesDiscover from './pages/InsolesDiscover'
import InsoleConnect from './pages/InsoleConnect'
import CycleCalendar from './pages/CycleCalendar'
import SocialStudio from './pages/SocialStudio'
import TrainingDiary from './pages/TrainingDiary'
import Anamnese from './pages/Anamnese'
import Profile from './pages/Profile'
import Community from './pages/Community'
import CommunityMeetups from './pages/CommunityMeetups'
import CommunityGroups from './pages/CommunityGroups'
import CommunityProfile from './pages/CommunityProfile'
import GroupCreate from './pages/GroupCreate'
import GroupDetail from './pages/GroupDetail'
import GroupJoin from './pages/GroupJoin'
import RunChat from './pages/RunChat'
import CommunityChats from './pages/CommunityChats'
import PasswortNeu from './pages/PasswortNeu'
import PulsgurtVerbinden from './pages/PulsgurtVerbinden'
import Chat from './pages/Chat'
import LiveTracking from './pages/LiveTracking'
import RunSummary from './pages/RunSummary'
import RunDetail from './pages/RunDetail'
import ForgotPassword from './pages/ForgotPassword'
import NotFound from './pages/NotFound'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { NATIVE_LOGIN_CALLBACK } from './lib/authRedirect'
import Startbergung from './components/run/Startbergung'
import IconSprite from './components/ui/IconSprite'
import { SnackbarProvider } from './components/ui/Snackbar'

export default function App() {
  const initialize = useAuth((s) => s.initialize)
  const handleOAuthCallback = useAuth((s) => s.handleOAuthCallback)
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  // Rueckweg aus der Google-Anmeldung in der Android-Huelle.
  //
  // Dort kommt er nicht als Seitenaufruf an, sondern weckt die App. Ohne
  // diesen Empfaenger passiert dabei nichts: Genau deshalb landete man
  // bisher in Chrome, waehrend die App unveraendert auf der
  // Willkommensseite stand.
  //
  // Im Browser wird gar nicht erst gehorcht – dort loest supabase-js den
  // Rueckweg selbst auf.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let entfernen: (() => void) | undefined

    // Zwei Wege, und beide werden gebraucht.
    //
    // appUrlOpen feuert, wenn die App schon laeuft und in den Vordergrund
    // geholt wird. Startet der Rueckweg die App dagegen erst, ist der
    // Aufruf laengst zugestellt, bevor dieser Empfaenger existiert – dann
    // feuert nichts, und man landet auf der Willkommensseite, obwohl die
    // Anmeldedaten mitgekommen sind. Genau das ist passiert.
    //
    // getLaunchUrl liefert die Adresse nach, mit der die App gestartet
    // wurde. Ohne sie funktioniert die Anmeldung nur beim zweiten Versuch.
    // Nach dem Setzen der Sitzung muss die App auch weitergehen.
    //
    // Der Waechter sitzt nur vor den geschuetzten Seiten. /willkommen ist
    // oeffentlich – dort laeuft er nicht. Die Anmeldung gelang also, die
    // Sitzung stand, und die App blieb trotzdem auf der Willkommensseite
    // stehen, weil niemand sie weiterschickte. Auf dem Geraet nachgemessen:
    // hatSitzung true, Seite /willkommen.
    const uebernehmen = async (url: string) => {
      const fehler = await handleOAuthCallback(url)
      if (!fehler) navigate('/', { replace: true })
    }

    CapApp.getLaunchUrl().then((start) => {
      if (start?.url?.startsWith(NATIVE_LOGIN_CALLBACK)) uebernehmen(start.url)
    })

    CapApp.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith(NATIVE_LOGIN_CALLBACK)) return
      uebernehmen(url)
    }).then((h) => { entfernen = () => h.remove() })

    return () => entfernen?.()
  }, [handleOAuthCallback, navigate])

  return (
    <SnackbarProvider>
    {/* Muss INNERHALB des Providers stehen: Die Bergung meldet ihr Ergebnis
        ueber die Schnellmeldung, und useSnackbar findet den Provider nur von
        unten. Zeigt selbst nichts an. */}
    <Startbergung />
    <IconSprite />
    <Routes>
      <Route path="willkommen" element={<Welcome />} />
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      {/* Ziel des Links aus der Bestaetigungsmail (siehe lib/authRedirect.ts).
          Muss oeffentlich sein: Wer hier ankommt, hat noch keine Sitzung. */}
      <Route path="bestaetigen" element={<ConfirmEmail />} />
      <Route path="passwort-vergessen" element={<ForgotPassword />} />
      {/* Ziel des Links aus der Passwort-Mail. Muss oeffentlich sein: Der
          Waechter wuerde jemanden ohne abgeschlossene Anamnese vorher
          woanders hinschicken – und genau der will ja gerade wieder
          hineinkommen. */}
      <Route path="passwort-neu" element={<PasswortNeu />} />
      {/* Oeffentlich: Wer sich einverstanden erklaeren soll, muss vorher
          lesen koennen, womit. */}
      <Route path="agb" element={<Terms />} />
      <Route path="datenschutz" element={<Privacy />} />

      <Route element={<AuthGuard />}>
        <Route path="profil/setup" element={<ProfileSetup />} />
        <Route path="anamnese" element={<Anamnese />} />
        <Route path="training/routine" element={<MicroRoutine />} />
        <Route path="lauf/tracking" element={<LiveTracking />} />
        <Route path="chat/lauf/:id" element={<RunChat />} />
        <Route path="lauf/zusammenfassung" element={<RunSummary />} />
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="puls-verbinden" element={<PulsgurtVerbinden />} />
          <Route path="verlauf" element={<History />} />
          <Route path="training" element={<Training />} />
          <Route path="training/uebung/:slug" element={<ExerciseDetail />} />
          <Route path="training/laufplan" element={<RunningPlan />} />
          <Route path="training/tagebuch" element={<TrainingDiary />} />
          <Route path="lauf/:id/analyse" element={<RunAnalysis />} />
          <Route path="lauf/:id" element={<RunDetail />} />
          <Route path="zyklus" element={<CycleCalendar />} />
          <Route path="social-studio" element={<SocialStudio />} />
          <Route path="einlagen" element={<InsolesDiscover />} />
          <Route path="einlage/verbinden" element={<InsoleConnect />} />
          <Route path="community" element={<Community />} />
          <Route path="community/zusammenlauf" element={<CommunityMeetups />} />
          <Route path="community/gruppen" element={<CommunityGroups />} />
          <Route path="community/chats" element={<CommunityChats />} />
          <Route path="community/profil" element={<CommunityProfile />} />
          <Route path="community/profil/:id" element={<CommunityProfile />} />
          <Route path="community/gruppe/neu" element={<GroupCreate />} />
          <Route path="community/gruppe/beitreten/:token" element={<GroupJoin />} />
          <Route path="community/gruppe/:id" element={<GroupDetail />} />
          <Route path="profil" element={<Profile />} />
          <Route path="chat" element={<Chat />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </SnackbarProvider>
  )
}
