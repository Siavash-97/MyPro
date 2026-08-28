/**
 * Der Zustand der Schrittzaehler-Berechtigung - und was er dem Laeufer
 * sagt.
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * `ACTIVITY_RECOGNITION` stand seit dem 26.08.2026 im Manifest, wurde
 * passiv geprueft und nirgends angefordert. Auf jedem Geraet ab Android 10
 * griff damit dauerhaft der Zweig "nicht erteilt": Der Schrittzaehler war
 * stumm, ohne Absturz, ohne Meldung - siehe
 * `Fehler und Bug Reports\2026-08-27_1330_der-sensor-der-nie-ankam.md`.
 *
 * Die Gestaltung ist keine freie Entscheidung. `docs/messquellen.md`
 * Abschnitt 4 legt drei Zustaende fest, ihre Saetze und die Regel darunter:
 *
 *   "Der Satz 'hat dein Geraet nicht' darf NUR fallen, wenn die Abfrage
 *    ohne Berechtigungsfrage moeglich war und wirklich nichts geliefert
 *    hat. Im Zweifel gilt der mildere Zustand."
 *
 * Genau dafuer ist dieses Modul die eine Stelle: Jede Anzeige des
 * Schrittrechts geht hier durch, damit der verbotene Satz nirgends aus
 * einer Vermutung entstehen kann.
 */

/**
 * Was mit dem Schrittsensor los ist.
 *
 * Bewusst KEIN `boolean`. Ein Ja/Nein kennt nur "geht" und "geht nicht" -
 * und "geht nicht" wuerde am Bildschirm zu "hat dein Geraet nicht", also
 * genau zu dem Satz, der uns den Kunden kostet.
 */
export type Schrittrecht =
  /** Erteilt. Der Dienst darf den Zaehler lesen. */
  | 'erteilt'
  /** Sensor da, Berechtigung fehlt - und Android fragt noch einmal. */
  | 'nicht-erlaubt'
  /**
   * Sensor da, Berechtigung fehlt, und Android zeigt den Dialog NICHT mehr.
   *
   * Ab Android 11 gilt zweimal abgelehnt als dauerhaft abgelehnt. Ein Knopf
   * "Erlauben" waere von da an ein Knopf, der nichts tut - dieselbe Gattung
   * Fehler wie die nie angeforderte Berechtigung selbst. Deshalb ein
   * eigener Zustand mit einem anderen Weg: den Systemeinstellungen.
   */
  | 'nicht-erlaubt-endgueltig'
  /**
   * Das Geraet hat den Sensor wirklich nicht.
   *
   * Diesen Zustand darf allein die Bruecke setzen, und nur nachdem sie ohne
   * Berechtigungsfrage nachgesehen hat. Er wird hier nie erraten.
   */
  | 'kein-sensor'
  /**
   * Wir wissen es nicht: kein Telefon, keine Bruecke, keine Antwort.
   *
   * Der milde Zustand aus messquellen.md. Er behauptet nichts ueber das
   * Geraet und traegt deshalb auch keinen Knopf, der etwas verspraeche.
   */
  | 'unbekannt'

const BEKANNT: readonly Schrittrecht[] = [
  'erteilt',
  'nicht-erlaubt',
  'nicht-erlaubt-endgueltig',
  'kein-sensor',
]

/**
 * Die Antwort der Bruecke in einen Zustand uebersetzen.
 *
 * Alles, was nicht ausdruecklich einer der bekannten Zustaende ist, wird
 * `unbekannt` - nicht `kein-sensor`. Das ist die Regel aus messquellen.md
 * als Code: Der harte Satz entsteht nie aus einer Luecke.
 */
export function schrittrechtAus(roh: string | null | undefined): Schrittrecht {
  if (roh == null) return 'unbekannt'
  return (BEKANNT as readonly string[]).includes(roh) ? (roh as Schrittrecht) : 'unbekannt'
}

/**
 * Was an einem Zustand zu tun ist - oder nichts.
 *
 * `null` heisst ausdruecklich "hier gibt es nichts zu tun", nicht "wir
 * haben noch keinen Knopf gebaut".
 */
export type Schritthandlung = 'anfordern' | 'einstellungen' | null

