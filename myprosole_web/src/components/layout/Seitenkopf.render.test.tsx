// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  SeitenkopfProvider,
  useAngemeldeterKopf,
  useSeitenkopf,
  type SeitenkopfKonfig,
} from './Seitenkopf'

/**
 * Der erste Render-Test dieses Projekts.
 *
 * Die Umgebung steht als Docblock in Zeile 1, nicht in vite.config.ts: Die
 * uebrigen Testdateien laufen weiter unter "node" (Vorgabe von vitest), weil
 * sie kein `document` brauchen und in "node" schneller starten.
 * `environmentMatchGlobs` gibt es in vitest 4 nicht mehr - je Datei ist die
 * verbleibende Setzweise (Bericht sicherheit, 12.09.2026).
 *
 * Ohne `globals: true` (nachgesehen in vite.config.ts, dort steht nur
 * `exclude`) meldet @testing-library/react sein Aufraeumen NICHT selbst an -
 * `cleanup` in afterEach ist deshalb Pflicht, sonst haengen die Baeume der
 * ersten Faelle noch im document, wenn der naechste rendert.
 *
 * Fall 1 ist der Grund fuer die ganze Umgebung: Bis zum 11.09.2026 stand im
 * Kopf von Seitenkopf.tsx, dass die Endlosschleife (anmelden je Rendern neu ->
 * Effekt-Deps von useSeitenkopf aendern sich -> setEintraege -> neues Rendern)
 * nicht rot zu sehen sei. Sie ist es jetzt.
 */

/** Obergrenze, ab der das Kind selbst abbricht - siehe KindMitKopf. */
const OBERGRENZE = 25

let renderZahl = 0
let zuletztGelesen: SeitenkopfKonfig | null = null

/**
 * Meldet einen Kopf an und zaehlt dabei die eigenen Renderings.
 *
 * Der Abbruch bei OBERGRENZE ist der Kern des Falls: Bricht das Kind nicht
 * selbst ab, entscheidet entweder Reacts "Maximum update depth exceeded"
 * (Wortlaut abhaengig von der React-Fassung) oder das Zeitlimit von vitest,
 * wann der Fall faellt - beides sind schlechte Fehlermeldungen. So faellt er
 * mit einer eigenen Nachricht, die die gemessene Zahl nennt.
 *
 * Der Wurf steht NACH useSeitenkopf, nicht davor: Ein Abbruch vor dem Hook
 * waere ein bedingter Hook-Aufruf (oxlint react/rules-of-hooks).
 */
function KindMitKopf({ titel }: { titel: string }) {
  renderZahl += 1
  useSeitenkopf({ variante: 'kompakt', titel })
  if (renderZahl > OBERGRENZE) {
    throw new Error(
      `Endlosschleife: KindMitKopf hat ${renderZahl} Mal gerendert, erlaubt sind ${OBERGRENZE}. ` +
        'SeitenkopfProvider gibt bei jedem Rendern ein neues `anmelden` oder einen neuen ' +
        'Kontextwert heraus - der Effekt in useSeitenkopf laeuft dadurch erneut und loest ' +
        'ueber setEintraege das naechste Rendern aus.',
    )
  }
  return <span data-testid="kind">{titel}</span>
}

/** Liest, was AppShell liest. */
function Leser() {
  const kopf = useAngemeldeterKopf()
  zuletztGelesen = kopf
  return <span data-testid="leser">{kopf ? kopf.titel : 'kein Kopf'}</span>
}

/**
 * Alle Argumente aller console.error-Aufrufe zu einem Text.
 *
 * Der Parameter ist strukturell getippt statt als
 * `ReturnType<typeof vi.spyOn<Console, 'error'>>` - diese Schreibweise meldet
 * `tsc -b` als TS2344 ("Type '\"error\"' does not satisfy the constraint
 * 'never'"), gemessen am 12.09.2026, nicht vermutet.
 */
function fehlermeldungen(spion: { mock: { calls: unknown[][] } }): string {
  return spion.mock.calls.map((argumente) => argumente.map(String).join(' ')).join('\n')
}

beforeEach(() => {
  renderZahl = 0
  zuletztGelesen = null
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SeitenkopfProvider im echten Rendern', () => {
  it('kommt zur Ruhe, statt sich mit useSeitenkopf gegenseitig neu zu rendern', () => {
    // Kein mockImplementation: Reacts Meldung soll im roten Lauf sichtbar
    // bleiben, der Spion zaehlt nur mit.
    const fehlerSpion = vi.spyOn(console, 'error')

    render(
      <SeitenkopfProvider>
        <KindMitKopf titel="Laufanalyse" />
        <Leser />
      </SeitenkopfProvider>,
    )

    // Erwartet sind zwei Durchlaeufe: das erste Rendern und eines, nachdem der
    // Effekt den Kopf angemeldet hat. Die Zahl steht hier fest verdrahtet und
    // nicht als "kleiner als OBERGRENZE" - eine Grenze, die zufaellig der
    // Abbruchgrenze des Kindes entspricht, wuerde jedes Wachstum dazwischen
    // durchlassen.
    expect(renderZahl).toBe(2)
    expect(fehlermeldungen(fehlerSpion)).not.toContain('Maximum update depth exceeded')
    expect(screen.getByTestId('kind').textContent).toBe('Laufanalyse')
  })

  it('reicht den angemeldeten Titel zum Leser und gibt ihn beim Abmelden wieder frei', () => {
    // Der Provider bleibt ueber beide Durchlaeufe stehen; nur das anmeldende
    // Kind verschwindet. Genau so verhaelt es sich beim Seitenwechsel: Die
    // Huelle bleibt, die Seite darin wird ausgetauscht.
    function Baum({ zeigen }: { zeigen: boolean }) {
      return (
        <SeitenkopfProvider>
          {zeigen ? <KindMitKopf titel="Laufanalyse" /> : null}
          <Leser />
        </SeitenkopfProvider>
      )
    }

    const { rerender } = render(<Baum zeigen />)

    expect(zuletztGelesen).toEqual({ variante: 'kompakt', titel: 'Laufanalyse' })
    expect(screen.getByTestId('leser').textContent).toBe('Laufanalyse')

    rerender(<Baum zeigen={false} />)

    // Die Aufraeumfunktion aus anmelden() nimmt den Eintrag wieder heraus -
    // ohne sie behielte AppShell den Titel der verlassenen Seite.
    expect(zuletztGelesen).toBeNull()
    expect(screen.getByTestId('leser').textContent).toBe('kein Kopf')
    expect(screen.queryByTestId('kind')).toBeNull()
  })
})
