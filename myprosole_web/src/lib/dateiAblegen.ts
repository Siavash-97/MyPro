/**
 * Datei ablegen und Zeile schreiben - als ein Vorgang.
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * Der Ablauf "Datei hochladen, Zeile schreiben, bei Fehler die Datei wieder
 * wegraeumen" war viermal einzeln gebaut: in auth.ts, communityProfile.ts,
 * feed.ts und chats.ts. Die vier sind auseinandergelaufen - am deutlichsten
 * bei der Endung: einmal nur aus dem Dateityp, einmal zusaetzlich aus dem
 * Dateinamen, einmal fest ".webm".
 *
 * Der erste Pfadteil ist ueberall der Schluessel zur Zugriffsregel:
 * `avatars` und `community` verlangen die eigene Nutzerkennung, `chat-audio`
 * eine Chat-Kennung, an der die Teilnahme haengt. Deshalb baut dieses Modul
 * den Pfad und nimmt ihn nicht entgegen.
 */

import { supabase } from './supabase'

/** Was das Modul von der Ablage braucht - mehr nicht. */
export interface Ablage {
  hochladen(
    behaelter: string,
    pfad: string,
    daten: Blob,
    contentType: string,
  ): Promise<{ fehler: string | null }>
  entfernen(behaelter: string, pfad: string): Promise<{ fehler: string | null }>
}

/**
 * Die echte Ablage.
 *
 * Sie ist die Voreinstellung; kein Aufrufer uebergibt sie. Dass sie
 * austauschbar ist, dient allein den Tests - und dort dem einen Fall, den
 * man sonst nie prueft: ob wirklich zurueckgerollt wird.
 */
export const supabaseAblage: Ablage = {
  async hochladen(behaelter, pfad, daten, contentType) {
    const { error } = await supabase.storage
      .from(behaelter)
      .upload(pfad, daten, { contentType })
    return { fehler: error ? error.message : null }
  },
  async entfernen(behaelter, pfad) {
    const { error } = await supabase.storage.from(behaelter).remove([pfad])
    return { fehler: error ? error.message : null }
  },
}

/**
 * Dateien, die weggeraeumt werden sollten und liegengeblieben sind.
 *
 * Warum es diese Liste gibt
 * -------------------------
 * Vor dem 22.08.2026 taten alle vier Aufrufer `await remove([pfad])` und
 * sahen das Ergebnis nie an. Scheiterte es, lag eine Datei ohne Zeile im
 * Behaelter, und niemand erfuhr es. Das ist dieselbe Schweige-Fehlerart, die
 * am selben Tag wochenlang jeden GPS-Punkt gekostet hat - nur mit kleinerem
 * Schaden.
 *
 * Die Liste raeumt nichts auf. Sie sorgt dafuer, dass es jemand erfahren
 * KANN: in der Protokollausgabe sofort, in einem spaeteren Aufraeumlauf
 * gesammelt.
 */
const verwaiste: { behaelter: string; pfad: string; grund: string }[] = []

export function verwaistMerken(behaelter: string, pfad: string, grund: string): void {
  verwaiste.push({ behaelter, pfad, grund })
  console.warn(`Datei blieb liegen: ${behaelter}/${pfad} - ${grund}`)
}

/** Was bisher liegengeblieben ist. Nur lesen. */
export function verwaisteDateien(): ReadonlyArray<{ behaelter: string; pfad: string; grund: string }> {
  return verwaiste
}

/** Was ein Aufrufer mitbringt. */
export interface Auftrag<T> {
  behaelter: string
  /** Erster Pfadteil. Traegt die Zugriffsregel und darf nicht leer sein. */
  praefix: string
  /** Optionaler Namensteil vor der Zufallskennung, fuer Menschen im Behaelter. */
  namensvorsatz?: string
  datei: Blob
  /** Endung, wenn sich keine ableiten laesst. Pflicht: 'jpg' waere fuer Ton falsch. */
  rueckfallEndung: string
  /** Inhaltstyp, wenn die Datei keinen nennt. Pflicht, aus demselben Grund. */
  rueckfallTyp: string
  /**
   * Schreibt die Zeile zu diesem Pfad. Gibt das Supabase-Ergebnis zurueck,
   * unveraendert.
   */
  zeileSchreiben: (
    pfad: string,
  ) => Promise<{ data: T | null; error: { message: string; code?: string } | null }>
}

