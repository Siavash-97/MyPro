import { Outlet } from 'react-router-dom'
import TopAppBar from './TopAppBar'
import BottomNav from './BottomNav'
import ChatFab from './ChatFab'

export default function AppShell() {
  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <TopAppBar />
      <main className="md-page-stack md-page-stack--with-nav flex-1">
        <Outlet />
      </main>
      <ChatFab />
      <BottomNav />
    </div>
  )
}
