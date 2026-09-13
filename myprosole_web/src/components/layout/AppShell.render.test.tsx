// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from './AppShell'
import { useSeitenkopf, type SeitenkopfKonfig } from './Seitenkopf'

/**
 * Paket 01 Schritt 2 (Huelle): meldet eine Seite `variante: 'home'` an,
 * bekommt sie von AppShell einen `md-home-hero`-Header AUSSERHALB von
 * `<main>` statt des kompakten Kopfes, und `/` bekommt dieselbe
 * Abstands-Ausnahme wie `/chat` (`md-page-stack--ohne-kopf-abstand`).
 *
 * jsdom je Docblock, cleanup in afterEach: Vorbild Seitenkopf.render.test.tsx
 * (dort auch die Begruendung fuer beides).
 *
 * Keine der Huellen-Kind-Komponenten (Benachrichtigungen, ChatFab, BottomNav,
 * DesignSchalter, ChatGlocke) wird hier gemockt: `glocke`/`chatGlocke` sind
 * fuer die getesteten Pfade ('/', '/verlauf') beide so, dass die jeweilige
 * Komponente in AppShell.tsx entweder gar nicht in den Baum kommt (kompakter
 * Zweig bei '/verlauf': kein Community-Pfad -> chatGlocke=false; Glocke nur
 * bei '/', aber dort rendert der 'home'-Zweig `kopfIcons` gar nicht) oder,
 * wo sie doch eingebunden waeren, ohne Netz-/Store-Seiteneffekt auskommen
 * (BottomNav/ChatFab lesen nur Pfad und Icon, keine Stores).
 */

function SeiteMitKopf({ konfig }: { konfig: SeitenkopfKonfig }) {
  useSeitenkopf(konfig)
  return <p data-testid="seiteninhalt">Seiteninhalt</p>
}

function renderHuelle(pfad: string, konfig: SeitenkopfKonfig) {
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<SeiteMitKopf konfig={konfig} />} />
          <Route path="verlauf" element={<SeiteMitKopf konfig={konfig} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
})

describe('AppShell: home-Variante des Seitenkopfs', () => {
  it('(a) rendert bei variante "home" einen md-home-hero-Header ausserhalb von <main>, mit dem uebergebenen Inhalt, und "/" bekommt die Abstands-Ausnahme', () => {
    const { container } = renderHuelle('/', {
      variante: 'home',
      titel: 'Start',
      inhalt: <div data-testid="hero-inhalt">Guten Morgen!</div>,
    })

    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    expect(header?.className).toContain('md-home-hero')
    expect(screen.getByTestId('hero-inhalt').textContent).toBe('Guten Morgen!')

    // Kein kompakter Kopf gleichzeitig im Baum.
    expect(container.querySelector('.md-page-hero--compact')).toBeNull()

    // Der Hero ist ein GESCHWISTER von <main>, kein Kind davon.
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.contains(header as Node)).toBe(false)

    // "/" bekommt dieselbe Abstands-Ausnahme wie "/chat".
    expect(main?.className).toContain('md-page-stack--ohne-kopf-abstand')
  })

  it('(b) rendert bei variante "kompakt" weiterhin den heutigen Kopf, ohne md-home-hero', () => {
    const { container } = renderHuelle('/verlauf', {
      variante: 'kompakt',
      titel: 'Verlauf',
    })

    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    expect(header?.className).toContain('md-page-hero--compact')
    expect(container.querySelector('.md-home-hero')).toBeNull()
  })

  it('(c) "/verlauf" mit variante "kompakt" bekommt die Abstands-Ausnahme NICHT', () => {
    const { container } = renderHuelle('/verlauf', {
      variante: 'kompakt',
      titel: 'Verlauf',
    })

    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.className).not.toContain('md-page-stack--ohne-kopf-abstand')
  })
})
