import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useRun, formatPace } from '../store/run'
import { ladezustand } from '../lib/ladezustand'
import { durchschnittstempoText } from '../lib/tempo'
import { hoehenmeterText } from '../lib/hoehenmeter'
import { formatDurationDisplay } from '../lib/format'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Zustandskarte from '../components/ui/Zustandskarte'
import Icon from '../components/ui/Icon'

/**
 * Laufanalyse (analyse-ergebnis.html).
 *
 * Zeigt den Lauf-Score als Ring, die erkannten Auffaelligkeiten, die Laufwerte
 * und – sobald Sensoreinlagen verbunden sind – die Biomechanik. Ohne Einlagen
 * steht dort der Hinweis aus dem Entwurf statt einer leeren Flaeche.
 */

const RING_CIRCUMFERENCE = 251.2

// Ab wann ein Kilometer als deutlich langsamer oder schneller gilt. Unterhalb
// dieser Schwelle ist der Unterschied Messrauschen und keine Beobachtung wert.
const NOTABLE_PACE_DIFF_S = 4
const OPENING_KM = 3

interface Finding {
  ok: boolean
  title: string
  desc: string
}

export default function RunAnalysis() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    selectedRun: run,
    selectedRunSplits: splits,
    loading,
    ladefehler,
    fetchRun,
    fetchRunSplits,
  } = useRun()

  // Ist fuer DIESE Kennung schon ein Ladeversuch zu Ende gegangen? Warum das
  // noetig ist, steht in lib/ladezustand.ts bei `geprueft`.
  const [geprueft, setGeprueft] = useState(false)

  // Ein Weg, zwei Anlaesse: das Oeffnen der Seite und "Erneut versuchen".
  // Die Abschnitte gehen mit - ohne sie faellt der ganze Abschnitt
  // "Erkannte Auffaelligkeiten" leer aus, obwohl der Lauf wieder dasteht.
  const laden = useCallback(() => {
    if (!id) {
      setGeprueft(true)
      return
    }
    setGeprueft(false)
    void fetchRun(id).finally(() => setGeprueft(true))
    fetchRunSplits(id)
  }, [id, fetchRun, fetchRunSplits])

  useEffect(() => {
    laden()
  }, [laden])

  // Vier Lagen, nicht eine - und wortgleich zur Laufdetailseite. Derselbe
  // Lauf, zwei Bildschirme nebeneinander: dasselbe Scheitern verdient
  // denselben Satz. Die Reihenfolge steht in lib/ladezustand.ts.
  const zustand = ladezustand({
    geprueft,
    laedt: loading,
    vorhanden: run?.id === id,
    fehler: ladefehler,
  })

  if (zustand === 'laedt') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (zustand === 'gescheitert') {
    return (
      <Zustandskarte
        fehler
        icon="warn"
        titel="Der Lauf lässt sich gerade nicht laden"
        // Der technische Grund steht NICHT hier - siehe RunDetail.tsx und
        // lib/melden.ts: "Nie eine Datenbankmeldung."
        text="Die Daten sind nicht angekommen. Meistens liegt es am Empfang. Probier es gleich noch einmal."
        aktion={
          <button type="button" className="md-button md-button--filled" onClick={laden}>
            Erneut versuchen
          </button>
        }
      />
    )
  }

  if (zustand === 'fehlt' || !run) {
    return (
      <Zustandskarte
        icon="history"
        titel="Diesen Lauf gibt es nicht"
        // Kein Wiederholen: Die Abfrage kam an und fand nichts.
        text="Vielleicht wurde er gelöscht. Deine gespeicherten Läufe stehen im Verlauf."
        aktion={
          <button
            type="button"
            className="md-button md-button--filled"
            onClick={() => navigate('/verlauf', { replace: true })}
          >
            Zum Verlauf
          </button>
        }
      />
    )
  }

  const started = new Date(run.started_at)
  const isToday = started.toDateString() === new Date().toDateString()
  const dayLabel = isToday
    ? 'Heute'
    : started.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = started.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  const paceDisplay = durchschnittstempoText({
    streckeKm: run.distance_km,
    gespeichertesTempoSJeKm: run.avg_pace_s_per_km,
    bewegungszeitS: run.moving_time_s,
    gesamtzeitS: run.duration_s,
  })

  // Die Hoehenangabe - oder null, solange sie nicht belastbar ist, und das
  // ist sie derzeit nie. Der Befund steht in lib/hoehenmeter.ts. Gerechnet
  // und gespeichert wird sie weiterhin, gezeigt nicht.
  const hoehenmeter = hoehenmeterText(run.elevation_gain_m)

  const meta = [
    `${dayLabel}, ${timeLabel} Uhr`,
    run.distance_km != null ? `${run.distance_km.toFixed(1).replace('.', ',')} km` : null,
    run.duration_s != null ? `${formatDurationDisplay(run.duration_s)} min` : null,
    `${paceDisplay} min/km`,
  ]
    .filter(Boolean)
    .join(' · ')

  const score = run.score
  const ringOffset =
    score != null ? RING_CIRCUMFERENCE * (1 - score / 100) : RING_CIRCUMFERENCE
  const verdict =
    score == null ? 'Lauf aufgezeichnet' : score >= 70 ? 'Guter Lauf' : score >= 50 ? 'Solider Lauf' : 'Ausbaufähig'

  // Auffaelligkeiten aus den tatsaechlichen Kilometer-Abschnitten, nicht aus
  // festen Texten: Anfang und Ende werden gegen den Schnitt des Laufs gehalten.
  const findings: Finding[] = []
  const ordered = [...splits].sort((a, b) => a.split_number - b.split_number)
  if (ordered.length >= 3 && run.avg_pace_s_per_km != null) {
    const avg = run.avg_pace_s_per_km
    const opening = ordered.slice(0, OPENING_KM)
    const openingAvg =
      opening.reduce((acc, s) => acc + s.pace_s_per_km, 0) / opening.length
    const closing = ordered[ordered.length - 1]

    if (openingAvg - avg >= NOTABLE_PACE_DIFF_S) {
      findings.push({
        ok: false,
        title: 'Verhaltener Start',
        desc: `Die ersten ${opening.length} Kilometer lagen rund ${Math.round(openingAvg - avg)} Sekunden pro Kilometer über deinem Schnitt. Das ist nur ein Laufhinweis, keine medizinische Bewertung.`,
      })
    } else if (avg - openingAvg >= NOTABLE_PACE_DIFF_S) {
      findings.push({
        ok: false,
        title: 'Schneller Start',
        desc: `Die ersten ${opening.length} Kilometer lagen rund ${Math.round(avg - openingAvg)} Sekunden pro Kilometer unter deinem Schnitt. Ein ruhigerer Beginn hält das Tempo oft länger.`,
      })
    }

    if (avg - closing.pace_s_per_km >= NOTABLE_PACE_DIFF_S) {
      findings.push({
        ok: true,
        title: 'Tempo zum Ende gehalten',
        desc: `Auf dem letzten Kilometer lagst du mit ${formatPace(closing.duration_s, closing.distance_km)} min/km unter deinem Durchschnittstempo.`,
      })
    } else if (closing.pace_s_per_km - avg >= NOTABLE_PACE_DIFF_S) {
      findings.push({
        ok: false,
        title: 'Zum Ende langsamer',
        desc: `Auf dem letzten Kilometer lagst du mit ${formatPace(closing.duration_s, closing.distance_km)} min/km über deinem Durchschnittstempo.`,
      })
    }
  }

  const scoreCopy =
    findings.length > 0
      ? 'Öffne die Bereiche für alle Details.'
      : 'Dein Tempo war überwiegend gleichmäßig. Öffne die Bereiche für alle Details.'

  return (
    <>
      <p className="md-analysis-meta">{meta}</p>

      <section className="md-card md-score" aria-label={score != null ? `Lauf-Score ${score} von 100` : 'Lauf ohne Score'}>
        <div className="md-score__ring">
          <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
            <circle className="md-score__ring-track" cx="48" cy="48" r="40" />
            <circle
              className="md-score__ring-value"
              cx="48" cy="48" r="40"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <div className="md-score__number">{score ?? '–'}</div>
        </div>
        <div>
          <p className="md-section-title" style={{ marginBottom: 4 }}>{verdict}</p>
          <p className="md-analysis-score-copy">{scoreCopy}</p>
        </div>
      </section>

      <div className="md-analysis-accordion">
        <details className="md-analysis-section" open>
          <summary>
            <span>
              <strong>Erkannte Auffälligkeiten</strong>
              <small>
                {findings.length === 0
                  ? 'Keine Auffälligkeiten aus GPS-Daten'
                  : `${findings.length} ${findings.length === 1 ? 'Hinweis' : 'Hinweise'} aus GPS-Daten`}
              </small>
            </span>
            <Icon name="chevron-down" className="icon" />
          </summary>
          <div className="md-analysis-section__content">
            {findings.length === 0 ? (
              <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                Aus den GPS-Daten dieses Laufs ergibt sich nichts Auffälliges.
              </p>
            ) : (
              <div className="md-analysis-findings">
                {findings.map((f) => (
                  <div key={f.title} className={`md-finding${f.ok ? ' md-finding--ok' : ''}`}>
                    <Icon name={f.ok ? 'check' : 'warn'} className="icon md-finding__icon" />
                    <div>
                      <p className="md-finding__title">{f.title}</p>
                      <p className="md-finding__desc">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>

        <details className="md-analysis-section">
          <summary>
            <span>
              <strong>Deine Laufwerte</strong>
              {/* Die Zeile nennt, was aufgeklappt wirklich dasteht. Sonst
                  verspricht sie eine Kachel, die es nicht gibt. */}
              <small>
                {hoehenmeter ? 'Strecke, Zeit, Tempo und Höhenmeter' : 'Strecke, Zeit und Tempo'}
              </small>
            </span>
            <Icon name="chevron-down" className="icon" />
          </summary>
          <div className="md-analysis-section__content">
            <div className="md-metric-grid">
              <div className="md-metric">
                <p className="md-metric__label">Strecke</p>
                <p className="md-metric__value">
                  {run.distance_km != null ? run.distance_km.toFixed(1).replace('.', ',') : '–'} <span>km</span>
                </p>
              </div>
              <div className="md-metric">
                <p className="md-metric__label">Gesamtzeit</p>
                <p className="md-metric__value">
                  {run.duration_s != null ? formatDurationDisplay(run.duration_s) : '–'} <span>min</span>
                </p>
                {/* Wortgleich zur Laufdetailseite: derselbe Lauf, zwei Bildschirme
                    nebeneinander, also auch dieselbe Beschriftung. */}
                {run.moving_time_s != null && run.moving_time_s > 0 && (
                  <p className="md-metric__sub">
                    davon in Bewegung {formatDurationDisplay(run.moving_time_s)}
                  </p>
                )}
              </div>
              <div className="md-metric">
                <p className="md-metric__label">Ø Tempo</p>
                <p className="md-metric__value">{paceDisplay} <span>min/km</span></p>
              </div>
              {/* Wie auf der Laufdetailseite: ohne belastbare Quelle keine
                  Kachel. Siehe lib/hoehenmeter.ts. */}
              {hoehenmeter && (
                <div className="md-metric">
                  <p className="md-metric__label">Höhenmeter</p>
                  <p className="md-metric__value">
                    {hoehenmeter} <span>m</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </details>

        <details className="md-analysis-section">
          <summary>
            <span>
              <strong>Biomechanik-Analyse</strong>
              <small>Mit Sensoreinlagen verfügbar</small>
            </span>
            <Icon name="chevron-down" className="icon" />
          </summary>
          <div className="md-analysis-section__content">
            <section className="md-insole-promo">
              <div className="md-insole-promo__icon">
                <Icon name="bluetooth" className="icon" />
              </div>
              <div>
                <p className="md-insole-promo__eyebrow">Für diesen Lauf nicht verfügbar</p>
                <h2 className="md-insole-promo__title">Biomechanik benötigt Sensoreinlagen</h2>
                <p className="md-insole-promo__text">
                  Du kannst die App weiterhin vollständig für GPS-Läufe nutzen. Einlagen
                  ergänzen Druck-, Balance- und Abrolldaten.
                </p>
              </div>
              <div className="md-insole-promo__actions">
                <Link
                  className="md-button md-button--tonal md-button--compact"
                  to="/einlagen"
                  style={{ textDecoration: 'none' }}
                >
                  Einlagen kennenlernen
                </Link>
              </div>
            </section>
          </div>
        </details>
      </div>

      <section className="md-social-cta">
        <div className="md-social-cta__icon">
          <Icon name="sparkles" className="icon" />
        </div>
        <div>
          <p className="md-social-cta__eyebrow">DEIN LAUF ALS BILD</p>
          <h2>Bereit für deine Story?</h2>
          <p>Lade ein Foto hoch und lass es mit deinen Laufdaten für Social Media gestalten.</p>
        </div>
        <Link className="md-button md-button--filled" to="/social-studio" style={{ textDecoration: 'none' }}>
          Social-Post erstellen
        </Link>
      </section>

      <button
        type="button"
        className="md-button md-button--tonal"
        onClick={() => navigate(`/lauf/${run.id}`)}
      >
        Zu den Laufdetails
      </button>
    </>
  )
}
