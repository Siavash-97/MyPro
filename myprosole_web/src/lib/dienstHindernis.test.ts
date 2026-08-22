import { describe, it, expect } from 'vitest'
import { hindernisMeldung } from './dienstHindernis'

/**
 * Bis zum 22.08.2026 wurde `dienstHindernis` im Speicher gesetzt und von
 * keinem Bildschirm gelesen. Im Quelltext stand daneben "Die Oberflaeche
 * sagt es dann" - eine Zusicherung, die es nicht gab.
 *
 * Was auf dem Spiel steht: In jedem dieser Faelle laeuft die Aufzeichnung
 * NUR, solange der Bildschirm an ist. Wer das Telefon einsteckt und
 * losgeht, zeichnet nichts auf.
 */
describe('hindernisMeldung', () => {
  it('schweigt, wenn der Dienst laeuft', () => {
    expect(hindernisMeldung(null)).toBeNull()
  })

  it('schweigt im Browser - dort gibt es keinen Dienst', () => {
    // 'kein-telefon' ist kein Hindernis, sondern eine andere Umgebung. Eine
    // Warnung waere hier eine Falschmeldung.
    expect(hindernisMeldung('kein-telefon')).toBeNull()
  })

  it('nennt bei fehlender Erlaubnis die Folge, nicht nur die Ursache', () => {
    const meldung = hindernisMeldung('keine-erlaubnis')

    expect(meldung).not.toBeNull()
    // Die Folge ist das Entscheidende: Der Laeufer muss wissen, dass er den
    // Bildschirm anlassen muss - nicht, wie die Berechtigung heisst.
    expect(meldung?.folge).toMatch(/Bildschirm/)
  })

  it('unterscheidet die drei Hindernisse', () => {
    const texte = (['keine-erlaubnis', 'gps-aus', 'start-abgelehnt'] as const).map(
      (h) => hindernisMeldung(h)?.titel,
    )

    expect(new Set(texte).size).toBe(3)
  })
})
