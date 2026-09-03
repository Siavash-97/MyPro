import type { Page } from '@playwright/test'

/**
 * Kontrast messen, wie ihn das Auge sieht.
 *
 * Warum nicht `getComputedStyle`
 * ------------------------------
 * Der naheliegende Weg haette den Fehler vom 03.09.2026 NICHT gefunden.
 * Nachgesehen: `.md-hero__scrim` (components.css) ist ein GESCHWISTER des
 * Inhalts (`position: absolute`), kein Vorfahr - eine Aufwaertssuche laeuft
 * an ihm vorbei. Dazu `opacity: 0.5` ueber einem Video; was zu sehen ist,
 * entsteht erst beim Zusammensetzen der Ebenen.
 *
 * Deshalb wird das fertige Bild gemessen.
 *
 * Drei Anlaeufe, zwei davon falsch
 * --------------------------------
 * **1. Ausschnitt des ELEMENTS.** Neun von sechzehn Pruefungen fielen, und
 * keine war ein Fund: "E-Mail" ueber 5440 Bildpunkte ist ein `<label>` um
 * das ganze Eingabefeld, also fast nur leere Flaeche.
 *
 * **2. Kaesten zuerst, Fotos danach.** Alle Textkaesten in einem Durchgang
 * rechnen, dann je Kasten ein Ausschnitt-Foto. Gemessen am 03.09.2026:
 * **jeder achte Lauf** meldete auf `/passwort-neu` "Spanne 1,00 : 1", und
 * die betroffene Stelle wechselte. Die Farben waren in Ordnung -
 * `rgb(189,191,196)` auf `rgb(19,22,31)`, rund 9,8 : 1.
 *
 * Ursache: Zwischen dem Rechnen und dem Fotografieren verschiebt sich das
 * Layout (Schriften, Video, Bilder). Der Ausschnitt zeigt dann auf leere
 * Flaeche - und leere Flaeche ist einfarbig.
 *
 * **Ein Pruefwerkzeug, das jeden achten Lauf einen Fehler meldet, den es
 * nicht gibt, ist genau die Bauart aus CLAUDE.md Regel 2b:** Wer zweimal
 * Fehlalarme wegwischt, wischt beim dritten Mal den Fund mit weg. Ein
 * flackerndes Prueftor wird behoben oder herausgenommen, nicht geduldet.
 *
 * **3. Ein Bild, alle Kaesten daraus - und ein Wachposten.** So ist es
 * jetzt:
 *
 *   - Erst warten, bis das Layout steht (Schriften geladen, zwei Bilder
 *     lang keine Verschiebung mehr).
 *   - Ein einziges Foto des Sichtfensters.
 *   - Die Kaesten aus DEMSELBEN Zustand rechnen und im Browser aus diesem
 *     einen Bild ausschneiden.
 *   - Danach die Kaesten ERNEUT rechnen. Weicht einer ab, hat sich waehrend
 *     der Messung etwas bewegt: dann gilt der Lauf als **ungemessen**, nicht
 *     als bestanden.
 *
 * Der Wachposten ist der Punkt. Ohne ihn waere die Verbesserung eine
 * Hoffnung; mit ihm ist eine Verschiebung sichtbar, statt sich als
 * Fehlalarm zu tarnen.
 *
 * WAS DIESE MESSUNG NICHT IST
 * ---------------------------
 * **Keine WCAG-Pruefung.** Sie misst die Helligkeitsspanne im Textkasten,
 * nicht Schrift gegen Untergrund nach Norm. 3 : 1 ist die AA-Grenze fuer
 * GROSSE Schrift; fuer Fliesstext verlangt AA 4,5. Zwischen 3 und 4,5
 * bleibt ein Band, das besteht und trotzdem schwer lesbar ist.
 *
 * **Und sie misst nur Ladezustaende.** Ein Fehlerzustand entsteht erst nach
 * einer Handlung; dafuer gibt es `anmelden-fehler.spec.ts`.
 */

export interface Textstelle {
  text: string
  kasten: { x: number; y: number; width: number; height: number }
}

export interface Kontrastmessung {
  text: string
  verhaeltnis: number
  punkte: number
}

export interface Kontrastbefund {
  messungen: Kontrastmessung[]
  /** Texte, die nicht gemessen werden konnten. Das ist KEIN Bestehen. */
  ungemessen: string[]
  /** Wahr, wenn sich waehrend der Messung das Layout bewegt hat. */
  verschoben: boolean
}

/** Wartet, bis sich zwei Bilder lang nichts mehr verschiebt. */
async function layoutBeruhigen(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((weiter) => requestAnimationFrame(() => requestAnimationFrame(weiter)))
  })
}

/**
 * Alle sichtbaren Textstellen messen - aus EINEM Bild.
 *
 * Nur eigene Textknoten: Ein Behaelter, dessen Text in Kindern steht, wird
 * uebersprungen, sonst misst man ihn doppelt und die Flaeche dazwischen mit.
 */
