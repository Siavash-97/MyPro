import { test, expect } from '@playwright/test'
import { kontrastAufSeite } from './kontrast'

/**
 * Das Netz fuer die zwei Zustaende, die es auf "Passwort vergessen" nur
 * nach einer HANDLUNG gibt.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * `oeffentliche-seiten.spec.ts` laedt acht Routen und misst, was dabei
 * gerendert wird - kein `click`, kein `fill`, kein `submit`. Die
 * Erfolgsansicht und beide Fehler-Gestalten dieser Seite sind dort
 * unsichtbar. Vorbild und Aufbau: `anmelden-fehler.spec.ts` und
 * `registrieren-fehler.spec.ts`.
 *
 * Was hier geprueft wird
 * ----------------------
 *   1. Ohne Netz erscheint die NEUTRALE Meldung, und das E-Mail-Feld wird
 *      NICHT beschuldigt (kein aria-invalid, keine Feldmeldung). Das ist
 *      der eigentliche Punkt der Seite: Sie kann nicht wissen, ob an der
 *      Adresse etwas falsch ist, also behauptet sie es auch nicht.
 *   2. Die Meldung verschwindet nicht beim Tippen.
 *   3. Bei angenommener Anfrage steht der Erfolgstext im KONJUNKTIV
 *      ("Falls ein Konto ... existiert") und wird ueber role="status"
 *      angesagt.
 *   4. Kein waagerechtes Scrollen bei 320 px in beiden Zustaenden.
 *   5. Kontrast der neutralen Meldung ueber der Schwelle 3 - dieselbe
 *      Messung und dieselbe Schwelle wie im Ladezustand.
 *
 * DIE GRENZE DIESER PRUEFUNG, woertlich und nicht als Fussnote
 * ------------------------------------------------------------
 * Der Erfolgsfall wird ueber `page.route` erzeugt: Die Anfrage an
 * /auth/v1/recover wird abgefangen und mit 200 beantwortet.
 *
 *   EINE GEROUTETE ANTWORT BELEGT DIE REAKTION DER SEITE, NICHT DAS
 *   VERHALTEN VON SUPABASE.
 *
 * Wer sie in vier Wochen liest, soll nicht mehr hineinlesen, als dasteht.
 * Sie laeuft echt durch `resetPassword` und den Store - sie ist also nicht
 * dasselbe wie eine in den DOM gesetzte Meldung, die nur das Stylesheet
 * pruefte und gruen bliebe, wenn die Seite den Zustand gar nicht mehr
 * anzeigt. Aber sie beweist NICHT, dass Supabase fuer eine unbekannte
 * Adresse mit 200 antwortet. Das ist Verhalten oberhalb dieses
 * Repositoriums und hier ausdruecklich ungeprueft.
 *
 * Warum nicht der echte Weg: Ein echter Absendeversuch liefe je Lauf
 * mehrfach gegen die Produktions-Auth und verbrauchte deren
 * Ratenbegrenzung. Ab dem zweiten Lauf zeigte der Test dann den
 * Serverfehler statt des Erfolgs - und behauptete, das sei die Seite. Das
 * ist der Unterschied zu `anmelden-fehler.spec.ts`, wo ein 400 beliebig
 * oft kommen darf.
 *
 * NICHT GEPRUEFT, ausgewiesen statt verschwiegen: Gestalt 2 (Serverfehler
 * bei bestehendem Netz). Sie ist zeichengleich zu der bei Register bereits
 * gepruefte Fassung - dieselbe Klasse, dasselbe Markup, dieselbe
 * Ansage - und braeuchte denselben gerouteten Aufbau fuer geringen
 * Zusatzwert.
 */

const THEMEN = ['light', 'dark'] as const

/** Die Adresse ist erfunden und gehoert niemandem. */
const ERFUNDEN = 'kein-konto-testlauf@example.invalid'

async function seiteVorbereiten(page: import('@playwright/test').Page, thema: string) {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('myprosole_theme', t as string)
    } catch {
      // Privater Modus - dann greift die Voreinstellung und die Zusicherung
      // unten faellt auf. Genau richtig so.
    }
  }, thema)
  await page.goto('/passwort-vergessen', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', thema)
}

async function ohneUeberlauf(page: import('@playwright/test').Page, wo: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    scrollWidth,
    `${wo} laeuft um ${scrollWidth - clientWidth} px ueber`,
  ).toBeLessThanOrEqual(clientWidth)
}

