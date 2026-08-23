import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'
import { istDoppelt } from '../lib/supabaseFehler'
import { useEinwilligung } from './einwilligung'
import type { CommunityProfil } from './communityProfile'

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
    const { data } = await supabase
      .from('community_profiles')
      .select('zusammenlauf_sichtbar')
      .eq('user_id', ich)
      .maybeSingle()
    // Kein Profil heisst: Schalter aus - das ist die Voreinstellung der
    // Migration und damit die Wahrheit, nicht eine Annahme.
    set({ sichtbar: (data as { zusammenlauf_sichtbar: boolean } | null)?.zusammenlauf_sichtbar ?? false })
  },

  sichtbarkeitSetzen: async (an) => {
    const ich = eigeneKennung()
    if (!ich) return

    const einwilligung = useEinwilligung.getState()
    if (!einwilligung.geladen) await einwilligung.laden()

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
    const { error } = await supabase
      .from('community_profiles')
      .upsert({ user_id: ich, zusammenlauf_sichtbar: an })
    if (error) {
      set({ sichtbar: vorher, fehler: error.message })
      return
    }

    if (!an) {
      // Beim Ausschalten andersherum: erst die Wirkung (nicht mehr
      // vorgeschlagen werden), dann der Nachweis. Der Schutz darf nicht
      // daran haengen, ob die Widerrufszeile ankommt - scheitert sie,
      // bleibt der Schalter trotzdem aus, und der Widerruf geht beim
      // naechsten Versuch mit.
      await einwilligung.widerrufen('zusammenlauf')
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
