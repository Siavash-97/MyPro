import { supabase } from './supabase'
import { offenePunkte, punkteVerworfen } from './punktePuffer'
import { istUrteil } from './segmenturteil'

/**
 * Uebertraegt gepufferte GPS-Punkte in Buendeln.
 *
 * Warum in Buendeln
 * -----------------
 * Ein Punkt pro Sekunde und Person waere bei zehntausend gleichzeitig
 * Laufenden zehntausend Schreibvorgaenge pro Sekunde. Gebuendelt alle 30
 * Sekunden sind es 333 – derselbe Nutzen, ein Dreissigstel der Last. Die
 * Datenbank schreibt fuenfzig Zeilen in einem Vorgang fast so schnell wie
 * eine einzelne; der Aufwand steckt im Hin und Her, nicht in den Daten.
 *
 * Warum Doppelte nichts ausmachen
 * -------------------------------
 * Scheitert eine Uebertragung, nachdem die Datenbank sie angenommen hat,
 * weiss die App nicht, ob sie ankam. Sie schickt einfach nochmal: Die
 * Kennung vom Geraet sorgt dafuer, dass die Datenbank Doppelte abweist
 * (Migration 0033). Deshalb wird oertlich auch erst geloescht, wenn die
 * Uebertragung bestaetigt ist.
 */

/** Hoechstens so viele Zeilen je Anfrage. */
const BUENDEL = 200

/** So oft soll uebertragen werden, solange ein Lauf laeuft. */
export const UEBERTRAGUNG_TAKT_MS = 30_000

/**
 * Ist es Zeit fuer die naechste Uebertragung?
 *
 * Warum das eine eigene Funktion ist und keine Bedingung im Takt
 * ------------------------------------------------------------
 * Hier stand bis zum 23.08.2026:
 *
 *   if (durationS > 0 && durationS % 30 === 0) punkteUebertragen()
 *
 * Am 23.08. im Feld gemessen, waehrend der Nutzer im Zug sass: Lauf seit
 * zwanzig Minuten, **244 Punkte im Geraetepuffer, 0 in der Datenbank**.
 *
 * `durationS` waechst nur, wenn der Anzeigetakt laeuft. Bei ausgeschaltetem
 * Bildschirm drosselt Android den Takt im WebView; `durationS` springt dann
 * etwa von 100 auf 160, und ein Vielfaches von 30 wird uebersprungen. Es ist
 * kein "seltener" - es ist ein Treffer-oder-nicht mit einer Chance von eins
 * zu dreissig je gedrosseltem Takt.
 *
 * **Eine Modulo-Pruefung auf einem Wert, der springen kann, ist keine
 * Taktung.** Die richtige Frage ist nicht "ist die Zahl gerade durch dreissig
 * teilbar", sondern "ist genug Zeit vergangen".
 *
 * Was das NICHT loest: Laeuft der Takt gar nicht, wird auch nicht gefragt.
 * Der vollstaendige Weg waere, die Uebertragung aus dem gedrosselten
 * Zeitgeber herauszunehmen und in den Vordergrunddienst zu legen. Das ist
 * der naechste Schritt, nicht dieser.
 *
 * @param letzteMs Zeitpunkt der letzten Uebertragung, oder null.
 */
export function istUebertragungFaellig(letzteMs: number | null, jetztMs: number): boolean {
  if (letzteMs == null || !Number.isFinite(letzteMs)) return true
  if (!Number.isFinite(jetztMs)) return false
  // Springt die Uhr zurueck (Sommerzeit, Zeitabgleich), lieber einmal zu
  // frueh uebertragen als nie wieder.
  if (jetztMs < letzteMs) return true
  return jetztMs - letzteMs >= UEBERTRAGUNG_TAKT_MS
}

/**
 * Antwortet die Datenbank, dass sie die Spalte `urteil` nicht kennt?
 *
 * Warum das ueberhaupt geprueft wird
 * ----------------------------------
 * `urteil` kommt mit Migration 0051. Zwischen dem Ausrollen der App und dem
 * Einspielen der Migration gibt es ein Fenster - und in diesem Fenster
 * wuerde PostgREST **jede** Uebertragung mit PGRST204 abweisen, weil eine
 * Spalte im Rumpf steht, die es nicht gibt.
 *
 * Genau diese Klasse Fehler hat am 22.08.2026 einen Tag gekostet: Ein
 * Planungsfehler (42P10) traf jede einzelne Uebertragung, unabhaengig von
 * Netz und Anmeldung, und niemand sah es. Ein zweites Mal wird das nicht
 * dem Zufall der Reihenfolge ueberlassen.
 *
 * Geprueft wird der Code und nicht der Text: PGRST204 ist "column not found
 * in schema cache". Auf das englische Wort zu pruefen waere dieselbe Falle
 * wie bei `istDoppelt` - die Meldung kann uebersetzt sein.
 */
function kenntUrteilNicht(fehler: { code?: string } | null): boolean {
  // PGRST204 - die Spalte fehlt (Migration noch nicht eingespielt).
  // 23514    - die Pruefbedingung auf der Spalte ist verletzt.
  //
  // Der zweite Fall ist der gefaehrlichere, obwohl er unwahrscheinlicher
  // ist: Ein einziger ungueltiger Wert laesst das ganze Buendel scheitern,
  // der Punkt bleibt im Puffer, und JEDE weitere Uebertragung scheitert an
  // ihm. Eine Blockade, die sich von selbst nicht aufloest - ab da geht
  // jede weitere Strecke verloren, und die Standortdaten auf dem Geraet
  // wachsen ohne Grenze.
  //
  // `istUrteil` sollte das schon vorher abfangen. Dies ist die zweite Reihe,
  // fuer den Fall, dass die Pruefbedingung strenger ist als unsere Liste.
  return fehler?.code === 'PGRST204' || fehler?.code === '23514'
}

