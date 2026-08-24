import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useCommunityProfil, SPORTARTEN } from '../store/communityProfile'
import type { ProfilFoto } from '../store/communityProfile'
import AktionsBlatt from '../components/ui/AktionsBlatt'
import MeldenBlatt from '../components/ui/MeldenBlatt'
import { personBlockieren } from '../lib/blockieren'
import { FRAGEN, IDENTITAETEN, profilVollstaendigkeit } from '../lib/profilFragen'
import Icon from '../components/ui/Icon'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Avatar from '../components/ui/Avatar'
import ProfilSchaukasten from '../components/community/ProfilSchaukasten'
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

/**
 * Die einzige Frage ohne Antworten zum Antippen. Einmal nachgeschlagen statt
 * bei jedem Zeichnen - und aus FRAGEN statt abgeschrieben, damit die Frage
 * nur an einer Stelle im Quelltext steht.
 */
const FREITEXT_FRAGE = FRAGEN.find((f) => f.schluessel === 'schoen_am_laufen')

/**
 * Gleicher Inhalt, Reihenfolge egal.
 *
 * Wird gebraucht, um zu entscheiden, ob die Sichtbarkeit ueberhaupt
 * geschrieben werden muss. `{maennlich,weiblich}` und `{weiblich,maennlich}`
 * sind dieselbe Einstellung - ein Vergleich ueber die Reihenfolge wuerde
 * jedes Speichern der Bio zu einem Schreibvorgang auf die
 * Sichtbarkeitsspalten machen. Genau das soll nicht passieren.
 */
function gleicheMenge(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((wert) => b.includes(wert))
}

/** Was mit der Sichtbarkeit bei diesem Speichern geschehen ist. */
type SichtStand = 'unveraendert' | 'gespeichert' | 'gescheitert' | 'unbekannt'

/**
 * Ein Knopf, zwei Schreibvorgaenge - und vier Ausgaenge, die
 * auseinandergehalten werden muessen.
 *
 * Profil und Sichtbarkeit liegen seit Migration 0056 hinter zwei getrennten
 * Schnittstellen (siehe store/communityProfile.ts). Eines kann gelingen,
 * waehrend das andere scheitert. Ein gemeinsames "Speichern fehlgeschlagen"
 * liesse offen, was jetzt gilt - und bei der Frage, wer einen sehen darf,
 * will das niemand raten.
 *
 * Die Saetze sind kurz, weil sie in eine Kurzeinblendung gehen: Snackbar.tsx
 * haelt fest, dass eine Meldung, die laenger braucht als vier Sekunden,
 * nicht dorthin gehoert, sondern an die Stelle, um die es geht. Der Grund
 * eines gescheiterten Sichtbarkeits-Schreibens steht deshalb im roten Block
 * im Abschnitt selbst, nicht hier.
 */
function speicherMeldung(
  profilFehler: string | null,
  sicht: SichtStand,
): string {
  if (profilFehler) {
    return sicht === 'gespeichert'
      ? 'Sichtbarkeit gespeichert, Profil nicht: ' + profilFehler
      : 'Speichern fehlgeschlagen: ' + profilFehler
  }
  if (sicht === 'gescheitert') return 'Profil gespeichert, Sichtbarkeit nicht.'
  if (sicht === 'unbekannt') return 'Profil gespeichert. Sichtbarkeit unverändert.'
  return 'Community-Profil gespeichert'
}

/** Adresse eines Fotos im oeffentlichen Behaelter. */
function bildAdresse(pfad: string): string {
  return supabase.storage.from('community').getPublicUrl(pfad).data.publicUrl
}

interface Kopf {
  id: string
  display_name: string | null
  avatar_url: string | null
  /** Fuer "dabei seit" – nur Monat und Jahr werden gezeigt. */
  created_at: string | null
}

