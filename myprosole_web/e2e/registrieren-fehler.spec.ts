import { test, expect } from '@playwright/test'
import { kontrastAufSeite } from './kontrast'

/**
 * Das Netz fuer Register-Zustaende, die es nur nach einer HANDLUNG gibt.
 * Vorbild: anmelden-fehler.spec.ts - dort steht, warum das Lade-Netz
 * (oeffentliche-seiten.spec.ts) solche Zustaende nicht sieht.
 *
 * WARUM DIE UNGLEICH-PRUEFUNG und nicht "Passwort zu kurz"
 * --------------------------------------------------------
 * Die Freigabe empfahl den billigsten deterministischen Fehler, die
 * Client-Pruefung. Davon hat Register zwei - und nur eine ist im
 * Browser erreichbar: Das minLength-Attribut am Passwortfeld laesst
 * den Browser ein zu kurzes Passwort abfangen, BEVOR handleSubmit
 * laeuft; die Gestalt-1-Meldung dieses Falls erschiene im Test nie,
 * und die Pruefung wuerde etwas anderes messen als sie behauptet
 * (naemlich die native Blase des Browsers). Die Ungleich-Pruefung hat
 * kein natives Gegenstueck, laeuft wirklich durch den Seitencode und
 * ist genauso deterministisch: kein Server, kein Mock, kein Konto.
 *
 * Der zweite Test deckt Gestalt 3 (offline): signUp geht ins Leere,
 * OHNE ein Konto anzulegen - es gibt kein Netz.
 *
 * GRENZE, ausgewiesen statt verschwiegen
 * --------------------------------------
 *   - Der GOOGLE-Fehler ist im Browser nicht ausloesbar (supabase-js
 *     leitet selbst weiter; Beleg im Fehlerbericht 2026-09-03_1520).
 *   - Die SERVER-Gestalt (signUp scheitert bei bestehendem Netz)
 *     braeuchte einen echten signUp-Fehlversuch. Anders als bei signIn
 *     legt ein "Fehlversuch" hier im Zweifel ein ECHTES Konto an -
 *     ein Test, der Konten erzeugt, waere schlimmer als die Luecke.
 *   - Der Fall "bereits registriert" braeuchte ein bestehendes Konto
 *     und damit echte Nutzerdaten im Test. Gleiches Argument.
 */

const THEMEN = ['light', 'dark'] as const

/** Die Eingaben sind erfunden und erreichen nie einen Server: Die
 *  Ungleich-Pruefung stoppt VOR signUp. */
