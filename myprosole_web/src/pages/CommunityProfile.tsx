import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useCommunityProfil, SPORTARTEN } from '../store/communityProfile'
import type { ProfilFoto } from '../store/communityProfile'
import Icon from '../components/ui/Icon'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Avatar from '../components/ui/Avatar'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Community-Profil, nach dem Entwurf community-profil.html.
 *
 * Ohne Kennung in der Adresse das eigene – dann ist es ein Formular mit
 * Kurzbeschreibung, Fotos, Sportarten und dem Schalter fuer Kilometer und
 * Rekord. Mit Kennung das einer anderen Person – dann sind dieselben Felder
 * nur zu lesen, und der Schalter samt Erklaerung faellt weg: Wie jemand
 * anderes seine Sichtbarkeit eingestellt hat, geht einen nichts an. Man
 * sieht nur das Ergebnis.
 *
 * Aus diesen beiden Ansichten ergibt sich die Vorschau von selbst: Sie ist
 * die fremde Ansicht, angewendet auf die eigenen Daten. Deshalb entscheidet
 * ab hier nicht mehr "eigenes" darueber, was gezeigt wird, sondern
 * "bearbeiten" – eigenes Profil und Vorschau aus. Wer beides
 * gleichsetzt, baut die fremde Ansicht ein zweites Mal nach, und dann
 * weichen sie irgendwann voneinander ab.
 *
 * Was hier bewusst fehlt: Laufdaten im Einzelnen und alles aus der Anamnese.
 * Von den Laeufen kommen hoechstens zwei Summen, und auch die nur, wenn die
 * Person den Schalter angeschaltet hat.
 */

/** Adresse eines Fotos im oeffentlichen Behaelter. */
function bildAdresse(pfad: string): string {
  return supabase.storage.from('community').getPublicUrl(pfad).data.publicUrl
}

interface Kopf {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export default function CommunityProfile() {
  const { id } = useParams<{ id: string }>()
  const eigeneId = useAuth((s) => s.user?.id)
  const eigenesProfil = useAuth((s) => s.profile)
  const zielId = id ?? eigeneId
  const eigenes = !id || id === eigeneId

  const { profil, fotos, stats, laedt, fehler, laden, speichern, fotoHinzufuegen, fotoEntfernen } =
    useCommunityProfil()
  const showSnackbar = useSnackbar()

  const [kopf, setKopf] = useState<Kopf | null>(null)
  const [bio, setBio] = useState('')
  const [jahre, setJahre] = useState('')
  const [sportarten, setSportarten] = useState<string[]>([])
  const [andereOffen, setAndereOffen] = useState(false)
  const [andere, setAndere] = useState('')
  const [statsSichtbar, setStatsSichtbar] = useState(false)
  const [speichert, setSpeichert] = useState(false)
  const [fotoLaedt, setFotoLaedt] = useState(false)
  const [vorschau, setVorschau] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)

  // Bearbeitet wird nur das eigene Profil, und auch das nur, solange die
  // Vorschau aus ist.
  const bearbeiten = eigenes && !vorschau

  // In der Vorschau steht der gespeicherte Stand, nicht der im Formular.
  // Andere sehen schliesslich auch nur, was gespeichert ist.
  const zeigeBio = vorschau ? (profil?.bio ?? '') : bio
  const zeigeJahre = vorschau
    ? profil?.running_years == null ? '' : String(profil.running_years)
    : jahre

  useEffect(() => {
    if (zielId) laden(zielId)
  }, [zielId, laden])

  // Der Kopf kommt aus profiles: Name und Bild teilen sich alle Ansichten.
  // Beim eigenen Profil steht beides schon im Auth-Store.
  useEffect(() => {
    if (!zielId) return
    if (eigenes && eigenesProfil) {
      setKopf({
        id: eigenesProfil.id,
        display_name: eigenesProfil.display_name,
        avatar_url: eigenesProfil.avatar_url,
      })
      return
    }
    let aktiv = true
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', zielId)
      .maybeSingle()
      .then(({ data }) => {
        if (aktiv) setKopf((data as Kopf) ?? null)
      })
    return () => { aktiv = false }
  }, [zielId, eigenes, eigenesProfil])

