/**
 * Ein Urteil je Segment: zaehlt dieser Abschnitt, und wie viel davon?
 *
 * Warum diese Datei existiert
 * ---------------------------
 * Bis zum 23.08.2026 entschieden ueber ein und dasselbe Segment **zwei
 * getrennte Waechter**:
 *
 *   `istOrtungssprung`     entschied ueber die STRECKE
 *   `bewegungszeitAnteilS` entschied ueber die ZEIT
 *
 * Sie waren nicht aufeinander abgestimmt. Fiel ein Segment durch den
 * Zeitwaechter (Luecke groesser als 15 Sekunden), blieb der **Weg stehen und
 * die Zeit verschwand** - und das Tempo wurde dadurch schneller, als je
 * jemand gelaufen ist.
 *
 * Gemessen am 22.08.2026, dieselbe Aufzeichnung wie Strava, dasselbe Telefon:
 *
 *   19 Segmente trugen 371 m Strecke bei und 0 Sekunden Zeit.
 *   1.516 Sekunden fielen ersatzlos weg.
 *
 * Was gemessen wurde, bevor entschieden wurde
 * -------------------------------------------
 * Drei Regeln wurden an den Felddaten durchgerechnet, `gehen_und_stehen`:
 *
 *   heute (15-Sekunden-Kante)     281 s / 1,729 km  = 2:43 min/km
 *   Halt verwirft beides          269 s / 1,557 km  = 2:53 min/km
 *   Halt behaelt seine Strecke    460 s / 1,729 km  = 4:26 min/km
 *   ----------------------------------------------------------------
 *   Strava, gleiche Aufzeichnung  933 s / 3,540 km  = 4:24 min/km
 *
 * **Die naheliegende Regel - "kein Laufen, also weg damit" - macht das Tempo
 * schlechter als der Fehler, den sie beheben soll.** Es war meine eigene
 * Empfehlung, und sie ist an den Daten gescheitert; das ist nach den
 * Hoehenmetern das zweite Mal.
 *
 * Die drei Urteile
 * ----------------
 * **`sprung`** - Der Weg wurde nachweislich nicht zurueckgelegt: schneller
 * als jeder Mensch, weiter als jede plausible Luecke, oder ohne Zeitabstand.
 * Strecke und Zeit fallen **beide**. Das ist die eine Stelle, an der
 * symmetrisch verworfen wird.
 *
 * **`gezaehlt`** - Das implizite Tempo liegt im menschlichen Bereich.
 * Strecke und Zeit zaehlen **beide voll**. Wie lang die Luecke war, spielt
 * keine Rolle mehr - die 15-Sekunden-Kante ist ersatzlos weg. Sie war ein
 * Stellvertreter fuer "glaube ich, was dazwischen passiert ist", und das
 * implizite Tempo beantwortet diese Frage direkt.
 *
 * **`halt`** - Zu langsam, um Bewegung zu sein. Die Strecke bleibt, denn sie
 * ist zurueckgelegt worden. Die Zeit bekommt ihre **belegbare Untergrenze**:
 * Wer 28 m gegangen ist und dabei nie schneller war als die
 * Bewegungsschwelle, war dafuer mindestens 28 / 0,9 Sekunden unterwegs. Das
 * ist eine Ableitung, keine Schaetzung.
 */

/**
 * Ab hier gilt es als Bewegung: 0,9 m/s sind 3,2 km/h oder 18:38 min/km.
 *
 * Strava beschreibt seine Bewegungszeit ueber "anything faster than a
 * 30-minute mile pace" - das sind genau diese 0,894 m/s. Der Wert beschreibt
 * kein Rauschen, sondern die Festlegung, ab wann Bewegung als Bewegung
 * zaehlt. Deshalb ist er hier die Untergrenze: Ein gemessener Ruhepegel darf
 * das Tor anheben, nie senken.
 *
 * Steht hier und nicht mehr in `bewegung.ts`, weil er die untere Grenze
 * dieses Urteils ist; `bewegung.ts` reicht ihn weiter.
 */
export const BEWEGUNG_MPS = 0.9

/**
 * Schneller kann niemand laufen (12,5 m/s sind 45 km/h; der Weltrekord ueber
 * 100 m liegt bei rund 10,4 m/s im Schnitt). Was darueber liegt, ist ein
 * Ortungssprung.
 */
export const MAX_TEMPO_MPS = 12.5

