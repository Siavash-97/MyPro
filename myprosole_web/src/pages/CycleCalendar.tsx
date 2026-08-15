import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCycle, offeneFrage, naechsterBeginn, alsTag, tageZwischen } from '../store/cycle'
import type { ZyklusModus } from '../store/cycle'
import { useConsent } from '../store/consent'
import Icon from '../components/ui/Icon'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useSnackbar } from '../components/ui/Snackbar'
import ZyklusFrage from '../components/cycle/ZyklusFrage'

/**
 * Zykluskalender (zyklus-einrichten.html und zyklus-kalender.html).
 *
 * Eingerichtet wird einmal, eingetragen wird danach ueber die Tagesfrage –
 * nicht ueber ein Formular. Der Kalender zeigt nur an, was die Fragen
 * ergeben haben.
 *
 * Zyklusdaten sind Gesundheitsdaten nach Art. 9 DSGVO. Die Einrichtung
 * beginnt deshalb mit der Einwilligung, nicht mit der ersten Eingabe, und
 * sie hat einen eigenen Bereich: Wer in die Anamnese eingewilligt hat, hat
 * damit nicht in den Zykluskalender eingewilligt.
 */
export default function CycleCalendar() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const { einstellungen, perioden, laedt, fehler, laden, einrichten, beenden } = useCycle()
  const { grantConsent, revokeConsent, consents, fetchConsents } = useConsent()

  const [letzterBeginn, setLetzterBeginn] = useState(alsTag(new Date()))
  const [arbeitet, setArbeitet] = useState(false)

  useEffect(() => {
    laden()
    fetchConsents()
  }, [laden, fetchConsents])

  const heute = alsTag(new Date())

  const handleEinrichten = async (modus: ZyklusModus) => {
    setArbeitet(true)
    // Zuerst die Einwilligung: Ohne sie darf nichts gespeichert werden.
    const cFehler = await grantConsent('cycle')
    if (cFehler) {
      setArbeitet(false)
      showSnackbar('Einwilligung konnte nicht gespeichert werden: ' + cFehler)
      return
    }
    const err = await einrichten(modus, letzterBeginn)
    setArbeitet(false)
    showSnackbar(err ? 'Einrichten fehlgeschlagen: ' + err : 'Zykluskalender ist eingerichtet')
  }

  const handleBeenden = async () => {
    setArbeitet(true)
    const err = await beenden()
    if (!err) {
      // Mit den Daten geht auch die Einwilligung – sie hatte nur diesen Zweck.
      const c = consents.find((x) => x.consent_scope === 'cycle')
      if (c) await revokeConsent(c.id)
    }
    setArbeitet(false)
    if (err) {
      showSnackbar('Löschen fehlgeschlagen: ' + err)
      return
    }
    showSnackbar('Zykluskalender beendet, alle Zyklusdaten gelöscht')
    navigate('/profil')
  }

  if (laedt) return <LoadingSpinner />

  if (fehler) {
    return (
      <p style={{ margin: 'var(--space-lg) 0', textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        Zykluskalender lässt sich nicht laden: {fehler}
      </p>
    )
  }

  // ---- Noch nicht eingerichtet ----------------------------------
  if (!einstellungen) {
    return (
      <>
        <div className="md-product-hero" style={{ marginBottom: 'var(--space-lg)' }}>
          <p className="md-onboarding-step">Optional</p>
          <h1 style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-title-lg)' }}>
            Dein Zyklus im Training
          </h1>
          <p style={{ margin: 0, font: 'var(--type-body-md)' }}>
            MyProSole fragt dich einmal am Tag, ob deine Periode angefangen hat – mehr trägst du
            nicht ein. Deine Läufe werden der Zyklusphase zugeordnet und die Übungsvorschläge
            daran angepasst.
          </p>
        </div>

        <div className="md-feature-list" style={{ marginBottom: 'var(--space-lg)' }}>
          <Merkmal icon="cycle" titel="Was eingetragen wird">
            Nur Beginn und Ende deiner Periode. Keine Symptome, keine Stimmung, keine weiteren
            Gesundheitsangaben.
          </Merkmal>
          <Merkmal icon="chat" titel="Wie es eingetragen wird">
            Eine Frage am Tag, mit Ja oder Nein zu beantworten. Sagst du Nein, fragt MyProSole am
            nächsten Tag noch einmal. Sagst du Ja, ist der Tag eingetragen und fünf Tage später
            wird gefragt, ob es vorbei ist.
          </Merkmal>
          <Merkmal icon="shield" titel="Deine Kontrolle">
            Du kannst den Kalender jederzeit beenden. Damit werden deine Zyklusdaten gelöscht und
            fließen nicht mehr in Empfehlungen ein.
          </Merkmal>
        </div>

        <div className="md-info-note" style={{ marginBottom: 'var(--space-lg)' }}>
          <Icon name="shield" size={20} className="icon icon-sm" />
          <p>
            Zyklusdaten sind besonders geschützte Gesundheitsdaten. Sie sind nur für dich lesbar,
            werden ausschließlich für die hier beschriebene Anpassung deiner Übungen verwendet und
            nicht an Dritte weitergegeben.
          </p>
        </div>

        <div className="md-field" style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="md-field__label" htmlFor="letzter-beginn">
            Wann hat deine letzte Periode angefangen?
          </label>
          <input
            className="md-field__input"
            id="letzter-beginn"
            type="date"
            max={heute}
            value={letzterBeginn}
            onChange={(e) => setLetzterBeginn(e.target.value)}
          />
        </div>
        <p style={{ margin: '0 0 var(--space-md)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Davon ausgehend wird gerechnet, ab wann gefragt wird. Ist das Datum ungefähr, reicht das.
        </p>

        <p className="md-section-title">Wie regelmäßig ist dein Zyklus?</p>
        <p style={{ margin: '0 0 var(--space-md)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Danach richtet sich, ob MyProSole den nächsten Beginn vorhersagt. Gefragt wird in beiden
          Fällen. Du kannst das später ändern.
        </p>

        <div className="md-choice-cards">
          <button
            type="button"
            className="md-choice-card"
            disabled={arbeitet}
            onClick={() => handleEinrichten('regular')}
          >
            <p className="md-choice-card__title">Regelmäßig</p>
            <p className="md-choice-card__desc">
              Mein Zyklus ist weitgehend gleich lang. MyProSole darf den nächsten Beginn vorhersagen
              und ihn im Kalender markieren.
            </p>
          </button>
          <button
            type="button"
            className="md-choice-card"
            disabled={arbeitet}
            onClick={() => handleEinrichten('irregular')}
          >
            <p className="md-choice-card__title">Unregelmäßig</p>
            <p className="md-choice-card__desc">
              Meine Zykluslänge schwankt. Keine Vorhersage – gefragt wird ab dem 21. Tag.
            </p>
          </button>
        </div>

        <p style={{ margin: 'var(--space-md) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Mit der Auswahl willigst du in die Verarbeitung deiner Zyklusdaten für den oben
          beschriebenen Zweck ein.
        </p>

        <Link className="md-button md-button--text" to="/profil" style={{ textDecoration: 'none', marginTop: 'var(--space-lg)' }}>
          Nicht einrichten
        </Link>
      </>
    )
  }

  // ---- Eingerichtet ---------------------------------------------
  const letzte = perioden[0]
  const zyklustag = letzte ? tageZwischen(letzte.started_on, heute) + 1 : null
  const vorhersage = naechsterBeginn(einstellungen, perioden)
  const frage = offeneFrage(einstellungen, perioden, heute)

  return (
    <>
      {/* Die Frage steht ganz oben: Sie ist der Grund, warum man hier ist. */}
      {frage && <ZyklusFrage />}

      {zyklustag != null && (
        <section className="md-card md-score" aria-label="Aktuelle Zyklusphase">
          <Ring tag={zyklustag} laenge={einstellungen.average_days} />
          <div>
            <p className="md-section-title" style={{ marginBottom: 4 }}>
              Zyklustag {zyklustag}
              {einstellungen.mode === 'regular' && ` von ${einstellungen.average_days}`}
            </p>
            <p className="md-analysis-score-copy">
              {vorhersage
                ? `Nächster Beginn voraussichtlich am ${langesDatum(vorhersage)}.`
                : 'Gezählt ab deinem letzten Eintrag. Ohne Vorhersage, weil dein Zyklus unregelmäßig ist.'}
            </p>
          </div>
        </section>
      )}

      <Monat
        perioden={perioden}
        heute={heute}
        vorhersage={vorhersage}
        laenge={einstellungen.average_days}
      />

      <section className="md-card">
        <div className="md-feature-heading">
          <div className="md-feature-heading__icon" aria-hidden="true">
            <Icon name="training" className="icon" />
          </div>
          <div>
            <p className="md-section-title" style={{ margin: '0 0 2px' }}>Wirkung auf dein Training</p>
            <p>
              Deine Übungsvorschläge berücksichtigen die aktuelle Zyklusphase. Das ist eine
              Trainingsempfehlung, keine medizinische Bewertung.
            </p>
          </div>
        </div>
        <Link
          className="md-settings-row"
          to="/uebungen"
          style={{ textDecoration: 'none', color: 'inherit', marginTop: 'var(--space-sm)' }}
        >
          <span className="md-settings-row__label">Übungen ansehen</span>
          <Icon name="chevron-right" className="icon md-row__chevron" />
        </Link>
      </section>

      <section className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <div>
          <p style={{ margin: '0 0 var(--space-sm)' }}>
            Deine Zyklusdaten sind nur für dich lesbar und werden ausschließlich für deine
            Übungsvorschläge verwendet.
          </p>
          <button
            type="button"
            className="md-button md-button--text md-button--compact"
            disabled={arbeitet}
            onClick={handleBeenden}
          >
            Kalender beenden und Daten löschen
          </button>
        </div>
      </section>
    </>
  )
}

function Merkmal({ icon, titel, children }: { icon: string; titel: string; children: React.ReactNode }) {
  return (
    <div className="md-feature-heading">
      <div className="md-feature-heading__icon" aria-hidden="true">
        <Icon name={icon} className="icon" />
      </div>
      <div>
        <p className="md-section-title" style={{ margin: '0 0 2px' }}>{titel}</p>
        <p>{children}</p>
      </div>
    </div>
  )
}

/** Fortschrittsring wie im Entwurf. Der Umfang ist 2*pi*40 = 251,2. */
function Ring({ tag, laenge }: { tag: number; laenge: number }) {
  const umfang = 251.2
  const anteil = Math.min(tag / laenge, 1)
  return (
    <div className="md-score__ring">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
        <circle className="md-score__ring-track" cx="48" cy="48" r="40" />
        <circle
          className="md-score__ring-value"
          cx="48" cy="48" r="40"
          strokeDasharray={umfang}
          strokeDashoffset={umfang * (1 - anteil)}
        />
      </svg>
      <div className="md-score__number">{tag}</div>
    </div>
  )
}

function langesDatum(tag: string): string {
  return new Date(tag + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

/**
 * Der laufende Monat. Bewusst nur einer: Der Kalender zeigt an, was die
 * Fragen ergeben haben – zum Blaettern gibt es hier nichts einzutragen.
 */
function Monat({
  perioden, heute, vorhersage, laenge,
}: {
  perioden: { started_on: string; ended_on: string | null }[]
  heute: string
  vorhersage: string | null
  laenge: number
}) {
  const jetzt = new Date(heute + 'T00:00:00')
  const jahr = jetzt.getFullYear()
  const monat = jetzt.getMonth()
  const tageImMonat = new Date(jahr, monat + 1, 0).getDate()

  // Montag als erster Tag: getDay() zaehlt ab Sonntag, deshalb der Versatz.
  const ersterWochentag = (new Date(jahr, monat, 1).getDay() + 6) % 7

  const istPeriode = (tag: string) =>
    perioden.some((p) => tag >= p.started_on && tag <= (p.ended_on ?? heute))

  // Die Vorhersage deckt so viele Tage ab wie eine uebliche Periode.
  const istVorhergesagt = (tag: string) => {
    if (!vorhersage) return false
    const d = tageZwischen(vorhersage, tag)
    return d >= 0 && d < 5
  }

  const felder = []
  for (let i = 0; i < ersterWochentag; i++) {
    felder.push(<span key={`leer-${i}`} className="md-calendar__day md-calendar__day--empty" aria-hidden="true" />)
  }
  for (let t = 1; t <= tageImMonat; t++) {
    const tag = `${jahr}-${String(monat + 1).padStart(2, '0')}-${String(t).padStart(2, '0')}`
    const klassen = ['md-calendar__day']
    if (istPeriode(tag)) klassen.push('md-calendar__day--period')
    else if (istVorhergesagt(tag)) klassen.push('md-calendar__day--predicted')
    if (tag === heute) klassen.push('md-calendar__day--today')
    felder.push(<span key={tag} className={klassen.join(' ')}>{t}</span>)
  }

  return (
    <section aria-labelledby="zyklus-monat-title">
      <div className="md-row" style={{ marginBottom: 'var(--space-sm)' }}>
        <p className="md-section-title" id="zyklus-monat-title" style={{ margin: 0 }}>
          {jetzt.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
        </p>
      </div>
      <div className="md-calendar">
        <div className="md-calendar__weekdays" aria-hidden="true">
          <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
        </div>
        <div className="md-calendar__grid" role="grid" aria-label={`${jetzt.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}, eingetragene Perioden-Tage sind hervorgehoben`}>
          {felder}
        </div>
        <ul className="md-calendar__legend">
          <li><span className="md-calendar__key md-calendar__key--period" aria-hidden="true" />Eingetragene Periode</li>
          {vorhersage && (
            <li><span className="md-calendar__key md-calendar__key--predicted" aria-hidden="true" />Vorhergesagt (Ø {laenge} Tage)</li>
          )}
          <li><span className="md-calendar__key md-calendar__key--today" aria-hidden="true" />Heute</li>
        </ul>
      </div>
    </section>
  )
}
