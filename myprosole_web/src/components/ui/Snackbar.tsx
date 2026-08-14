import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

/**
 * Kurzeinblendung für Bedienelemente, deren Funktion noch nicht angeschlossen
 * ist. Dieselbe Rolle wie prototype-placeholder.js in den Mockups: Der Knopf
 * steht wie entworfen da, sagt aber ehrlich, dass dahinter noch nichts liegt –
 * statt wortlos nichts zu tun.
 */
const SnackbarContext = createContext<(message: string) => void>(() => {})

export function useSnackbar() {
  return useContext(SnackbarContext)
}

const VISIBLE_MS = 2600

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (clearTimer.current) clearTimeout(clearTimer.current)
    setMessage(next)
    setVisible(true)
    hideTimer.current = setTimeout(() => setVisible(false), VISIBLE_MS)
    // Erst nach der Ausblendung entfernen, sonst springt der Text weg,
    // bevor die Einblendung zu Ende gelaufen ist.
    clearTimer.current = setTimeout(() => setMessage(null), VISIBLE_MS + 250)
  }, [])

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (clearTimer.current) clearTimeout(clearTimer.current)
  }, [])

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {message && (
        <p
          className={`md-snackbar${visible ? ' md-snackbar--visible' : ''}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </SnackbarContext.Provider>
  )
}
