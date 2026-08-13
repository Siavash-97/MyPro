import { useNavigate, useLocation } from 'react-router-dom'

export default function ChatFab() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname === '/chat') return null

  return (
    <button
      type="button"
      onClick={() => navigate('/chat')}
      aria-label="Coach-Chat öffnen"
      className="fixed z-40 flex items-center justify-center w-14 h-14 rounded-full bg-tertiary text-on-tertiary shadow-2 bottom-[calc(1.25rem+env(safe-area-inset-bottom)+2rem)] left-1/2 -translate-x-1/2 active:scale-95 transition-transform"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    </button>
  )
}