export interface Ergebnis<T> {
  pfad: string | null
  daten: T | null
  /** Roh samt Code. Uebersetzt wird weiter oben, nicht hier. */
  fehler: string | null
  /** Gesetzt, wenn das Zurueckrollen selbst scheiterte - die Datei liegt dann. */
  verwaisterPfad: string | null
}

/**
 * Endung aus dem Inhaltstyp.
 *
 * Die Parameter hinter dem Semikolon werden abgeschnitten: MediaRecorder
 * liefert "audio/webm;codecs=opus", und "webm;codecs=opus" ist keine Endung.
 * Beim contentType bleiben sie dagegen stehen - dort sind sie richtige,
 * genauere Information.
 */
function endungAus(datei: Blob, rueckfall: string): string {
  const ausTyp = datei.type.split(';')[0].split('/')[1]?.toLowerCase()
  if (ausTyp && /^[a-z0-9]{2,5}$/.test(ausTyp)) return ausTyp === 'jpeg' ? 'jpg' : ausTyp

  // Manche Auswahldialoge liefern Dateien ohne Typ. Dann ist der Name die
  // letzte Auskunft - ein Blob hat keinen, ein File schon.
  const name = (datei as File).name
  const ausName = typeof name === 'string' && name.includes('.')
    ? name.split('.').pop()?.toLowerCase()
    : null
  if (ausName && /^[a-z0-9]{2,5}$/.test(ausName)) return ausName

  return rueckfall
}

export async function dateiMitZeile<T>(
  auftrag: Auftrag<T>,
  ablage: Ablage = supabaseAblage,
): Promise<Ergebnis<T>> {
  const { behaelter, praefix, namensvorsatz = '', datei } = auftrag

  // Der Praefix traegt die Zugriffsregel. Fehlt er, waere der erste Pfadteil
  // die Zufallskennung, und der Behaelter antwortete mit einer Meldung ueber
  // Zeilenrechte - der Ursache am weitesten entfernt von allen moeglichen.
  if (!praefix) {
    return {
      pfad: null,
      daten: null,
      fehler: 'Kein Präfix angegeben – ohne ihn greift keine Zugriffsregel.',
      verwaisterPfad: null,
    }
  }

  const endung = endungAus(datei, auftrag.rueckfallEndung)
  const pfad = `${praefix}/${namensvorsatz}${crypto.randomUUID()}.${endung}`

  const { fehler: hochladen } = await ablage.hochladen(
    behaelter,
    pfad,
    datei,
    datei.type || auftrag.rueckfallTyp,
  )
  // Nichts liegt, nichts zurueckzurollen: Die Zeile wird gar nicht erst
  // versucht, sonst zeigte sie auf eine Datei, die es nicht gibt.
  if (hochladen) {
    return { pfad: null, daten: null, fehler: hochladen, verwaisterPfad: null }
  }

  // Der Rueckruf gehoert dem Aufrufer. Er gibt seinen Fehler zurueck - und
  // kann trotzdem werfen: Netzausnahme, Tippfehler, alles, woran niemand
  // denkt. Ohne das try/catch liefe genau dieser Fall am Zurueckrollen
  // vorbei und liesse die Datei fuer immer im Behaelter liegen.
  let daten: T | null = null
  let fehler: string | null = null
  try {
    const ergebnis = await auftrag.zeileSchreiben(pfad)
    daten = ergebnis.data
    if (ergebnis.error) {
      fehler = ergebnis.error.message + (ergebnis.error.code ? ` (${ergebnis.error.code})` : '')
    }
  } catch (ausnahme) {
    fehler = ausnahme instanceof Error ? ausnahme.message : String(ausnahme)
  }

  if (fehler) {
    const { fehler: aufraeumen } = await ablage.entfernen(behaelter, pfad)
    // Scheitert das Wegraeumen, liegt eine Datei ohne Zeile im Behaelter.
    // Das darf nicht schweigend passieren: Das Modul merkt es sich selbst,
    // damit kein Aufrufer es vergessen kann, und nennt es zusaetzlich.
    if (aufraeumen) verwaistMerken(behaelter, pfad, aufraeumen)
    return { pfad, daten: null, fehler, verwaisterPfad: aufraeumen ? pfad : null }
  }

  return { pfad, daten, fehler: null, verwaisterPfad: null }
}
