// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Bildergalerie from './Bildergalerie'

/**
 * Nachsignieren genau einmal je Bild.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Seit Scheibe 1 von Befund B (12.09.2026) tragen die Bilder SIGNIERTE
 * Adressen mit einer Stunde Gueltigkeit. Ein Feed, der laenger offen liegt,
 * fordert danach ein Bild mit abgelaufener Adresse an und bekommt einen
 * Fehler - `onError` am `<img>`. Der Rueckruf laesst genau diesen einen Pfad
 * neu signieren.
 *
 * Der gefaehrliche Fall ist nicht das Nachsignieren, sondern die SCHLEIFE:
 * Schlaegt auch die neue Adresse fehl, feuert `onError` wieder, und ohne
 * Sperre signierte die App im Kreis, solange die Seite offen ist. Deshalb
 * misst diese Datei die Anzahl, nicht nur das Vorhandensein.
 *
 * Umgebung als Docblock in Zeile 1, `cleanup` in `afterEach`: dasselbe
 * Vorgehen und derselbe Grund wie in `components/layout/
 * Seitenkopf.render.test.tsx` - ohne `globals: true` (nachgesehen in
 * vite.config.ts, dort steht nur `exclude`) meldet @testing-library/react
 * sein Aufraeumen nicht selbst an.
 */

afterEach(() => {
  cleanup()
})

const BILDER = [
  { id: 'bild-1', url: 'https://beispiel.test/a.jpg?token=abgelaufen' },
  { id: 'bild-2', url: 'https://beispiel.test/b.jpg?token=abgelaufen' },
]

describe('Bildergalerie: onError laesst nachsignieren', () => {
  it('ruft den Rueckruf genau einmal je Bild - auch bei mehreren Fehlern', () => {
    const nachsignieren = vi.fn()
    render(<Bildergalerie bilder={BILDER} onNachsignieren={nachsignieren} />)

    const bild = screen.getAllByRole('img')[0]
    fireEvent.error(bild)
    // Der zweite Fehlschlag desselben Bildes - die neue Adresse traegt nicht.
    fireEvent.error(bild)
    fireEvent.error(bild)

    expect(nachsignieren.mock.calls).toEqual([['bild-1']])
  })

  it('jedes Bild hat seinen eigenen einen Versuch', () => {
    const nachsignieren = vi.fn()
    render(<Bildergalerie bilder={BILDER} onNachsignieren={nachsignieren} />)

    const bilder = screen.getAllByRole('img')
    fireEvent.error(bilder[1])
    fireEvent.error(bilder[0])
    fireEvent.error(bilder[1])

    expect(nachsignieren.mock.calls).toEqual([['bild-2'], ['bild-1']])
  })

  it('ohne Rueckruf bricht ein Fehlschlag nichts', () => {
    render(<Bildergalerie bilder={BILDER} />)

    expect(() => fireEvent.error(screen.getAllByRole('img')[0])).not.toThrow()
  })
})

/**
 * Die Sperre ist ein Riegel, kein Schloss.
 *
 * Befund 8 der Pruefung vom 13.09.2026: Bis hierher wurde eine Kennung EINMAL
 * fuer die ganze Lebensdauer der Galerie gesperrt. Nach einem gelungenen
 * Nachsignieren laeuft die frische Adresse aber ihrerseits nach einer Stunde
 * ab - wer den Feed zwei Stunden offen liegen laesst, bekommt ein Bild, das
 * sich nicht mehr erholt, obwohl genau dafuer gebaut wurde.
 *
 * `onLoad` ist der Beleg, dass die neue Adresse getragen hat. Danach darf
 * dieselbe Kennung einen weiteren Versuch haben - und nur dann. Ohne `onLoad`
 * bleibt es beim einen Versuch, sonst waere die Schleife zurueck.
 */
