import { useRef } from 'react'
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
  name, pfad, groesse = 40, vergroesserbar = false,
}: {
  name?: string | null
  pfad?: string | null
  groesse?: number
  /**
   * Antippen zeigt das Bild gross.
   *
   * Nur sinnvoll, wo man wissen will, mit wem man es zu tun hat – bei einer
   * Laufverabredung mit Fremden etwa. In einer langen Liste waere es eine
   * Falle: Man tippt auf die Zeile und bekommt ein Bild statt der Seite.
   *
   * Ohne hinterlegtes Bild bleibt der Kreis ein Kreis. Den Anfangsbuchstaben
   * zu vergroessern hilft niemandem.
   */
  vergroesserbar?: boolean
}) {
  const initial = name?.trim().charAt(0).toUpperCase() ?? ''
  const adresse = pfad ? supabase.storage.from('avatars').getPublicUrl(pfad).data.publicUrl : null
  const dialog = useRef<HTMLDialogElement>(null)

  const kreis = (
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

  if (!vergroesserbar || !adresse) return kreis

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={name ? `Bild von ${name} vergrößern` : 'Bild vergrößern'}
        style={{
          padding: 0, border: 0, background: 'none', cursor: 'zoom-in',
          borderRadius: 'var(--radius-full)', display: 'block', flexShrink: 0,
        }}
      >
        {kreis}
      </button>

      {/*
        Natives <dialog> statt eines eigenen Ueberlagerns: Escape zum
        Schliessen, der Hintergrund wird unbedienbar, der Tastaturfokus
        bleibt drinnen und Vorleseprogramme kennen es. Das alles bringt der
        Browser mit; nachgebaut waere es viel Code, der genau diese Dinge
        erfahrungsgemaess vergisst.

        Ein Klick daneben schliesst ebenfalls: Das Ziel des Klicks ist dann
        das dialog-Element selbst, nicht der Inhalt darin.
      */}
      <dialog
        ref={dialog}
        className="md-bild-gross"
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close() }}
      >
        <img src={adresse} alt={name ? `Profilbild von ${name}` : 'Profilbild'} />
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="md-bild-gross__zu"
          aria-label="Schließen"
        >
          <Icon name="remove" className="icon" />
        </button>
      </dialog>
    </>
  )
}
