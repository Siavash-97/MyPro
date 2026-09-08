import { test, expect } from '@playwright/test'

/**
 * Der Fehlersatz auf /willkommen, der aus dem VERLAUFSZUSTAND kommt.
 * Vorbild: registrieren-fehler.spec.ts - dort steht, warum das Lade-Netz
 * (oeffentliche-seiten.spec.ts) Zustaende nach einer Handlung nicht sieht.
 *
 * WARUM ES DIESE DATEI GIBT (Befund B0, 08.09.2026)
 * -------------------------------------------------
 * App.tsx navigiert beim gescheiterten Rueckweg aus der Google-Anmeldung
 * von /willkommen nach /willkommen - gleiche Route, gleiches Element.
 * React haengt <Welcome> dabei NICHT neu ein, also lief der frühere
 * useState-Initialisierer nicht mehr; der Effekt loeschte den Zustand, und
 * der Bildschirm zeigte nichts. Genau dieser Weg wird hier nachgestellt.
 *
 * WIE DER WEG NACHGESTELLT WIRD, und warum das erlaubt ist
 * --------------------------------------------------------
 * Die Pruefung schiebt den Verlaufszustand selbst:
 *
 *   history.pushState({ usr: {...}, key, idx }, '', '/willkommen')
 *   window.dispatchEvent(new PopStateEvent('popstate'))
 *
 * Dass React Router daraus eine neue `location` mit `state` macht, ist
 * nachgesehen und nicht angenommen - react-router 7.18.2,
 * node_modules/react-router/dist/development/chunk-62JRHF6Z.mjs:
 *
 *   - :10391 BrowserRouter -> createBrowserHistory({ v5Compat: true })
 *   - :10416 React.useLayoutEffect(() => history.listen(setState))
 *   - :348   listen() haengt window.addEventListener('popstate', handlePop)
 *   - :296   handlePop ruft listener({ action: 'POP', location:
 *            history.location, delta })
 *   - :341   der Getter `location` ruft createBrowserLocation(...)
 *   - :143   und die liest `globalHistory.state && globalHistory.state.usr`
 *
 * `key` und `idx` gehoeren dazu, weil dieselbe Stelle `state.key` liest
 * (:144) und handlePop `state.idx` fuer sein `delta` braucht (:293).
 *
 * GRENZE, ausgewiesen statt verschwiegen
 * --------------------------------------
 *   - EINE GESCHOBENE VERLAUFSNAVIGATION BELEGT DIE REAKTION DER SEITE,
 *     NICHT DAS VERHALTEN DER HUELLE. Ob App.tsx bei `appUrlOpen`
 *     wirklich mit dieser Art navigiert, sagt diese Datei nicht - das
 *     braeuchte die Android-Huelle.
 *   - Der Kaltstartweg (`CapApp.getLaunchUrl`, App.tsx:115-117) ist nicht
 *     gemessen. Dort wird <Welcome> womoeglich neu eingehaengt; das ist ein
 *     anderer Weg mit anderem Ausgang.
 *   - Der zweite Weg zum selben Satz - `mitGoogle`, also der
 *     Rueckgabewert von `signInWithGoogle` - ist im Browser NICHT
 *     ausloesbar: supabase-js leitet dort selbst weiter (Beleg im
 *     Fehlerbericht 2026-09-03_1520). Diese Datei prueft ihn nicht.
 */

const THEMEN = ['light', 'dark'] as const

/**
 * Der Wortlaut steht in Welcome.tsx (`googleSatz`). Er steht hier ein
 * zweites Mal, weil eine Pruefung, die ihren Erwartungswert aus dem
 * Prueflingscode holt, jede Aenderung mitmacht statt sie zu melden.
 */
const SAETZE = {
  'nicht-erreichbar': 'Die Anmeldung mit Google hat nicht geklappt. Versuch es noch einmal.',
  'zu-oft':
    'Die Anmeldung mit Google hat gerade nicht geklappt – warte ein paar Minuten und probier es dann noch einmal.',
} as const

type Art = keyof typeof SAETZE

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
  await page.goto('/willkommen', { waitUntil: 'networkidle' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', thema)
}

/**
 * Schiebt genau den Zustand, den App.tsx:112 mitgibt - auf DIESELBE Route.
 * Kein page.goto: Ein Neuladen wuerde <Welcome> neu einhaengen und damit
 * den Fall verfehlen, um den es geht.
 */
async function hindernisSchieben(page: import('@playwright/test').Page, art: Art) {
  await page.evaluate((a) => {
    window.history.pushState(
      { usr: { hindernis: a }, key: 'r2', idx: (window.history.state?.idx ?? 0) + 1 },
      '',
      '/willkommen',
    )
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, art)
}

for (const thema of THEMEN) {
  test.describe(`Willkommen, Google-Fehler aus dem Verlauf, Thema ${thema}`, () => {
    test('nicht erreichbar: der Satz steht da, ist angesagt, und ueberlebt kein Neuladen', async ({
      page,
    }) => {
      await seiteVorbereiten(page, thema)
      await hindernisSchieben(page, 'nicht-erreichbar')

      const meldung = page.locator('#welcome-google-fehler')
      await expect(
        meldung,
        'nach der Verlaufsnavigation auf dieselbe Route steht kein Satz da',
      ).toBeVisible()
      await expect(meldung).toContainText(SAETZE['nicht-erreichbar'])
      await expect(meldung).not.toContainText(SAETZE['zu-oft'])

      // Angesagt, nicht nur sichtbar.
      await expect(meldung).toHaveAttribute('role', 'alert')

      // Und dem Knopf zugeordnet, an dem es scheiterte.
      await expect(
        page.getByRole('button', { name: 'Mit Google fortfahren' }),
      ).toHaveAttribute('aria-describedby', 'welcome-google-fehler')

      // VERBRAUCHT: Der Verlaufszustand ist geloescht, also ist der Satz
      // nach einem Neuladen weg - ein Fehlschlag von damals soll nicht
      // wieder dastehen.
      await page.reload({ waitUntil: 'networkidle' })
      await expect(
        page.locator('#welcome-google-fehler'),
        'der Satz stand nach dem Neuladen wieder da - der Zustand wurde nicht verbraucht',
      ).toHaveCount(0)
    })

    test('zu oft: derselbe Weg traegt den anderen Satz', async ({ page }) => {
      await seiteVorbereiten(page, thema)
      await hindernisSchieben(page, 'zu-oft')

      const meldung = page.locator('#welcome-google-fehler')
      await expect(meldung).toBeVisible()
      await expect(meldung).toContainText(SAETZE['zu-oft'])
      await expect(meldung).not.toContainText(SAETZE['nicht-erreichbar'])
      await expect(meldung).toHaveAttribute('role', 'alert')
    })
  })
}