describe('Bildergalerie: die Sperre loest sich nach einem geladenen Bild', () => {
  it('onError, onLoad, onError ergibt genau zwei Aufrufe - ohne onLoad bleibt es zwei', () => {
    const nachsignieren = vi.fn()
    render(<Bildergalerie bilder={BILDER} onNachsignieren={nachsignieren} />)

    const bild = screen.getAllByRole('img')[0]

    fireEvent.error(bild)
    expect(nachsignieren.mock.calls).toEqual([['bild-1']])

    // Die frische Adresse traegt: Das Bild ist da, die Sperre faellt.
    fireEvent.load(bild)
    fireEvent.error(bild)
    expect(nachsignieren.mock.calls).toEqual([['bild-1'], ['bild-1']])

    // Ohne ein zwischenzeitlich geladenes Bild bleibt es beim einen Versuch.
    fireEvent.error(bild)
    fireEvent.error(bild)
    expect(nachsignieren.mock.calls).toEqual([['bild-1'], ['bild-1']])
  })

  it('das geladene Bild loest nur seine eigene Sperre', () => {
    const nachsignieren = vi.fn()
    render(<Bildergalerie bilder={BILDER} onNachsignieren={nachsignieren} />)

    const bilder = screen.getAllByRole('img')
    fireEvent.error(bilder[0])
    fireEvent.error(bilder[1])
    // Nur das erste traegt wieder.
    fireEvent.load(bilder[0])
    fireEvent.error(bilder[0])
    fireEvent.error(bilder[1])

    expect(nachsignieren.mock.calls).toEqual([['bild-1'], ['bild-2'], ['bild-1']])
  })
})

/**
 * Kein Aufrufsturm, wenn der Stapel als Ganzes gescheitert ist.
 *
 * Befund 6 der Pruefung vom 13.09.2026: `bildAdressen` traegt bei einem
 * gescheiterten AUFRUF fuer JEDEN Pfad `null` ein (gemessen in
 * `store/feed.test.ts`, "Totalausfall"). Kam diese `null` bis zum 13.09. als
 * `?? ''` in der Galerie an, war jedes `src` leer, jedes leere `src` scheiterte
 * sofort - und aus einem gescheiterten Stapelaufruf wurden so viele
 * Einzelaufrufe, wie der Feed Bilder hat.
 *
 * Die Naht zwischen Speicher und Anzeige liegt auf `GalerieBild.url`:
 * `null` heisst "es gibt keine Adresse", nicht "die Adresse ist leer". Ein
 * Bild ohne Adresse hatte nie eine, die ablaufen konnte - nachsignieren ist
 * dafuer kein Heilmittel, sondern Laerm.
 */
describe('Bildergalerie: ein Bild ohne Adresse laesst nicht nachsignieren', () => {
  const ZWANZIG = Array.from({ length: 20 }, (_, i) => ({
    id: `bild-${i + 1}`,
    url: null,
  }))

  it('20 Bilder, Stapel als Ganzes gescheitert: null Einzel-Nachsignierungen', () => {
    const nachsignieren = vi.fn()
    render(<Bildergalerie bilder={ZWANZIG} onNachsignieren={nachsignieren} />)

    const bilder = screen.getAllByRole('img')
    expect(bilder).toHaveLength(20)
    bilder.forEach((b) => fireEvent.error(b))

    expect(nachsignieren).toHaveBeenCalledTimes(0)
  })

  it('ohne Adresse steht kein leeres src - der Browser holt nichts', () => {
    render(<Bildergalerie bilder={ZWANZIG} onNachsignieren={vi.fn()} />)

    const bild = screen.getAllByRole('img')[0]
    // Kein `src=""`: Ein leeres `src` liesse den Browser die SEITE laden und
    // als Bild verwerfen - ein Netzaufruf fuer ein Bild, das es nicht gibt.
    expect(bild.hasAttribute('src')).toBe(false)
  })

  it('gemischt: nur das Bild mit Adresse laesst nachsignieren', () => {
    const nachsignieren = vi.fn()
    render(
      <Bildergalerie
        bilder={[{ id: 'ohne', url: null }, BILDER[1]]}
        onNachsignieren={nachsignieren}
      />,
    )

    const bilder = screen.getAllByRole('img')
    fireEvent.error(bilder[0])
    fireEvent.error(bilder[1])

    expect(nachsignieren.mock.calls).toEqual([['bild-2']])
  })
})
