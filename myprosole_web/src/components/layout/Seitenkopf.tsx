import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Der Kopf jeder Seite in der App-Huelle.
 *
 * Kontext + Hook nach dem Vorbild von Snackbar.tsx (SnackbarContext +
 * useSnackbar): Eine Seite meldet ihren eigenen Kopf an (useSeitenkopf),
 * AppShell rendert ihn dort, wo bisher <TopAppBar/> stand.
 *
 * Meldet keine Seite etwas an, faellt AppShell auf kopfFuerPfad() zurueck
 * (unten in dieser Datei) - und genau das ist der einzige Fall in diesem
 * Paket: Paket 00 baut keine Seite um, useSeitenkopf hat also noch keinen
 * Aufrufer. Ab Paket 01 melden Seiten ihren Kopf hier an.
 *
 * Gerendert geprueft in Seitenkopf.render.test.tsx (jsdom je Datei per
 * Docblock, @testing-library/react - seit 12.09.2026): dass Provider und
 * useSeitenkopf sich NICHT gegenseitig endlos neu rendern, und dass der
 * angemeldete Titel beim Leser ankommt und beim Abmelden wieder verschwindet.
 */

export type SeitenkopfVariante = 'home' | 'seite' | 'kompakt'

export type SeitenkopfKennzahl = { wert: string; label: string }

export type SeitenkopfKonfig = {
  variante: SeitenkopfVariante
  titel: string
  untertitel?: string
  kennzahlen?: SeitenkopfKennzahl[]
  /** Nur fuer 'kompakt': Zurueck-Pfeil statt Titel allein. */
  zurueck?: boolean
  /**
   * Nur fuer 'home': die fertig gerenderte Hero-JSX (Wortmarke, Ring,
   * Mini-Stats, Start-Knopf, ...). Die Seite berechnet sie mit ihren
   * eigenen Store-Daten, AppShell platziert sie nur als Geschwister von
   * <main> - sie baut den Hero nicht selbst (Plan-Bericht 2026-09-12_2122,
   * Abschnitt d) 2, Entscheidung 11).
   */
  inhalt?: ReactNode
}

type Eintrag = { id: number; konfig: SeitenkopfKonfig }

type Kontext = {
  aktuell: SeitenkopfKonfig | null
  anmelden: (konfig: SeitenkopfKonfig) => () => void
}

const SeitenkopfContext = createContext<Kontext>({
  aktuell: null,
  anmelden: () => () => {},
})

let naechsteId = 0

export function SeitenkopfProvider({ children }: { children: ReactNode }) {
  const [eintraege, setEintraege] = useState<Eintrag[]>([])

  // useCallback mit leeren Deps - Vorbild Snackbar.tsx:41 (dort `show`).
  // Ohne das waere `anmelden` bei JEDEM Rendern der Provider-Komponente ein
  // neuer Funktionswert. useSeitenkopf traegt `anmelden` in seinen
  // Effekt-Deps: ein neuer Wert bei jedem Rendern liesse den Effekt jedes
  // Mal erneut laufen, der wiederum ueber setEintraege ein neues Rendern
  // ausloest - "Maximum update depth exceeded" beim ersten echten Aufrufer.
  // setEintraege selbst ist stabil (Garantie von useState), die
  // funktionale Aktualisierungsform (liste => ...) braucht `eintraege`
  // deshalb nicht in den Deps.
  const anmelden = useCallback((konfig: SeitenkopfKonfig) => {
    const id = ++naechsteId
    setEintraege((liste) => [...liste, { id, konfig }])
    return () => setEintraege((liste) => liste.filter((e) => e.id !== id))
  }, [])

  // Zuletzt angemeldet gewinnt - in der Praxis meldet immer nur eine Seite
  // gleichzeitig an, das Array haelt trotzdem mehrere Eintraege aus, statt
  // beim zweiten Aufruf den ersten stillschweigend zu verlieren.
  const aktuell = eintraege.length > 0 ? eintraege[eintraege.length - 1].konfig : null

  // Stabiler Kontextwert: ohne useMemo waere das Objekt bei jedem Rendern
  // des Providers neu, auch wenn sich weder `aktuell` noch `anmelden`
  // geaendert haben - jeder Konsument wuerde dann erneut benachrichtigt,
  // ganz gleich, ob sich fuer ihn etwas geaendert hat.
  const wert = useMemo(() => ({ aktuell, anmelden }), [aktuell, anmelden])

  return (
    <SeitenkopfContext.Provider value={wert}>
      {children}
    </SeitenkopfContext.Provider>
  )
}

/**
 * Von einer Seite aufgerufen, um ihren eigenen Kopf anzumelden. Noch ohne
 * Aufrufer in diesem Paket - siehe Kopfkommentar.
 */
export function useSeitenkopf(konfig: SeitenkopfKonfig) {
  const { anmelden } = useContext(SeitenkopfContext)
  const kennzahlenSchluessel = konfig.kennzahlen ? JSON.stringify(konfig.kennzahlen) : ''
  useEffect(
    () => anmelden(konfig),
    // konfig ist bei jedem Rendern ein neues Objekt; verglichen wird an
    // seinen Werten, nicht an seiner Identitaet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anmelden, konfig.variante, konfig.titel, konfig.untertitel, konfig.zurueck, kennzahlenSchluessel],
  )
}

/** Von AppShell gelesen: die angemeldete Konfiguration, oder null. */
export function useAngemeldeterKopf(): SeitenkopfKonfig | null {
  return useContext(SeitenkopfContext).aktuell
}

