import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ZusammenLauf: der Wischstapel und die Anfragen - am Store gemessen.
 *
 * Die Regeln, die hier bewacht werden, sind die Entscheidungen des Nutzers
 * vom 23.08.2026:
 *
 *   Q1b  Links wischen ist dauerhaft. Eigene Tabelle, getrennt von
 *        "blockiert".
 *   Q2a  Rechts wischen legt eine Anfrage an - keinen Chat. Der Absender
 *        ist offen sichtbar.
 *   Q3a  Die Anfrage steht in einer Tabelle, nicht in einer gerechneten
 *        Liste - damit eine spaetere Systemmeldung nur angehaengt wird.
 *
 * Der Store ist die Verdrahtung zwischen Oberflaeche und Datenbank, und die
 * Verdrahtung ist der Ort, an dem die Fehler dieses Projekts sassen - nicht
 * die reinen Funktionen. Deshalb wird hier mit nachgebautem Supabase am
 * Store geprueft, welche Tabelle was mit welchen Feldern bekommt.
 */

const ICH = 'ich-1111'

/** Was zuletzt wohin geschrieben wurde. */
let schreibvorgaenge: Array<{ tabelle: string; art: string; werte: unknown }> = []
let rpcAufrufe: Array<{ fn: string; args: unknown }> = []
/** Antwort des naechsten Schreibvorgangs, je Tabelle. */
let antwortFuer: Record<string, { error: { code?: string; message: string } | null }> = {}
let rpcAntwort: { data: unknown; error: { message: string } | null } = { data: [], error: null }
let ladeFehler: { message: string } | null = null
let ladeDaten: unknown = null
let selectAntwort: { data: unknown; error: { message: string } | null } = { data: [], error: null }

/**
 * Die nachgebaute Abfragekette.
 *
 * Warum jeder Schritt die KETTE zurueckgibt und nicht ein Promise
 * ---------------------------------------------------------------
 * Ein echter Supabase-Builder ist ein *Thenable*: Er laesst sich awaiten
 * UND weiterketten. Die erste Fassung dieses Mocks gab bei `.eq()` ein
 * fertiges Promise zurueck - damit lief `await …update().eq()` zwar, aber
 * `…select().eq().maybeSingle()` war schlicht nicht nachbaubar. Ein Mock,
 * der weniger kann als das Echte, verbirgt genau die Wege, die es nur im
 * Echten gibt.
 */
function kette(tabelle: string) {
  const k: Record<string, unknown> = {}
  const antwort = () => antwortFuer[tabelle] ?? { error: null }
  const merken = (art: string) => (werte: unknown) => {
    schreibvorgaenge.push({ tabelle, art, werte })
    return k
  }
  // Das `then` macht die Kette awaitbar, ohne sie zu beenden.
  k.then = (aufloesen: (w: unknown) => unknown) => Promise.resolve(antwort()).then(aufloesen)
  k.insert = vi.fn(merken('insert'))
  k.update = vi.fn(merken('update'))
  k.upsert = vi.fn(merken('upsert'))
  k.eq = vi.fn((spalte: string, wert: unknown) => {
    schreibvorgaenge.push({ tabelle, art: 'eq', werte: { [spalte]: wert } })
    return k
  })
  k.select = vi.fn(() => k)
  k.maybeSingle = vi.fn(() => Promise.resolve({ data: ladeDaten, error: ladeFehler }))
  k.order = vi.fn(() => Promise.resolve(selectAntwort))
  return k
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((tabelle: string) => kette(tabelle)),
    rpc: vi.fn((fn: string, args: unknown) => {
      rpcAufrufe.push({ fn, args })
      return Promise.resolve(rpcAntwort)
    }),
  },
}))
vi.mock('../lib/eigeneKennung', () => ({ eigeneKennung: () => ICH }))

