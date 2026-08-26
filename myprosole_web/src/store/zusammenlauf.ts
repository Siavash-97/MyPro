import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'
import { istDoppelt } from '../lib/supabaseFehler'
import { useEinwilligung } from './einwilligung'
import type { CommunityProfil } from './communityProfile'
import { speicherAnmelden } from '../lib/kontoZustand'

/**
 * ZusammenLauf: der Vorschlagsstapel und die Anfragen.
 *
 * Die Regeln stehen in der DATENBANK, nicht hier
 * ----------------------------------------------
 * Wer vorgeschlagen wird - Sichtbarkeit, Identitaetsfilter, blockiert,
 * weggewischt, schon angefragt - entscheidet die Funktion
 * `zusammenlauf_vorschlaege` (Migration 0052). Das ist die eingeloeste
 * Bringschuld aus 0049: "ein Filter in der App waere Bequemlichkeit, kein
 * Schutz." Dieser Store filtert deshalb NICHTS nach - er holt, zeigt und
 * schreibt.
 *
 * Wischen ist eine Entscheidung, kein Blaettern
 * ---------------------------------------------
 * Links wischen schreibt dauerhaft in `zusammenlauf_weggewischt` (Q1b) -
 * ausdruecklich getrennt von "blockiert" (0047): Weggewischt heisst nur
 * "nicht vorschlagen", blockiert heisst beidseitig unsichtbar. Rechts
 * wischen legt eine Anfrage an (Q2a) - keinen Chat: Ein Chat ohne Zusage
 * waere eine Nachricht, die man nicht abbestellen kann.
 *
 * Warum die Karte beim Scheitern liegen bleibt - aber nur bei der Anfrage
 * -----------------------------------------------------------------------
 * Scheitert die ANFRAGE (kein Netz), bleibt die Karte im Stapel: Die Person
 * wollte Kontakt, und ein stilles Verwerfen hiesse, die Anfrage kam nie an
 * und niemand erfaehrt es. Scheitert das WEGWISCHEN, verschwindet die Karte
 * trotzdem: Die Absicht war "will ich nicht sehen", und genau das passiert
 * - schlimmstenfalls taucht das Profil in einer spaeteren Sitzung noch
 * einmal auf. Ein Fehler, der dem Wunsch entspricht, ist keiner, der die
 * Oberflaeche unterbrechen muss.
 */

export interface KontaktAnfrage {
  id: string
  von_id: string
  an_id: string
  stand: 'offen' | 'angenommen' | 'abgelehnt'
  created_at: string
  beantwortet_am: string | null
}

interface ZusammenlaufState {
  /** Die Vorschlaege, vorderste Karte zuerst. */
  stapel: CommunityProfil[]
  laedt: boolean
  /** Woran der letzte Schritt scheiterte - oder null. */
  fehler: string | null
  /** Anfragen, in denen ich stecke - beide Richtungen. */
  kontaktAnfragen: KontaktAnfrage[]
  /** Der eigene Schalter - null, solange er nicht geladen ist. */
  sichtbar: boolean | null

  vorschlaegeLaden: () => Promise<void>
  /** Links: dauerhaft nicht mehr vorschlagen. */
  wegwischen: (userId: string) => Promise<void>
  /** Rechts: eine Anfrage an diese Person. */
  anfragen: (userId: string) => Promise<void>
  antworten: (anfrageId: string, antwort: 'angenommen' | 'abgelehnt') => Promise<void>
  anfragenLaden: () => Promise<void>
  sichtbarkeitLaden: () => Promise<void>
  sichtbarkeitSetzen: (an: boolean) => Promise<void>
}

/**
 * Was der Mensch liest, wenn die Widerrufszeile nicht ankam.
 *
 * An einer Stelle, weil zwei Wege hierher fuehren: der Widerruf beim
 * Ausschalten und seine Wiederholung. Der Wortlaut nennt zuerst, was gilt
 * (die Sichtbarkeit ist aus), dann was fehlt - in dieser Reihenfolge, weil
 * die erste Fassung mit "Ausschalten fehlgeschlagen:" davorstand und Leute
 * dazu gebracht haette, sich erneut sichtbar zu machen.
 */
