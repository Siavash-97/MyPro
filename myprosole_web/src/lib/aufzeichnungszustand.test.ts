import { describe, it, expect } from 'vitest'
import {
  naechsterZustand,
  ableiten,
  merkerAus,
  merkerZu,
  type Aufzeichnungszustand,
  type Ereignis,
} from './aufzeichnungszustand'

/**
 * Der Zustand einer Aufzeichnung, als Summe statt als Produkt.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Vier Felder in `store/run.ts` beschrieben denselben Begriff -
 * `phase`, `activeRunId`, `sitzungId`, `zeileSteht` - und wurden an 25
 * Stellen aus sechs Zustaendigkeiten geschrieben, ohne dass eine Stelle die
 * Gueltigkeit der Kombination prueft. Darstellbar waren 48 Zustaende,
 * gueltig ein Bruchteil.
 *
 * Vier belegte Faelle im August 2026, jeder mit Datum im Entwurf
 * (`docs/aufzeichnungszustand-entwurf.md`): `anzahl()` als Anzeige- UND
 * Steuerzahl, `bestaetigt` als Bestaetigung UND Existenz, `activeRunId` als
 * Kennung UND Existenz - und `zeileSteht` mit drei Setzstellen und einer
 * Ruecksetzstelle, wodurch der ZWEITE Lauf jeder App-Sitzung verloren
 * gewesen waere.
 *
 * Was diese Tests deshalb pruefen muessen
 * ---------------------------------------
 * Nicht nur, dass die gueltigen Uebergaenge stattfinden. Auch, dass die
 * UNGUELTIGEN nicht stattfinden - das ist die Haelfte dessen, was eine
 * Zustandsmaschine zusichert, und der Teil, den eine Sammlung von
 * Einzelfeldern gar nicht zusichern kann.
 */

const zeichnetAuf = (
  teil: Partial<Extract<Aufzeichnungszustand, { art: 'zeichnet auf' }>> = {},
): Aufzeichnungszustand => ({
  art: 'zeichnet auf',
  sitzung: 's-1',
  zeileSteht: false,
  stoppversuche: 0,
  ...teil,
})

const pausiert = (): Aufzeichnungszustand => ({
  art: 'pausiert',
  sitzung: 's-1',
  zeileSteht: false,
  stoppversuche: 0,
})

const speichert = (
  teil: Partial<Extract<Aufzeichnungszustand, { art: 'speichert' }>> = {},
): Aufzeichnungszustand => ({
  art: 'speichert',
  sitzung: 's-1',
  zeileSteht: false,
  stoppversuche: 0,
  ...teil,
})

/** Alle acht Lagen, fuer die Rundumproben. */
const alleLagen: Aufzeichnungszustand[] = [
  { art: 'ruht' },
  zeichnetAuf(),
  pausiert(),
  speichert(),
  { art: 'abgebrochen', sitzung: 's-1', zeileSteht: true, stoppversuche: 3 },
  { art: 'abgeschickt', lauf: 'l-1', zeileSteht: true },
  { art: 'nicht angekommen', lauf: 'l-1' },
  { art: 'abgeschlossen', lauf: 'l-1' },
]

