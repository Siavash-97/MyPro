import { describe, expect, it } from 'vitest'
import { hatEigenenTitel, kopfAktionenFuerPfad, kopfFuerPfad } from './Seitenkopf'

/**
 * Reine Zuordnung Pfad -> Kopf, Vorbild TopAppBar.tsx (ROOT_TITLES,
 * SUB_ROUTES, ROOT_ACTIONS). Kein Rendern noetig - siehe Kopfkommentar in
 * Seitenkopf.tsx.
 */
describe('kopfFuerPfad', () => {
  it('erkennt eine Hauptseite an ihrem eigenen Titel, ohne Zurueck-Pfeil', () => {
    expect(kopfFuerPfad('/verlauf')).toEqual({ variante: 'kompakt', titel: 'Verlauf', zurueck: false })
    expect(kopfFuerPfad('/')).toEqual({ variante: 'kompakt', titel: 'MyProSole', zurueck: false })
    expect(kopfFuerPfad('/training')).toEqual({ variante: 'kompakt', titel: 'Übungen', zurueck: false })
    expect(kopfFuerPfad('/community')).toEqual({ variante: 'kompakt', titel: 'Community', zurueck: false })
    expect(kopfFuerPfad('/profil')).toEqual({ variante: 'kompakt', titel: 'Profil', zurueck: false })
  })

  it('gibt einer Unterseite den passenden Titel und den Zurueck-Pfeil', () => {
    expect(kopfFuerPfad('/training/uebung/kniebeuge')).toEqual({
      variante: 'kompakt',
      titel: 'Übung',
      zurueck: true,
    })
    expect(kopfFuerPfad('/lauf/abc123')).toEqual({ variante: 'kompakt', titel: 'Laufdetails', zurueck: true })
    expect(kopfFuerPfad('/lauf/abc123/analyse')).toEqual({
      variante: 'kompakt',
      titel: 'Laufanalyse',
      zurueck: true,
    })
  })

  it('prueft die spezifischere Community-Route vor der allgemeinen', () => {
    // /community/chats muss VOR /community/ greifen, sonst gewinnt das
    // allgemeine Muster und die Anfragen-Seite hiesse "Community".
    expect(kopfFuerPfad('/community/chats').titel).toBe('Anfragen & Chats')
    expect(kopfFuerPfad('/community/zusammenlauf').titel).toBe('Community')
  })

  it('faellt auf den App-Namen zurueck, wenn kein Muster passt', () => {
    expect(kopfFuerPfad('/irgendwas-unbekanntes')).toEqual({
      variante: 'kompakt',
      titel: 'MyProSole',
      zurueck: true,
    })
  })
})

/**
 * Quelle der Pfade: App.tsx:159-188, alle Routen INNERHALB von
 * <Route element={<AppShell />}>. Platzhalter (":slug", ":id", ":token")
 * durch "x" ersetzt, wie check_page_rules.py::pruefe_titel es fuer denselben
 * Zweck tut - eine Adresse wie "/lauf/x" wird wirklich aufgerufen, ":id"
 * nicht. Bewusst als eigener, von check_page_rules.py unabhaengiger Test:
 * Die Python-Pruefung liest App.tsx zur Laufzeit und faellt bei jeder
 * Aenderung dort mit; dieser Vitest-Fall haelt zusaetzlich fest, WELCHE
 * Routen heute gelten, und schlaegt zusaetzlich in `npx vitest run` an, nicht
 * erst in einer eigenen Python-Pruefung.
 */
const HUELLEN_ROUTEN = [
  '/',
  '/puls-verbinden',
  '/telefon',
  '/verlauf',
  '/training',
  '/training/uebung/x',
  '/training/laufplan',
  '/training/tagebuch',
  '/lauf/x/analyse',
  '/lauf/x',
  '/zyklus',
  '/social-studio',
  '/einlagen',
  '/einlage/verbinden',
  '/community',
  '/community/zusammenlauf',
  '/community/gruppen',
  '/community/chats',
  '/community/profil',
  '/community/profil/x',
  '/community/gruppe/neu',
  '/community/gruppe/beitreten/x',
  '/community/gruppe/x',
  '/profil',
  '/chat',
]

describe('hatEigenenTitel', () => {
  it('gibt jeder Route der Huelle einen eigenen Titel, keine faellt in den Rueckfall', () => {
    for (const pfad of HUELLEN_ROUTEN) {
      expect(hatEigenenTitel(pfad), `Route "${pfad}" ohne eigenen Titel`).toBe(true)
    }
  })

  // Eigens benannt, nicht nur Teil der Schleife oben: /chat fehlte in der
  // ersten Fassung dieser Tests (Ruecklauf 11.09.2026) komplett - die
  // Schleife allein haette das nicht sichtbar gemacht, eine eigene
  // Erwartung schon.
  it('kennt /chat', () => {
    expect(hatEigenenTitel('/chat')).toBe(true)
  })

  it('erkennt eine wirklich fehlende Route als Rueckfall', () => {
    expect(hatEigenenTitel('/irgendwas-unbekanntes')).toBe(false)
  })
})

describe('kopfAktionenFuerPfad', () => {
  it('zeigt die Glocke nur auf der Startseite', () => {
    expect(kopfAktionenFuerPfad('/').glocke).toBe(true)
    expect(kopfAktionenFuerPfad('/verlauf').glocke).toBe(false)
  })

  it('zeigt die Filter-Aktion nur auf Verlauf', () => {
    expect(kopfAktionenFuerPfad('/verlauf').aktion?.label).toBe('Filtern')
    expect(kopfAktionenFuerPfad('/training').aktion).toBeUndefined()
  })

  it('zeigt die Chat-Glocke auf Community-Seiten, aber nicht auf der Anfragen-Seite selbst', () => {
    expect(kopfAktionenFuerPfad('/community').chatGlocke).toBe(true)
    expect(kopfAktionenFuerPfad('/community/gruppe/1').chatGlocke).toBe(true)
    expect(kopfAktionenFuerPfad('/community/chats').chatGlocke).toBe(false)
    expect(kopfAktionenFuerPfad('/profil').chatGlocke).toBe(false)
  })
})
