import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'
import { punktMerken, offenePunkte } from '../lib/punktePuffer'
import { offeneSenden, istUebertragungFaellig } from '../lib/punkteSenden'
import { merkerSetzen, merkerLaufId, merkerLesen, merkerLoeschen, merkerDauerhaftGescheitert } from '../lib/laufMerker'
import { bergungsurteil } from '../lib/sitzungBergen'
import { gesamtzeitS } from '../lib/laufdauer'
import { mitZeitgrenze, SPEICHERN_GRENZE_MS, ZeitgrenzeFehler } from '../lib/zeitgrenze'
import { haengendeLaeufe, kennzahlenAusPunkten } from '../lib/haengenderLauf'
import { istSpeicherwuerdig } from '../lib/speicherwuerdig'
import { istDauerhaft } from '../lib/stoppfehler'
import { haversineKm } from '../lib/geo'
import {
  BEWEGUNG_MPS,
  MAX_LUECKE_S,
  bewegungSchritt,
  MIN_SEGMENT_M,
  NETTO_FENSTER_MS,
  Ruhepegel,
  START_ZUSTAND,
  tempoJetztMps,
  type Bewegungszustand,
  type Ortung,
} from '../lib/bewegung'
import { bilanzErweitern, urteilFuer, LEERE_BILANZ } from '../lib/laufBilanz'
import type { Urteil } from '../lib/segmenturteil'
import { ruhepegelLaden, ruhepegelSichern } from '../lib/ruhepegelSpeicher'
import {
  aufTelefon,
  aufzeichnungPausieren,
  aufzeichnungStarten,
  aufzeichnungStoppen,
  punkteAbholen,
  punkteBestaetigen,
  punkteVerwerfen,
  aufzeichnungStand,
  type AufzeichnungHindernis,
} from '../lib/aufzeichnungBruecke'
import type { Run, RunPoint, RunSplit } from '../types'

// GPS steht nie still. Ein ruhig liegendes Telefon "wandert", und ohne Filter
// zaehlt die App dieses Rauschen als Strecke.
//
// Hier stand einmal, drei Schwellen wuerden das abfangen. Sie taten es nicht:
// Nachgerechnet erzeugte ein stillliegendes Telefon in einer halben Stunde
// 7,3 Kilometer und eine Pace von 4:06 min/km. Eine Mindestdistanz wirkt nur,
// solange sie groesser ist als das Rauschen – die Schwelle zu verdoppeln
// brachte 7133 statt 7306 Metern.
//
// Was traegt, steht in lib/bewegung.ts: die vom Empfaenger gemeldete
// Geschwindigkeit als eigene, unabhaengige Quelle. Die Schwellen hier bleiben
// als zweite Reihe.
//
// Nachzurechnen: scripts/gps_drift_messung.py. Herkunft jeder Zahl:
// docs/gps-genauigkeit.md, Teil 3.

/**
 * Ungenauere Messungen werden ganz verworfen (Meter).
 *
 * Frueher 25. Das war zu streng und half gegen Drift ohnehin nichts: Die
 * Genauigkeitsgrenze war nie das Mittel dagegen. OpenTracks arbeitet mit
 * diesen 50 Metern und filtert Drift ueber Bewegungserkennung und
 * Mindestdistanz – genau wie wir es jetzt tun. Zu streng gestellt wirft die
 * Grenze in enger Bebauung gute Messungen weg und die Strecke wird zu kurz.
 */
/**
 * Bis hierhin zaehlt eine Messung fuer STRECKE und Karte.
 *
 * Darueber wuerde der Weg aus Rauschen bestehen.
 */
export const MAX_ACCURACY_M = 50

/**
 * Bis hierhin wird eine Messung ueberhaupt aufbewahrt.
 *
 * Warum zwei Grenzen statt einer: Ortsgenauigkeit und Tempoguete sind
 * verschiedene Dinge. Ein Punkt mit 55 m Ortsfehler kann ein tadelloses
 * Doppler-Tempo tragen - das Tempo kommt aus der Frequenzverschiebung und
 * nicht aus der Position.
 *
 * Vorher flog ein solcher Punkt ganz weg, und mit ihm sein Tempo. Am
 * 21.08.2026 lagen auf dem Testgeraet rund ein Drittel aller Messungen
 * zwischen 50 und 60 m: Die Anzeige blieb leer und die Spur stand still,
 * obwohl der Empfaenger die ganze Zeit brauchbare Tempi lieferte.
 */
const MAX_ACCURACY_VERLAUF_M = 100

/**
 * Aelter als das darf die juengste Messung nicht sein, damit Tempo und Pace
 * noch angezeigt werden – und so lange darf eine Luecke hoechstens sein,
 * damit sie als Bewegungszeit zaehlt.
 *
 * RunnerUp benutzt genau diese 15 Sekunden (`MAX_CURRENT_AGE`) und zeigt
 * danach nichts mehr an. Eine stehengebliebene Zahl ist schlimmer als ein
 * ehrliches "--:--": Sie sieht aus wie eine Messung.
 */
/** Vorher ist jedes Tempo geraten und wird als "--:--" gezeigt (50 m). */
const MIN_PACE_DISTANCE_KM = 0.05

// Die folgenden drei Regeln stammen aus der ueblichen Praxis von
// Lauf-Aufzeichnern (siehe docs/gps-genauigkeit.md).

/**
 * Aeltere Messungen werden verworfen. Das Geraet liefert manchmal einen
 * zwischengespeicherten Standort von vorhin; bei Laufgeschwindigkeit sind
 * 10 Sekunden bereits rund 40 Meter Fehler.
 */
const MAX_ALTER_MS = 10_000


/**
 * Hoehenmeter erst ab diesem Anstieg zaehlen. Die Hoehe ist die mit Abstand
 * unzuverlaessigste Angabe des GPS – deutlich schlechter als Laenge und
 * Breite. Summiert man jede kleine Schwankung auf, kommt ein Vielfaches des
 * echten Anstiegs heraus: Ein bekannter Fall meldete 1316 statt 630 Metern.
 * Verglichen wird mit der letzten GEZAEHLTEN Hoehe, nicht mit dem letzten
 * Punkt – sonst verschluckt die Schwelle einen langen, flachen Anstieg.
 */
export const MIN_HOEHENSCHRITT_M = 3

/**
 * Ueber so viele Messungen wird die Hoehe gemittelt, bevor die Schwelle
 * greift. Eine Schwelle allein genuegt nicht: Schwankt die Hoehe um mehr als
 * die Schwelle auf und ab – und das tut sie, echtes Rauschen liegt eher bei
 * 5 bis 10 Metern –, dann zaehlt jeder Ausschlag als Anstieg. Gemessen kamen
 * so 36 Hoehenmeter auf platter Strecke zusammen. Erst glaetten, dann
 * vergleichen; so machen es die Fachprojekte auch.
 */
export const HOEHEN_FENSTER = 5

