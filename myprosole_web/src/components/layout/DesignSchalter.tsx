import { useState } from 'react'
import Icon from '../ui/Icon'
import { designLesen, designUmschalten } from '../../lib/design'

/**
 * Hell und dunkel, eine Beruehrung entfernt.
 *
 * Das Zeichen zeigt das ZIEL, nicht den Zustand: Bei dunklem Hintergrund
 * steht dort eine Sonne - tippen macht hell. Das ist die Gewohnheit aus
 * anderen Apps, und sie beantwortet die Frage "was passiert, wenn ich
 * draufdruecke" ohne Beschriftung.
 *
 * Warum hier oben und nicht nur im Profil: Der Schalter lag hinter drei
 * Beruehrungen. Etwas, das man je nach Tageslicht mehrmals taeglich
 * anfasst, gehoert nicht in die Einstellungen.
 */
export default function DesignSchalter() {
  const [design, setDesign] = useState(designLesen)
  const dunkel = design === 'dunkel'

  return (
    <button
      type="button"
      onClick={() => setDesign(designUmschalten())}
      className="md-app-bar__icon-btn"
      aria-label={dunkel ? 'Helles Design einschalten' : 'Dunkles Design einschalten'}
    >
      <Icon name={dunkel ? 'sun' : 'moon'} />
    </button>
  )
}
