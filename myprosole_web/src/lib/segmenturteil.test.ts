import { describe, it, expect } from 'vitest'
import { segmenturteil, istUrteil, BEWEGUNG_MPS, MAX_TEMPO_MPS, MAX_SEGMENT_M } from './segmenturteil'

/**
 * Ein Urteil je Segment - der Kern von B1.
 *
 * Vorher entschieden zwei Waechter getrennt: `istOrtungssprung` ueber die
 * STRECKE, `bewegungszeitAnteilS` ueber die ZEIT. Faellt ein Segment durch
 * den Zeitwaechter, blieb der Weg und die Zeit verschwand - das Tempo wurde
 * dadurch zu schnell.
 *
 * Jetzt faellt EIN Urteil, und Strecke und Zeit folgen ihm beide.
 */
describe('segmenturteil', () => {
  describe('Sprung - der Weg wurde nachweislich nicht gegangen', () => {
    it('nennt ein Segment ueber der Hoechstgeschwindigkeit einen Sprung', () => {
      // 200 m in 5 s sind 144 km/h.
      const u = segmenturteil(200, 5)
      expect(u.urteil).toBe('sprung')
      expect(u.streckeM).toBe(0)
      expect(u.zeitS).toBe(0)
    })

    it('nennt ein sehr langes Segment einen Sprung, auch bei langsamem Tempo', () => {
      // Tunnel, Neuortung: 600 m am Stueck sind keine gemessene Strecke,
      // egal wie lange es gedauert hat.
      expect(segmenturteil(MAX_SEGMENT_M + 1, 3600).urteil).toBe('sprung')
    })

    it('nennt ein Segment ohne Zeitabstand einen Sprung', () => {
      // Aus null Sekunden laesst sich kein Tempo bilden, und die Strecke
      // dazwischen ist nicht belegbar.
      expect(segmenturteil(20, 0).urteil).toBe('sprung')
    })

    it('nennt unsinnige Zahlen einen Sprung', () => {
      expect(segmenturteil(Number.NaN, 10).urteil).toBe('sprung')
      expect(segmenturteil(-5, 10).urteil).toBe('sprung')
      expect(segmenturteil(20, Number.NaN).urteil).toBe('sprung')
    })
  })

  describe('Gezaehlt - Strecke und Zeit zaehlen beide voll', () => {
    it('zaehlt ein Gehsegment voll, auch wenn die Luecke gross ist', () => {
      // DAS ist B1. 60 m in 40 s sind 1,5 m/s - normales Gehen. Vorher fiel
      // die ganze Zeit weg, weil 40 > MAX_LUECKE_S (15), und die 60 m
      // blieben stehen. Das Tempo wurde dadurch unendlich schnell.
      const u = segmenturteil(60, 40)
      expect(u.urteil).toBe('gezaehlt')
      expect(u.streckeM).toBe(60)
      expect(u.zeitS).toBe(40)
    })

    it('zaehlt genau auf der Bewegungsschwelle noch voll', () => {
      const strecke = BEWEGUNG_MPS * 10
      const u = segmenturteil(strecke, 10)
      expect(u.urteil).toBe('gezaehlt')
      expect(u.zeitS).toBe(10)
    })

    it('zaehlt knapp unter der Hoechstgeschwindigkeit noch voll', () => {
      const u = segmenturteil((MAX_TEMPO_MPS - 0.1) * 10, 10)
      expect(u.urteil).toBe('gezaehlt')
    })
  })

  describe('Halt - die Strecke bleibt, die Zeit bekommt ihre Untergrenze', () => {
    it('nennt ein langsames Segment einen Halt und behaelt die Strecke', () => {
      // Gemessen im Feld: 503 s ueber 28 m sind 0,2 km/h. Da wurde
      // gestanden - aber die 28 m sind zurueckgelegt worden.
      const u = segmenturteil(28, 503)
      expect(u.urteil).toBe('halt')
      expect(u.streckeM).toBe(28)
    })

    it('gibt einem Halt die Zeit, die der Weg mindestens gedauert haben muss', () => {
      // Keine Schaetzung, sondern eine Ableitung: Wer 28 m zurueckgelegt hat
      // und dabei nie schneller war als die Bewegungsschwelle, war dafuer
      // mindestens 28 / 0,9 Sekunden unterwegs.
      const u = segmenturteil(28, 503)
      expect(u.zeitS).toBeCloseTo(28 / BEWEGUNG_MPS, 5)
    })

    it('gibt einem Halt nie mehr Zeit, als die Luecke lang war', () => {
      // Die Untergrenze darf die Luecke nicht ueberschreiten - sonst
      // entstuende Bewegungszeit aus dem Nichts.
      const u = segmenturteil(1, 2)
      expect(u.zeitS).toBeLessThanOrEqual(2)
    })

    it('nennt ein Segment ohne jede Strecke einen Halt ohne Zeit', () => {
      const u = segmenturteil(0, 30)
      expect(u.urteil).toBe('halt')
      expect(u.zeitS).toBe(0)
      expect(u.streckeM).toBe(0)
    })
  })

  describe('istUrteil - der Waechter vor der Datenbank', () => {
    it('erkennt die drei gueltigen Urteile', () => {
      expect(istUrteil('gezaehlt')).toBe(true)
      expect(istUrteil('sprung')).toBe(true)
      expect(istUrteil('halt')).toBe(true)
    })

    it('weist alles andere ab', () => {
      // Der Grund ist kein Schoenheitssinn: Die Datenbank hat eine
      // Pruefbedingung auf dieser Spalte. Ein ungueltiger Wert laesst das
      // ganze Buendel mit 23514 scheitern, der Punkt bleibt im Puffer
      // liegen, und JEDE weitere Uebertragung scheitert am selben Punkt -
      // eine Blockade, die sich von selbst nicht mehr aufloest.
      expect(istUrteil('unsicher')).toBe(false)
      expect(istUrteil('')).toBe(false)
      expect(istUrteil(null)).toBe(false)
      expect(istUrteil(undefined)).toBe(false)
      expect(istUrteil(42)).toBe(false)
      expect(istUrteil({ urteil: 'halt' })).toBe(false)
    })
  })
})
