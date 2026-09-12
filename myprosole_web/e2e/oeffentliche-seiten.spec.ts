import { test, expect, type ConsoleMessage } from '@playwright/test'
import { kontrastAufSeite } from './kontrast'

/**
 * Das Netz fuer die oeffentlichen Seiten.
 *
 * Drei Zusicherungen je Route, in beiden Themen. Sie sind bewusst grob:
 * Nicht "sieht aus wie der Entwurf", sondern "ist ueberhaupt benutzbar".
 * Ein Netz, das Geschmack prueft, flackert; eines, das Katastrophen prueft,
 * haelt.
 *
 *   1. Die Seite rendert ueberhaupt etwas.
 *   2. Keine Fehler in der Konsole.
 *   3. Kein waagerechtes Scrollen bei 320 px.
 *
 * Zu 3: Die Messung ist von `myprosole_app/e2e/entwuerfe.spec.ts:1022`
 * uebernommen ("never lets the device frame scroll sideways"), wo sie einen
 * echten Fall gefangen hat - absolut positionierte Auswahlfelder zogen den
 * Rahmen auf 652 px.
 *
 * Warum 320 px: Das ist die schmalste Breite, die die Abnahmeliste der
 * Uebergabe nennt (`design/uebergabe/README.md`). Ein iPhone SE der ersten
 * Bauart liegt dort.
 */

/**
 * Die acht oeffentlichen Routen - nachgezaehlt in `src/App.tsx`, nicht aus
 * der Uebergabe uebernommen. Deren README nennt sechs Seiten; das ist eine
 * Zusammenfassung, keine Liste. `passwort-neu` steht nur in der Paketdatei,
 * und `Legal.tsx` bedient zwei Routen.
 */
const OEFFENTLICHE_ROUTEN = [
  { pfad: '/willkommen', seite: 'Welcome.tsx' },
  { pfad: '/login', seite: 'Login.tsx' },
  { pfad: '/register', seite: 'Register.tsx' },
  { pfad: '/bestaetigen', seite: 'ConfirmEmail.tsx' },
  { pfad: '/passwort-vergessen', seite: 'ForgotPassword.tsx' },
  { pfad: '/passwort-neu', seite: 'PasswortNeu.tsx' },
  { pfad: '/agb', seite: 'Legal.tsx' },
  { pfad: '/datenschutz', seite: 'Legal.tsx' },
] as const

const THEMEN = ['light', 'dark'] as const

/**
 * Meldungen, die nichts ueber die Seite aussagen.
 *
 * Jede Ausnahme braucht einen Grund - sonst waechst die Liste, bis sie den
 * echten Fehler mit verschluckt. Das ist derselbe Fehler wie ein Prueftor,
 * das zu viel meldet: Wer zweimal Fehlalarme wegwischt, wischt beim dritten
 * Mal den Fund mit weg.
 */
const NICHT_DIE_SEITE = [
  // Ohne echte Zugangsdaten antwortet Supabase mit 401/400. Das ist die
  // Abwesenheit eines Kontos, kein Fehler der Seite.
  /supabase/i,
  /Failed to load resource/i,
]

function istEchterFehler(m: ConsoleMessage): boolean {
  if (m.type() !== 'error') return false
  const text = m.text()
  return !NICHT_DIE_SEITE.some((muster) => muster.test(text))
}

