import { supabase } from '../../lib/supabase'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import type { CommunityProfil, ProfilFoto, CommunityStats } from '../../store/communityProfile'

/**
 * Das Community-Profil, wie andere es sehen.
 *
 * Warum getrennt vom Formular
 * ---------------------------
 * Ein Formular ist zum Ausfuellen gebaut: Beschriftung, Feld, Beschriftung,
 * Feld. Zum Ansehen ist das die falsche Form – es liest sich wie ein
 * Antrag, nicht wie ein Mensch. Beide Aufgaben in einer Ansicht mit
 * `readOnly` zu erschlagen, spart Code und kostet genau das, was hier
 * zaehlt.
 *
 * Deshalb hier eine eigene Darstellung: grosses Bild zuerst, Name darauf,
 * darunter in einem Zug Beschreibung, Sportarten und die zwei Zahlen. Wer
 * ein Profil oeffnet, will einen Eindruck – nicht eine Datensammlung.
 *
 * Die Bilder liegen nebeneinander und rasten beim Wischen ein
 * (scroll-snap), wie in der Feed-Galerie. Dieselbe Bedienung an beiden
 * Stellen, kein zweites Verhalten zum Lernen.
 */

function bildAdresse(pfad: string): string {
  return supabase.storage.from('community').getPublicUrl(pfad).data.publicUrl
}

export default function ProfilSchaukasten({
  name, avatarPfad, dabeiSeit, profil, fotos, stats, eigenes,
}: {
  name: string | null
  avatarPfad: string | null
  dabeiSeit: string | null
  profil: CommunityProfil | null
  fotos: ProfilFoto[]
  stats: CommunityStats | null
  eigenes: boolean
}) {
  const sortiert = fotos.slice().sort((a, b) => a.position - b.position)
  const sportarten = profil?.sports ?? []
  const jahre = profil?.running_years

  return (
    <>
      {/* ---- Kopf: Bild gross, Name darauf ---------------------------- */}
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--md-surface-container-high)',
          aspectRatio: '4 / 5',
        }}
      >
        {sortiert.length > 0 ? (
          <div
            style={{
              display: 'flex',
              height: '100%',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
            }}
          >
            {sortiert.map((f, i) => (
              <img
                key={f.id}
                src={bildAdresse(f.path)}
                alt={sortiert.length > 1 ? `Foto ${i + 1} von ${sortiert.length}` : ''}
                loading={i === 0 ? 'eager' : 'lazy'}
                style={{
                  flex: '0 0 100%', height: '100%', objectFit: 'cover',
                  scrollSnapAlign: 'center', display: 'block',
                }}
              />
            ))}
          </div>
        ) : (
          // Ohne Fotos nicht einfach eine graue Flaeche: das Profilbild gross
          // in der Mitte ist immer noch ein Gesicht.
          <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
            <Avatar name={name} pfad={avatarPfad} groesse={120} />
          </div>
        )}

        {/* Verlauf, damit der Name auf jedem Foto lesbar bleibt – derselbe
            Kniff wie beim Laufbild im Social-Studio. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,.72) 100%)',
          }}
        />

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'var(--space-md)' }}>
          <p style={{ margin: 0, font: 'var(--type-title-lg)', color: '#fff' }}>
            {name ?? 'Ohne Namen'}
          </p>
          <p style={{ margin: '2px 0 0', font: 'var(--type-body-md)', color: 'rgba(255,255,255,.8)' }}>
            {[
              jahre != null ? `läuft seit ${jahre} ${jahre === 1 ? 'Jahr' : 'Jahren'}` : null,
              dabeiSeit ? `dabei seit ${dabeiSeit}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Punkte wie im Feed, nur wenn es mehr als ein Foto gibt. */}
        {sortiert.length > 1 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', top: 'var(--space-sm)', left: 0, right: 0,
              display: 'flex', justifyContent: 'center', gap: 4,
            }}
          >
            {sortiert.map((f) => (
              <span
                key={f.id}
                style={{
                  width: 24, height: 3, borderRadius: 2,
                  background: 'rgba(255,255,255,.55)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- Beschreibung ------------------------------------------- */}
      {profil?.bio?.trim() && (
        <p
          style={{
            margin: 0, font: 'var(--type-body-lg)', color: 'var(--md-on-surface)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {profil.bio}
        </p>
      )}

      {/* ---- Sportarten --------------------------------------------- */}
      <div className="md-chip-set">
        <span className="md-chip md-chip--connected">
          <Icon name="training" className="icon-sm" />
          Laufen
        </span>
        {sportarten.map((sport) => (
          <span className="md-chip" key={sport}>{sport}</span>
        ))}
      </div>

      {/* ---- Die zwei Zahlen, wenn freigegeben ---------------------- */}
      {stats && (
        <div className="md-metric-grid">
          <div className="md-metric md-metric--accent">
            <p className="md-metric__label">Kilometer gesamt</p>
            <p className="md-metric__value">{stats.kilometer.toFixed(1)} <span>km</span></p>
          </div>
          <div className="md-metric md-metric--accent">
            <p className="md-metric__label">Längster Lauf</p>
            <p className="md-metric__value">{stats.laengsterLaufKm.toFixed(1)} <span>km</span></p>
          </div>
        </div>
      )}

      <div className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          {eigenes
            ? 'Genau das sehen andere von dir – mehr nicht. Deine Läufe, dein Trainingsplan und alles aus der Anamnese bleiben privat.'
            : 'Mehr ist nicht öffentlich. Einzelne Läufe, Trainingspläne und Angaben zur Gesundheit sieht niemand außer der Person selbst.'}
        </p>
      </div>
    </>
  )
}