// ---- Rueckfall aus dem Pfad, wenn keine Seite etwas anmeldet ----
//
// Einzige Quelle fuer Route -> Titel/Aktionen. Frueher standen dieselben
// drei Tabellen zusaetzlich in TopAppBar.tsx - eine zweite Kopie derselben
// Zuordnung, obwohl AppShell.tsx diesen Kopf laengst direkt rendert statt
// <TopAppBar/>. TopAppBar.tsx importiert sie jetzt von hier (siehe dort);
// die Komponente selbst bleibt bestehen (nicht geloescht, AGENT-PROMPT.md),
// hat aber keinen Aufrufer mehr in der Huelle.

export const ROOT_TITLES: Record<string, string> = {
  '/': 'MyProSole',
  '/verlauf': 'Verlauf',
  '/training': 'Übungen',
  '/community': 'Community',
  '/profil': 'Profil',
  '/chat': 'MyProSole-Agent',
}

export const SUB_ROUTES: [RegExp, string][] = [
  [/^\/training\/uebung\//, 'Übung'],
  [/^\/training\/laufplan$/, 'Lauftraining'],
  [/^\/training\/tagebuch$/, 'Trainingstagebuch'],
  [/^\/anamnese/, 'Anamnese'],
  [/^\/puls-verbinden$/, 'Gerät verbinden'],
  // Wortlaut aus docs/messquellen.md, Abschnitt 4 - dort heisst der Bereich so.
  [/^\/telefon$/, 'Was dein Telefon kann'],
  [/^\/community\/chats$/, 'Anfragen & Chats'],
  [/^\/community\/profil/, 'Community-Profil'],
  [/^\/community\/gruppe\/neu$/, 'Gruppe gründen'],
  [/^\/community\/gruppe\/beitreten\//, 'Einladung'],
  [/^\/community\/gruppe\//, 'Gruppe'],
  [/^\/community\//, 'Community'],
  [/^\/zyklus$/, 'Zykluskalender'],
  [/^\/social-studio$/, 'Social-Studio'],
  [/^\/einlagen$/, 'Einlagen kennenlernen'],
  [/^\/einlage\/verbinden$/, 'Einlage verbinden'],
  [/^\/lauf\/tracking$/, 'Live-Tracking'],
  [/^\/lauf\/zusammenfassung$/, 'Laufzusammenfassung'],
  [/^\/lauf\/[^/]+\/analyse$/, 'Laufanalyse'],
  [/^\/lauf\//, 'Laufdetails'],
]

export type SeitenkopfAktion = { icon: string; label: string; hint?: string; to?: string }

// Aktionen rechts im Kopf, wie bisher in TopAppBar: Filter auf Verlauf. Die
// Glocke und die Chat-Glocke stehen nicht in dieser Tabelle - sie haben
// eigenen Zustand (Punkt bei offenen Hinweisen) und eigene Komponenten.
export const ROOT_ACTIONS: Record<string, SeitenkopfAktion> = {
  '/verlauf': {
    icon: 'filter',
    label: 'Filtern',
    hint: 'Weitere Filter kommen noch – nutze so lange die Zeitraum-Auswahl.',
  },
}

/**
 * Hat diese Route einen EIGENEN Titel (Wurzelseite oder Treffer in
 * SUB_ROUTES) oder liefe sie in kopfFuerPfad auf den allgemeinen Rueckfall
 * "MyProSole" hinaus? Getrennt von kopfFuerPfad, weil dessen Titel-String
 * bei der Startseite ('/') zufaellig derselbe ist wie der Rueckfall-Wert -
 * ein Vergleich am String allein koennte eine wirklich fehlende Route nicht
 * von der Startseite unterscheiden. Grundlage fuer
 * check_page_rules.py::pruefe_titel (Python-Fassung derselben Regel) und
 * fuer den Vitest-Fall "jede Route der Huelle hat einen Titel".
 */
export function hatEigenenTitel(pathname: string): boolean {
  return pathname in ROOT_TITLES || SUB_ROUTES.some(([muster]) => muster.test(pathname))
}

export type SeitenkopfRueckfall = {
  variante: 'kompakt'
  titel: string
  zurueck: boolean
}

/**
 * Reine Zuordnung Pfad -> Titel/Zurueck-Pfeil, ohne Seitenanmeldung. Direkt
 * testbar, ohne dass etwas gerendert werden muss.
 */
export function kopfFuerPfad(pathname: string): SeitenkopfRueckfall {
  const rootTitel = ROOT_TITLES[pathname]
  const istWurzelseite = rootTitel !== undefined
  let titel = rootTitel ?? 'MyProSole'
  if (!istWurzelseite) {
    for (const [muster, label] of SUB_ROUTES) {
      if (muster.test(pathname)) {
        titel = label
        break
      }
    }
  }
  return { variante: 'kompakt', titel, zurueck: !istWurzelseite }
}

/**
 * Aktionen im Kopf, die von der Route abhaengen statt vom angemeldeten
 * Kopf: Filter-Knopf, Glocke, Chat-Glocke. Getrennt von kopfFuerPfad, weil
 * sie auch dann noch gelten sollen, wenn eine Seite ab Paket 01 ihren
 * eigenen Titel/Variante anmeldet - sie sind Eigenschaften der Route, nicht
 * des angezeigten Titels.
 */
export function kopfAktionenFuerPfad(pathname: string) {
  return {
    aktion: ROOT_ACTIONS[pathname],
    glocke: pathname === '/',
    // Auf allen Community-Seiten, nicht nur auf der Startseite der
    // Community: Eine Anfrage soll auffallen, egal wo man sich umsieht.
    chatGlocke: pathname.startsWith('/community') && pathname !== '/community/chats',
  }
}
