import { haversineM } from './geo'
import { BEWEGUNG_MPS, MAX_SEGMENT_M, MAX_TEMPO_MPS, segmenturteil, type Urteil } from './segmenturteil'

/**
 * Strecke, Zeit und Verworfenes eines Laufs - an einer Stelle gerechnet.
 *
 * Warum diese Datei existiert
 * ---------------------------
 * Dieselbe Rechnung stand bis zum 23.08.2026 an vier Stellen: in `addPoint`
 * (schrittweise, waehrend des Laufs), in `computeSplits` (ueber die fertige
 * Folge), in der Bewegungszeit und in der Abschnittsdauer. Sie liefen
 * zweimal nachweisbar auseinander:
 *
 *   22.08. - "4,0 km" auf dem Bildschirm, darunter Abschnitte mit 5,2 km
 *   22.08. - Bewegungszeit 382 s gegen Abschnittsdauer 433 s
 *
 * Beide Male war die Ursache dieselbe: zwei Antworten auf eine Frage.
 *
 * Wie die zwei Wege zusammengehalten werden
 * -----------------------------------------
 * `bilanzErweitern` ist der einzelne Schritt, `laufBilanz` die Faltung
 * darueber. `addPoint` benutzt den Schritt, `computeSplits` die Faltung.
 *
 * Dass beide Wege dasselbe ergeben, prueft `store/liveweg.test.ts` - und
 * zwar DURCH `addPoint` hindurch, mit allen Toren. Hier stand vorher, ein
 * Test in dieser Datei halte das fest; der verglich aber die Schleife mit
 * sich selbst und konnte per Konstruktion nicht rot werden. Gefunden vom
 * Pruefagenten am 23.08.2026.
 *
 * Was hier NICHT entschieden wird
 * -------------------------------
 * Ob ueberhaupt aufgezeichnet wird. Das entscheidet die Bewegungserkennung
 * in `bewegung.ts`, bevor ein Punkt entsteht - und sie verwirft dabei
 * Strecke, die hier nie ankommt. Deshalb ist `verworfeneStreckeM` **nicht**
 * die ganze verlorene Strecke, sondern nur die, die es bis hierher geschafft
 * hat. Gemessen am 22.08.2026: 1,73 km angekommen, Strava 3,54 km auf
 * derselben Aufzeichnung. Der groessere Verlust liegt davor (Befund B12).
 */

/** Das Mindeste, was ein Punkt haben muss, um zaehlbar zu sein. */
export interface Bilanzpunkt {
  latitude: number
  longitude: number
  recorded_at: string
  /**
   * Das beim Aufzeichnen gefaellte Urteil - wenn es eines gibt.
   *
   * Ist es da, GILT es. Nicht weil die Nachrechnung heute etwas anderes
   * ergaebe, sondern weil sie es morgen koennte: Wird eine der Schwellen
   * je geaendert, wuerden sonst alle Bestandslaeufe still neu bewertet und
   * saehen anders aus als am Tag ihrer Aufzeichnung.
   *
   * `null` oder fehlend heisst "wir wissen es nicht" - Punkte von vor dem
   * 23.08.2026 und der erste Punkt jedes Laufs. Dann entscheidet die
   * Geometrie, wie bisher.
   */
  urteil?: Urteil | null
}

export interface Bilanz {
  streckeKm: number
  bewegungszeitS: number
  /**
   * Strecke, die als Ortungssprung verworfen wurde, in Metern.
   *
   * Nur Spruenge. Ein Halt ist kein Verlust - er behaelt seine Strecke und
   * bekommt nur weniger Zeit. Ihn hier mitzuzaehlen hiesse, einen normalen
   * Ampelstopp als Fehler auszuweisen.
   */
  verworfeneStreckeM: number
  sprungAnzahl: number
  halteAnzahl: number
}

export const LEERE_BILANZ: Bilanz = {
  streckeKm: 0,
  bewegungszeitS: 0,
  verworfeneStreckeM: 0,
  sprungAnzahl: 0,
  halteAnzahl: 0,
}

/** Der Abstand zwischen zwei Punkten in Metern und Sekunden. */
function abstand(vorher: Bilanzpunkt, jetzt: Bilanzpunkt): { meter: number; sekunden: number } {
  return {
    meter: haversineM(vorher.latitude, vorher.longitude, jetzt.latitude, jetzt.longitude),
    sekunden:
      (new Date(jetzt.recorded_at).getTime() - new Date(vorher.recorded_at).getTime()) / 1000,
  }
}

/**
 * Was ein Segment beitraegt - mit Vorrang fuer ein gespeichertes Urteil.
 *
 * Die Geometrie liefert dieselben drei Zahlen wie beim Aufzeichnen; das
 * gespeicherte Urteil legt nur fest, WELCHE der drei Regeln gilt. Solange
 * die Schwellen unveraendert sind, kommt beides aufs Gleiche heraus - und
 * genau das prueft ein Test. Der Unterschied entsteht erst, wenn jemand
 * eine Schwelle aendert: Dann behaelt ein alter Lauf sein altes Urteil.
 */
