import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './store/auth'
import AppShell from './components/layout/AppShell'
import AuthGuard from './components/auth/AuthGuard'
import Login from './pages/Login'
import Register from './pages/Register'
import ProfileSetup from './pages/ProfileSetup'
import Home from './pages/Home'
import History from './pages/History'
import Training from './pages/Training'
import ExerciseDetail from './pages/ExerciseDetail'
import GymPlanCreate from './pages/GymPlanCreate'
import GymPlanDetail from './pages/GymPlanDetail'
import WorkoutSession from './pages/WorkoutSession'
import TrainingDiary from './pages/TrainingDiary'
import Anamnese from './pages/Anamnese'
import Profile from './pages/Profile'
import Chat from './pages/Chat'

export default function App() {
  const initialize = useAuth((s) => s.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [initialize])

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />

      <Route element={<AuthGuard />}>
        <Route path="profil/setup" element={<ProfileSetup />} />
        <Route path="anamnese" element={<Anamnese />} />
        <Route path="training/workout/aktiv" element={<WorkoutSession />} />
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="verlauf" element={<History />} />
          <Route path="training" element={<Training />} />
          <Route path="training/uebung/:slug" element={<ExerciseDetail />} />
          <Route path="training/plan/neu" element={<GymPlanCreate />} />
          <Route path="training/plan/:id" element={<GymPlanDetail />} />
          <Route path="training/tagebuch" element={<TrainingDiary />} />
          <Route path="profil" element={<Profile />} />
          <Route path="chat" element={<Chat />} />
        </Route>
      </Route>
    </Routes>
  )
}