export async function kontrastAufSeite(page: Page, grenze = 14): Promise<Kontrastbefund> {
  await layoutBeruhigen(page)

  const kaestenVorher = await textstellen(page, grenze)
  const bild = await page.screenshot({ timeout: 10_000 }).catch(() => null)
  const kaestenNachher = await textstellen(page, grenze)

  // Der Wachposten: Hat sich zwischen den beiden Rechnungen etwas bewegt,
  // zeigt das eine Foto auf einen Zustand, den es beim Rechnen nicht mehr
  // gab. Dann wird nichts behauptet.
  const verschoben =
    kaestenVorher.length !== kaestenNachher.length ||
    kaestenVorher.some((k, i) => {
      const n = kaestenNachher[i]
      return (
        k.text !== n.text ||
        k.kasten.x !== n.kasten.x ||
        k.kasten.y !== n.kasten.y ||
        k.kasten.width !== n.kasten.width ||
        k.kasten.height !== n.kasten.height
      )
    })

  if (!bild || verschoben) {
    return { messungen: [], ungemessen: kaestenVorher.map((k) => k.text), verschoben }
  }

  const messungen = await page.evaluate(
    async ({ base64, stellen }) => {
      const bild = new Image()
      bild.src = `data:image/png;base64,${base64}`
      await bild.decode()

      const leinwand = document.createElement('canvas')
      const stift = leinwand.getContext('2d', { willReadFrequently: true })
      if (!stift) return []

      // Das Foto kann durch die Geraeteaufloesung groesser sein als das
      // Sichtfenster. Ohne diesen Faktor liegen alle Ausschnitte daneben.
      const faktor = bild.naturalWidth / window.innerWidth

      const kanal = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      }

      const ergebnis: { text: string; verhaeltnis: number; punkte: number }[] = []
      for (const { text, kasten } of stellen) {
        const b = Math.max(1, Math.round(kasten.width * faktor))
        const h = Math.max(1, Math.round(kasten.height * faktor))
        leinwand.width = b
        leinwand.height = h
        stift.clearRect(0, 0, b, h)
        stift.drawImage(
          bild,
          Math.round(kasten.x * faktor),
          Math.round(kasten.y * faktor),
          b,
          h,
          0,
          0,
          b,
          h,
        )

        const daten = stift.getImageData(0, 0, b, h).data
        const werte: number[] = []
        for (let i = 0; i < daten.length; i += 4) {
          if (daten[i + 3] < 8) continue
          werte.push(
            0.2126 * kanal(daten[i]) + 0.7152 * kanal(daten[i + 1]) + 0.0722 * kanal(daten[i + 2]),
          )
        }
        if (werte.length < 16) continue

        werte.sort((a, b2) => a - b2)
        const bei = (anteil: number) =>
          werte[Math.min(werte.length - 1, Math.max(0, Math.round(anteil * (werte.length - 1))))]

        ergebnis.push({
          text,
          verhaeltnis: (bei(0.95) + 0.05) / (bei(0.05) + 0.05),
          punkte: werte.length,
        })
      }
      return ergebnis
    },
    { base64: bild.toString('base64'), stellen: kaestenVorher },
  )

  const gemessen = new Set(messungen.map((m) => m.text))
  return {
    messungen,
    ungemessen: kaestenVorher.map((k) => k.text).filter((t) => !gemessen.has(t)),
    verschoben: false,
  }
}

/** Die Kaesten der sichtbaren Textknoten. Exportiert, weil Tests sie einzeln brauchen. */
export async function textstellen(page: Page, grenze = 14): Promise<Textstelle[]> {
  return page.evaluate((max) => {
    const treffer: { text: string; kasten: DOMRect }[] = []
    const lauf = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)

    let knoten: Node | null
    while ((knoten = lauf.nextNode())) {
      const text = (knoten.textContent ?? '').trim()
      if (text.length < 2) continue

      const eltern = knoten.parentElement
      if (!eltern) continue
      const stil = window.getComputedStyle(eltern)
      if (stil.visibility === 'hidden' || stil.display === 'none') continue
      if (Number(stil.opacity) < 0.1) continue

      const bereich = document.createRange()
      bereich.selectNodeContents(knoten)
      const kasten = bereich.getBoundingClientRect()

      if (kasten.width < 8 || kasten.height < 6) continue
      if (kasten.bottom < 0 || kasten.top > window.innerHeight) continue

      treffer.push({ text, kasten })
      if (treffer.length >= max) break
    }

    return treffer.map((t) => ({
      text: t.text,
      kasten: {
        x: Math.max(0, Math.floor(t.kasten.x)),
        y: Math.max(0, Math.floor(t.kasten.y)),
        width: Math.ceil(t.kasten.width),
        height: Math.ceil(t.kasten.height),
      },
    }))
  }, grenze)
}