function beitrag(meter: number, sekunden: number, gespeichert: Urteil | null) {
  const gerechnet = segmenturteil(meter, sekunden)
  if (gespeichert === null || gespeichert === gerechnet.urteil) return gerechnet

  if (gespeichert === 'sprung') return { urteil: 'sprung' as const, streckeM: 0, zeitS: 0 }
  if (!Number.isFinite(meter) || meter < 0 || !Number.isFinite(sekunden) || sekunden <= 0) {
    return { urteil: 'sprung' as const, streckeM: 0, zeitS: 0 }
  }

  // Die harten Grenzen gelten IMMER, auch gegen ein gespeichertes Urteil.
  //
  // Grund (Fund des Pruefagenten, 23.08.2026): Das Urteil beschreibt das
  // Segment zum Vorgaenger AUF DEM GERAET. Fehlt dazwischen ein Punkt -
  // punktMerken schlaegt fehl und wird bewusst verschluckt, oder ein Buendel
  // kommt nie an -, dann liegt der Vorgaenger IM ARRAY ganz woanders. Ein
  // gespeichertes "gezaehlt" wuerde dieses Loch zudecken: Phantomstrecke und
  // Phantomzeit, genau in der Groesse, die die Schwellen ausschliessen.
  //
  // Das Einfrieren bleibt davon unberuehrt: Es schuetzt vor spaeteren
  // SCHWELLEN-Aenderungen im Graubereich, nicht vor Luecken in den Daten.
  if (meter > MAX_SEGMENT_M || meter / sekunden > MAX_TEMPO_MPS) {
    return { urteil: 'sprung' as const, streckeM: 0, zeitS: 0 }
  }
  if (gespeichert === 'gezaehlt') {
    return { urteil: 'gezaehlt' as const, streckeM: meter, zeitS: sekunden }
  }
  return {
    urteil: 'halt' as const,
    streckeM: meter,
    zeitS: Math.min(sekunden, meter / BEWEGUNG_MPS),
  }
}

/**
 * Das Urteil ueber ein einzelnes Segment - ohne die Bilanz fortzuschreiben.
 *
 * Fuer Aufrufer, die das Urteil selbst brauchen: `addPoint` schreibt es je
 * Punkt in die Datenbank, damit eine spaetere Nachrechnung es lesen kann,
 * statt es neu zu erfinden.
 */
export function urteilFuer(vorher: Bilanzpunkt, jetzt: Bilanzpunkt): Urteil {
  const { meter, sekunden } = abstand(vorher, jetzt)
  return segmenturteil(meter, sekunden).urteil
}

/** Eine Bilanz um ein Segment fortschreiben. Unveraendert, gibt eine neue. */
export function bilanzErweitern(
  bisher: Bilanz,
  vorher: Bilanzpunkt,
  jetzt: Bilanzpunkt,
): Bilanz {
  const { meter, sekunden } = abstand(vorher, jetzt)
  const u = beitrag(meter, sekunden, jetzt.urteil ?? null)

  return {
    streckeKm: bisher.streckeKm + u.streckeM / 1000,
    bewegungszeitS: bisher.bewegungszeitS + u.zeitS,
    // Bei einem Sprung ist `u.streckeM` null - die verworfene Strecke ist
    // deshalb der gemessene Abstand, nicht der zugeteilte.
    //
    // Der Deckel ist kein Schoenheitsfehler: Ein Sprung entsteht auch aus
    // unsinnigen Zahlen (NaN, negativ). Sie hier zu addieren wuerde die
    // ganze Bilanz vergiften - und ausgerechnet die Zahl, die dem Menschen
    // gezeigt wird.
    verworfeneStreckeM:
      bisher.verworfeneStreckeM +
      (u.urteil === 'sprung' && Number.isFinite(meter) && meter > 0 ? meter : 0),
    sprungAnzahl: bisher.sprungAnzahl + (u.urteil === 'sprung' ? 1 : 0),
    halteAnzahl: bisher.halteAnzahl + (u.urteil === 'halt' ? 1 : 0),
  }
}

/**
 * Die Bilanz einer ganzen Punktfolge.
 *
 * Weniger als zwei Punkte ergeben kein Segment und damit keine Bilanz -
 * nicht null, sondern eine leere. Ein Lauf mit einem Punkt ist ein Lauf ohne
 * Strecke, nicht ein Lauf ohne Auskunft.
 */
export function laufBilanz(punkte: Bilanzpunkt[]): Bilanz {
  let bilanz = LEERE_BILANZ
  for (let i = 1; i < punkte.length; i++) {
    bilanz = bilanzErweitern(bilanz, punkte[i - 1], punkte[i])
  }
  return bilanz
}