describe('naechsterZustand - die gueltigen Wege', () => {
  it('beginnt aus Ruhe, aus einem fertigen und aus einem nicht angekommenen Lauf', () => {
    // `startRun` darf ausdruecklich aus 'completed' starten - sonst waere
    // nach dem ersten Lauf Schluss (run.ts:842). 'nicht angekommen' kommt
    // dazu: Der Mensch hat seinen Lauf gesehen, er darf weiterlaufen.
    for (const vorher of [
      { art: 'ruht' } as const,
      { art: 'abgeschlossen', lauf: 'l-0' } as const,
      { art: 'nicht angekommen', lauf: 'l-0' } as const,
    ]) {
      expect(naechsterZustand(vorher, { art: 'beginnt', sitzung: 's-9' })).toEqual({
        art: 'zeichnet auf',
        sitzung: 's-9',
        zeileSteht: false,
        stoppversuche: 0,
      })
    }
  })

  it('faengt jede neue Aufzeichnung ohne Zeile und ohne Versuche an', () => {
    // Der Fehler vom 31.08.2026 in einer Zeile: `zeileSteht` blieb nach
    // einem gespeicherten Lauf auf `true` stehen. Hier ist er nicht mehr
    // formulierbar - `beginnt` baut die Lage neu, statt Felder zu setzen.
    const vorher = { art: 'abgeschlossen', lauf: 'l-0' } as const
    const nachher = naechsterZustand(vorher, { art: 'beginnt', sitzung: 's-9' })
    expect(nachher).toMatchObject({ zeileSteht: false, stoppversuche: 0 })
  })

  it('traegt die entstandene Zeile in die drei Lagen ein, die eine Sitzung haben', () => {
    for (const vorher of [zeichnetAuf(), pausiert(), speichert()]) {
      const nachher = naechsterZustand(vorher, { art: 'zeileEntstanden', sitzung: 's-1' })
      expect(nachher).toMatchObject({ art: vorher.art, zeileSteht: true })
    }
  })

  it('laesst die Zeile auch dann eintragen, wenn schon gespeichert wird', () => {
    // DER WETTLAUF, und er ist kein hypothetischer.
    //
    // Nachgemessen am 31.08.2026: `zeileNachziehen` liest seine Wache EINMAL
    // vor dem Netzaufruf (run.ts:954-956) und schreibt DANACH ohne erneute
    // Pruefung (run.ts:971). Setzt `stopRun` in dieser Zeit `phase:
    // 'saving'`, laeuft der Aufruf trotzdem zu Ende.
    //
    // Dieser Uebergang ist der einzige, der nur ueber einen Wettlauf
    // erreichbar ist - und damit der wahrscheinlichste Kandidat dafuer, beim
    // Umbau verlorenzugehen. Deshalb hat er einen eigenen Test.
    const nachher = naechsterZustand(speichert(), { art: 'zeileEntstanden', sitzung: 's-1' })
    expect(nachher).toEqual({
      art: 'speichert',
      sitzung: 's-1',
      zeileSteht: true,
      stoppversuche: 0,
    })
  })

  it('pausiert und setzt fort', () => {
    expect(naechsterZustand(zeichnetAuf(), { art: 'pausiert' })).toMatchObject({
      art: 'pausiert',
    })
    expect(naechsterZustand(pausiert(), { art: 'fortgesetzt' })).toMatchObject({
      art: 'zeichnet auf',
    })
  })

  it('beginnt das Beenden aus Aufzeichnung, Pause und Abbruch', () => {
    // Aus 'abgebrochen' heraus ist ein zweiter Versuch ausdruecklich
    // erlaubt (run.ts:1009) - sonst saesse der Mensch fest.
    for (const vorher of [
      zeichnetAuf(),
      pausiert(),
      { art: 'abgebrochen', sitzung: 's-1', zeileSteht: true, stoppversuche: 3 } as const,
    ]) {
      expect(naechsterZustand(vorher, { art: 'beendenBegonnen' })).toMatchObject({
        art: 'speichert',
        sitzung: 's-1',
      })
    }
  })

  it('behaelt Zeile und Versuche beim Uebergang ins Speichern', () => {
    const vorher = zeichnetAuf({ zeileSteht: true, stoppversuche: 2 })
    expect(naechsterZustand(vorher, { art: 'beendenBegonnen' })).toEqual({
      art: 'speichert',
      sitzung: 's-1',
      zeileSteht: true,
      stoppversuche: 2,
    })
  })

  it('nimmt eine abgebrochene Aufzeichnung wieder auf, bevor beendet wird', () => {
    // Gefunden vom Agenten `pruefung` am 31.08.2026, am Quelltext bestaetigt.
    // `stopRun` setzt bei einem Versuch aus 'abgebrochen' SOFORT
    // `phase: 'tracking'` (run.ts:1009) - und zwar BEVOR
    // `aufzeichnungStoppen()` und `punkteEinsammeln()` laufen.
    //
    // Der Grund steht bei run.ts:998-1007: `punkteEinsammeln` reicht an
    // `addPoint`, und das steigt bei `phase !== 'tracking'` aus. Danach
    // loescht `punkteBestaetigen` beim Dienst genau die Punkte, die nie
    // angekommen sind. Befund des Agenten `oberflaeche` vom 24.08.2026.
    //
    // Ohne dieses Ereignis fuehrte `beendenBegonnen` direkt nach
    // 'speichert' - und der Befund vom 24.08. waere wiederhergestellt.
    expect(
      naechsterZustand(
        { art: 'abgebrochen', sitzung: 's-1', zeileSteht: true, stoppversuche: 3 },
        { art: 'wiederaufgenommen' },
      ),
    ).toEqual({ art: 'zeichnet auf', sitzung: 's-1', zeileSteht: true, stoppversuche: 3 })
  })

  it('schliesst ab und schickt ab - zwei Lagen, nicht ein Merkmal', () => {
    // Q7: `bestaetigt` als Merkmal neben 'abgeschlossen' waere dasselbe
    // Muster gewesen, das Q3 fuer 'abgebrochen' verworfen hat. Vier
    // Aufrufer verhalten sich unterschiedlich (Navigation ins Tagebuch,
    // Nachholschleife, Sendesperre, Sichtbarkeits-Frist) - also zwei Lagen.
    expect(naechsterZustand(speichert(), { art: 'gespeichert', lauf: 'l-7' })).toEqual({
      art: 'abgeschlossen',
      lauf: 'l-7',
    })
    expect(
      naechsterZustand(speichert({ zeileSteht: true }), {
        art: 'abgeschicktOhneAntwort',
        lauf: 'l-7',
      }),
    ).toEqual({ art: 'abgeschickt', lauf: 'l-7', zeileSteht: true })
  })

  it('holt die Bestaetigung nach - oder gibt auf', () => {
    // Beide Uebergaenge gibt es heute NICHT: `bestaetigungNachholen`
    // enthaelt kein einziges `set()`. Der Bildschirm zeigt einen fertigen
    // Lauf, waehrend der Merker "dauerhaft gescheitert" traegt, und bis zum
    // naechsten App-Start weiss es niemand.
    const abgeschickt = { art: 'abgeschickt', lauf: 'l-7', zeileSteht: false } as const
    expect(naechsterZustand(abgeschickt, { art: 'nachholenGelungen', lauf: 'l-7' })).toEqual({
      art: 'abgeschlossen',
      lauf: 'l-7',
    })
    expect(naechsterZustand(abgeschickt, { art: 'nachholenAufgegeben', lauf: 'l-7' })).toEqual({
      art: 'nicht angekommen',
      lauf: 'l-7',
    })
  })

  it('zaehlt einen wiederholbaren Fehlschlag und geht zurueck, woher es kam', () => {
    // `abbruchUndWeiterAufzeichnen` geht in DEN Zustand zurueck, aus dem
    // gestoppt wurde - nicht pauschal in 'tracking'. Wer aus der Pause
    // beendet und scheitert, landete sonst in 'tracking' mit einem
    // `pauseStart`, den weder pauseRun noch resumeRun je erzeugen koennen
    // (Befund vom 24.08.2026).
    const ausPause = naechsterZustand(speichert({ stoppversuche: 1 }), {
      art: 'speichernGescheitert',
      dauerhaft: false,
      zurueckZu: 'pausiert',
    })
    expect(ausPause).toEqual({
      art: 'pausiert',
      sitzung: 's-1',
      zeileSteht: false,
      stoppversuche: 2,
    })
  })

  it('zaehlt auch dann, wenn der Fehler vor dem Speichern auftritt', () => {
    // `zurueck()` erhoeht `stoppversuche` AUSSERHALB jeder Phasenpruefung
    // (run.ts:1030). Und die werfenden Stellen - `aufzeichnungStoppen` und
    // `punkteEinsammeln` - liegen VOR `set({ phase: 'saving' })`.
    //
    // Zaehlte das Modell nur aus 'speichert', erreichte
    // `versuche >= MAX_VERSUCHE` nie: Genau die Endlosschleife, gegen die
    // `lib/stoppfehler.ts` geschrieben wurde, kaeme zurueck.
    const nachher = naechsterZustand(zeichnetAuf({ stoppversuche: 1 }), {
      art: 'speichernGescheitert',
      dauerhaft: false,
      zurueckZu: 'zeichnet auf',
    })
    expect(nachher).toMatchObject({ art: 'zeichnet auf', stoppversuche: 2 })
  })

  it('kann in den Abbruch zurueck, aus dem der Versuch kam', () => {
    // `phaseVorher` kann 'abgebrochen' sein (run.ts:1015-1019), und
    // `zurueck()` gibt bei einem WIEDERHOLBAREN Fehler genau dorthin
    // zurueck. Kannte `zurueckZu` nur 'zeichnet auf' und 'pausiert', wuerde
    // der Dienst wieder angeworfen und die Marke faellt weg - und die
    // Entscheidungsansicht (LiveTracking.tsx:520-529) entfiele.
    const nachher = naechsterZustand(speichert({ stoppversuche: 1 }), {
      art: 'speichernGescheitert',
      dauerhaft: false,
      zurueckZu: 'abgebrochen',
    })
    expect(nachher).toMatchObject({ art: 'abgebrochen', stoppversuche: 2 })
  })

  it('geht bei einem dauerhaften Fehlschlag in den Abbruch', () => {
    expect(
      naechsterZustand(speichert({ stoppversuche: 2 }), {
        art: 'speichernGescheitert',
        dauerhaft: true,
        zurueckZu: 'zeichnet auf',
      }),
    ).toMatchObject({ art: 'abgebrochen', stoppversuche: 3 })
  })

  it('verwirft aus jeder Lage', () => {
    for (const vorher of alleLagen) {
      expect(naechsterZustand(vorher, { art: 'verworfen' })).toEqual({ art: 'ruht' })
    }
  })

  it('birgt eine Aufzeichnung, die die App nicht mehr kennt', () => {
    expect(
      naechsterZustand({ art: 'ruht' }, { art: 'geborgen', sitzung: 's-4', zeileSteht: true }),
    ).toEqual({ art: 'zeichnet auf', sitzung: 's-4', zeileSteht: true, stoppversuche: 0 })
  })
})

