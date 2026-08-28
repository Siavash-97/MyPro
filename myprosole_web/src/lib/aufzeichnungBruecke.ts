import { aufTelefon, aufzeichnungAnschluss } from './dienstAnschluss'
import type { RohMessung } from '../store/run'

/**
 * Der Draht zum Aufzeichnungsdienst auf dem Telefon.
 *
 * Warum es den Dienst gibt
 * ------------------------
 * Capacitor friert eine im Hintergrund liegende Seite nach fuenf Minuten
 * ein. Wer den Bildschirm ausschaltet und das Telefon einsteckt – also jeder
 * Laeufer – haette danach keine Aufzeichnung mehr. Der Dienst laeuft
 * ausserhalb der Seite weiter und schreibt selbst auf die Platte.
 *
 * Daraus die Arbeitsteilung, die diese Datei durchsetzt:
 *
 *   Der Dienst sammelt und speichert. Er ist die Wahrheit.
 *   JavaScript rechnet und zeigt an. Es ist die Anzeige.
 *
 * Warum die Punkte in zwei Schritten abgeholt werden
 * --------------------------------------------------
 * Erst holen, dann bestaetigen, dann loescht der Dienst. Ein Absturz
 * dazwischen kostet nichts: Die Punkte kommen beim naechsten Abholen erneut.
 * Doppelt ist harmlos, weg waere es nicht.
 */

/** Eine rohe Messung, wie der Dienst sie abgelegt hat. */
export interface DienstPunkt {
  /** Fortlaufende Kennung in der Datenbank des Dienstes. */
  id: number
  /** Millisekunden seit 1970. */
  zeit: number
  breite: number
  laenge: number
  genauigkeitM: number | null
  tempoMps: number | null
  /**
   * Die Guete der Geschwindigkeit selbst, in m/s – ab Android 8.
   *
   * Kein kostenloses Plugin reicht dieses Feld durch; das kostenpflichtige
   * wirbt damit. Weil wir den Dienst selbst gebaut haben, ist es da. Benutzt
   * wird es noch nicht: Die Bewegungserkennung filtert bisher nur nach der
   * Ortsgenauigkeit. Es zu speichern kostet nichts und macht den naechsten
   * Schritt moeglich.
   */
  tempoGueteMps: number | null
  hoeheM: number | null
  /**
   * Stand des Schrittzaehlers, oder null.
   *
   * null heisst: kein Sensor im Geraet, oder ACTIVITY_RECOGNITION nicht
   * erteilt. Ausdruecklich NICHT "null Schritte" - siehe
   * `schritteProSekundeAus` in `bewegung.ts`.
   */
  schrittzaehler: number | null
}

/**
 * Einen Punkt des Dienstes in eine Messung uebersetzen.
 *
 * Warum das eine eigene Funktion ist und nicht drei Zeilen im Speicher:
 * Diese Uebersetzung ist eine **Feldliste**, und Feldlisten verlieren
 * Felder. Genau das ist am 26.08.2026 passiert - `schrittzaehler` wurde in
 * Java geschrieben, im JSON ausgeliefert und hier stillschweigend fallen
 * gelassen. Als Funktion hat die Liste einen Ort, und dieser Ort hat einen
 * Test, der jedes neue Feld einfordert.
 */
export function dienstPunktAlsMessung(p: DienstPunkt): RohMessung {
  return {
    latitude: p.breite,
    longitude: p.laenge,
    altitude_m: p.hoeheM,
    accuracy_m: p.genauigkeitM,
    speed_mps: p.tempoMps,
    tempo_guete_mps: p.tempoGueteMps,
    schrittzaehler: p.schrittzaehler,
    zeitMs: p.zeit,
    ausPuffer: true,
  }
}

/** Warum der Dienst nicht startet – damit die Seite es benennen kann. */
export type AufzeichnungHindernis = 'keine-erlaubnis' | 'gps-aus' | 'start-abgelehnt' | null


