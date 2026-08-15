import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Avatar from '../components/ui/Avatar'

/**
 * Community-Profil: was andere von einem sehen.
 *
 * Ohne Kennung das eigene, mit Kennung das einer anderen Person – aus dem
 * Feed oder aus einem Chat heraus.
 *
 * Gezeigt wird nur, was ohnehin oeffentlich ist: Anzeigename, Bild, seit wann
 * dabei, und was im Feed sichtbar zusammengekommen ist. Keine Laufdaten, keine
 * Angaben aus der Anamnese – das sind Gesundheitsdaten und gehen niemanden
 * sonst etwas an.
 */
interface Profil {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export default function CommunityProfile() {
  const { id } = useParams<{ id: string }>()
  const eigeneId = useAuth((s) => s.user?.id)
  const zielId = id ?? eigeneId

  const [profil, setProfil] = useState<Profil | null>(null)
  const [beitraege, setBeitraege] = useState(0)
  const [medaillen, setMedaillen] = useState(0)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (!zielId) return
    let aktiv = true

    const laden = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, created_at')
        .eq('id', zielId)
        .maybeSingle()

      if (!aktiv) return
      if (error) {
        setFehler(error.message)
        setLaedt(false)
        return
      }
      setProfil((data as Profil) ?? null)

      // Anzahl der Beitraege und der dafuer erhaltenen Medaillen. Beides
      // ueber count, damit nicht die ganzen Zeilen uebertragen werden.
      const { count: anzahlBeitraege } = await supabase
        .from('community_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', zielId)

      const { data: eigenePosts } = await supabase
        .from('community_posts')
        .select('id')
        .eq('user_id', zielId)

      let anzahlMedaillen = 0
      const ids = (eigenePosts ?? []).map((p) => (p as { id: string }).id)
      if (ids.length) {
        const { count } = await supabase
          .from('community_post_awards')
          .select('post_id', { count: 'exact', head: true })
          .in('post_id', ids)
        anzahlMedaillen = count ?? 0
      }

      if (!aktiv) return
      setBeitraege(anzahlBeitraege ?? 0)
      setMedaillen(anzahlMedaillen)
      setLaedt(false)
    }

    laden()
    return () => { aktiv = false }
  }, [zielId])

  if (laedt) return <LoadingSpinner />

  if (fehler || !profil) {
    return (
      <p style={{ margin: 'var(--space-lg) 0', textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        {fehler ? `Profil lässt sich nicht laden: ${fehler}` : 'Profil nicht gefunden.'}
      </p>
    )
  }

  const eigenes = profil.id === eigeneId

  return (
    <>
      <div className="md-profile-header">
        <Avatar name={profil.display_name} pfad={profil.avatar_url} groesse={64} />
        <div>
          <p className="md-profile-header__name">{profil.display_name ?? 'Ohne Namen'}</p>
          <p className="md-profile-header__meta">
            Dabei seit {new Date(profil.created_at).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="md-metric-grid">
        <div className="md-metric">
          <p className="md-metric__label">Beiträge</p>
          <p className="md-metric__value">{beitraege}</p>
        </div>
        <div className="md-metric">
          <p className="md-metric__label">Goldmedaillen</p>
          <p className="md-metric__value" style={{ color: '#D9A441' }}>{medaillen}</p>
        </div>
      </div>

      <div className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          {eigenes
            ? 'Das sehen andere von dir. Deine Läufe, dein Trainingsplan und alles aus der Anamnese bleiben privat.'
            : 'Mehr ist nicht öffentlich. Läufe, Trainingspläne und Angaben zur Gesundheit sieht niemand außer der Person selbst.'}
        </p>
      </div>
    </>
  )
}
