import type { Page } from '@playwright/test'

/**
 * Kontrast messen, wie ihn das Auge sieht.
 *
 * Warum nicht `getComputedStyle`
 * ------------------------------
 * Der naheliegende Weg - Schriftfarbe lesen, im DOM nach oben laufen bis ein
 * Hintergrund kommt, Verhaeltnis rechnen - haette den Fehler vom 03.09.2026
 * NICHT gefunden. Nachgesehen, nicht vermutet:
 *
 *   `.md-hero__scrim` (components.css:73-78) ist ein GESCHWISTER des
 *   Inhalts, kein Vorfahr - `position: absolute; inset: 0`. Eine
 *   Aufwaertssuche laeuft an ihm vorbei. Dazu traegt er `opacity: 0.5`;
 *   was zu sehen ist, entsteht erst beim Zusammensetzen der Ebenen, und
 *   darunter laeuft ein Video.
 *
 * Deshalb wird das FERTIGE BILD gemessen.
 *
 * Warum nicht der Ausschnitt des Elements
 * ---------------------------------------
 * Erster Versuch: Ausschnitt-Bildschirmfoto je Element. **Neun von sechzehn
 * Pruefungen fielen, und keine davon war ein Fund.** Gemessen wurde zum
 * Beispiel "E-Mail" ueber 5440 Bildpunkte - das ist ein `<label>`, das das
 * ganze Eingabefeld umschliesst. Der Ausschnitt ist ueberwiegend leere
 * Flaeche, die Spanne faellt gegen 1, und das Werkzeug meldet einen Fehler,
 * den es sich selbst gebaut hat.
 *
 * Genau die Bauart, vor der CLAUDE.md Regel 2b warnt: Wer zweimal
 * Fehlalarme wegwischt, wischt beim dritten Mal den Fund mit weg.
 *
 * Gemessen wird deshalb der Kasten der TEXTKNOTEN (ueber `Range`), nicht
 * der des Elements. Dort stehen die Buchstaben, und nur dort ist die Frage
 * "hebt sich das ab?" ueberhaupt sinnvoll.
 *
 * WAS DIESE MESSUNG NICHT IST
 * ---------------------------
 * **Keine WCAG-Pruefung.** Sie misst die Helligkeitsspanne innerhalb des
 * Textkastens, nicht Schrift gegen Untergrund nach Norm. Was sie
 * zuverlaessig findet, ist der katastrophale Fall: **Schrift in der Farbe
 * ihres Untergrunds.** Dann ist der Kasten nahezu einfarbig.
 *
 * Absichtlich die niedrige Latte. Ein Netz, das Geschmack prueft, flackert;
 * eines, das Katastrophen prueft, haelt.
 */

export interface Textstelle {
  text: string
  kasten: { x: number; y: number; width: number; height: number }
}

/**
 * Die Kaesten der sichtbaren Textknoten, hoechstens `grenze` Stueck.
 *
 * Nur eigene Textknoten: Ein Behaelter, dessen Text in Kindern steht, wird
 * uebersprungen - sonst misst man ihn doppelt und zusaetzlich die Flaeche
 * dazwischen.
 */
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

      // Zu klein oder ausserhalb des Sichtfensters: nicht messbar.
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

export interface Kontrastmessung {
  verhaeltnis: number
  punkte: number
}

/**
 * Die Helligkeitsspanne in einem Bildausschnitt.
 *
 * Das PNG geht zurueck in die Seite und wird ueber eine Leinwand ausgelesen -
 * der Browser bringt den Leser mit, es braucht kein zusaetzliches Paket.
 *
 * Genommen wird das 5. und das 95. Hundertstel, nicht Kleinst- und
 * Groesstwert: Kantenglaettung erzeugt an jeder Buchstabenkante Zwischentoene,
 * und ein einzelner Ausreisser darf das Ergebnis nicht bestimmen.
 *
 * `null` heisst "nicht gemessen" und ist KEIN Bestehen. Der Aufrufer muss
 * es zaehlen und ausweisen.
 */
export async function spanneImAusschnitt(
  page: Page,
  kasten: Textstelle['kasten'],
): Promise<Kontrastmessung | null> {
  if (kasten.width < 2 || kasten.height < 2) return null
  const bild = await page.screenshot({ clip: kasten, timeout: 5_000 }).catch(() => null)
  if (!bild) return null

  return page.evaluate(async (base64) => {
    const bild = new Image()
    bild.src = `data:image/png;base64,${base64}`
    await bild.decode()

    const leinwand = document.createElement('canvas')
    leinwand.width = bild.naturalWidth
    leinwand.height = bild.naturalHeight
    const stift = leinwand.getContext('2d', { willReadFrequently: true })
    if (!stift) return null
    stift.drawImage(bild, 0, 0)

    const daten = stift.getImageData(0, 0, leinwand.width, leinwand.height).data
    const werte: number[] = []
    const kanal = (v: number) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    for (let i = 0; i < daten.length; i += 4) {
      if (daten[i + 3] < 8) continue
      werte.push(
        0.2126 * kanal(daten[i]) + 0.7152 * kanal(daten[i + 1]) + 0.0722 * kanal(daten[i + 2]),
      )
    }
    if (werte.length < 16) return null

    werte.sort((a, b) => a - b)
    const bei = (anteil: number) =>
      werte[Math.min(werte.length - 1, Math.max(0, Math.round(anteil * (werte.length - 1))))]

    return { verhaeltnis: (bei(0.95) + 0.05) / (bei(0.05) + 0.05), punkte: werte.length }
  }, bild.toString('base64'))
}
