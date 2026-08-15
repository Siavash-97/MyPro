import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/ui/Icon'

/**
 * AGB und Datenschutzerklärung.
 *
 * Beide Texte liegen in einer Datei, weil sie denselben Rahmen benutzen und
 * sich gegenseitig verlinken. Sie sind oeffentlich erreichbar – wer sich beim
 * Registrieren einverstanden erklaeren soll, muss vorher lesen koennen, womit.
 *
 * WICHTIG: Diese Texte sind ein fachlich sorgfaeltiger Entwurf, der
 * beschreibt, was die App tatsaechlich tut. Sie ersetzen keine
 * Rechtsberatung. Vor dem oeffentlichen Start muss eine Anwaeltin oder ein
 * Anwalt daraufsehen, besonders wegen der Gesundheitsdaten nach Artikel 9
 * DSGVO.
 *
 * Anbieterangaben: Firmierung, Anschrift und Kontaktadresse stehen noch nicht
 * fest. Statt sie zu erfinden, verweisen die Texte auf einen eigenen
 * Kontaktabschnitt – dort steht ein Satz, bis die Angaben da sind. Sobald sie
 * feststehen, ANBIETER und KONTAKT unten setzen; die Texte ziehen dann von
 * selbst nach.
 */

/** Sobald die Firmierung feststeht, hier eintragen. */
const ANBIETER: string | null = null
/** Sobald die Kontaktadresse feststeht, hier eintragen. */
const KONTAKT: string | null = null
const STAND = '15. August 2026'

const ANBIETER_TEXT = ANBIETER ?? 'dem Betreiber von MyProSole'
const KONTAKT_TEXT = KONTAKT ?? 'über die unten genannte Kontaktmöglichkeit'

function Rahmen({ titel, children }: { titel: string; children: React.ReactNode }) {
  const { pathname } = useLocation()
  const istAgb = pathname === '/agb'

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <header className="md-app-bar">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="md-app-bar__icon-btn"
          aria-label="Zurück"
        >
          <Icon name="back" className="icon" />
        </button>
        <span className="md-app-bar__title">{titel}</span>
      </header>

      <main className="md-page-stack flex-1">
        <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          Stand: {STAND}
        </p>

        <div
          style={{
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--md-surface-container-high)',
            color: 'var(--md-on-surface-variant)',
            font: 'var(--type-body-md)',
          }}
        >
          Dieser Text ist ein Entwurf und noch nicht anwaltlich geprüft.
          Er beschreibt, was die App heute tatsächlich tut.
        </div>

        {children}

        <Link
          className="md-button md-button--text"
          to={istAgb ? '/datenschutz' : '/agb'}
          style={{ textDecoration: 'none' }}
        >
          {istAgb ? 'Zur Datenschutzerklärung' : 'Zu den Nutzungsbedingungen'}
        </Link>
      </main>
    </div>
  )
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="md-section-title">{titel}</h2>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          font: 'var(--type-body-md)',
          color: 'var(--md-on-surface-variant)',
        }}
      >
        {children}
      </div>
    </section>
  )
}