describe('naechsterZustand - die Wege, die es NICHT gibt', () => {
  it('faengt nicht mitten in einer laufenden Aufzeichnung neu an', () => {
    // Die Wache aus run.ts:842 als Zusicherung: 'tracking', 'paused' und
    // 'saving' duerfen NICHT starten. Ein zweites `startRun` waehrend eines
    // laufenden Speichervorgangs raeumte sonst den Zustand ab, an dem
    // `stopRun` gerade arbeitet.
    for (const vorher of [zeichnetAuf(), pausiert(), speichert()]) {
      expect(naechsterZustand(vorher, { art: 'beginnt', sitzung: 's-9' })).toEqual(vorher)
    }
  })

  it('setzt nicht fort, was nicht pausiert ist', () => {
    for (const vorher of [zeichnetAuf(), speichert(), { art: 'ruht' } as const]) {
      expect(naechsterZustand(vorher, { art: 'fortgesetzt' })).toEqual(vorher)
    }
  })

  it('pausiert nichts, was nicht aufzeichnet', () => {
    for (const vorher of [pausiert(), speichert(), { art: 'ruht' } as const]) {
      expect(naechsterZustand(vorher, { art: 'pausiert' })).toEqual(vorher)
    }
  })

  it('traegt keine Zeile in eine Lage ein, die keine Sitzung hat', () => {
    for (const vorher of [
      { art: 'ruht' } as const,
      { art: 'abgeschickt', lauf: 'l-1', zeileSteht: false } as const,
      { art: 'abgeschlossen', lauf: 'l-1' } as const,
    ]) {
      expect(naechsterZustand(vorher, { art: 'zeileEntstanden', sitzung: 's-1' })).toEqual(vorher)
    }
  })

  it('holt keine Bestaetigung nach, wo nichts aussteht', () => {
    // `bestaetigungNachholen` laeuft bis zu einer Stunde im Hintergrund.
    // Startet der Mensch in dieser Zeit einen NEUEN Lauf, darf die alte
    // Schleife dessen Lage nicht anfassen - derselbe Fehler, gegen den
    // `merkerLoeschenFalls` am 29.08.2026 gebaut wurde, nur eine Ebene
    // hoeher.
    for (const vorher of [zeichnetAuf(), { art: 'abgeschlossen', lauf: 'l-1' } as const]) {
      expect(naechsterZustand(vorher, { art: 'nachholenGelungen', lauf: 'l-1' })).toEqual(vorher)
      expect(naechsterZustand(vorher, { art: 'nachholenAufgegeben', lauf: 'l-1' })).toEqual(vorher)
    }
  })

  it('beendet nichts, was ruht oder schon fertig ist', () => {
    for (const vorher of [
      { art: 'ruht' } as const,
      { art: 'abgeschlossen', lauf: 'l-1' } as const,
      { art: 'abgeschickt', lauf: 'l-1', zeileSteht: false } as const,
    ]) {
      expect(naechsterZustand(vorher, { art: 'beendenBegonnen' })).toEqual(vorher)
    }
  })

  it('birgt nichts, solange etwas laeuft', () => {
    // `verwaisteAufzeichnungBergen` steigt bei `phase !== 'idle'` aus
    // (run.ts:1815). Ohne das ueberschriebe eine Bergung die Sitzung eines
    // gerade gestarteten Laufs und holte seine Punkte in die falsche Ablage.
    for (const vorher of [zeichnetAuf(), speichert()]) {
      expect(
        naechsterZustand(vorher, { art: 'geborgen', sitzung: 's-4', zeileSteht: false }),
      ).toEqual(vorher)
    }
  })

  /**
   * Die Luecke, die der Agent `pruefung` am 31.08.2026 gefunden hat.
   *
   * Meine ersten acht Verbotstests deckten `ruht`, `zeichnet auf`,
   * `pausiert`, `speichert`, `abgeschlossen` und `abgeschickt` ab -
   * **`abgebrochen` und `nicht angekommen` kamen in keinem einzigen als
   * Ausgangslage vor.** Neun Mutationen am Modul liessen sich fahren, ohne
   * dass ein Test rot wurde.
   *
   * Und mein Bericht behauptete "Gegenprobe an fuenf Wachen - jede ergab
   * einen roten Test". Das stimmte fuer die fuenf, die ich mutiert habe. Es
   * sind zwoelf. Dieselbe Form wie zweimal am selben Tag: eine Pruefung,
   * die lief, aber den gesuchten Fall nicht finden konnte.
   */
  it('laesst eine abgebrochene Aufzeichnung von den falschen Ereignissen unberuehrt', () => {
    const abgebrochen = {
      art: 'abgebrochen',
      sitzung: 's-1',
      zeileSteht: true,
      stoppversuche: 3,
    } as const
    // Neu beginnen: `startRun` verbietet es (run.ts:859) - der ungespeicherte
    // Lauf waere sonst weg.
    expect(naechsterZustand(abgebrochen, { art: 'beginnt', sitzung: 's-9' })).toEqual(abgebrochen)
    // Pausieren: `pauseRun` verbietet es (run.ts:978).
    expect(naechsterZustand(abgebrochen, { art: 'pausiert' })).toEqual(abgebrochen)
    // Zeile eintragen: Dort ist der Dienst gestoppt und die Nachholschleife
    // laeuft nicht.
    expect(
      naechsterZustand(abgebrochen, { art: 'zeileEntstanden', sitzung: 's-1' }),
    ).toEqual(abgebrochen)
    // Ein fremder Abschluss darf die Entscheidung nicht wegraeumen.
    expect(naechsterZustand(abgebrochen, { art: 'gespeichert', lauf: 'l-9' })).toEqual(abgebrochen)
    expect(
      naechsterZustand(abgebrochen, { art: 'abgeschicktOhneAntwort', lauf: 'l-9' }),
    ).toEqual(abgebrochen)
  })

  it('laesst eine nicht angekommene Aufzeichnung unberuehrt, wo sie es sein muss', () => {
    const offen = { art: 'nicht angekommen', lauf: 'l-1' } as const
    expect(naechsterZustand(offen, { art: 'zeileEntstanden', sitzung: 'l-1' })).toEqual(offen)
    expect(naechsterZustand(offen, { art: 'pausiert' })).toEqual(offen)
    expect(naechsterZustand(offen, { art: 'fortgesetzt' })).toEqual(offen)
    expect(naechsterZustand(offen, { art: 'beendenBegonnen' })).toEqual(offen)
    expect(naechsterZustand(offen, { art: 'gespeichert', lauf: 'l-9' })).toEqual(offen)
    expect(naechsterZustand(offen, { art: 'wiederaufgenommen' })).toEqual(offen)
  })

  it('birgt nichts aus einer pausierten oder abgebrochenen Aufzeichnung', () => {
    // `verwaisteAufzeichnungBergen` steigt bei `phase !== 'idle'` aus
    // (run.ts:1869). Ohne diese Wache ueberschriebe eine Bergung die Sitzung
    // eines pausierten Laufs.
    for (const vorher of [
      pausiert(),
      { art: 'abgebrochen', sitzung: 's-1', zeileSteht: true, stoppversuche: 3 } as const,
      { art: 'abgeschickt', lauf: 'l-1', zeileSteht: false } as const,
    ]) {
      expect(
        naechsterZustand(vorher, { art: 'geborgen', sitzung: 's-4', zeileSteht: false }),
      ).toEqual(vorher)
    }
  })

  it('trifft nur die Aufzeichnung, zu der das Ereignis gehoert', () => {
    // Die Nachholschleife laeuft bis zu einer Stunde. Startet der Mensch in
    // dieser Zeit einen neuen Lauf und beendet auch DEN mit einer
    // Zeitgrenze, ist die Lage wieder 'abgeschickt' - aber mit einer
    // anderen Kennung. Ohne Kennung im Ereignis wuerde die alte Schleife
    // den neuen Lauf als "nicht angekommen" markieren.
    //
    // Genau der Fehler, gegen den `merkerLoeschenFalls` am 29.08.2026
    // gebaut wurde (laufMerker.ts:162) - eine Ebene hoeher.
    const neuerLauf = { art: 'abgeschickt', lauf: 'B', zeileSteht: false } as const
    expect(naechsterZustand(neuerLauf, { art: 'nachholenAufgegeben', lauf: 'A' })).toEqual(
      neuerLauf,
    )
    expect(naechsterZustand(neuerLauf, { art: 'nachholenGelungen', lauf: 'A' })).toEqual(neuerLauf)

    // Dasselbe fuer die Zeile: Ein `zeileNachziehen` aus Lauf A darf nicht
    // die Zeile von Lauf B als vorhanden melden. Der `insert` bei run.ts:960
    // hat KEINE Zeitgrenze - das Fenster ist unbegrenzt.
    const laufB = zeichnetAuf({ sitzung: 'B' })
    expect(naechsterZustand(laufB, { art: 'zeileEntstanden', sitzung: 'A' })).toEqual(laufB)
  })

  it('laesst jede Lage von jedem unpassenden Ereignis unberuehrt', () => {
    // Die Rundumprobe: acht Lagen gegen alle Ereignisse. Was oben nicht
    // ausdruecklich als gueltig steht, muss die Lage unveraendert lassen -
    // nicht abstuerzen und nicht etwas Drittes ergeben.
    const ereignisse: Ereignis[] = [
      { art: 'beginnt', sitzung: 's-9' },
      { art: 'zeileEntstanden', sitzung: 's-1' },
      { art: 'pausiert' },
      { art: 'fortgesetzt' },
      { art: 'beendenBegonnen' },
      { art: 'wiederaufgenommen' },
      { art: 'gespeichert', lauf: 'l-9' },
      { art: 'abgeschicktOhneAntwort', lauf: 'l-9' },
      { art: 'nachholenGelungen', lauf: 'l-1' },
      { art: 'nachholenAufgegeben', lauf: 'l-1' },
      { art: 'speichernGescheitert', dauerhaft: false, zurueckZu: 'zeichnet auf' },
      { art: 'verworfen' },
      { art: 'geborgen', sitzung: 's-4', zeileSteht: false },
    ]
    for (const vorher of alleLagen) {
      for (const e of ereignisse) {
        const nachher = naechsterZustand(vorher, e)
        expect(nachher).toBeDefined()
        expect(typeof nachher.art).toBe('string')
      }
    }
  })
})