  // Das Formular wird einmal aus dem geladenen Profil gefuellt. Danach
  // gehoert der Zustand dem Formular – sonst wuerde jede Eingabe beim
  // naechsten Laden wieder ueberschrieben.
  useEffect(() => {
    if (!profil) return
    setBio(profil.bio ?? '')
    setJahre(profil.running_years == null ? '' : String(profil.running_years))
    // Was nicht in der Auswahl steht, ist eine selbst eingetragene Sportart.
    const bekannt = profil.sports.filter((s) => (SPORTARTEN as readonly string[]).includes(s))
    const frei = profil.sports.filter((s) => !(SPORTARTEN as readonly string[]).includes(s))
    setSportarten(bekannt)
    setAndere(frei[0] ?? '')
    setAndereOffen(frei.length > 0)
    setStatsSichtbar(profil.show_stats)
  }, [profil])

  const sportUmschalten = (sport: string) => {
    setSportarten((vorher) =>
      vorher.includes(sport) ? vorher.filter((s) => s !== sport) : [...vorher, sport],
    )
  }

  const handleSpeichern = async () => {
    setSpeichert(true)
    const alle = [...sportarten]
    const frei = andere.trim()
    if (andereOffen && frei) alle.push(frei)

    const jahrZahl = jahre.trim() === '' ? null : Number(jahre)
    const err = await speichern({
      bio: bio.trim() === '' ? null : bio.trim(),
      running_years: jahrZahl != null && Number.isFinite(jahrZahl) ? jahrZahl : null,
      sports: alle,
      show_stats: statsSichtbar,
    })
    setSpeichert(false)
    showSnackbar(err ? 'Speichern fehlgeschlagen: ' + err : 'Community-Profil gespeichert')
  }

  const handleFoto = async (datei: File | null) => {
    if (!datei) return
    setFotoLaedt(true)
    const err = await fotoHinzufuegen(datei)
    setFotoLaedt(false)
    if (err) showSnackbar('Foto konnte nicht gespeichert werden: ' + err)
  }

  const handleFotoWeg = async (foto: ProfilFoto) => {
    const err = await fotoEntfernen(foto)
    if (err) showSnackbar('Foto konnte nicht entfernt werden: ' + err)
  }

  if (laedt) return <LoadingSpinner />

