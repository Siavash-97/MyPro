/**
 * Laeufe, die beim Speichern haengengeblieben sind.
 *
 * Der Befund
 * ----------
 * Am 23.08.2026 blieb ein Lauf beim Speichern stehen. Danach sah es so aus:
 *
 *   Lauf-Zeile   status 'tracking', distance_km null
 *   run_points   20 Punkte, vollstaendig, mit Urteilen
 *   Dienst       sauber, offen = 0
 *   Merker       geloescht
 *
 * Beim naechsten Start sagte die Bergung **"nichts zu tun"**. Sie fragt den
 * DIENST - und der hatte nichts mehr, weil die Punkte laengst abgeholt und
 * bestaetigt waren. Dass eine Lauf-Zeile auf 'tracking' fuer sich schon ein
 * Fund ist, wusste niemand.
 *
 * `sitzungBergen.ts` beantwortet die Frage "haelt der Dienst noch etwas?".
 * Diese Datei beantwortet die andere: **"steht in der Datenbank ein Lauf,
 * der nie fertig wurde?"** Zwei Quellen, zwei Fragen - und die zweite
 * fehlte.
 *
 * Warum das nicht dieselbe Frage ist
 * ----------------------------------
 * Der Dienst weiss, ob noch Rohdaten auf dem Geraet liegen. Die Datenbank
 * weiss, ob ein Lauf je abgeschlossen wurde. Ein Lauf kann vollstaendig
 * uebertragen und trotzdem unfertig sein - genau das ist passiert.
 */

import { laufBilanz, type Bilanzpunkt } from './laufBilanz'
import { gesamtzeitS } from './laufdauer'
import type { Urteil } from './segmenturteil'

export interface HaengenderLauf {
  id: string
  status: string
  started_at: string
  /** Wie viele Punkte zu diesem Lauf schon in der Datenbank liegen. */
  punkte: number
  /**
   * Wann zuletzt gemessen wurde - oder null, wenn es keinen Punkt gibt.
   *
   * Das ist die Groesse, die "laeuft noch" von "haengt" trennt. Der Start
   * kann Stunden zurueckliegen und der Lauf trotzdem im Gange sein.
   */
  zuletztGemessen: string | null
}

/**
 * So viele Punkte braucht es, bevor nachtraeglich abgeschlossen wird.
 *
 * Unter zehn Punkten - bei MIN_SEGMENT_M = 10 also unter rund 100 Metern -
 * gibt es nichts zu rechnen, das eine Zeile im Verlauf rechtfertigt. Sie
 * bliebe dann lieber stehen, als einen Lauf ueber null Komma null zu
 * erfinden.
 */
export const MIN_PUNKTE_ZUM_ABSCHLIESSEN = 10

/**
 * Schonfrist: So lange nach der LETZTEN MESSUNG wird ein Lauf nicht angefasst.
 *
 * Der gefaehrlichste Fehler dieser Funktion waere, einen Lauf zu
 * beenden, der gerade laeuft. Die aktuelle Sitzung ist zwar ausgenommen -
 * aber nur, wenn die App sie kennt. Wer auf einem zweiten Geraet startet
 * oder gerade erst losgelaufen ist, waere sonst nach Sekunden "fertig".
 *
 * Fuenf Minuten sind grosszuegig genug, dass niemand mitten im Losgehen
 * getroffen wird, und kurz genug, dass ein haengengebliebener Lauf noch
 * am selben Tag im Verlauf auftaucht.
 */
export const SCHONFRIST_MS = 5 * 60_000

/**
 * Welche Laeufe duerfen nachtraeglich abgeschlossen werden?
 *
 * @param laeufe   Eigene Laeufe mit status 'tracking', samt Punktzahl.
 * @param aktuelle Die gerade laufende Lauf-Kennung, oder null.
 * @param jetztMs  Bezugszeitpunkt.
 */
