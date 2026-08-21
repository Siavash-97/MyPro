import { supabase } from './supabase'
import { eigeneKennung } from './eigeneKennung'

/**
 * Blockieren.
 *
 * Der Unterschied zum Melden, weil er leicht verschwimmt: Melden heisst
 * "hier stimmt etwas nicht, seht es euch an". Blockieren heisst "ich will
 * diesen Menschen nicht mehr sehen". Das eine geht an uns, das andere
 * wirkt sofort und betrifft nur die eigene Sicht.
 *
 * Was hier NICHT passiert
 * -----------------------
 * Es wird nichts gefiltert. Das Ausblenden erledigen die Zeilenregeln der
 * Datenbank (Migration 0047) - ein Schutz, den die App durchsetzt, waere
 * keiner, weil man die Abfrage auch selbst stellen kann.
 *
 * Dieses Modul legt nur den Eintrag an und uebersetzt, was schiefgehen
 * kann.
 */

/**
 * @returns null bei Erfolg, sonst ein Satz fuer einen Menschen.
 */
export async function personBlockieren(personId: string): Promise<string | null> {
  const eigene = eigeneKennung()
  if (!eigene) return 'Zum Blockieren musst du angemeldet sein.'
  if (eigene === personId) return 'Dich selbst kannst du nicht blockieren.'

  const { error } = await supabase
    .from('blockierungen')
    .insert({ blocker_id: eigene, blockiert_id: personId })

  // Schon blockiert ist kein Fehler, sondern derselbe Wunsch zweimal.
  if (error && error.code !== '23505') {
    return 'Das Blockieren hat nicht geklappt. Versuch es noch einmal.'
  }
  return null
}

/** Zuruecknehmen - Menschen versoehnen sich. */
export async function blockierungAufheben(personId: string): Promise<string | null> {
  const eigene = eigeneKennung()
  if (!eigene) return 'Du bist nicht angemeldet.'

  const { error } = await supabase
    .from('blockierungen')
    .delete()
    .eq('blocker_id', eigene)
    .eq('blockiert_id', personId)

  if (error) return 'Das Aufheben hat nicht geklappt.'
  return null
}

/**
 * Habe ICH diese Person blockiert?
 *
 * Bewusst nur die eigene Richtung: Ob die andere Person mich blockiert hat,
 * ist ueber die Schnittstelle nicht zu erfahren - sonst waere das
 * Blockieren eine Mitteilung.
 */
export async function habeIchBlockiert(personId: string): Promise<boolean> {
  const eigene = eigeneKennung()
  if (!eigene) return false
  const { data } = await supabase
    .from('blockierungen')
    .select('blockiert_id')
    .eq('blocker_id', eigene)
    .eq('blockiert_id', personId)
    .maybeSingle()
  return data != null
}
