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

/**
 * Schickt alles, was liegt. Gibt zurueck, wie viele Punkte uebertragen
 * wurden – oder null, wenn es nicht ging (dann bleibt alles liegen).
 */
export async function offeneSenden(): Promise<number | null> {
  const punkte = await offenePunkte()
  if (punkte.length === 0) return 0

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
    if (error) return uebertragen > 0 ? uebertragen : null

    await punkteVerworfen(teil.map((p) => p.client_id))
    uebertragen += teil.length
  }

  return uebertragen
}
