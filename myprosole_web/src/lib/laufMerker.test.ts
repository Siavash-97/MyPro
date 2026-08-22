import { describe, it, expect, beforeEach, vi } from 'vitest'
import { merkerSetzen, merkerLesen, merkerLoeschen, merkerLaufId } from './laufMerker'

/**
 * Die Tests laufen in Node, dort gibt es keinen Browserspeicher. Ein
 * Ersatz aus einer Map reicht: Geprueft wird die Regel des Moduls, nicht
 * die Umsetzung von localStorage.
 */
function speicherErsatz() {
  const inhalt = new Map<string, string>()
  return {
    getItem: (k: string) => inhalt.get(k) ?? null,
    setItem: (k: string, v: string) => void inhalt.set(k, v),
    removeItem: (k: string) => void inhalt.delete(k),
    clear: () => inhalt.clear(),
  }
}

describe('laufMerker', () => {
  beforeEach(() => vi.stubGlobal('localStorage', speicherErsatz()))

  it('gibt nichts zurueck, wenn nie etwas gemerkt wurde', () => {
    expect(merkerLesen()).toBeNull()
  })

  it('merkt sich Sitzung und Lauf und gibt beide zurueck', () => {
    merkerSetzen('sitzung-1', 'lauf-1')

    expect(merkerLesen()).toEqual({ sitzungId: 'sitzung-1', runId: 'lauf-1' })
  })

  it('merkt die Sitzung auch, bevor die Lauf-Zeile existiert', () => {
    // Der Dienst startet sofort, die Zeile in der Datenbank braucht Netz.
    // Faellt die App dazwischen aus, ist die Sitzung trotzdem wiederfindbar.
    merkerSetzen('sitzung-1', null)

    expect(merkerLesen()).toEqual({ sitzungId: 'sitzung-1', runId: null })
  })

  it('traegt die Lauf-Zeile nach, ohne die Sitzung zu verlieren', () => {
    merkerSetzen('sitzung-1', null)
    merkerLaufId('lauf-1')

    expect(merkerLesen()).toEqual({ sitzungId: 'sitzung-1', runId: 'lauf-1' })
  })

  it('traegt nichts nach, wenn gar keine Sitzung gemerkt ist', () => {
    // Sonst entstuende ein Merker ohne Sitzung - und der zeigt beim naechsten
    // Start auf nichts.
    merkerLaufId('lauf-1')

    expect(merkerLesen()).toBeNull()
  })

  it('vergisst alles beim Loeschen', () => {
    merkerSetzen('sitzung-1', 'lauf-1')
    merkerLoeschen()

    expect(merkerLesen()).toBeNull()
  })

  it('ueberlebt kaputten Inhalt, ohne die App mitzureissen', () => {
    localStorage.setItem('myprosole.laufMerker.v1', 'kein json')

    expect(merkerLesen()).toBeNull()
  })
})
