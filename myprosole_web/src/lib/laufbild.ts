/**
 * Zeichnet aus einem Foto und den Laufdaten ein Bild fuer soziale Netze.
 *
 * Bewusst getrennt von der Seite: Hier steckt die ganze Zeichenarbeit, und
 * sie laesst sich ohne React aufrufen und pruefen. Die Seite waehlt nur aus
 * und zeigt das Ergebnis.
 *
 * Alles passiert im Browser. Das Foto verlaesst das Geraet nicht, es wird
 * nirgends hochgeladen – erst wenn jemand das fertige Bild selbst teilt.
 */

/** Seitenverhaeltnisse wie im Entwurf share-export.html. */
export const FORMATE = {
  story: { breite: 1080, hoehe: 1920, label: 'Story' },
  post: { breite: 1080, hoehe: 1350, label: 'Post' },
} as const

export type FormatName = keyof typeof FORMATE

export const STILE = {
  klar: { label: 'Klar' },
  kraeftig: { label: 'Kräftig' },
  ruhig: { label: 'Ruhig' },
  schwarzweiss: { label: 'Schwarzweiß' },
} as const

export type StilName = keyof typeof STILE

/** Was aufs Bild kommt. Vorformatiert – hier wird nicht mehr gerechnet. */
export interface LaufWerte {
  strecke: string
  zeit: string
  tempo: string
  hoehe: string
}

interface Farben {
  text: string
  gedaempft: string
  akzent: string
  /** Deckkraft des dunklen Verlaufs unten, damit die Schrift lesbar bleibt. */
  schleier: number
  /** Filter fuer das Foto; leer heisst unveraendert. */
  filter: string
}

const FARBEN: Record<StilName, Farben> = {
  klar: { text: '#FFFFFF', gedaempft: 'rgba(255,255,255,.75)', akzent: '#FFFFFF', schleier: 0.72, filter: '' },
  kraeftig: { text: '#FFFFFF', gedaempft: 'rgba(255,255,255,.8)', akzent: '#7BE0D6', schleier: 0.78, filter: 'saturate(1.35) contrast(1.1)' },
  ruhig: { text: '#FFFFFF', gedaempft: 'rgba(255,255,255,.7)', akzent: '#FFFFFF', schleier: 0.5, filter: 'brightness(.95) saturate(.8)' },
  schwarzweiss: { text: '#FFFFFF', gedaempft: 'rgba(255,255,255,.75)', akzent: '#FFFFFF', schleier: 0.72, filter: 'grayscale(1) contrast(1.05)' },
}

/**
 * Laedt eine Datei als Bild.
 *
 * Die erzeugte Adresse wird in jedem Fall wieder freigegeben – auch wenn das
 * Laden scheitert. Sonst haelt der Browser die Datei im Speicher, bis die
 * Seite neu geladen wird.
 */
export function bildLaden(datei: File): Promise<HTMLImageElement> {
  return new Promise((erfuellen, ablehnen) => {
    const adresse = URL.createObjectURL(datei)
    const bild = new Image()
    bild.onload = () => {
      URL.revokeObjectURL(adresse)
      erfuellen(bild)
    }
    bild.onerror = () => {
      URL.revokeObjectURL(adresse)
      ablehnen(new Error('Das Bild lässt sich nicht lesen.'))
    }
    bild.src = adresse
  })
}

/**
 * Zeichnet das Foto formatfuellend, ohne es zu verzerren – der Ueberstand
 * wird beschnitten, nicht gestaucht. Ohne Foto bleibt eine dunkle Flaeche.
 */
function fotoZeichnen(
  ctx: CanvasRenderingContext2D,
  foto: HTMLImageElement | null,
  breite: number,
  hoehe: number,
  filter: string,
) {
  ctx.fillStyle = '#16213E'
  ctx.fillRect(0, 0, breite, hoehe)
  if (!foto) return

  // ctx.filter kennen nicht alle Browser. Wird er nicht unterstuetzt, bleibt
  // die Zuweisung wirkungslos und das Foto einfach unveraendert – das ist
  // besser als gar kein Bild.
  if (filter) ctx.filter = filter

  const massstab = Math.max(breite / foto.width, hoehe / foto.height)
  const b = foto.width * massstab
  const h = foto.height * massstab
  ctx.drawImage(foto, (breite - b) / 2, (hoehe - h) / 2, b, h)

  ctx.filter = 'none'
}

