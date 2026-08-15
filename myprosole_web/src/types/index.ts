export interface Profile {
  id: string
  display_name: string
  // Seit dem Profil-Einrichten nur noch den Namen erhebt, bleiben beide leer:
  // Pensum und Erfahrung kommen aus der Anamnese. Die Spalten bleiben
  // erhalten, damit bestehende Profile nichts verlieren.
  running_level: 'anfaenger' | 'fortgeschritten' | 'erfahren' | null
  weekly_goal_km: number | null
  avatar_url: string | null
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
  is_active: boolean
  created_at: string
  updated_at: string
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

export interface ExerciseWithRelations extends Exercise {
  exercise_muscles: (ExerciseMuscle & { muscle_groups: MuscleGroup })[]
  exercise_equipment: (ExerciseEquipment & { equipment: Equipment })[]
}

export interface GymPlan {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GymPlanExercise {
  id: string
  gym_plan_id: string
  exercise_id: string
  position: number
  sets: number | null
  reps: number | null
  duration_seconds: number | null
  /** Zusatzgewicht in Kilogramm; null bei Koerpergewichtsuebungen. */
  weight_kg: number | null
  /** Pause zwischen den Saetzen in Sekunden; null, wenn nicht vorgegeben. */
  rest_seconds: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GymPlanEquipment {
  gym_plan_id: string
  equipment_id: string
  created_at: string
  updated_at: string
}

export interface GymPlanWithExercises extends GymPlan {
  gym_plan_exercises: (GymPlanExercise & { exercises: Exercise })[]
  gym_plan_equipment: (GymPlanEquipment & { equipment: Equipment })[]
}

export type WorkoutLogStatus = 'in_progress' | 'completed' | 'abandoned'

export interface WorkoutLog {
  id: string
  user_id: string
  gym_plan_id: string | null
  status: WorkoutLogStatus
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

export interface WorkoutLogWithExercises extends WorkoutLog {
  workout_log_exercises: (WorkoutLogExercise & { exercises: Exercise })[]
  gym_plans: GymPlan | null
}

export type Art9ConsentScope = 'anamnese' | 'training_diary' | 'all'

export interface Art9Consent {
  id: string
  user_id: string
  scope: Art9ConsentScope
  granted_at: string
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
