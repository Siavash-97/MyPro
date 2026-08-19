export interface Profile {
  id: string
  /**
   * Null heisst: noch nicht eingerichtet. Zwischen Registrierung und
   * Profil-Einrichtung gibt es noch keinen Namen – ein normaler Zustand,
   * den die Tabelle bis Migration 0031 nicht kannte. Genau deshalb hat der
   * Ausloeser in der Datenbank vorher einen aus der E-Mail geraten.
   */
  display_name: string | null
  // Seit dem Profil-Einrichten nur noch den Namen erhebt, bleiben beide leer:
  // Pensum und Erfahrung kommen aus der Anamnese. Die Spalten bleiben
  // erhalten, damit bestehende Profile nichts verlieren.
  running_level: 'anfaenger' | 'fortgeschritten' | 'erfahren' | null
  weekly_goal_km: number | null
  avatar_url: string | null
  /**
   * Womit die App zuletzt benutzt wurde, und die Zeitzone des Geraets als
   * grobe Herkunftsangabe (Migration 0036).
   *
   * Beide nur gefuellt, solange die Erlaubnis 'analyse' gilt; beim Widerruf
   * werden sie geleert. Sie ersetzen die Auswertung von IP-Adressen: Die
   * IP ist ein personenbezogenes Datum und enthaelt ausserdem gar kein
   * Betriebssystem.
   */
  plattform: 'android' | 'ios' | 'web' | null
  zeitzone: string | null
  created_at: string
  updated_at: string
}

export interface Equipment {
  id: string
  slug: string
  name_de: string
  name_en: string | null
  created_at: string
  updated_at: string
}

export interface MuscleGroup {
  id: string
  slug: string
  name_de: string
  name_en: string | null
  created_at: string
  updated_at: string
}

export type ExerciseCategory = 'strength' | 'technique' | 'mobility' | 'injury_prevention'
export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type ExerciseModality = 'gym' | 'bodyweight' | 'both'
export type MuscleRole = 'primary' | 'secondary'

export interface Exercise {
  id: string
  slug: string
  name_de: string
  name_en: string | null
  description_de: string
  description_en: string | null
  category: ExerciseCategory
  difficulty: ExerciseDifficulty
  modality: ExerciseModality
  image_url: string | null
  video_url: string | null
  source_name: string
  source_license: string

  /**
   * Vorgabe je Übung (Migration 0042). Drei Arten, die sich ausschließen:
   *
   *   wiederholt  – saetze × wiederholungen, etwa 3 × 12
   *   gehalten    – saetze × dauer_sekunden_von bis _bis, etwa 30 bis 60 Sek.
   *   Strecke     – nur saetze (Durchgänge); beim Lauf-ABC steht die Strecke
   *                 im Einleitungstext der Gruppe, weil sie für alle gilt
   *
   * `wiederholungen` und `dauer_sekunden_von` sind nie beide gesetzt – das
   * erzwingt eine Prüfbedingung in der Datenbank.
   */
  saetze: number
  wiederholungen: number | null
  dauer_sekunden_von: number | null
  dauer_sekunden_bis: number | null

  is_active: boolean
  created_at: string
  updated_at: string
  /** In welcher Gruppe die Übung auf der Trainingsseite steht. Null: in keiner. */
  group_id: string | null
}

export interface ExerciseMuscle {
  exercise_id: string
  muscle_group_id: string
  role: MuscleRole
  created_at: string
  updated_at: string
}

export interface ExerciseEquipment {
  exercise_id: string
  equipment_id: string
  created_at: string
  updated_at: string
}

/**
 * Eine Gruppe auf der Trainingsseite (Migration 0040/0041).
 *
 * Nicht zu verwechseln mit `Exercise.category`: Die beschreibt die ART einer
 * Übung (Kraft, Beweglichkeit, Technik), die Gruppe den Körperbereich und
 * das Ziel. "Knie kräftigen" und "Bauch und Po" wären beide `strength`.
 */
export interface ExerciseGroup {
  id: string
  slug: string
  name_de: string
  /** Ein Satz, der über den Übungen der Gruppe steht. */
  lead_de: string
  position: number
  is_active: boolean
}

export interface ExerciseWithRelations extends Exercise {
  exercise_muscles: (ExerciseMuscle & { muscle_groups: MuscleGroup })[]
  exercise_equipment: (ExerciseEquipment & { equipment: Equipment })[]
}

export type WorkoutLogStatus = 'in_progress' | 'completed' | 'abandoned'