for (const thema of THEMEN) {
  test.describe(`oeffentliche Seiten, Thema ${thema}`, () => {
    for (const { pfad, seite } of OEFFENTLICHE_ROUTEN) {
      test(`${pfad} (${seite}) laedt, meldet nichts und laeuft nicht ueber`, async ({
        page,
      }) => {
        const fehler: string[] = []
        page.on('console', (m) => {
          if (istEchterFehler(m)) fehler.push(`${m.type()}: ${m.text()}`)
        })
        page.on('pageerror', (e) => fehler.push(`pageerror: ${e.message}`))

        // 320 px ist die Zusicherung aus der Abnahmeliste. Die Hoehe ist
        // beliebig; sie beeinflusst die Breitenmessung nicht.
        await page.setViewportSize({ width: 320, height: 800 })

        // Das Thema ueber den Speicher saeen, nicht ueber das Attribut.
        //
        // Erster Versuch war `documentElement.setAttribute` in einem
        // Init-Skript - das laeuft, BEVOR es ein `documentElement` gibt, und
        // warf `Cannot read properties of null`. Sechzehn rote Tests, alle
        // aus einem Fehler im Netz selbst.
        //
        // `lib/design.ts` liest beim Start `localStorage['myprosole_theme']`
        // und setzt das Attribut daraus. Das ist der vorgesehene Weg; der
        // Test benutzt ihn, statt an ihm vorbei zu greifen.
        await page.addInitScript((t) => {
          try {
            window.localStorage.setItem('myprosole_theme', t as string)
          } catch {
            // Privater Modus o. ae. - dann greift die Voreinstellung, und
            // die Zusicherung unten faellt auf. Genau richtig so.
          }
        }, thema)

        await page.goto(pfad, { waitUntil: 'networkidle' })

        // Erst der Aufbau: Ohne diese Zeile waere "in beiden Themen
        // geprueft" eine Behauptung. Greift die Saat nicht, laufen beide
        // Durchgaenge im selben Thema - und niemand merkt es.
        await expect(page.locator('html')).toHaveAttribute('data-theme', thema)

        // 1. Es steht ueberhaupt etwas da.
        //
        // `innerText` und nicht `toBeVisible()`: Eine weisse Seite hat ein
        // sichtbares `<body>`. Was sie NICHT hat, ist Text.
        const text = await page.locator('body').innerText()
        expect(text.trim().length, `${pfad} rendert keinen Text`).toBeGreaterThan(0)

        // 2. Kein waagerechtes Scrollen.
        //
        // Gemessen am Dokument, nicht an einem Behaelter: Ein Ueberlauf
        // irgendwo innen zieht das Dokument mit, und genau das sieht der
        // Mensch.
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))
        expect(
          scrollWidth,
          `${pfad} laeuft bei 320 px um ${scrollWidth - clientWidth} px ueber`,
        ).toBeLessThanOrEqual(clientWidth)

        // 3. Nichts in der Konsole, das die Seite betrifft.
        expect(fehler, `${pfad} meldet Fehler`).toEqual([])

        // 4. Keine Schrift in der Farbe ihres Untergrunds.
        //
        // Ausgeloest von einem echten Fund am 03.09.2026: Die Anmelde-Zeile
        // auf der Willkommensseite trug `--md-on-primary`, und das ist im
        // dunklen `setb`-Thema derselbe Wert wie `--md-scrim`
        // (index.css:219 gegen :252). Wochenlang ausgeliefert.
        //
        // Kein Tor hat es gesehen - auch die drei Zusicherungen darueber
        // nicht: **keine von ihnen sieht eine Farbe an.**
        const befund = await kontrastAufSeite(page)

        // Eine Verschiebung waehrend der Messung ist ein eigener Ausgang:
        // nicht bestanden, nicht durchgefallen, sondern UNGEMESSEN. Bis zum
        // 03.09.2026 tarnte sie sich als Fehlalarm - jeder achte Lauf
        // meldete auf /passwort-neu "Spanne 1,00 : 1" an wechselnder Stelle.
        expect(
          befund.verschoben,
          `${pfad} (${thema}): Layout hat sich waehrend der Messung bewegt`,
        ).toBe(false)

        for (const m of befund.messungen) {
          expect(
            m.verhaeltnis,
            `${pfad} (${thema}): "${m.text.slice(0, 40)}" hebt sich kaum vom Untergrund ab ` +
              `(Spanne ${m.verhaeltnis.toFixed(2)} : 1 ueber ${m.punkte} Bildpunkte)`,
            // Schwelle 3, gemessen und nicht gewaehlt: alte Farbe 2,18/2,84,
            // behoben 12,45/13,48, niedrigste bestehende Messung 11,48.
            // Zwischen 3 und 11 liegt kein gemessener Wert.
          ).toBeGreaterThan(3)
        }

        // Die Grenze der Aufzaehlung, ausgewiesen statt verschwiegen.
        expect(
          befund.ungemessen.length,
          `${pfad} (${thema}): ${befund.ungemessen.length} Textstellen ungemessen: ` +
            befund.ungemessen.join(' | '),
        ).toBeLessThanOrEqual(2)
      })
    }
  })
}
