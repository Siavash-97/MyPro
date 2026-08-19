import { defineConfig, devices } from '@playwright/test'

/**
 * Browserpruefungen der MyProSole-Entwuerfe.
 *
 * Warum hier und nicht mehr im Projektplaner
 * ------------------------------------------
 * Diese Pruefungen lagen bis zum 19.08.2026 unter
 * `project-planner/e2e/myprosole-design.spec.ts` – 1307 Zeilen, dreimal so
 * viel wie die Pruefungen des Planers selbst (449 Zeilen). Zwei Projekte
 * liefen damit durch dieselbe Tuer:
 *
 *   - Wer die MyProSole-Entwuerfe aenderte, musste im Planer editieren.
 *   - Ein flackernder Test im Planer liess das Prueftor fuer MyProSole
 *     rot werden, obwohl an MyProSole nichts fehlte.
 *   - Wer den Planer fuer sich pruefen wollte, fuehrte 1307 Zeilen fremde
 *     Pruefungen mit aus.
 *
 * Jetzt getrennt. Der Planer wird nur noch angefasst, wenn wirklich am
 * Planer gearbeitet wird.
 *
 * Kein Webserver
 * --------------
 * Die Entwuerfe sind statische Dateien; die Pruefungen oeffnen sie ueber
 * file://-Adressen. Nachgemessen vor dem Umzug: null Zugriffe auf einen
 * Server in dieser Datei, gegenueber vierzehn in den Pruefungen des
 * Planers. Der Vite-Server, den der Planer startet, wurde hier nie
 * gebraucht.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