  if (fehler) {
    return (
      <p
        style={{
          margin: 'var(--space-lg) 0', textAlign: 'center',
          font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)',
        }}
      >
        Profil lässt sich nicht laden: {fehler}
      </p>
    )
  }

  // Beim fremden Profil gilt: Was die Person nicht ausgefuellt hat, wird
  // auch nicht als leeres Feld gezeigt.
  const fremdeSportarten = profil?.sports ?? []

  return (
    <>
      {/* Ein Hinweis, der auch ohne Scrollen wieder herausfuehrt – sonst
          steht man in einer Ansicht, in der nichts mehr reagiert, und weiss
          nicht warum. */}
      {vorschau && (
        <div className="md-info-note md-info-note--neutral">
          <Icon name="people" size={20} className="icon icon-sm" />
          <p>
            Vorschau: So sieht dein Profil für andere aus. Gezeigt wird der gespeicherte Stand.
            {' '}
            <button
              type="button"
              className="md-button md-button--text md-button--compact"
              onClick={() => setVorschau(false)}
              style={{ display: 'inline-flex', padding: 0 }}
            >
              Vorschau beenden
            </button>
          </p>
        </div>
      )}

      <div className="md-profile-header">
        <Avatar name={kopf?.display_name} pfad={kopf?.avatar_url} groesse={64} />
        <div>
          <p className="md-profile-header__name">{kopf?.display_name ?? 'Ohne Namen'}</p>
          <p className="md-profile-header__meta">
            {bearbeiten
              ? 'So erscheinst du im Feed, unter ZusammenLauf und in Gruppen'
              : eigenes
                ? 'Genau das sehen andere von dir – mehr nicht'
                : 'So erscheint diese Person in der Community'}
          </p>
        </div>
      </div>

      {/* ---- Angezeigt wird ---- */}
      <fieldset className="md-form-section">
        <legend className="md-visually-hidden">Angezeigt wird</legend>
        <p className="md-form-section__title">Angezeigt wird</p>

        <div className="md-field">
          <label className="md-field__label" htmlFor="community-name">Anzeigename</label>
          <input
            className="md-field__input"
            id="community-name"
            type="text"
            value={kopf?.display_name ?? ''}
            readOnly
          />
        </div>

        {(bearbeiten || zeigeBio.trim() !== '') && (
          <div className="md-field">
            <label className="md-field__label" htmlFor="community-bio">
              Kurzbeschreibung {bearbeiten && <span className="md-optional">optional</span>}
            </label>
            <textarea
              className="md-field__input"
              id="community-bio"
              rows={3}
              style={{ height: 'auto', padding: 'var(--space-md)', resize: 'none' }}
              placeholder="z. B. Läuft seit 2023, Ziel: erster Marathon"
              maxLength={300}
              value={zeigeBio}
              readOnly={!bearbeiten}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        )}
      </fieldset>

      {/* ---- Fotos ---- */}
      {(bearbeiten || fotos.length > 0) && (
        <fieldset className="md-form-section">
          <legend className="md-visually-hidden">Fotos</legend>
          <p className="md-form-section__title">Fotos</p>
          {bearbeiten && (
            <p className="md-optional" style={{ margin: '0 0 var(--space-sm)' }}>
              Bis zu 5 Fotos. Sichtbar für alle, die dein Community-Profil öffnen – wähl deshalb
              bewusst aus.
            </p>
          )}
          <div className="md-photo-grid">
            {fotos.map((foto) => (
              <button
                key={foto.id}
                type="button"
                className="md-photo-grid__slot"
                onClick={() => bearbeiten && handleFotoWeg(foto)}
                aria-label={bearbeiten ? 'Foto entfernen' : 'Foto'}
                style={{ padding: 0, overflow: 'hidden', border: 0, position: 'relative' }}
              >
                <img
                  src={bildAdresse(foto.path)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {bearbeiten && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 18, height: 18, borderRadius: '50%',
                      display: 'grid', placeItems: 'center',
                      background: 'rgba(0,0,0,.55)', color: '#fff',
                    }}
                  >
                    <Icon name="remove" size={12} />
                  </span>
                )}
              </button>
            ))}
            {/* Nur beim eigenen Profil, und nur solange noch Platz ist. */}
            {bearbeiten &&
              Array.from({ length: 5 - fotos.length }).map((_, i) => (
                <button
                  key={`frei-${i}`}
                  type="button"
                  className="md-photo-grid__slot"
                  aria-label="Foto hinzufügen"
                  disabled={fotoLaedt}
                  onClick={() => fotoRef.current?.click()}
                >
                  <Icon name="plus" className="icon" />
                </button>
              ))}
          </div>
          {bearbeiten && (
            <input
              ref={fotoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                handleFoto(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          )}
        </fieldset>
      )}

      {/* ---- Sportarten ---- */}
      <fieldset className="md-form-section">
        <legend className="md-visually-hidden">Sportarten</legend>
        <p className="md-form-section__title">Sportarten</p>
        {bearbeiten && (
          <p className="md-optional" style={{ margin: '0 0 var(--space-sm)' }}>
            Laufen ist deine Hauptsportart. Ergänze weitere, damit passende Gruppen und Vorschläge
            dich auch dafür finden.
          </p>
        )}
        <div className="md-chip md-chip--connected" style={{ width: 'fit-content' }}>
          <Icon name="training" className="icon-sm" />
          Laufen · Hauptsportart
        </div>

        {(bearbeiten || profil?.running_years != null) && (
          <div className="md-field" style={{ marginTop: 'var(--space-sm)', maxWidth: 180 }}>
            <label className="md-field__label" htmlFor="lauf-jahre">Läuft seit (Jahre)</label>
            <input
              className="md-field__input"
              id="lauf-jahre"
              type="number"
              min={0}
              max={80}
              value={zeigeJahre}
              readOnly={!bearbeiten}
              onChange={(e) => setJahre(e.target.value)}
            />
          </div>
        )}

        {bearbeiten ? (
          <div className="md-reveal-group">
            <div className="md-chip-set" style={{ marginTop: 'var(--space-sm)' }}>
              {SPORTARTEN.map((sport) => (
                <label className="md-choice-chip" key={sport}>
                  <input
                    type="checkbox"
                    checked={sportarten.includes(sport)}
                    onChange={() => sportUmschalten(sport)}
                  />
                  {sport}
                </label>
              ))}
              <label className="md-choice-chip">
                <input
                  className="md-reveal-trigger"
                  type="checkbox"
                  checked={andereOffen}
                  onChange={(e) => setAndereOffen(e.target.checked)}
                />
                + Andere
              </label>
            </div>
            <div className="md-field md-reveal-content" style={{ marginTop: 'var(--space-sm)' }}>
              <label className="md-field__label" htmlFor="sport-andere">Weitere Sportart</label>
              <input
                className="md-field__input"
                id="sport-andere"
                type="text"
                placeholder="z. B. Klettern"
                value={andere}
                onChange={(e) => setAndere(e.target.value)}
              />
            </div>
          </div>
        ) : fremdeSportarten.length > 0 ? (
          <div className="md-chip-set" style={{ marginTop: 'var(--space-sm)' }}>
            {fremdeSportarten.map((sport) => (
              <span className="md-chip" key={sport}>{sport}</span>
            ))}
          </div>
        ) : null}
      </fieldset>

      {/* ---- Kilometer & Rekord ---- */}
      {bearbeiten ? (
        <div className="md-card">
          <label
            className="md-settings-row"
            htmlFor="stats-sichtbar"
            style={{ background: 'transparent', padding: 0 }}
          >
            <Icon name="training" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Kilometer &amp; Rekord zeigen</span>
            <input
              className="md-switch"
              id="stats-sichtbar"
              type="checkbox"
              checked={statsSichtbar}
              onChange={(e) => setStatsSichtbar(e.target.checked)}
            />
            <span className="md-toggle" aria-hidden="true"><span className="md-toggle__knob" /></span>
          </label>
          <p className="md-optional" style={{ margin: 'var(--space-sm) 0 0' }}>
            Andere sehen dann deine Gesamtkilometer und deinen längsten Lauf im Community-Profil,
            unter ZusammenLauf und in Gruppen. Ausgeschaltet sieht niemand mehr als deinen Namen
            und deine Sportarten.
          </p>
          {/* Die Zahlen kommen erst nach dem Speichern aus der Datenbank –
              der Schalter allein gibt sie noch nicht frei. */}
          {statsSichtbar && stats && (
            <>
              <p className="md-section-title" style={{ marginBottom: 'var(--space-sm)' }}>
                So sehen es andere
              </p>
              <StatsGitter stats={stats} />
            </>
          )}
        </div>
      ) : (
        stats && <StatsGitter stats={stats} />
      )}

      <div className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          {bearbeiten
            ? 'Nachname, genauer Standort, Gesundheits- und Sensordaten werden nie geteilt – auch nicht über dieses Profil. Deine Läufe, dein Trainingsplan und alles aus der Anamnese bleiben privat.'
            : 'Mehr ist nicht öffentlich. Einzelne Läufe, Trainingspläne und Angaben zur Gesundheit sieht niemand außer der Person selbst.'}
        </p>
      </div>

      {bearbeiten && (
        <>
          <button
            type="button"
            className="md-button md-button--filled"
            style={{ width: '100%' }}
            disabled={speichert}
            onClick={handleSpeichern}
          >
            <Icon name="check" className="icon-sm" />
            {speichert ? 'Wird gespeichert…' : 'Speichern'}
          </button>
          <button
            type="button"
            className="md-button md-button--tonal"
            style={{ width: '100%', marginTop: 'var(--space-sm)' }}
            onClick={() => setVorschau(true)}
          >
            <Icon name="people" className="icon-sm" />
            Ansehen wie andere
          </button>
        </>
      )}

      {vorschau && (
        <button
          type="button"
          className="md-button md-button--filled"
          style={{ width: '100%' }}
          onClick={() => setVorschau(false)}
        >
          <Icon name="back" className="icon-sm" />
          Vorschau beenden
        </button>
      )}
    </>
  )
}

function StatsGitter({ stats }: { stats: { kilometer: number; laengsterLaufKm: number } }) {
  return (
    <div className="md-metric-grid">
      <div className="md-metric md-metric--accent">
        <p className="md-metric__label">Kilometer gesamt</p>
        <p className="md-metric__value">
          {stats.kilometer.toFixed(1)} <span>km</span>
        </p>
      </div>
      <div className="md-metric md-metric--accent">
        <p className="md-metric__label">Längster Lauf</p>
        <p className="md-metric__value">
          {stats.laengsterLaufKm.toFixed(1)} <span>km</span>
        </p>
      </div>
    </div>
  )
}