const ERFUNDEN = {
  name: 'Testlauf Niemand',
  email: 'kein-konto-testlauf@example.invalid',
  passwort: 'lang-genug-und-erfunden-1',
  andersGetippt: 'lang-genug-und-erfunden-2',
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
  await page.goto('/register', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', thema)
}

/** Fuellt alle vier Felder und hakt das Rechts-Kaestchen an - ohne das
 *  Kaestchen bleibt der Knopf gesperrt und kein Zustand ist erreichbar. */
async function formularFuellen(page: import('@playwright/test').Page, bestaetigt: string) {
  await page.fill('#register-name', ERFUNDEN.name)
  await page.fill('#register-email', ERFUNDEN.email)
  await page.fill('#register-password', ERFUNDEN.passwort)
  await page.fill('#register-confirm', bestaetigt)
  await page.check('#register-consent')
}

for (const thema of THEMEN) {
  test.describe(`Registrieren, Fehlerzustand, Thema ${thema}`, () => {
    test('ungleiche Passwoerter: Meldung am Feldpaar, angesagt, hebt sich ab', async ({
      page,
    }) => {
      await seiteVorbereiten(page, thema)
      await formularFuellen(page, ERFUNDEN.andersGetippt)
      await page.click('button[type="submit"]')

      const meldung = page.locator('#register-pw-ungleich-fehler')
      await expect(meldung, 'nach einem Fehlversuch erscheint keine Meldung').toBeVisible()

      // Angesagt, nicht nur sichtbar.
      await expect(meldung).toHaveAttribute('role', 'alert')

      // BEIDE Passwortfelder: welches vertippt wurde, weiss niemand.
      for (const feld of ['#register-password', '#register-confirm']) {
        await expect(page.locator(feld)).toHaveAttribute('aria-invalid', 'true')
        await expect(page.locator(feld)).toHaveAttribute(
          'aria-describedby',
          'register-pw-ungleich-fehler',
        )
      }

      // Und NUR die: Name und E-Mail sind nicht beschuldigt.
      for (const feld of ['#register-name', '#register-email']) {
        await expect(
          page.locator(feld),
          `${feld} wird markiert, obwohl die Meldung nichts ueber es sagt`,
        ).not.toHaveAttribute('aria-invalid', 'true')
      }

      // Der Fokus ersetzt die weggemessene Sammelmeldung.
      await expect(page.locator('#register-password')).toBeFocused()

      // Sie verschwindet NICHT beim Tippen, sondern erst bei erneuter
      // Pruefung.
      await page.fill('#register-confirm', 'jetzt-tippe-ich-etwas-anderes')
      await expect(meldung, 'die Meldung verschwand beim Tippen').toBeVisible()

      // Kein Ueberlauf, auch mit Meldung.
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(
        scrollWidth,
        `/register laeuft im Fehlerzustand um ${scrollWidth - clientWidth} px ueber`,
      ).toBeLessThanOrEqual(clientWidth)

      // Dieselbe Kontrastzusicherung wie im Ladezustand, ueber den
      // bewachten Weg (kontrastAufSeite: ein Bild, alle Kaesten).
      const befund = await kontrastAufSeite(page)
      expect(
        befund.verschoben,
        `${thema}: Layout hat sich waehrend der Messung bewegt`,
      ).toBe(false)

      const messung = befund.messungen.find((m) =>
        m.text.startsWith('Die Passwörter stimmen nicht'),
      )
      expect(
        messung,
        `die Fehlermeldung war unter den ${befund.messungen.length} gemessenen Textstellen nicht dabei` +
          (befund.ungemessen.length ? ` (ungemessen: ${befund.ungemessen.join(' | ')})` : ''),
      ).toBeDefined()

      expect(
        messung!.verhaeltnis,
        `${thema}: die Fehlermeldung hebt sich kaum vom Untergrund ab ` +
          `(Spanne ${messung!.verhaeltnis.toFixed(2)} : 1 ueber ${messung!.punkte} Bildpunkte)`,
        // Dieselbe Schwelle wie ueberall; eine andere Zahl waere eine
        // zweite Wahrheit ueber dieselbe Frage.
      ).toBeGreaterThan(3)
    })

    test('ohne Netz: neutrale Meldung, und kein Feld wird beschuldigt', async ({
      page,
      context,
    }) => {
      await seiteVorbereiten(page, thema)
      // Beide Passwoerter gleich: Die Client-Pruefungen sollen
      // durchlassen, damit signUp wirklich aufgerufen wird.
      await formularFuellen(page, ERFUNDEN.passwort)

      // Erst jetzt trennen, und dann WARTEN, bis die Seite es weiss -
      // setOffline wirkt nicht im selben Wimpernschlag (Beleg:
      // anmelden-fehler.spec.ts, dort lief die Pruefung ohne das
      // waitForFunction zweimal rot).
      await context.setOffline(true)
      await page.waitForFunction(() => navigator.onLine === false)
      await page.click('button[type="submit"]')

      const neutral = page.locator('[role="alert"]', { hasText: 'offline' })
      await expect(
        neutral,
        'ohne Netz erscheint keine Meldung ueber die Verbindung',
      ).toBeVisible({ timeout: 20_000 })

      // An den Eingaben ist nichts falsch, also behauptet auch nichts,
      // dass etwas falsch ist.
      for (const feld of [
        '#register-name',
        '#register-email',
        '#register-password',
        '#register-confirm',
      ]) {
        await expect(
          page.locator(feld),
          `${feld} wird ohne Netz als fehlerhaft markiert`,
        ).not.toHaveAttribute('aria-invalid', 'true')
      }
      await expect(page.locator('#register-pw-ungleich-fehler')).toHaveCount(0)
      await expect(page.locator('#register-server-fehler')).toHaveCount(0)

      await context.setOffline(false)
    })
  })
}