function nachtragMeldung(problem: string): string {
  return `Sichtbarkeit ist aus. Der Widerruf konnte noch nicht vermerkt werden (${problem}).`
}

export const useZusammenlauf = create<ZusammenlaufState>((set, get) => ({
  stapel: [],
  laedt: false,
  fehler: null,
  kontaktAnfragen: [],
  sichtbar: null,

  vorschlaegeLaden: async () => {
    set({ laedt: true, fehler: null })
    const { data, error } = await supabase.rpc('zusammenlauf_vorschlaege', { hoechstens: 20 })
    if (error) {
      set({ laedt: false, fehler: error.message })
      return
    }
    set({ laedt: false, stapel: (data ?? []) as CommunityProfil[] })
  },

  wegwischen: async (userId) => {
    const ich = eigeneKennung()
    if (!ich) return

    // Karte sofort weg - die Absicht ist "nicht sehen", und die erfuellt
    // sich unabhaengig davon, ob das Schreiben gelingt (siehe Kopf).
    set({ stapel: get().stapel.filter((p) => p.user_id !== userId) })

    const { error } = await supabase
      .from('zusammenlauf_weggewischt')
      .insert({ wischer_id: ich, weggewischt_id: userId })
    // Doppelt (23505) heisst: war schon weggewischt - genau der gewollte
    // Zustand. Alles andere wird gemeldet, aber unterbricht nicht.
    if (error && !istDoppelt(error)) set({ fehler: error.message })
  },

  anfragen: async (userId) => {
    const ich = eigeneKennung()
    if (!ich) return

    // stand wird nicht mitgeschickt: Die Voreinstellung 'offen' kommt aus
    // der Datenbank, und die Insert-Regel dort erzwingt sie ohnehin.
    const { error } = await supabase
      .from('community_kontakt_anfragen')
      .insert({ von_id: ich, an_id: userId })

    if (error && !istDoppelt(error)) {
      // Die Karte bleibt liegen: Die Person wollte Kontakt, und die Anfrage
      // ist nicht angekommen. Verschwaende sie jetzt, waere das ein stilles
      // "nie abgeschickt".
      set({ fehler: error.message })
      return
    }
    set({
      stapel: get().stapel.filter((p) => p.user_id !== userId),
      fehler: null,
    })
  },

  antworten: async (anfrageId, antwort) => {
    // Nur die zwei Spalten, die das spaltenweise Update-Recht (0052)
    // erlaubt. Jede weitere liesse JEDES Antworten mit 42501 scheitern.
    const { error } = await supabase
      .from('community_kontakt_anfragen')
      .update({ stand: antwort, beantwortet_am: new Date().toISOString() })
      .eq('id', anfrageId)

    if (error) {
      set({ fehler: error.message })
      return
    }
    set({
      kontaktAnfragen: get().kontaktAnfragen.map((a) =>
        a.id === anfrageId ? { ...a, stand: antwort } : a,
      ),
      fehler: null,
    })
  },

  sichtbarkeitLaden: async () => {
    const ich = eigeneKennung()
    if (!ich) return
    // Ueber die Funktion statt ueber die Tabelle: Seit 0057 darf
    // `authenticated` diese Spalte nicht mehr lesen. Die Funktion nimmt
    // ABSICHTLICH keinen Parameter - es gibt keinen Weg, sie fuer eine
    // fremde Kennung zu fragen.
    const { data, error } = await supabase.rpc('meine_profil_einstellungen')
    if (error) {
      // `sichtbar` bleibt null - "noch nicht geladen", so wie es der Typ
      // meint. Die erste Fassung machte aus einem Netzfehler ein `false`
      // und zeigte damit einen Schalter, der AUS aussieht, obwohl niemand
      // ihn ausgeschaltet hat. Wer das sieht, legt ihn um - und schreibt
      // eine zweite unveraenderliche Einwilligungszeile fuer etwas, das
      // laengst zugesagt war.
      set({ fehler: error.message })
      return
    }
    // Kein Profil heisst: Schalter aus - das ist die Voreinstellung der
    // Migration und damit die Wahrheit, nicht eine Annahme. Das gilt aber
    // nur, wenn wirklich GELESEN wurde (siehe oben).
    //
    // Hier steht ABSICHTLICH kein `fehler: null`.
    //
    // Es stand kurzzeitig da, und das war falsch: `Zusammenlauf.tsx` feuert
    // `vorschlaegeLaden`, `anfragenLaden` und `sichtbarkeitLaden` in einem
    // `Promise.all` und liest danach EIN gemeinsames `fehler`. Scheitert das
    // RPC (etwa weil 0052 nicht eingespielt ist) und gelingt danach dieses
    // schlichte `select`, haette es die Meldung des Nachbarn geloescht - und
    // ein kaputtes Backend saehe aus wie eine leere Community, samt
    // Einladung "Sichtbar werden".
    //
    // Die Regel, die daraus folgt und fuer diesen ganzen Store gilt:
    // **Ein LADER setzt `fehler` nur, er raeumt ihn nie weg. Eine HANDLUNG
    // raeumt ihren eigenen am Eingang weg.** Ein Lader weiss nicht, wessen
    // Fehler dort steht; eine Handlung schon.
    // `returns table` liefert ein ARRAY mit null oder einer Zeile, kein
    // Objekt. Wer hier `data.zusammenlauf_sichtbar` liest, macht aus einem
    // gesetzten `true` ein `undefined` - und der Schalter stuende
    // faelschlich auf aus.
    const zeile = Array.isArray(data)
      ? (data[0] as { zusammenlauf_sichtbar: boolean } | undefined)
      : null
    set({ sichtbar: zeile?.zusammenlauf_sichtbar ?? false })
  },

  sichtbarkeitSetzen: async (an) => {
    const ich = eigeneKennung()
    if (!ich) return

    // Erst aufraeumen. Drei Stellen in der Oberflaeche urteilen nach
    // `fehler`; blieb dort einer von einem frueheren, ganz anderen Schritt
    // liegen, sah ein geglueckter Schaltvorgang aus wie ein misslungener.
    set({ fehler: null })

    const einwilligung = useEinwilligung.getState()
    if (!einwilligung.geladen) await einwilligung.laden()

    // Frueher stand hier eine Abkuerzung: Beim Ausschalten eines schon
    // ausgeschalteten Schalters wurde NUR der Widerruf wiederholt und das
    // Profil gar nicht angefasst. Das war eine Vorsicht, die einen Fehler
    // erzeugte.
    //
    // Der Fall: Einschalten gelingt, `upsert(true)` wird geschrieben, aber
    // die ANTWORT geht verloren (Verbindungsabbruch nach dem Senden - im
    // Mobilfunk der Normalfall). Der Store dreht auf `vorher` zurueck, also
    // `false`. Jetzt sagt die Datenbank `true` und der Store `false`.
    //
    // Der Mensch sieht "aus", tippt auf Wiederholen - und die Abkuerzung
    // widerrief nur die Einwilligung, waehrend er anderen weiterhin als
    // Laufpartner vorgeschlagen wurde. Sie reparierte genau die Haelfte, die
    // schon stimmte.
    //
    // `sichtbar === false` heisst "der Store glaubt aus", nicht "die
    // Datenbank steht auf aus". Deshalb wird jetzt in jedem Fall geschrieben.
    // Ein `upsert(false)` auf eine Zeile, die schon `false` ist, kostet
    // nichts und ist wiederholbar - anders als `erteilen`, das eine neue
    // unveraenderliche Zeile anlegt und deshalb weiter nur beim Einschalten
    // laeuft.
    //
    // Gefunden vom Agenten `pruefung`, 24.08.2026.
    if (an) {
      // ERST der Nachweis, DANN die Wirkung. Der Schalter allein ist nach
      // dem Massstab von 0034 keine Einwilligung - ein ueberschreibbarer
      // Boolean ohne Wortlaut und Zeitpunkt. Scheitert die Zeile, wird
      // nicht eingeschaltet: Eine Wirkung ohne Nachweis darf nicht
      // entstehen.
      const problem = await einwilligung.erteilen(['zusammenlauf'], 'profil')
      if (problem) {
        set({ fehler: problem })
        return
      }
    }

    // Sofort zeigen, was gemeint war; bei einem Fehler zurueckdrehen. Ein
    // Schalter, der erst nach der Netzantwort umspringt, fuehlt sich kaputt
    // an - und einer, der bei Fehlern umgelegt bleibt, luegt.
    const vorher = get().sichtbar
    set({ sichtbar: an })
    // upsert, nicht update: Wer nie ein Community-Profil angelegt hat, hat
    // keine Zeile - der Schalter legt sie an, mit den Voreinstellungen der
    // Datenbank fuer alles Uebrige.
    // NUR der Schalter, ueber die schmale Funktion. Sie schreibt genau ein
    // Feld; `zeigt_mir` und `sichtbar_fuer` kann sie nicht anfassen, auch
    // nicht versehentlich. Ein gemeinsamer Setzweg haette verlangt, dass
    // diese Stelle die zwei Praeferenzen mitschickt, die sie gar nicht
    // kennt - und sie damit auf die Vorgaben zurueckgesetzt.
    //
    // Und ueber die Funktion statt per upsert, weil `on conflict do update`
    // seit 0057 SELECT auf die Zielspalte braucht (gemessen: 42501).
    const { error } = await supabase.rpc('meine_sichtbarkeit_setzen', {
      p_sichtbar: an,
    })
    if (error) {
      set({ sichtbar: vorher, fehler: error.message })
      return
    }

    if (!an) {
      // Beim Ausschalten andersherum: erst die Wirkung (nicht mehr
      // vorgeschlagen werden), dann der Nachweis. Der Schutz darf nicht
      // daran haengen, ob die Widerrufszeile ankommt - scheitert sie,
      // bleibt der Schalter trotzdem aus.
      //
      // Aber er darf auch nicht VERSCHWIEGEN werden. Der alte Kommentar
      // hier versprach, "der Widerruf geht beim naechsten Versuch mit" -
      // den gab es nicht: Zum Ausschalten kommt man nur ueber ein
      // eingeschaltetes `sichtbar`, und das ist der Schalter jetzt gerade
      // nicht mehr. Der Nachweis nach Art. 7 Abs. 1 DSGVO, den Migration
      // 0053 eingefuehrt hat, haette dann dauerhaft "erteilt" gesagt,
      // waehrend die Person widerrufen hat - und niemand haette es
      // gemerkt, weil die Wirkung ja eingetreten war.
      const problem = await einwilligung.widerrufen('zusammenlauf')
      if (problem) set({ fehler: nachtragMeldung(problem) })
    }
  },

  anfragenLaden: async () => {
    const { data, error } = await supabase
      .from('community_kontakt_anfragen')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      set({ fehler: error.message })
      return
    }
    set({ kontaktAnfragen: (data ?? []) as KontaktAnfrage[] })
  },
}))

/** Wie viele offene Anfragen an mich warten - fuer Glocke und Abzeichen. */
export function offeneAnMich(anfragen: KontaktAnfrage[], ich: string | null): number {
  if (!ich) return 0
  return anfragen.filter((a) => a.an_id === ich && a.stand === 'offen').length
}

// Beim Abmelden zuruecksetzen. Ohne das saehe der naechste Angemeldete auf
// demselben Geraet die Daten des vorigen, bis die erste Abfrage sie
// ueberschreibt. Siehe lib/kontoZustand.ts.
speicherAnmelden(useZusammenlauf)
