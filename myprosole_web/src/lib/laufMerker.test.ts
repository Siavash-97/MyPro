import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  merkerSetzen,
  merkerLesen,
  merkerLoeschen,
  merkerLaufId,
  merkerDauerhaftGescheitert,
  merkerWiederVersuchen,
} from './laufMerker'

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

    expect(merkerLesen()).toEqual({ sitzungId: 'sitzung-1', runId: 'lauf-1', dauerhaftGescheitert: false })
  })

  it('merkt die Sitzung auch, bevor die Lauf-Zeile existiert', () => {
    // Der Dienst startet sofort, die Zeile in der Datenbank braucht Netz.
    // Faellt die App dazwischen aus, ist die Sitzung trotzdem wiederfindbar.
    merkerSetzen('sitzung-1', null)

    expect(merkerLesen()).toEqual({ sitzungId: 'sitzung-1', runId: null, dauerhaftGescheitert: false })
  })

  it('traegt die Lauf-Zeile nach, ohne die Sitzung zu verlieren', () => {
    merkerSetzen('sitzung-1', null)
    merkerLaufId('lauf-1')

    expect(merkerLesen()).toEqual({ sitzungId: 'sitzung-1', runId: 'lauf-1', dauerhaftGescheitert: false })
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

  it('gibt die Marke "dauerhaft gescheitert" zurueck - sie war unlesbar', () => {
    // Gefunden vom Agenten `oberflaeche`, 24.08.2026: `merkerLesen` baute
    // das Objekt aus `sitzungId` und `runId` neu. Die Marke stand im
    // localStorage und war fuer JEDEN Leser unsichtbar - schreibbar, aber
    // wirkungslos. Der Neustart-Kreislauf blieb damit offen, obwohl er
    // geschlossen aussah.
    //
    // Sollwert-Begruendung: Gefordert ist nicht "irgendein wahrer Wert",
    // sondern dass die Marke den Weg durch localStorage UND durch diese
    // Funktion uebersteht. Deshalb wird geschrieben, gelesen, dann
    // zurueckgenommen und wieder gelesen - ein einzelnes `toBe(true)`
    // liesse offen, ob sie je wieder verschwindet.
    merkerSetzen('sitzung-1', 'lauf-1')
    expect(merkerLesen()?.dauerhaftGescheitert).toBe(false)

    merkerDauerhaftGescheitert()
    expect(merkerLesen()?.dauerhaftGescheitert).toBe(true)

    merkerWiederVersuchen()
    expect(merkerLesen()?.dauerhaftGescheitert).toBe(false)
    // Und die Sitzung darf dabei nicht verlorengehen - sonst waere der Lauf
    // beim Zuruecknehmen der Marke unauffindbar.
    expect(merkerLesen()?.sitzungId).toBe('sitzung-1')
  })
})