/** Was eine Uebertragung ergeben hat. */
export interface Uebertragung {
  /** Wie viele Punkte angekommen und oertlich geloescht sind. */
  uebertragen: number
  /** Wie viele danach noch auf dem Geraet liegen. */
  offen: number
  /** Woran es scheiterte, in Worten – oder null, wenn alles durchging. */
  fehler: string | null
  /**
   * Musste ohne die Spalte `urteil` uebertragen werden?
   *
   * Heisst: Migration 0051 ist auf dieser Datenbank noch nicht eingespielt.
   * Die Punkte sind da, ihr Urteil fehlt - es wird beim Nachrechnen aus der
   * Geometrie abgeleitet. Vorruebergehender Zustand; der Rueckfall gehoert
   * entfernt, sobald 0051 ueberall liegt.
   */
  ohneUrteil: boolean
}

/**
 * Schickt alles, was liegt.
 *
 * Warum der Fehler zurueckkommt statt verschluckt zu werden
 * ---------------------------------------------------------
 * Bis zum 22.08.2026 gab diese Funktion bei einem Fehler null zurueck, und
 * alle drei Aufrufer sahen nicht hin. Deshalb blieb wochenlang unbemerkt,
 * dass JEDE Uebertragung scheiterte: Der Index, auf den sich das "on
 * conflict" stuetzt, war teilweise angelegt und damit unbrauchbar (42P10,
 * siehe Migration 0050).
 *
 * Ein Fehler, den niemand sehen kann, ist derselbe wie kein Fehler - bis
 * jemand seine Strecke sucht.
 */
export async function offeneSenden(): Promise<Uebertragung> {
  const punkte = await offenePunkte()
  if (punkte.length === 0) return { uebertragen: 0, offen: 0, fehler: null, ohneUrteil: false }

  let uebertragen = 0

  // Wird auf true gesetzt, sobald die Datenbank die Spalte `urteil` abweist.
  // Dann laeuft der Rest dieser Uebertragung ohne sie weiter, statt
  // vollstaendig zu scheitern.
  let ohneUrteil = false

  for (let i = 0; i < punkte.length; i += BUENDEL) {
    const teil = punkte.slice(i, i + BUENDEL)

    const zeilen = (mitUrteil: boolean) =>
      teil.map((p) => ({
        run_id: p.run_id,
        client_id: p.client_id,
        latitude: p.latitude,
        longitude: p.longitude,
        altitude_m: p.altitude_m,
        accuracy_m: p.accuracy_m,
        speed_mps: p.speed_mps,
        recorded_at: p.recorded_at,
        // Das Urteil ueber das Segment zum Vorgaengerpunkt. Es faellt einmal,
        // beim Entstehen des Punktes - und wird gespeichert, damit niemand
        // es spaeter neu erfinden muss. Genau daraus entstanden B1 und B3.
        //
        // Durch `istUrteil` und nicht roh durchgereicht: Der Puffer liegt in
        // IndexedDB und wird ungeprueft gelesen. Was die Pruefbedingung der
        // Datenbank nicht kennt, darf gar nicht erst losgeschickt werden -
        // sonst blockiert ein einziger Punkt dauerhaft alle weiteren.
        ...(mitUrteil ? { urteil: istUrteil(p.urteil) ? p.urteil : null } : {}),
      }))

    // upsert mit ignoreDuplicates: Ein zweiter Versuch fuer schon
    // angekommene Punkte ist damit kein Fehler, sondern ein Nichts.
    let { error } = await supabase.from('run_points').upsert(zeilen(!ohneUrteil), {
      onConflict: 'run_id,client_id',
      ignoreDuplicates: true,
    })

    // Die Spalte fehlt - die Migration ist noch nicht eingespielt. Lieber
    // die Punkte ohne Urteil retten als gar keine: Ein Urteil laesst sich
    // nachrechnen, ein verlorener Messpunkt nicht.
    if (kenntUrteilNicht(error)) {
      ohneUrteil = true
      ;({ error } = await supabase.from('run_points').upsert(zeilen(false), {
        onConflict: 'run_id,client_id',
        ignoreDuplicates: true,
      }))
    }

    // Beim ersten Fehler aufhoeren: Ist das Netz weg, scheitert auch der
    // Rest. Was schon durch ist, bleibt geloescht; der Rest liegt weiter.
    if (error) {
      // Der Code gehoert mit in die Meldung. "42P10" ist der Unterschied
      // zwischen "kein Netz, kommt spaeter" und "geht nie wieder gut".
      const code = error.code ? ` (${error.code})` : ''
      return {
        uebertragen,
        offen: punkte.length - uebertragen,
        fehler: `${error.message}${code}`,
        ohneUrteil,
      }
    }

    await punkteVerworfen(teil.map((p) => p.client_id))
    uebertragen += teil.length
  }

  return { uebertragen, offen: 0, fehler: null, ohneUrteil }
}
