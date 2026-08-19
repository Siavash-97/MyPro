import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useExercises } from '../store/exercises'
import { routineAuswahl } from '../lib/mikroroutine'
import { vorgabeText } from '../lib/labels'
import Icon from '../components/ui/Icon'
import { useRun } from '../store/run'
import { useWorkout } from '../store/workout'
import {
  PLAN_DAYS,
  hasPlan,
  kmForDate,
  planIndexForDate,
  planTotalKm,
  upcomingDays,
} from '../lib/runningPlan'
import { useRunningPlan } from '../store/runningPlan'

function formatKm(km: number): string {
  return km.toFixed(1).replace('.', ',')
}


export default function Training() {
  // Der Katalog steht nicht mehr hier, sondern nur noch dort, wo man ihn
  // braucht: beim Zusammenstellen eines Plans. Diese Seite zeigt den
  // Wochenplan und die Empfehlungen.
  const fetchReferenceData = useExercises((s) => s.fetchReferenceData)
  const uebungen = useExercises((s) => s.exercises)
  const gruppen = useExercises((s) => s.groups)
  const uebungenDerGruppe = useExercises((s) => s.uebungenDerGruppe)

  const { recentRuns, fetchRecentRuns } = useRun()
  const { plan: weekPlan, fetchPlan } = useRunningPlan()
  const routinen = useWorkout((s) => s.mikroroutinenDieseWoche)
  const fetchMikroroutinenAb = useWorkout((s) => s.fetchMikroroutinenAb)

  // Wie viele Uebungen die Routine wirklich hat. Vorher stand hier fest
  // "3 Uebungen" im Text – und die Karte versprach sie auch dann, wenn der
  // Katalog leer war. Der Weg fuehrte dann in eine Sackgasse.
  const routineLaenge = routineAuswahl(uebungen).length

  const planExists = hasPlan(weekPlan)
  const weekPlanKm = planTotalKm(weekPlan)
  const today = new Date()
  const todayKm = kmForDate(weekPlan, today)
  const todayLabel = PLAN_DAYS[planIndexForDate(today)].label
  const upcoming = upcomingDays(weekPlan)

  // Die Woche beginnt am Montag – dieselbe Grenze gilt für die gelaufenen
  // Kilometer und für die gezählten Routinen.
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - planIndexForDate(today))
  weekStart.setHours(0, 0, 0, 0)
  const wochenbeginn = weekStart.getTime()

  useEffect(() => {
    fetchReferenceData()
    fetchRecentRuns(50)
    fetchPlan()
    fetchMikroroutinenAb(new Date(wochenbeginn))
  }, [fetchReferenceData, fetchRecentRuns, fetchPlan, fetchMikroroutinenAb, wochenbeginn])

  const weekRunKm = recentRuns
    .filter((r) => r.status === 'completed' && new Date(r.started_at) >= weekStart)
    .reduce((acc, r) => acc + (r.distance_km ?? 0), 0)
  const weekProgress = weekPlanKm > 0 ? Math.min(100, (weekRunKm / weekPlanKm) * 100) : 0

  return (
    <>
      {/* Wochenplan wie in uebungen.html: erst der Stand, dann heute, dann die
          naechsten Tage. Der Katalog steht darunter und ist nicht mehr das
          Erste, was der Tab zeigt. */}
      {planExists && (
        <>
          <section className="md-card" aria-labelledby="woche-titel">
            <div className="md-row" style={{ marginBottom: 'var(--space-sm)', cursor: 'default' }}>
              <h2 className="md-section-title" id="woche-titel" style={{ margin: 0 }}>Diese Woche</h2>
              <span style={{ font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                {formatKm(weekRunKm)} / {formatKm(weekPlanKm)} km
              </span>
            </div>
            <div className="md-progress">
              <div className="md-progress__fill" style={{ width: `${weekProgress}%` }} />
            </div>
            <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Offene Einheiten kannst du bis Sonntag nachholen.
            </p>
          </section>

          <div>
            <p className="md-section-title">Heute</p>
            <ol className="md-week-plan">
              <li className="md-week-plan__day md-week-plan__day--today md-week-plan__day--stacked">
                <span className="md-week-plan__label">{todayLabel}</span>
                <span className="md-week-plan__unit">
                  {todayKm > 0 ? `Lauf · ${formatKm(todayKm)} km` : 'Ruhetag'}
                  <small>{todayKm > 0 ? 'Aus deinem Wochenplan' : 'Erholung gehört zum Plan'}</small>
                </span>
                {todayKm > 0 && (
                  <Link className="md-button md-button--filled md-button--compact md-week-plan__action" to="/lauf/tracking">
                    Starten
                  </Link>
                )}
              </li>
            </ol>
          </div>

          <section className="md-card" aria-labelledby="naechste-titel">
            <div className="md-row" style={{ marginBottom: 'var(--space-sm)', cursor: 'default' }}>
              <p className="md-section-title" id="naechste-titel" style={{ margin: 0 }}>Nächste Tage</p>
              <Link to="/training/laufplan" style={{ font: 'var(--type-label-lg)', color: 'var(--md-primary)', textDecoration: 'none' }}>
                Plan bearbeiten
              </Link>
            </div>
            <ol className="md-week-plan md-week-plan--ahead" aria-label="Die nächsten 7 Tage">
              {upcoming.map((day, i) => (
                <li key={i} className="md-week-plan__day md-week-plan__day--ahead">
                  <span className="md-week-plan__label">{day.label}</span>
                  <span className="md-week-plan__unit">
                    {day.km > 0 ? `Lauf · ${formatKm(day.km)} km` : 'Ruhe oder lockeres Cross-Training'}
                    {day.when && <small>{day.when}</small>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {/* Die Grundausstattung: fuenf Gruppen, je sechs Uebungen, alle ohne
          Geraet (Migrationen 0040 und 0041). Frei fuer jeden - das
          personalisierte Angebot fuer Einlagentraeger setzt darauf auf und
          steht als Hinweis darunter, nicht als Sperre davor.

          Die Reihenfolge kommt aus der Datenbank (position), damit sie sich
          aendern laesst, ohne den Quelltext anzufassen. */}
      {gruppen.map((gruppe) => {
        const liste = uebungenDerGruppe(gruppe.id)
        if (liste.length === 0) return null
        return (
          // <details> statt eines eigenen Auf-und-Zu: Der Browser bringt das
          // Verhalten mit, samt Tastatur und Vorlesen.
          //
          // Alle zu beim Betreten. So sieht man zuerst die fuenf Bereiche auf
          // einen Blick und oeffnet den, um den es geht - statt durch eine
          // lange Liste zu scrollen, die schon jemand anders fuer einen
          // aufgeklappt hat.
          <details
            key={gruppe.id}
            className="md-analysis-section"
            style={{ marginBottom: 'var(--space-sm)' }}
          >
            <summary>
              <span>
                <strong>{gruppe.name_de}</strong>
                <small>{liste.length} Übungen</small>
              </span>
              <Icon name="chevron-down" className="icon" />
            </summary>
            <div className="md-analysis-section__content">
              <p style={{
                margin: 'var(--space-sm) 0',
                font: 'var(--type-body-md)',
                color: 'var(--md-on-surface-variant)',
              }}>
                {gruppe.lead_de}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                {liste.map((ue) => {
                  const ziel = ue.exercise_muscles
                    .filter((m) => m.role === 'primary')
                    .map((m) => m.muscle_groups.name_de)
                    .join(', ')
                  return (
                    <Link
                      key={ue.id}
                      to={`/training/uebung/${ue.slug}`}
                      className="md-list-item"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <span className="md-list-item__thumb" aria-hidden="true">
                        <Icon name="training" />
                      </span>
                      {/* p statt span: Die Klassen tragen Raender, und die
                          wirken nur an Blockelementen. Mit span standen Name
                          und Zielangabe ohne Abstand aneinander -
                          "WandstuetzHueftbeuger". */}
                      <div className="md-list-item__body">
                        <p className="md-list-item__title">{ue.name_de}</p>
                        <p className="md-list-item__meta">
                          {vorgabeText(ue)}{ziel && ` (${ziel})`}
                        </p>
                      </div>
                      <Icon name="chevron-right" className="icon md-row__chevron" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </details>
        )
      })}

      {/* Der Hinweis auf das personalisierte Angebot. Bewusst unter den
          Uebungen und nicht davor: Erst zeigen, was es umsonst gibt, dann
          sagen, was daraus werden kann. */}
      {gruppen.length > 0 && (
        <section className="md-insole-promo">
          <div className="md-insole-promo__icon">
            <Icon name="sensors" className="icon" />
          </div>
          <div>
            <p className="md-insole-promo__eyebrow">Mit Sensoreinlagen</p>
            <h2 className="md-insole-promo__title">Diese Übungen – auf dich zugeschnitten</h2>
            <p className="md-insole-promo__text">
              Oben stehen die Übungen, die für alle passen. Mit Einlagen misst
              MyProSole, wie du wirklich abrollst, belastest und abdrückst – und
              stellt daraus deine eigene Auswahl zusammen statt einer allgemeinen.
            </p>
          </div>
          <div className="md-insole-promo__actions">
            <Link to="/einlagen" className="md-button md-button--tonal md-button--compact">
              Einlagen kennenlernen
            </Link>
          </div>
        </section>
      )}

      {/* Ein Einstieg statt einer Auswahl: Die Reihenfolge steht fest, wer hier
          aussucht, umgeht sie. Das Videobild zeigt, dass angeleitet wird.

          Ist der Katalog leer, wird der Einstieg gar nicht erst angeboten.
          Ein Knopf, der in eine leere Seite fuehrt, ist schlimmer als kein
          Knopf: Er verspricht etwas und laesst den Nutzer den Fehler
          suchen. */}
      <div>
        <p className="md-section-title">Für dich empfohlen</p>
        {routineLaenge === 0 ? (
          <div className="md-info-note md-info-note--neutral">
            <Icon name="training" size={20} className="icon icon-sm" />
            <div>
              <p style={{ margin: 0 }}>
                Für die Routine sind noch keine Übungen hinterlegt. Sobald sie
                zu deiner Anamnese passend ausgewählt sind, erscheinen sie hier.
              </p>
            </div>
          </div>
        ) : (
          <Link className="md-routine-start" to="/training/routine">
            <span className="md-video-placeholder" aria-hidden="true">
              <Icon name="play" size={48} />
            </span>
            <span className="md-routine-start__body">
              <span className="md-routine-start__title">Übungen starten</span>
              <span className="md-routine-start__meta">
                {routineLaenge} {routineLaenge === 1 ? 'Übung' : 'Übungen'} · rund {routineLaenge * 2} Minuten · mit Videoanleitung
              </span>
            </span>
          </Link>
        )}
      </div>

      {/* Diese Woche gezählt. Eine abgebrochene Routine zählt mit, sofern
          mindestens die Hälfte der Übungen gemacht wurde – sonst nicht. */}
      <section className="md-card" aria-labelledby="routinen-titel">
        <div className="md-row" style={{ marginBottom: 'var(--space-sm)', cursor: 'default' }}>
          <p className="md-section-title" id="routinen-titel" style={{ margin: 0 }}>
            Übungen diese Woche
          </p>
          <span style={{ font: 'var(--type-title-md)', color: 'var(--md-on-surface)' }}>
            {routinen}×
          </span>
        </div>
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          {routinen === 0
            ? 'Noch keine Einheit seit Montag. Sechs Minuten genügen.'
            : routinen === 1
              ? 'Eine Einheit seit Montag.'
              : `${routinen} Einheiten seit Montag.`}
        </p>
      </section>
    </>
  )
}