export function Terms() {
  return (
    <Rahmen titel="Nutzungsbedingungen">
      <Abschnitt titel="Wer die App anbietet">
        <p style={{ margin: 0 }}>
          MyProSole wird angeboten von {ANBIETER_TEXT}. Fragen zur Nutzung
          beantworten wir {KONTAKT_TEXT}.
        </p>
      </Abschnitt>

      <Abschnitt titel="Was die App leistet">
        <p style={{ margin: 0 }}>
          MyProSole zeichnet deine Läufe auf, führt ein Trainingstagebuch,
          erstellt aus deinen Angaben einen Laufplan und schlägt Übungen vor.
          Die Auswertungen beruhen auf deinen eigenen Eingaben und den Messwerten
          deines Geräts.
        </p>
      </Abschnitt>

      <Abschnitt titel="Keine medizinische Beratung">
        <p style={{ margin: 0 }}>
          Das ist der wichtigste Punkt auf dieser Seite. MyProSole ist eine
          Trainingshilfe, kein Medizinprodukt. Die Hinweise und Pläne ersetzen
          keine ärztliche oder physiotherapeutische Untersuchung, Diagnose oder
          Behandlung.
        </p>
        <p style={{ margin: 0 }}>
          Bei Schmerzen, Beschwerden oder Unsicherheit über deinen
          Gesundheitszustand wende dich an eine Ärztin oder einen Arzt. Brich
          das Training ab, wenn dir etwas weh tut – auch dann, wenn die App
          etwas anderes vorschlägt.
        </p>
      </Abschnitt>

      <Abschnitt titel="Dein Konto">
        <p style={{ margin: 0 }}>
          Du brauchst ein Konto, um die App zu nutzen. Halte deine Zugangsdaten
          geheim und gib sie nicht weiter. Melde dich bei uns, wenn du den
          Verdacht hast, dass jemand anders Zugriff hat.
        </p>
        <p style={{ margin: 0 }}>
          Du kannst deine aufgezeichneten Läufe jederzeit im Profil löschen.
          Für die Löschung des gesamten Kontos melde dich bei uns.
        </p>
      </Abschnitt>

      <Abschnitt titel="Was nicht erlaubt ist">
        <p style={{ margin: 0 }}>
          Nicht erlaubt sind: der Versuch, fremde Konten oder Daten einzusehen,
          das automatisierte Auslesen der App, sowie Inhalte, die andere
          beleidigen oder gegen Gesetze verstoßen.
        </p>
      </Abschnitt>

      <Abschnitt titel="Verfügbarkeit">
        <p style={{ margin: 0 }}>
          Wir bemühen uns um einen zuverlässigen Betrieb, können aber keine
          ununterbrochene Verfügbarkeit zusichern. Wartungsarbeiten, Störungen
          beim Hoster oder fehlender Mobilfunkempfang können die Nutzung
          zeitweise einschränken.
        </p>
      </Abschnitt>

      <Abschnitt titel="Haftung">
        <p style={{ margin: 0 }}>
          Für Schäden aus der Verletzung von Leben, Körper oder Gesundheit sowie
          bei Vorsatz und grober Fahrlässigkeit haften wir nach den gesetzlichen
          Vorschriften. Im Übrigen haften wir nur bei Verletzung wesentlicher
          Vertragspflichten und begrenzt auf den vorhersehbaren, typischen
          Schaden.
        </p>
      </Abschnitt>

      <Abschnitt titel="Änderungen">
        <p style={{ margin: 0 }}>
          Wir dürfen diese Bedingungen ändern, wenn es sachliche Gründe gibt –
          etwa neue Funktionen oder geänderte Gesetze. Über Änderungen
          informieren wir dich rechtzeitig in der App oder per E-Mail.
        </p>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <p style={{ margin: 0 }}>
          {KONTAKT
            ? `Du erreichst uns unter ${KONTAKT}.`
            : 'Die App befindet sich im Aufbau. Anbieterangaben und eine feste Kontaktadresse ergänzen wir, bevor sie öffentlich verfügbar ist. Bis dahin erreichst du uns über die Stelle, über die du Zugang bekommen hast.'}
        </p>
      </Abschnitt>
    </Rahmen>
  )
}