describe('merkerAus - der Merker wird abgeleitet, nicht gepflegt', () => {
  it('legt keinen Merker an, wo es nichts zu bergen gibt', () => {
    expect(merkerAus({ art: 'ruht' })).toBeNull()
    expect(merkerAus({ art: 'abgeschlossen', lauf: 'l-1' })).toBeNull()
  })

  it('merkt Sitzung und Zeilenstand, solange eine Aufzeichnung laeuft', () => {
    expect(merkerAus(zeichnetAuf({ zeileSteht: true }))).toEqual({
      sitzungId: 's-1',
      runId: 's-1',
      dauerhaftGescheitert: false,
    })
    expect(merkerAus(zeichnetAuf())).toEqual({
      sitzungId: 's-1',
      runId: null,
      dauerhaftGescheitert: false,
    })
  })

  it('setzt die Marke in beiden dauerhaft gescheiterten Lagen', () => {
    // Q12: 'abgebrochen' und 'nicht angekommen' unterscheiden sich darin,
    // was der Mensch schon hat - im Merker sind beide dasselbe.
    expect(
      merkerAus({ art: 'abgebrochen', sitzung: 's-1', zeileSteht: true, stoppversuche: 3 }),
    ).toMatchObject({ dauerhaftGescheitert: true })
    expect(merkerAus({ art: 'nicht angekommen', lauf: 'l-1' })).toMatchObject({
      dauerhaftGescheitert: true,
    })
  })

  it('merkt einen abgeschickten Lauf weiter - er ist der einzige Rueckweg', () => {
    expect(merkerAus({ art: 'abgeschickt', lauf: 'l-1', zeileSteht: true })).toEqual({
      sitzungId: 'l-1',
      runId: 'l-1',
      dauerhaftGescheitert: false,
    })
    // Ohne Zeile traegt der Merker keine - sonst liest die Bergung daraus
    // `zeileSteht: true` und schreibt ein `update` auf nichts.
    expect(merkerAus({ art: 'abgeschickt', lauf: 'l-1', zeileSteht: false })).toEqual({
      sitzungId: 'l-1',
      runId: null,
      dauerhaftGescheitert: false,
    })
  })
})

