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
  schrittrecht:
    'Der Zustand einer Systemberechtigung. Er gehoert dem Telefon, nicht ' +
    'der Person - wer sich abmeldet, nimmt Android die Erlaubnis nicht ' +
    'weg. Und `schonGefragt` zaehlt, wie oft Android seinen Dialog schon ' +
    'gezeigt hat: Android zeigt ihn HOECHSTENS ZWEIMAL je Installation. ' +
    'Diesen Zaehler beim Abmelden zurueckzusetzen wuerde der naechsten ' +
    'Person einen Versuch wegnehmen, den sie nie bekommen hat.',
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

/**
 * Dasselbe eine Ebene tiefer: `src/lib/`.
 *
 * Warum es diesen zweiten Test gibt
 * ---------------------------------
 * Der Test darueber globt `./*.ts` - also **nur** `src/store/`. Am
 * 28.08.2026 fand der Agent `sicherheit`, dass `lib/punktePuffer.ts` beim
 * Abmelden nicht geraeumt wurde: GPS-Spuren des vorigen Kontos blieben auf
 * dem Geraet liegen. Zusammen mit einer ungefilterten Adoption in
 * `store/run.ts` ergab das einen Weg zwischen Konten.
 *
 * Der Wächter darueber konnte das nicht sehen - die Datei liegt ausserhalb
 * seines Globs. `lib/laufMerker.ts` und `lib/anamneseEntwurf.ts` hatten sich
 * **freiwillig** angemeldet; wer das vergisst, wurde von nichts angestrichen.
 *
 * Diese Pruefung nimmt jede Datei in `src/lib/`, die dauerhaft speichert,
 * und verlangt eine Entscheidung. Es gibt drei gueltige Antworten, nicht
 * eine - sonst streicht der Test Richtiges an:
 *
 *   1. Die Datei meldet sich selbst an (`beimAbmeldenVergessen`).
 *   2. Ihr Schluessel steht in `KONTO_SCHLUESSEL` in `kontoZustand.ts`.
 *   3. Sie steht hier als geraetegebunden, mit Begruendung.
 */
const GERAETEGEBUNDEN_LIB: Record<string, string> = {
  design:
    'Das Thema gehoert zum Telefon, nicht zur Person. Wer sich abmeldet, ' +
    'will nicht ploetzlich in Hell sitzen.',
  ruhepegelSpeicher:
    'Der gemessene Ruhepegel beschreibt den EMPFAENGER dieses Geraets, ' +
    'nicht die Person - dieselbe Begruendung wie beim Thema. Festgehalten ' +
    'am 26.08.2026.',
}

const libQuellen = import.meta.glob('../lib/*.ts', { query: '?raw', import: 'default', eager: true })
const kontoQuelle = libQuellen['../lib/kontoZustand.ts'] as string

describe('Abmelden, Ebene lib', () => {
  it('jede speichernde Datei in lib ist geraeumt oder als geraetegebunden benannt', () => {
    const schluesselBlock = kontoQuelle.match(/const KONTO_SCHLUESSEL = \[([\s\S]*?)\]/)?.[1] ?? ''
    expect(schluesselBlock.length, 'KONTO_SCHLUESSEL nicht gefunden').toBeGreaterThan(10)

    const offen: string[] = []
    for (const [pfad, quelleRoh] of Object.entries(libQuellen)) {
      const name = pfad.replace('../lib/', '').replace('.ts', '')
      if (name.endsWith('.test')) continue
      const quelle = quelleRoh as string
      // Nur, was dauerhaft speichert. Reine Rechenmodule haben nichts zu vergessen.
      if (!/localStorage\.setItem|indexedDB\.open/.test(quelle)) continue
      // Ein AUFRUF, keine Importzeile und kein Kommentar. Die erste
      // Fassung dieses Tests pruefte auf die blosse Zeichenkette - und die
      // steht auch im `import`. Die Gegenprobe (Anmeldung entfernen) blieb
      // deshalb gruen: Der Test fand sich selbst. Derselbe Fehler wie am
      // 26.08.2026, als `// speicherAnmelden(useCycle)` als Anmeldung zaehlte.
      const meldetSichAn = quelle
        .split('\n')
        .some(
          (z) =>
            /beimAbmeldenVergessen\s*\(/.test(z) &&
            !z.trimStart().startsWith('import') &&
            !z.trimStart().startsWith('//') &&
            !z.trimStart().startsWith('*'),
        )
      if (meldetSichAn) continue
      if (name in GERAETEGEBUNDEN_LIB) continue
      // Schluessel der Datei gegen KONTO_SCHLUESSEL halten.
      const schluessel = [...quelle.matchAll(/'(myprosole[a-z_.0-9]*)'/g)].map((m) => m[1])
      if (schluessel.some((k) => schluesselBlock.includes(`'${k}'`))) continue
      offen.push(name)
    }

    expect(
      offen,
      'Diese Dateien in src/lib speichern dauerhaft, werden aber beim ' +
        'Abmelden nicht geraeumt. Entweder `beimAbmeldenVergessen` aufrufen, ' +
        'den Schluessel in KONTO_SCHLUESSEL eintragen, oder hier mit ' +
        `Begruendung als geraetegebunden benennen: ${offen.join(', ')}`,
    ).toEqual([])
  })
})
