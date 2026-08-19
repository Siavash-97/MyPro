import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'
import { plattform, zeitzone } from '../lib/geraeteangaben'
import type {
  Einwilligung,
  EinwilligungZweck,
  EinwilligungsText,
} from '../types'

/*
 * Erlaubnisse – eine Stelle, ein Zeitpunkt.
 *
 * Loest store/consent.ts ab. Der alte Speicher fragte an drei Stellen
 * getrennt: in der Anamnese, im Trainingstagebuch (das direkt nach jedem
 * Lauf aufgeht) und im Zykluskalender. Wer lief, wurde also immer wieder
 * gefragt. Gemeint war einmal.
 *
 * Was hier anders ist
 * -------------------
 * 1. Ein eigenes Schema. Die Tabellen liegen in `einwilligung`, nicht in
 *    `public` – deshalb ueberall supabase.schema('einwilligung').
 *
 * 2. Der Wortlaut zaehlt mit. Eine Einwilligung ist ein Nachweis nach
 *    Art. 7 Abs. 1 DSGVO. Wer, was und wann allein genuegt dafuer nicht:
 *    Es muss zeigbar sein, WELCHEM TEXT jemand zugestimmt hat. Deshalb
 *    traegt jede Zeile die Version und die Pruefsumme des Wortlauts.
 *
 * 3. Mehrere Zwecke auf einmal. Der Registrierungsschirm fragt drei Dinge
 *    zugleich; sie gehen in einer einzigen Anfrage in die Datenbank, damit
 *    nicht zwei ankommen und die dritte scheitert.
 *
 * Unveraendert bleibt das Gute aus 0027: Die Tabelle ist eine Geschichte,
 * kein Zustand. Ein Widerruf ist eine neue Zeile. Was gerade gilt, wird
 * abgeleitet – eine Ableitung kann von den Daten nicht abweichen, ein
 * gespeicherter Zustand schon.
 */

/** Die Tabellen liegen nicht in public. */
const db = () => supabase.schema('einwilligung')

/**
 * Plattform und Zeitzone setzen oder loeschen (Migration 0036).
 *
 * Sie stehen auf `profiles`, nicht hier – zwei Spalten rechtfertigen keine
 * eigene Tabelle, und sie gehoeren zur Person.
 *
 * Ein Fehlschlag bleibt ohne Folgen fuer den Aufrufer: Die Einwilligung
 * selbst ist zu diesem Zeitpunkt bereits geschrieben und gilt. Eine
 * Statistikangabe darf sie nicht nachtraeglich scheitern lassen.
 */
async function analyseangabenSchreiben(userId: string, setzen: boolean): Promise<void> {
  await supabase
    .from('profiles')
    .update(
      setzen
        ? { plattform: plattform(), zeitzone: zeitzone() }
        : { plattform: null, zeitzone: null },
    )
    .eq('id', userId)
}

interface EinwilligungState {
  /** Die Wortlaute, je Zweck der aktuell gueltige. */
  texte: EinwilligungsText[]
  /** Die ganze Geschichte, neueste zuerst – nicht nur, was gerade gilt. */
  eintraege: Einwilligung[]
  geladen: boolean
  laedt: boolean
  /** Meldung der Datenbank, falls das Laden scheitert. */
  fehler: string | null

  laden: () => Promise<void>
  /** Mehrere Zwecke in einem Zug erteilen. Leere Liste tut nichts. */
  erteilen: (
    zwecke: EinwilligungZweck[],
    quelle: 'registrierung' | 'profil',
  ) => Promise<string | null>
  widerrufen: (zweck: EinwilligungZweck) => Promise<string | null>
  /** Gilt die Erlaubnis gerade? */
  gilt: (zweck: EinwilligungZweck) => boolean
  /** Der Wortlaut, der jetzt gezeigt und mitgeschrieben wird. */
  aktuellerText: (zweck: EinwilligungZweck) => EinwilligungsText | undefined
}

/**
 * Die juengste Zeile je Zweck.
 *
 * Setzt voraus, dass die Liste neueste zuerst sortiert ist – genau so kommt
 * sie aus `laden`.
 */
function juengsteJeZweck(
  eintraege: Einwilligung[],
): Map<EinwilligungZweck, Einwilligung> {
  const map = new Map<EinwilligungZweck, Einwilligung>()
  for (const e of eintraege) {
    if (!map.has(e.zweck)) map.set(e.zweck, e)
  }
  return map
}

