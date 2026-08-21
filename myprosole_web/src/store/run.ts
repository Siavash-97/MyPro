import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'
import { punktMerken, offenePunkte } from '../lib/punktePuffer'
import { offeneSenden } from '../lib/punkteSenden'
import { haversineKm } from '../lib/geo'
import {
  BEWEGUNG_MPS,
  MIN_SEGMENT_M,
  NETTO_FENSTER_MS,
  Ruhepegel,
  START_ZUSTAND,
  bewegungFortschreiben,
  bewegungszeitZuwachsS,
  MAX_LUECKE_S,
  stehtStill,
  tempoErmitteln,
  tempoJetztMps,
  torMps,
  type Bewegungszustand,
  type Ortung,
} from '../lib/bewegung'
import { ruhepegelLaden, ruhepegelSichern } from '../lib/ruhepegelSpeicher'
import {
  aufTelefon,
  aufzeichnungPausieren,
  aufzeichnungStarten,
  aufzeichnungStoppen,
  punkteAbholen,
  punkteBestaetigen,
  punkteVerwerfen,
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
const MAX_ACCURACY_M = 50

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
/** Darueber ist es ein Sprung, keine Strecke – Tunnel, Neuortung (500 m). */
const MAX_SEGMENT_KM = 0.5

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
 * Schneller kann niemand laufen (12,5 m/s sind 45 km/h; der Weltrekord ueber
 * 100 m liegt bei rund 10,4 m/s im Schnitt). Was darueber liegt, ist ein
 * Ortungssprung und zaehlt nicht als Strecke.
 */
const MAX_TEMPO_MPS = 12.5

/**
 * Hoehenmeter erst ab diesem Anstieg zaehlen. Die Hoehe ist die mit Abstand
 * unzuverlaessigste Angabe des GPS – deutlich schlechter als Laenge und
 * Breite. Summiert man jede kleine Schwankung auf, kommt ein Vielfaches des
 * echten Anstiegs heraus: Ein bekannter Fall meldete 1316 statt 630 Metern.
 * Verglichen wird mit der letzten GEZAEHLTEN Hoehe, nicht mit dem letzten
 * Punkt – sonst verschluckt die Schwelle einen langen, flachen Anstieg.
 */
const MIN_HOEHENSCHRITT_M = 3

/**
 * Ueber so viele Messungen wird die Hoehe gemittelt, bevor die Schwelle
 * greift. Eine Schwelle allein genuegt nicht: Schwankt die Hoehe um mehr als
 * die Schwelle auf und ab – und das tut sie, echtes Rauschen liegt eher bei
 * 5 bis 10 Metern –, dann zaehlt jeder Ausschlag als Anstieg. Gemessen kamen
 * so 36 Hoehenmeter auf platter Strecke zusammen. Erst glaetten, dann
 * vergleichen; so machen es die Fachprojekte auch.
 */
const HOEHEN_FENSTER = 5

function formatPace(totalSeconds: number, distanceKm: number): string {
  if (distanceKm < MIN_PACE_DISTANCE_KM) return '--:--'
  const paceS = totalSeconds / distanceKm
  const mins = Math.floor(paceS / 60)
  const secs = Math.floor(paceS % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export { formatPace }

type TrackingPhase = 'idle' | 'tracking' | 'paused' | 'saving' | 'completed'

interface LiveStats {
  distanceKm: number
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
   * Genauigkeit der zuletzt eingegangenen Messung in Metern – auch wenn sie
   * verworfen wurde. Genau dann ist die Angabe naemlich interessant: Sie
   * zeigt, ob das Signal gerade schlecht ist. Vorbild ist der Ring um die
   * eigene Position bei Strava; je kleiner, desto besser.
   */
  lastAccuracyM: number | null
  pauseStart: number | null
  totalPausedMs: number

  recentRuns: Run[]
  selectedRun: Run | null
  selectedRunSplits: RunSplit[]
  selectedRunPoints: RunPoint[]
  loading: boolean

  startRun: () => void
  /** Schickt die gepufferten Punkte. Takt und Laufende rufen es auf. */
  punkteUebertragen: () => Promise<void>
  pauseRun: () => void
  resumeRun: () => void
  /** Speichert den Lauf. runId bleibt null, wenn zu wenig zusammenkam. */
  stopRun: () => Promise<{ runId: string | null; error: string | null }>
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

const INITIAL_LIVE: LiveStats = {
  distanceKm: 0,
  durationS: 0,
  bewegungszeitS: 0,
  paceDisplay: '--:--',
  elevationGainM: 0,
  inBewegung: false,
}

// Unterhalb dieser Werte war es kein Lauf, sondern ein versehentlicher Tipper
// oder ein Blick auf den Bildschirm. Solche Aufzeichnungen werden gar nicht
// erst gespeichert – sonst stehen im Verlauf Laeufe mit 0,0 km.
const MIN_SAVE_DISTANCE_KM = 0.1
const MIN_SAVE_DURATION_S = 60


export const useRun = create<RunState>((set, get) => ({
  phase: 'idle',
  activeRunId: null,
  liveStats: { ...INITIAL_LIVE },
  points: [],
  sendetGerade: false,
  splits: [],
  startedAtMs: null,
  sitzungId: null,
  dienstHindernis: null,
  elevationRefM: null,
  bewegung: START_ZUSTAND,
  ruhepegel: ruhepegelLaden(),
  ortungsverlauf: [],
  lastAccuracyM: null,
  pauseStart: null,
  totalPausedMs: 0,

  recentRuns: [],
  selectedRun: null,
  selectedRunSplits: [],
  selectedRunPoints: [],
  loading: false,

  // Der Lauf laeuft zunaechst nur im Geraet. Geschrieben wird erst beim
  // Beenden (siehe stopRun) – so entsteht kein Eintrag, nur weil jemand den
  // Bildschirm geoeffnet hat.
  startRun: () => {
    // Eigene Kennung, sofort und ohne Netz. Der Dienst braucht sie in dem
    // Augenblick, in dem der Knopf gedrueckt wird - auf die Antwort aus der
    // Datenbank zu warten hiesse, die ersten Sekunden zu verlieren.
    const sitzungId = crypto.randomUUID()
    set({
      phase: 'tracking',
      activeRunId: null,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
      startedAtMs: Date.now(),
      sitzungId,
      elevationRefM: null,
      // Der Ruhepegel wird bewusst NICHT zurueckgesetzt: Er beschreibt das
      // Geraet, nicht den Lauf, und wird ueber viele Laeufe hinweg besser.
      bewegung: START_ZUSTAND,
      ortungsverlauf: [],
      lastAccuracyM: null,
      pauseStart: null,
      totalPausedMs: 0,
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
        if (data) set({ activeRunId: (data as { id: string }).id })
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

    // Zu kurz oder ohne Strecke: nichts speichern. Der Verlauf bleibt sauber,
    // und niemand findet Laeufe, die er nie gemacht hat.
    if (
      liveStats.distanceKm < MIN_SAVE_DISTANCE_KM ||
      liveStats.durationS < MIN_SAVE_DURATION_S
    ) {
      get().discardRun()
      return { runId: null, error: null }
    }

    set({ phase: 'saving' })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ phase: 'tracking' })
      return { runId: null, error: 'Nicht angemeldet' }
    }

    let finalPausedMs = totalPausedMs
    if (pauseStart) finalPausedMs += Date.now() - pauseStart

    const splits = computeSplits(points)
    // Der Knopfdruck ist der Start, nicht der erste GPS-Punkt – sonst waere
    // die gespeicherte Startzeit spaeter als die gemessene Laufzeit.
    const startedAt = new Date(startedAtMs ?? Date.now() - liveStats.durationS * 1000).toISOString()

    const kennzahlen = {
      status: 'completed' as const,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      paused_duration_s: Math.round(finalPausedMs / 1000),
      distance_km: Math.round(liveStats.distanceKm * 1000) / 1000,
      duration_s: liveStats.durationS,
      // Beide getrennt, wie bei Strava: Die Laufzeit ist, was die Uhr sagt;
      // die Bewegungszeit, was davon unterwegs verbracht wurde.
      moving_time_s: Math.round(liveStats.bewegungszeitS),
      // Der Schnitt rechnet sich aus der Bewegungszeit - sonst faelscht ein
      // Halt an der Ampel die Pace des ganzen Laufs. Faellt die
      // Bewegungszeit aus irgendeinem Grund auf null, greift die Laufzeit,
      // damit hier keine Division durch null steht.
      avg_pace_s_per_km: Math.round(
        (liveStats.bewegungszeitS || liveStats.durationS) / liveStats.distanceKm,
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
    const { data, error } = vorhandeneId
      ? await supabase.from('runs').update(kennzahlen).eq('id', vorhandeneId).select().single()
      : await supabase.from('runs').insert({ user_id: user.id, ...kennzahlen }).select().single()

    if (error || !data) {
      set({ phase: 'tracking' })
      return { runId: null, error: error?.message ?? 'Lauf konnte nicht gespeichert werden' }
    }

    const runId = (data as Run).id

    // Der Rest aus dem Puffer. Das meiste ist waehrend des Laufs schon
    // uebertragen worden – hier bleiben nur die letzten Sekunden.
    //
    // Falls beim Start kein Netz war und die Lauf-Zeile erst jetzt entstand,
    // haben die gepufferten Punkte eine andere Kennung: Sie werden auf die
    // richtige umgeschrieben, bevor sie rausgehen.
    if (!vorhandeneId) {
      const liegend = await offenePunkte()
      for (const punkt of liegend) {
        if (punkt.run_id !== runId) await punktMerken({ ...punkt, run_id: runId })
      }
    }
    await offeneSenden()

    if (splits.length > 0) {
      await supabase.from('run_splits').insert(
        splits.map((s, i) => ({
          run_id: runId,
          split_number: i + 1,
          distance_km: s.distance_km,
          duration_s: s.duration_s,
          pace_s_per_km: s.pace_s_per_km,
          elevation_gain_m: s.elevation_gain_m,
        })),
      )
    }

    set({ phase: 'completed', splits, activeRunId: runId })
    return { runId, error: null }
  },

  // Verwerfen heisst hier wirklich verwerfen: Es gibt nichts zu loeschen,
  // weil waehrend des Laufs nichts geschrieben wurde.
  discardRun: () => {
    // Erst den Dienst beenden, dann seine Punkte wegwerfen - in dieser
    // Reihenfolge. Andersherum schriebe er waehrend des Loeschens weiter,
    // und ein paar Punkte des verworfenen Laufs blieben liegen.
    const sitzung = get().sitzungId
    aufzeichnungStoppen().then(() => {
      if (sitzung) punkteVerwerfen(sitzung)
    })

    set({
      phase: 'idle',
      activeRunId: null,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
      startedAtMs: null,
      sitzungId: null,
      dienstHindernis: null,
      elevationRefM: null,
      // Der Ruhepegel wird bewusst NICHT zurueckgesetzt: Er beschreibt das
      // Geraet, nicht den Lauf, und wird ueber viele Laeufe hinweg besser.
      bewegung: START_ZUSTAND,
      ortungsverlauf: [],
      lastAccuracyM: null,
      pauseStart: null,
      totalPausedMs: 0,
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
    const vorherige = get().ortungsverlauf.at(-1) ?? null

    const { mps: tempoMps, ausMessung } = tempoErmitteln(ortung, vorherige)

    // Ruhepegel messen, solange die Nettoverschiebung Stillstand zeigt. Das
    // Mass kommt ohne Geschwindigkeit aus - nur deshalb laesst sich damit die
    // Geschwindigkeit im Stand ueberhaupt vermessen, ohne sich in den Schwanz
    // zu beissen. Nur echte Messwerte zaehlen: Distanz durch Zeit wuerde den
    // Pegel mit genau dem Rauschen fuellen, gegen das er schuetzen soll.
    const ruhepegel = get().ruhepegel
    if (ausMessung && stehtStill(verlauf, jetztMs)) {
      ruhepegel.hinzufuegen(tempoMps)
      ruhepegelSichern(ruhepegel)
    }

    const tor = torMps(ruhepegel.wert())
    const bewegung = bewegungFortschreiben(get().bewegung, ortung, tempoMps, tor)

    // Bewegungszeit waechst hier und nicht im Anzeigetakt.
    //
    // Der Takt laeuft im Browser; sobald die App in den Hintergrund geht,
    // drosselt ihn das System auf wenige Aufrufe je Minute. Die Laufzeit
    // uebersteht das, weil sie aus der Uhrzeit gerechnet wird - eine
    // hochgezaehlte Bewegungszeit wuerde dagegen still zu klein werden.
    // An den Messungen entlang gezaehlt stimmt sie unabhaengig davon.
    // Die Bewegungszeit haengt an DIESER Messung, nicht am entprellten
    // Zustand. Sonst laeuft sie nach dem Anhalten noch bis zu zehn Sekunden
    // weiter - so lange braucht der Zustand, bis er "steht" sagt. Am
    // 21.08.2026 im Zug beobachtet: Das Tempo war sofort weg, die aktive
    // Zeit lief weiter, und zwei Anzeigen widersprachen einander.
    let bewegungszeitS = get().liveStats.bewegungszeitS
    if (vorherige) {
      bewegungszeitS += bewegungszeitZuwachsS(
        bewegung.inBewegung,
        tempoMps,
        tor,
        (jetztMs - vorherige.zeit) / 1000,
      )
    }

    const prev = get().points
    let { distanceKm, elevationGainM } = get().liveStats
    let hoeheRef = get().elevationRefM

    // Steht die Person, wird nichts aufgezeichnet: keine Strecke, kein Punkt.
    // Damit bleibt auch die Karte sauber - der Zickzack im Stand war dasselbe
    // Rauschen, nur sichtbar.
    if (!bewegung.inBewegung) {
      set({
        ortungsverlauf: verlauf,
        bewegung,
        ruhepegel,
        liveStats: { ...get().liveStats, bewegungszeitS, inBewegung: false },
      })
      return
    }

    // Zu ungenau fuer Strecke und Karte - das Tempo hat er trotzdem
    // beigetragen, weil er im Verlauf steht.
    if (genauigkeit != null && genauigkeit > MAX_ACCURACY_M) {
      set({
        ortungsverlauf: verlauf,
        bewegung,
        ruhepegel,
        liveStats: { ...get().liveStats, bewegungszeitS, inBewegung: true },
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
          ruhepegel,
          liveStats: { ...get().liveStats, bewegungszeitS, inBewegung: true },
        })
        return
      }

      // Ortungssprung: Der Punkt wird zum neuen Bezug, seine Strecke zaehlt
      // aber nicht. Geprueft wird ueber das Tempo, weil eine feste
      // Streckengrenze bei langer Pause zwischen zwei Messungen zuschlaegt und
      // bei kurzer einen unmoeglichen Satz durchlaesst.
      const sekunden =
        (new Date(pt.recorded_at).getTime() - new Date(last.recorded_at).getTime()) / 1000
      const sprungTempo = sekunden > 0 ? (segKm * 1000) / sekunden : Infinity
      const sprung = segKm > MAX_SEGMENT_KM || sprungTempo > MAX_TEMPO_MPS

      if (!sprung) {
        distanceKm += segKm
      }
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
        elevationGainM,
        bewegungszeitS,
        inBewegung: true,
      },
      elevationRefM: hoeheRef,
      ortungsverlauf: verlauf,
      bewegung,
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
      await offeneSenden()
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
    const durationS = Math.max(0, Math.floor((jetzt - startedAtMs) / 1000))

    // Alle 30 Sekunden uebertragen. Der Takt laeuft ohnehin jede Sekunde –
    // ein eigener Zeitgeber waere ein zweiter Ort, an dem etwas haengen
    // bleiben kann.
    if (durationS > 0 && durationS % 30 === 0) get().punkteUebertragen()

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
    const tempoJetzt = tempoJetztMps(ortungsverlauf, jetzt)
    const tor = torMps(get().ruhepegel.wert())
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

    set({ recentRuns: [], selectedRun: null, selectedRunSplits: [], selectedRunPoints: [] })
    return { anzahl: (data ?? []).length, error: null }
  },

  fetchRecentRuns: async (limit = 50) => {
    set({ loading: true })
    const { data } = await supabase
      .from('runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    set({ recentRuns: (data ?? []) as Run[], loading: false })
  },

  fetchRun: async (id) => {
    set({ loading: true })
    const { data } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single()

    set({ selectedRun: (data as Run) ?? null, loading: false })
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
    const { data } = await supabase
      .from('run_points')
      .select('*')
      .eq('run_id', runId)
      .order('recorded_at', { ascending: true })

    set({ selectedRunPoints: (data ?? []) as RunPoint[] })
  },

  reset: () =>
    set({
      phase: 'idle',
      activeRunId: null,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
      startedAtMs: null,
      sitzungId: null,
      dienstHindernis: null,
      elevationRefM: null,
      // Der Ruhepegel wird bewusst NICHT zurueckgesetzt: Er beschreibt das
      // Geraet, nicht den Lauf, und wird ueber viele Laeufe hinweg besser.
      bewegung: START_ZUSTAND,
      ortungsverlauf: [],
      lastAccuracyM: null,
      pauseStart: null,
      totalPausedMs: 0,
    }),
}))

/** Mittelwert der Hoehe ueber die uebergebenen Punkte; null, wenn keiner eine hat. */
function mittlereHoehe(punkte: PointBuffer[]): number | null {
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
function hoeheAktualisieren(
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

function computeSplits(points: PointBuffer[]): LiveSplit[] {
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
    const seg = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
    if (seg > MAX_SEGMENT_KM) continue

    splitDist += seg
    // Stehzeit aus dem Abschnitt herausrechnen.
    //
    // Waehrend Stillstand wird kein Punkt aufgezeichnet. Zwischen zwei
    // gespeicherten Punkten kann also eine Pause liegen, und die reine
    // Zeitdifferenz waere dann zu gross - der Abschnitt saehe langsamer aus,
    // als gelaufen wurde.
    //
    // Aufgezeichnet wurde nur, wo Bewegung erkannt war, also mindestens mit
    // BEWEGUNG_MPS. Laenger als Strecke geteilt durch dieses Tempo kann der
    // bewegte Teil deshalb nicht gedauert haben. Was darueber hinausgeht,
    // war Stehen.
    const rohSekunden =
      (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000
    splitDauerS += Math.max(0, Math.min(rohSekunden, (seg * 1000) / BEWEGUNG_MPS))

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
