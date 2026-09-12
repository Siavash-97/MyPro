import { describe, it, expect } from 'vitest'
import { istDauerhaft, istDauerhafterCode, MAX_VERSUCHE } from './stoppfehler'

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
  // Bis zum 29.08.2026 stand hier ein Test fuer `istDauerhaft('zeitgrenze', ...)`.
  // 'zeitgrenze' ist seitdem kein `Stoppfehler` mehr: Eine haengende
  // Zeitgrenze beim Schreiben erreicht diese Funktion nicht laenger -
  // `stopRun` gibt den Lauf sofort frei, siehe store/run.ts (`Stoppfehler`,
  // `bestaetigungNachholen`). Der Test wurde nicht ersetzt, weil sein
  // Gegenstand nicht mehr existiert.

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

/**
 * Der Fehlercode allein - ohne Kategorie, ohne Zaehler.
 *
 * Herausgeloest am 29.08.2026 fuer `bestaetigungNachholen` (store/run.ts).
 * Jene Schleife laeuft im Hintergrund, hat keine Kategorie aus
 * `Stoppergebnis` und keinen Menschen, der noch einmal tippt: Ohne diese
 * Unterscheidung rannte sie eine volle Stunde gegen eine Rechteverletzung
 * und gab danach stillschweigend auf.
 */
describe('istDauerhafterCode', () => {
  it('erkennt die beiden Klassen, die durch Wiederholen nicht besser werden', () => {
    // Die Sollwerte kommen aus dem PostgreSQL-Handbuch, Appendix A -
    // nachgeschlagen, nicht aus dem Verhalten der Funktion abgeleitet.
    //   23503 foreign_key_violation      - genau der Fall, der diese
    //                                      Aenderung ausgeloest hat: ein
    //                                      Punkt auf eine Zeile, die es
    //                                      nicht gibt.
    //   23514 check_violation
    //   42501 insufficient_privilege     - Zeilenrechte
    expect(istDauerhafterCode('23503')).toBe(true)
    expect(istDauerhafterCode('23514')).toBe(true)
    expect(istDauerhafterCode('42501')).toBe(true)
  })

  it('haelt alles andere fuer wiederholbar', () => {
    // Kein Code heisst: nichts ueber die Anfrage bekannt. Das ist der
    // Normalfall bei einem Netzabbruch - und genau dort MUSS die Schleife
    // weiterlaufen, sonst ist die ganze Funktion sinnlos.
    expect(istDauerhafterCode(undefined)).toBe(false)
    expect(istDauerhafterCode('')).toBe(false)
    // PGRST116 kommt von PostgREST, nicht von PostgreSQL, und heisst nur
    // "keine Zeile getroffen" - kein Grund aufzugeben.
    expect(istDauerhafterCode('PGRST116')).toBe(false)
    // 08006 connection_failure: Klasse 08 ist die Verbindung selbst.
    expect(istDauerhafterCode('08006')).toBe(false)
  })

  it('sagt dasselbe wie istDauerhaft, wo beide zustaendig sind', () => {
    // Die Klassenliste steht nach dem Herausloesen an EINER Stelle. Dieser
    // Test wuerde rot, wenn sie wieder auseinanderliefe.
    expect(istDauerhaft('ablage', '23503', 1)).toBe(istDauerhafterCode('23503'))
    expect(istDauerhaft('ablage', '08006', 1)).toBe(istDauerhafterCode('08006'))
  })
})
