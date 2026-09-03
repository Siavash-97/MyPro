import { defineConfig, devices } from '@playwright/test'

/**
 * Browserpruefungen der Web-App.
 *
 * Warum es sie ab dem 03.09.2026 gibt
 * -----------------------------------
 * Bis dahin hatte `myprosole_web` **keine einzige Browserpruefung** - kein
 * `playwright.config`, kein `e2e/`. Nachgezaehlt am 03.09.2026: 38 Seiten,
 * 39 Routen, und das Prueftor deckte davon ab: Unit-Tests, TypeScript,
 * Klassenexistenz, Inline-Sperrklinke.
 *
 * Was niemand mechanisch merkte:
 *
 *   - eine Seite, die weiss bleibt
 *   - ein Kopf, der den Inhalt ueberdeckt
 *   - waagerechtes Scrollen bei 320 px
 *
 * **Alle drei uebersetzen sauber und bestehen jeden vorhandenen Test.** Vor
 * einem Umbau des Designs ist das die Luecke, die zaehlt: "sieht gut aus"
 * ist ein Blick, keine Pruefung - und beim dreissigsten Blick sieht niemand
 * mehr hin.
 *
 * Unterschied zu `myprosole_app/playwright.config.ts`
 * ---------------------------------------------------
 * Jene Konfiguration prueft **statische Entwuerfe** ueber `file://` und
 * braucht deshalb keinen Server. Diese prueft die **laufende App**, also
 * gehoert ein `webServer` dazu. Das ist der Unterschied, den "einfach die
 * Konfiguration kopieren" verdeckt.
 *
 * Vorerst nur die oeffentlichen Seiten
 * -------------------------------------
 * Die uebrigen Routen liegen hinter der Anmeldung; ein Testkonto ist eigene
 * Arbeit. Die acht oeffentlichen Routen brauchen keines - und sie sind
 * genau das Paket, das im Umbau ohnehin zuerst drankommt.
 *
 * **Grenze, ausdruecklich:** Dieses Netz sagt nichts ueber die 31 Seiten
 * hinter der Anmeldung. Wer es fuer "die App ist geprueft" haelt, liest
 * mehr hinein, als dasteht.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4319',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // `preview` statt `dev`: Geprueft wird, was ausgeliefert wird, nicht was
  // der Entwicklungsserver zusaetzlich einblendet (Fehlerueberlagerung,
  // Neuladen im Betrieb). Ein Uebersetzungsfehler faellt dadurch schon beim
  // Bauen auf und nicht als merkwuerdige Seite.
  // `--host 127.0.0.1` ausdruecklich: Ohne die Angabe horcht Vite auch auf
  // `::1`, und auf dieser Maschine liegt 4173 in einem von Windows
  // reservierten Bereich - `EACCES` auf IPv6, obwohl IPv4 frei ist.
  // Gemessen am 03.09.2026, nicht vermutet.
  webServer: {
    command:
      'npm run build && npm run preview -- --host 127.0.0.1 --port 4319 --strictPort',
    url: 'http://127.0.0.1:4319/willkommen',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
