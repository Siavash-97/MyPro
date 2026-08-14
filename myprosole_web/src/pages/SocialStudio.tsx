import { useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'
import { useRun } from '../store/run'
import { formatDurationDisplay } from '../lib/format'
import { formatPace } from '../store/run'

/**
 * Social-Studio (social-studio.html): aus Foto und Laufdaten ein Bild fuer
 * soziale Netze bauen. Die Bilderzeugung selbst ist noch nicht angeschlossen;
 * Aufbau und Bedienung stehen wie im Entwurf.
 */
const STYLES = ['Klar', 'Kräftig', 'Ruhig', 'Schwarzweiß'] as const

export default function SocialStudio() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const { liveStats } = useRun()

  const pace =
    liveStats.distanceKm > 0 ? formatPace(liveStats.durationS, liveStats.distanceKm) : '--:--'

  return (
    <>
      <p className="md-onboarding-step">Dein Lauf als Bild</p>
      <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        Lade ein Foto hoch und kombiniere es mit Strecke, Zeit und Tempo.
      </p>

      <button
        type="button"
        className="md-video-placeholder"
        onClick={() => showSnackbar('Foto hochladen kommt mit dem Social-Studio.')}
        style={{ width: '100%', border: 0, borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}
      >
        <Icon name="photo" size={48} />
      </button>

      <section className="md-card">
        <h2 className="md-section-title">Deine Werte</h2>
        <div className="md-metric-grid">
          <div className="md-metric">
            <p className="md-metric__label">Strecke</p>
            <p className="md-metric__value">
              {liveStats.distanceKm.toFixed(1).replace('.', ',')} <span>km</span>
            </p>
          </div>
          <div className="md-metric">
            <p className="md-metric__label">Zeit</p>
            <p className="md-metric__value">
              {formatDurationDisplay(liveStats.durationS)} <span>min</span>
            </p>
          </div>
          <div className="md-metric">
            <p className="md-metric__label">Ø Tempo</p>
            <p className="md-metric__value">{pace} <span>min/km</span></p>
          </div>
          <div className="md-metric">
            <p className="md-metric__label">Höhenmeter</p>
            <p className="md-metric__value">
              {Math.round(liveStats.elevationGainM)} <span>m</span>
            </p>
          </div>
        </div>
      </section>

      <div>
        <p className="md-section-title">Stil</p>
        <div className="md-chip-set">
          {STYLES.map((style) => (
            <button
              key={style}
              type="button"
              className="md-choice-chip"
              onClick={() => showSnackbar('Die Bildgestaltung kommt mit dem Social-Studio.')}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="md-button md-button--filled"
        onClick={() => showSnackbar('Die Vorschau kommt mit dem Social-Studio.')}
      >
        Vorschau erstellen
      </button>
      <button type="button" className="md-button md-button--text" onClick={() => navigate(-1)}>
        Zurück
      </button>
    </>
  )
}
