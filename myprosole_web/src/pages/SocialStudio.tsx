import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'
import { useRun } from '../store/run'
import { formatDurationDisplay } from '../lib/format'
import { durchschnittstempoText } from '../lib/tempo'
import {
  FORMATE, STILE, bildLaden, laufbildZeichnen, alsDatei, herunterladen, teilenMoeglich,
} from '../lib/laufbild'
import type { FormatName, StilName } from '../lib/laufbild'

/**
 * Social-Studio (social-studio.html) und Teilen (share-export.html).
 *
 * Beide Entwuerfe sind derselbe Ablauf – Foto waehlen, Stil waehlen, Format
 * waehlen, Bild bekommen –, deshalb stehen sie auf einer Seite statt auf
 * zweien mit einem Schritt dazwischen.
 *
 * Alles passiert im Browser: Das Foto wird nirgends hochgeladen. Erst wenn
 * jemand das fertige Bild teilt, verlaesst es das Geraet.
 */
export default function SocialStudio() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const { liveStats, recentRuns, fetchRecentRuns } = useRun()

  useEffect(() => {
    fetchRecentRuns(10)
  }, [fetchRecentRuns])

  const [foto, setFoto] = useState<HTMLImageElement | null>(null)
  const [stil, setStil] = useState<StilName>('klar')
  const [format, setFormat] = useState<FormatName>('story')
  const [vorschau, setVorschau] = useState<string | null>(null)
  const [arbeitet, setArbeitet] = useState(false)
  const [kannTeilen, setKannTeilen] = useState(false)
  const dateiRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)

  // Normalerweise kommt man von der Laufzusammenfassung hierher, dann stehen
  // die Werte in liveStats. Ruft jemand die Seite direkt auf, sind sie null –
  // und man wuerde ein Bild mit "0,0 km" teilen. Dann lieber der letzte
  // abgeschlossene Lauf als gar nichts.
  const letzter = recentRuns.find((r) => r.status === 'completed' && (r.distance_km ?? 0) > 0)
  const ausLive = liveStats.distanceKm > 0

  const strecke = ausLive ? liveStats.distanceKm : Number(letzter?.distance_km ?? 0)
  const dauer = ausLive ? liveStats.durationS : (letzter?.duration_s ?? 0)

  const werte = {
    strecke: strecke.toFixed(1).replace('.', ','),
    zeit: formatDurationDisplay(dauer),
    // Was hier steht, geht nach draussen. Es muss dieselbe Zahl sein, die
    // die App selbst anzeigt - deshalb dieselbe Stelle, die sie berechnet.
    tempo: durchschnittstempoText({
      streckeKm: strecke,
      gespeichertesTempoSJeKm: ausLive ? null : letzter?.avg_pace_s_per_km,
      bewegungszeitS: ausLive ? liveStats.bewegungszeitS : letzter?.moving_time_s,
      gesamtzeitS: dauer,
    }),
  }

  // Neu zeichnen, sobald sich Foto, Stil oder Format aendern. Die alte
  // Vorschau-Adresse wird dabei freigegeben, sonst sammeln sich mit jedem
  // Klick Bilder im Speicher an.
  useEffect(() => {
    let abgebrochen = false
    let eigene: string | null = null

    const zeichnen = async () => {
      setArbeitet(true)
      try {
        const flaeche = await laufbildZeichnen({ foto, werte, format, stil })
        const datei = await alsDatei(flaeche, dateiname(format))
        if (abgebrochen) return
        eigene = URL.createObjectURL(datei)
        setVorschau(eigene)
        setKannTeilen(teilenMoeglich(datei))
      } catch (e) {
        if (!abgebrochen) showSnackbar((e as Error).message)
      } finally {
        if (!abgebrochen) setArbeitet(false)
      }
    }
    zeichnen()

    return () => {
      abgebrochen = true
      if (eigene) URL.revokeObjectURL(eigene)
    }
    // Die Werte gehoeren mit hinein: Sie kommen beim Direktaufruf erst mit
    // dem letzten Lauf nach. Ohne sie bliebe die Vorschau auf den Nullen
    // stehen, bis man Stil oder Format wechselt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foto, stil, format, werte.strecke, werte.zeit, werte.tempo])

  const fotoWaehlen = async (datei: File | null) => {
    if (!datei) return
    try {
      setFoto(await bildLaden(datei))
    } catch (e) {
      showSnackbar((e as Error).message)
    }
  }

  const fertigesBild = async () => {
    const flaeche = await laufbildZeichnen({ foto, werte, format, stil })
    return alsDatei(flaeche, dateiname(format))
  }

  const handleTeilen = async () => {
    try {
      const datei = await fertigesBild()
      await navigator.share({ files: [datei], title: 'Mein Lauf' })
    } catch (e) {
      // Bricht jemand das Teilen ab, ist das kein Fehler und braucht keine
      // Meldung.
      if ((e as Error).name === 'AbortError') return
      showSnackbar('Teilen hat nicht geklappt: ' + (e as Error).message)
    }
  }

  const handleHerunterladen = async () => {
    try {
      herunterladen(await fertigesBild())
    } catch (e) {
      showSnackbar((e as Error).message)
    }
  }

  return (
    <>
      <p className="md-onboarding-step">Dein Lauf als Bild</p>
      <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        Wähl ein Foto und kombiniere es mit Strecke, Zeit und Tempo. Das Foto bleibt auf deinem
        Gerät, bis du das Bild selbst teilst.
      </p>

      {/* Vorschau. Sie ist das eigentliche Bild, nur kleiner dargestellt –
          was hier steht, kommt genauso heraus. */}
      <div
        className="md-share-preview"
        style={{
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--md-surface-container-high)',
          aspectRatio: `${FORMATE[format].breite} / ${FORMATE[format].hoehe}`,
          maxHeight: '52vh', margin: '0 auto', width: 'auto',
        }}
      >
        {vorschau && (
          <img
            src={vorschau}
            alt="Vorschau deines Laufbilds"
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}
      </div>

      <input
        ref={dateiRef} type="file" accept="image/*" hidden
        onChange={(e) => { fotoWaehlen(e.target.files?.[0] ?? null); e.target.value = '' }}
      />
      <input
        ref={kameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { fotoWaehlen(e.target.files?.[0] ?? null); e.target.value = '' }}
      />

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          className="md-button md-button--text md-button--compact"
          onClick={() => kameraRef.current?.click()}
        >
          <Icon name="photo" size={20} className="icon-sm" />
          Foto aufnehmen
        </button>
        <button
          type="button"
          className="md-button md-button--text md-button--compact"
          onClick={() => dateiRef.current?.click()}
        >
          <Icon name="image" size={20} className="icon-sm" />
          {foto ? 'Anderes Foto' : 'Aus Galerie'}
        </button>
        {foto && (
          <button
            type="button"
            className="md-button md-button--text md-button--compact"
            onClick={() => setFoto(null)}
          >
            Ohne Foto
          </button>
        )}
      </div>

      <section className="md-card">
        <h2 className="md-section-title">Deine Werte</h2>
        <div className="md-metric-grid">
          <Wert label="Strecke" wert={werte.strecke} einheit="km" />
          <Wert label="Zeit" wert={werte.zeit} einheit="min" />
          <Wert label="Ø Tempo" wert={werte.tempo} einheit="min/km" />
        </div>
      </section>

      <div>
        <p className="md-section-title">Stil</p>
        <div className="md-chip-set">
          {(Object.keys(STILE) as StilName[]).map((name) => (
            <label className="md-choice-chip" key={name}>
              <input
                type="radio"
                name="stil"
                checked={stil === name}
                onChange={() => setStil(name)}
              />
              {STILE[name].label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="md-section-title">Format</p>
        <div className="md-chip-set">
          {(Object.keys(FORMATE) as FormatName[]).map((name) => (
            <label className="md-choice-chip" key={name}>
              <input
                type="radio"
                name="format"
                checked={format === name}
                onChange={() => setFormat(name)}
              />
              {FORMATE[name].label}
            </label>
          ))}
        </div>
      </div>

      {/* Teilen nur, wenn das Gerät es kann – auf dem Rechner können die
          meisten Browser keine Dateien teilen. Statt eines Knopfs, der dann
          nichts tut, steht dort gar keiner. */}
      {kannTeilen && (
        <button
          type="button"
          className="md-button md-button--filled"
          disabled={arbeitet}
          onClick={handleTeilen}
        >
          <Icon name="share" size={20} className="icon-sm" />
          Teilen
        </button>
      )}
      <button
        type="button"
        className={kannTeilen ? 'md-button' : 'md-button md-button--filled'}
        disabled={arbeitet}
        onClick={handleHerunterladen}
        style={kannTeilen ? { border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' } : undefined}
      >
        <Icon name="download" size={20} className="icon-sm" />
        {arbeitet ? 'Wird erstellt…' : 'Herunterladen'}
      </button>
      <button type="button" className="md-button md-button--text" onClick={() => navigate(-1)}>
        Zurück
      </button>
    </>
  )
}

function Wert({ label, wert, einheit }: { label: string; wert: string; einheit: string }) {
  return (
    <div className="md-metric">
      <p className="md-metric__label">{label}</p>
      <p className="md-metric__value">{wert} <span>{einheit}</span></p>
    </div>
  )
}

function dateiname(format: FormatName): string {
  return `myprosole-lauf-${format}.jpg`
}
