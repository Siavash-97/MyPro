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
