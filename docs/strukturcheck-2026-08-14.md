# MyProSole Strukturcheck — 14.08.2026

Analyse-Ergebnis: 3 kritisch, 7 hoch, 9 mittel, 8 niedrig.
Sicherheit ist gut (keine Secrets, kein XSS, kein innerHTML).
Hauptprobleme: Typsicherheit, Stabilität, Struktur.

---

## KRITISCH — sofort beheben

### K1: TypeScript `strict` Mode aktivieren
- **Datei:** `myprosole_web/tsconfig.app.json`
- **Problem:** `strict` ist nicht aktiviert. `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes` etc. sind alle AUS.
- **Fix:** `"strict": true` in `compilerOptions` einfügen. Danach `npx tsc --noEmit` laufen lassen und alle neuen Typfehler beheben.

### K2: ErrorBoundary einbauen
- **Datei:** `myprosole_web/src/App.tsx`
- **Problem:** Kein ErrorBoundary-Komponent existiert. Bei einem Rendering-Fehler crasht die gesamte App mit weißem Bildschirm.
- **Fix:** Einen `ErrorBoundary`-Komponent unter `src/components/ui/ErrorBoundary.tsx` erstellen und in `App.tsx` um die Routes wrappen. Soll eine benutzerfreundliche Fehlermeldung auf Deutsch zeigen mit "Seite neu laden"-Button.

### K3: Supabase Umgebungsvariablen validieren
- **Datei:** `myprosole_web/src/lib/supabase.ts` (Zeile 3-4)
- **Problem:** `import.meta.env.VITE_SUPABASE_URL` wird als `string` gecastet ohne Prüfung. Bei fehlender `.env` bekommt `createClient` ein `undefined`.
- **Fix:** Guard einfügen:
  ```ts
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen gesetzt sein');
  }
  ```

---

## HOCH — bald beheben

### H1: Fire-and-Forget DB-Mutationen in `run.ts`
- **Datei:** `myprosole_web/src/store/run.ts` (Zeile 142, 158)
- **Problem:** `pauseRun` und `resumeRun` schlucken Supabase-Fehler stillschweigend mit `.then(() => {})`. Lokaler State weicht bei Netzwerkfehler vom Server ab.
- **Fix:** Fehler abfangen und dem User anzeigen, State bei Fehler zurückrollen.

### H2: Dark Mode System-Präferenz als Fallback
- **Datei:** `myprosole_web/src/main.tsx` (Zeile 7-9)
- **Problem:** Wenn kein Theme in `localStorage` gespeichert ist, wird immer Light Mode geladen. `prefers-color-scheme` wird nicht geprüft.
- **Fix:** Fallback einfügen:
  ```ts
  const saved = localStorage.getItem('theme');
  const theme = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  ```
- **Zusätzlich:** In `index.css` die CSS-Regel `@media (prefers-color-scheme: dark)` mit Guard `:root:not([data-theme="light"])` hinzufügen.

### H3: Service Worker Precache-Strategie verbessern
- **Datei:** `myprosole_web/public/sw.js`
- **Problem:** Die Precache-Liste enthält nur statische Assets, nicht die gehashten JS/CSS-Bundles aus dem Vite-Build. Echtes Offline-First wird nicht erreicht.
- **Fix:** Entweder `vite-plugin-pwa` installieren (empfohlen) oder die SW-Precache-Liste beim Build automatisch generieren.

### H4: `vite-env.d.ts` erstellen
- **Datei:** `myprosole_web/src/vite-env.d.ts` (fehlt)
- **Fix:** Datei erstellen mit:
  ```ts
  /// <reference types="vite/client" />
  ```

### H5: Datendateien aus Git entfernen
- **Dateien:** `myprosole_app/FSR_LOG.CSV`, `myprosole_app/Neue Daten/`, `myprosole_app/output/`, `myprosole_app/sample_data.csv`
- **Problem:** Binär-/Datendateien sind in Git getrackt (wurden vor den .gitignore-Regeln hinzugefügt).
- **Fix:** `git rm --cached myprosole_app/FSR_LOG.CSV myprosole_app/sample_data.csv` und analog für die Ordner. Sicherstellen, dass .gitignore die Dateien abdeckt.

### H6: Projekt-Planner SQL-Dateien strukturieren
- **Dateien:** `project-planner/supabase-*.sql` (24 Dateien)
- **Problem:** Unversionierte lose SQL-Dateien im Root. Widerspricht den Development Standards ("versionierte, wiederholbar ausführbare Migration").
- **Fix:** In einen `project-planner/supabase/migrations/`-Ordner verschieben und sequentiell nummerieren (wie in `myprosole_app/supabase/migrations/`).

### H7: Legacy `myprosole_analysis/` konsolidieren
- **Datei:** `myprosole_app/myprosole_analysis/`
- **Problem:** Hat eigene `config.py`, `data_loader.py`, `visualization.py`, `requirements.txt` die `core/domain/` duplizieren. Die `output/`-PNGs sind identisch.
- **Fix:** Prüfen ob noch etwas aus `myprosole_analysis/` gebraucht wird, dann konsolidieren oder löschen.

