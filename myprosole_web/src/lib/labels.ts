import type { ExerciseCategory, ExerciseDifficulty, ExerciseModality, MuscleRole } from '../types'

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: 'Kraft',
  technique: 'Technik',
  // "Beweglichkeit" wie in den Entwuerfen; "Mobilität" war eine Abweichung
  // aus der ersten Portierung und klingt zudem nach Fachjargon.
  mobility: 'Beweglichkeit',
  injury_prevention: 'Prävention',
}

export const DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  beginner: 'Anfänger',
  intermediate: 'Mittel',
  advanced: 'Fortgeschritten',
}

export const MODALITY_LABELS: Record<ExerciseModality, string> = {
  gym: 'Gym',
  bodyweight: 'Bodyweight',
  both: 'Beides',
}

export const MUSCLE_ROLE_LABELS: Record<MuscleRole, string> = {
  primary: 'Primär',
  secondary: 'Sekundär',
}