export const useEinwilligung = create<EinwilligungState>((set, get) => ({
  texte: [],
  eintraege: [],
  geladen: false,
  laedt: false,
  fehler: null,

  laden: async () => {
    set({ laedt: true })

    // Beide Abfragen zugleich: Sie haengen nicht voneinander ab, und der
    // Registrierungsschirm braucht sie gemeinsam.
    const [textAntwort, eintragAntwort] = await Promise.all([
      db()
        .from('texte')
        .select('*')
        // Der juengste Wortlaut je Zweck steht damit vorn.
        .order('gueltig_ab', { ascending: false }),
      db()
        .from('einwilligungen')
        .select('*')
        .order('zeitpunkt', { ascending: false }),
    ])

    const fehler = textAntwort.error ?? eintragAntwort.error
    if (fehler) {
      set({ laedt: false, geladen: true, fehler: fehler.message })
      return
    }

    set({
      texte: (textAntwort.data ?? []) as EinwilligungsText[],
      eintraege: (eintragAntwort.data ?? []) as Einwilligung[],
      laedt: false,
      geladen: true,
      fehler: null,
    })
  },

  erteilen: async (zwecke, quelle) => {
    if (zwecke.length === 0) return null

    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const zeilen = []
    for (const zweck of zwecke) {
      const text = get().aktuellerText(zweck)
      // Ohne Wortlaut keine Einwilligung: Eine Zeile ohne Textbezug waere
      // als Nachweis wertlos, und der Fremdschluessel wuerde sie ohnehin
      // abweisen. Lieber hier mit klarer Meldung abbrechen.
      if (!text) return `Kein Wortlaut fuer "${zweck}" hinterlegt`
      zeilen.push({
        user_id: userId,
        zweck,
        entscheidung: 'erteilt',
        text_version: text.version,
        text_hash: text.wortlaut_hash,
        quelle,
      })
    }

    const { error } = await db().from('einwilligungen').insert(zeilen)
    if (error) return error.message

    // Die Analyse-Erlaubnis sagt zu, dass Plattform und Zeitzone erhoben
    // werden – also werden sie es hier, und nur hier. Ein Text, der etwas
    // ankuendigt, das nicht stattfindet, ist keine Einwilligung, sondern
    // eine Behauptung.
    if (zwecke.includes('analyse')) {
      await analyseangabenSchreiben(userId, true)
    }

    await get().laden()
    return null
  },

  widerrufen: async (zweck) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // Ein Widerruf bezieht sich auf den Wortlaut, der zuletzt galt – nicht
    // auf den neuesten. Sonst stuende in der Zeile ein Text, den die Person
    // nie gesehen hat.
    const zuletzt = juengsteJeZweck(get().eintraege).get(zweck)
    const text = get().aktuellerText(zweck)
    const version = zuletzt?.text_version ?? text?.version
    const hash = zuletzt?.text_hash ?? text?.wortlaut_hash
    if (!version || !hash) return 'Es gibt nichts zu widerrufen'

    // Eine neue Zeile, kein update: Die Erteilung bleibt mit ihrem
    // urspruenglichen Zeitpunkt stehen. Der Widerruf tritt daneben, nicht
    // an ihre Stelle.
    const { error } = await db().from('einwilligungen').insert({
      user_id: userId,
      zweck,
      entscheidung: 'widerrufen',
      text_version: version,
      text_hash: hash,
      quelle: 'profil',
    })

    if (error) return error.message

    // Mit dem Widerruf gehen auch die Angaben, die nur unter dieser
    // Erlaubnis erhoben wurden. Ein Widerruf, nach dem die Daten
    // stehenbleiben, waere keiner.
    if (zweck === 'analyse') {
      await analyseangabenSchreiben(userId, false)
    }

    await get().laden()
    return null
  },

  gilt: (zweck) => juengsteJeZweck(get().eintraege).get(zweck)?.entscheidung === 'erteilt',

  aktuellerText: (zweck) => {
    // Die Liste ist nach gueltig_ab absteigend sortiert; der erste Treffer
    // ist damit der juengste.
    //
    // Zwei Dinge werden dabei ausgeschlossen:
    //
    // Ein Wortlaut, dessen Gueltigkeit erst beginnt, gilt noch nicht. Ohne
    // diese Pruefung liesse sich kein neuer Text vorbereiten, ohne dass er
    // sofort angezeigt wuerde.
    //
    // Uebernommene Altbestaende ("bestand-...") tragen ein Datum weit in
    // der Vergangenheit und landen dadurch hinten – sie sind der Bezug
    // alter Einwilligungen, nie der Text fuer eine neue.
    const jetzt = Date.now()
    return get().texte.find(
      (t) => t.zweck === zweck && new Date(t.gueltig_ab).getTime() <= jetzt,
    )
  },
}))
