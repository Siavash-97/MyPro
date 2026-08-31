import { describe, it, expect } from 'vitest'
import { istDoppelt, menschenlesbar } from './supabaseFehler'

describe('istDoppelt', () => {
  it('erkennt den Verstoss gegen eine Eindeutigkeit am Code', () => {
    expect(istDoppelt({ code: '23505', message: 'irgendwas' })).toBe(true)
  })

  it('geht NICHT nach dem englischen Wortlaut', () => {
    // Bis zum 22.08.2026 stand in chats.ts
    // `error.message.includes('duplicate')`. Aendert Supabase Wortlaut oder
    // Sprache, kippt so eine Pruefung lautlos ins Gegenteil: Sie meldet
    // einen Fehler, wo keiner ist - hier: eine zweite Zusage.
    expect(istDoppelt({ code: '42501', message: 'duplicate key value' })).toBe(false)
  })

  it('sagt nein, wenn gar kein Fehler da ist', () => {
    expect(istDoppelt(null)).toBe(false)
  })
})

/**
 * Was ein Mensch zu sehen bekommt.
 *
 * Auflage 3 des Agenten `sicherheit`, 31.08.2026: Mit der
 * geraetevergebenen Lauf-Kennung entstehen 23505 und 42501 im
 * Normalbetrieb. Beide sind fuer die Fehlersuche wertvoll und fuer den
 * Laufenden wertlos - und 42501 sagt einem Angreifer zusaetzlich, dass es
 * die geratene Kennung gibt.
 */
describe('menschenlesbar', () => {
  it('schweigt ueber Rechte und Doppelte', () => {
    expect(menschenlesbar({ code: '42501', message: 'permission denied for table runs' })).toBe(
      'Das hat nicht geklappt. Versuch es spaeter noch einmal.',
    )
    expect(menschenlesbar({ code: '23505', message: 'duplicate key value' })).toBe(
      'Das hat nicht geklappt. Versuch es spaeter noch einmal.',
    )
  })

  it('reicht alles andere weiter', () => {
    // Kein Maulkorb fuer echte Auskuenfte: "kein Netz" muss ankommen,
    // sonst sucht jemand den Fehler bei sich.
    expect(menschenlesbar({ code: '08006', message: 'connection failure' })).toBe(
      'connection failure',
    )
    expect(menschenlesbar(null)).toBeNull()
  })

  it('nimmt einen eigenen Rueckfalltext an', () => {
    expect(menschenlesbar({ code: '42501', message: 'x' }, 'Eigener Satz.')).toBe('Eigener Satz.')
  })
})