function formatPace(totalSeconds: number, distanceKm: number): string {
  if (distanceKm < MIN_PACE_DISTANCE_KM) return '--:--'
  const paceS = totalSeconds / distanceKm
  const mins = Math.floor(paceS / 60)
  const secs = Math.floor(paceS % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export { formatPace }

/**
 * `abgebrochen` ist neu seit dem 24.08.2026 und der eigentliche Punkt.
 *
 * Vorher gab es keinen Zielzustand fuer "gescheitert und Wiederholen bringt
 * nichts". Jeder Fehlversuch ging zurueck nach `tracking`, die Bergung holte
 * den Lauf beim naechsten Start, scheiterte identisch - eine Schleife ueber
 * Neustarts hinweg, die nur das Loeschen der App-Daten beendete.
 *
 * Gefunden von `improve-codebase-architecture`. Sein Befund war schaerfer als
 * "es fehlt ein Knopf": Die Zustandsmaschine hatte kein Ziel fuer diesen
 * Ausgang, und deshalb war jeder Knopf nur ein Pflaster gewesen.
 */
type TrackingPhase = 'idle' | 'tracking' | 'paused' | 'saving' | 'completed' | 'abgebrochen'

interface LiveStats {
  distanceKm: number
  /**
   * Strecke, die als Ortungssprung verworfen wurde, in Metern.
   *
   * Sie wird gezeigt, damit Verlorenes nicht lautlos verschwindet - das war
   * Befund B5, und Strava setzt fuer denselben Sachverhalt eine sichtbare
   * Warnung.
   *
   * **Sie ist bewusst unvollstaendig:** Strecke, die schon die
   * Bewegungserkennung verwirft, bekommt nie einen Punkt und kann hier nicht
   * gezaehlt werden. Gemessen am 22.08.2026 ist das der groessere Teil
   * (Befund B12). Der Anzeigetext darf deshalb nicht klingen, als sei das
   * alles.
   */
  verworfeneStreckeM: number
  /**
   * Gesamtzeit: von "Start" bis jetzt, mit allem drin.
   *
   * Frueher wurden hier ausdrueckliche Pausen abgezogen. Das war eine dritte
   * Groesse, die niemand gebraucht hat - und sie verschwieg, wie lange man
   * wirklich unterwegs war. Wer um 8 losläuft und um 9 zurueck ist, war eine
   * Stunde weg, auch wenn zwanzig Minuten davon Ampel waren.
   *
   * Die Pausen gehen nicht verloren: Sie stehen als paused_duration_s in der
   * Datenbank, und was davon Bewegung war, steht in bewegungszeitS.
   */
  durationS: number
  /**
   * Zeit, in der die Person tatsaechlich unterwegs war.
   *
   * Der Unterschied zur Laufzeit ist die Ampel, das Schuhebinden, das
   * Gespraech. Strava nennt beides getrennt, und die Pace rechnet sich aus
   * dieser Zahl – sonst wuerde ein Halt an der Ampel den Schnitt des ganzen
   * Laufs verderben.
   */
  bewegungszeitS: number
  paceDisplay: string
  elevationGainM: number
  /** Wird gerade Bewegung erkannt? Steuert die Anzeige. */
  inBewegung: boolean
}

/**
 * Eine rohe Messung, unabhaengig davon, wer sie geliefert hat.
 *
 * Frueher nahm addPoint direkt eine GeolocationPosition des Browsers. Damit
 * war die Quelle in die Schnittstelle eingebaut, und der Dienst haette eine
 * Browserform nachbauen muessen, die er gar nicht kennt.
 */
export interface RohMessung {
  latitude: number
  longitude: number
  altitude_m: number | null
  accuracy_m: number | null
  speed_mps: number | null
  /** Wie sicher sich das Geraet beim Tempo ist, in m/s. */
  tempo_guete_mps?: number | null
  /** Millisekunden seit 1970. */
  zeitMs: number
  /**
   * Kommt die Messung aus dem Puffer des Dienstes statt frisch herein?
   *
   * Der Unterschied entscheidet ueber die Alterspruefung: Eine frische
   * Browser-Messung, die zehn Sekunden alt ist, ist ein zwischengespeicherter
   * Standort von vorhin und wird verworfen. Ein Punkt aus dem Puffer ist
   * zwangslaeufig alt - er wurde ja gerade erst abgeholt - und trotzdem
   * richtig.
   */
  ausPuffer?: boolean
}

interface PointBuffer {
  latitude: number
  longitude: number
  altitude_m: number | null
  accuracy_m: number | null
  speed_mps: number | null
  recorded_at: string
  /**
   * Was dieses Segment beigetragen hat - gefaellt beim Entstehen des Punktes.
   *
   * Wird mitgespeichert, damit eine spaetere Nachrechnung das Urteil LIEST,
   * statt es neu zu erfinden. Genau daraus entstanden B3 und B1: zwei Orte,
   * zwei Antworten.
   *
   * `null` beim allerersten Punkt eines Laufs - er hat keinen Vorgaenger und
   * damit kein Segment.
   */
  urteil: Urteil | null
}

export interface LiveSplit {
  distance_km: number
  duration_s: number
  pace_s_per_km: number
  elevation_gain_m: number | null
}

interface RunState {
  phase: TrackingPhase
  activeRunId: string | null
  liveStats: LiveStats
  points: PointBuffer[]
  /** Laeuft gerade eine Uebertragung? Verhindert, dass sich zwei ueberholen. */
  sendetGerade: boolean
  splits: LiveSplit[]
  /** Zeitpunkt des Knopfdrucks. Die Uhr laeuft davon an, nicht ab dem ersten
   *  GPS-Punkt – sonst steht sie, bis das Telefon einen Fix hat. */
  startedAtMs: number | null
  /** Letzte gezaehlte Hoehe, Bezug fuer MIN_HOEHENSCHRITT_M. */
  elevationRefM: number | null
  /**
   * Kennung dieser Aufzeichnungssitzung – vom Geraet vergeben, nicht von der
   * Datenbank.
   *
   * Getrennt von activeRunId, und das ist Absicht: activeRunId kommt aus
   * Supabase und erst nach einer Netzantwort. Der Dienst muss aber im
   * selben Augenblick starten, in dem der Knopf gedrueckt wird – auch ohne
   * Netz. Also bekommt er eine eigene, sofort verfuegbare Kennung.
   */
  sitzungId: string | null
  /** Wie oft dieser Lauf schon erfolglos gespeichert wurde. */
  stoppversuche: number
  /**
   * Warum der Hintergrunddienst nicht laeuft, oder null wenn alles gut ist.
   *
   * 'kein-telefon' heisst: Wir sind im Browser. Das ist kein Fehler, sondern
   * die Entwicklungsumgebung - die Web-App wird nicht mehr angeboten.
   */
  dienstHindernis: AufzeichnungHindernis | 'kein-telefon' | null
  /** Laeuft die Person gerade, oder steht sie? Siehe lib/bewegung.ts. */
  bewegung: Bewegungszustand
  /**
   * Was meldet dieses Geraet im Stand als Tempo? Wird waehrend erkannter
   * Ruhe selbst gemessen, statt geraten – der Restfehler ist
   * geraeteabhaengig und schwankt um den Faktor zehn.
   */
  ruhepegel: Ruhepegel
  /**
   * Kurzes Fenster aller brauchbaren Messungen, auch der nicht
   * aufgezeichneten.
   *
   * Getrennt von `points`: Dort steht die Strecke, hier stehen die letzten
   * Sekunden Funkverkehr. Die Bewegungserkennung braucht auch die Messungen,
   * die keine Strecke ergeben haben – gerade die verraten den Stillstand.
   */
  ortungsverlauf: Ortung[]
  /**
   * Die zuletzt gueltige Bewegungsschwelle in m/s.
   *
   * Sie entsteht in bewegungSchritt und wird hier abgelegt, damit die
   * Anzeige sie NICHT ein zweites Mal berechnet. Genau diese zweite
   * Berechnung war die Luecke aus dem Architekturbericht vom 21.08.2026.
   */
  tor: number
  /**
   * Genauigkeit der zuletzt eingegangenen Messung in Metern – auch wenn sie
   * verworfen wurde. Genau dann ist die Angabe naemlich interessant: Sie
   * zeigt, ob das Signal gerade schlecht ist. Vorbild ist der Ring um die
   * eigene Position bei Strava; je kleiner, desto besser.
   */
  lastAccuracyM: number | null
  pauseStart: number | null
  totalPausedMs: number
  /** Wann zuletzt uebertragen wurde. Null heisst: noch nie in diesem Lauf. */
  letzteUebertragungMs: number | null

  recentRuns: Run[]
  selectedRun: Run | null
  selectedRunSplits: RunSplit[]
  selectedRunPoints: RunPoint[]
  /**
   * Woran die letzte Uebertragung scheiterte, oder warum die Strecke nicht
   * geladen werden konnte - in Worten, fuer den Bildschirm.
   *
   * Bis zum 22.08.2026 gab es dieses Feld nicht, und beide Fehler wurden
   * verschluckt. Eine leere Karte sagte "Keine GPS-Daten", obwohl die Punkte
   * auf dem Geraet lagen und die Uebertragung seit Wochen scheiterte.
   */
  punkteFehler: string | null
  /** Wie viele Punkte noch auf dem Geraet liegen. */
  punkteOffen: number
  loading: boolean

  /**
   * Warum das letzte Laden von Laeufen scheiterte - oder `null`.
   *
   * Ohne dieses Feld sind zwei Lagen nicht unterscheidbar, und beide sehen
   * harmlos aus: `selectedRun: null` heisst dann entweder "wird geladen"
   * (Dauerspinner) oder "gibt es nicht"; `recentRuns: []` heisst entweder
   * "noch nie gelaufen" oder "Abfrage gescheitert".
   *
   * EIN Feld fuer beide Ladewege, bewusst: Beides heisst "die Laufdaten
   * kamen nicht an", und jede Seite ruft ihr eigenes Laden beim Oeffnen
   * neu auf - ein Erfolg raeumt den Fehler weg.
   */
  ladefehler: string | null

  startRun: () => void
  /** Schickt die gepufferten Punkte. Takt und Laufende rufen es auf. */
  punkteUebertragen: () => Promise<void>
  pauseRun: () => void
  resumeRun: () => void
  /** Speichert den Lauf. runId bleibt null, wenn zu wenig zusammenkam. */
  stopRun: () => Promise<Stoppergebnis>
  discardRun: () => void
  /**
   * Eine Messung aufnehmen - gleich, woher sie kommt.
   *
   * Es gibt zwei Quellen: den Hintergrunddienst auf dem Telefon und
   * navigator.geolocation im Browser. Beide fragen denselben Empfaenger.
   * Zaehlten beide, staende am Ende die doppelte Strecke - deshalb ist immer
   * nur eine aktiv, und beide reichen dieselbe Form herein.
   */
  addPoint: (messung: RohMessung) => void
  /**
   * Holt beim Dienst ab, was sich angesammelt hat, und schickt es durch die
   * Bewegungserkennung. Bestaetigt erst danach - so kostet ein Absturz
   * dazwischen keinen Punkt.
   */
  punkteEinsammeln: () => Promise<number>
  /**
   * Beim Start nachsehen, ob eine Aufzeichnung ohne Besitzer dasteht.
   *
   * Gibt zurueck, was gefunden wurde - oder null, wenn nichts war.
   */
  verwaisteAufzeichnungBergen: () => Promise<Bergungsergebnis | null>
  /**
   * Laeufe abschliessen, die beim Speichern haengengeblieben sind.
   *
   * @returns Wie viele Laeufe abgeschlossen wurden.
   */
  haengendeLaeufeAbschliessen: () => Promise<number>
  tick: () => void

  /**
   * Loescht alle eigenen Laeufe. Punkte und Abschnitte gehen per Kaskade mit.
   * Gibt die Anzahl zurueck, damit die Seite sagen kann, was passiert ist.
   */
  deleteAllRuns: () => Promise<{ anzahl: number; error: string | null }>
  fetchRecentRuns: (limit?: number) => Promise<void>
  fetchRun: (id: string) => Promise<void>
  fetchRunSplits: (runId: string) => Promise<void>
  fetchRunPoints: (runId: string) => Promise<void>
  reset: () => void
}

/**
 * Woran das Beenden gescheitert ist - als KATEGORIE, nicht als Text.
 *
 * Warum das kein blosser String mehr ist
 * --------------------------------------
 * `stopRun` gab den Rohtext zurueck: `error.message` von PostgREST,
 * `String(grund)`. Die Laufseite musste ihn deshalb auf einen einzigen Satz
 * einebnen - sonst haette jemand "PGRST116" oder "JWT expired" gelesen, was
 * `lib/melden.ts` zu Recht verbietet ("Nie eine Datenbankmeldung").
 *
 * Dabei gingen zwei Faelle verloren, die verschiedene Saetze verdienen:
 * "nicht angemeldet" heisst sich neu anmelden, eine Zeitgrenze heisst gleich
 * noch einmal probieren. Sie am WORTLAUT zu unterscheiden verbietet
 * `lib/supabaseFehler.ts` ebenfalls zu Recht - Fehlertexte sind kein Vertrag.
 *
 * Also nennt der Store die Kategorie und reicht den Rohtext getrennt weiter,
 * fuer die Konsole. Vorgeschlagen vom Agenten `oberflaeche`, 24.08.2026.
 */
export type Stoppfehler = 'zeitgrenze' | 'nicht-angemeldet' | 'ablage'

export interface Stoppergebnis {
  runId: string | null
  /** Der technische Grund - fuer die Konsole, NIE fuer den Bildschirm. */
  error: string | null
  /** Woran es lag. Null heisst: es hat geklappt. */
  art: Stoppfehler | null
}

/**
 * Was beim Bergen einer unterbrochenen Aufzeichnung herauskam.
 *
 * Vier Ausgaenge, weil vier verschiedene Dinge passieren koennen - und der
 * Aufrufer sie unterscheiden koennen muss, um nichts Falsches zu behaupten.
 */
export interface Bergungsergebnis {
  ergebnis: 'fortgesetzt' | 'gespeichert' | 'zu-kurz' | 'ungespeichert' | 'abgebrochen'
  /** Wie viele Messpunkte geborgen wurden. */
  punkte: number
}

const INITIAL_LIVE: LiveStats = {
  distanceKm: 0,
  verworfeneStreckeM: 0,
  durationS: 0,
  bewegungszeitS: 0,
  paceDisplay: '--:--',
  elevationGainM: 0,
  inBewegung: false,
}



/**
 * Einen Speicherversuch abbrechen und die Aufzeichnung WIRKLICH fortsetzen.
 *
 * Warum das mehr ist als `set({ phase: 'tracking' })`
 * ---------------------------------------------------
 * `stopRun` beendet als Allererstes den Vordergrunddienst (`aufzeichnungStoppen`,
 * unbedingt und vor jeder Pruefung - Googles Auflage). Bricht das Speichern
 * danach ab, stand hier nur `phase: 'tracking'` - und der Kommentar dazu
 * behauptete, der Aufzeichnungs-Effekt starte die Ortung von selbst wieder.
 *
 * **Das gilt nur im Browser.** Nachgesehen am 23.08.2026:
 * - `LiveTracking.tsx` startet `watchPosition` ausschliesslich unter
 *   `!aufTelefon()`.
 * - `aufzeichnungStarten` hat im Produktivcode GENAU EINE Aufrufstelle:
 *   `startRun`. Und `startRun` steigt bei `phase === 'tracking'` aus - die
 *   Wache steht seit dem 24.08.2026 in `startRun` selbst. Vorher stand sie
 *   nur beim Aufrufer, und dieser Satz hier behauptete trotzdem, sie sei
 *   eine Eigenschaft der Funktion.
 *
 * Auf dem Telefon - der einzigen unterstuetzten Plattform - blieb der Dienst
 * also gestoppt, waehrend Uhr und Abholtakt weiterliefen und die Kopfzeile
 * "Lauf laeuft" sagte. Wer im Funkloch stoppt, laeuft danach still ins
 * Nichts: Beim zweiten Stopp steht die volle Wanduhr gegen die halbe
 * Strecke.
 *
 * Gefunden vom Agenten `pruefung`. Die falsche Begruendung stammte von mir -
 * ich hatte sie uebernommen, statt sie nachzusehen.
 */
async function abbruchUndWeiterAufzeichnen(
  set: (teil: Partial<RunState>) => void,
  sitzungId: string | null,
  zurueckZu: 'tracking' | 'paused' | 'abgebrochen' = 'tracking',
) {
  // Dauerhaft gescheitert: NICHT zurueck in die Aufzeichnung.
  //
  // Der Dienst bleibt gestoppt, die Marke ueberlebt den Neustart, und die
  // Bergung fragt beim naechsten Mal den Menschen statt es blind zu
  // wiederholen. Die Punkte bleiben liegen.
  if (zurueckZu === 'abgebrochen') {
    set({ phase: 'abgebrochen' })
    merkerDauerhaftGescheitert()
    return
  }
  // Zurueck in DEN Zustand, aus dem gestoppt wurde - nicht pauschal in
  // 'tracking'.
  //
  // "Beenden" aus der Pause heraus ist ein regulaerer Weg; der Stopp-Knopf
  // steht in beiden Phasen. Wer pausiert hatte und dessen Speichern
  // abbricht, landete vorher in 'tracking' mit einem `pauseStart`, den
  // weder pauseRun noch resumeRun je erzeugen koennen:
  //
  //   resumeRun steigt aus (phase !== 'paused') - die Pause ist nicht mehr
  //     zu beenden, weil die App sie schon beendet hat.
  //   pauseRun ueberschreibt `pauseStart` - die erste Pause faellt ersatzlos
  //     aus paused_duration_s heraus.
  //   Tut der Mensch nichts, zaehlt der naechste Stopp die ganze Zeit seit
  //     dem Pausenbeginn als Pause, obwohl er laengst weiterlief.
  //
  // Beide Vorzeichen falsch, je nach Verhalten. Gefunden vom Agenten
  // `pruefung`, 24.08.2026.
  set({ phase: zurueckZu })
  if (!aufTelefon() || !sitzungId) return
  // Dieselbe Sitzung: Der Dienst nimmt seinen Puffer wieder auf, und die
  // schon bestaetigten Punkte kommen nicht doppelt.
  const hindernis = await aufzeichnungStarten(sitzungId)
  set({ dienstHindernis: hindernis })
}

/**
 * Der Grundzustand einer Aufzeichnung - alles, was zu EINEM Lauf gehoert.
 *
 * Warum als Funktion und nicht als Konstante: Sie enthaelt veraenderliche
 * Objekte (`liveStats`, Listen). Eine geteilte Konstante waere ein
 * gemeinsamer Zustand zwischen zwei Laeufen.
 *
 * Warum es sie gibt
 * -----------------
 * Diese Felder wurden an **vier** Stellen von Hand zusammengesetzt:
 * `startRun`, `discardRun`, `reset` und - seit dem 23.08.2026 -
 * `verwaisteAufzeichnungBergen`. Die vierte war beim Bauen sofort
 * abgewichen: `elevationRefM` und `splits` fehlten darin. Ein
 * fortgesetzter Lauf startete damit mit der Hoehenreferenz und den
 * Kilometer-Abschnitten des vorigen.
 *
 * Gefunden hat das ein Architektur-Lauf, keine halbe Stunde nachdem die
 * Kopie entstanden war. Vier von Hand gepflegte Kopien laufen auseinander -
 * die Frage ist nur, wann.
 *
 * Was hier ausdruecklich NICHT drinsteht
 * --------------------------------------
 * Der Ruhepegel. Er beschreibt das **Geraet**, nicht den Lauf, und wird
 * ueber viele Laeufe hinweg besser. Ihn zurueckzusetzen hiesse, bei jedem
 * Start wieder von vorn zu messen.
 *
 * Ebenso wenig `phase`, `sitzungId`, `activeRunId` und `startedAtMs`: Die
 * unterscheiden die vier Aufrufer voneinander und gehoeren deshalb an die
 * Aufrufstelle, nicht hierher.
 */
function grundzustand() {
  return {
    liveStats: { ...INITIAL_LIVE },
    points: [],
    splits: [],
    elevationRefM: null,
    bewegung: START_ZUSTAND,
    ortungsverlauf: [],
    tor: BEWEGUNG_MPS,
    lastAccuracyM: null,
    pauseStart: null,
    totalPausedMs: 0,
    letzteUebertragungMs: null,
  }
}

/**
 * So viele Punkte holt die Nachbergung hoechstens je Lauf.
 *
 * Muss zu `max_rows` in `myprosole_app/supabase/config.toml` passen (dort
 * 1000). Wird sie erreicht, ist die Liste moeglicherweise abgeschnitten -
 * und dann wird gar nicht gerechnet.
 *
 * ACHTUNG, und das ist eine Luecke, keine Zusicherung: `config.toml` ist die
 * Konfiguration der LOKALEN Entwicklungsumgebung (project_id, Port 54321).
 * Der Wert der Produktion steht im Supabase-Dashboard und ist hier nicht
 * versioniert. Faellt er dort je auf 500, ist dieser Deckel unbemerkt falsch
 * und die Pruefung `rohe.length >= MAX_PUNKTE_JE_BERGUNG` greift nie - genau
 * das Szenario, gegen das sie geschrieben ist. Wer den Wert im Dashboard
 * aendert, muss ihn hier nachziehen; es gibt nichts, was daran erinnert.
 */
const MAX_PUNKTE_JE_BERGUNG = 1000

export const useRun = create<RunState>((set, get) => ({
  phase: 'idle',
  activeRunId: null,
  liveStats: { ...INITIAL_LIVE },
  letzteUebertragungMs: null,
  points: [],
  sendetGerade: false,
  splits: [],
  startedAtMs: null,
  sitzungId: null,
  stoppversuche: 0,
  dienstHindernis: null,
  elevationRefM: null,
  bewegung: START_ZUSTAND,
  ruhepegel: ruhepegelLaden(),
  ortungsverlauf: [],
  tor: BEWEGUNG_MPS,
  lastAccuracyM: null,
  pauseStart: null,
  totalPausedMs: 0,

  recentRuns: [],
  selectedRun: null,
  selectedRunSplits: [],
  selectedRunPoints: [],
  punkteFehler: null,
  punkteOffen: 0,
  loading: false,
  ladefehler: null,

  // Der Lauf laeuft zunaechst nur im Geraet. Geschrieben wird erst beim
  // Beenden (siehe stopRun) – so entsteht kein Eintrag, nur weil jemand den
  // Bildschirm geoeffnet hat.
  startRun: () => {
    // Die Wache gehoert HIERHER, nicht nur zum Aufrufer.
    //
    // `startRun` setzt `...grundzustand()` - Punkte, Abschnitte,
    // Sitzungskennung, alles auf Anfang. Laeuft es waehrend eines
    // Speichervorgangs, sind die Puffer leer, bevor `stopRun` sie liest.
    //
    // Geschuetzt hat das bisher allein `if (phase === 'idle')` in
    // `LiveTracking.tsx` - beim AUFRUFER. Ein zweiter Aufrufer, ein
    // Doppeltipp oder eine gleichzeitig laufende Bergung haetten die Wache
    // nicht gehabt.
    //
    // Und es stand falsch im Quelltext: Der Kopf von
    // `abbruchUndWeiterAufzeichnen` behauptete "startRun laeuft nur bei
    // phase === 'idle'". Das ist eine Aussage ueber den Aufrufer, die als
    // Eigenschaft der Funktion aufgeschrieben war. Gefunden von einem Lauf
    // von `improve-codebase-architecture` am 24.08.2026, indem der Kommentar
    // gegen den Code geprueft wurde statt geglaubt.
    //
    // 'completed' darf starten: Nach einem gespeicherten Lauf ist der
    // naechste erlaubt. 'tracking', 'paused' und 'saving' nicht.
    const jetzige = get().phase
    if (jetzige !== 'idle' && jetzige !== 'completed') return

    // Eigene Kennung, sofort und ohne Netz. Der Dienst braucht sie in dem
    // Augenblick, in dem der Knopf gedrueckt wird - auf die Antwort aus der
    // Datenbank zu warten hiesse, die ersten Sekunden zu verlieren.
    const sitzungId = crypto.randomUUID()
    // Sofort merken, noch vor dem Dienst und vor der Datenbank: Was hier
    // nicht steht, ist nach einem Abschuss der App nicht mehr auffindbar.
    merkerSetzen(sitzungId, null)
    set({
      ...grundzustand(),
      phase: 'tracking',
      activeRunId: null,
      startedAtMs: Date.now(),
      sitzungId,
      stoppversuche: 0,
    })

    // Den Dienst anstossen. Er haelt die Aufzeichnung am Leben, wenn der
    // Bildschirm ausgeht oder jemand zu einer anderen App wechselt.
    //
    // Hier und nicht frueher: Android erlaubt den Start eines
    // Standortdienstes nur aus einer sichtbaren App heraus, ausgeloest durch
    // eine Handlung des Nutzers. Genau das ist der Druck auf "Lauf starten".
    //
    // Scheitert es, laeuft die Aufzeichnung trotzdem weiter - im Vordergrund
    // ueber die Seite. Die Oberflaeche sagt es dann; ein Lauf soll daran
    // nicht scheitern.
    aufzeichnungStarten(sitzungId).then((hindernis) => {
      set({ dienstHindernis: hindernis })
    })

    // Die Zeile entsteht sofort, nicht erst am Ende. Nur so koennen die
    // Punkte waehrend des Laufs geschrieben werden – vorher gab es nichts,
    // woran sie haengen konnten, und ein leerer Akku kostete den ganzen
    // Lauf. Der Status 'tracking' war dafuer von Anfang an vorgesehen.
    //
    // Scheitert es (kein Netz), laeuft die Aufzeichnung trotzdem: Die
    // Punkte sammeln sich auf dem Geraet, und am Ende wird die Zeile
    // nachgeholt.
    const userId = eigeneKennung()
    if (!userId) return
    supabase
      .from('runs')
      .insert({ user_id: userId, status: 'tracking' as const, started_at: new Date().toISOString() })
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) {
          const id = (data as { id: string }).id
          set({ activeRunId: id })
          // Ab hier ist der Lauf auch nach einem Absturz auffindbar.
          merkerLaufId(id)
        }
      })
  },

  pauseRun: () => {
    if (get().phase !== 'tracking') return
    // Auch dem Dienst sagen: Sonst orten wir waehrend der Pause weiter und
    // fuellen die Datenbank mit Punkten, die niemand haben will.
    aufzeichnungPausieren(true)
    set({ phase: 'paused', pauseStart: Date.now() })
  },

  resumeRun: () => {
    aufzeichnungPausieren(false)
    const { phase, pauseStart, totalPausedMs } = get()
    if (phase !== 'paused') return
    const extra = pauseStart ? Date.now() - pauseStart : 0
    set({
      phase: 'tracking',
      pauseStart: null,
      totalPausedMs: totalPausedMs + extra,
    })
  },

  stopRun: async () => {
    // Aus 'abgebrochen' heraus zuerst zurueck in die Aufzeichnung.
    //
    // Sonst verliert der Wiederholversuch Punkte: `punkteEinsammeln` reicht
    // sie an `addPoint`, und das steigt bei `phase !== 'tracking'` aus -
    // danach loescht `punkteBestaetigen` beim Dienst genau die Punkte, die
    // nie angekommen sind. Der Satz auf dem Bildschirm ("deine Strecke liegt
    // weiter auf dem Geraet") waere damit falsch geworden, ausgeloest vom
    // Knopf darunter.
    //
    // Gefunden vom Agenten `oberflaeche`, 24.08.2026.
    const kamAusAbbruch = get().phase === 'abgebrochen'
    if (kamAusAbbruch) set({ phase: 'tracking' })

    // Der Zustand VOR dem Stopp - dorthin geht es bei einem WIEDERHOLBAREN
    // Abbruch zurueck. Wer aus 'abgebrochen' kam, geht auch dorthin zurueck:
    // Ein beendeter Lauf soll nicht wieder aufleben und die Wartezeit
    // mitzaehlen.
    const phaseVorher: 'tracking' | 'paused' | 'abgebrochen' = kamAusAbbruch
      ? 'abgebrochen'
      : get().phase === 'paused'
        ? 'paused'
        : 'tracking'

    /**
     * Wohin nach einem Fehlversuch: zurueck in die Aufzeichnung, oder in den
     * Zielzustand `abgebrochen`?
     *
     * Zaehlt zugleich mit. Der Zaehler ist nur der Rueckfall fuer
     * Fehlerformen ohne verwertbaren Code - wo ein Code da ist, entscheidet
     * er sofort. Siehe lib/stoppfehler.ts.
     */
    const zurueck = (art: Stoppfehler, code?: string) => {
      const versuche = get().stoppversuche + 1
      set({ stoppversuche: versuche })
      return istDauerhaft(art, code, versuche) ? ('abgebrochen' as const) : phaseVorher
    }

    // Das Fangnetz haelt das Versprechen dieser Signatur.
    //
    // `stopRun` gibt `{ runId, error }` zurueck - der Vertrag lautet also:
    // Fehler kommen als WERT zurueck, nicht als Ausnahme. Drei Stellen im
    // Rumpf hielten sich nicht daran und konnten werfen:
    //
    //   aufzeichnungStoppen()      die Bruecke zum Geraet
    //   punkteEinsammeln()         `addPoint` in der Schleife
    //   computeSplits(points)      rein rechnend, aber ungeschuetzt
    //
    // Seit heute Abend waere die Folge schlimmer als vorher: Die Laufseite
    // ersetzt die Knopfreihe waehrend des Speicherns durch einen
    // Fortschrittsbalken. Warf eine dieser Stellen, kaeme der Merker nie
    // zurueck - kein Stopp, keine Pause, kein zweiter Versuch. Vorher blieben
    // in derselben Lage drei bedienbare Knoepfe stehen.
    //
    // Warum das Netz HIER haengt und nicht in der Oberflaeche: `computeSplits`
    // laeuft NACH `set({ phase: 'saving' })`, und die Seite richtet sich auch
    // nach `phase`. Ein `try/finally` dort koennte den eigenen Merker
    // zuruecksetzen und saehe trotzdem weiter "wird gespeichert". Nur von hier
    // aus ist `abbruchUndWeiterAufzeichnen` erreichbar - und die Aufzeichnung
    // fortzusetzen ist der eigentliche Punkt, nicht das Aufraeumen eines
    // Merkers.
    //
    // Gefunden vom Agenten `pruefung`, praezisiert vom Agenten `oberflaeche`:
    // Der Pruefagent zaehlte zwei ungesicherte Stellen, es sind drei.
    try {
      const { totalPausedMs, pauseStart, startedAtMs } = get()

      // Der Dienst endet ZUERST und in jedem Fall.
      //
      // Das ist keine Aufraeumarbeit, sondern Bedingung: Googles Ausnahme fuer
      // nutzergestartete Vordergrunddienste verlangt, dass der Dienst
      // "immediately after the application completes the intended use case"
      // endet. Laeuft er weiter, gilt der Standortzugriff als gleichwertig mit
      // ACCESS_BACKGROUND_LOCATION - und dann braeuchte die App Googles
      // aufwendiges Sonderverfahren.
      //
      // Vor der Laengenpruefung, damit auch ein zu kurzer Lauf ihn beendet.
      await aufzeichnungStoppen()

      // ZUERST einsammeln, dann rechnen. Der Dienst hat waehrend des Schlafs
      // weitergesammelt; ohne das fehlte genau die Strecke, um derentwillen es
      // ihn gibt.
      //
      // Nach dem Stoppen, damit nichts mehr nachkommt, waehrend wir abholen.
      await get().punkteEinsammeln()
      const { points, liveStats } = get()

      // Die Dauer kommt aus der Startzeit, NICHT aus liveStats.durationS.
      //
      // Jene Zahl entsteht im Anzeigetakt, und der laeuft nur, solange die
      // Laufseite montiert ist. Auf dem Bergungsweg ist sie das nie - dort
      // stand sie auf 0, der Waechter unten griff und jeder geborgene Lauf
      // wurde verworfen. Siehe lib/laufdauer.ts.
      const dauerS = gesamtzeitS(startedAtMs, Date.now())

      // Zu kurz oder ohne Strecke: nichts speichern. Der Verlauf bleibt sauber,
      // und niemand findet Laeufe, die er nie gemacht hat.
      if (!istSpeicherwuerdig(liveStats.distanceKm, dauerS)) {
        get().discardRun()
        return { runId: null, error: null, art: null }
      }

      set({ phase: 'saving' })

      // Ab hier mit Zeitgrenze. Am 23.08.2026 blieb genau hier ein Lauf
      // haengen: Dienst gestoppt, Punkte eingesammelt und uebertragen - und
      // dann nichts mehr, weil der Supabase-Client keine Vorgabe-Zeitgrenze
      // hat. Der Bildschirm sagte weiter "Lauf laeuft".
      //
      // Was bei Ablauf passiert, ist Absicht: zurueck in die Aufzeichnung,
      // Fehler nach oben. Damit bleibt der Merker liegen, und der naechste
      // Start holt den Lauf ab. Ein sauberer Abbruch ist wiederholbar, ein
      // stilles Warten nicht.
      //
      // "Zurueck in die Aufzeichnung" heisst auf dem Telefon: den Dienst
      // wieder anwerfen. Siehe abbruchUndWeiterAufzeichnen - eine Zeile
      // `phase: 'tracking'` reicht dort NICHT.
      let user: { id: string } | null = null
      try {
        const antwort = await mitZeitgrenze(
          supabase.auth.getUser(),
          SPEICHERN_GRENZE_MS,
          'Die Anmeldung pruefen',
        )
        user = antwort.data.user
      } catch (grund) {
        await abbruchUndWeiterAufzeichnen(set, get().sitzungId, zurueck(grund instanceof ZeitgrenzeFehler ? 'zeitgrenze' : 'ablage'))
        return {
          runId: null,
          error: grund instanceof ZeitgrenzeFehler ? grund.message : String(grund),
          art: grund instanceof ZeitgrenzeFehler ? 'zeitgrenze' : 'ablage',
        }
      }
      if (!user) {
        await abbruchUndWeiterAufzeichnen(set, get().sitzungId, zurueck('nicht-angemeldet'))
        return { runId: null, error: 'Nicht angemeldet', art: 'nicht-angemeldet' }
      }

      let finalPausedMs = totalPausedMs
      if (pauseStart) finalPausedMs += Date.now() - pauseStart

      const splits = computeSplits(points)
      // Der Knopfdruck ist der Start, nicht der erste GPS-Punkt – sonst waere
      // die gespeicherte Startzeit spaeter als die gemessene Laufzeit.
      const startedAt = new Date(startedAtMs ?? Date.now()).toISOString()

      const kennzahlen = {
        status: 'completed' as const,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        paused_duration_s: Math.round(finalPausedMs / 1000),
        distance_km: Math.round(liveStats.distanceKm * 1000) / 1000,
        duration_s: dauerS,
        // Beide getrennt, wie bei Strava: Die Laufzeit ist, was die Uhr sagt;
        // die Bewegungszeit, was davon unterwegs verbracht wurde.
        moving_time_s: Math.round(liveStats.bewegungszeitS),
        // Der Schnitt rechnet sich aus der Bewegungszeit - sonst faelscht ein
        // Halt an der Ampel die Pace des ganzen Laufs. Faellt die
        // Bewegungszeit aus irgendeinem Grund auf null, greift die Laufzeit,
        // damit hier keine Division durch null steht.
        avg_pace_s_per_km: Math.round(
          (liveStats.bewegungszeitS || dauerS) / liveStats.distanceKm,
        ),
        elevation_gain_m: Math.round(liveStats.elevationGainM * 10) / 10,
      }

      // Die Zeile gibt es meist schon – sie entsteht beim Start, damit die
      // Punkte waehrend des Laufs irgendwo hinkoennen. Hier bekommt sie ihre
      // Kennzahlen und den Status.
      //
      // Fehlt sie (kein Netz beim Start), wird sie jetzt angelegt. Die
      // gepufferten Punkte tragen dann noch keine Laufkennung; sie gehen
      // gleich unten mit der richtigen raus.
      const vorhandeneId = get().activeRunId

      // Eine Kennung, die einen Abbruch UND den Tod der App ueberlebt.
      //
      // `mitZeitgrenze` bricht den Vorgang ausdruecklich NICHT ab - er laeuft
      // weiter und kann noch ankommen. Fuer ein `update` ist das harmlos; fuer
      // ein `insert` war es das nicht:
      //
      //   Kein Netz beim Start  ->  keine Lauf-Zeile  ->  vorhandeneId === null
      //   Beenden -> insert laeuft in die Zeitgrenze -> phase zurueck
      //   Die Anfrage kommt kurz danach doch an  ->  Zeile 1 entsteht
      //   Mensch tippt nochmal auf Beenden -> vorhandeneId IMMER NOCH null
      //   -> zweiter insert -> ZWEI gleiche Laeufe im Verlauf
      //
      // Die erste Behebung merkte sich dafuer eine frisch erzeugte UUID im
      // ZUSTAND. Der liegt im Arbeitsspeicher und ist weg, sobald Android die
      // App abschiesst - und genau dieser Fall ist auf Android der
      // wahrscheinlichere; die ganze Bergungsmaschinerie existiert
      // seinetwegen. Nach dem Neustart entstand eine zweite UUID, und der
      // Doppel-Lauf war wieder moeglich. Gefunden vom Agenten `pruefung`,
      // 24.08.2026.
      //
      // Jetzt traegt die SITZUNGSKENNUNG die Last. Sie ist schon eine UUID,
      // sie gehoert zu genau einer Aufzeichnung, und sie liegt im Merker
      // (localStorage) - also ueberlebt sie den Neustart und wird von
      // `verwaisteAufzeichnungBergen` in den Zustand zurueckgelegt. Derselbe
      // Lauf erzeugt damit immer dieselbe Kennung, ohne ein zweites Feld, das
      // an vier Stellen mitgepflegt werden muesste.
      const neueId = vorhandeneId ? null : (get().sitzungId ?? crypto.randomUUID())

      let data: unknown = null
      let error: { message: string; code?: string } | null = null
      try {
        const antwort = await mitZeitgrenze(
          vorhandeneId
            ? // `.eq('status', 'tracking')` aus demselben Grund wie in der
              // Nachbergung: Der abgebrochene erste Schreibvorgang laeuft
              // weiter und kann NACH dem zweiten landen - mit der aelteren,
              // kuerzeren Dauer. Ist die Zeile dann schon 'completed', trifft
              // er nichts mehr. Die Datenbank entscheidet, nicht die Uhr.
              supabase
                .from('runs')
                .update(kennzahlen)
                .eq('id', vorhandeneId)
                .eq('status', 'tracking')
                .select()
                .single()
            : supabase
                .from('runs')
                .upsert({ id: neueId, user_id: user.id, ...kennzahlen })
                .select()
                .single(),
          SPEICHERN_GRENZE_MS,
          'Den Lauf speichern',
        )
        data = antwort.data
        error = antwort.error
      } catch (grund) {
        await abbruchUndWeiterAufzeichnen(set, get().sitzungId, zurueck(grund instanceof ZeitgrenzeFehler ? 'zeitgrenze' : 'ablage'))
        return {
          runId: null,
          error: grund instanceof ZeitgrenzeFehler ? grund.message : String(grund),
          art: grund instanceof ZeitgrenzeFehler ? 'zeitgrenze' : 'ablage',
        }
      }

      // "Keine Zeile getroffen" heisst hier: schon fertig. Nicht: kaputt.
      //
      // Ohne diese Unterscheidung sperrte die Wache oben den Lauf DAUERHAFT
      // ein, und zwar so:
      //
      //   Stopp -> Zeitgrenze -> zurueck in die Aufzeichnung
      //   Die erste Anfrage kommt Sekunden spaeter doch an: Zeile 'completed'
      //   Mensch tippt erneut Stopp -> .eq('status','tracking') trifft
      //   0 Zeilen -> PGRST116 -> "Fehler" -> zurueck in die Aufzeichnung
      //   ... und das bei JEDEM weiteren Versuch, auch nach einem Neustart,
      //   weil die Bergung denselben Weg nimmt.
      //
      // Es gab keinen Ausweg: `discardRun` hat im Produktivcode genau eine
      // Aufrufstelle, den Zu-kurz-Zweig weiter oben. Der Lauf war laengst
      // vollstaendig gespeichert, und der Bildschirm behauptete trotzdem, er
      // laufe noch - mit einer rohen PostgREST-Meldung darunter.
      //
      // Gefunden vom Agenten `pruefung` am 24.08.2026, bevor es jemanden
      // getroffen hat. Die Wache selbst bleibt richtig; ihr fehlte nur die
      // Antwort auf die Frage, WARUM sie nichts getroffen hat.
      if (vorhandeneId && error?.code === 'PGRST116') {
        const { data: schon } = await supabase
          .from('runs')
          .select('*')
          .eq('id', vorhandeneId)
          .eq('status', 'completed')
          .maybeSingle()
          .then((a) => a, () => ({ data: null }))
        if (schon) {
          data = schon
          error = null
        }
      }

      if (error || !data) {
        // Hier IST der Fehlercode da - und er entscheidet sofort. Eine
        // Rechteverletzung (42501) oder ein Constraint (23xxx) wird durch
        // Wiederholen nicht besser.
        await abbruchUndWeiterAufzeichnen(set, get().sitzungId, zurueck('ablage', error?.code))
        return {
          runId: null,
          error: error?.message ?? 'Lauf konnte nicht gespeichert werden',
          art: 'ablage',
        }
      }

      const runId = (data as Run).id

      // Der Rest aus dem Puffer. Das meiste ist waehrend des Laufs schon
      // uebertragen worden – hier bleiben nur die letzten Sekunden.
      //
      // Falls beim Start kein Netz war und die Lauf-Zeile erst jetzt entstand,
      // haben die gepufferten Punkte eine andere Kennung: Sie werden auf die
      // richtige umgeschrieben, bevor sie rausgehen.
      // In einem Fangnetz, und zwar wegen dessen, was DANACH kommt: Wirft
      // hier etwas (IndexedDB gesperrt, Speicher voll), liefen sonst weder
      // der Abschnitts-Insert noch merkerLoeschen noch der Wechsel auf
      // 'completed' - der Lauf stuende in der Datenbank als fertig, die App
      // hinge auf 'saving', und der Merker blieb liegen. Die Punkte selbst
      // sind nicht verloren: Sie liegen im Geraetepuffer, und der naechste
      // Takt versucht es erneut.
      try {
        if (!vorhandeneId) {
          const liegend = await offenePunkte()
          for (const punkt of liegend) {
            if (punkt.run_id !== runId) await punktMerken({ ...punkt, run_id: runId })
          }
        }
        const abschluss = await offeneSenden()
        set({ punkteFehler: abschluss.fehler, punkteOffen: abschluss.offen })
      } catch (grund) {
        set({ punkteFehler: grund instanceof Error ? grund.message : String(grund) })
      }

      let abschnittsfehler: string | null = null
      if (splits.length > 0) {
        // Mit Zeitgrenze und ohne Abbruch: Die Lauf-Zeile steht schon, der
        // Lauf ist gerettet. Fehlende Abschnitte sind ein Schoenheitsfehler,
        // kein Grund, den Abschluss zu verhindern - genau daran hing der
        // Fall vom 23.08.
        //
        // Aber der Fehler wird MITGESCHRIEBEN, nicht verschluckt. Hier stand
        // ein blankes `.catch(() => {})`, und weil der Rueckgabewert auch
        // nicht gelesen wurde, fiel `antwort.error` (Rechteverletzung,
        // Constraint, fehlende Migration) ebenfalls lautlos weg. Es gab
        // danach keine Spur - weder in `punkteFehler` noch in der Konsole.
        //
        // Der Kopf dieser Datei haelt fuer dasselbe Feld fest, warum das
        // teuer ist: "beide Fehler wurden verschluckt ... die Uebertragung
        // seit Wochen scheiterte". Ein Abbruch waere falsch, ein Schweigen
        // ist es auch. Gefunden vom Agenten `pruefung`, 24.08.2026.
        await mitZeitgrenze(
          supabase.from('run_splits').insert(
          splits.map((s, i) => ({
            run_id: runId,
            split_number: i + 1,
            distance_km: s.distance_km,
            duration_s: s.duration_s,
            pace_s_per_km: s.pace_s_per_km,
            elevation_gain_m: s.elevation_gain_m,
          })),
        ),
          SPEICHERN_GRENZE_MS,
          'Die Abschnitte speichern',
        )
          .then((antwort) => {
            const grund = (antwort as { error?: { message: string } | null })?.error
            if (grund) abschnittsfehler = grund.message
          })
          .catch((grund) => {
            abschnittsfehler = grund instanceof Error ? grund.message : String(grund)
          })

        if (abschnittsfehler) {
          // An `punkteFehler` angehaengt statt ueberschrieben: Ein Fehler
          // beim Uebertragen der Punkte wiegt schwerer und darf nicht von
          // einem Abschnittsfehler verdraengt werden.
          const vorher = get().punkteFehler
          const meldung = `Abschnitte: ${abschnittsfehler}`
          set({ punkteFehler: vorher ? `${vorher} | ${meldung}` : meldung })
        }
      }

      // Der Lauf ist sicher gespeichert und die Punkte sind uebertragen -
      // ab hier gibt es nichts mehr zu bergen.
      merkerLoeschen()
      set({ stoppversuche: 0 })
      set({ phase: 'completed', splits, activeRunId: runId })
      return { runId, error: null, art: null }
    } catch (grund) {
      // Zurueck in die Aufzeichnung - auf dem Telefon heisst das, den Dienst
      // wieder anzuwerfen. Der Lauf ist nicht verloren: Der Merker liegt
      // noch, die Punkte liegen noch, und der naechste Versuch kann greifen.
      await abbruchUndWeiterAufzeichnen(set, get().sitzungId, zurueck('ablage'))
      return {
        runId: null,
        error: grund instanceof Error ? grund.message : String(grund),
        art: 'ablage',
      }
    }
  },

  // Verwerfen heisst hier wirklich verwerfen: Es gibt nichts zu loeschen,
  // weil waehrend des Laufs nichts geschrieben wurde.
  discardRun: () => {
    // Erst den Dienst beenden, dann seine Punkte wegwerfen - in dieser
    // Reihenfolge. Andersherum schriebe er waehrend des Loeschens weiter,
    // und ein paar Punkte des verworfenen Laufs blieben liegen.
    const sitzung = get().sitzungId
    const zeile = get().activeRunId

    // Die Lauf-Zeile wird auf 'abandoned' gesetzt - sonst ist "verwerfen"
    // eine Luege.
    //
    // Der alte Kommentar hier sagte, es gebe nichts zu loeschen, "weil
    // waehrend des Laufs nichts geschrieben wurde". Das stimmte einmal.
    // Seit die Zeile beim START entsteht (damit die Punkte waehrend des
    // Laufs irgendwo hinkoennen), bleibt sie auf 'tracking' stehen - und
    // `haengendeLaeufeAbschliessen` sammelt genau die ein. Der verworfene
    // Lauf staende fuenf Minuten spaeter (SCHONFRIST_MS) beim naechsten
    // App-Start im Verlauf.
    //
    // Getragen hat es bisher nur ein Zufall: Der einzige Aufrufer war der
    // Zu-kurz-Zweig, und `istSpeicherwuerdig` haelt solche Zeilen ohnehin
    // von der Nachbergung fern. Mit dem Verwerfen-Knopf aus dem Zustand
    // 'abgebrochen' gilt das nicht mehr.
    //
    // KEINE Migration noetig: `run_status` kennt 'abandoned' seit
    // 0008_runs_and_gps.sql. Der Wert war da und wurde nie geschrieben.
    //
    // Gefunden vom Agenten `oberflaeche` am 24.08.2026 - er hat das
    // Verwerfen gegen den Quelltext geprueft, statt es zu glauben.
    if (zeile) {
      supabase
        .from('runs')
        .update({ status: 'abandoned' as const, ended_at: new Date().toISOString() })
        .eq('id', zeile)
        .eq('status', 'tracking')
        .then(undefined, () => {})
    }

    merkerLoeschen()
    aufzeichnungStoppen().then(() => {
      if (sitzung) punkteVerwerfen(sitzung)
    })

    set({
      ...grundzustand(),
      phase: 'idle',
      activeRunId: null,
      startedAtMs: null,
      sitzungId: null,
      dienstHindernis: null,
    })
  },

  addPoint: (messung) => {
    if (get().phase !== 'tracking') return

    // Zuerst festhalten, wie gut das Signal gerade ist – auch wenn die
    // Messung gleich verworfen wird. Sonst sieht der Laeufer nie, dass sein
    // Empfang das Problem ist.
    const genauigkeit = messung.accuracy_m
    if (genauigkeit != null && genauigkeit >= 0) set({ lastAccuracyM: genauigkeit })

    // Eine ungenaue Messung ist schlimmer als gar keine: Sie verschiebt den
    // Bezugspunkt, und der naechste Abstand wird davon aus gerechnet.
    // Ein negativer Wert heisst bei manchen Geraeten "ungueltig".
    if (genauigkeit != null && (genauigkeit < 0 || genauigkeit > MAX_ACCURACY_VERLAUF_M)) return

    // Zwischengespeicherter Standort von vorhin: verwerfen. Gilt nur fuer
    // frische Messungen - Punkte aus dem Puffer des Dienstes sind
    // zwangslaeufig alt und trotzdem richtig.
    if (!messung.ausPuffer && Date.now() - messung.zeitMs > MAX_ALTER_MS) return

    // Nie rueckwaerts. Kaeme eine aeltere Messung nach einer juengeren, waere
    // die Zeitrechnung der Bewegungserkennung durcheinander.
    const vorherigeZeit = get().ortungsverlauf.at(-1)?.zeit ?? 0
    if (messung.zeitMs < vorherigeZeit) return

    const pt: PointBuffer = {
      latitude: messung.latitude,
      longitude: messung.longitude,
      altitude_m: messung.altitude_m,
      accuracy_m: messung.accuracy_m,
      speed_mps: messung.speed_mps,
      recorded_at: new Date(messung.zeitMs).toISOString(),
      // Wird unten gefaellt, sobald der Vorgaengerpunkt feststeht.
      urteil: null,
    }

    // --- Bewegungserkennung -------------------------------------------
    //
    // Die Reihenfolge ist wichtig: Erst wird entschieden, ob ueberhaupt
    // Bewegung stattfindet, und nur dann waechst die Strecke. Frueher stand
    // hier bloss ein Mindestabstand - und der liess das Rauschen eines
    // stillliegenden Telefons als Kilometer durchgehen.

    const jetztMs = messung.zeitMs
    const ortung: Ortung = {
      latitude: pt.latitude,
      longitude: pt.longitude,
      zeit: jetztMs,
      genauigkeitM: pt.accuracy_m,
      gemeldetesTempoMps: pt.speed_mps,
      gueteMps: messung.tempo_guete_mps ?? null,
    }

    // Kurzes Fenster aller brauchbaren Messungen. Aelteres faellt heraus -
    // fuer die Nettoverschiebung zaehlen nur die letzten Sekunden, und der
    // Verlauf soll waehrend eines langen Laufs nicht mitwachsen.
    const verlauf = [...get().ortungsverlauf, ortung].filter(
      (o) => jetztMs - o.zeit <= NETTO_FENSTER_MS * 2,
    )

    // Die Reihenfolge liegt in bewegungSchritt: Tempo ermitteln, Ruhepegel
    // bei Stillstand fuettern, Tor berechnen, Bewegung fortschreiben.
    //
    // Bis zum 21.08.2026 stand sie hier von Hand und im Anzeigetakt ein
    // zweites Mal. Zwei Kopien derselben Regel koennen auseinanderlaufen -
    // und genau daraus entstand der Fehler, bei dem die App bei bestem
    // Empfang nichts mehr aufzeichnete.
    //
    // Die BEWEGUNGSZEIT entsteht hier ausdruecklich NICHT mehr. Bis zum
    // 23.08.2026 kam sie aus bewegungSchritt (ueber den rohen Messverlauf),
    // waehrend die Strecke dem Segmenturteil ueber die GESPEICHERTEN Punkte
    // folgte - zwei Eingangsstroeme, zwei Regeln, und im Nachlauf zaehlte
    // ein Punkt Strecke ohne eine Sekunde Zeit. Das war B1, nur eine Etage
    // hoeher. Gefunden vom Pruefagenten, nicht von einem Test - der Test,
    // der es haette fangen sollen, verglich die Schleife mit sich selbst.
    //
    // Jetzt waechst die Zeit unten, im selben bilanzErweitern wie die
    // Strecke. Ein Segment, ein Urteil, beide Groessen.
    const ruhepegel = get().ruhepegel
    const schritt = bewegungSchritt(get().bewegung, ruhepegel, verlauf, jetztMs)
    if (schritt.ruhepegelErweitert) ruhepegelSichern(ruhepegel)

    const { tor, bewegung } = schritt

    const prev = get().points
    let { distanceKm, elevationGainM, verworfeneStreckeM, bewegungszeitS } = get().liveStats
    let hoeheRef = get().elevationRefM

    // Steht die Person, wird nichts aufgezeichnet: keine Strecke, kein Punkt.
    // Damit bleibt auch die Karte sauber - der Zickzack im Stand war dasselbe
    // Rauschen, nur sichtbar.
    if (!bewegung.inBewegung) {
      set({
        ortungsverlauf: verlauf,
        bewegung,
        tor,
        ruhepegel,
        liveStats: { ...get().liveStats, inBewegung: false },
      })
      return
    }

    // Zu ungenau fuer Strecke und Karte - das Tempo hat er trotzdem
    // beigetragen, weil er im Verlauf steht.
    if (genauigkeit != null && genauigkeit > MAX_ACCURACY_M) {
      set({
        ortungsverlauf: verlauf,
        bewegung,
        tor,
        ruhepegel,
        liveStats: { ...get().liveStats, inBewegung: true },
      })
      return
    }

    if (prev.length > 0) {
      const last = prev[prev.length - 1]
      const segKm = haversineKm(last.latitude, last.longitude, pt.latitude, pt.longitude)

      // Zweite Reihe hinter der Bewegungserkennung. Verglichen wird immer mit
      // dem letzten AUFGEZEICHNETEN Punkt - wer langsam geht, ueberschreitet
      // die Schwelle also nach ein paar Messungen trotzdem, es geht nichts
      // verloren.
      if (segKm * 1000 < MIN_SEGMENT_M) {
        set({
          ortungsverlauf: verlauf,
          bewegung,
          tor,
          ruhepegel,
          liveStats: { ...get().liveStats, inBewegung: true },
        })
        return
      }

      // EIN Urteil, und Strecke wie verworfene Strecke folgen ihm.
      //
      // Dieselbe Funktion benutzt computeSplits ueber die fertige Punktfolge.
      // Vorher fragten beide verschiedene Waechter - daher "4,0 km" auf dem
      // Bildschirm und 5,2 km in den Abschnitten darunter.
      const vorher = {
        ...LEERE_BILANZ,
        streckeKm: distanceKm,
        bewegungszeitS,
        verworfeneStreckeM,
      }
      const nachher = bilanzErweitern(vorher, last, pt)
      distanceKm = nachher.streckeKm
      bewegungszeitS = nachher.bewegungszeitS
      verworfeneStreckeM = nachher.verworfeneStreckeM

      // Das Urteil wandert mit dem Punkt in die Datenbank.
      pt.urteil = urteilFuer(last, pt)
    }

    // Hoehenmeter: erst ueber die letzten Messungen mitteln, dann die
    // Schwelle anlegen.
    const geglaettet = mittlereHoehe([...prev.slice(-(HOEHEN_FENSTER - 1)), pt])
    if (geglaettet != null) {
      hoeheRef = hoeheAktualisieren(geglaettet, hoeheRef, (zuwachs) => {
        elevationGainM += zuwachs
      })
    }

    set({
      points: [...prev, pt],
      liveStats: {
        ...get().liveStats,
        distanceKm,
        verworfeneStreckeM,
        elevationGainM,
        bewegungszeitS,
        inBewegung: true,
      },
      elevationRefM: hoeheRef,
      ortungsverlauf: verlauf,
      bewegung,
      tor,
      ruhepegel,
    })

    // Sofort auf das Geraet. Das gelingt immer und braucht kein Netz – es
    // ist der eigentliche Schutz gegen Datenverlust. Uebertragen wird
    // spaeter in Buendeln.
    const runId = get().activeRunId
    if (runId) {
      punktMerken({ client_id: crypto.randomUUID(), run_id: runId, ...pt })
        .catch(() => {
          // Schlaegt der Puffer fehl, laeuft die Aufzeichnung weiter: Der
          // Punkt steht im Arbeitsspeicher und geht am Ende mit.
        })
    }
  },

  /**
   * Uebertraegt, was auf dem Geraet liegt. Wird vom Takt alle 30 Sekunden
   * angestossen und am Ende des Laufs noch einmal.
   *
   * Fehler bleiben ohne Folge: Was nicht ankam, liegt weiter auf dem Geraet
   * und geht beim naechsten Versuch mit.
   */
  punkteUebertragen: async () => {
    if (get().sendetGerade) return
    set({ sendetGerade: true })
    try {
      const ergebnis = await offeneSenden()
      set({ punkteFehler: ergebnis.fehler, punkteOffen: ergebnis.offen })
    } catch (grund) {
      // Wirft offenePunkte() selbst - IndexedDB gesperrt, privater Modus,
      // Speicher voll -, entstand hier bisher eine unbehandelte Ablehnung,
      // und der Bildschirm sagte weiter "alles gut". Genau das Muster, gegen
      // das der Kopf von punkteSenden.ts geschrieben ist: Ein Fehler, den
      // niemand sehen kann, ist derselbe wie kein Fehler.
      set({ punkteFehler: grund instanceof Error ? grund.message : String(grund) })
    } finally {
      set({ sendetGerade: false })
    }
  },

  /**
   * Beim Dienst abholen, was sich angesammelt hat.
   *
   * Laeuft in Buendeln, bis nichts mehr kommt: Nach einer Stunde Schlaf
   * koennen dreitausend Punkte warten, und der Dienst gibt hoechstens
   * fuenfhundert auf einmal heraus.
   *
   * Bestaetigt wird erst, nachdem die Punkte durch die Bewegungserkennung
   * gelaufen sind. Ein Absturz dazwischen kostet keinen Punkt - sie kommen
   * beim naechsten Abholen erneut. Doppelt ist harmlos, weg waere es nicht.
   */
  /**
   * Eine Aufzeichnung bergen, die die App nicht mehr kennt.
   *
   * Der Fall: Android hat die App waehrend eines Laufs abgeschossen. Der
   * Dienst sammelt weiter, aber Sitzung und Lauf-Kennung waren nur im
   * Arbeitsspeicher - bis zum 22.08.2026 waren die Punkte damit fuer immer
   * unerreichbar. Gemessen: 611 verwaiste Punkte, neun haengende Laeufe.
   *
   * Zwei Quellen zusammen ergeben den Rueckweg: Der **Merker** kennt Sitzung
   * und Lauf-Zeile und ueberlebt im Geraetespeicher. Der **Dienst** weiss,
   * ob er noch sammelt und wann die letzte Messung kam.
   */
  verwaisteAufzeichnungBergen: async () => {
    // Laeuft schon einer, gibt es nichts zu bergen.
    if (get().phase !== 'idle') return null

    const merker = merkerLesen()
    const stand = await aufzeichnungStand(merker?.sitzungId)
    if (!stand) return null

    // Der Merker ist die bessere Quelle - er kennt auch die Lauf-Zeile. Der
    // Dienst ist der Rueckfall, falls der Geraetespeicher geleert wurde.
    const sitzung = merker?.sitzungId ?? stand.laufId
    if (!sitzung) return null

    const urteil = bergungsurteil(
      {
        laeuft: stand.laeuft,
        laufId: sitzung,
        letzterPunktMs: stand.letzterPunktMs,
        // Ohne diese Angabe galt ein gestoppter Dienst als "nichts zu holen",
        // auch wenn seine Punkte noch dalagen.
        offen: stand.offen,
      },
      Date.now(),
    )
    if (urteil === 'nichts') {
      // Der Dienst sammelt nicht mehr. Ein Merker, der auf nichts zeigt,
      // gehoert weg - sonst fragt jeder Start erneut.
      if (merker) merkerLoeschen()
      return null
    }

    // Den Zustand so weit herstellen, dass die Punkte zugeordnet werden
    // koennen: addPoint schreibt nur bei 'tracking' und braucht die
    // Lauf-Kennung, um zu puffern.
    // Die Startzeit, in der Reihenfolge ihrer Verlaesslichkeit: die Zeile in
    // der Datenbank, dann der Dienst, dann - notgedrungen - jetzt.
    //
    // Bis zum 23.08.2026 stand hier die Zeit der LETZTEN Messung. Damit war
    // die Dauer eines geborgenen Laufs ein paar Sekunden statt einer Stunde,
    // und der Waechter in stopRun verwarf ihn als zu kurz.
    let startMs = stand.startMs ?? Date.now()
    if (merker?.runId) {
      const { data } = await supabase
        .from('runs')
        .select('started_at')
        .eq('id', merker.runId)
        .maybeSingle()
      const iso = (data as { started_at: string } | null)?.started_at
      if (iso) startMs = new Date(iso).getTime()
    }

    // Der Waechter von oben noch einmal - zwischen ihm und hier liegen zwei
    // await: der Brueckenaufruf und, mit Merker, eine Netzabfrage. Tippt
    // jemand in diesem Fenster auf "Lauf starten", wuerde die Bergung dessen
    // Sitzung ueberschreiben und seine Punkte in die falsche Ablage holen.
    //
    // Das Fenster ist so gross wie eine Netzabfrage - und gerade bei
    // schlechtem Netz, also genau dann, wenn die Bergung ueberhaupt
    // anspringt, am groessten.
    if (get().phase !== 'idle') return null

    set({
      ...grundzustand(),
      phase: 'tracking',
      sitzungId: sitzung,
      activeRunId: merker?.runId ?? null,
      startedAtMs: startMs,
    })

    const geborgen = await get().punkteEinsammeln()

    if (urteil === 'fortsetzen') return { ergebnis: 'fortgesetzt', punkte: geborgen }

    // Der Lauf ist erkennbar vorbei und wird gespeichert. stopRun uebernimmt
    // dabei alles Weitere: Kennzahlen, Abschnitte, Uebertragung, und das
    // Loeschen des Merkers.
    //
    // Aber es gelingt nicht immer, und das gehoert gesagt: Unter
    // MIN_SAVE_DISTANCE_KM wird verworfen, und ohne Netz scheitert das
    // Schreiben. Wer dann hoert "liegt im Verlauf", sucht vergeblich.
    // Deshalb sagt diese Funktion, was wirklich geschehen ist, statt den
    // Aufrufer den Zustand hinterher erraten zu lassen.
    await get().stopRun()
    const danach = get().phase
    // 'abgebrochen' ist ein eigener Ausgang, kein Unterfall von
    // "ungespeichert". Der Unterschied ist die Ansage: "der naechste Start
    // holt es nach" ist hier FALSCH - es holt nichts nach, und es fuehrt
    // nur ueber eine Entscheidung des Menschen weiter.
    //
    // Der Agent `oberflaeche` hat das gemeldet und `Startbergung.tsx`
    // ausdruecklich NICHT geaendert: Sauber unterscheiden liesse es sich nur
    // hier, und ein Blick von dort auf `phase` waere genau der Seitenkanal,
    // den die Datei sich selbst verbietet.
    const ergebnis: Bergungsergebnis['ergebnis'] =
      danach === 'completed'
        ? 'gespeichert'
        : danach === 'abgebrochen'
          ? 'abgebrochen'
          : danach === 'idle'
            ? 'zu-kurz'
            : 'ungespeichert'

    return { ergebnis, punkte: geborgen }
  },

  haengendeLaeufeAbschliessen: async () => {
    // Die ZWEITE Frage der Bergung. `verwaisteAufzeichnungBergen` fragt den
    // DIENST: "haelt er noch Rohdaten?" Diese hier fragt die DATENBANK:
    // "steht dort ein Lauf, der nie fertig wurde?"
    //
    // Beide sind noetig, und das ist am 23.08.2026 abends teuer gelernt
    // worden: Ein Lauf blieb beim Speichern haengen, die Punkte waren
    // vollstaendig uebertragen, der Dienst sauber, der Merker geloescht -
    // und die Bergung sagte "nichts zu tun". Die Zeile blieb fuer immer
    // auf 'tracking'.
    const ich = eigeneKennung()
    if (!ich) return 0

    const { data: zeilen, error } = await supabase
      .from('runs')
      .select('id, status, started_at')
      .eq('user_id', ich)
      .eq('status', 'tracking')

    if (error || !Array.isArray(zeilen)) return 0

    // Die BILLIGEN Filter zuerst - vor jeder Punktabfrage.
    //
    // Vorher holte die Schleife darunter alle Punkte JEDER 'tracking'-Zeile,
    // eine Abfrage nach der anderen, auch fuer den gerade laufenden Lauf und
    // fuer Zeilen mit unlesbarem Start. Zum Feldtest hingen sechzehn solcher
    // Zeilen (siehe lib/laufMerker.ts) - das waren sechzehn Abfragen bei
    // jedem App-Start, dauerhaft.
    const laufend = get().activeRunId
    const vorgefiltert = (zeilen as Array<{ id: string; status: string; started_at: string }>)
      .filter((z) => z.id !== laufend && Number.isFinite(Date.parse(z.started_at)))

    // Erst die Punktzahl je Lauf holen - ohne sie ist nicht zu entscheiden,
    // ob es etwas zu rechnen gibt.
    const kandidaten: Array<{ id: string; status: string; started_at: string; punkte: number
      zuletztGemessen: string | null
      rohe: Array<{ latitude: number; longitude: number; recorded_at: string; urteil?: never }> }> = []
    for (const z of vorgefiltert) {
      // `.range(0, MAX_PUNKTE - 1)` ausdruecklich, statt sich auf die
      // Vorgabe zu verlassen.
      //
      // PostgREST schneidet bei `max_rows` ab (supabase/config.toml: 1000) -
      // ohne ein Wort, und `data` sieht vollstaendig aus. Waere das
      // eingetreten, haette `zuletztGemessen` den 1000. Punkt getragen statt
      // den letzten: Die Schonfristpruefung, die haengenderLauf.ts selbst
      // "der gefaehrlichste Fehler dieser Funktion" nennt, haette bei einem
      // LAUFENDEN Lauf einen stundenalten Zeitstempel gesehen. Und die
      // Kennzahlen waeren aus den ersten rund zehn Kilometern gerechnet und
      // als 'completed' festgeschrieben worden.
      const { data: punkte } = await supabase
        .from('run_points')
        .select('latitude, longitude, recorded_at, urteil')
        .eq('run_id', z.id)
        .order('recorded_at', { ascending: true })
        .range(0, MAX_PUNKTE_JE_BERGUNG - 1)
      const rohe = Array.isArray(punkte) ? punkte : []
      // Voll heisst: es koennte mehr geben. Dann wird nicht gerechnet -
      // lieber bleibt die Zeile stehen, als dass ein 15-km-Lauf dauerhaft
      // als 10-km-Lauf im Verlauf steht.
      if (rohe.length >= MAX_PUNKTE_JE_BERGUNG) continue
      kandidaten.push({
        ...(z as { id: string; status: string; started_at: string }),
        punkte: rohe.length,
        // Die letzte Messung entscheidet ueber die Schonfrist - siehe
        // haengenderLauf.ts. Aufsteigend sortiert geholt, also die letzte.
        zuletztGemessen:
          rohe.length > 0
            ? (rohe[rohe.length - 1] as { recorded_at: string }).recorded_at
            : null,
        rohe: rohe as never,
      })
    }

    const faellig = haengendeLaeufe(kandidaten, get().activeRunId, Date.now())

    let fertig = 0
    for (const l of faellig) {
      // Die laufende Kennung wird VOR JEDEM SCHREIBEN neu gelesen, nicht
      // einmal oben.
      //
      // Zwischen dem Filtern und diesem Schreiben liegen mehrere await -
      // und in dieser Zeit kann `verwaisteAufzeichnungBergen` genau diesen
      // Lauf fortgesetzt haben. Beide Bergungen starten beim Anmelden. Der
      // Filter oben haette dann eine Momentaufnahme von vorher benutzt und
      // einen LAUFENDEN Lauf auf 'completed' gesetzt: Der Mensch laeuft
      // weiter, die Seite zeigt "Lauf laeuft", und die Zeile ist zu.
      //
      // Gefunden vom Pruefagenten am 23.08.2026, bevor es passiert ist.
      if (get().activeRunId === l.id || get().phase === 'tracking') continue

      const roh = kandidaten.find((k) => k.id === l.id)?.rohe ?? []
      const kennzahlen = kennzahlenAusPunkten(roh as never, Date.parse(l.started_at))
      // Kein Lauf ohne Grundlage: Lieber steht die Zeile weiter auf
      // 'tracking', als dass eine erfundene im Verlauf erscheint.
      if (!kennzahlen) continue

      // Dieselbe Huerde wie beim gewoehnlichen Stoppen - eine Frage, eine
      // Antwort. Vorher entschied hier allein die Punktzahl, und derselbe
      // Lauf wurde beim Stoppen verworfen und beim Bergen behalten.
      if (!istSpeicherwuerdig(kennzahlen.distance_km, kennzahlen.duration_s)) continue

      // `.eq('status', 'tracking')` ist die eigentliche Wache, nicht die
      // Abfrage oben.
      //
      // Der Waechter davor liest den Zustand unmittelbar vor dem Schreiben -
      // aber das Schreiben selbst dauert bis zu SPEICHERN_GRENZE_MS. In
      // dieser Zeit kann `verwaisteAufzeichnungBergen` denselben Lauf
      // fortgesetzt haben; das Update landete dann auf einem LAUFENDEN Lauf
      // und schloss ihn mit der alten letzten Messung ab. Beide Bergungen
      // starten aus derselben Komponente, ihre Reihenfolge liegt nicht fest.
      //
      // Mit dieser Bedingung entscheidet die DATENBANK, und zwar im selben
      // Augenblick, in dem sie schreibt. Danach ist kein Zeitfenster mehr
      // uebrig.
      const { error: schreibfehler } = await mitZeitgrenze(
        supabase.from('runs').update(kennzahlen).eq('id', l.id).eq('status', 'tracking'),
        SPEICHERN_GRENZE_MS,
        'Einen haengengebliebenen Lauf abschliessen',
      ).catch((grund) => ({ error: grund as { message: string } }))

      if (!schreibfehler) fertig += 1
    }
    return fertig
  },

  punkteEinsammeln: async () => {
    const sitzung = get().sitzungId
    if (!sitzung || !aufTelefon()) return 0

    let gesamt = 0
    // Obergrenze gegen eine Endlosschleife, falls das Bestaetigen scheitert.
    for (let runde = 0; runde < 20; runde++) {
      const punkte = await punkteAbholen(sitzung)
      if (punkte.length === 0) break

      for (const p of punkte) {
        get().addPoint({
          latitude: p.breite,
          longitude: p.laenge,
          altitude_m: p.hoeheM,
          accuracy_m: p.genauigkeitM,
          speed_mps: p.tempoMps,
          tempo_guete_mps: p.tempoGueteMps,
          zeitMs: p.zeit,
          ausPuffer: true,
        })
      }

      await punkteBestaetigen(sitzung, punkte[punkte.length - 1].id)
      gesamt += punkte.length
      if (punkte.length < 500) break
    }
    return gesamt
  },

  tick: () => {
    const { phase, startedAtMs, liveStats, bewegung, ortungsverlauf } = get()
    if (phase !== 'tracking' || startedAtMs == null) return

    const jetzt = Date.now()
    // Reine Wanduhr. Ausdrueckliche Pausen werden NICHT abgezogen: Die
    // Gesamtzeit soll sagen, wie lange der Lauf gedauert hat - Ampel
    // inbegriffen. Was davon Bewegung war, steht daneben.
    const durationS = gesamtzeitS(startedAtMs, jetzt)

    // Uebertragen, wenn seit der letzten genug Zeit vergangen ist.
    //
    // Hier stand `durationS % 30 === 0`, und das war am 23.08.2026 im Feld
    // messbar falsch: Lauf seit zwanzig Minuten, 244 Punkte im Geraetepuffer,
    // NULL in der Datenbank. Bei ausgeschaltetem Bildschirm drosselt Android
    // diesen Takt, `durationS` springt dann etwa von 100 auf 160 - und ein
    // Vielfaches von 30 wird uebersprungen. Kaum ging der Bildschirm an,
    // liefen 266 Punkte auf einmal durch.
    //
    // Die Regel steht in punkteSenden.ts, damit sie pruefbar ist.
    if (istUebertragungFaellig(get().letzteUebertragungMs, jetzt)) {
      set({ letzteUebertragungMs: jetzt })
      get().punkteUebertragen()
    }

    // Waehrend des Laufs steht das Tempo JETZT auf dem Bildschirm, nicht der
    // Schnitt. Der Schnitt kommt in der Zusammenfassung.
    //
    // Warum: Der Schnitt ist Bewegungszeit geteilt durch Gesamtstrecke. Nach
    // zehn Minuten bewegt eine neue Sekunde ihn um ein Sechshundertstel - er
    // KANN einem Tempowechsel nicht folgen. Wer in der Bahn sass und dann zu
    // Fuss weiterging, sah minutenlang etwas dazwischen. Das war keine
    // ungenaue Messung, sondern die falsche Groesse.
    //
    // Nicht die zuletzt gemessene Zahl stehenlassen: Eine eingefrorene Pace
    // sieht aus wie eine Messung und ist keine. OpenTracks macht genau das
    // und hat dafuer einen offenen Fehlerbericht.
    const letzte = ortungsverlauf.at(-1)
    const frisch = letzte != null && jetzt - letzte.zeit <= MAX_LUECKE_S * 1000
    const inBewegung = bewegung.inBewegung && frisch

    // Das Anzeige-Tor ist bewusst NICHT das Strecken-Tor. Die zehn Sekunden
    // Haltezeit und die zehn bis fuenfzig Meter aus bewegungFortschreiben
    // schuetzen die STRECKE vor Drift - sie duerfen die ANZEIGE nicht
    // bremsen. Eine kurz falsch angezeigte Zahl kostet nichts, eine falsch
    // gezaehlte Strecke ruiniert den Lauf.
    // Das Tor kommt aus dem Zustand und wird hier NICHT neu berechnet: Es
    // entsteht in bewegungSchritt, und zwei Berechnungen derselben Schwelle
    // koennen auseinanderlaufen.
    const tempoJetzt = tempoJetztMps(ortungsverlauf, jetzt)
    const tor = get().tor
    const tempoAnzeige =
      tempoJetzt !== null && tempoJetzt >= tor
        ? formatPace(1000 / tempoJetzt, 1)
        : '--:--'

    set({
      liveStats: {
        ...liveStats,
        durationS,
        inBewegung,
        // Aus der Bewegungszeit, nicht aus der Laufzeit: Sonst verdirbt ein
        // Halt an der Ampel den Schnitt des ganzen Laufs.
        paceDisplay: tempoAnzeige,
      },
    })
  },

  deleteAllRuns: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { anzahl: 0, error: 'Nicht angemeldet' }

    // Ausdruecklich auf das eigene Konto eingegrenzt. Die Zeilenrechte lassen
    // ohnehin nichts anderes zu, aber ein Loeschbefehl ohne Bedingung soll
    // hier gar nicht erst stehen.
    const { data, error } = await supabase
      .from('runs')
      .delete()
      .eq('user_id', user.id)
      .select('id')

    if (error) return { anzahl: 0, error: error.message }

    set({
      recentRuns: [],
      selectedRun: null,
      selectedRunSplits: [],
      selectedRunPoints: [],
      punkteFehler: null,
      punkteOffen: 0,
    })
    return { anzahl: (data ?? []).length, error: null }
  },

  fetchRecentRuns: async (limit = 50) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    // Die bisherige Liste bleibt stehen. `recentRuns: []` laesst die
    // Verlaufsseite "Keine Aktivitaeten - Starte deinen ersten Lauf" sagen
    // (History.tsx), und das darf sie nur, wenn wirklich nichts da ist.
    if (error) {
      console.warn(`Laeufe laden fehlgeschlagen: ${error.message}`)
      set({ ladefehler: error.message, loading: false })
      return
    }

    set({ recentRuns: (data ?? []) as Run[], ladefehler: null, loading: false })
  },

  fetchRun: async (id) => {
    set({ loading: true })
    // maybeSingle statt single: `.single()` meldet NULL ZEILEN als Fehler
    // (PGRST116). Damit kaeme "diesen Lauf gibt es nicht" als derselbe
    // Zustand an wie "die Abfrage ging schief".
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    // Anders als beim Profil bleibt hier NICHTS stehen: `selectedRun`
    // gehoert zu einer bestimmten Kennung. Den vorigen Lauf zu behalten
    // hiesse, auf der Detailseite von Lauf B die Zahlen von Lauf A zu
    // zeigen. Lieber nichts als das Falsche - `ladefehler` sagt, warum
    // nichts da ist.
    if (error) {
      console.warn(`Lauf laden fehlgeschlagen: ${error.message}`)
      set({ selectedRun: null, ladefehler: error.message, loading: false })
      return
    }

    set({ selectedRun: (data as Run) ?? null, ladefehler: null, loading: false })
  },

  fetchRunSplits: async (runId) => {
    const { data } = await supabase
      .from('run_splits')
      .select('*')
      .eq('run_id', runId)
      .order('split_number', { ascending: true })

    set({ selectedRunSplits: (data ?? []) as RunSplit[] })
  },

  fetchRunPoints: async (runId) => {
    const { data, error } = await supabase
      .from('run_points')
      .select('*')
      .eq('run_id', runId)
      .order('recorded_at', { ascending: true })

    // Kommt nichts zurueck, ist die Frage: gibt es keine Punkte, oder liegen
    // sie noch hier? Beides sah bisher gleich aus.
    const liegend = (await offenePunkte()).filter((p) => p.run_id === runId).length

    set({
      selectedRunPoints: (data ?? []) as RunPoint[],
      punkteFehler: error ? `${error.message}${error.code ? ` (${error.code})` : ''}` : null,
      punkteOffen: liegend,
    })
  },

  reset: () =>
    set({
      ...grundzustand(),
      phase: 'idle',
      activeRunId: null,
      startedAtMs: null,
      sitzungId: null,
      dienstHindernis: null,
    }),
}))

