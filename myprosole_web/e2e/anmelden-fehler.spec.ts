import { test, expect } from '@playwright/test'
import { kontrastAufSeite } from './kontrast'

/**
 * Das Netz fuer einen Zustand, den es nur nach einer HANDLUNG gibt.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * `oeffentliche-seiten.spec.ts` laedt acht Routen und misst, was dabei
 * gerendert wird. Nachgezaehlt am 03.09.2026: Es enthaelt **kein `click`,
 * kein `fill`, kein `submit`**. Alles, was erst nach einer Eingabe
 * entsteht, ist dort unsichtbar.
 *
 * Die Anmeldeseite hat sechs Zustaende (Erstaufruf, weitergeleitet,
 * sendend, Zugangsfehler, Verbindungsfehler, Google-Fehler). Das
 * bestehende Netz sieht **einen**. Damit haette die Entscheidung mit der
 * groessten Reichweite des Pakets - die Fehlerdarstellung, die vier
 * weitere Seiten erben - keine einzige automatische Zusicherung: einmal
 * von Hand gemessen, danach nie wieder. Genau die Luecke, die vor dem
 * Netz bestand, nur eine Ebene tiefer.
 *
 * Was hier geprueft wird
 * ----------------------
 *   1. Nach einem falschen Passwort erscheint die Meldung ueberhaupt.
 *   2. Sie wird angesagt (`role="alert"`).
 *   3. Beide Felder tragen `aria-invalid` und verweisen auf sie.
 *   4. Sie verschwindet NICHT beim Tippen.
 *   5. Sie hebt sich vom Untergrund ab - dieselbe Messung wie im
 *      Ladezustand, mit derselben Schwelle 3.
 *   6. Kein waagerechtes Scrollen bei 320 px, auch mit Meldung.
 *
 * Warum ein echter Fehlversuch und keine eingespielte Meldung
 * ----------------------------------------------------------
 * Ohne Konto antwortet Supabase mit 400. Das ist der echte Weg, den ein
 * Mensch nimmt, und er prueft die Verdrahtung mit - eine eingesetzte
 * Meldung wuerde nur das Stylesheet pruefen und gruen bleiben, wenn die
 * Seite den Fehler gar nicht mehr anzeigt.
 *
 * GRENZE, ausgewiesen statt verschwiegen
 * --------------------------------------
 * Zwei der sechs Zustaende bleiben auch hier ungeprueft:
 *
 *   - Der **Google-Fehler**. Im Browser leitet supabase-js selbst weiter,
 *     die Seite ist weg, bevor ein Rueckgabewert ankommt (am 03.09.2026
 *     nachgestellt: genau eine Navigation zu /auth/v1/authorize, kein
 *     Fehlerwert). Dieser Zweig traegt in der Android-Huelle, und die
 *     laesst sich hier nicht starten.
 *   - Der **Verbindungsfehler** bei bestehendem Netz. Er braucht eine
 *     Kategorie von `signIn`, die es noch nicht gibt.
 *
 * Der Offline-Fall wird geprueft, weil `context.setOffline` ihn erzeugt.
 */

const THEMEN = ['light', 'dark'] as const

/** Die Zugangsdaten sind erfunden und gehoeren niemandem. */
const ERFUNDEN = {
  email: 'kein-konto-testlauf@example.invalid',
  passwort: 'absichtlich-falsch-0000',
}

async function seiteVorbereiten(page: import('@playwright/test').Page, thema: string) {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('myprosole_theme', t as string)
    } catch {
      // Privater Modus - dann greift die Voreinstellung und die
      // Zusicherung unten faellt auf. Genau richtig so.
    }
  }, thema)
  await page.goto('/login', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', thema)
}