export function Privacy() {
  return (
    <Rahmen titel="Datenschutzerklärung">
      <Abschnitt titel="Verantwortlich">
        <p style={{ margin: 0 }}>
          Verantwortlich für die Verarbeitung deiner Daten ist {ANBIETER_TEXT}.
          Bei Fragen zum Datenschutz erreichst du uns {KONTAKT_TEXT}.
        </p>
      </Abschnitt>

      <Abschnitt titel="Welche Daten wir verarbeiten">
        <p style={{ margin: 0 }}>
          <strong>Kontodaten:</strong> deine E-Mail-Adresse und dein Passwort in
          verschlüsselter Form. Meldest du dich mit Google an, erhalten wir von
          dort deine E-Mail-Adresse.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Profil:</strong> der Name, den du angibst.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Anamnese:</strong> deine Antworten zu Laufpensum, Erfahrung,
          Beschwerden, früheren Verletzungen und Operationen.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Läufe:</strong> Standortdaten während der Aufzeichnung,
          Strecke, Dauer, Tempo und Höhenmeter.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Training:</strong> Trainingstagebuch mit Befinden und
          Beschwerden, deine Pläne und absolvierten Einheiten.
        </p>
      </Abschnitt>

      <Abschnitt titel="Gesundheitsdaten und deine Einwilligung">
        <p style={{ margin: 0 }}>
          Angaben zu Beschwerden, Verletzungen und deinem Befinden sind
          Gesundheitsdaten. Ebenso deine Laufstrecken, denn daraus lässt sich
          auf deinen Gesundheitszustand schließen. Solche Daten stehen unter dem
          besonderen Schutz von Artikel 9 der Datenschutz-Grundverordnung.
        </p>
        <p style={{ margin: 0 }}>
          Wir verarbeiten sie ausschließlich auf Grundlage deiner ausdrücklichen
          Einwilligung nach Artikel 9 Absatz 2 Buchstabe a DSGVO. Die App holt
          diese Einwilligung getrennt ein und speichert, wann du sie erteilt
          hast. Du kannst sie jederzeit im Profil widerrufen – die Verarbeitung
          bis zum Widerruf bleibt davon unberührt.
        </p>
      </Abschnitt>

      <Abschnitt titel="Wozu wir sie verwenden">
        <p style={{ margin: 0 }}>
          Ausschließlich dafür, dir die App bereitzustellen: dein Konto führen,
          deine Läufe aufzeichnen und auswerten, deinen Trainingsplan erstellen
          und passende Übungen vorschlagen.
        </p>
        <p style={{ margin: 0 }}>
          Wir verkaufen deine Daten nicht. Wir nutzen sie nicht für Werbung. Wir
          setzen keine Analyse- oder Tracking-Dienste ein.
        </p>
      </Abschnitt>

      <Abschnitt titel="Wer sie außerdem verarbeitet">
        <p style={{ margin: 0 }}>
          <strong>Supabase</strong> – Datenbank und Anmeldung. Dort liegen deine
          Daten gespeichert.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Vercel</strong> – Auslieferung der App an deinen Browser.
        </p>
        <p style={{ margin: 0 }}>
          <strong>MapTiler</strong> – Kartenausschnitte für die Laufkarte. Beim
          Laden der Karte wird der angezeigte Kartenausschnitt übermittelt.
          Deine aufgezeichnete Route verlässt die App dabei nicht.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Google</strong> – nur, wenn du dich für die Anmeldung mit
          Google entscheidest.
        </p>
      </Abschnitt>

      <Abschnitt titel="Wie lange wir sie speichern">
        <p style={{ margin: 0 }}>
          So lange dein Konto besteht. Löschst du deine Läufe im Profil,
          verschwinden sie mitsamt Streckenpunkten sofort und endgültig. Löschst
          du dein Konto, entfernen wir alle zugehörigen Daten.
        </p>
      </Abschnitt>

      <Abschnitt titel="Deine Rechte">
        <p style={{ margin: 0 }}>
          Du hast das Recht auf Auskunft über deine gespeicherten Daten, auf
          Berichtigung falscher Angaben, auf Löschung, auf Einschränkung der
          Verarbeitung, auf Herausgabe deiner Daten in einem übertragbaren
          Format und auf Widerspruch gegen die Verarbeitung.
        </p>
        <p style={{ margin: 0 }}>
          Erteilte Einwilligungen kannst du jederzeit widerrufen. Außerdem
          kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren.
        </p>
        <p style={{ margin: 0 }}>
          Für all das genügt eine Nachricht an uns.
        </p>
      </Abschnitt>

      <Abschnitt titel="Standortdaten">
        <p style={{ margin: 0 }}>
          Die App fragt den Standort nur ab, während du einen Lauf aufzeichnest.
          Du kannst die Freigabe jederzeit in den Einstellungen deines Geräts
          zurücknehmen – dann lässt sich die Aufzeichnung allerdings nicht mehr
          nutzen.
        </p>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <p style={{ margin: 0 }}>
          {KONTAKT
            ? `Du erreichst uns unter ${KONTAKT}.`
            : 'Die App befindet sich im Aufbau. Anbieterangaben und eine feste Kontaktadresse ergänzen wir, bevor sie öffentlich verfügbar ist. Bis dahin erreichst du uns über die Stelle, über die du Zugang bekommen hast.'}
        </p>
      </Abschnitt>
    </Rahmen>
  )
}
