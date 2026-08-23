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
let selectAntwort: { data: unknown; error: { message: string } | null } = { data: [], error: null }

function kette(tabelle: string) {
  const k: Record<string, unknown> = {}
  const merken = (art: string) => (werte: unknown) => {
    schreibvorgaenge.push({ tabelle, art, werte })
    return k
  }
  k.insert = vi.fn((werte: unknown) => {
    schreibvorgaenge.push({ tabelle, art: 'insert', werte })
    return Promise.resolve(antwortFuer[tabelle] ?? { error: null })
  })
  k.update = vi.fn(merken('update'))
  k.upsert = vi.fn((werte: unknown) => {
    schreibvorgaenge.push({ tabelle, art: 'upsert', werte })
    return Promise.resolve(antwortFuer[tabelle] ?? { error: null })
  })
  k.eq = vi.fn((spalte: string, wert: unknown) => {
    schreibvorgaenge.push({ tabelle, art: 'eq', werte: { [spalte]: wert } })
    return Promise.resolve(antwortFuer[tabelle] ?? { error: null })
  })
  k.select = vi.fn(() => k)
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
        return null
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
    einwilligungen = []
    erteilenAntwort = null
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

  it('schreibt den Sichtbarkeitsschalter als upsert auf das eigene Profil', async () => {
    // Der Schalter in Profile.tsx war bewusst tot, solange er nicht
    // speicherte. Jetzt speichert er - auch fuer Menschen, die noch nie ein
    // Community-Profil angelegt haben: upsert, nicht update.
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(true)

    expect(schreibvorgaenge).toEqual([
      {
        tabelle: 'community_profiles',
        art: 'upsert',
        werte: { user_id: ICH, zusammenlauf_sichtbar: true },
      },
    ])
    expect(store.getState().sichtbar).toBe(true)
  })

  it('begleitet das Einschalten mit einer Einwilligungszeile - erst der Nachweis, dann die Wirkung', async () => {
    // Der Schalter allein ist nach dem Massstab von 0034 kein Nachweis.
    // Reihenfolge ist Absicht: Scheitert die Einwilligung, wird NICHT
    // eingeschaltet - eine Wirkung ohne Nachweis darf nicht entstehen.
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(true)

    expect(einwilligungen).toEqual([{ art: 'erteilt', zweck: ['zusammenlauf'] }])
    const upsert = schreibvorgaenge.find((v) => v.art === 'upsert')
    expect(upsert?.tabelle).toBe('community_profiles')
  })

  it('schaltet nicht ein, wenn die Einwilligung nicht zustande kommt', async () => {
    erteilenAntwort = 'Kein Wortlaut fuer "zusammenlauf" hinterlegt'
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(true)

    expect(schreibvorgaenge.filter((v) => v.art === 'upsert')).toEqual([])
    expect(store.getState().sichtbar).not.toBe(true)
    expect(store.getState().fehler).toContain('Wortlaut')
  })

  it('begleitet das Ausschalten mit einem Widerruf - erst die Wirkung, dann der Nachweis', async () => {
    // Andersherum als beim Einschalten: Der Schutz (nicht mehr vorgeschlagen
    // werden) darf nicht daran haengen, ob die Widerrufszeile ankommt.
    const store = await frisch()

    await store.getState().sichtbarkeitSetzen(false)

    const upsert = schreibvorgaenge.find((v) => v.art === 'upsert')
    expect((upsert?.werte as Record<string, unknown>).zusammenlauf_sichtbar).toBe(false)
    expect(einwilligungen).toEqual([{ art: 'widerrufen', zweck: 'zusammenlauf' }])
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