export function haengendeLaeufe(
  laeufe: HaengenderLauf[] | undefined | null,
  aktuelle: string | null,
  jetztMs: number,
): HaengenderLauf[] {
  if (!Array.isArray(laeufe)) return []
  return laeufe
    .filter((l) => {
      if (!l || typeof l.id !== 'string' || l.id.length === 0) return false
      if (l.status !== 'tracking') return false
      if (l.id === aktuelle) return false
      if (!Number.isFinite(l.punkte) || l.punkte < MIN_PUNKTE_ZUM_ABSCHLIESSEN) return false
      // Gemessen wird ab der LETZTEN MESSUNG, nicht ab dem Start.
      //
      // Die erste Fassung nahm den Start - damit war jeder Lauf, der laenger
      // als fuenf Minuten dauert, waehrend er laeuft von einem zweiten
      // Geraet aus abschliessbar. Bei einem Halbmarathon waeren das
      // zweieinhalb Stunden offenes Fenster. Der Start sagt, wann jemand
      // losgelaufen ist; ob er noch laeuft, sagt die letzte Messung.
      //
      // Ohne Punkte gibt es keine letzte Messung - dann ist der Start das
      // Beste, was es gibt. Rueckfall, nicht Hauptweg.
      // Ein unlesbarer Start disqualifiziert die Zeile, auch wenn es eine
      // gute letzte Messung gibt: Er traegt unten die Sortierung, und eine
      // Reihenfolge nach NaN ist keine.
      if (!Number.isFinite(Date.parse(l.started_at))) return false
      const zuletzt = l.zuletztGemessen ? Date.parse(l.zuletztGemessen) : NaN
      const bezug = Number.isFinite(zuletzt) ? zuletzt : Date.parse(l.started_at)
      if (!Number.isFinite(bezug)) return false
      return jetztMs - bezug >= SCHONFRIST_MS
    })
    // Aeltere zuerst: Sie warten am laengsten, und wenn der Vorgang
    // abbricht, ist der dringendste Fall schon erledigt.
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
}

/**
 * Die Kennzahlen eines haengenden Laufs, gerechnet aus seinen Punkten.
 *
 * Warum aus den Punkten und nicht aus `liveStats`
 * -----------------------------------------------
 * Die Live-Zahlen sind weg - die App wurde beendet, genau deshalb haengt
 * der Lauf. Was bleibt, sind die Punkte in der Datenbank, und die tragen
 * seit Migration 0051 ihr Urteil bei sich. `laufBilanz` liest genau das.
 *
 * **Kein zweiter Rechenweg.** Genau daran ist B1 gescheitert: Zwei Stellen,
 * die dieselbe Frage verschieden beantworteten. Diese Funktion rechnet
 * nichts selbst, sie faltet nur.
 *
 * @returns Die Felder fuer die Lauf-Zeile, oder null wenn zu wenig da ist.
 */
export function kennzahlenAusPunkten(
  punkte: (Bilanzpunkt & { urteil?: Urteil | null })[],
  startedAtMs: number,
) {
  if (!Array.isArray(punkte) || punkte.length < 2) return null
  if (!Number.isFinite(startedAtMs)) return null

  const bilanz = laufBilanz(punkte)
  if (!(bilanz.streckeKm > 0)) return null

  const letzteMs = Date.parse(punkte[punkte.length - 1].recorded_at)
  if (!Number.isFinite(letzteMs)) return null

  // Die Dauer laeuft ab dem KNOPFDRUCK, nicht ab dem ersten Punkt.
  //
  // Genau so misst `stopRun` (`gesamtzeitS(startedAtMs, ...)`), und das ist
  // der Punkt: `istSpeicherwuerdig` ist jetzt eine Regel - aber eine Regel
  // mit zwei verschiedenen Eingaben ist wieder zwei Regeln.
  //
  // Der erste Punkt entsteht erst nach GPS-Fix UND nach der
  // Bewegungserkennung; bis dahin vergehen leicht 45 Sekunden. Gemessen ab
  // erstem Punkt wurde derselbe Lauf beim regulaeren Beenden gespeichert
  // (75 s) und beim Bergen verworfen (30 s) - die Asymmetrie war nur
  // umgedreht, nicht weg. Gefunden vom Agenten `pruefung`, 23.08.2026.
  //
  // Nebenbei stimmt damit auch die Zeile in sich: `ended_at - started_at`
  // ist jetzt `duration_s`, nicht laenger.
  const dauerS = gesamtzeitS(startedAtMs, letzteMs)
  const bewegungS = Math.round(bilanz.bewegungszeitS)

  return {
    status: 'completed' as const,
    // Das Ende ist die LETZTE MESSUNG, nicht jetzt. Sonst zaehlte bei einem
    // Lauf, der ueber Nacht liegenblieb, die ganze Nacht als Laufzeit -
    // derselbe Fehler, der am 23.08. frueh in der Bergung steckte.
    ended_at: new Date(letzteMs).toISOString(),
    distance_km: Math.round(bilanz.streckeKm * 1000) / 1000,
    duration_s: dauerS,
    moving_time_s: bewegungS,
    avg_pace_s_per_km: Math.round((bewegungS || dauerS) / bilanz.streckeKm),
    // Ausdruecklich null statt einer Zahl: Die Hoehe ist seit dem 22.08.
    // nachweislich unbrauchbar (36,6 m auf flacher Strecke, 0,0 auf neun
    // echten). Ein nachtraeglich abgeschlossener Lauf soll nicht behaupten,
    // was ein gewoehnlicher nicht einmal anzeigt.
    elevation_gain_m: null,
  }
}
