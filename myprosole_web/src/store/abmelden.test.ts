import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Meldet sich jeder kontogebundene Speicher wirklich an?
 *
 * Warum es diese Datei gibt
 * -------------------------
 * `lib/kontoZustand.ts` hat eine Anmeldeliste, damit `auth.ts` nicht
 * sechzehn Aufrufe fuehren muss, die beim siebzehnten Speicher vergessen
 * werden. Aber die Liste hat dieselbe Schwaeche eine Ebene tiefer: Wer einen
 * neuen Speicher anlegt und `speicherAnmelden` vergisst, merkt nichts.
 *
 * Gegenprobe am 26.08.2026: Die Anmeldung aus `store/cycle.ts` entfernt -
 * **kein einziger Test wurde rot.** Zyklusdaten sind Art. 9 DSGVO.
 *
 * Genau die Bauart, die gestern beim Deploy-Skript angestrichen wurde:
 * `icons`, `assets` und `_headers` standen in der Liste und wurden von
 * keinem Test gehalten.
 *
 * Diese Datei zaehlt deshalb nicht ab, was angemeldet SEIN SOLL - sie geht
 * ueber alle Speicherdateien und verlangt fuer jede eine Entscheidung:
 * entweder angemeldet, oder ausdruecklich als geraetegebunden benannt.
 */

/**
 * Speicher, die NICHT zum Konto gehoeren - mit Begruendung, damit die
 * Ausnahme eine Entscheidung bleibt und keine Luecke wird.
 */
const GERAETEGEBUNDEN: Record<string, string> = {
  bluetooth:
    'Die Verbindung zur Einlage gehoert zum Geraet. Wer sich abmeldet, ' +
    'trennt nicht die Bluetooth-Kopplung.',
  exercises:
    'Ein Uebungskatalog. Fuer alle gleich, enthaelt nichts ueber eine Person.',
  auth: 'Raeumt sich selbst auf und ruft die Liste - kann sich nicht bei sich anmelden.',
}

const module = import.meta.glob('./*.ts', { eager: false })

function speicherNamen(): string[] {
  return Object.keys(module)
    .map((pfad) => pfad.replace('./', '').replace('.ts', ''))
    .filter((name) => !name.endsWith('.test'))
    .sort()
}

beforeEach(() => {
  vi.resetModules()
})

describe('Abmelden', () => {
  it('jede Speicherdatei ist entweder angemeldet oder als geraetegebunden benannt', async () => {
    const ungeklaert: string[] = []

    for (const name of speicherNamen()) {
      if (name in GERAETEGEBUNDEN) continue
      const quelle = await import(`./${name}.ts?raw`)
      // Kommentarzeilen zaehlen NICHT. Beim ersten Versuch taten sie es:
      // Ein auskommentiertes `// speicherAnmelden(useCycle)` enthaelt die
      // Zeichenkette weiterhin, und der Test blieb gruen, waehrend die
      // Zyklusdaten stehenblieben. Gefangen von der eigenen Gegenprobe.
      const wirksam = String(quelle.default ?? '')
        .split('\n')
        .filter((zeile) => !zeile.trimStart().startsWith('//'))
        .join('\n')
      const angemeldet =
        wirksam.includes('speicherAnmelden(') || wirksam.includes('beimAbmeldenVergessen(')
      if (!angemeldet) ungeklaert.push(name)
    }

    // Steht hier ein Name, ist die Frage nicht beantwortet: Gehoert dieser
    // Speicher zum Konto (dann `speicherAnmelden` ergaenzen) oder zum Geraet
    // (dann oben mit Begruendung eintragen)? Beides ist in Ordnung -
    // schweigen nicht.
    expect(ungeklaert).toEqual([])
  })

  it('setzt einen kontogebundenen Speicher tatsaechlich zurueck', async () => {
    // Nicht nur "der Aufruf steht da", sondern "er wirkt". Stellvertretend
    // an cycle.ts, weil dort Zyklusdaten liegen - Art. 9 DSGVO.
    const { useCycle } = await import('./cycle')
    const { kontoZustandVergessen } = await import('../lib/kontoZustand')

    const vorher = useCycle.getState()
    const datenfelder = Object.entries(vorher).filter(([, w]) => typeof w !== 'function')
    expect(datenfelder.length).toBeGreaterThan(0)

    // Ein Datenfeld beschreiben, das eine Liste ist - dort liegen die Daten.
    const [feld] = datenfelder.find(([, w]) => Array.isArray(w)) ?? []
    expect(feld).toBeDefined()
    useCycle.setState({ [feld as string]: [{ geheim: 'von A' }] } as never)
    expect((useCycle.getState() as never as Record<string, unknown[]>)[feld as string]).toHaveLength(1)

    kontoZustandVergessen()

    expect((useCycle.getState() as never as Record<string, unknown[]>)[feld as string]).toEqual([])
  })
})
