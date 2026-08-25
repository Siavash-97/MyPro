import { describe, it, expect } from 'vitest'
import { wohin, type Wegzustand } from './wegweiser'

/**
 * Die Entscheidung des Waechters, getrennt von seiner Umsetzung.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Der Agent `pruefung` fand am 25.08.2026: Von den drei behobenen Ursachen
 * des "Registrierung kommt immer wieder"-Fehlers war die Entscheidung des
 * Waechters ueberhaupt nicht geprueft - sie steckte in einer Komponente, und
 * die Web-App hat weder `jsdom` noch `@testing-library`.
 *
 * Statt eine Testumgebung nachzuruesten, ist die Entscheidung hierher
 * gewandert. `AuthGuard` beantwortet damit nur noch, WIE umgeleitet wird;
 * WOHIN entscheidet eine reine Funktion.
 *
 * Was damit NICHT geprueft ist: dass der Waechter bei einer Token-Erneuerung
 * nicht neu laedt (die Umstellung von `[user]` auf `[user?.id]`). Das ist
 * eine Eigenschaft eines Effekts, keine einer Entscheidung, und dafuer
 * braeuchte es wirklich eine Testumgebung fuer Komponenten.
 */

const BASIS: Wegzustand = {
  angemeldet: true,
  profilBekannt: true,
  anzeigename: 'Sia',
  blockAOffen: false,
  pfad: '/',
}

describe('wohin', () => {
  it('schickt ohne Konto zur Willkommensseite', () => {
    expect(wohin({ ...BASIS, angemeldet: false })).toBe('/willkommen')
  })

  it('laesst ein vollstaendiges Konto durch', () => {
    expect(wohin(BASIS)).toBeNull()
  })

  it('schickt ohne Anzeigenamen in die Einrichtung', () => {
    expect(wohin({ ...BASIS, anzeigename: null })).toBe('/profil/setup')
  })

  it('behandelt einen Anzeigenamen aus Leerzeichen wie keinen', () => {
    expect(wohin({ ...BASIS, anzeigename: '   ' })).toBe('/profil/setup')
  })

  it('schickt bei offener Anamnese dorthin', () => {
    expect(wohin({ ...BASIS, blockAOffen: true })).toBe('/anamnese')
  })

  // --- Der Kern: was passiert, solange nichts bekannt ist

  it('schickt NICHT in die Einrichtung, solange das Profil unbekannt ist', () => {
    // Der gemeldete Fehler vom 25.08.2026: Ein gescheitertes Laden sah aus
    // wie "kein Profil", und die App sprang auf "Profil einrichten".
    expect(
      wohin({ ...BASIS, profilBekannt: false, anzeigename: null }),
    ).toBeNull()
  })

  it('schickt auch dann nicht in die Anamnese, wenn das Profil unbekannt ist', () => {
    // Ohne bekannten Anzeigenamen ist die Reihenfolge nicht entscheidbar -
    // wer noch gar kein Profil hat, gehoert nicht in die Anamnese.
    expect(
      wohin({ ...BASIS, profilBekannt: false, anzeigename: null, blockAOffen: true }),
    ).toBeNull()
  })

  // --- Kein Umleiten auf die Seite, auf der man schon steht

  it('leitet nicht auf die Einrichtung um, wenn man dort schon ist', () => {
    expect(
      wohin({ ...BASIS, anzeigename: null, pfad: '/profil/setup' }),
    ).toBeNull()
  })

  it('leitet nicht auf die Anamnese um, wenn man dort schon ist', () => {
    expect(wohin({ ...BASIS, blockAOffen: true, pfad: '/anamnese' })).toBeNull()
  })

  it('schickt ohne Konto auch von der Willkommensseite aus dorthin', () => {
    // Hier ist es umgekehrt: Der Waechter steht nur vor GESCHUETZTEN Seiten,
    // `/willkommen` gehoert nicht dazu. Kaeme es doch so weit, waere ein
    // Verweis auf sich selbst richtig - React Router bricht das nicht.
    expect(wohin({ ...BASIS, angemeldet: false, pfad: '/willkommen' })).toBe(
      '/willkommen',
    )
  })

  // --- Reihenfolge

  it('nimmt die Einrichtung vor der Anamnese', () => {
    expect(
      wohin({ ...BASIS, anzeigename: null, blockAOffen: true }),
    ).toBe('/profil/setup')
  })
})