/**
 * Darueber ist es ein Sprung, keine Strecke - Tunnel, Neuortung.
 *
 * Ungeprueft: In den Felddaten vom 22.08.2026 kam kein einziges Segment
 * darueber vor. Die Grenze ist damit weder bestaetigt noch widerlegt.
 */
export const MAX_SEGMENT_M = 500

export type Urteil = 'gezaehlt' | 'sprung' | 'halt'

export interface Segmenturteil {
  urteil: Urteil
  /** Was dieses Segment zur Strecke beitraegt, in Metern. */
  streckeM: number
  /** Was dieses Segment zur Bewegungszeit beitraegt, in Sekunden. */
  zeitS: number
}

// Eingefroren: Jeder Sprung gibt DIESELBE Referenz zurueck. Ein Aufrufer,
// der sie veraendert, wuerde alle folgenden Sprünge vergiften - so wirft er.
const NICHTS: Segmenturteil = Object.freeze({ urteil: 'sprung', streckeM: 0, zeitS: 0 })

/**
 * Was traegt dieses Segment bei?
 *
 * Eine Frage, eine Antwort, drei Zahlen - und **alle Aufrufer folgen
 * derselben.** Vorher fragten `addPoint` und `computeSplits` zwei
 * verschiedene Waechter und kamen auf verschiedene Ergebnisse: Auf dem
 * Bildschirm stand "4,0 km" und darunter Abschnitte, die sich auf 5,2 km
 * summierten.
 *
 * @param streckeM Abstand zwischen zwei Messungen in Metern.
 * @param sekunden Zeit zwischen denselben zwei Messungen.
 */
export function segmenturteil(streckeM: number, sekunden: number): Segmenturteil {
  if (!Number.isFinite(streckeM) || streckeM < 0) return NICHTS
  if (streckeM > MAX_SEGMENT_M) return NICHTS
  // Ohne Zeitabstand laesst sich kein Tempo bilden, und die Strecke
  // dazwischen ist nicht belegbar.
  if (!Number.isFinite(sekunden) || sekunden <= 0) return NICHTS

  const tempoMps = streckeM / sekunden
  if (tempoMps > MAX_TEMPO_MPS) return NICHTS

  if (tempoMps >= BEWEGUNG_MPS) {
    return { urteil: 'gezaehlt', streckeM, zeitS: sekunden }
  }

  // Halt. Die Untergrenze kann die Luecke nie ueberschreiten - unterhalb der
  // Schwelle ist `streckeM / BEWEGUNG_MPS` rechnerisch immer kleiner als
  // `sekunden`. Das Minimum steht trotzdem da: Es macht die Zusage
  // "nie mehr Zeit, als die Luecke lang war" im Quelltext sichtbar, statt
  // sie einer Herleitung zu ueberlassen.
  return {
    urteil: 'halt',
    streckeM,
    zeitS: Math.min(sekunden, streckeM / BEWEGUNG_MPS),
  }
}

/** Die drei gueltigen Urteile, an einer Stelle. */
const URTEILE: readonly Urteil[] = ['gezaehlt', 'sprung', 'halt']

/**
 * Ist das ein gueltiges Urteil?
 *
 * Der Waechter vor der Datenbank. `run_points.urteil` traegt seit Migration
 * 0051 eine Pruefbedingung; ein ungueltiger Wert laesst das **ganze Buendel**
 * mit 23514 scheitern. Der Punkt bliebe dann im Geraetepuffer liegen, und
 * jede weitere Uebertragung scheiterte am selben Punkt - eine Blockade, die
 * sich von selbst nicht mehr aufloest und dem Menschen ab da jede weitere
 * Strecke kostet.
 *
 * Die Quelle eines solchen Wertes waere nicht der eigene Rechenweg, sondern
 * ein von Hand veraenderter Geraetespeicher oder ein spaeterer Codepfad, der
 * die Regel nicht kennt. `offenePunkte()` liest den Puffer mit `getAll()`
 * und prueft dabei nichts nach.
 *
 * Geprueft wird gegen `URTEILE` und nicht gegen eine zweite Liste im
 * Sendemodul: Zwei Aufzaehlungen derselben Menge laufen auseinander.
 */
export function istUrteil(wert: unknown): wert is Urteil {
  return typeof wert === 'string' && (URTEILE as readonly string[]).includes(wert)
}