for (const thema of THEMEN) {
  test.describe(`Passwort vergessen, Thema ${thema}`, () => {
    test('ohne Netz: neutrale Meldung, und das Feld wird nicht beschuldigt', async ({
      page,
      context,
    }) => {
      await seiteVorbereiten(page, thema)
      await page.fill('#forgot-email', ERFUNDEN)

      // Erst jetzt trennen, und danach WARTEN, bis die Seite es auch weiss.
      // setOffline wirkt nicht im selben Wimpernschlag - ohne diese Zeile
      // liefe die Pruefung rot, weil navigator.onLine beim Klick noch true
      // waere und die Seite folgerichtig die Server-Gestalt zeigte. Der
      // Fehler waere dann in der Pruefung, nicht in der Seite; genau die
      // Sorte Fehlalarm, die ein Netz wertlos macht.
      // (Nachgestellt und dokumentiert in anmelden-fehler.spec.ts.)
      await context.setOffline(true)
      await page.waitForFunction(() => navigator.onLine === false)
      await page.click('button[type="submit"]')

      const neutral = page.locator('[role="alert"]', { hasText: 'offline' })
      await expect(
        neutral,
        'ohne Netz erscheint keine Meldung ueber die Verbindung',
      ).toBeVisible({ timeout: 20_000 })

      // Der eigentliche Punkt: An der Eingabe ist nichts falsch - und die
      // Seite koennte es ohnehin nicht wissen -, also behauptet auch nichts,
      // dass etwas falsch ist.
      await expect(
        page.locator('#forgot-email'),
        'das E-Mail-Feld wird als fehlerhaft markiert',
      ).not.toHaveAttribute('aria-invalid', 'true')
      await expect(
        page.locator('.md-feld-fehler'),
        'es gibt eine Meldung am Feld, obwohl kein Feld betroffen ist',
      ).toHaveCount(0)
      await expect(
        page.locator('.md-field__input--fehler'),
        'ein Feld traegt den Fehlerrand, obwohl kein Feld betroffen ist',
      ).toHaveCount(0)

      // Sie verschwindet NICHT beim Tippen, sondern erst bei erneuter
      // Pruefung. Ohne diese Zusicherung waere die Regel eine Absicht.
      await page.fill('#forgot-email', 'jetzt-tippe-ich-etwas-anderes@example.invalid')
      await expect(neutral, 'die Meldung verschwand beim Tippen').toBeVisible()

      await ohneUeberlauf(page, '/passwort-vergessen im Fehlerzustand')

      // Kontrastzusicherung, dieselbe Messung und Schwelle wie im
      // Ladezustand. Gemessen wird der Kasten des TEXTKNOTENS, nicht der des
      // Elements - ein ueberwiegend leerer Ausschnitt faellt gegen 1.
      const befund = await kontrastAufSeite(page)
      expect(
        befund.verschoben,
        `${thema}: Layout hat sich waehrend der Messung bewegt`,
      ).toBe(false)

      const messung = befund.messungen.find((m) => m.text.startsWith('Dein Gerät ist gerade offline'))
      expect(
        messung,
        `die Meldung war unter den ${befund.messungen.length} gemessenen Textstellen nicht dabei` +
          (befund.ungemessen.length ? ` (ungemessen: ${befund.ungemessen.join(' | ')})` : ''),
      ).toBeDefined()

      expect(
        messung!.verhaeltnis,
        `${thema}: die Meldung hebt sich kaum vom Untergrund ab ` +
          `(Spanne ${messung!.verhaeltnis.toFixed(2)} : 1 ueber ${messung!.punkte} Bildpunkte)`,
      ).toBeGreaterThan(3)

      await context.setOffline(false)
    })

    test('angenommene Anfrage: Erfolgstext bleibt im Konjunktiv und wird angesagt', async ({
      page,
    }) => {
      await seiteVorbereiten(page, thema)

      // Siehe Kopfkommentar: Das belegt die Reaktion der Seite, nicht das
      // Verhalten von Supabase. Der Weg dorthin ist echt - Klick, Store,
      // resetPassword -, nur die Antwort ist gesetzt.
      await page.route('**/auth/v1/recover*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}',
        }),
      )

      await page.fill('#forgot-email', ERFUNDEN)
      await page.click('button[type="submit"]')

      const erfolg = page.locator('[role="status"]')
      await expect(
        erfolg,
        'nach der angenommenen Anfrage erscheint keine angesagte Erfolgsansicht',
      ).toBeVisible({ timeout: 20_000 })

      // Der Wortlaut ist die Entscheidung dieser Seite, nicht Zierat: Die
      // Seite erfaehrt NICHT, ob es zu der Adresse ein Konto gibt, und darf
      // deshalb nicht behaupten, dass eine Mail unterwegs ist.
      await expect(
        erfolg,
        'die Erfolgsmeldung behauptet mehr, als die Seite wissen kann',
      ).toContainText('Falls ein Konto')
      await expect(erfolg).toContainText(ERFUNDEN)

      // Das Formular ist weg - sonst stuenden Erfolg und Absendeknopf
      // gleichzeitig da.
      await expect(page.locator('#forgot-email')).toHaveCount(0)

      await ohneUeberlauf(page, '/passwort-vergessen im Erfolgszustand')
    })

    test('lange Adresse: der Erfolgstext zieht die Seite nicht auf', async ({ page }) => {
      await seiteVorbereiten(page, thema)
      await page.route('**/auth/v1/recover*', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
      )

      // Eine E-Mail-Adresse hat keine Trennstelle. Ohne overflow-wrap an
      // .md-auth-erfolg__text zoege genau dieser Satz die Seite auf - der
      // Grund, warum die Klasse die Zeile traegt.
      await page.fill(
        '#forgot-email',
        'sehr.lange.adresse.eines.einzelnen.menschen@ein-ausgesprochen-langer-anbietername.example',
      )
      await page.click('button[type="submit"]')
      await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 20_000 })

      await ohneUeberlauf(page, '/passwort-vergessen mit langer Adresse')
    })
  })
}
