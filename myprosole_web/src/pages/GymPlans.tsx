import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTraining } from '../store/training'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'

/**
 * Gym-Trainingsplan (gym-plan.html).
 *
 * Eigene Seite, erreichbar ueber den Knopf oben rechts auf der
 * Uebungsseite – so steht es im Entwurf. Vorher standen die Plaene mitten
 * zwischen Empfehlungen und Katalog auf der Uebungsseite; dort gehen sie
 * unter, und die Uebungsseite wird zu lang.
 */
export default function GymPlans() {
  const { plans, fetchPlans, loading } = useTraining()

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  return (
    <>
      <div className="md-row" style={{ marginBottom: 'var(--space-sm)', cursor: 'default' }}>
        <h2 className="md-section-title" style={{ margin: 0 }}>Deine Pläne</h2>
        <Link
          to="/training/plan/neu"
          style={{ font: 'var(--type-label-lg)', color: 'var(--md-primary)', textDecoration: 'none' }}
        >
          + Neuer Plan
        </Link>
      </div>

      {loading && plans.length === 0 ? (
        <LoadingSpinner />
      ) : plans.length === 0 ? (
        <EmptyState
          title="Noch keine Pläne"
          description="Leg deinen ersten Gym-Plan an – Name, Übungen und Vorgaben in einem Schritt."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/training/plan/${plan.id}`}
              className="md-list-item"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="md-list-item__thumb">
                <Icon name="lifter" size={20} className="icon-sm" />
              </div>
              <div className="md-list-item__body">
                <p className="md-list-item__title">{plan.name}</p>
                {plan.description && (
                  <p className="md-list-item__meta">{plan.description}</p>
                )}
              </div>
              <Icon name="chevron-right" className="icon md-row__chevron" />
            </Link>
          ))}
        </div>
      )}

      <Link className="md-button md-button--filled" to="/training/plan/neu" style={{ textDecoration: 'none' }}>
        Neuen Plan anlegen
      </Link>
    </>
  )
}
