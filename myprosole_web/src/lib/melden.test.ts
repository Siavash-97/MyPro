import { describe, expect, it, vi } from 'vitest'

// Die Fachlogik haengt nicht an der Datenbank, das Modul aber schon: Es
// legt beim Laden den Supabase-Zugang an, und der braucht Umgebungswerte,
// die es im Test nicht gibt. Ein Platzhalter genuegt - die Funktionen, um
// die es hier geht, ruehren ihn nicht an.
vi.mock('./supabase', () => ({ supabase: {} }))

const { freitextNoetig, gruendeFuer } = await import('./melden')

/**
 * Welche Gruende wo gelten.
 *
 * Nachgeholt: Beim Bau des Meldens am 21.08.2026 sind diese Tests
 * ausgefallen, obwohl die Standards sie fuer reine Berechnungen verlangen.
 * Der Abschlussbericht nennt die Luecke; hier wird sie geschlossen.
 */
describe('gruendeFuer', () => {
  const schluessel = (art: Parameters<typeof gruendeFuer>[0]) =>
    gruendeFuer(art).map((g) => g.schluessel)

  it('bietet bei Beitraegen die Gruende an, die nur fuer Inhalte gelten', () => {
    const b = schluessel('beitrag')
    expect(b).toContain('gewaltdarstellung')
    expect(b).toContain('terror')
    expect(b).toContain('nicht_jugendfrei')
  })

  it('bietet bei Menschen keine Inhaltsgruende an', () => {
    // Ein Mensch ist keine Gewaltdarstellung. Wer solche Gruende auch bei
    // Profilen zeigt, laesst jeden an Unpassendem vorbeilesen.
    const p = schluessel('profil')
    expect(p).not.toContain('gewaltdarstellung')
    expect(p).not.toContain('urheberrecht')
    expect(p).toContain('gefaelschtes_konto')
  })

  it('bietet bei Beitraegen kein gefaelschtes Konto an', () => {
    expect(schluessel('beitrag')).not.toContain('gefaelschtes_konto')
  })

  it('nennt die gemeinsamen Gruende in beiden Faellen', () => {
    for (const art of ['beitrag', 'profil'] as const) {
      const s = schluessel(art)
      expect(s).toContain('beschimpfung')
      expect(s).toContain('belaestigung')
      expect(s).toContain('gewalt')
      expect(s).toContain('spam')
    }
  })

  it('stellt "anderes" immer ans Ende', () => {
    // Sonst waere es die bequemste Antwort, und die Liste darueber liest
    // niemand mehr.
    for (const art of ['beitrag', 'kommentar', 'profil', 'support'] as const) {
      expect(schluessel(art).at(-1)).toBe('anderes')
    }
  })

  it('bietet beim Support nur den Freitext an', () => {
    // Wer sich an uns wendet, wendet sich nicht gegen jemanden.
    expect(schluessel('support')).toEqual(['anderes'])
  })

  it('behandelt Kommentare wie Beitraege', () => {
    expect(schluessel('kommentar')).toEqual(schluessel('beitrag'))
  })

  it('nennt keinen Grund zweimal', () => {
    for (const art of ['beitrag', 'kommentar', 'profil', 'support'] as const) {
      const s = schluessel(art)
      expect(new Set(s).size).toBe(s.length)
    }
  })
})

describe('freitextNoetig', () => {
  it('verlangt eine Erklaerung nur bei "anderes"', () => {
    expect(freitextNoetig('anderes')).toBe(true)
    expect(freitextNoetig('spam')).toBe(false)
    expect(freitextNoetig('gewalt')).toBe(false)
  })
})