/**
 * Woher eine Einheit stammt (Migration 0030).
 *
 * 'gym' entsteht seit Migration 0038 nicht mehr neu – der Gym-Trainingsplan
 * ist weggefallen. Der Wert bleibt, weil bereits protokollierte Einheiten
 * ihn tragen und der Verlauf sie weiterhin zeigen soll.
 */
export type WorkoutSource = 'gym' | 'mikroroutine'

export interface WorkoutLog {
  id: string
  user_id: string
  status: WorkoutLogStatus
  source: WorkoutSource
  started_at: string
  ended_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WorkoutLogExercise {
  id: string
  workout_log_id: string
  exercise_id: string
  position: number
  actual_sets: number | null
  actual_reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Art9ConsentScope = 'anamnese' | 'training_diary' | 'cycle' | 'all'

/** Was die Zeile festhaelt. Seit 0027 ist die Tabelle eine Geschichte. */
export type Art9ConsentAction = 'granted' | 'revoked'

export interface Art9Consent {
  id: string
  user_id: string
  /** Heisst in der Datenbank consent_scope, nicht scope. */
  consent_scope: Art9ConsentScope
  action: Art9ConsentAction
  /** Zeitpunkt des Vorgangs – der Erteilung oder des Widerrufs. */
  consented_at: string
  /** Nicht mehr benutzt; ein Widerruf ist seit 0027 eine eigene Zeile. */
  revoked_at: string | null
  created_at: string
}

export type AnamneseBlock = 'a' | 'b'

export interface AnamneseSession {
  id: string
  user_id: string
  questionnaire_version: number
  block: AnamneseBlock
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AnamneseAnswer {
  id: string
  session_id: string
  question_key: string
  answer_value: string
  created_at: string
}

export type RunStatus = 'tracking' | 'paused' | 'completed' | 'abandoned'

export interface Run {
  id: string
  user_id: string
  status: RunStatus
  started_at: string
  ended_at: string | null
  paused_duration_s: number
  distance_km: number | null
  duration_s: number | null
  avg_pace_s_per_km: number | null
  elevation_gain_m: number | null
  score: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RunPoint {
  id: string
  run_id: string
  recorded_at: string
  latitude: number
  longitude: number
  altitude_m: number | null
  accuracy_m: number | null
  speed_mps: number | null
  created_at: string
}

export interface RunSplit {
  id: string
  run_id: string
  split_number: number
  distance_km: number
  duration_s: number
  pace_s_per_km: number
  elevation_gain_m: number | null
  created_at: string
}

export type DiaryFeeling = 'gut' | 'okay' | 'schwer'
export type BodyLocation =
  | 'knie' | 'sprunggelenk' | 'schienbein' | 'achillessehne'
  | 'huefte' | 'ruecken' | 'wade' | 'fuss' | 'sonstiges'

export interface TrainingDiaryEntry {
  id: string
  user_id: string
  date: string
  distance_km: number | null
  duration_minutes: number | null
  pace_min_per_km: number | null
  feeling: DiaryFeeling | null
  has_pain: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TrainingDiaryPainLocation {
  diary_entry_id: string
  location: BodyLocation
  created_at: string
}

// ---------------------------------------------------------------------------
// Einwilligungen (Schema `einwilligung`, ab Migration 0034)
//
// Loest die Typen um Art9Consent oben ab. Jene bleiben stehen, solange die
// Tabelle public.art9_consents als Archiv existiert – eine aeltere App-Fassung
// auf einem Telefon fragt sie weiterhin ab.
// ---------------------------------------------------------------------------

/** Wofuer um Erlaubnis gefragt wird. Entspricht dem Aufzaehlungstyp in der Datenbank. */
export type EinwilligungZweck =
  | 'gesundheitsdaten'
  | 'notwendige_cookies'
  | 'analyse'

export type EinwilligungEntscheidung = 'erteilt' | 'widerrufen'

/** Der Wortlaut, dem zugestimmt wird – das Beweisstueck. */
export interface EinwilligungsText {
  id: string
  zweck: EinwilligungZweck
  /** Sprechend, zum Beispiel '2026-08-v1'. */
  version: string
  titel: string
  wortlaut: string
  /** Ohne diese Erlaubnis laesst sich die App nicht sinnvoll benutzen. */
  pflicht: boolean
  /** Von der Datenbank berechnet, nicht von der App gesetzt. */
  wortlaut_hash: string
  gueltig_ab: string
}

export interface Einwilligung {
  id: string
  user_id: string
  zweck: EinwilligungZweck
  entscheidung: EinwilligungEntscheidung
  zeitpunkt: string
  text_version: string
  text_hash: string
  quelle: 'registrierung' | 'profil' | 'uebernahme'
}
