import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './store/auth'
import AppShell from './components/layout/AppShell'
import AuthGuard from './components/auth/AuthGuard'
import Welcome from './pages/Welcome'
import Login from './pages/Login'
import Register from './pages/Register'
import ProfileSetup from './pages/ProfileSetup'
import Home from './pages/Home'
import History from './pages/History'
import Training from './pages/Training'
import ExerciseDetail from './pages/ExerciseDetail'
import GymPlanCreate from './pages/GymPlanCreate'
import RunningPlan from './pages/RunningPlan'
import MicroRoutine from './pages/MicroRoutine'
import RunAnalysis from './pages/RunAnalysis'
import GymPlanDetail from './pages/GymPlanDetail'
import WorkoutSession from './pages/WorkoutSession'
import TrainingDiary from './pages/TrainingDiary'
import Anamnese from './pages/Anamnese'
import Profile from './pages/Profile'
import Community from './pages/Community'
import Chat from './pages/Chat'
import LiveTracking from './pages/LiveTracking'
import RunSummary from './pages/RunSummary'
import RunDetail from './pages/RunDetail'
import ForgotPassword from './pages/ForgotPassword'
import NotFound from './pages/NotFound'
import IconSprite from './components/ui/IconSprite'
import { SnackbarProvider } from './components/ui/Snackbar'

export default function App() {
  const initialize = useAuth((s) => s.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  return (
    <SnackbarProvider>
    <IconSprite />
    <Routes>
      <Route path="willkommen" element={<Welcome />} />
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="passwort-vergessen" element={<ForgotPassword />} />

      <Route element={<AuthGuard />}>
        <Route path="profil/setup" element={<ProfileSetup />} />
        <Route path="anamnese" element={<Anamnese />} />
        <Route path="training/workout/aktiv" element={<WorkoutSession />} />
        <Route path="training/routine" element={<MicroRoutine />} />
        <Route path="lauf/tracking" element={<LiveTracking />} />
        <Route path="lauf/zusammenfassung" element={<RunSummary />} />
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="verlauf" element={<History />} />
          <Route path="training" element={<Training />} />
          <Route path="training/uebung/:slug" element={<ExerciseDetail />} />
          <Route path="training/plan/neu" element={<GymPlanCreate />} />
          <Route path="training/plan/:id" element={<GymPlanDetail />} />
          <Route path="training/laufplan" element={<RunningPlan />} />
          <Route path="training/tagebuch" element={<TrainingDiary />} />
          <Route path="lauf/:id/analyse" element={<RunAnalysis />} />
          <Route path="lauf/:id" element={<RunDetail />} />
          <Route path="community" element={<Community />} />
          <Route path="profil" element={<Profile />} />
          <Route path="chat" element={<Chat />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </SnackbarProvider>
  )
}