export default function CommunityProfile() {
  const { id } = useParams<{ id: string }>()
  const eigeneId = useAuth((s) => s.user?.id)
  const eigenesProfil = useAuth((s) => s.profile)
  const zielId = id ?? eigeneId
  const eigenes = !id || id === eigeneId
  const [meldenOffen, setMeldenOffen] = useState(false)
  const [menueOffen, setMenueOffen] = useState(false)
  const navigate = useNavigate()

  const {
    profil, fotos, stats, laedt, laden, speichern, fotoHinzufuegen, fotoEntfernen,
    einstellungen, einstellungenLaden, einstellungenSpeichern,
  } = useCommunityProfil()
  const showSnackbar = useSnackbar()

  const [kopf, setKopf] = useState<Kopf | null>(null)
  const [bio, setBio] = useState('')
  const [jahre, setJahre] = useState('')
  const [sportarten, setSportarten] = useState<string[]>([])
  const [andereOffen, setAndereOffen] = useState(false)
  const [andere, setAndere] = useState('')
  const [statsSichtbar, setStatsSichtbar] = useState(false)
  // Die sechs Fragen aus Migration 0048 in einer Karte. Sechs einzelne
  // Zustaende waeren sechs Gelegenheiten, eine zu vergessen.
  const [antworten, setAntworten] = useState<Record<string, string>>({})
  // Wer sieht wen. Drei Felder, weil es drei Fragen sind: wer ich bin, wen
  // ich sehen will, wem ich gezeigt werden darf.
  //
  // Nur `identitaet` kommt aus `profil` - sie ist oeffentlich. Die beiden
  // anderen kommen seit Migration 0056 aus `einstellungen` und gibt es nur
  // fuer das eigene Konto.
  const [identitaet, setIdentitaet] = useState('')
  const [zeigtMir, setZeigtMir] = useState<string[]>([])
  const [sichtbarFuer, setSichtbarFuer] = useState<string[]>([])
  // Laeuft der Abruf der Einstellungen gerade? Der Speicher kennt dafuer
  // kein eigenes Feld - `laedt` gehoert dem Profil. Ohne diesen Merker waere
  // "wird geladen" von "ging schief" nicht zu unterscheiden, und beide
  // saehen aus wie "du hast nichts eingestellt".
  const [einstellungenLaeuft, setEinstellungenLaeuft] = useState(false)
  // Der Grund, warum die Sichtbarkeit beim letzten Speichern nicht
  // durchkam. Steht im Abschnitt selbst, nicht in der Kurzeinblendung.
  const [sichtFehler, setSichtFehler] = useState<string | null>(null)
  // Der Fehler des PROFIL-Ladens, oertlich festgehalten. Warum nicht aus dem
  // Speicher: siehe der Ladeweg weiter unten.
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [fotoLaedt, setFotoLaedt] = useState(false)
  const [vorschau, setVorschau] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)

  // Bearbeitet wird nur das eigene Profil, und auch das nur, solange die
  // Vorschau aus ist.
  const bearbeiten = eigenes && !vorschau

  // "dabei seit August 2026" – nur Monat und Jahr, das genaue Datum geht
  // niemanden etwas an.
  const dabeiSeit = kopf?.created_at
    ? new Date(kopf.created_at).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    : null

  // In der Vorschau steht der gespeicherte Stand, nicht der im Formular.
  // Andere sehen schliesslich auch nur, was gespeichert ist.
  const zeigeBio = vorschau ? (profil?.bio ?? '') : bio
  const zeigeJahre = vorschau
    ? profil?.running_years == null ? '' : String(profil.running_years)
    : jahre

  // Zwei Ladewege, bewusst nacheinander.
  //
  // 1. `laden` holt Profil, Fotos und die zwei Zahlen - fuer jedes Profil.
  // 2. `einstellungenLaden` holt die drei privaten Einstellungen - nur fuer
  //    das EIGENE. Fuer ein fremdes gibt es sie nicht, und seit Migration
  //    0056 kann es sie auch nicht mehr geben: Die Datenbankfunktion nimmt
  //    keinen Parameter und antwortet nur fuer das angemeldete Konto. Der
  //    Aufruf unterbleibt hier trotzdem ausdruecklich - eine Anfrage, die
  //    ohnehin nichts Fremdes liefern kann, muss gar nicht erst gestellt
  //    werden.
  //
  // Der Ladefehler wird oertlich festgehalten und nicht mehr aus dem
  // Speicher gelesen: Dort gibt es EIN `fehler`-Feld fuer beide Wege.
  // Scheitert der zweite, faerbte es sonst die ganze Seite in "Profil laesst
  // sich nicht laden" ein - obwohl das Profil vollstaendig danebensteht und
  // nur zwei Haekchen fehlen.
  useEffect(() => {
    if (!zielId) return
    let aktiv = true
    setEinstellungenLaeuft(eigenes)
    void (async () => {
      await laden(zielId)
      if (!aktiv) return
      setLadeFehler(useCommunityProfil.getState().fehler)
      if (!eigenes) return
      await einstellungenLaden()
      if (aktiv) setEinstellungenLaeuft(false)
    })()
    return () => { aktiv = false }
  }, [zielId, eigenes, laden, einstellungenLaden])

  /** Noch einmal versuchen, ohne die Seite neu zu oeffnen. */
  const einstellungenErneutLaden = async () => {
    setEinstellungenLaeuft(true)
    await einstellungenLaden()
    setEinstellungenLaeuft(false)
  }

  // Der Kopf kommt aus profiles: Name und Bild teilen sich alle Ansichten.
  // Beim eigenen Profil steht beides schon im Auth-Store.
  useEffect(() => {
    if (!zielId) return
    if (eigenes && eigenesProfil) {
      setKopf({
        id: eigenesProfil.id,
        display_name: eigenesProfil.display_name,
        avatar_url: eigenesProfil.avatar_url,
        created_at: eigenesProfil.created_at,
      })
      return
    }
    let aktiv = true
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, created_at')
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
    setAntworten({
      km_woche: profil.km_woche ?? '',
      lauf_grund: profil.lauf_grund ?? '',
      lieber: profil.lieber ?? '',
      gelaende: profil.gelaende ?? '',
      im_verein: profil.im_verein == null ? '' : profil.im_verein ? 'ja' : 'nein',
      schoen_am_laufen: profil.schoen_am_laufen ?? '',
    })
    setIdentitaet(profil.identitaet ?? '')
  }, [profil])

  // Die zwei Sichtbarkeitsfragen kommen aus einer ANDEREN Quelle und
  // brauchen deshalb einen eigenen Fuellweg.
  //
  // Ohne diese Trennung stuende hier `profil.zeigt_mir ?? []` - und `[]`
  // heisst laut Migration 0049 ausdruecklich "alle". Aus "nur Frauen duerfen
  // mich sehen" wuerde beim naechsten Speichern einer Bio lautlos "alle
  // duerfen mich sehen". Kein Fehler, keine Meldung, der Schreibvorgang
  // gelingt. Deshalb faellt hier nichts zurueck: Solange `einstellungen`
  // null ist, bleiben die Felder unangetastet und werden gar nicht erst
  // angezeigt.
  useEffect(() => {
    if (!einstellungen) return
    setZeigtMir(einstellungen.zeigt_mir)
    setSichtbarFuer(einstellungen.sichtbar_fuer)
  }, [einstellungen])

  // Der Fortschritt zaehlt alle acht Fragen - auch die zwei, die eigene
  // Felder haben. Sonst zeigte er 100 %, waehrend das Profil halb leer ist.
  const vollstaendigkeit = profilVollstaendigkeit({
    ...antworten,
    running_years: jahre.trim() === '' ? null : Number(jahre),
    sports: [...sportarten, ...(andere.trim() ? [andere.trim()] : [])],
  })

  /** Einen Wert in einer Mehrfachauswahl an- oder abwaehlen. */
  const mengeUmschalten = (
    setzen: React.Dispatch<React.SetStateAction<string[]>>,
    wert: string,
  ) =>
    setzen((vorher) =>
      vorher.includes(wert) ? vorher.filter((w) => w !== wert) : [...vorher, wert],
    )

  const sportUmschalten = (sport: string) => {
    setSportarten((vorher) =>
      vorher.includes(sport) ? vorher.filter((s) => s !== sport) : [...vorher, sport],
    )
  }

  // Hat der Mensch an der Sichtbarkeit etwas geaendert? Nur dann wird sie
  // ueberhaupt geschrieben. Das spart nicht nur eine Anfrage: Jeder
  // Schreibvorgang auf diese Spalten ist eine Gelegenheit, sie zu
  // verstellen, und ein Speichern der Bio ist keiner.
  const sichtGeaendert =
    einstellungen != null &&
    (!gleicheMenge(zeigtMir, einstellungen.zeigt_mir) ||
      !gleicheMenge(sichtbarFuer, einstellungen.sichtbar_fuer))

  const handleSpeichern = async () => {
    setSpeichert(true)
    setSichtFehler(null)
    const alle = [...sportarten]
    const frei = andere.trim()
    if (andereOffen && frei) alle.push(frei)

    // ERST die Sichtbarkeit, DANN das Profil. Die Reihenfolge ist eine
    // Entscheidung, keine Gewohnheit: Wer gerade "nur Frauen duerfen mich
    // sehen" eingestellt hat, soll diese Einschraenkung auch dann bekommen,
    // wenn die Verbindung nach dem ersten Schreiben abreisst. Eine Bio, die
    // eine Minute spaeter ankommt, kostet niemanden etwas.
    //
    // `zusammenlauf_sichtbar` wird hier NICHT mitgeschickt - und kann es
    // seit dem 24.08.2026 auch nicht mehr: Der Typ von
    // `einstellungenSpeichern` kennt das Feld nicht.
    //
    // Vorher reichte diese Seite den Wert durch, den sie beim Oeffnen
    // gelesen hatte. Wer den Schalter waehrenddessen auf einem zweiten
    // Geraet umlegte, verlor die Aenderung beim naechsten Speichern der
    // Bio - und an ihm haengt eine Einwilligungszeile (0053). Der Schalter
    // hat jetzt einen eigenen, schmalen Schreibweg
    // (`meine_sichtbarkeit_setzen`), der nichts anderes anfassen kann.
    //
    // Ist `einstellungen` null, wird gar nicht geschrieben; die Wache im
    // Speicher wuerde es ohnehin abweisen.
    let sicht: SichtStand = einstellungen == null ? 'unbekannt' : 'unveraendert'
    if (einstellungen && sichtGeaendert) {
      const problem = await einstellungenSpeichern({
        zeigt_mir: zeigtMir,
        sichtbar_fuer: sichtbarFuer,
      })
      sicht = problem ? 'gescheitert' : 'gespeichert'
      setSichtFehler(problem)
    }

    const jahrZahl = jahre.trim() === '' ? null : Number(jahre)
    const err = await speichern({
      bio: bio.trim() === '' ? null : bio.trim(),
      running_years: jahrZahl != null && Number.isFinite(jahrZahl) ? jahrZahl : null,
      sports: alle,
      show_stats: statsSichtbar,
      km_woche: antworten.km_woche || null,
      lauf_grund: antworten.lauf_grund || null,
      lieber: antworten.lieber || null,
      gelaende: antworten.gelaende || null,
      im_verein: antworten.im_verein === '' ? null : antworten.im_verein === 'ja',
      schoen_am_laufen: antworten.schoen_am_laufen?.trim() || null,
      identitaet: identitaet || null,
    })
    setSpeichert(false)
    showSnackbar(speicherMeldung(err, sicht))
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

  // Nur der Fehler des PROFIL-Ladens macht die Seite leer. Ein
  // fehlgeschlagener Abruf der Einstellungen tut das ausdruecklich nicht -
  // er kostet zwei Haekchen, nicht die Seite.
  if (ladeFehler) {
    return (
      <p
        style={{
          margin: 'var(--space-lg) 0', textAlign: 'center',
          font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)',
        }}
      >
        Profil lässt sich nicht laden: {ladeFehler}
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

      {/* Ansehen und Bearbeiten sind zwei verschiedene Aufgaben und bekommen
          zwei verschiedene Darstellungen. Ein Formular mit readOnly liest
          sich wie ein Antrag; wer ein Profil oeffnet, will einen Eindruck. */}
      {!bearbeiten && (
        <ProfilSchaukasten
          name={kopf?.display_name ?? null}
          avatarPfad={kopf?.avatar_url ?? null}
          dabeiSeit={dabeiSeit}
          profil={profil}
          fotos={fotos}
          stats={stats}
          eigenes={eigenes}
        />
      )}

      {bearbeiten && (
      <>
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
              className="md-field__input md-field__input--multiline"
              id="community-bio"
              rows={3}
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
                      // feste-farbe-ok: Liegt auf dem Foto, nicht auf einer Flaeche der App - Weiss bleibt hier in beiden Modi richtig
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

      {/* ---- Die Fragen ---- */}
      {bearbeiten && (
        <fieldset className="md-form-section">
          <legend className="md-visually-hidden">Passt zu dir</legend>
          <p className="md-form-section__title">Passt zu dir</p>

          {/* Vorher sagen, was passiert. Ein Fragebogen ohne Begruendung
              sieht aus wie Datensammeln und wird so behandelt. */}
          <p className="md-optional">
            Diese Antworten helfen uns, dir passende Laufpartner vorzuschlagen.
            Sie stehen in deinem Profil, keine ist Pflicht, und du kannst sie
            jederzeit ändern oder löschen.
          </p>

          {/* Der Fortschritt steht als Kopf ueber den Fragen, nicht als Zahl
              im Fliesstext: eine Zeile, ein Balken, die naechste Frage. Er
              zaehlt alle acht Fragen - auch die zwei, die weiter oben eigene
              Felder haben. Sonst zeigte er 100 %, waehrend das Profil halb
              leer ist. */}
          <div className="md-completion">
            <p className="md-completion__count">
              {vollstaendigkeit.beantwortet} von {vollstaendigkeit.gesamt} Fragen beantwortet
            </p>
            <div
              className="md-progress"
              role="progressbar"
              aria-label="Beantwortete Fragen"
              aria-valuemin={0}
              aria-valuemax={vollstaendigkeit.gesamt}
              aria-valuenow={vollstaendigkeit.beantwortet}
            >
              {/* Die Breite ist der Messwert selbst und kann deshalb in
                  keiner Klasse stehen - wie bei .md-progress auf Home und
                  im Training. */}
              <div
                className="md-progress__fill"
                style={{ width: `${Math.round(vollstaendigkeit.anteil * 100)}%` }}
              />
            </div>
            {vollstaendigkeit.naechsteFrage ? (
              <p className="md-completion__next">
                Als Nächstes: <strong>{vollstaendigkeit.naechsteFrage.text}</strong>
              </p>
            ) : (
              <p className="md-completion__next md-completion__next--fertig">
                <Icon name="check" size={16} />
                Vollständig – mehr braucht das Zuordnen nicht.
              </p>
            )}
          </div>

          <div className="md-question-list">
            {FRAGEN.filter((f) => f.antworten).map((frage) => (
              <div className="md-question" key={frage.schluessel}>
                <p className="md-question__text" id={`frage-${frage.schluessel}`}>
                  {frage.text}
                </p>
                <p className="md-question__why" id={`wofuer-${frage.schluessel}`}>
                  {frage.wofuer}
                </p>
                <div
                  className="md-chip-set"
                  role="radiogroup"
                  aria-labelledby={`frage-${frage.schluessel}`}
                  aria-describedby={`wofuer-${frage.schluessel}`}
                >
                  {frage.antworten!.map((a) => {
                    const gewaehlt = antworten[frage.schluessel] === a.wert
                    return (
                      <button
                        key={a.wert}
                        type="button"
                        role="radio"
                        aria-checked={gewaehlt}
                        className="md-answer-chip"
                        // Noch einmal tippen nimmt zurueck - sonst laesst sich
                        // eine versehentliche Antwort nie wieder loeschen.
                        onClick={() =>
                          setAntworten((v) => ({
                            ...v,
                            [frage.schluessel]: gewaehlt ? '' : a.wert,
                          }))
                        }
                      >
                        {/* Der Ring ist immer da und fuellt sich beim Waehlen.
                            Wer Farben schlecht unterscheidet, sieht den
                            Haken. */}
                        <span className="md-answer-chip__mark" aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                        {a.text}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Der einzige Freitext unter den acht Fragen. Frage und
                Begruendung kommen aus FRAGEN und stehen nicht ein zweites Mal
                hier - sonst weichen sie irgendwann voneinander ab. */}
            {FREITEXT_FRAGE && (
              <div className="md-question">
                <label className="md-question__text" htmlFor="schoen-am-laufen">
                  {FREITEXT_FRAGE.text}
                </label>
                <p className="md-question__why" id="wofuer-schoen-am-laufen">
                  {FREITEXT_FRAGE.wofuer}
                </p>
                <textarea
                  id="schoen-am-laufen"
                  className="md-field__input md-field__input--multiline"
                  aria-describedby="wofuer-schoen-am-laufen"
                  rows={2}
                  maxLength={200}
                  value={antworten.schoen_am_laufen ?? ''}
                  onChange={(e) =>
                    setAntworten((v) => ({ ...v, schoen_am_laufen: e.target.value }))
                  }
                  placeholder="z. B. Die Stille am Morgen"
                />
              </div>
            )}
          </div>
        </fieldset>
      )}

      {/* ---- Wer sieht wen ---- */}
      {bearbeiten && (
        <fieldset className="md-form-section">
          <legend className="md-visually-hidden">Wer sieht wen</legend>
          <p className="md-form-section__title">Wer sieht wen</p>

          <div className="md-question-list">
            <div className="md-question">
              <p className="md-question__text" id="frage-identitaet">Ich bin …</p>
              <p className="md-question__why" id="wofuer-identitaet">
                Freiwillig. Steht in deinem Profil und wird beim Vorschlagen
                berücksichtigt.
              </p>
              <div
                className="md-chip-set"
                role="radiogroup"
                aria-labelledby="frage-identitaet"
                aria-describedby="wofuer-identitaet"
              >
                {IDENTITAETEN.map((a) => {
                  const gewaehlt = identitaet === a.wert
                  return (
                    <button
                      key={a.wert}
                      type="button"
                      role="radio"
                      aria-checked={gewaehlt}
                      className="md-answer-chip"
                      onClick={() => setIdentitaet(gewaehlt ? '' : a.wert)}
                    >
                      <span className="md-answer-chip__mark" aria-hidden="true" />
                      {a.text}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Die zwei Fragen erscheinen NUR, wenn ihre Werte wirklich
                gelesen wurden.

                Nicht geladen heisst nicht leer. Ein Kaestchen ohne Haken
                behauptet "du hast hier nichts eingestellt" - und wer das
                sieht, tippt nichts an und speichert. Damit stuende `{}` in
                der Spalte, und `{}` heisst laut Migration 0049 "alle". Der
                Bildschirm haette die Einstellung aufgehoben, ohne dass
                jemand sie angefasst hat. */}
            {einstellungen && (
            <>
            <div className="md-question">
              <p className="md-question__text" id="frage-zeigt-mir">
                Ich laufe am liebsten mit …
              </p>
              <p className="md-question__why" id="wofuer-zeigt-mir">
                Bestimmt, wessen Profile dir vorgeschlagen werden. Wählst du
                nichts, siehst du alle.
              </p>
              <div
                className="md-chip-set"
                role="group"
                aria-labelledby="frage-zeigt-mir"
                aria-describedby="wofuer-zeigt-mir"
              >
                {IDENTITAETEN.map((a) => {
                  const gewaehlt = zeigtMir.includes(a.wert)
                  return (
                    <button
                      key={a.wert}
                      type="button"
                      role="checkbox"
                      aria-checked={gewaehlt}
                      className="md-answer-chip"
                      onClick={() => mengeUmschalten(setZeigtMir, a.wert)}
                    >
                      <span className="md-answer-chip__mark" aria-hidden="true" />
                      {a.text}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="md-question">
              <p className="md-question__text" id="frage-sichtbar">
                Mein Profil darf gezeigt werden …
              </p>
              <p className="md-question__why" id="wofuer-sichtbar">
                Bestimmt, wer dich vorgeschlagen bekommt. Das ist nicht dasselbe
                wie die Frage darüber — wählst du nichts, sehen dich alle.
              </p>
              <div
                className="md-chip-set"
                role="group"
                aria-labelledby="frage-sichtbar"
                aria-describedby="wofuer-sichtbar"
              >
                {IDENTITAETEN.map((a) => {
                  const gewaehlt = sichtbarFuer.includes(a.wert)
                  return (
                    <button
                      key={a.wert}
                      type="button"
                      role="checkbox"
                      aria-checked={gewaehlt}
                      className="md-answer-chip"
                      onClick={() => mengeUmschalten(setSichtbarFuer, a.wert)}
                    >
                      <span className="md-answer-chip__mark" aria-hidden="true" />
                      {a.text}
                    </button>
                  )
                })}
              </div>
            </div>
            </>
            )}
          </div>

          {/* Der dritte Zustand: unbekannt.

              Er sagt zwei Dinge, und beide sind wichtig. Erstens: Was
              gespeichert ist, gilt unveraendert weiter - hier ist nichts
              verloren gegangen. Zweitens: Aendern geht erst, wenn die Werte
              da sind. Ohne den ersten Satz liest sich ein fehlender
              Abschnitt wie ein Datenverlust; ohne den zweiten sucht jemand
              den Abschnitt, der einmal hier stand.

              Neutral, nicht rot: Es ist nichts kaputt und niemandem etwas
              passiert. Ein roter Block an einer Datenschutzeinstellung
              behauptet ein Unglueck, das nicht stattgefunden hat. */}
          {!einstellungen && (
            <>
              <div className="md-info-note md-info-note--neutral" role="status">
                <Icon name="info" size={20} className="icon icon-sm" />
                <p>
                  Wen du siehst und wer dich sieht: noch nicht geladen. Deine
                  gespeicherten Angaben gelten unverändert weiter — ändern
                  lassen sie sich erst, wenn sie hier stehen.
                </p>
              </div>
              {/* Kein Icon und ein Text, der sich aendert - dieselbe Gestalt
                  wie "Erneut senden" unter Profil. `.md-button` bringt keinen
                  Aus-Zustand mit, das Wort traegt ihn. */}
              <button
                type="button"
                className="md-button md-button--outlined"
                disabled={einstellungenLaeuft}
                onClick={einstellungenErneutLaden}
              >
                {einstellungenLaeuft ? 'Wird geladen…' : 'Erneut laden'}
              </button>
            </>
          )}

          {/* Gescheitertes Speichern steht dort, wo es hingehoert: an dem
              Abschnitt, den es betrifft. Die Kurzeinblendung sagt nur, DASS
              es schiefging - der Grund ist zu lang fuer vier Sekunden
              (siehe Snackbar.tsx). Fehlerfarbe hier zu Recht: Die Aenderung
              ist NICHT eingetreten, es gilt weiter der alte Stand. */}
          {sichtFehler && (
            <div className="md-dienst-warnung" role="alert">
              <Icon name="warn" size={20} className="icon-sm md-dienst-warnung__icon" />
              <div className="md-dienst-warnung__text">
                <p className="md-dienst-warnung__folge">
                  Wer dich sieht, wurde nicht geändert.
                </p>
                <p className="md-dienst-warnung__grund">Grund: {sichtFehler}</p>
                <p className="md-dienst-warnung__abhilfe">
                  Es gilt weiter der zuletzt gespeicherte Stand. Noch einmal auf
                  „Speichern“ tippen.
                </p>
              </div>
            </div>
          )}
        </fieldset>
      )}

      {/* ---- Kilometer & Rekord ---- */}
      {bearbeiten && (
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
      )}

      </>
      )}

      {bearbeiten && (
      <div className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          {'Nachname, genauer Standort, Gesundheits- und Sensordaten werden nie geteilt – auch nicht über dieses Profil. Deine Läufe, dein Trainingsplan und alles aus der Anamnese bleiben privat.'}
        </p>
      </div>
      )}

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

      {/* Nur bei fremden Profilen, und bewusst am Ende: Wer melden will,
          sucht danach - wer nicht, soll nicht daran erinnert werden. */}
      {!eigenes && zielId && (
        <>
          <button
            type="button"
            className="md-button md-button--text"
            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
            onClick={() => setMenueOffen(true)}
          >
            <Icon name="more" className="icon-sm" />
            Weitere Möglichkeiten
          </button>
          <AktionsBlatt
            offen={menueOffen}
            onSchliessen={() => setMenueOffen(false)}
            titel="Diese Person"
            aktionen={[
              {
                text: 'Blockieren',
                beschreibung: 'Ihr seht einander nicht mehr — weder Beiträge noch Profil. Die Person erfährt nicht, dass du blockiert hast.',
                onWaehlen: async () => {
                  const fehler = await personBlockieren(zielId)
                  if (fehler) { showSnackbar(fehler); return }
                  showSnackbar('Blockiert.')
                  navigate(-1)
                },
              },
              {
                text: 'Melden',
                beschreibung: 'Wenn etwas nicht stimmt. Wir sehen es uns an. Blockiert wird dabei nicht.',
                onWaehlen: () => setMeldenOffen(true),
              },
            ]}
          />
          <MeldenBlatt
            offen={meldenOffen}
            onSchliessen={() => setMeldenOffen(false)}
            art="profil"
            zielId={zielId}
            onFertig={showSnackbar}
          />
        </>
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
