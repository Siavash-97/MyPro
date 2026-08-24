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

/**
 * Standzeit. App-weit – jede Meldung der App laeuft hier durch (72 Aufrufe
 * in 22 Dateien).
 *
 * Waren 2600 ms, und das war zu kurz. Nachgemessen am 23.08.2026: Die
 * laengste feste Meldung der App ("Die Antworten konnten nicht gespeichert
 * werden. Bitte noch einmal versuchen.") hat zehn Woerter. Zehn Woerter sind
 * bei ruhigem Ablesen rund drei Sekunden - dazu kommen 180 ms Einblendung
 * und die Zeit, bis jemand ueberhaupt hinsieht. Bei 2600 ms war die Meldung
 * weg, bevor sie zu Ende gelesen war.
 *
 * 4000 ms ist nicht geraten: Es ist die Vorgabe von Material 3 fuer eine
 * Kurzeinblendung ohne Knopf und liegt im ueblichen Rahmen von 3-5 s.
 *
 * Es ist KEIN Ersatz fuer kurze Texte. Eine Meldung, die laenger braucht als
 * das hier, gehoert nicht in eine Kurzeinblendung, sondern an die Stelle, um
 * die es geht - siehe .md-row-hinweis in styles/components.css.
 */
const VISIBLE_MS = 4000

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
