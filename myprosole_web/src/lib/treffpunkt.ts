import { supabase } from './supabase'

/**
 * Der genaue Treffpunkt einer Verabredung.
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * Die Abfrage stand byte-gleich in `chats.ts` und `communityRuns.ts`. Und sie
 * verschluckte in beiden ihren Fehler: `const { data } = ...`, dann `?? null`.
 *
 * Das war nicht nur unsauber. Das Bearbeiten-Formular in
 * `CommunityMeetups.tsx` oeffnete mit `meetingPoint: ort ?? ''`, und
 * `updateRun` schrieb den Wert per upsert zurueck. Ein Netzhaenger beim
 * Oeffnen loeschte damit beim naechsten Speichern den Treffpunkt - lautlos.
 *
 * „Es gibt keinen" und „ich konnte nicht nachsehen" sind zwei Antworten.
 */

export interface Treffpunktantwort {
  /** Der Treffpunkt, oder null - wenn es keinen gibt ODER er nicht lesbar war. */
  treffpunkt: string | null
  /** Roh samt Code. Ist er gesetzt, sagt `treffpunkt: null` gar nichts aus. */
  fehler: string | null
}

/**
 * Die Antwort der Datenbank deuten.
 *
 * Getrennt von der Abfrage, damit die Unterscheidung, um die es geht, ohne
 * Netz und ohne Anmeldung geprueft werden kann.
 */
export function treffpunktAusAntwort(antwort: {
  data: { meeting_point: string } | null
  error: { message: string; code?: string | null } | null
}): Treffpunktantwort {
  if (antwort.error) {
    const code = antwort.error.code ? ` (${antwort.error.code})` : ''
    return { treffpunkt: null, fehler: `${antwort.error.message}${code}` }
  }
  return { treffpunkt: antwort.data?.meeting_point ?? null, fehler: null }
}

/**
 * Den Treffpunkt holen. Geht nur mit Zusage - die Zeilenregel entscheidet,
 * nicht diese Funktion.
 */
export async function treffpunktHolen(runId: string): Promise<Treffpunktantwort> {
  const antwort = await supabase
    .from('community_run_meeting_points')
    .select('meeting_point')
    .eq('run_id', runId)
    .maybeSingle()

  return treffpunktAusAntwort(
    antwort as {
      data: { meeting_point: string } | null
      error: { message: string; code?: string | null } | null
    },
  )
}
