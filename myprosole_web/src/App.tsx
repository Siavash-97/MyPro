import { Routes, Route } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Home from './pages/Home'
import History from './pages/History'
import Training from './pages/Training'
import Profile from './pages/Profile'
import Chat from './pages/Chat'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="verlauf" element={<History />} />
        <Route path="training" element={<Training />} />
        <Route path="profil" element={<Profile />} />
        <Route path="chat" element={<Chat />} />
      </Route>
    </Routes>
  )
}