/** Nachgebauter Einwilligungs-Store: wer erteilt/widerrufen hat. */
let einwilligungen: Array<{ art: string; zweck: unknown }> = []
let erteilenAntwort: string | null = null
let widerrufenAntwort: string | null = null
vi.mock('./einwilligung', () => ({
  useEinwilligung: {
    getState: () => ({
      geladen: true,
      laden: vi.fn(async () => {}),
      erteilen: vi.fn(async (zwecke: unknown) => {
        einwilligungen.push({ art: 'erteilt', zweck: zwecke })
        return erteilenAntwort
      }),
      widerrufen: vi.fn(async (zweck: unknown) => {
        einwilligungen.push({ art: 'widerrufen', zweck })
        return widerrufenAntwort
      }),
    }),
  },
}))

const profil = (id: string) => ({ user_id: id, bio: null, identitaet: null })

async function frisch() {
  vi.resetModules()
  const { useZusammenlauf } = await import('./zusammenlauf')
  return useZusammenlauf
}

describe('ZusammenLauf-Store', () => {
  beforeEach(() => {
    schreibvorgaenge = []
    rpcAufrufe = []
    antwortFuer = {}
    rpcAntwort = { data: [], error: null }
    selectAntwort = { data: [], error: null }
    ladeFehler = null
    ladeDaten = null
    einwilligungen = []
    erteilenAntwort = null
    widerrufenAntwort = null
  })

  it('holt die Vorschlaege ueber die Datenbankfunktion, nicht ueber einen App-Filter', async () => {
    // Die Bringschuld aus 0049: Der Filter MUSS in der Datenbank liegen.
    // Ein select auf community_profiles mit App-Filter waere genau die
    // "Bequemlichkeit statt Schutz", vor der die Migration warnt.
    rpcAntwort = { data: [profil('a'), profil('b')], error: null }
    const store = await frisch()

    await store.getState().vorschlaegeLaden()

    expect(rpcAufrufe).toEqual([{ fn: 'zusammenlauf_vorschlaege', args: { hoechstens: 20 } }])
    expect(store.getState().stapel.map((p) => p.user_id)).toEqual(['a', 'b'])
  })

  it('schreibt links wischen dauerhaft in die Wisch-Tabelle - nicht in die Blockierliste', async () => {
    rpcAntwort = { data: [profil('a'), profil('b')], error: null }
    const store = await frisch()
    await store.getState().vorschlaegeLaden()

    await store.getState().wegwischen('a')

    expect(schreibvorgaenge).toEqual([
      {
        tabelle: 'zusammenlauf_weggewischt',
        art: 'insert',
        werte: { wischer_id: ICH, weggewischt_id: 'a' },
      },
    ])
    expect(store.getState().stapel.map((p) => p.user_id)).toEqual(['b'])
  })

  it('legt rechts wischen eine Anfrage an - keinen Chat, keinen Zwischenstand von Hand', async () => {
    rpcAntwort = { data: [profil('a')], error: null }
    const store = await frisch()
    await store.getState().vorschlaegeLaden()

    await store.getState().anfragen('a')

    // stand wird NICHT mitgeschickt: Die Voreinstellung 'offen' kommt aus
    // der Datenbank, und die Insert-Regel dort erzwingt sie ohnehin.
    expect(schreibvorgaenge).toEqual([
      {
        tabelle: 'community_kontakt_anfragen',
        art: 'insert',
        werte: { von_id: ICH, an_id: 'a' },
      },
    ])
    expect(store.getState().stapel).toEqual([])
    expect(store.getState().fehler).toBeNull()
  })

  it('behandelt "schon angefragt" als erledigt, nicht als Fehler', async () => {
    // Doppelt getippt, oder die Anfrage lief frueher schon: 23505 heisst
    // "gibt es schon" - genau das Ergebnis, das gewollt war.
    rpcAntwort = { data: [profil('a')], error: null }
    antwortFuer['community_kontakt_anfragen'] = {
      error: { code: '23505', message: 'duplicate key value' },
    }
    const store = await frisch()
    await store.getState().vorschlaegeLaden()

    await store.getState().anfragen('a')

    expect(store.getState().stapel).toEqual([])
    expect(store.getState().fehler).toBeNull()
  })

  it('behaelt die Karte, wenn die Anfrage scheitert', async () => {
    // Kein Netz: Die Person soll es erneut versuchen koennen, statt dass
    // das Profil verschwindet und die Anfrage nie ankam.
    rpcAntwort = { data: [profil('a')], error: null }
    antwortFuer['community_kontakt_anfragen'] = {
      error: { code: '57014', message: 'kein Netz' },
    }
    const store = await frisch()
    await store.getState().vorschlaegeLaden()

    await store.getState().anfragen('a')

    expect(store.getState().stapel.map((p) => p.user_id)).toEqual(['a'])
    expect(store.getState().fehler).toContain('kein Netz')
  })

  it('beantwortet eine Anfrage nur ueber die zwei erlaubten Spalten', async () => {
    // Das spaltenweise Update-Recht in 0052 laesst nur stand und
    // beantwortet_am zu. Schickte der Store mehr, scheiterte JEDES
    // Antworten mit 42501 - und zwar erst in Produktion.
    const store = await frisch()

    await store.getState().antworten('anfrage-1', 'angenommen')

    const update = schreibvorgaenge.find((v) => v.art === 'update')
    expect(update?.tabelle).toBe('community_kontakt_anfragen')
    const werte = update?.werte as Record<string, unknown>
    expect(Object.keys(werte).sort()).toEqual(['beantwortet_am', 'stand'])
    expect(werte.stand).toBe('angenommen')
    expect(typeof werte.beantwortet_am).toBe('string')
  })

  it('schreibt den Schalter ueber die schmale Funktion - und NUR den Schalter', async () => {
    // Zwei Aenderungen vom 24.08.2026 treffen sich in diesem Test.
    //
    // ERSTENS: kein `upsert` mehr. Migration 0057 entzieht das Leserecht auf
    // `zusammenlauf_sichtbar`, und `on conflict do update set spalte = ...`
    // verlangt SELECT auf die ZIELSPALTE der Zuweisung. Gemessen gegen eine
    // lokale Datenbank: upsert mit dieser Spalte -> 42501, mit `bio` -> 200.
    // Zwei Agenten hatten das aus dem Postgres-Quelltext falsch abgeleitet,
    // weil sie die EXCLUDED-Seite prueften; dort stimmt es.
    //
    // ZWEITENS, und das ist der eigentliche Sollwert hier: Die Funktion
    // bekommt **einen** Wert. Kein `p_zeigt_mir`, kein `p_sichtbar_fuer`,
    // auch nicht als Vorgabe.
    //
    // Sollwert-Begruendung: Ein gemeinsamer Setzweg haette verlangt, dass
    // diese Stelle die zwei Praeferenzen mitschickt - die sie nicht kennt.
    // Sie haette Vorgaben geschickt, und `sichtbar_fuer = '{}'` heisst laut
    // 0049 **"alle"**. Wer den Schalter umlegt, haette damit sein Profil
    // freigegeben. Deshalb wird hier auf die GENAUE Argumentliste geprueft
    // und nicht nur darauf, dass `p_sichtbar` stimmt.
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(true)

    expect(rpcAufrufe).toEqual([
      { fn: 'meine_sichtbarkeit_setzen', args: { p_sichtbar: true } },
    ])
    // Und kein Weg an der Funktion vorbei.
    expect(schreibvorgaenge.filter((v) => v.tabelle === 'community_profiles')).toEqual([])
    expect(store.getState().sichtbar).toBe(true)
  })

  it('laedt den Schalter ueber die Funktion und liest das ARRAY richtig', async () => {
    // `returns table` liefert ein Array mit null oder einer Zeile. Wer hier
    // `data.zusammenlauf_sichtbar` liest, macht aus einem gesetzten `true`
    // ein `undefined` - und der Schalter stuende faelschlich auf aus.
    //
    // Sollwert-Begruendung: Geprueft wird der Weg durch das Array hindurch,
    // nicht nur "irgendein true". Deshalb liefert der Nachbau eine ECHTE
    // Zeile in einem Array, so wie PostgREST es tut.
    rpcAntwort = { data: [{ zeigt_mir: [], sichtbar_fuer: [], zusammenlauf_sichtbar: true }], error: null }
    const store = await frisch()

    await store.getState().sichtbarkeitLaden()

    expect(rpcAufrufe.map((r) => r.fn)).toContain('meine_profil_einstellungen')
    expect(store.getState().sichtbar).toBe(true)
  })

  it('liest eine leere Menge als "Schalter aus", nicht als Fehler', async () => {
    // Wer noch kein Community-Profil hat, bekommt eine leere Menge. Das ist
    // eine Aussage - die Vorgaben aus 0049 gelten - und kein Fehler.
    rpcAntwort = { data: [], error: null }
    const store = await frisch()

    await store.getState().sichtbarkeitLaden()

    expect(store.getState().sichtbar).toBe(false)
    expect(store.getState().fehler).toBeNull()
  })

  it('begleitet das Einschalten mit einer Einwilligungszeile - erst der Nachweis, dann die Wirkung', async () => {
    // Der Schalter allein ist nach dem Massstab von 0034 kein Nachweis.
    // Reihenfolge ist Absicht: Scheitert die Einwilligung, wird NICHT
    // eingeschaltet - eine Wirkung ohne Nachweis darf nicht entstehen.
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(true)

    expect(einwilligungen).toEqual([{ art: 'erteilt', zweck: ['zusammenlauf'] }])
    expect(rpcAufrufe.map((r) => r.fn)).toContain('meine_sichtbarkeit_setzen')
  })

  it('schaltet nicht ein, wenn die Einwilligung nicht zustande kommt', async () => {
    erteilenAntwort = 'Kein Wortlaut fuer "zusammenlauf" hinterlegt'
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(true)

    // Nichts geschrieben - weder ueber die Tabelle noch ueber die Funktion.
    expect(rpcAufrufe.map((r) => r.fn)).not.toContain('meine_sichtbarkeit_setzen')
    expect(schreibvorgaenge.filter((v) => v.art === 'upsert')).toEqual([])
    expect(store.getState().sichtbar).not.toBe(true)
    expect(store.getState().fehler).toContain('Wortlaut')
  })

  it('begleitet das Ausschalten mit einem Widerruf - erst die Wirkung, dann der Nachweis', async () => {
    // Andersherum als beim Einschalten: Der Schutz (nicht mehr vorgeschlagen
    // werden) darf nicht daran haengen, ob die Widerrufszeile ankommt.
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(false)

    expect(rpcAufrufe).toContainEqual({
      fn: 'meine_sichtbarkeit_setzen',
      args: { p_sichtbar: false },
    })
    expect(einwilligungen).toEqual([{ art: 'widerrufen', zweck: 'zusammenlauf' }])
  })

  it('meldet einen gescheiterten Widerruf, statt ihn zu verschlucken', async () => {
    // Gefunden vom Pruefagenten, 23.08.2026: Der Rueckgabewert von
    // `widerrufen` wurde verworfen. Scheitert er (kein Netz), steht der
    // Schalter auf AUS, waehrend die juengste Einwilligungszeile weiter
    // "erteilt" sagt - und es gibt keinen zweiten Versuch, weil man zum
    // Ausschalten nur ueber `sichtbar === true` kommt.
    //
    // Das ist der Nachweis nach Art. 7 DSGVO, den 0053 gerade erst
    // eingefuehrt hat. Er darf nicht das Gegenteil der Wahrheit sagen.
    widerrufenAntwort = 'kein Netz'
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(false)

    expect(store.getState().fehler).toContain('kein Netz')
  })

  it('wiederholt einen misslungenen Widerruf, ohne neu einzuwilligen', async () => {
    // Gefunden vom Pruefagenten, 23.08.2026, als Folgebefund der ersten
    // Behebung: Der Text sagte "einmal wieder ein- und ausschalten". Das ist
    // begehbar - aber `erteilen` legt eine NEUE unveraenderliche
    // "erteilt"-Zeile an. Das Verzeichnis liest danach
    //   erteilt(t0) -> erteilt(t1) -> widerrufen(t2)
    // und behauptet damit durchgehende Einwilligung von t0 bis t2. Der
    // Zeitraum, in dem die Person tatsaechlich widerrufen hatte, kommt nie
    // vor. Der angebotene Weg reparierte den Nachweis also nicht, er
    // ueberdeckte ihn.
    //
    // Ausschalten auf einem bereits ausgeschalteten Schalter heisst deshalb:
    // nur den Widerruf noch einmal versuchen.
    widerrufenAntwort = 'kein Netz'
    const store = await frisch()
    await store.getState().sichtbarkeitSetzen(false)
    expect(store.getState().fehler).toContain('kein Netz')

    einwilligungen = []
    schreibvorgaenge = []
    widerrufenAntwort = null

    await store.getState().sichtbarkeitSetzen(false)

    expect(einwilligungen).toEqual([{ art: 'widerrufen', zweck: 'zusammenlauf' }])
    // KEINE neue Einwilligungszeile - die waere der eigentliche Schaden.
    expect(einwilligungen.some((e) => e.art === 'erteilt')).toBe(false)

    // Das Profil wird SEHR WOHL geschrieben - hier stand vorher das
    // Gegenteil, und das war der Fehler.
    //
    // `sichtbar === false` heisst nur, dass der Store das glaubt. Ging beim
    // Einschalten die Antwort auf den `upsert` verloren (Verbindungsabbruch
    // nach dem Senden), steht die Datenbank auf `true`, waehrend der Store
    // zurueckgedreht hat. Die Wiederholung muss dann beides richtigstellen -
    // sonst wird die Person weiter als Laufpartner vorgeschlagen, obwohl
    // Schalter und Einwilligungsverzeichnis "aus" sagen.
    expect(rpcAufrufe).toContainEqual({
      fn: 'meine_sichtbarkeit_setzen',
      args: { p_sichtbar: false },
    })
    expect(store.getState().fehler).toBeNull()
  })

  it('raeumt einen alten Fehler auf, bevor es schaltet', async () => {
    // Sonst urteilen drei Aufrufstellen nach einem fremden Fehler: Das
    // Einwilligungsblatt bleibt offen und der Mensch tippt erneut - jedes
    // Mal eine weitere unveraenderliche "erteilt"-Zeile.
    const store = await frisch()
    store.setState({ fehler: 'ein alter Fehler von woanders' } as never)

    await store.getState().sichtbarkeitSetzen(true)

    expect(store.getState().fehler).toBeNull()
  })

  it('meldet einen Fehler beim Laden der Sichtbarkeit, statt AUS zu raten', async () => {
    // Der Store dokumentiert null als "noch nicht geladen". Ein
    // Netzfehler wurde daraus bisher `false` - und ein Schalter, der raet,
    // luegt (so steht es in Profile.tsx).
    // Seit 0056 laeuft das Laden ueber die Funktion, nicht ueber die
    // Tabelle - der Fehler kommt jetzt von dort. Die Zusicherung ist
    // unveraendert: `sichtbar` bleibt null ("noch nicht geladen"), und der
    // Grund steht in `fehler`.
    rpcAntwort = { data: null, error: { message: 'keine Rechte' } }
    const store = await frisch()

    await store.getState().sichtbarkeitLaden()

    expect(store.getState().sichtbar).toBeNull()
    expect(store.getState().fehler).toContain('keine Rechte')
  })

  it('zaehlt fuer die Glocke nur offene Anfragen AN mich', async () => {
    // Regressionsnagel, nicht rot-gruen gefahren: Die Funktion ist eine
    // Zeile Filter. Festgehalten wird die Richtung - eigene ausgehende
    // Anfragen und beantwortete zaehlen nicht.
    const { offeneAnMich } = await import('./zusammenlauf')
    const anfragen = [
      { id: '1', von_id: 'x', an_id: ICH, stand: 'offen', created_at: '', beantwortet_am: null },
      { id: '2', von_id: ICH, an_id: 'x', stand: 'offen', created_at: '', beantwortet_am: null },
      { id: '3', von_id: 'y', an_id: ICH, stand: 'angenommen', created_at: '', beantwortet_am: null },
    ] as never
    expect(offeneAnMich(anfragen, ICH)).toBe(1)
    expect(offeneAnMich(anfragen, null)).toBe(0)
  })
})
