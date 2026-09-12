import { supabase } from './supabase'
import { offenePunkte, punkteVerworfen } from './punktePuffer'
import { istUrteil } from './segmenturteil'
import { istDauerhafterCode } from './stoppfehler'

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

/**
 * So viele erfolglose Einzelanfragen, dann gilt der Fehler als Eigenschaft
 * der ANFRAGE und nicht eines Punktes.
 *
 * Warum es diese Grenze gibt, gemessen am 31.08.2026
 * ---------------------------------------------------
 * Das Einzelnachfassen unterstellt, ein dauerhafter Fehler gehoere einem
 * einzelnen Punkt. Fuer 23503 (Fremdschluessel) stimmt das. Fuer 42P10 -
 * den teilweise angelegten Index vom 22.08.2026, Migration 0050 - stimmt es
 * nicht: Er trifft jede Zeile gleich. Ohne Grenze wurden aus 200 Punkten
 * 201 Anfragen, und bei vollem Puffer aus 10.000 Punkten 10.050 - je Takt,
 * alle 30 Sekunden, unbegrenzt.
 *
 * Drei, aus demselben Grund wie MAX_VERSUCHE in `lib/stoppfehler.ts`: Bei
 * eins waere ein einzelner schlechter Punkt an erster Stelle schon der
 * Beweis fuer einen Anfragefehler. Bei zehn kostet der Anfragefehler zehn
 * Rundreisen je Buendel.
 */
const MAX_EINZELN_FEHLER = 3

/**
 * Zwei Fehlermeldungen nebeneinander - die dauerhafte zuerst.
 *
 * Ohne das ging der dauerhafte Fehler verloren, sobald danach ein
 * voruebergehender kam: Die Oberflaeche zeigte "kein Netz, kommt spaeter"
 * fuer eine Blockade, die nie besser wird. Gefunden vom Agenten `pruefung`,
 * 31.08.2026. Die Schreibweise mit " | " ist dieselbe wie in
 * `store/run.ts` beim Zusammenfuehren von Punkt- und Abschnittsfehlern.
 */
