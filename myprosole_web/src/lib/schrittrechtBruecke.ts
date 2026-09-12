import { aufTelefon, schrittrechtAnschluss } from './dienstAnschluss'
import { schrittrechtAus, type Schrittrecht } from './schrittrecht'

/**
 * Der Draht zur Schrittzaehler-Berechtigung.
 *
 * Warum diese Datei getrennt von `aufzeichnungBruecke.ts` steht
 * ------------------------------------------------------------
 * Bis zum 28.08.2026 stand beides in einer Datei, getrennt nur durch einen
 * Kommentarstrich. Eine Architektur-Durchsicht hat gezeigt, dass es zwei
 * Module waren, nicht eines:
 *
 *   - Kein gemeinsamer Aufrufer. Diese drei Funktionen gehen ausschliesslich
 *     an `store/schrittrecht.ts`, die neun anderen ausschliesslich an
 *     `store/run.ts`. Keine einzige Aufrufstelle ueberschnitt sich.
 *   - Kein gemeinsamer Zustand. Hier gibt es keine `laufId`.
 *   - Andere Aufrufregel. `schrittrechtAnfordern` darf nur aus einer
 *     Nutzerhandlung heraus laufen und verbraucht einen von zwei
 *     Android-Versuchen; fuer `punkteAbholen` gilt nichts dergleichen.
 *
 * Auf der nativen Seite liegen beide zu Recht zusammen: `@CapacitorPlugin`
 * erlaubt nur ein `permissions`-Array je Klasse, und die Nachmeldung des
 * Sensors muss in den laufenden Dienst greifen. **Dieser Zwang gilt in Java,
 * nicht in TypeScript.** Der gemeinsame Anschluss steht in
 * `dienstAnschluss.ts`; von dort holt sich jede Bruecke ihre schmale Sicht.
 */

/**
 * Wie steht es um `ACTIVITY_RECOGNITION`? Fragt nach, ohne zu fragen.
 *
 * Was die native Seite dafuer liefern muss
 * ----------------------------------------
 * `AufzeichnungPlugin.schrittrechtStand()` gibt `{ stand }` mit genau einem
 * dieser vier Woerter zurueck:
 *
 * | `stand` | Bedingung auf der Java-Seite |
 * | --- | --- |
 * | `erteilt` | `checkSelfPermission(ACTIVITY_RECOGNITION) == GRANTED` |
 * | `nicht-erlaubt` | nicht erteilt, **und** der Dialog kommt noch |
 * | `nicht-erlaubt-endgueltig` | nicht erteilt, **und** der Dialog kommt nicht mehr |
 * | `kein-sensor` | erteilt **und** `getDefaultSensor(TYPE_STEP_COUNTER) == null` |
 *
 * **Die Reihenfolge ist bindend.** `kein-sensor` darf erst geprueft werden,
 * NACHDEM die Berechtigung erteilt ist. Andernfalls entsteht genau der Satz,
 * den `docs/messquellen.md` Abschnitt 4 verbietet: "hat dein Geraet nicht",
 * obwohl es ihn hat. Fehlt die Berechtigung, gilt immer einer der beiden
 * `nicht-erlaubt`-Zustaende - auch dann, wenn wir das Geraet nicht kennen.
 *
 * **Die Unterscheidung der beiden `nicht-erlaubt` ist die heikle Stelle.**
 * `shouldShowRequestPermissionRationale()` allein reicht nicht: Es ist
 * `false`, BEVOR je gefragt wurde, und wieder `false`, NACHDEM endgueltig
 * abgelehnt wurde. Beide Male derselbe Wert, entgegengesetzte Bedeutung.
 *
 * **Diesen Merker fuehrt Capacitor bereits selbst** - die native Seite baut
 * ihn nicht nach. Belegt in der hier installierten Fassung,
 * `@capacitor/android`, `Bridge.java:1180-1186`: Nach einer Ablehnung wird
 * `PROMPT_WITH_RATIONALE` gespeichert, wenn `shouldShowRequestPermission-
 * Rationale()` true liefert, sonst `DENIED`. Also:
 *
 *     PROMPT, PROMPT_WITH_RATIONALE -> nicht-erlaubt
 *     DENIED                        -> nicht-erlaubt-endgueltig
 *
 * Ein fruehrerer Stand dieses Kommentars verlangte hier eigene
 * SharedPreferences. Das waere ein zweiter Merker neben dem von Capacitor
 * gewesen - und wer diesen Kommentar las, suchte im Plugin nach etwas, das
 * dort zu Recht fehlt. Gefunden vom Agenten `sicherheit` am 28.08.2026.
 *
 * **Was der Beleg NICHT deckt:** ob Capacitors Zwischenspeicher stimmt,
 * nachdem die Erlaubnis ausserhalb der App entzogen wurde (Einstellungen,
 * oder Androids automatisches Zuruecksetzen ungenutzter Apps). Er wird nur
 * geleert, wenn eine Anfrage `granted` liefert. Ungeprueft, gehoert am
 * Geraet nachgemessen.
 *
 * Was hier zurueckkommt, wenn es die Methode noch nicht gibt: eine
 * Ausnahme. Die wird hier gefangen und zu `unbekannt` - seit der
 * Typverengung vom 28.08.2026 uebersetzt diese Datei selbst, der Aufrufer
 * bekommt nie eine rohe Zeichenkette und nie `null`. Frueher stand hier,
 * der Store mache das; das stimmt nicht mehr. -
 * den milden Zustand. Nie `kein-sensor`.
 */
export async function schrittrechtStand(): Promise<Schrittrecht> {
  if (!aufTelefon()) return 'unbekannt'
  try {
    const antwort = await schrittrechtAnschluss.schrittrechtStand()
    return schrittrechtAus(antwort?.stand)
  } catch {
    // Bruecke da, Methode nicht: "not implemented". Das ist kein Wissen
    // ueber das Geraet - also behaupten wir keines.
    return 'unbekannt'
  }
}

/**
 * Den Systemdialog zeigen und den Zustand danach melden.
 *
 * Nur aus einer Nutzerhandlung heraus. Android zeigt den Dialog hoechstens
 * zweimal je Installation; danach ist er fuer immer weg. Siehe
 * `bietetImLaufAn` in `lib/schrittrecht.ts` fuer die Regel, wo diese zwei
 * Versuche ausgegeben werden duerfen.
 *
 * Der Rueckgabewert ist der Zustand NACH dem Dialog, nicht "hat der Nutzer
 * getippt". Ein `@PermissionCallback` liefert genau das; alles andere
 * muesste die Oberflaeche raten.
 */
export async function schrittrechtAnfordern(): Promise<Schrittrecht> {
  if (!aufTelefon()) return 'unbekannt'
  try {
    const antwort = await schrittrechtAnschluss.schrittrechtAnfordern()
    return schrittrechtAus(antwort?.stand)
  } catch {
    return 'unbekannt'
  }
}

/**
 * Die Systemeinstellungen dieser App oeffnen.
 *
 * Der einzige Weg zurueck, wenn Android den Dialog nicht mehr zeigt. Ohne
 * ihn waere `nicht-erlaubt-endgueltig` eine Sackgasse mit der Anweisung
 * "such es dir selbst".
 *
 * Meldet `false`, wenn es nicht ging - dann sagt die Oberflaeche den Weg in
 * Worten, statt so zu tun, als sei etwas passiert.
 */
export async function appEinstellungenOeffnen(): Promise<boolean> {
  if (!aufTelefon()) return false
  try {
    await schrittrechtAnschluss.appEinstellungenOeffnen()
    return true
  } catch {
    return false
  }
}
