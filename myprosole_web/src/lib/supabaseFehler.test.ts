import { describe, it, expect } from 'vitest'
import { istDoppelt } from './supabaseFehler'

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
