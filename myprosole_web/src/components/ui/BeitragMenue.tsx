import Blatt from './Blatt'

/**
 * Was man mit einem fremden Beitrag tun kann.
 *
 * Warum ein Zwischenschritt und nicht gleich das Melden
 * ----------------------------------------------------
 * Die drei Punkte fuehrten zuerst direkt ins Melden. Das war zu scharf:
 * Der haeufigste Wunsch ist nicht "hier stimmt etwas nicht", sondern "das
 * will ich nicht sehen". Wer nur wegtun will, sollte nicht durch eine
 * Liste von Vorwuerfen gehen muessen.
 *
 * Warum ein Blatt und kein Aufklappmenue
 * --------------------------------------
 * Ein schwebendes Menue muss sich selbst positionieren, auf Klicks
 * ausserhalb hoeren und am Bildschirmrand umklappen - drei Gelegenheiten
 * fuer Fehler. Das Blatt gibt es bereits, es kommt immer von unten, und es
 * ist mit dem Daumen erreichbar.
 */
export default function BeitragMenue({
  offen,
  onSchliessen,
  onVerbergen,
  onMelden,
}: {
  offen: boolean
  onSchliessen: () => void
  onVerbergen: () => void
  onMelden: () => void
}) {
  return (
    <Blatt offen={offen} onSchliessen={onSchliessen} titel="Beitrag">
      <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <button
          type="button"
          className="md-button md-button--tonal"
          style={{ justifyContent: 'flex-start', width: '100%' }}
          onClick={() => { onSchliessen(); onVerbergen() }}
        >
          Verbergen
        </button>
        <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          Der Beitrag verschwindet aus deinem Feed. Niemand erfährt davon.
        </p>

        <button
          type="button"
          className="md-button md-button--text"
          style={{ justifyContent: 'flex-start', width: '100%' }}
          onClick={() => { onSchliessen(); onMelden() }}
        >
          Melden
        </button>
        <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          Wenn hier etwas nicht stimmt. Wir sehen es uns an.
        </p>
      </div>
    </Blatt>
  )
}
