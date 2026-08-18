/**
 * Der Puffer fuer GPS-Punkte auf dem Geraet.
 *
 * Waehrend eines Laufs ist das Geraet der Hauptspeicher, nicht der Server.
 * Jeder Punkt landet sofort hier – das gelingt immer, kostet nichts und
 * braucht kein Netz. Uebertragen wird daraus in Buendeln.
 *
 * Damit ist der Server waehrend des Laufs nicht im kritischen Pfad: Wer im
 * Funkloch laeuft, verliert nichts. Und geht der Akku leer, liegen die
 * Punkte beim naechsten Start noch da.
 *
 * Warum IndexedDB
 * ---------------
 * Es ist im Browser wie in der Android-Huelle vorhanden – kein Plugin, keine
 * Abhaengigkeit. localStorage waere die einfachere Wahl, taugt hier aber
 * nicht: Es ist auf wenige Megabyte begrenzt und speichert nur Text, sodass
 * bei jedem Punkt die ganze Liste neu geschrieben werden muesste.
 *
 * Es wird nichts geloescht, solange die Uebertragung nicht bestaetigt ist.
 * Ein Marathon sind etwa 4 MB – fuer ein Telefon nichts. Eine Frist braucht
 * es deshalb nicht; der Puffer leert sich von selbst, sobald die Datenbank
 * ein Buendel angenommen hat.
 */

const DATENBANK = 'myprosole'
const SPEICHER = 'gps_punkte'

export interface GepufferterPunkt {
  /** Vom Geraet vergeben. Verhindert doppelte Punkte bei einem zweiten Versuch. */
  client_id: string
  run_id: string
  latitude: number
  longitude: number
  altitude_m: number | null
  accuracy_m: number | null
  speed_mps: number | null
  recorded_at: string
}

function oeffnen(): Promise<IDBDatabase> {
  return new Promise((erfuellen, ablehnen) => {
    const anfrage = indexedDB.open(DATENBANK, 1)
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result
      if (!db.objectStoreNames.contains(SPEICHER)) {
        const speicher = db.createObjectStore(SPEICHER, { keyPath: 'client_id' })
        // Nach Lauf gruppiert abrufen, ohne alles zu lesen.
        speicher.createIndex('run_id', 'run_id')
      }
    }
    anfrage.onsuccess = () => erfuellen(anfrage.result)
    anfrage.onerror = () => ablehnen(anfrage.error)
  })
}

/** Legt einen Punkt ab. Schlaegt das fehl, laeuft die Aufzeichnung weiter –
 *  der Punkt bleibt dann im Arbeitsspeicher des Laufs. */
export async function punktMerken(punkt: GepufferterPunkt): Promise<void> {
  const db = await oeffnen()
  await new Promise<void>((erfuellen, ablehnen) => {
    const t = db.transaction(SPEICHER, 'readwrite')
    t.objectStore(SPEICHER).put(punkt)
    t.oncomplete = () => erfuellen()
    t.onerror = () => ablehnen(t.error)
  })
  db.close()
}

/** Alle noch nicht uebertragenen Punkte, aeltester zuerst. */
export async function offenePunkte(): Promise<GepufferterPunkt[]> {
  const db = await oeffnen()
  const punkte = await new Promise<GepufferterPunkt[]>((erfuellen, ablehnen) => {
    const t = db.transaction(SPEICHER, 'readonly')
    const anfrage = t.objectStore(SPEICHER).getAll()
    anfrage.onsuccess = () => erfuellen(anfrage.result as GepufferterPunkt[])
    anfrage.onerror = () => ablehnen(anfrage.error)
  })
  db.close()
  return punkte.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
}

/**
 * Entfernt Punkte, deren Uebertragung bestaetigt ist.
 *
 * Nur nach einer Bestaetigung – bei einem Fehler bleiben sie liegen und
 * gehen beim naechsten Versuch erneut raus. Doppelte weist die Datenbank
 * ueber die Kennung ab.
 */
export async function punkteVerworfen(kennungen: string[]): Promise<void> {
  if (kennungen.length === 0) return
  const db = await oeffnen()
  await new Promise<void>((erfuellen, ablehnen) => {
    const t = db.transaction(SPEICHER, 'readwrite')
    const speicher = t.objectStore(SPEICHER)
    for (const k of kennungen) speicher.delete(k)
    t.oncomplete = () => erfuellen()
    t.onerror = () => ablehnen(t.error)
  })
  db.close()
}
