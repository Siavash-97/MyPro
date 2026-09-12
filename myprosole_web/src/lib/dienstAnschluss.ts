import { Capacitor, registerPlugin } from '@capacitor/core'
import type { DienstPunkt, DienstStand, AufzeichnungHindernis } from './aufzeichnungBruecke'

/**
 * Der eine Anschluss an das native Plugin - und zwei schmale Sichten darauf.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * `aufzeichnungBruecke.ts` trug bis zum 28.08.2026 zwei Module in einer
 * Datei: die Aufzeichnung (neun Exporte, Aufrufer `store/run.ts`) und die
 * Schrittzaehler-Berechtigung (drei Exporte, Aufrufer
 * `store/schrittrecht.ts`). Kein einziger Aufrufer ueberschnitt sich.
 *
 * Beim Trennen stellte sich heraus, dass beide Haelften dieselbe eine
 * Plugin-Registrierung brauchen. `registerPlugin` ein zweites Mal mit
 * demselben Namen aufzurufen ist kein Ausweg - gemessen im installierten
 * `@capacitor/core` (`index.cjs.js:69-73`): Es meldet
 * *"Capacitor plugin already registered. Cannot register plugins twice"*
 * auf der Konsole und gibt den vorhandenen Proxy zurueck.
 *
 * Also registriert diese Datei EINMAL und gibt zwei Sichten heraus. Jede
 * Bruecke sieht nur die Methoden, die sie benutzt - die Trennung gilt
 * damit auch gegenueber der nativen Seite, nicht nur zwischen den Dateien.
 *
 * Warum nicht die Bruecken direkt aneinander haengen: Dann waere die
 * Berechtigung wieder von der Aufzeichnung abhaengig, und die Trennung
 * waere eine Umbenennung statt einer Naht.
 */

/** Was die Aufzeichnung von der nativen Seite braucht. */
export interface AufzeichnungMethoden {
  starten(o: { laufId: string }): Promise<{ gelungen: boolean; hindernis: AufzeichnungHindernis }>
  stoppen(): Promise<{ gelungen: boolean }>
  /** `offen < 0` heisst: die Zaehlung ist gescheitert, der Wert ist unbekannt. */
  abholen(o: { laufId: string }): Promise<{ punkte: DienstPunkt[]; offen: number }>
  bestaetigen(o: { laufId: string; bisId: number }): Promise<{ geloescht: number; offen: number }>
  verwerfen(o: { laufId: string }): Promise<{ geloescht: number }>
  pausieren(o: { an: boolean }): Promise<{ gelungen: boolean }>
  stand(o: { laufId?: string }): Promise<DienstStand>
  /**
   * Den Beendenwunsch quittieren.
   *
   * Getrennt von `stand`, weil eine Abfrage nichts veraendern soll.
   */
  beendenWunschQuittieren(): Promise<void>
}

/** Was die Schrittzaehler-Berechtigung von der nativen Seite braucht. */
export interface SchrittrechtMethoden {
  schrittrechtStand(): Promise<{ stand: string }>
  schrittrechtAnfordern(): Promise<{ stand: string }>
  appEinstellungenOeffnen(): Promise<void>
}

const plugin = registerPlugin<AufzeichnungMethoden & SchrittrechtMethoden>('Aufzeichnung')

/** Die Aufzeichnungssicht auf den Anschluss. */
export const aufzeichnungAnschluss: AufzeichnungMethoden = plugin

/** Die Berechtigungssicht auf den Anschluss. */
export const schrittrechtAnschluss: SchrittrechtMethoden = plugin

/**
 * Laeuft die App auf einem Telefon?
 *
 * Im Browser gibt es den Dienst nicht. Das ist kein Mangel: Die Web-App wird
 * nicht mehr angeboten, der Browser dient nur noch der Entwicklung. Dort
 * bleibt die Aufzeichnung bei navigator.geolocation und hoert auf, sobald
 * der Tab in den Hintergrund geht - fuer die Arbeit an der Oberflaeche
 * genuegt das.
 *
 * Steht hier und nicht in einer der beiden Bruecken, weil es keine Frage
 * ueber Aufzeichnung und keine ueber Berechtigungen ist, sondern eine ueber
 * die Plattform. Beide Bruecken stellen sie.
 */
export function aufTelefon(): boolean {
  return Capacitor.isNativePlatform()
}
