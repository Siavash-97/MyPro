import { supabase } from '../../lib/supabase'
import Icon from './Icon'

/**
 * Profilbild mit Rueckfall auf den Anfangsbuchstaben und, wenn auch der
 * fehlt, auf das Personenzeichen.
 *
 * Der Pfad wird hier zur Adresse aufgeloest, nicht beim Speichern: In der
 * Datenbank steht nur der Pfad im Behaelter, damit ein Wechsel der Adresse
 * keine gespeicherten Werte ungueltig macht.
 */
export default function Avatar({
  name, pfad, groesse = 40,
}: {
  name?: string | null
  pfad?: string | null
  groesse?: number
}) {
  const initial = name?.trim().charAt(0).toUpperCase() ?? ''
  const adresse = pfad ? supabase.storage.from('avatars').getPublicUrl(pfad).data.publicUrl : null

  return (
    <div
      className="md-avatar"
      aria-hidden="true"
      style={{ width: groesse, height: groesse, overflow: 'hidden', flexShrink: 0 }}
    >
      {adresse ? (
        <img
          src={adresse}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : initial ? (
        initial
      ) : (
        <Icon name="profile" size={Math.round(groesse / 2)} className="icon-sm" />
      )}
    </div>
  )
}
