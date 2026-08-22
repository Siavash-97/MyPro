import { supabase } from './supabase'
import { offenePunkte, punkteVerworfen } from './punktePuffer'

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

/** Was eine Uebertragung ergeben hat. */
export interface Uebertragung {
  /** Wie viele Punkte angekommen und oertlich geloescht sind. */
  uebertragen: number
  /** Wie viele danach noch auf dem Geraet liegen. */
  offen: number
  /** Woran es scheiterte, in Worten – oder null, wenn alles durchging. */
  fehler: string | null
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
  if (punkte.length === 0) return { uebertragen: 0, offen: 0, fehler: null }

  let uebertragen = 0

  for (let i = 0; i < punkte.length; i += BUENDEL) {
    const teil = punkte.slice(i, i + BUENDEL)

    // upsert mit ignoreDuplicates: Ein zweiter Versuch fuer schon
    // angekommene Punkte ist damit kein Fehler, sondern ein Nichts.
    const { error } = await supabase.from('run_points').upsert(
      teil.map((p) => ({
        run_id: p.run_id,
        client_id: p.client_id,
        latitude: p.latitude,
        longitude: p.longitude,
        altitude_m: p.altitude_m,
        accuracy_m: p.accuracy_m,
        speed_mps: p.speed_mps,
        recorded_at: p.recorded_at,
      })),
      { onConflict: 'run_id,client_id', ignoreDuplicates: true },
    )

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
      }
    }

    await punkteVerworfen(teil.map((p) => p.client_id))
    uebertragen += teil.length
  }

  return { uebertragen, offen: 0, fehler: null }
}