export interface DienstStand {
  /** Wie viele Punkte warten noch auf das Abholen. */
  offen: number
  erlaubt: boolean
  gpsAn: boolean
  pausiert: boolean
  /** Laeuft ueberhaupt eine Aufzeichnung? */
  laeuft: boolean
  /**
   * Welche Aufzeichnung der Dienst haelt - auch ohne dass man danach fragt.
   *
   * Bis zum 22.08.2026 gab er sie nie heraus. Die App hielt die Kennung nur
   * im Arbeitsspeicher; schoss Android sie ab, war sie weg, und die
   * gesammelten Punkte lagen unerreichbar im Dienstspeicher. Gemessen: 611
   * verwaiste Punkte und neun von sechzehn Laeufen auf "tracking".
   */
  laufId: string | null
  /** Wann kam die letzte Messung? Null heisst: gar keine. */
  letzterPunktMs: number | null
  /**
   * Wann wurde der Knopf gedrueckt? Null heisst: der Dienst weiss es nicht
   * mehr (er raeumt den Wert beim Beenden weg).
   *
   * Die Bergung braucht ihn, um die Dauer zu bilden. Vorher riet sie auf die
   * Zeit der letzten Messung - ein Lauf von einer Stunde galt damit als
   * Sekunden lang.
   */
  startMs: number | null
  /**
   * Alle Sitzungen, fuer die noch Punkte im Dienstspeicher liegen -
   * juengste zuerst, jede als {laufId, anzahl, letzteZeit}.
   *
   * Seit dem 23.08.2026 dabei, weil der Dienst sich sonst nur EINE Sitzung
   * merkt: 611 Punkte vom 21.08. lagen abrufbar da, und niemand konnte sie
   * je wieder finden, weil eine neuere Sitzung den Schluessel ueberschrieben
   * hatte.
   *
   * **Der Verbraucher fehlt mit Absicht, nicht aus Vergessen:** Was mit
   * einer gefundenen fremden Sitzung geschehen soll - als eigener Lauf
   * speichern oder verwerfen -, ist eine offene Entscheidung des Nutzers
   * (B14). Sie einem alten Lauf ueber die Uhrzeit zuzuordnen waere geraten.
   * Die Auswahlregel dafuer liegt fertig und geprueft in
   * `lib/verwaisteSitzungen.ts`.
   */
  offeneSitzungen?: Array<{ laufId: string; anzahl: number; letzteZeit: number }>
  /**
   * Hat jemand in der Benachrichtigung auf "Beenden" getippt?
   *
   * Einmalige Nachricht, kein Zustand: Der Dienst loescht sie beim Lesen.
   * Bliebe sie stehen, fragte die App nach jedem Oeffnen erneut nach - auch
   * wenn man laengst abgelehnt hat.
   */
  beendenGewuenscht: boolean
}

// Die Plugin-Registrierung und `aufTelefon` stehen seit dem 28.08.2026 in
// `dienstAnschluss.ts` - beide Bruecken brauchen sie, und `registerPlugin`
// darf nur einmal je Name laufen.
export { aufTelefon } from './dienstAnschluss'

export async function aufzeichnungStarten(
  laufId: string,
): Promise<AufzeichnungHindernis | 'kein-telefon'> {
  if (!aufTelefon()) return 'kein-telefon'
  try {
    const antwort = await aufzeichnungAnschluss.starten({ laufId })
    return antwort.gelungen ? null : antwort.hindernis
  } catch {
    return 'start-abgelehnt'
  }
}

export async function aufzeichnungStoppen(): Promise<void> {
  if (!aufTelefon()) return
  try {
    await aufzeichnungAnschluss.stoppen()
  } catch {
    // Schon gestoppt oder gar nicht gestartet – das Ergebnis ist dasselbe.
  }
}