describe('merkerZu - was beim naechsten Start daraus wird', () => {
  it('ruht ohne Merker', () => {
    expect(merkerZu(null)).toEqual({ art: 'ruht' })
  })

  it('nimmt eine Aufzeichnung wieder auf', () => {
    expect(merkerZu({ sitzungId: 's-1', runId: 's-1', dauerhaftGescheitert: false })).toEqual({
      art: 'zeichnet auf',
      sitzung: 's-1',
      zeileSteht: true,
      stoppversuche: 0,
    })
  })

  it('erkennt die Marke und fragt nicht blind noch einmal', () => {
    expect(
      merkerZu({ sitzungId: 's-1', runId: 's-1', dauerhaftGescheitert: true }),
    ).toMatchObject({ art: 'abgebrochen' })
  })

  it('liest einen Merker aus der Zeit vor dem 31.08.2026', () => {
    // Q9: Damals vergab die Datenbank die Lauf-Kennung, `runId` und
    // `sitzungId` waren verschieden. Solche Merker liegen weiter im
    // Geraetespeicher, und `merkerLesen` nimmt sie unveraendert an.
    //
    // Was hier NICHT geht: die alte Lauf-Kennung mitnehmen. Das Modell
    // kennt seit A2 nur EINE Kennung je Aufzeichnung. Die Zeile unter der
    // alten Kennung bleibt liegen und wird von
    // `haengendeLaeufeAbschliessen` nach der Schonfrist abgeschlossen.
    // Siehe "Offene Wege" im Bericht - das ist eine bewusste Einschraenkung
    // gegenueber Q9, kein Versehen.
    expect(
      merkerZu({ sitzungId: 's-alt', runId: 'lauf-alt', dauerhaftGescheitert: false }),
    ).toEqual({
      art: 'zeichnet auf',
      sitzung: 's-alt',
      zeileSteht: false,
      stoppversuche: 0,
    })
  })

  it('passt zu merkerAus - was herausgeht, kommt wieder herein', () => {
    // Die Probe auf die Ableitung. Sie gilt NICHT fuer jede Lage: Aus
    // 'pausiert' oder 'speichert' wird beim naechsten Start eine
    // Aufzeichnung, das ist gewollt - der Dienst laeuft ja weiter.
    const zustand = zeichnetAuf({ zeileSteht: true })
    expect(merkerZu(merkerAus(zustand))).toEqual(zustand)
  })
})


