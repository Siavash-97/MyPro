import type { Exercise, ExerciseCategory, ExerciseDifficulty, ExerciseModality, MuscleRole } from '../types'

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

/**
 * Die Vorgabe einer Übung als ein Satz – "3 × 12", "3 × 30–60 Sek." oder
 * "3 Durchgänge".
 *
 * An einer Stelle, weil drei Seiten dieselbe Angabe zeigen: die Übungsliste,
 * die Übungsseite und die Mikroroutine. Getrennt formatiert liefen sie
 * auseinander, sobald sich eine Regel ändert.
 */
export function vorgabeText(
  uebung: Pick<Exercise, 'saetze' | 'wiederholungen' | 'dauer_sekunden_von' | 'dauer_sekunden_bis'>,
): string {
  const { saetze, wiederholungen, dauer_sekunden_von: von, dauer_sekunden_bis: bis } = uebung

  if (wiederholungen != null) {
    return `${saetze} × ${wiederholungen} Wiederholungen`
  }
  if (von != null && bis != null) {
    // Halbgeviertstrich zwischen den Zahlen, kein Bindestrich: Es ist eine
    // Spanne, keine Verbindung zweier Wörter.
    return von === bis
      ? `${saetze} × ${von} Sekunden halten`
      : `${saetze} × ${von}–${bis} Sekunden halten`
  }
  // Weder noch: eine Übung über eine Strecke, etwa Lauf-ABC.
  return saetze === 1 ? '1 Durchgang' : `${saetze} Durchgänge`
}