function zusammen(dauerhaft: string | null, jetzt: string): string {
  return dauerhaft ? `${dauerhaft} | ${jetzt}` : jetzt
}

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
   * Der Fehlercode der Datenbank zu `fehler`, oder null.
   *
   * Getrennt vom Text, seit der Aufrufer entscheiden muss, ob er ihn einem
   * Menschen zeigen darf (`lib/supabaseFehler.ts`, `menschenlesbar`). Am
   * Wortlaut zu erkennen verbietet dieselbe Datei zu Recht.
   */
  code: string | null
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
export async function offeneSenden(
  ausgenommen?: ReadonlySet<string>,
): Promise<Uebertragung> {
  const alle = await offenePunkte()
  // Laeufe, deren `runs`-Zeile noch nicht steht, bleiben liegen.
  //
  // Seit dem 31.08.2026 puffert ein netzlos gestarteter Lauf ab der ersten
  // Sekunde (F1/A2). Erst dadurch gibt es Punkte, deren Zeile es noch nicht
  // gibt - und `run_points.run_id` ist `not null references runs(id)`
  // (Migration 0008). Ohne diese Sperre liefe jede Uebertragung in 23503,
  // und das Einzelnachfassen darunter machte daraus eine Anfrage je Punkt.
  //
  // Je Lauf und nicht global: Punkte eines frueheren, fertigen Laufs muessen
  // weiter durchgehen. Sonst haelt ein wartender Lauf die Strecke eines
  // abgeschlossenen auf - genau die Blockade, die diese Datei seit dem
  // 28.08. loswerden soll.
  const punkte = ausgenommen?.size
    ? alle.filter((p) => !ausgenommen.has(p.run_id))
    : alle
  const zurueckgehalten = alle.length - punkte.length
  if (punkte.length === 0) {
    return { uebertragen: 0, offen: zurueckgehalten, fehler: null, code: null, ohneUrteil: false }
  }

  let uebertragen = 0
  /**
   * Punkte, die dauerhaft abgewiesen wurden und liegenbleiben.
   *
   * Sie werden NICHT verworfen: Verwerfen ist eine Handlung des Menschen,
   * kein Standardverhalten (Entscheidung des Nutzers, 24.08.2026). Sie
   * werden nur nicht mehr als Grund genommen, alles andere anzuhalten.
   */
  let liegengeblieben = zurueckgehalten
  /** Der erste dauerhafte Fehler, in Worten - oder null. */
  let dauerhaft: string | null = null
  /** Sein Code - getrennt, weil der Aufrufer daran entscheidet. */
  let dauerhaftCode: string | null = null
  /**
   * Wie oft das Einzelnachfassen in diesem Durchgang schon scheiterte.
   *
   * Gedeckelt durch MAX_EINZELN_FEHLER: Ab da gehoert der Fehler nicht mehr
   * einem Punkt, sondern der Anfrage - und jede weitere Einzelanfrage waere
   * eine Rundreise fuer nichts.
   */
  let fehlschlaege = 0

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

    // Der Code gehoert mit in die Meldung. "42P10" ist der Unterschied
    // zwischen "kein Netz, kommt spaeter" und "geht nie wieder gut".
    const code = error?.code ? ` (${error.code})` : ''

    if (error) {
      // Voruebergehend: aufhoeren. Ist das Netz weg, scheitert auch der
      // Rest - jedes weitere Buendel kostete nur eine eigene Zeitgrenze.
      // Was schon durch ist, bleibt geloescht; der Rest liegt weiter.
      if (!istDauerhafterCode(error.code)) {
        return {
          uebertragen,
          offen: punkte.length - uebertragen + zurueckgehalten,
          fehler: zusammen(dauerhaft, `${error.message}${code}`),
          code: dauerhaftCode ?? error.code ?? null,
          ohneUrteil,
        }
      }

      // Dauerhaft: NICHT aufhoeren - der Punkt wird nie besser, und solange
      // er vorn in der Schlange liegt, kaeme hinter ihm nie wieder etwas
      // durch. Offener Befund seit dem 28.08.2026.
      //
      // Aber auch nicht das ganze Buendel wegwerfen: Es haengen bis zu
      // BUENDEL Punkte daran, und der Fehler gehoert womoeglich einem
      // einzigen. Deshalb einzeln nachfassen.
      for (const p of teil) {
        // Genug Proben. Ab hier gehoert der Fehler nicht mehr einem Punkt.
        //
        // Gefunden vom Agenten `pruefung`, 31.08.2026: Ein Fehler der
        // Klasse 42 gehoert der ANFRAGE oder den RECHTEN - 42P10 (der
        // teilweise Index vom 22.08.) trifft jede Zeile gleich. Ohne diese
        // Grenze wurden 200 Punkte zu 201 Anfragen, und das alle 30
        // Sekunden, unbegrenzt.
        //
        // Warum eine Zahl und keine Klassenpruefung: 42501 KANN hier
        // zeilenabhaengig sein - die Regel `run_points_insert_own` (0008)
        // prueft `run_id` je Zeile. Eine Klasse allein unterscheidet die
        // beiden Faelle also nicht; die Anzahl der Fehlschlaege tut es.
        if (fehlschlaege >= MAX_EINZELN_FEHLER) {
          liegengeblieben += 1
          continue
        }

        const { error: einzeln } = await supabase
          .from('run_points')
          .upsert(zeilen(!ohneUrteil).filter((z) => z.client_id === p.client_id), {
            onConflict: 'run_id,client_id',
            ignoreDuplicates: true,
          })
        if (einzeln) {
          // Ein voruebergehender Fehler mitten im Nachfassen: sofort
          // aufhoeren. Sonst laufen bis zu BUENDEL Anfragen nacheinander
          // ins Leere - und zwar ohne Zeitgrenze.
          if (!istDauerhafterCode(einzeln.code)) {
            const c = einzeln.code ? ` (${einzeln.code})` : ''
            return {
              uebertragen,
              offen: punkte.length - uebertragen + zurueckgehalten,
              fehler: zusammen(dauerhaft, `${einzeln.message}${c}`),
              code: dauerhaftCode ?? einzeln.code ?? null,
              ohneUrteil,
            }
          }
          fehlschlaege += 1
          liegengeblieben += 1
          // Der erste dauerhafte Fehler steht in der Meldung. Alle zu
          // sammeln hiesse, eine Fehlermeldung beliebiger Laenge in die
          // Oberflaeche zu reichen - und der erste sagt bereits, worum es
          // geht.
          if (!dauerhaft) {
            const c = einzeln.code ? ` (${einzeln.code})` : ''
            dauerhaft = `${einzeln.message}${c}`
            dauerhaftCode = einzeln.code ?? null
          }
          continue
        }
        await punkteVerworfen([p.client_id])
        uebertragen += 1
      }
      continue
    }

    await punkteVerworfen(teil.map((p) => p.client_id))
    uebertragen += teil.length
  }

  return { uebertragen, offen: liegengeblieben, fehler: dauerhaft, code: dauerhaftCode, ohneUrteil }
}
