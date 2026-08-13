import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useExercises } from '../store/exercises'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, MODALITY_LABELS } from '../lib/labels'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function ExerciseDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { getExercise, fetchReferenceData, loaded, loading } = useExercises()

  useEffect(() => {
    fetchReferenceData()
  }, [fetchReferenceData])

  const exercise = slug ? getExercise(slug) : undefined

  if (loading && !loaded) return <LoadingSpinner />

  if (!exercise) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-on-surface-variant">Übung nicht gefunden.</p>
        <button
          type="button"
          onClick={() => navigate('/training')}
          className="mt-4 text-sm font-medium text-primary"
        >
          Zurück zum Training
        </button>
      </div>
    )
  }

  const primaryMuscles = exercise.exercise_muscles.filter((m) => m.role === 'primary')
  const secondaryMuscles = exercise.exercise_muscles.filter((m) => m.role === 'secondary')
  const equipment = exercise.exercise_equipment

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-medium text-on-surface">{exercise.name_de}</h2>
        {exercise.name_en && (
          <p className="text-sm text-on-surface-variant mt-0.5">{exercise.name_en}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center h-7 px-3 rounded-full bg-primary-container text-on-primary-container text-xs font-medium">
          {CATEGORY_LABELS[exercise.category]}
        </span>
        <span className="inline-flex items-center h-7 px-3 rounded-full bg-secondary-container text-on-secondary-container text-xs font-medium">
          {DIFFICULTY_LABELS[exercise.difficulty]}
        </span>
        <span className="inline-flex items-center h-7 px-3 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-medium">
          {MODALITY_LABELS[exercise.modality]}
        </span>
      </div>

      {/* Description */}
      <div className="rounded-xl bg-surface-container p-4">
        <p className="text-sm text-on-surface leading-relaxed">{exercise.description_de}</p>
      </div>

      {/* Muscle groups */}
      {(primaryMuscles.length > 0 || secondaryMuscles.length > 0) && (
        <div>
          <h3 className="text-sm font-medium text-on-surface mb-2">Muskelgruppen</h3>
          <div className="flex flex-col gap-2">
            {primaryMuscles.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-on-surface-variant mt-0.5 w-16 shrink-0">Primär</span>
                <div className="flex flex-wrap gap-1.5">
                  {primaryMuscles.map((m) => (
                    <span
                      key={m.muscle_group_id}
                      className="inline-flex items-center h-6 px-2.5 rounded-full bg-primary-container text-on-primary-container text-xs"
                    >
                      {m.muscle_groups.name_de}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {secondaryMuscles.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-on-surface-variant mt-0.5 w-16 shrink-0">Sekundär</span>
                <div className="flex flex-wrap gap-1.5">
                  {secondaryMuscles.map((m) => (
                    <span
                      key={m.muscle_group_id}
                      className="inline-flex items-center h-6 px-2.5 rounded-full bg-surface-container text-on-surface-variant text-xs"
                    >
                      {m.muscle_groups.name_de}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equipment */}
      {equipment.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-on-surface mb-2">Equipment</h3>
          <div className="flex flex-wrap gap-1.5">
            {equipment.map((eq) => (
              <span
                key={eq.equipment_id}
                className="inline-flex items-center h-6 px-2.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs"
              >
                {eq.equipment.name_de}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <div className="pt-2 border-t border-outline-variant">
        <p className="text-xs text-on-surface-variant">
          Quelle: {exercise.source_name} · {exercise.source_license}
        </p>
      </div>
    </div>
  )
}
