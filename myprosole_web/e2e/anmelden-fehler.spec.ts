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
 *   7. Bei einer Ratenbegrenzung (429) erscheint die DRITTE Gestalt mit dem
 *      Warte-Zusatz, und kein Feld wird beschuldigt (seit 07.09.2026).
 *   8. Dasselbe noch einmal, aber mit Status 400 und nur dem CODE
 *      `over_request_rate_limit`. Das Modul kennt zwei Wege zu `zu-oft`
 *      (Code oder Status 429); eine Antwort mit beidem prueft keinen von
 *      beiden einzeln. Warum die zwei Faelle nebeneinander stehen, steht
 *      beim zweiten - samt der Mutation, die es belegt.
 *
 * Warum ein echter Fehlversuch und keine eingespielte Meldung
 * ----------------------------------------------------------
 * Ohne Konto antwortet Supabase mit 400. Das ist der echte Weg, den ein
 * Mensch nimmt, und er prueft die Verdrahtung mit - eine eingesetzte
 * Meldung wuerde nur das Stylesheet pruefen und gruen bleiben, wenn die
 * Seite den Fehler gar nicht mehr anzeigt.
 *
 * DIE GRENZE DER GEROUTETEN ANTWORT, woertlich und nicht als Fussnote
 * -------------------------------------------------------------------
 * Der 429-Fall laesst sich nicht echt herbeifuehren, ohne die
 * Ratenbegrenzung der Produktions-Auth zu verbrauchen - ab dem zweiten Lauf
 * zeigte dann jeder Test den 429 statt seines eigenen Zustands. Er wird
 * deshalb ueber `page.route` gefaelscht, Hausmuster aus
 * `passwort-vergessen-fehler.spec.ts`.
 *
 *   Eine geroutete Antwort belegt die Reaktion der Seite, nicht das Verhalten von Supabase.
 *
 * Wer sie in vier Wochen liest, soll nicht mehr hineinlesen, als dasteht.
 * Der Weg dorthin ist echt - Klick, Store, `signIn`, `lib/hindernis.ts` -,
 * nur die Antwort ist gesetzt. Dass Supabase bei zu vielen Versuchen
 * wirklich `over_request_rate_limit` schickt, ist hier NICHT bewiesen; es
 * steht an der Bibliothek abgelesen in `lib/hindernis.ts`.
 *
 * Und eine gefaelschte Antwort muss VOLLSTAENDIG gefaelscht sein: Ohne den
 * Antwortheader `X-Supabase-Api-Version` verwirft auth-js den `code` aus
 * dem Koerper, und der Test misst dann etwas anderes, als er behauptet.
 * Der Header steht deshalb unten mit im `route.fulfill`, mit Fundstelle.
 *
 * BERICHTIGT AM 07.09.2026: Den Header zu senden reicht NICHT. Supabase
 * liegt auf einer anderen Herkunft, also gilt CORS, und
 * `X-Supabase-Api-Version` ist kein freigestellter Antwortheader - ohne
 * `Access-Control-Expose-Headers` liest ihn kein Browser-JavaScript, auch
 * auth-js nicht. Der Fall 429 unten hat den Header seit dem 07.09. und war
 * trotzdem NIE ueber den Code gruen, sondern ueber `status === 429`; die
 * Messung steht beim Fall 400. Wer eine Antwort faelscht, faelscht auch,
 * was von ihr sichtbar sein darf.
 *
 * GRENZE, ausgewiesen statt verschwiegen
 * --------------------------------------
 * Ungeprueft bleibt der **Google-Fehler**. Im Browser leitet supabase-js
 * selbst weiter, die Seite ist weg, bevor ein Rueckgabewert ankommt (am
 * 03.09.2026 nachgestellt: genau eine Navigation zu /auth/v1/authorize,
 * kein Fehlerwert). Dieser Zweig traegt in der Android-Huelle, und die
 * laesst sich hier nicht starten.
 *
 * Der Verbindungsfehler stand bis zum 07.09.2026 daneben, mit dem Grund
 * "er braucht eine Kategorie von `signIn`, die es noch nicht gibt". Die
 * Kategorie gibt es jetzt; der Offline-Fall wird ueber
 * `context.setOffline` geprueft, der Fall 429 ueber die geroutete Antwort.
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

    test('zu viele Versuche: neutrale Notiz mit Warte-Zusatz, kein Feld beschuldigt', async ({
      page,
    }) => {
      await seiteVorbereiten(page, thema)

      // Koerper und Code sind die des Servers (GoTrue `errors.go`: der
      // Koerper ist exakt `{ code, message }`), der Status ist der des
      // Servers. Siehe Kopfkommentar zur Grenze dieser Bauart.
      //
      // DER HEADER IST NICHT ZIERAT, UND ER HAT GEFEHLT. `handleError` in
      // auth-js liest `data.code` NUR, wenn die ANTWORT
      // `X-Supabase-Api-Version` mit einem Datum >= 2024-01-01 traegt
      // (fetch.js, `parseResponseAPIVersion` aus helpers.js gegen
      // `API_VERSIONS['2024-01-01']`). Ohne ihn bleibt `errorCode`
      // undefined, der AuthApiError kommt OHNE Code an, und das Modul
      // erkennt `zu-oft` nur noch am Rueckfall `status === 429`. Der Test
      // war damit gruen, ohne den Code je gelesen zu haben - eine
      // Zusicherung, die eine andere Zusicherung vortaeuscht.
      //
      // UND GENAU DAS IST HIER IMMER NOCH DER FALL, gemessen am 07.09.2026:
      // Der Header steht zwar da, aber ueber die Herkunftsgrenze hinweg
      // liest ihn niemand ohne `Access-Control-Expose-Headers` (Begruendung
      // beim Fall 400 unten). DIESER Fall belegt deshalb den Weg ueber den
      // STATUS - was fuer ihn richtig ist, denn ein echter Server schickt
      // hier 429. Den Weg ueber den CODE belegt der Fall darunter, mit 400
      // und ohne Rueckfall. Zwei Faelle, zwei Wege, einzeln pruefbar.
      await page.route('**/auth/v1/token*', (route) =>
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: { 'X-Supabase-Api-Version': '2024-01-01' },
          body: '{ "code": "over_request_rate_limit", "message": "Request rate limit reached" }',
        }),
      )

      await page.fill('#login-email', ERFUNDEN.email)
      await page.fill('#login-password', ERFUNDEN.passwort)
      await page.click('button[type="submit"]')

      const neutral = page.locator('[role="alert"]', { hasText: 'nicht geklappt' })
      await expect(
        neutral,
        'nach einer Ratenbegrenzung erscheint keine neutrale Meldung',
      ).toBeVisible({ timeout: 20_000 })

      // Der eigentliche Punkt: Eine Meldung, die nur entlastet, laesst den
      // Menschen ohne naechsten Schritt. Bei `zu-oft` heisst der "warten" -
      // und NICHT "versuch es gleich noch einmal", was hier den naechsten
      // Fehlversuch ausloeste.
      await expect(
        neutral,
        'die Meldung nennt den naechsten Schritt nicht: warten',
      ).toContainText('ein paar Minuten')

      // Und niemand wird beschuldigt: An E-Mail und Passwort ist nichts
      // falsch - der Server hat sie gar nicht geprueft.
      for (const feld of ['#login-email', '#login-password']) {
        await expect(
          page.locator(feld),
          `${feld} wird bei einer Ratenbegrenzung als fehlerhaft markiert`,
        ).not.toHaveAttribute('aria-invalid', 'true')
      }
      await expect(page.locator('#login-zugang-fehler')).toHaveCount(0)
    })

    test('zu viele Versuche, Status 400: der CODE traegt die Zusicherung, nicht der Status', async ({
      page,
    }) => {
      await seiteVorbereiten(page, thema)

      // WARUM ES DIESEN FALL NEBEN DEM 429 GIBT - und warum beide bleiben.
      //
      // `anmeldeHindernis` (lib/hindernis.ts) kennt ZWEI Wege zu `zu-oft`:
      // den Code aus der Liste `ZU_OFT` und den Rueckfall `status === 429`.
      // Die Antwort des Falls darueber traegt BEIDES. Sie kann deshalb nicht
      // sagen, welcher der zwei Wege gegriffen hat: Verschwaende die
      // Code-Liste ersatzlos, bliebe jener Test gruen - eine Zusicherung,
      // die eine andere vortaeuscht, dieselbe Sorte wie beim fehlenden
      // Header.
      //
      // Diese Antwort traegt den Code OHNE den Status: 400 statt 429. Damit
      // haengt sie am Code allein. Am 07.09.2026 als Mutation gefahren -
      // `over_request_rate_limit` aus `ZU_OFT` genommen: dieser Fall faellt,
      // der 429er daneben bleibt gruen. Zusammen decken die beiden die
      // beiden Wege einzeln ab; einer allein deckt nur die Oder-Verknuepfung.
      //
      // DREI HEADER, UND DER DRITTE IST DER, DEN NIEMAND ERWARTET HAT.
      //
      // auth-js liest `data.code` nur, wenn die Antwort
      // `X-Supabase-Api-Version` mit einem Datum >= 2024-01-01 traegt
      // (`handleError` in fetch.js, ueber `parseResponseAPIVersion` aus
      // helpers.js gegen `API_VERSIONS['2024-01-01']`).
      //
      // Nur: Diesen Header zu SENDEN reicht nicht, er muss auch LESBAR sein.
      // Supabase liegt auf einer anderen Herkunft als die Vorschau
      // (`VITE_SUPABASE_URL` gegen `http://127.0.0.1:4319`), also gilt CORS,
      // und `X-Supabase-Api-Version` gehoert nicht zu den sechs
      // freigestellten Antwortheadern. Ohne `Access-Control-Expose-Headers`
      // gibt `response.headers.get(...)` im Browser schlicht null zurueck -
      // auth-js parst dann korrekt, es hat nur nichts zu parsen.
      //
      // GEMESSEN, nicht vermutet, am 07.09.2026: Genau dieser Fall lief mit
      // den zwei Headern rot ("versuch es gleich noch einmal" statt
      // "ein paar Minuten", also `unbekannt` statt `zu-oft`) und mit dem
      // dritten gruen. Nichts sonst wurde dabei geaendert.
      await page.route('**/auth/v1/token*', (route) =>
        route.fulfill({
          status: 400,
          headers: {
            'X-Supabase-Api-Version': '2024-01-01',
            'Content-Type': 'application/json',
            'Access-Control-Expose-Headers': 'X-Supabase-Api-Version',
          },
          body: '{ "code": "over_request_rate_limit", "message": "Request rate limit reached" }',
        }),
      )

      await page.fill('#login-email', ERFUNDEN.email)
      await page.fill('#login-password', ERFUNDEN.passwort)
      await page.click('button[type="submit"]')

      const neutral = page.locator('[role="alert"]', { hasText: 'nicht geklappt' })
      await expect(
        neutral,
        'der Code allein - ohne Status 429 - fuehrt nicht zur neutralen Meldung',
      ).toBeVisible({ timeout: 20_000 })

      await expect(
        neutral,
        'die Meldung nennt den naechsten Schritt nicht: warten',
      ).toContainText('ein paar Minuten')

      // Und auch hier wird niemand beschuldigt. Der Status 400 ist derselbe,
      // den ein falsches Passwort traegt - erkannt werden darf trotzdem nur
      // am Code, sonst stuende hier die Zugangs-Gestalt.
      for (const feld of ['#login-email', '#login-password']) {
        await expect(
          page.locator(feld),
          `${feld} wird bei einer Ratenbegrenzung mit Status 400 als fehlerhaft markiert`,
        ).not.toHaveAttribute('aria-invalid', 'true')
      }
      await expect(page.locator('#login-zugang-fehler')).toHaveCount(0)
    })
  })
}