export interface Schrittanzeige {
  /** Vier bis fuenf Woerter, als Ueberschrift der Karte. */
  titel: string
  /**
   * Der Satz an den Laeufer.
   *
   * Fuer 'nicht-erlaubt' steht er woertlich in docs/messquellen.md:91 und
   * ist eine Projektfestlegung. Wer ihn umschreibt, aendert eine
   * Entscheidung, keine Formulierung.
   */
  satz: string
  /** Beschriftung des einen Knopfes - oder null, wenn es keinen gibt. */
  knopf: string | null
  handlung: Schritthandlung
}

const ANZEIGEN: Record<Schrittrecht, Schrittanzeige> = {
  erteilt: {
    titel: 'Schrittzähler erlaubt',
    satz: 'MyProSole darf den Schrittzähler deines Telefons lesen.',
    knopf: null,
    handlung: null,
  },
  'nicht-erlaubt': {
    titel: 'Schrittzähler nicht erlaubt',
    // Woertlich aus docs/messquellen.md, Abschnitt 4. Nicht umformulieren.
    satz: 'Dein Telefon kann das — MyProSole darf noch nicht darauf zugreifen.',
    knopf: 'Zugriff erlauben',
    handlung: 'anfordern',
  },
  'nicht-erlaubt-endgueltig': {
    titel: 'Schrittzähler nicht erlaubt',
    // Derselbe Sachverhalt, aber ein anderer Weg dorthin - und das muss im
    // Satz stehen, sonst tippt jemand dreimal auf einen Knopf, der nichts
    // mehr auslösen kann.
    satz:
      'Dein Telefon kann das — MyProSole darf noch nicht darauf zugreifen. Android fragt nicht mehr nach; die Erlaubnis gibt es jetzt nur noch in den Telefoneinstellungen.',
    knopf: 'Einstellungen öffnen',
    handlung: 'einstellungen',
  },
  'kein-sensor': {
    titel: 'Kein Schrittzähler',
    // Kein Knopf, keine Schuld (messquellen.md). Dieser Satz faellt nur,
    // wenn die Bruecke ohne Berechtigungsfrage nachgesehen hat.
    satz: 'Dein Telefon hat keinen Schrittzähler.',
    knopf: null,
    handlung: null,
  },
  unbekannt: {
    titel: 'Schrittzähler noch nicht geprüft',
    // Sagt, was wir wissen (nichts), und warum das kein Mangel am Geraet
    // ist. Kein Knopf: Es gibt nichts zu erlauben, solange wir nicht
    // wissen, ob es etwas zu erlauben gibt.
    satz: 'Ob dein Telefon einen Schrittzähler hat, konnten wir hier nicht feststellen.',
    knopf: null,
    handlung: null,
  },
}

export function schrittrechtAnzeige(stand: Schrittrecht): Schrittanzeige {
  return ANZEIGEN[stand]
}

/**
 * Darf der Laufbildschirm die Erlaubnis anbieten?
 *
 * Warum das eine eigene Entscheidung ist und nicht `stand ===
 * 'nicht-erlaubt'`
 * -------------------------------------------------------------------
 * Android zeigt den Berechtigungsdialog **hoechstens zweimal**. Wird er
 * zweimal weggetippt, ist er fuer immer weg, und die Erlaubnis gibt es nur
 * noch in den Systemeinstellungen.
 *
 * Der Laufbildschirm ist der schlechteste Ort, um diese zwei Versuche
 * auszugeben: Dort will jemand loslaufen. Ein Dialog im Weg wird
 * weggetippt, nicht gelesen - zweimal, und die Berechtigung ist tot, bevor
 * sie je erklaert wurde.
 *
 * Deshalb gibt der Lauf hoechstens EINEN Versuch aus. Der zweite gehoert
 * dem Bildschirm "Was dein Telefon kann", wo jemand aus eigenem Antrieb
 * ist und liest.
 *
 * `nicht-erlaubt-endgueltig` bekommt hier bewusst kein Angebot: Der Weg
 * dorthin fuehrt in die Systemeinstellungen und damit aus der App heraus -
 * mitten im laufenden Lauf ist das die schlechteste aller Einladungen.
 */
export function bietetImLaufAn(stand: Schrittrecht, schonGefragt: boolean): boolean {
  return stand === 'nicht-erlaubt' && !schonGefragt
}