for (const thema of THEMEN) {
  test.describe(`Anmelden, Fehlerzustand, Thema ${thema}`, () => {
    test('falsches Passwort: Meldung steht am Feld, ist angesagt und hebt sich ab', async ({
      page,
    }) => {
      await seiteVorbereiten(page, thema)

      await page.fill('#login-email', ERFUNDEN.email)
      await page.fill('#login-password', ERFUNDEN.passwort)
      await page.click('button[type="submit"]')

      const meldung = page.locator('#login-zugang-fehler')
      await expect(meldung, 'nach einem Fehlversuch erscheint keine Meldung').toBeVisible({
        timeout: 20_000,
      })

      // Angesagt, nicht nur sichtbar. docs/seiten-regeln.md fuehrt
      // "Fehlermeldungen ohne role=alert" als offenen Befund.
      await expect(meldung).toHaveAttribute('role', 'alert')

      // Beide Felder: Supabase sagt absichtlich nicht, welches falsch war.
      for (const feld of ['#login-email', '#login-password']) {
        await expect(page.locator(feld)).toHaveAttribute('aria-invalid', 'true')
        await expect(page.locator(feld)).toHaveAttribute(
          'aria-describedby',
          'login-zugang-fehler',
        )
      }

      // Der Fokus ersetzt die weggelassene Sammelmeldung.
      await expect(page.locator('#login-email')).toBeFocused()

      // Sie verschwindet NICHT beim Tippen, sondern erst bei erneuter
      // Pruefung. Ohne diese Zusicherung waere die Regel eine Absicht.
      await page.fill('#login-password', 'jetzt-tippe-ich-etwas-anderes')
      await expect(meldung, 'die Meldung verschwand beim Tippen').toBeVisible()

      // Kein Ueberlauf, auch mit Meldung.
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(
        scrollWidth,
        `/login laeuft im Fehlerzustand um ${scrollWidth - clientWidth} px ueber`,
      ).toBeLessThanOrEqual(clientWidth)

      // Und die Kontrastzusicherung, dieselbe wie im Ladezustand.
      //
      // Gemessen wird der Kasten des TEXTKNOTENS der Meldung, nicht der
      // des Elements: Das Element enthaelt auch das Warndreieck und die
      // Flaeche daneben, und ein ueberwiegend leerer Ausschnitt faellt
      // gegen 1 - der Fehlalarm, an dem die erste Fassung von
      // kontrast.ts gescheitert ist.
      //
      // UMGESTELLT am 03.09.2026: Der erste Aufbau holte erst alle Kaesten
      // und fotografierte danach. Genau diese Luecke liess `kontrast.ts`
      // jeden achten Lauf einen Fehler melden, den es nicht gab.
      // `kontrastAufSeite` macht beides aus EINEM Bild und meldet eine
      // Verschiebung als eigenen Ausgang.
      const befund = await kontrastAufSeite(page)
      expect(
        befund.verschoben,
        `${thema}: Layout hat sich waehrend der Messung bewegt`,
      ).toBe(false)

      const messung = befund.messungen.find((m) => m.text.startsWith('E-Mail oder Passwort'))
      expect(
        messung,
        `die Fehlermeldung war unter den ${befund.messungen.length} gemessenen Textstellen nicht dabei` +
          (befund.ungemessen.length ? ` (ungemessen: ${befund.ungemessen.join(' | ')})` : ''),
      ).toBeDefined()

      expect(
        messung!.verhaeltnis,
        `${thema}: die Fehlermeldung hebt sich kaum vom Untergrund ab ` +
          `(Spanne ${messung!.verhaeltnis.toFixed(2)} : 1 ueber ${messung!.punkte} Bildpunkte)`,
        // Dieselbe Schwelle wie im Ladezustand. Sie ist dort gemessen und
        // nicht gewaehlt worden; hier waere eine andere Zahl eine zweite
        // Wahrheit ueber dieselbe Frage.
      ).toBeGreaterThan(3)
    })

    test('ohne Netz: neutrale Meldung, und kein Feld wird beschuldigt', async ({
      page,
      context,
    }) => {
      await seiteVorbereiten(page, thema)

      await page.fill('#login-email', ERFUNDEN.email)
      await page.fill('#login-password', ERFUNDEN.passwort)

      // Erst jetzt trennen: Die Seite selbst soll geladen sein.
      //
      // Und danach WARTEN, bis die Seite es auch weiss. setOffline wirkt
      // nicht im selben Wimpernschlag: Ohne diese Zeile lief die Pruefung
      // am 03.09.2026 zweimal rot, weil `navigator.onLine` beim Klick
      // noch true war und die Seite folgerichtig die Zugangs-Gestalt
      // zeigte. Das war ein Fehler der Pruefung, nicht der Seite - genau
      // die Sorte Fehlalarm, die ein Netz wertlos macht.
      await context.setOffline(true)
      await page.waitForFunction(() => navigator.onLine === false)
      await page.click('button[type="submit"]')

      const neutral = page.locator('[role="alert"]', { hasText: 'offline' })
      await expect(
        neutral,
        'ohne Netz erscheint keine Meldung ueber die Verbindung',
      ).toBeVisible({ timeout: 20_000 })

      // Der eigentliche Punkt dieser Pruefung: An den Eingaben ist
      // nichts falsch, also behauptet auch nichts, dass etwas falsch ist.
      for (const feld of ['#login-email', '#login-password']) {
        await expect(
          page.locator(feld),
          `${feld} wird ohne Netz als fehlerhaft markiert`,
        ).not.toHaveAttribute('aria-invalid', 'true')
      }
      await expect(page.locator('#login-zugang-fehler')).toHaveCount(0)

      await context.setOffline(false)
    })
  })
}
