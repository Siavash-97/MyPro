import { describe, it, expect } from 'vitest'
import { dienstPunktAlsMessung, type DienstPunkt } from './aufzeichnungBruecke'
// `?raw` liefert den Quelltext als Zeichenkette - ohne Node-Typen, die
// dieses Projekt nicht eingebunden hat.
import quelle from './aufzeichnungBruecke.ts?raw'

/**
 * Kommt an, was der Dienst schickt?
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Am 26.08.2026 wurde der Schrittsensor gebaut: Java las ihn aus, schrieb
 * ihn nach SQLite und lieferte ihn im JSON aus. In JavaScript kam er nie an
 * - `DienstPunkt` kannte das Feld nicht, und die Uebersetzung in
 * `store/run.ts` zaehlte acht Felder auf, von denen `schrittzaehler` keines
 * war.
 *
 * **Die Tests der Bewegungserkennung waren gruen.** Sie bauen eine `Ortung`
 * von Hand und pruefen die Etage darueber. Der Riss lag darunter.
 *
 * Diese Datei prueft deshalb die Uebersetzung selbst - und, wichtiger,
 * verlangt fuer JEDES Feld des Dienstpunkts eine Entscheidung, statt eine
 * bestimmte Liste abzuzaehlen. Ein Feld, das der naechste hinzufuegt und zu
 * uebersetzen vergisst, macht diesen Test rot.
 */

/** Ein vollstaendiger Punkt, wie der Dienst ihn liefert. */
function dienstPunkt(): DienstPunkt {
  return {
    id: 42,
    zeit: 1_700_000_000_000,
    breite: 52.5,
    laenge: 13.4,
    genauigkeitM: 8.5,
    tempoMps: 2.7,
    tempoGueteMps: 0.4,
    hoeheM: 34,
    schrittzaehler: 8123,
  }
}

describe('dienstPunktAlsMessung', () => {
  it('reicht den Schrittzaehler durch', () => {
    // Der Fund vom 26.08.2026. Ohne diese Zeile ist der ganze Sensor tot,
    // und zwar lautlos: kein Fehler, nur `undefined`.
    expect(dienstPunktAlsMessung(dienstPunkt()).schrittzaehler).toBe(8123)
  })
})

/**
 * Felder des Dienstpunkts, die absichtlich NICHT in die Messung wandern -
 * mit Begruendung, damit die Ausnahme eine Entscheidung bleibt.
 */
const NICHT_UEBERSETZT: Record<string, string> = {
  id:
    'Kennung in der Datenbank des Dienstes. Sie dient dem Bestaetigen ' +
    '(`punkteBestaetigen`), nicht der Messung - ausserhalb des Telefons ' +
    'hat sie keine Bedeutung.',
}

describe('Uebersetzung verliert kein Feld', () => {
  it('uebersetzt jedes Feld des Dienstpunkts oder benennt es als Ausnahme', () => {
    const typ = quelle.match(/export interface DienstPunkt \{([\s\S]*?)\n\}/)
    expect(typ, 'DienstPunkt nicht gefunden - wurde der Typ umbenannt?').not.toBeNull()

    const rumpf = quelle.match(/export function dienstPunktAlsMessung[\s\S]*?\n\}/)
    expect(rumpf, 'dienstPunktAlsMessung nicht gefunden').not.toBeNull()

    // Nur echte Feldzeilen: Kommentarzeilen fallen weg. Genau daran ist der
    // Abdeckungstest beim Abmelden am 26.08.2026 einmal vorbeigelaufen -
    // eine auskommentierte Anmeldung zaehlte dort als Anmeldung.
    const felder = typ![1]
      .split('\n')
      .map((z: string) => z.trim())
      .filter((z: string) => z && !z.startsWith('*') && !z.startsWith('/*') && !z.startsWith('//'))
      .map((z: string) => z.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\??:/)?.[1])
      .filter((n): n is string => Boolean(n))

    expect(felder.length, 'keine Felder erkannt - Ausdruck kaputt?').toBeGreaterThan(5)

    const vergessen = felder.filter(
      (feld) => !rumpf![0].includes(`p.${feld}`) && !(feld in NICHT_UEBERSETZT),
    )

    expect(
      vergessen,
      'Diese Felder des Dienstpunkts kommen in JavaScript nie an. Entweder ' +
        'in dienstPunktAlsMessung uebersetzen, oder in NICHT_UEBERSETZT mit ' +
        `Begruendung eintragen: ${vergessen.join(', ')}`,
    ).toEqual([])
  })
})
