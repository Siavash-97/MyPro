import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Zykluskalender einrichten (zyklus-einrichten.html).
 *
 * Zyklusdaten sind Gesundheitsdaten nach DSGVO Art. 9. Die Einrichtung ist
 * deshalb ausdruecklich opt-in und beginnt mit der Einwilligung, nicht mit
 * der Dateneingabe.
 */
export default function CycleCalendar() {
  const showSnackbar = useSnackbar()

  return (
    <>
      <section className="md-connect-hero">
        <div className="md-connect-hero__icon">
          <Icon name="cycle" className="icon" />
        </div>
        <h1>Zykluskalender</h1>
        <p>
          Wenn du möchtest, berücksichtigt MyProSole deine Zyklusphase bei den
          Trainingsempfehlungen.
        </p>
      </section>

      <div className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          Zyklusdaten sind besonders geschützte Gesundheitsdaten. Sie werden verschlüsselt
          gespeichert, nur für deine Trainingsempfehlungen verwendet und lassen sich
          jederzeit vollständig löschen.
        </p>
      </div>

      <section className="md-card">
        <h2 className="md-section-title">Was der Kalender tut</h2>
        <ul className="md-benefit-list">
          <li>Zeigt deine aktuelle Zyklusphase im Training an</li>
          <li>Ordnet Empfehlungen zu Umfang und Intensität der Phase zu</li>
          <li>Bleibt eine Trainingsempfehlung, keine medizinische Bewertung</li>
        </ul>
      </section>

      <button
        type="button"
        className="md-button md-button--filled"
        onClick={() => showSnackbar('Der Zykluskalender wird noch angeschlossen.')}
      >
        Zykluskalender einrichten
      </button>
      <Link className="md-button md-button--text" to="/profil" style={{ textDecoration: 'none' }}>
        Nicht jetzt
      </Link>
    </>
  )
}