/**
 * Die aeltesten offenen Punkte holen - und sagen, wie viele noch warten.
 *
 * `offen` wird seit dem 28.08.2026 durchgereicht statt weggeworfen. Vorher
 * musste der Aufrufer raten, ob noch etwas kommt, und tat das ueber
 * `punkte.length < 500` - wobei die 500 eine Java-Konstante ist
 * (`AufzeichnungPlugin.java`, `BUENDEL`), die als nackte Zahl in
 * `store/run.ts` stand. Zwei Orte fuer eine Zahl, und der eine wusste
 * nichts vom anderen.
 *
 * Mit `offen` braucht es die Zahl an keinem Ort mehr: Der Dienst sagt
 * selbst, ob noch etwas da ist. Aendert sich die Buendelgroesse in Java,
 * muss niemand nachziehen.
 *
 * `offen` zaehlt ALLE offenen Punkte dieses Laufs, auch die gerade
 * herausgegebenen - sie verschwinden erst beim Bestaetigen. „Es kommt
 * noch etwas" heisst deshalb `offen > punkte.length`.
 */
export async function punkteAbholen(
  laufId: string,
): Promise<{ punkte: DienstPunkt[]; offen: number }> {
  if (!aufTelefon()) return { punkte: [], offen: 0 }
  try {
    const antwort = await aufzeichnungAnschluss.abholen({ laufId })
    return { punkte: antwort.punkte ?? [], offen: antwort.offen ?? 0 }
  } catch {
    return { punkte: [], offen: 0 }
  }
}

export async function punkteBestaetigen(laufId: string, bisId: number): Promise<void> {
  if (!aufTelefon()) return
  try {
    await aufzeichnungAnschluss.bestaetigen({ laufId, bisId })
  } catch {
    // Nicht bestaetigt heisst: beim naechsten Mal noch einmal. Harmlos.
  }
}

export async function punkteVerwerfen(laufId: string): Promise<void> {
  if (!aufTelefon()) return
  try {
    await aufzeichnungAnschluss.verwerfen({ laufId })
  } catch {
    // Bleibt liegen und wird beim naechsten Verwerfen mitgenommen.
  }
}

/**
 * Pausieren oder fortsetzen.
 *
 * Der Dienst behaelt seine Punkte und laeuft weiter; nur der Empfaenger wird
 * abgemeldet. Die Zeitrechnung bleibt Sache der App.
 */
export async function aufzeichnungPausieren(an: boolean): Promise<void> {
  if (!aufTelefon()) return
  try {
    await aufzeichnungAnschluss.pausieren({ an })
  } catch {
    // Der Dienst laeuft dann weiter und sammelt. Aergerlich fuer den Akku,
    // aber kein Datenverlust - und die App zeigt trotzdem "pausiert".
  }
}

/**
 * Den Beendenwunsch quittieren - er ist gesehen und behandelt.
 *
 * Warum das ein eigener Aufruf ist: `aufzeichnungStand` hat den Merker bis
 * zum 28.08.2026 beim Lesen geloescht. Die Signatur sah wie eine Abfrage
 * aus, und ihr Aufrufer sitzt in einem `visibilitychange`-Handler - jeder
 * Wechsel in den Vordergrund verbrauchte die Nachricht, ob jemand sie
 * gesehen hatte oder nicht. Gefunden bei der Architektur-Durchsicht am
 * 28.08.2026.
 */
export async function beendenWunschQuittieren(): Promise<void> {
  if (!aufTelefon()) return
  try {
    await aufzeichnungAnschluss.beendenWunschQuittieren()
  } catch {
    // Bleibt der Merker stehen, fragt die App beim naechsten Mal erneut.
    // Laestig, aber besser als eine verlorene Nachricht.
  }
}

export async function aufzeichnungStand(laufId?: string): Promise<DienstStand | null> {
  if (!aufTelefon()) return null
  try {
    return await aufzeichnungAnschluss.stand({ laufId })
  } catch {
    return null
  }
}
