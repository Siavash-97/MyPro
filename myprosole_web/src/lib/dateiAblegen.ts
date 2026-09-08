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
import { entwicklerWarnung } from './entwicklerkonsole'

/**
 * Was das Modul von der Ablage braucht - mehr nicht.
 *
 * `roh` ist OPTIONAL, und das ist eine Entscheidung, keine Nachlaessigkeit:
 * Die acht Nachbauten in `dateiAblegen.test.ts` und die drei anderen
 * Aufrufer bleiben damit unveraendert (Entscheidung (a),
 * docs/authhindernis-entwurf.md, "Nachgesehen vor 4c"). Wer eine Ablage
 * baut, die es weglaesst, bekommt in `Ergebnis.roh` ein `null` - einen
 * ehrlichen Wissensstand, keinen falschen.
 */
export interface Ablage {
  hochladen(
    behaelter: string,
    pfad: string,
    daten: Blob,
    contentType: string,
  ): Promise<{ fehler: string | null; roh?: unknown }>
  entfernen(behaelter: string, pfad: string): Promise<{ fehler: string | null; roh?: unknown }>
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
    return { fehler: error ? error.message : null, roh: error }
  },
  async entfernen(behaelter, pfad) {
    const { error } = await supabase.storage.from(behaelter).remove([pfad])
    return { fehler: error ? error.message : null, roh: error }
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
  entwicklerWarnung(`Datei blieb liegen: ${behaelter}/${pfad} - ${grund}`)
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
  /**
   * Das Fehlerobjekt der Bibliothek, unveraendert - `null` bei Erfolg.
   *
   * Warum es das neben `fehler` gibt
   * --------------------------------
   * `fehler` ist TEXT. Ein Text hat keinen `code` und kein `statusCode`, und
   * genau daran erkennen die Hindernis-Funktionen (`lib/hindernis.ts`), WORAN
   * es lag - nie am Wortlaut. Bis zum 08.09.2026 flachte dieses Modul jedes
   * Fehlerobjekt zu Text; sein einziger uebersetzender Aufrufer (`setAvatar`)
   * haette damit jeden Fehlschlag als `unbekannt` gemeldet, und `zu-gross`
   * waere nie entstanden. Fuenf Befragungsrunden haben diese Naht nicht
   * gesehen (docs/authhindernis-entwurf.md, "Nachgesehen vor 4c",
   * Entscheidung (a)).
   *
   * Was drinsteht, haengt an der PHASE, und die Phase steht in `pfad`:
   * Bei `pfad === null` ist das Hochladen gescheitert, `roh` kommt aus der
   * Ablage (Storage). Sonst ist die Zeile gescheitert, `roh` ist das
   * Fehlerobjekt des Aufrufers oder die gefangene Ausnahme - sein
   * Fachgebiet, nicht das der Ablage.
   *
   * Die Zusicherung: `fehler !== null` heisst `roh !== null`
   * ---------------------------------------------------------
   * Sie gilt UNABHAENGIG davon, was eine Ablage liefert. Wo keine
   * Bibliothek geantwortet hat - beim fehlenden Praefix, oder wenn eine
   * Ablage das optionale `roh` weglaesst -, legt dieses Modul selbst ein
   * `Error` mit demselben Text hinein.
   *
   * Sie ist noetig, weil `null` beim Uebersetzen "kein Hindernis" heisst:
   * `ablageHindernis(null)` und `profilHindernis(null)` geben `null`
   * (`lib/hindernis.ts`, `merkmale`). Ein Ergebnis mit Text, aber ohne
   * Objekt, kaeme beim Menschen als Erfolg an. Geschlossen wird das hier,
   * einmal fuer alle vier Aufrufer - nicht mit einem Rueckfall an jeder
   * Aufrufstelle, der die Luecke verdeckt statt sie zu schliessen.
   *
   * Drei Wege, an denen keine Bibliothek ein Objekt liefert, alle
   * geschlossen und je mit einem Test belegt: fehlender Praefix, Ablage
   * ohne `roh`, und ein `zeileSchreiben`, das einen Nullwert wirft
   * (`throw null` - gemessen am 08.09.2026, aus keiner der vier
   * Aufrufstellen erreichbar, geschlossen trotzdem: Eine Zusicherung "bis
   * auf einen Fall" ist keine).
   *
   * NICHT anzeigen: dasselbe wie beim `rohtext` eines Hindernisses.
   */
  roh: unknown
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
    // Einmal geschrieben, zweimal benutzt: Text und Objekt duerfen nicht
    // auseinanderlaufen, sonst stimmt die Zusicherung oben nicht mehr.
    const satz = 'Kein Präfix angegeben – ohne ihn greift keine Zugriffsregel.'
    return {
      pfad: null,
      daten: null,
      fehler: satz,
      // Hier gibt es kein Bibliotheksobjekt: Es wurde nichts gesendet, also
      // hat nichts geantwortet. Der Satz stammt aus diesem Modul selbst -
      // also traegt das Modul auch das Objekt dazu, statt `null` zu geben:
      // `null` heisst beim Uebersetzen "kein Hindernis", und ein Fehlschlag,
      // der als Erfolg ankommt, ist teurer als ein duennes Objekt.
      // Richtiger waere es, diesen Fall gar nicht erst erzeugen zu koennen
      // (er ist ein Programmfehler, kein Betriebsfehler).
      roh: new Error(satz),
      verwaisterPfad: null,
    }
  }

  const endung = endungAus(datei, auftrag.rueckfallEndung)
  const pfad = `${praefix}/${namensvorsatz}${crypto.randomUUID()}.${endung}`

  const { fehler: hochladen, roh: hochladenRoh } = await ablage.hochladen(
    behaelter,
    pfad,
    datei,
    datei.type || auftrag.rueckfallTyp,
  )
  // Nichts liegt, nichts zurueckzurollen: Die Zeile wird gar nicht erst
  // versucht, sonst zeigte sie auf eine Datei, die es nicht gibt.
  if (hochladen) {
    return {
      pfad: null,
      daten: null,
      fehler: hochladen,
      // `roh` ist in `Ablage` optional (siehe dort) - eine Ablage DARF es
      // weglassen. Dann traegt das Modul den Text nach, statt die Luecke
      // weiterzureichen: Ohne das haette der Aufrufer einen Fehlschlag mit
      // Text, aber ohne Objekt, und das Uebersetzen machte daraus einen
      // Erfolg. Die Zusicherung oben gilt damit unabhaengig davon, welche
      // Ablage eingesetzt wird.
      roh: hochladenRoh ?? new Error(hochladen),
      verwaisterPfad: null,
    }
  }

  // Der Rueckruf gehoert dem Aufrufer. Er gibt seinen Fehler zurueck - und
  // kann trotzdem werfen: Netzausnahme, Tippfehler, alles, woran niemand
  // denkt. Ohne das try/catch liefe genau dieser Fall am Zurueckrollen
  // vorbei und liesse die Datei fuer immer im Behaelter liegen.
  let daten: T | null = null
  let fehler: string | null = null
  // Das Objekt zum Text: das `error` des Aufrufers oder das Geworfene. Beides
  // ist PostgREST-Fachgebiet, nicht Storage - siehe Kopf von `Ergebnis.roh`.
  let roh: unknown = null
  try {
    const ergebnis = await auftrag.zeileSchreiben(pfad)
    daten = ergebnis.data
    if (ergebnis.error) {
      fehler = ergebnis.error.message + (ergebnis.error.code ? ` (${ergebnis.error.code})` : '')
      roh = ergebnis.error
    }
  } catch (ausnahme) {
    fehler = ausnahme instanceof Error ? ausnahme.message : String(ausnahme)
    // `throw null` waere sonst ein Text ohne Objekt (Kopf von `Ergebnis.roh`).
    roh = ausnahme ?? new Error(fehler)
  }

  if (fehler) {
    const { fehler: aufraeumen } = await ablage.entfernen(behaelter, pfad)
    // Scheitert das Wegraeumen, liegt eine Datei ohne Zeile im Behaelter.
    // Das darf nicht schweigend passieren: Das Modul merkt es sich selbst,
    // damit kein Aufrufer es vergessen kann, und nennt es zusaetzlich.
    if (aufraeumen) verwaistMerken(behaelter, pfad, aufraeumen)
    // `roh` bleibt der Fehler der ZEILE, auch wenn zusaetzlich das
    // Wegraeumen scheiterte: Der Mensch hat die Zeile gewollt, nicht das
    // Aufraeumen. Dass eine Datei liegenblieb, steht in `verwaisterPfad`
    // und in `verwaisteDateien()`.
    return { pfad, daten: null, fehler, roh, verwaisterPfad: aufraeumen ? pfad : null }
  }

  return { pfad, daten, fehler: null, roh: null, verwaisterPfad: null }
}
