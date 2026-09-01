import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Warum hier KEIN copy-mockups-Plugin mehr steht
 * ---------------------------------------------
 * Bis zum 25.08.2026 kopierte ein `closeBundle`-Plugin nach jedem Build den
 * gesamten Ordner `myprosole_app/design` nach `dist/design` - und damit in
 * die ausgelieferte Android-App. Gemessen: **2,60 MB in 106 Dateien**,
 * darunter alle Entwurfsordner.
 *
 * (Eine fruehere Fassung dieses Kommentars sagte 2,9 MB in 105 Dateien. Die
 * Zahl kam aus `du -sh`, und das misst belegte BLOECKE, nicht Bytes - bei
 * 106 kleinen Dateien summiert sich der Verschnitt auf ueber 300 KB.
 * Nachgerechnet vom Agenten `pruefung`, danach selbst gemessen.)
 *
 * Die echte App braucht davon nichts. Nachgesehen, nicht angenommen:
 *
 *   - `index.html` holt Favicon, Manifest und Icons aus `public/` (Zeilen 8,
 *     11, 15), und die Dateien liegen dort auch wirklich.
 *   - In `src/` gibt es keinen einzigen Pfad nach `design/`. Die Treffer auf
 *     "design" gehoeren zu `lib/design.ts` - das ist der Hell/Dunkel-
 *     Schalter und hat mit diesem Ordner nichts zu tun.
 *   - `public/sw.js` und `public/manifest.webmanifest` erwaehnen `design`
 *     nirgends, der Service Worker faengt also auch nichts davon ab.
 *
 * Der Entwurfsordner wird weiterhin ausgeliefert - aber woandershin:
 * `scripts/deploy_prototype.py` liest direkt aus `myprosole_app/design` und
 * laedt von dort zu Cloudflare Pages. Dieses Plugin war ein zweiter Weg fuer
 * dieselbe Sache, und der zweite Weg lieferte in die falsche App.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
