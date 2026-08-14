import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useExercises } from '../store/exercises'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, MODALITY_LABELS } from '../lib/labels'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'

const chipStyle = { cursor: 'default' } as const

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
      <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Übung nicht gefunden.
        </p>
        <button
          type="button"
          onClick={() => navigate('/training')}
          className="md-button md-button--text md-button--compact"
          style={{ marginTop: 'var(--space-md)' }}
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
    <>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, font: 'var(--type-title-lg)', color: 'var(--md-on-surface)' }}>
          {exercise.name_de}
        </h2>
        {exercise.name_en && (
          <p style={{ margin: '2px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            {exercise.name_en}
          </p>
        )}
      </div>

      {/* Video / Anleitung */}
      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {exercise.video_url ? (
          <video
            src={exercise.video_url}
            controls
            poster={exercise.image_url ?? undefined}
            style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', background: 'var(--md-surface-container-high)' }}
          />
        ) : exercise.image_url ? (
          <img
            src={exercise.image_url}
            alt={`Ausführung: ${exercise.name_de}`}
            style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }}
          />
        ) : (
          <div className="md-video-placeholder" aria-hidden="true">
            <Icon name="play" size={48} />
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="md-chip-set">
        <span className="md-choice-chip" style={chipStyle}>{CATEGORY_LABELS[exercise.category]}</span>
        <span className="md-choice-chip" style={chipStyle}>{DIFFICULTY_LABELS[exercise.difficulty]}</span>
        <span className="md-choice-chip" style={chipStyle}>{MODALITY_LABELS[exercise.modality]}</span>
      </div>

      {/* Description */}
      <div className="md-card">
        <p style={{ margin: 0, font: 'var(--type-body-lg)', color: 'var(--md-on-surface)' }}>
          {exercise.description_de}
        </p>
      </div>

      {/* Muscle groups */}
      {(primaryMuscles.length > 0 || secondaryMuscles.length > 0) && (
        <div>
          <p className="md-section-title">Muskelgruppen</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {primaryMuscles.length > 0 && (
              <div>
                <p style={{ margin: '0 0 var(--space-xs)', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
                  Primär
                </p>
                <div className="md-chip-set">
                  {primaryMuscles.map((m) => (
                    <span key={m.muscle_group_id} className="md-choice-chip" style={chipStyle}>
                      {m.muscle_groups.name_de}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {secondaryMuscles.length > 0 && (
              <div>
                <p style={{ margin: '0 0 var(--space-xs)', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
                  Sekundär
                </p>
                <div className="md-chip-set">
                  {secondaryMuscles.map((m) => (
                    <span key={m.muscle_group_id} className="md-choice-chip" style={chipStyle}>
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
          <p className="md-section-title">Equipment</p>
          <div className="md-chip-set">
            {equipment.map((eq) => (
              <span key={eq.equipment_id} className="md-choice-chip" style={chipStyle}>
                {eq.equipment.name_de}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
        Quelle: {exercise.source_name} · {exercise.source_license}
      </p>
    </>
  )
}
