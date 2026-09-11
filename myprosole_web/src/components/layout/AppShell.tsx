import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import Benachrichtigungen from './Benachrichtigungen'
import DesignSchalter from './DesignSchalter'
import ChatGlocke from './ChatGlocke'
import BottomNav from './BottomNav'
import ChatFab from './ChatFab'
import { useSnackbar } from '../ui/Snackbar'
import {
  SeitenkopfProvider,
  kopfAktionenFuerPfad,
  kopfFuerPfad,
  useAngemeldeterKopf,
} from './Seitenkopf'

/**
 * Der dunkle Kopf ist randlos und deshalb ein GESCHWISTER von
 * .md-page-stack, nicht mehr dessen vorangestellte <TopAppBar/> (siehe
 * FUNDAMENT-DESIGN.md Abschnitt 3). TopAppBar.tsx bleibt bestehen (nicht
 * geloescht, AGENT-PROMPT.md), wird von hier aus aber nicht mehr gerendert.
 */
export default function AppShell() {
  return (
    <SeitenkopfProvider>
      <AppShellInnen />
    </SeitenkopfProvider>
  )
}

function AppShellInnen() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showHint = useSnackbar()
  const angemeldet = useAngemeldeterKopf()

  // Meldet keine Seite ihren Kopf an - in diesem Paket JEDE, denn es baut
  // keine Seite um -, faellt die Huelle auf die heutige Titel-Herleitung
  // zurueck (kopfFuerPfad, Vorbild TopAppBar.tsx:8-39).
  const kopf = angemeldet ?? kopfFuerPfad(pathname)
  // Aktionen im Kopf haengen an der Route, nicht am angemeldeten Titel -
  // sie gelten unveraendert weiter, sobald ab Paket 01 Seiten ihren eigenen
  // Kopf anmelden.
  const { aktion, glocke, chatGlocke } = kopfAktionenFuerPfad(pathname)
  // Ausnahme bis zum Profil-Paket, dann entfaellt sie: Profile.tsx hat
  // einen eigenen darkMode-State (Profile.tsx:154-155), der nicht vom
  // Kopf-Schalter erfaehrt. Zwei Schalter auf einer Seite zeigten dadurch
  // zwei verschiedene Staende (Design-Datei Abschnitt 5, Nutzer-Entscheidung
  // 10.09.2026). Auf jeder anderen Seite der Huelle bleibt der
  // Kopf-Schalter sichtbar.
  const zeigeDesignSchalter = pathname !== '/profil'

  const kopfIcons = (
    <>
      {zeigeDesignSchalter && <DesignSchalter />}
      {glocke && <Benachrichtigungen />}
      {chatGlocke && <ChatGlocke />}
      {aktion?.to ? (
        // --tonal wie im Vorbild TopAppBar.tsx:96 - toter Pfad heute (kein
        // ROOT_ACTIONS-Eintrag hat `to`), aber ohne die Klasse ginge diese
        // Variante der Vorlage bei der ersten echten Nutzung verloren.
        <Link
          to={aktion.to}
          className="md-app-bar__icon-btn md-app-bar__icon-btn--tonal"
          aria-label={aktion.label}
        >
          <Icon name={aktion.icon} />
        </Link>
      ) : aktion ? (
        <button
          type="button"
          onClick={() => showHint(aktion.hint ?? '')}
          className="md-app-bar__icon-btn"
          aria-label={aktion.label}
        >
          <Icon name={aktion.icon} />
        </button>
      ) : null}
    </>
  )

  // Ruecklauf 11.09.2026: die Renderpfade fuer 'home'/'seite' sind aus
  // diesem Paket entfernt - sie wichen schon von der Vorlage ab (Wortmarke
  // ohne __wordmark-accent-Spans, md-app-bar__icon-btn statt
  // md-home-hero__icon-btn) und haetten Paket 01/02-05 als ungetestete
  // Vorlage getaeuscht. `variante` bleibt im Typ (Seitenkopf.tsx), aber die
  // Huelle rendert bis Paket 01 IMMER den kompakten Kopf, unabhaengig davon,
  // was `kopf.variante` traegt - Paket 01 baut .md-home-hero/.md-page-hero
  // direkt aus der Vorlage, nicht aus diesem Platzhalter.
  //
  // Zweite benannte Ausnahme bei der oberen Polsterung: /chat liegt IN der
  // Huelle (App.tsx), gleicht das seitliche/untere Padding von
  // .md-page-stack--with-nav schon mit einem eigenen negativen Rand aus
  // (Chat.tsx:53-54), aber nicht das neue obere - der Chat-Verlauf rutschte
  // sonst um die neuen 24px unter die untere Leiste. Bis das Paket, das
  // Chat.tsx umbaut, faengt die Huelle diesen einen Fall hier ab, statt die
  // allgemeine --with-nav-Regel wieder aufzuweichen (die gilt fuer die
  // anderen 24 Routen der Huelle richtig).
  const ohneKopfAbstand = pathname === '/chat'

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <header className="md-page-hero md-page-hero--compact sticky top-0 z-30">
        <div className="md-page-hero__top-row">
          {kopf.zurueck && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="md-app-bar__icon-btn"
              aria-label="Zurück"
            >
              <Icon name="back" />
            </button>
          )}
          <h1 className="md-page-hero__title">{kopf.titel}</h1>
          {kopfIcons}
        </div>
      </header>
      <main
        className={`md-page-stack md-page-stack--with-nav flex-1${
          ohneKopfAbstand ? ' md-page-stack--ohne-kopf-abstand' : ''
        }`}
      >
        <Outlet />
      </main>
      <div className="md-nav-reserve" aria-hidden="true" />
      <ChatFab />
      <BottomNav />
    </div>
  )
}