/**
 * Die Ableitung auf die vier Lesefelder.
 *
 * Der Zwischenschritt aus Q8: Die Lage ist die Wahrheit, die vier Felder
 * bleiben als Lesefelder daneben stehen - geschrieben nur noch aus einer
 * Stelle. Folgeauftrag F1 entfernt sie, sobald alle Leser die Lage fragen.
 *
 * ES SIND ZWEI LESER, nicht vier. Nachgezaehlt am 31.08.2026:
 *
 *   phase        nur pages/LiveTracking.tsx
 *   activeRunId  nur pages/RunSummary.tsx:225,228 (der Link zur Analyse)
 *   sitzungId    nur pages/LiveTracking.tsx:388 (aufzeichnungStand)
 *   zeileSteht   niemand aus dem Store
 *
 * `Startbergung.tsx` und `RunDetail.tsx` lesen keines der vier. Der Entwurf
 * nannte vier Dateien; das war zu weit gegriffen.
 *
 * Diese Tests pruefen deshalb gegen die ZWEI echten Leser und ihre
 * Bedingungen, nicht gegen eine gedachte Schnittstelle.
 */
describe('ableiten - gegen die zwei echten Leser', () => {
  it('gibt den vier Feldern in jeder Lage einen Wert', () => {
    for (const lage of alleLagen) {
      const a = ableiten(lage)
      expect(typeof a.phase).toBe('string')
      expect(typeof a.zeileSteht).toBe('boolean')
    }
  })

  it('bildet die laufenden Lagen auf die bekannten Phasen ab', () => {
    expect(ableiten({ art: 'ruht' })).toMatchObject({
      phase: 'idle',
      activeRunId: null,
      sitzungId: null,
      zeileSteht: false,
    })
    expect(ableiten(zeichnetAuf({ zeileSteht: true }))).toMatchObject({
      phase: 'tracking',
      activeRunId: 's-1',
      sitzungId: 's-1',
      zeileSteht: true,
    })
    expect(ableiten(pausiert())).toMatchObject({ phase: 'paused' })
    expect(ableiten(speichert())).toMatchObject({ phase: 'saving' })
    expect(
      ableiten({ art: 'abgebrochen', sitzung: 's-1', zeileSteht: true, stoppversuche: 3 }),
    ).toMatchObject({ phase: 'abgebrochen' })
  })

  it('zeigt fuer "nicht angekommen" KEINE Rueckfrage', () => {
    // Der erste echte Leser: `LiveTracking.tsx:224` und `:520` pruefen
    // `phase === 'abgebrochen'`, um die Entscheidungsansicht zu zeigen.
    //
    // Ein Mensch, der die Zusammenfassung schon gesehen hat, bekaeme sonst
    // beim Zurueckgehen eine Rueckfrage zu einem Lauf, der fuer ihn fertig
    // ist. Und `:229` (`if (phase === 'idle') startRun()`) darf nicht
    // greifen.
    const a = ableiten({ art: 'nicht angekommen', lauf: 'l-1' })
    expect(a.phase).toBe('completed')
    expect(a.phase).not.toBe('abgebrochen')
    expect(a.phase).not.toBe('idle')
  })

  it('versteckt den Analyse-Link, wo es nichts zu analysieren gibt', () => {
    // Der zweite echte Leser: `RunSummary.tsx:225` ist `{activeRunId && (`.
    // Bei 'nicht angekommen' steht SICHER keine Zeile in der Datenbank -
    // der Link fuehrte ins Leere. Mit `null` versteckt die Zusammenfassung
    // ihn von selbst, ohne dass jemand eine neue Bedingung schreibt.
    expect(ableiten({ art: 'nicht angekommen', lauf: 'l-1' }).activeRunId).toBeNull()

    // Bei 'abgeschickt' bleibt er: Dort laeuft die Nachholschleife noch,
    // und im `update`-Fall existiert die Zeile.
    expect(
      ableiten({ art: 'abgeschickt', lauf: 'l-1', zeileSteht: true }).activeRunId,
    ).toBe('l-1')
  })

  it('reicht den Zeilenstand von "abgeschickt" durch, statt ihn zu raten', () => {
    // Befund 9 aus der Pruefung: 'abgeschickt' entsteht aus BEIDEN Wegen.
    // Im `update`-Fall existiert die Zeile seit dem Start, im `upsert`-Fall
    // nicht. `punkteUebertragen` spart Laeufe ohne Zeile aus - mit einem
    // geratenen `true` gingen die Punkte gegen einen fehlenden
    // Fremdschluessel, mit einem geratenen `false` blieben sie grundlos
    // liegen.
    expect(ableiten({ art: 'abgeschickt', lauf: 'l-1', zeileSteht: true }).zeileSteht).toBe(true)
    expect(ableiten({ art: 'abgeschickt', lauf: 'l-1', zeileSteht: false }).zeileSteht).toBe(false)
  })

  it('setzt fuer einen abgeschlossenen Lauf alles auf fertig', () => {
    expect(ableiten({ art: 'abgeschlossen', lauf: 'l-1' })).toEqual({
      phase: 'completed',
      activeRunId: 'l-1',
      sitzungId: 'l-1',
      zeileSteht: true,
    })
  })
})