/** Mittelwert der Hoehe ueber die uebergebenen Punkte; null, wenn keiner eine hat. */
export function mittlereHoehe(punkte: PointBuffer[]): number | null {
  const hoehen = punkte.map((p) => p.altitude_m).filter((h): h is number => h != null)
  if (hoehen.length === 0) return null
  return hoehen.reduce((a, b) => a + b, 0) / hoehen.length
}

/**
 * Hoehenmeter zaehlen, ohne auf Schwankungen hereinzufallen.
 *
 * Der Bezug wandert in BEIDE Richtungen erst, wenn die Aenderung die Schwelle
 * ueberschreitet. Ohne diese Sperre nach unten wuerde ein blosses Auf und Ab
 * als Anstieg gelten: Bei einer Schwelle von 3 m und einem Zappeln um 1,5 m
 * nach oben und unten liegt zwischen Tal und Gipfel genau die Schwelle – die
 * App wuerde bei jedem Ausschlag 3 Hoehenmeter gutschreiben, obwohl es flach
 * ist.
 *
 * Gibt den neuen Bezug zurueck; echten Zuwachs meldet sie ueber `gezaehlt`.
 */
export function hoeheAktualisieren(
  hoehe: number,
  bezug: number | null,
  gezaehlt: (zuwachs: number) => void,
): number {
  if (bezug == null) return hoehe
  if (hoehe - bezug >= MIN_HOEHENSCHRITT_M) {
    gezaehlt(hoehe - bezug)
    return hoehe
  }
  // Nur ein echter Abstieg setzt den Bezug nach – sonst muesste er erst
  // wieder aufgeholt werden, bevor der naechste Anstieg zaehlt.
  if (bezug - hoehe >= MIN_HOEHENSCHRITT_M) return hoehe
  return bezug
}

