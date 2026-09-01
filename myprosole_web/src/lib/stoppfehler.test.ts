import { describe, it, expect } from 'vitest'
import { istDauerhaft, MAX_VERSUCHE } from './stoppfehler'

/**
 * Wiederholbar oder dauerhaft? Die Frage, an der eine Endlosschleife hing.
 *
 * Gefunden von `improve-codebase-architecture` am 24.08.2026: Der einzige
 * Rueckweg aus einem gescheiterten Speichervorgang schickte **alles** zurueck
 * in die Aufzeichnung. Bei einem dauerhaften Fehler holte die Bergung beim
 * naechsten Start denselben Lauf, scheiterte gleich, und das ueber Neustarts
 * hinweg.
 *
 * Die Unterscheidung war im Typ `Stoppfehler` schon angelegt und wurde nie
 * benutzt. Diese Datei benutzt sie.
 */
describe('istDauerhaft', () => {
  it('haelt eine Zeitgrenze fuer wiederholbar', () => {
    // Sollwert-Begruendung: Eine Zeitgrenze sagt nichts ueber die Anfrage,
    // nur ueber das Netz. Sie NICHT als wiederholbar zu behandeln waere der
    // teurere Fehler - dann gaebe eine einzelne Funkloch-Sekunde den Lauf
    // verloren.
    expect(istDauerhaft('zeitgrenze', undefined, 1)).toBe(false)
    expect(istDauerhaft('zeitgrenze', undefined, 99)).toBe(false)
  })

  it('haelt eine Rechteverletzung fuer dauerhaft', () => {
    // 42501 = insufficient_privilege. Wiederholen aendert daran nichts;
    // es braucht eine Migration oder eine andere Anmeldung.
    expect(istDauerhaft('ablage', '42501', 1)).toBe(true)
  })

  it('haelt Constraint-Verletzungen fuer dauerhaft', () => {
    // 23xxx = integrity_constraint_violation. Dieselben Daten scheitern
    // beim naechsten Mal genauso.
    expect(istDauerhaft('ablage', '23505', 1)).toBe(true)   // unique
    expect(istDauerhaft('ablage', '23503', 1)).toBe(true)   // foreign key
    expect(istDauerhaft('ablage', '23514', 1)).toBe(true)   // check
  })

  it('haelt einen Netzfehler ohne Code fuer wiederholbar - bis N Versuche', () => {
    // Der Rueckfall fuer unbekannte Fehlerformen. Ohne Code laesst sich
    // nichts entscheiden, also wird es versucht - aber nicht endlos.
    //
    // Sollwert-Begruendung fuer die Grenze: Sie muss GROESSER als 1 sein,
    // sonst waere jeder Wackler dauerhaft. Und sie muss endlich sein, sonst
    // ist es wieder die Endlosschleife. Der genaue Wert ist eine
    // Abwaegung, keine Wahrheit - er steht als Konstante, damit er an einer
    // Stelle aenderbar ist.
    expect(istDauerhaft('ablage', undefined, 1)).toBe(false)
    expect(istDauerhaft('ablage', undefined, MAX_VERSUCHE - 1)).toBe(false)
    expect(istDauerhaft('ablage', undefined, MAX_VERSUCHE)).toBe(true)
  })

  it('haelt "nicht angemeldet" fuer dauerhaft - aber nur bis zum Login', () => {
    // Dauerhaft im Sinne von: Wiederholen hilft nicht. Aufloesen kann es
    // nur eine fremde Handlung - eine Anmeldung.
    //
    // Sollwert-Begruendung, warum hier NICHT gezaehlt wird: Ein zweiter
    // Versuch ohne Anmeldung scheitert mit Sicherheit genauso. Ihn zu
    // erlauben waere nicht vorsichtig, sondern nur langsam.
    expect(istDauerhaft('nicht-angemeldet', undefined, 1)).toBe(true)
  })

  it('laesst sich von einem unbekannten Code nicht taeuschen', () => {
    // Ein Code, den wir nicht kennen, ist kein Beleg fuer "dauerhaft".
    // Er faellt in den Zaehlweg - genau wie gar kein Code.
    expect(istDauerhaft('ablage', 'PGRST999', 1)).toBe(false)
    expect(istDauerhaft('ablage', 'PGRST999', MAX_VERSUCHE)).toBe(true)
  })

  it('haelt unsinnige Zaehlerstaende aus', () => {
    expect(istDauerhaft('ablage', undefined, NaN)).toBe(false)
    expect(istDauerhaft('ablage', undefined, -5)).toBe(false)
  })
})
