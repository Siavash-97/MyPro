import { describe, it, expect } from 'vitest'
import gehtest from './__fixtures__/gehtest-2026-08-23.json'
import { laufBilanz } from './laufBilanz'
import { kennzahlenAusPunkten } from './haengenderLauf'
import { istSpeicherwuerdig } from './speicherwuerdig'
import type { Urteil } from './segmenturteil'

/**
 * Der Gehtest vom 23.08.2026 - die erste Strecke mit externer Wahrheit.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Die Fixture lag seit dem Gehtest im Baum und **kein einziger Test las
 * sie**. Gefunden vom Agenten `pruefung` am selben Abend: Ein Suchlauf nach
 * `gehtest-2026-08-23` im ganzen `src` fand null Treffer, waehrend beide
 * Nachbardateien je von einem Test benutzt werden.
 *
 * Eine Messung, die nichts prueft, ist eine Notiz. Ihr Wert liegt genau
 * darin, dass sie von aussen kommt: Google Maps nennt fuer diesen Weg
 * **230 m**. Alles andere in diesem Projekt - Strava eingeschlossen - ist
 * eine zweite Schaetzung, keine Wahrheit.
 *
 * Was hier NICHT geprueft wird
 * ----------------------------
 * Genauigkeit im Sinne von "wir muessen naeher an 230 m herankommen". Das
 * Geraet hat nur L1-GNSS; die Abweichung ist hardwarebegrenzt und
 * ausdruecklich kein Arbeitsgegenstand. Geprueft wird, dass ein
 * **Rueckschritt** auffaellt: Wenn die Streckenrechnung morgen 92 % statt
 * 93 % liefert, ist das Rauschen - wenn sie 45 % liefert, ist etwas kaputt.
 * Genau dieser Fall ist am 22.08. schon einmal eingetreten.
 */

const WAHRHEIT_M = gehtest.wahrheit.google_maps_m
const punkte = gehtest.punkte as Array<{
  recorded_at: string
  latitude: number
  longitude: number
  urteil: Urteil | null
}>

describe('Gehtest 23.08.2026 gegen die Google-Maps-Referenz', () => {
  it('rechnet die Strecke im belegten Band um die Referenz', () => {
    const bilanz = laufBilanz(punkte)
    const anteil = (bilanz.streckeKm * 1000) / WAHRHEIT_M

    // Gemessen wurden 213 m von 230 m = 92,7 %. Das Band ist bewusst weit -
    // es soll einen BRUCH fangen, keine Schwankung. Die Untergrenze liegt
    // deutlich ueber den 49 %, die am 22.08. der halbierte Streckenwert
    // ergab, und ueber den 111,7 %, die Strava fuer denselben Weg meldete.
    expect(anteil).toBeGreaterThan(0.8)
    expect(anteil).toBeLessThan(1.05)
  })

  it('kommt der Referenz naeher als Strava', () => {
    // Nicht als Wettbewerb, sondern als Merkposten: Strava ist in diesem
    // Projekt keine Wahrheitsquelle. Fuer genau diesen Weg lag es mit 257 m
    // weiter daneben als wir mit 213 m - und markierte die eigene
    // Aufzeichnung anschliessend selbst als unglaubwuerdig.
    const unser = Math.abs(laufBilanz(punkte).streckeKm * 1000 - WAHRHEIT_M)
    const stravas = Math.abs(gehtest.strava.distanz_m - WAHRHEIT_M)
    expect(unser).toBeLessThan(stravas)
  })

  it('haelt die gespeicherten Urteile aus Migration 0051 fuer brauchbar', () => {
    // Der erste Datensatz mit echten gespeicherten Urteilen. 18 gezaehlt,
    // 1 halt, 1 null (der erste Punkt hat kein Vorgaengersegment).
    const gezaehlt = punkte.filter((p) => p.urteil === 'gezaehlt').length
    expect(gezaehlt).toBeGreaterThan(punkte.length * 0.7)
    // Kein Sprung: Auf 230 Metern zu Fuss darf keiner entstehen. Taete er
    // es, waere die Sprungschwelle zu eng - das ist der offene Punkt B13.
    expect(punkte.some((p) => p.urteil === 'sprung')).toBe(false)
  })

  it('wird von der Nachbergung genauso gerechnet wie auf dem Bildschirm', () => {
    // Der eigentliche Regressionswaechter: Genau dieser Lauf blieb beim
    // Speichern haengen (B18/B19/B20) und musste nachtraeglich abgeschlossen
    // werden. Die Nachbergung darf dabei nicht zu einer anderen Zahl kommen
    // als der Bildschirm - sonst haben wir wieder zwei Rechenwege.
    const knopfdruckMs = Date.parse(gehtest.wahrheit.knopfdruck)
    const k = kennzahlenAusPunkten(punkte, knopfdruckMs)

    expect(k).not.toBeNull()
    // Der Bildschirm zeigte 0,20 km (auf zwei Stellen gerundet).
    expect(k!.distance_km).toBeCloseTo(0.21, 2)
    // Und er war es wert, gespeichert zu werden - beide Wege sagen das
    // inzwischen mit derselben Funktion.
    expect(istSpeicherwuerdig(k!.distance_km, k!.duration_s)).toBe(true)
    // Das Ende ist die letzte Messung, nicht "jetzt".
    expect(k!.ended_at).toBe(new Date(punkte[punkte.length - 1].recorded_at).toISOString())
  })
})
