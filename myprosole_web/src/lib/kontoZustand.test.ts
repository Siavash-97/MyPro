import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Was beim Abmelden vom Konto uebrigbleibt.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Der Agent `pruefung` fand am 25.08.2026: `signOut` raeumt den Auth-Store
 * und (seit demselben Tag) den Anamnese-Stand. **Fuenfzehn weitere Speicher
 * bleiben stehen**, und `signOut` loest nirgends einen Neuladen der Seite
 * aus - `Profile.tsx` und `Anamnese.tsx` navigieren nur. Der Arbeitsspeicher
 * ueberlebt also den Kontowechsel.
 *
 * Darin unter anderem:
 *
 *   store/cycle.ts        Zyklusdaten            Art. 9 DSGVO
 *   store/diary.ts        `pain_locations`       Art. 9 DSGVO
 *   store/einwilligung.ts die Einwilligungen von A
 *   store/chats.ts        private Unterhaltungen
 *
 * Dazu vier localStorage-Schluessel, darunter A's E-Mail-Adresse
 * (`myprosole_pending_confirm_email`) und A's Lauf-Kennung
 * (`myprosole.laufMerker.v1` - `Startbergung.tsx` versucht damit beim
 * naechsten Kaltstart, A's Lauf unter B's Sitzung zu bergen).
 *
 * Praktisch ueberschreibt die naechste Abfrage das meiste. Aber bis dahin
 * sieht B die Daten von A, und fuer diese Zeitspanne gibt es keine Grenze.
 *
 * Warum eine Anmeldeliste und keine sechzehn Aufrufe
 * -------------------------------------------------
 * Sechzehn Aufrufe in `auth.ts` waeren die Liste, die beim siebzehnten
 * Speicher vergessen wird - genau die Bauart, an der dieses Projekt schon
 * dreimal gescheitert ist (0037, 0048, 0049: "keine neuen Zeilenrechte
 * noetig").
 *
 * Stattdessen meldet jeder kontogebundene Speicher sich selbst an. Das hat
 * eine Eigenschaft, die zaehlt: **Ein Speicher, der nie geladen wurde, hat
 * auch nichts zu vergessen** - er meldet sich nicht an, und das ist richtig
 * so, nicht ein Versehen.
 */

let vergessen: () => void
let anmelden: (fn: () => void) => void

function speicherErsatz(): Storage {
  const inhalt = new Map<string, string>()
  const api = {
    getItem: (k: string) => inhalt.get(k) ?? null,
    setItem: (k: string, v: string) => void inhalt.set(k, String(v)),
    removeItem: (k: string) => void inhalt.delete(k),
    clear: () => inhalt.clear(),
    key: (i: number) => [...inhalt.keys()][i] ?? null,
    get length() {
      return inhalt.size
    },
  }
  return new Proxy(api, {
    ownKeys: () => [...inhalt.keys()],
    getOwnPropertyDescriptor: (_z, name) =>
      inhalt.has(name as string)
        ? { value: inhalt.get(name as string), enumerable: true, configurable: true }
        : undefined,
    get: (ziel, name) =>
      name in ziel
        ? (ziel as Record<string | symbol, unknown>)[name]
        : inhalt.get(name as string),
  }) as unknown as Storage
}

beforeEach(async () => {
  vi.stubGlobal('localStorage', speicherErsatz())
  vi.resetModules()
  const modul = await import('./kontoZustand')
  vergessen = modul.kontoZustandVergessen
  anmelden = modul.beimAbmeldenVergessen
})

describe('speicherAnmelden', () => {
  it('setzt einen Speicher auf seinen Anfangszustand zurueck', async () => {
    const { speicherAnmelden } = await import('./kontoZustand')
    const zustand: Record<string, unknown> = { liste: [] as string[], zahl: 0, laden: () => {} }
    const store = {
      getState: () => zustand,
      setState: (teil: Record<string, unknown>) => Object.assign(zustand, teil),
    }
    speicherAnmelden(store)

    zustand.liste = ['a', 'b']
    zustand.zahl = 7
    vergessen()

    expect(zustand.liste).toEqual([])
    expect(zustand.zahl).toBe(0)
    // Die Aktionen bleiben - sonst waere der Speicher danach unbenutzbar.
    expect(typeof zustand.laden).toBe('function')
  })

  it('gibt bei jedem Zuruecksetzen FRISCHE Sammlungen', async () => {
    // Die Falle: Ein `new Map()` im Anfangszustand ist EIN Objekt. Wer es
    // beim Zuruecksetzen einfach wieder einsetzt, gibt dieselbe Map zurueck,
    // die das vorige Konto vollgeschrieben hat. Sie muss kopiert werden.
    const { speicherAnmelden } = await import('./kontoZustand')
    const zustand: Record<string, unknown> = { karte: new Map(), menge: new Set(), liste: [] }
    const store = {
      getState: () => zustand,
      setState: (teil: Record<string, unknown>) => Object.assign(zustand, teil),
    }
    speicherAnmelden(store)

    ;(zustand.karte as Map<string, string>).set('geheim', 'von A')
    ;(zustand.menge as Set<string>).add('von A')
    ;(zustand.liste as string[]).push('von A')
    vergessen()

    expect((zustand.karte as Map<string, string>).size).toBe(0)
    expect((zustand.menge as Set<string>).size).toBe(0)
    expect(zustand.liste).toEqual([])
  })
})

describe('kontoZustandVergessen', () => {
  it('ruft jeden angemeldeten Vergesser', () => {
    const gerufen: string[] = []
    anmelden(() => gerufen.push('a'))
    anmelden(() => gerufen.push('b'))

    vergessen()

    expect(gerufen).toEqual(['a', 'b'])
  })

  it('laesst einen fehlerhaften Vergesser die anderen nicht aufhalten', () => {
    // Der wichtigste Test der Datei. Bricht ein Speicher beim Zuruecksetzen,
    // darf das nicht dazu fuehren, dass die Zyklus- und Tagebuchdaten des
    // vorigen Kontos stehenbleiben.
    const gerufen: string[] = []
    anmelden(() => gerufen.push('vorher'))
    anmelden(() => {
      throw new Error('kaputt')
    })
    anmelden(() => gerufen.push('nachher'))

    expect(() => vergessen()).not.toThrow()
    expect(gerufen).toEqual(['vorher', 'nachher'])
  })

  it('loescht die Schluessel, die kein eigenes Modul besitzt', () => {
    localStorage.setItem('myprosole_pending_confirm_email', 'a@test.local')
    localStorage.setItem('myprosole_routine_erledigt', '2026-08-26')
    localStorage.setItem('myprosole_home_reminder_dismissed', 'true')

    vergessen()

    for (const k of [
      'myprosole_pending_confirm_email',
      'myprosole_routine_erledigt',
      'myprosole_home_reminder_dismissed',
    ]) {
      expect(localStorage.getItem(k)).toBeNull()
    }
  })

  it('ueberlaesst die uebrigen Schluessel dem Modul, dem sie gehoeren', async () => {
    // Der eigentliche Entwurf: `lib/chatGelesen.ts` und
    // `lib/anamneseEntwurf.ts` kennen ihr Schluesselformat selbst. Eine
    // Kopie des Praefixes HIER hoerte still auf zu greifen, sobald ihn
    // jemand drueben aendert - ein Schluessel gehoert dem, der ihn schreibt.
    //
    // Die Kehrseite, die dieser Test zugleich festhaelt: Ein Modul, das nie
    // geladen wurde, meldet sich nicht an. Das ist richtig - was nie geladen
    // wurde, hat auch nichts geschrieben.
    localStorage.setItem('myprosole_chat_gelesen_abc', '123')
    localStorage.setItem('myprosole_anamnese_entwurf_a', '{"antworten":{}}')

    vergessen()
    expect(localStorage.getItem('myprosole_chat_gelesen_abc')).toBe('123')

    // Jetzt die Besitzer laden - sie melden sich beim Import an.
    await import('./chatGelesen')
    await import('./anamneseEntwurf')

    vergessen()
    expect(localStorage.getItem('myprosole_chat_gelesen_abc')).toBeNull()
    expect(localStorage.getItem('myprosole_anamnese_entwurf_a')).toBeNull()
  })

  it('laesst Geraeteeinstellungen in Ruhe', () => {
    // Das Thema gehoert zum Geraet, nicht zum Konto. Wer sich abmeldet,
    // will nicht, dass die App wieder hell wird.
    localStorage.setItem('myprosole_theme', 'dunkel')
    localStorage.setItem('myprosole.ruhepegel.v1', '0.42')

    vergessen()

    expect(localStorage.getItem('myprosole_theme')).toBe('dunkel')
    expect(localStorage.getItem('myprosole.ruhepegel.v1')).toBe('0.42')
  })

  it('faengt einen gesperrten Speicher ab, statt das Abmelden anzuhalten', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('gesperrt')
      },
      removeItem: () => {
        throw new Error('gesperrt')
      },
      clear: () => {},
      key: () => null,
      length: 0,
    })
    const gerufen: string[] = []
    anmelden(() => gerufen.push('speicher'))

    expect(() => vergessen()).not.toThrow()
    expect(gerufen).toEqual(['speicher'])
  })
})