export function computeSplits(points: PointBuffer[]): LiveSplit[] {
  if (points.length < 2) return []

  const splits: LiveSplit[] = []
  let splitDist = 0
  let splitElev = 0
  // Seit dem Umstieg auf die begrenzte Dauer wird nicht mehr von Punkt zu
  // Punkt zurueckgerechnet, sondern waehrend des Durchlaufs aufaddiert. Der
  // Anfangsindex des Abschnitts wird dafuer nicht mehr gebraucht.
  let splitDauerS = 0
  // Bezugshoehe laeuft ueber die Abschnittsgrenze hinweg weiter: Der Anstieg
  // hoert am Kilometerstein ja nicht auf.
  let splitHoeheRef: number | null = null

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    // EIN Urteil, und Strecke wie Dauer folgen ihm - dieselbe Funktion, die
    // addPoint waehrend des Laufs benutzt.
    //
    // Hier standen bis zum 23.08.2026 zwei getrennte Waechter: einer fuer die
    // Strecke, einer fuer die Zeit. Sie widersprachen sich zweimal
    // nachweisbar - "4,0 km" gegen 5,2 km in den Abschnitten, und 382 gegen
    // 433 Sekunden auf derselben Fahrt.
    const schritt = bilanzErweitern(LEERE_BILANZ, prev, curr)
    if (schritt.sprungAnzahl > 0) continue

    splitDist += schritt.streckeKm
    splitDauerS += schritt.bewegungszeitS

    // Dieselbe Regel wie live, sonst meldet die Summe der Abschnitte mehr
    // Hoehenmeter als der Lauf insgesamt.
    const geglaettet = mittlereHoehe(points.slice(Math.max(0, i - HOEHEN_FENSTER + 1), i + 1))
    if (geglaettet != null) {
      splitHoeheRef = hoeheAktualisieren(geglaettet, splitHoeheRef, (zuwachs) => {
        splitElev += zuwachs
      })
    }

    if (splitDist >= 1.0) {
      const durS = Math.round(splitDauerS)

      splits.push({
        distance_km: Math.round(splitDist * 1000) / 1000,
        duration_s: durS,
        pace_s_per_km: splitDist > 0 ? Math.round(durS / splitDist) : 0,
        elevation_gain_m: Math.round(splitElev * 10) / 10,
      })

      splitDist = 0
      splitElev = 0
      splitDauerS = 0
    }
  }

  if (splitDist > 0.05) {
    const durS = Math.round(splitDauerS)

    splits.push({
      distance_km: Math.round(splitDist * 1000) / 1000,
      duration_s: durS,
      pace_s_per_km: splitDist > 0 ? Math.round(durS / splitDist) : 0,
      elevation_gain_m: Math.round(splitElev * 10) / 10,
    })
  }

  return splits
}
