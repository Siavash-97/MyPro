import { test, expect } from '@playwright/test'
import { kontrastAufSeite } from './kontrast'

/**
 * Das Netz fuer die dritte Gestalt auf /bestaetigen (Auftrag 4a-ii, 07.09.2026).
 *
 * Warum es diese Datei gibt
 * -------------------------
 * `oeffentliche-seiten.spec.ts` laedt `/bestaetigen` und misst, was dabei
 * gerendert wird - kein `click`, kein `fill`, kein `submit`. Die neue dritte
 * Gestalt von `CodeConfirmForm.tsx` entsteht erst nach einer HANDLUNG und ist
 * dort unsichtbar. Vorbild und Aufbau: `anmelden-fehler.spec.ts` und
 * `passwort-vergessen-fehler.spec.ts`.
 *
 * Was hier geprueft wird
 * ----------------------
 *   1. Nach einer Ratenbegrenzung beim Pruefen des Codes erscheint die
 *      neutrale Notiz mit dem Warte-Schluss.
 *   2. Die Notiz wird angesagt (`role="alert"`), traegt aber NICHT die
 *      Klasse `.md-feld-fehler` - das waere die falsche, rote Gestalt.
 *   3. Sie hebt sich vom Untergrund ab, in beiden Themen - dieselbe Messung
 *      und Schwelle wie bei den anderen Auth-Seiten.
 *
 * Wie die Seite ihre E-Mail bekommt
 * ----------------------------------
 * `/bestaetigen` (ConfirmEmail.tsx) liest die Adresse ueber
 * `holeBestaetigungsEmail` aus `localStorage`
 * (`lib/pendingSignup.ts`, Schluessel `myprosole_pending_confirm_email`).
 * Sie wird hier per `addInitScript` gesetzt, genau wie `oeffentliche-
 * seiten.spec.ts` das Thema setzt - vor dem `goto`, damit die Seite sie beim
 * ersten Rendern schon vorfindet.
 *
 * DIE GRENZE DIESER PRUEFUNG, woertlich und nicht als Fussnote
 * ------------------------------------------------------------
 * Der 429-Fall laesst sich nicht echt herbeifuehren, ohne die
 * Ratenbegrenzung der Produktions-Auth zu verbrauchen. Er wird deshalb ueber
 * `page.route` gefaelscht, Hausmuster aus `anmelden-fehler.spec.ts`:
 *
 *   EINE GEROUTETE ANTWORT BELEGT DIE REAKTION DER SEITE, NICHT DAS
 *   VERHALTEN VON SUPABASE.
 *
 * Der Weg dorthin ist echt - Klick, Store, `verifyCode`, `lib/hindernis.ts`
 * -, nur die Antwort ist gesetzt. Der Header `X-Supabase-Api-Version` ist
 * kein Zierat: Ohne ihn liest auth-js `data.code` nicht (siehe
 * `anmelden-fehler.spec.ts`, Kopfkommentar), und der Fall faellt auf
 * `unbekannt` statt `zu-oft` - dann pruefte dieser Test etwas anderes, als
 * er behauptet.
 *
 * ROT GESEHEN (07.09.2026): Mit `hindernis.art === 'zu-oft'` in
 * `CodeConfirmForm.tsx` probeweise auf den `abgelehnt`-Weg umgebogen, zeigte
 * die Seite die ROTE Gestalt mit `CODE_FEHLER` statt der neutralen Notiz mit
 * Warte-Schluss - dieser Test schlug fehl. Zurueckgestellt, wieder gruen.
 */

const THEMEN = ['light', 'dark'] as const

/** Die Adresse ist erfunden und gehoert niemandem. */
const ERFUNDEN = 'kein-konto-testlauf@example.invalid'

async function seiteVorbereiten(page: import('@playwright/test').Page, thema: string) {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript(
    ({ t, email }) => {
      try {
        window.localStorage.setItem('myprosole_theme', t)
        window.localStorage.setItem('myprosole_pending_confirm_email', email)
      } catch {
        // Privater Modus - dann greift die Voreinstellung und die
        // Zusicherung unten faellt auf. Genau richtig so.
      }
    },
    { t: thema, email: ERFUNDEN },
  )
  await page.goto('/bestaetigen', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', thema)
}

for (const thema of THEMEN) {
  test.describe(`Bestaetigen, Fehlerzustand, Thema ${thema}`, () => {
    test('Ratenbegrenzung beim Pruefen: neutrale Notiz mit Warte-Schluss, keine rote Feldmeldung', async ({
      page,
    }) => {
      await seiteVorbereiten(page, thema)

      // Koerper und Code sind die des Servers, der Status ist der des
      // Servers. Siehe Kopfkommentar zur Grenze dieser Bauart.
      await page.route('**/auth/v1/verify*', (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: { 'X-Supabase-Api-Version': '2024-01-01' },
          body: '{ "code": "over_email_send_rate_limit", "message": "email rate limit exceeded" }',
        }),
      )

      await expect(page.locator('#confirm-email')).toHaveValue(ERFUNDEN)
      await page.fill('#confirm-code', '123456')
      await page.click('button[type="submit"]')

      const neutral = page.locator('[role="alert"]', { hasText: 'Prüfung' })
      await expect(
        neutral,
        'nach einer Ratenbegrenzung erscheint keine neutrale Meldung',
      ).toBeVisible({ timeout: 20_000 })

      // Der eigentliche Punkt: Eine Meldung, die nur entlastet, laesst den
      // Menschen ohne naechsten Schritt. Bei `zu-oft` heisst der "warten".
      await expect(
        neutral,
        'die Meldung nennt den naechsten Schritt nicht: warten',
      ).toContainText('warte ein paar Minuten')

      // Die falsche, rote Gestalt darf nirgends stehen.
      await expect(
        page.locator('.md-feld-fehler'),
        'die Meldung traegt die rote Feld-Gestalt statt der neutralen Notiz',
      ).toHaveCount(0)
      await expect(neutral).not.toHaveClass(/md-feld-fehler/)

      const befund = await kontrastAufSeite(page)
      expect(
        befund.verschoben,
        `${thema}: Layout hat sich waehrend der Messung bewegt`,
      ).toBe(false)

      const messung = befund.messungen.find((m) =>
        m.text.startsWith('Die Prüfung hat gerade nicht geklappt'),
      )
      expect(
        messung,
        `die Meldung war unter den ${befund.messungen.length} gemessenen Textstellen nicht dabei` +
          (befund.ungemessen.length ? ` (ungemessen: ${befund.ungemessen.join(' | ')})` : ''),
      ).toBeDefined()

      // eslint-disable-next-line no-console
      console.log(
        `bestaetigen-fehler ${thema}: Kontrastverhaeltnis ${messung!.verhaeltnis.toFixed(2)} : 1 ueber ${messung!.punkte} Bildpunkte`,
      )

      expect(
        messung!.verhaeltnis,
        `${thema}: die Meldung hebt sich kaum vom Untergrund ab ` +
          `(Spanne ${messung!.verhaeltnis.toFixed(2)} : 1 ueber ${messung!.punkte} Bildpunkte)`,
      ).toBeGreaterThanOrEqual(3)
    })
  })
}
