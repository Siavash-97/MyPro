import type { ExerciseModality } from '../types'

/**
 * Welche Übungen in die Mikroroutine kommen – an einer Stelle.
 *
 * Warum als eigenes Modul und nicht in der Seite
 * ----------------------------------------------
 * Zwei Stellen brauchen dieselbe Antwort: Die Übungen-Seite kündigt an, wie
 * viele Übungen die Routine hat, und die Routine selbst führt sie durch.
 * Standen beide Auswahlen getrennt da, konnten sie auseinanderlaufen – die
 * Karte versprach "3 Übungen", während die Routine keine fand. Genau das
 * war der Fall, als der Übungskatalog geleert wurde (Migration 0039).
 *
 * Der Zuschnitt ist vorläufig
 * ---------------------------
 * Ausgewählt wird heute nach einem festen Filter: alles, was ohne Geräte
 * geht. Was hier stehen SOLL, ist eine Auswahl aus der Anamnese –
 * Beschwerden und Schmerzstellen bestimmen, welche Übungen jemand bekommt
 * und welche ausdrücklich nicht. Solange das fehlt, sind die Übungen ein
 * Beispiel, keine Empfehlung.
 */

/** So viele Übungen umfasst eine Routine – wenn so viele da sind. */
export const ROUTINE_UMFANG = 3

/** Nur das Nötige, damit die Auswahl auch mit Teilangaben arbeiten kann. */
interface MitModalitaet {
  modality: ExerciseModality
}

/**
 * Die Übungen der Routine, in der Reihenfolge, in der sie kommen.
 *
 * Ohne Geräte, damit die Routine überall direkt nach dem Lauf geht – auf
 * dem Parkplatz genauso wie zu Hause. `both` zählt mit: Diese Übungen
 * lassen sich mit Gerät machen, brauchen aber keines.
 */
export function routineAuswahl<T extends MitModalitaet>(alle: T[]): T[] {
  return alle
    .filter((ex) => ex.modality === 'bodyweight' || ex.modality === 'both')
    .slice(0, ROUTINE_UMFANG)
}
