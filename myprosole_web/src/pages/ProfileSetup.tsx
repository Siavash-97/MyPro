import { useState, useEffect, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import type { ProfilHindernisArt } from '../lib/hindernis'

/**
 * Die Gestalten, in denen ein Fehlschlag auf DIESER Seite erscheint.
 *
 * Weniger als es Arten gibt, und das ist der Punkt: Zwei Kategorien fallen
 * zusammen, wenn die naechste Handlung des Menschen dieselbe ist
 * (docs/authhindernis-entwurf.md, R2-Q1). `unbekannt` und ein
 * `nicht-erreichbar` bei scheinbar vorhandenem Netz enden beide bei
 * "gleich noch einmal".
 *
 * Keiner der vier Saetze beschuldigt die Eingabe - denn hier gibt es nichts,
 * was der Server ablehnen koennte, was die Seite nicht schon selbst geprueft
 * hat (1 bis 50 Zeichen, unten). Wer nach einem Fehlschlag "Pruef deinen
 * Namen" liest, aendert einen richtigen Namen in einen, der ihm nicht
 * gefaellt, und es scheitert wieder.
 */
type Fehlerart = 'abgemeldet' | 'verbindung' | 'verweigert' | 'fehlschlag'

const FEHLERTEXT: Record<Fehlerart, string> = {
  abgemeldet:
    'Deine Anmeldung ist abgelaufen. Melde dich neu an – dein Name wurde noch nicht gespeichert.',
  verbindung:
    'Dein Gerät ist gerade offline. Dein Name wurde nicht gespeichert – versuch es noch einmal, sobald du wieder Netz hast.',
  verweigert:
    'Das Speichern wurde nicht erlaubt. Das liegt nicht an deiner Eingabe – versuch es später noch einmal.',
  fehlschlag:
    'Das Speichern hat gerade nicht geklappt. Deine Eingabe ist in Ordnung – versuch es gleich noch einmal.',
}

/**
 * Von der Art zur Gestalt - die einzige Stelle, an der diese Seite
 * entscheidet, was sie sagt. Der Rohtext bleibt im Hindernis und kommt nie
 * auf den Bildschirm (docs/authhindernis-entwurf.md, Abschnitt 10).
 *
 * Eine TABELLE statt einer `if`-Kette mit Rest (B2 der Durchsicht,
 * 08.09.2026, Muster aus Login.tsx): `Record<ProfilHindernisArt, …>`
 * verlangt jede Art einzeln. Ein Rest-Zweig zur Gestalt `fehlschlag` am Ende
 * haette eine fuenfte Art still verschluckt - gemessen an genau dieser
 * Datei: `|
 * 'gesperrt'` an `ProfilHindernisArt` gehaengt, und der Typcheck blieb hier
 * stumm.
 */
const GESTALT: Record<ProfilHindernisArt, Fehlerart> = {
  'nicht-angemeldet': 'abgemeldet',
  verweigert: 'verweigert',
  // Online: der neutrale Satz. Die Offline-Ausnahme steht in `gestaltFuer`.
  'nicht-erreichbar': 'fehlschlag',
  unbekannt: 'fehlschlag',
}

function gestaltFuer(art: ProfilHindernisArt): Fehlerart {
  // Die eine Ausnahme vor der Tabelle:
  // navigator.onLine ist nur in EINE Richtung verlaesslich: false heisst
  // sicher "kein Netz", true heisst nicht "erreichbar". Genau so wird es
  // hier benutzt - erst nachdem das Speichern gescheitert ist, und nur um
  // den milderen der beiden Saetze zu waehlen, wenn das Geraet selbst sagt,
  // dass es nicht senden konnte. Dieselbe Begruendung wie in `Login.tsx`.
  if (art === 'nicht-erreichbar' && !navigator.onLine) return 'verbindung'
  return GESTALT[art]
}

/**
 * Profil einrichten.
 *
 * Bewusst nur der Anzeigename: Alter, Pensum, Ziele und Beschwerden werden in
 * der Anamnese erhoben und sollen hier nicht ein zweites Mal abgefragt werden.
 * Siehe docs/umsetzung-offene-punkte.md, Punkt 1.
 */
export default function ProfileSetup() {
  // Der Name aus der Registrierung, damit er nicht zweimal getippt wird.
  const location = useLocation()
  const nameFromRegister = (location.state as { name?: string } | null)?.name ?? ''
  const [displayName, setDisplayName] = useState(nameFromRegister)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const createProfile = useAuth((s) => s.createProfile)
  const profile = useAuth((s) => s.profile)
  const navigate = useNavigate()

  // Geprueft wird der Anzeigename, nicht die blosse Existenz der Zeile.
  //
  // Bei jeder Registrierung legt ein Ausloeser in der Datenbank sofort eine
  // Profilzeile an – leer, aber vorhanden. Die Bedingung "if (profile)" war
  // damit immer wahr, und die Einrichtung sprang auf die Startseite, noch
  // bevor jemand seinen Namen eintragen konnte. Der bei der Registrierung
  // getippte Name ging dabei verloren, und die Anamnese am Ende dieser Seite
  // wurde nie erreicht.
  useEffect(() => {
    if (profile?.display_name?.trim()) navigate('/', { replace: true })
  }, [profile, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = displayName.trim()
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      setError('Der Name muss zwischen 1 und 50 Zeichen lang sein.')
      return
    }

    setSubmitting(true)
    const hindernis = await createProfile({
      display_name: trimmedName,
      running_level: null,
      weekly_goal_km: null,
    })
    setSubmitting(false)

    if (hindernis) {
      // Bis zum 08.09.2026 wurde hier der rohe Text der Bibliothek mit einem
      // Praefix davor angezeigt. "permission denied for table profiles" sagte
      // dem Menschen nichts und dem Angreifer den Tabellennamen.
      setError(FEHLERTEXT[gestaltFuer(hindernis.art)])
      return
    }

    // Nach dem Anlegen geht es in die Anamnese, nicht auf die Startseite.
    // So ist der Ablauf im Entwurf gedacht, und ohne sie gibt es keinen
    // Trainingsplan – wer direkt auf der Startseite landet, sieht eine App
    // ohne Inhalt und weiss nicht, dass die Anamnese existiert. Sie laesst
    // sich dort ueberspringen, aber sie wird wenigstens angeboten.
    navigate('/anamnese', { replace: true })
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <div className="md-app-bar">
        <h1 className="md-app-bar__title">Profil einrichten</h1>
      </div>

      <form onSubmit={handleSubmit} className="md-auth-form">
        <div>
          <p className="md-onboarding-step">Dein Startprofil</p>
          <p className="md-greeting__title" style={{ font: 'var(--type-title-lg)', margin: '0 0 4px' }}>
            Wie dürfen wir dich nennen?
          </p>
          <p className="md-greeting__subtitle">
            Alles Weitere fragen wir gleich in der Anamnese – dort steht es ohnehin.
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-md bg-error-container text-on-error-container" style={{ font: 'var(--type-body-md)' }}>
            {error}
          </div>
        )}

        <div className="md-field">
          <label className="md-field__label" htmlFor="setup-name">Name</label>
          <input
            className="md-field__input"
            id="setup-name"
            type="text"
            required
            maxLength={50}
            autoComplete="name"
            placeholder="Zum Beispiel Sia"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <button className="md-button md-button--filled" type="submit" disabled={submitting}>
          {submitting ? 'Wird gespeichert…' : 'Profil übernehmen'}
        </button>
      </form>
    </div>
  )
}
