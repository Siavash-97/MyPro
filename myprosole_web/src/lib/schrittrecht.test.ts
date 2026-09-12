import { describe, it, expect } from 'vitest'
import { bietetImLaufAn, schrittrechtAnzeige, schrittrechtAus } from './schrittrecht'

/**
 * docs/messquellen.md, Abschnitt 4:
 *
 *   "Der Satz 'hat dein Geraet nicht' darf NUR fallen, wenn die Abfrage
 *    ohne Berechtigungsfrage moeglich war und wirklich nichts geliefert
 *    hat. Im Zweifel gilt der mildere Zustand."
 *
 * Das ist keine Geschmacksfrage: Wer weiss, dass sein Telefon einen
 * Schrittzaehler hat, und von uns das Gegenteil hoert, glaubt uns danach
 * auch die Zahlen nicht mehr.
 */
describe('schrittrechtAus', () => {
  it('nimmt die vier Zustaende, die die Bruecke kennt, unveraendert an', () => {
    expect(schrittrechtAus('erteilt')).toBe('erteilt')
    expect(schrittrechtAus('nicht-erlaubt')).toBe('nicht-erlaubt')
    expect(schrittrechtAus('nicht-erlaubt-endgueltig')).toBe('nicht-erlaubt-endgueltig')
    expect(schrittrechtAus('kein-sensor')).toBe('kein-sensor')
  })

  it('sagt bei fehlender Antwort NICHT "kein Sensor"', () => {
    // Kein Telefon, Bruecke nicht da, Methode noch nicht gebaut: In all
    // diesen Faellen wissen wir nichts. "unbekannt" ist der mildere
    // Zustand - er behauptet nichts ueber das Geraet.
    expect(schrittrechtAus(null)).toBe('unbekannt')
    expect(schrittrechtAus(undefined)).toBe('unbekannt')
  })

  it('sagt bei einem unbekannten Wort NICHT "kein Sensor"', () => {
    // Eine neue Fassung der Bruecke koennte einen Zustand liefern, den
    // diese Fassung nicht kennt. Auf "kein Sensor" zu raten waere genau
    // der Satz, den messquellen.md verbietet.
    expect(schrittrechtAus('irgendwas-neues')).toBe('unbekannt')
  })
})

/**
 * Die Saetze sind eine Projektfestlegung, keine Formulierungsfrage.
 * `docs/messquellen.md` Abschnitt 4 schreibt sie woertlich vor; diese
 * Tests sind der Waechter dagegen, dass jemand sie beim Umbauen "schoener"
 * macht.
 */
describe('schrittrechtAnzeige', () => {
  it('traegt fuer "nicht erlaubt" den festgelegten Satz woertlich', () => {
    const a = schrittrechtAnzeige('nicht-erlaubt')

    expect(a.satz).toBe(
      'Dein Telefon kann das — MyProSole darf noch nicht darauf zugreifen.',
    )
  })

  it('gibt "nicht erlaubt" einen Knopf zum Erlauben', () => {
    // messquellen.md: "Mit Knopf zum Erlauben". Ohne ihn ist die Meldung
    // eine Sackgasse - und der Sensor bleibt stumm.
    expect(schrittrechtAnzeige('nicht-erlaubt').handlung).toBe('anfordern')
  })

  it('schickt nach der endgueltigen Ablehnung in die Einstellungen, nicht in den Dialog', () => {
    // Android zeigt den Dialog nicht mehr. Ein Knopf "Erlauben" waere ein
    // Knopf, der nichts tut.
    expect(schrittrechtAnzeige('nicht-erlaubt-endgueltig').handlung).toBe('einstellungen')
  })

  it('gibt "kein Sensor" keinen Knopf - da ist keine Schuld abzutragen', () => {
    const a = schrittrechtAnzeige('kein-sensor')

    expect(a.handlung).toBeNull()
    expect(a.satz).toBe('Dein Telefon hat keinen Schrittzähler.')
  })

  it('behauptet im unbekannten Zustand nichts ueber das Geraet', () => {
    const a = schrittrechtAnzeige('unbekannt')

    expect(a.satz).not.toMatch(/hat kein/)
    expect(a.handlung).toBeNull()
  })

  it('gibt jedem Zustand einen eigenen Satz', () => {
    const alle = (
      ['erteilt', 'nicht-erlaubt', 'nicht-erlaubt-endgueltig', 'kein-sensor', 'unbekannt'] as const
    ).map((z) => schrittrechtAnzeige(z).satz)

    expect(new Set(alle).size).toBe(5)
  })
})

/**
 * Android zeigt den Berechtigungsdialog hoechstens zweimal. Danach ist er
 * fuer immer weg, und die Erlaubnis gibt es nur noch in den
 * Systemeinstellungen. Beide Versuche im Laufbildschirm zu verbrauchen -
 * dort, wo jemand loslaufen will und schnell wegtippt - heisst, die
 * Berechtigung zu verlieren, bevor sie je erklaert wurde.
 */
describe('bietetImLaufAn', () => {
  it('bietet an, solange noch nie gefragt wurde', () => {
    expect(bietetImLaufAn('nicht-erlaubt', false)).toBe(true)
  })

  it('bietet nach einer Ablehnung im Lauf nicht noch einmal an', () => {
    // Der zweite Versuch gehoert dem Bildschirm "Was dein Telefon kann" -
    // dort ist jemand aus eigenem Antrieb und liest.
    expect(bietetImLaufAn('nicht-erlaubt', true)).toBe(false)
  })

  it('schweigt in jedem anderen Zustand', () => {
    expect(bietetImLaufAn('erteilt', false)).toBe(false)
    // Endgueltig abgelehnt: Der Dialog kommt nicht mehr. Ein Verweis auf
    // die Systemeinstellungen mitten im Lauf hilft niemandem.
    expect(bietetImLaufAn('nicht-erlaubt-endgueltig', false)).toBe(false)
    expect(bietetImLaufAn('kein-sensor', false)).toBe(false)
    expect(bietetImLaufAn('unbekannt', false)).toBe(false)
  })
})