---

## MITTEL — bei Gelegenheit

### M1: Code-Splitting mit React.lazy()
- **Datei:** `myprosole_web/src/App.tsx`
- **Problem:** Alle 18 Seiten werden eagerly importiert. Bundle ist unnötig groß.
- **Fix:** Page-Imports durch `React.lazy(() => import('./pages/Home'))` ersetzen und `<Suspense fallback={<LoadingSpinner />}>` um Routes wrappen.

### M2: GPS-Array Performance in `run.ts`
- **Datei:** `myprosole_web/src/store/run.ts` (Zeile 280)
- **Problem:** Jeder GPS-Punkt erzeugt eine komplette Array-Kopie via `[...prev, pt]`. Bei langen Läufen tausende wachsende Kopien.
- **Fix:** Immer-Middleware für Zustand verwenden oder mutable push mit manuellem State-Update.

### M3: `filtered()` Store-Anti-Pattern
- **Datei:** `myprosole_web/src/store/exercises.ts` (Zeile 83)
- **Problem:** `filtered()` erzeugt bei jedem Render ein neues Array. Zustand-Anti-Pattern.
- **Fix:** Als abgeleiteten Selector mit `useMemo` implementieren.

### M4: Scroll-Restoration
- **Datei:** `myprosole_web/src/App.tsx`
- **Problem:** React Router v7 setzt die Scroll-Position nicht automatisch zurück.
- **Fix:** `ScrollRestoration`-Komponent einbauen oder `useEffect` mit `window.scrollTo(0, 0)` bei Route-Wechsel.

### M5: Undefinierte `safe-bottom` CSS-Klasse
- **Datei:** `myprosole_web/src/components/layout/BottomNav.tsx` (Zeile 48)
- **Problem:** Klasse `safe-bottom` wird verwendet, ist aber nirgends definiert. Hat keinen Effekt.
- **Fix:** Entweder definieren (für Safe-Area-Insets) oder entfernen.

### M6: Store-Namenskonvention vereinheitlichen
- **Dateien:** `myprosole_web/src/store/` vs `project-planner/src/store/`
- **Problem:** Web-App nutzt bare names (`auth.ts`), Planner nutzt Hook-Präfix (`useProjectStore.ts`).
- **Fix:** Eine Konvention wählen und durchziehen.

### M7: Projekt-Planner `lang="en"` korrigieren
- **Datei:** `project-planner/index.html`
- **Fix:** `lang="en"` zu `lang="de"` ändern.

### M8: Maskable Icon separieren
- **Datei:** `myprosole_web/public/manifest.webmanifest`
- **Problem:** `"purpose": "any maskable"` in einem Icon. Kann auf Android zu Cropping führen.
- **Fix:** Separate Icons für `any` und `maskable` mit richtigem Safe-Zone-Padding.

### M9: Ghost `__pycache__` aufräumen
- **Datei:** `myprosole_app/modules/community/__pycache__/`
- **Fix:** Ordner löschen. Die .py-Dateien wurden bereits gelöscht, nur Bytecode-Cache blieb übrig.

---

## NIEDRIG — optional

- **N1:** Path-Aliases (`@/` -> `src/`) in `tsconfig.app.json` + `vite.config.ts` konfigurieren
- **N2:** Passwort-Richtlinie verstärken (`Register.tsx:19`) — aktuell nur 6 Zeichen Minimum
- **N3:** SW-Update-Mechanismus — kein UI-Hinweis für neue App-Versionen
- **N4:** CI: `npm run lint` (OxLint) für myprosole_web in `.github/workflows/quality-gates.yml` ergänzen
- **N5:** Integrationstests in `tests/`-Ordner verschieben (`test_gait_integration.py`, `test_shared_upload.py`)
- **N6:** Supabase-Migration-Lücke 0002-0004 dokumentieren oder renummerieren
- **N7:** Legacy `myprosole_app.py` prüfen und ggf. löschen
- **N8:** Vite Build-Config: `sourcemap: true` und explizites `target` für Produktion

---

## WAS GUT IST

- Keine Secrets oder API-Keys im Code
- Kein `any`, `@ts-ignore` oder `eslint-disable`
- Kein `dangerouslySetInnerHTML` — kein XSS-Risiko
- Keine `console.log`-Statements
- Zustand-Stores sauber typisiert mit `string | null` Error-Pattern
- AuthGuard mit Post-Login-Redirect korrekt implementiert
- E-Mail-Enumeration in "Passwort vergessen" verhindert (DSGVO-konform)
- Tailwind v4 korrekt mit `@theme inline` und MD3-Farbsystem
- .env korrekt in .gitignore (nicht in Git getrackt)
- PWA Manifest + Service Worker vorhanden
- Material Design 3 Light/Dark Theme durchgängig