/** Dunkler Verlauf von unten, damit die Schrift auf jedem Foto lesbar ist. */
function schleierZeichnen(ctx: CanvasRenderingContext2D, breite: number, hoehe: number, staerke: number) {
  const verlauf = ctx.createLinearGradient(0, hoehe * 0.35, 0, hoehe)
  verlauf.addColorStop(0, 'rgba(0,0,0,0)')
  verlauf.addColorStop(1, `rgba(0,0,0,${staerke})`)
  ctx.fillStyle = verlauf
  ctx.fillRect(0, 0, breite, hoehe)
}

/**
 * Baut das fertige Bild.
 *
 * Gibt die Zeichenflaeche zurueck, nicht gleich eine Datei: Die Seite zeigt
 * sie als Vorschau, und erst beim Herunterladen oder Teilen wird daraus eine
 * Datei. So wird nicht bei jeder Stiländerung eine Datei erzeugt.
 */
export async function laufbildZeichnen({
  foto, werte, format, stil,
}: {
  foto: HTMLImageElement | null
  werte: LaufWerte
  format: FormatName
  stil: StilName
}): Promise<HTMLCanvasElement> {
  const { breite, hoehe } = FORMATE[format]
  const farben = FARBEN[stil]

  const flaeche = document.createElement('canvas')
  flaeche.width = breite
  flaeche.height = hoehe
  const ctx = flaeche.getContext('2d')
  if (!ctx) throw new Error('Der Browser kann keine Bilder zeichnen.')

  fotoZeichnen(ctx, foto, breite, hoehe, farben.filter)
  schleierZeichnen(ctx, breite, hoehe, farben.schleier)

  // Alle Masse aus der Breite abgeleitet, nicht fest eingetragen: So sieht
  // das Post-Format genauso aus wie die Story, nur kuerzer.
  const rand = breite * 0.083
  const unten = hoehe - rand

  // Die grosse Zahl: die Strecke. Sie ist das, was man auf einem Bild in
  // einer halben Sekunde erfassen soll.
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = farben.text
  ctx.font = `700 ${breite * 0.16}px Roboto, system-ui, sans-serif`
  ctx.fillText(werte.strecke, rand, unten - breite * 0.115)

  ctx.fillStyle = farben.gedaempft
  ctx.font = `500 ${breite * 0.042}px Roboto, system-ui, sans-serif`
  ctx.fillText('Kilometer', rand, unten - breite * 0.072)

  // Zeit, Tempo und Hoehe in einer Reihe darunter.
  const spalten: [string, string][] = [
    ['Zeit', werte.zeit],
    ['Ø Tempo', werte.tempo],
    ['Höhenmeter', werte.hoehe],
  ]
  const spaltenBreite = (breite - 2 * rand) / spalten.length
  spalten.forEach(([titel, wert], i) => {
    const x = rand + i * spaltenBreite
    ctx.fillStyle = farben.gedaempft
    ctx.font = `500 ${breite * 0.03}px Roboto, system-ui, sans-serif`
    ctx.fillText(titel, x, unten - breite * 0.036)
    ctx.fillStyle = farben.text
    ctx.font = `700 ${breite * 0.052}px Roboto, system-ui, sans-serif`
    ctx.fillText(wert, x, unten)
  })

  // Schriftzug oben. Kein Bild, damit nichts nachzuladen ist – ein fehlendes
  // Logo waere sonst ein leeres Loch im fertigen Bild.
  ctx.fillStyle = farben.akzent
  ctx.font = `700 ${breite * 0.038}px Roboto, system-ui, sans-serif`
  ctx.fillText('MYPROSOLE', rand, rand + breite * 0.03)

  return flaeche
}

/** Die Zeichenflaeche als Datei. */
export function alsDatei(flaeche: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((erfuellen, ablehnen) => {
    flaeche.toBlob(
      (klumpen) => {
        if (!klumpen) {
          ablehnen(new Error('Das Bild lässt sich nicht speichern.'))
          return
        }
        erfuellen(new File([klumpen], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  })
}

/**
 * Teilt das Bild ueber die Teilen-Funktion des Geraets.
 *
 * Gibt false zurueck, wenn das Geraet das nicht kann – dann bleibt der Weg
 * ueber Herunterladen. Auf dem Rechner koennen die meisten Browser keine
 * Dateien teilen, auf dem Telefon schon.
 */
export function teilenMoeglich(datei: File): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  return Boolean(nav.canShare?.({ files: [datei] }))
}

export function herunterladen(datei: File) {
  const adresse = URL.createObjectURL(datei)
  const verweis = document.createElement('a')
  verweis.href = adresse
  verweis.download = datei.name
  verweis.click()
  // Erst nach dem Klick freigeben, sonst bricht der Download ab.
  setTimeout(() => URL.revokeObjectURL(adresse), 10_000)
}
