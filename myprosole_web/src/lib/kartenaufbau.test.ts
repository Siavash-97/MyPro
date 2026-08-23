import { describe, it, expect } from 'vitest'
import { kartenSchritt } from './kartenaufbau'

/**
 * Gemessen am 23.08.2026 an einem laufenden 26-Minuten-Lauf: Die Karte kam
 * nie, obwohl Stil (200), Vektorkachel (200), WebGL und das nachgeladene
 * Buendel alle in Ordnung waren.
 */
describe('kartenSchritt', () => {
  it('gibt nicht auf, solange die Seite nicht sichtbar ist', () => {
    // Der Nutzer startet die Aufzeichnung und steckt das Telefon ein. Eine
    // Frist, die dabei weiterlaeuft, misst nichts: requestAnimationFrame
    // steht still, das Netz ist gedrosselt, niemand sieht hin.
    const schritt = kartenSchritt({
      sichtbar: false,
      bereit: false,
      aufgebaut: true,
      gescheitert: false,
      seitScheiternMs: 0,
      verbrauchtMs: 999_000,
    })

    expect(schritt.art).toBe('ruhen')
  })
})

describe('kartenSchritt – Aufbau', () => {
  it('baut auf, sobald die Seite sichtbar wird und noch keine Karte steht', () => {
    // Genau der Fall vom 23.08.2026: Der Aufbau haengt an einem
    // requestAnimationFrame. Bei ausgeschaltetem Bildschirm kommt nie ein
    // Einzelbild, also entsteht nie eine Karte. Beim Aufwachen muss der
    // Aufbau nachgeholt werden.
    const schritt = kartenSchritt({
      sichtbar: true,
      bereit: false,
      aufgebaut: false,
      gescheitert: false,
      seitScheiternMs: 0,
      verbrauchtMs: 0,
    })

    expect(schritt.art).toBe('aufbauen')
  })
})

describe('kartenSchritt – Frist', () => {
  it('wartet mit der uebrigen Frist, solange die Karte noch laedt', () => {
    const schritt = kartenSchritt({
      sichtbar: true,
      bereit: false,
      aufgebaut: true,
      gescheitert: false,
      seitScheiternMs: 0,
      verbrauchtMs: 5_000,
    })

    // 20 s Frist, 5 s davon verbraucht.
    expect(schritt).toEqual({ art: 'warten', restMs: 15_000 })
  })
})

describe('kartenSchritt – Aufgeben', () => {
  it('gibt auf, wenn die sichtbare Frist verbraucht ist', () => {
    const schritt = kartenSchritt({
      sichtbar: true,
      bereit: false,
      aufgebaut: true,
      gescheitert: false,
      seitScheiternMs: 0,
      verbrauchtMs: 20_000,
    })

    expect(schritt.art).toBe('aufgeben')
  })
})

describe('kartenSchritt – zweiter Versuch', () => {
  it('versucht es erneut, wenn die Seite nach dem Scheitern wieder sichtbar ist', () => {
    // Der Fehlerzustand war bis zum 23.08.2026 endgueltig: RouteMap setzte
    // kartenFehler auf true und nahm es nie zurueck. Ab da blieb die Karte
    // fuer den Rest des Laufs weg, auch wenn der Bildschirm wieder anging.
    const schritt = kartenSchritt({
      sichtbar: true,
      bereit: false,
      aufgebaut: false,
      gescheitert: true,
      seitScheiternMs: 30_000,
      verbrauchtMs: 20_000,
    })

    expect(schritt.art).toBe('aufbauen')
  })

  it('verwirft die alte Karte nicht doppelt: auch mit stehender Instanz wird neu aufgebaut', () => {
    const schritt = kartenSchritt({
      sichtbar: true,
      bereit: false,
      aufgebaut: true,
      gescheitert: true,
      seitScheiternMs: 30_000,
      verbrauchtMs: 20_000,
    })

    expect(schritt.art).toBe('aufbauen')
  })
})

describe('kartenSchritt – fertig', () => {
  it('ruht, sobald die Karte steht, egal wie lange es gedauert hat', () => {
    const schritt = kartenSchritt({
      sichtbar: true,
      bereit: true,
      aufgebaut: true,
      gescheitert: false,
      seitScheiternMs: 0,
      verbrauchtMs: 60_000,
    })

    expect(schritt.art).toBe('ruhen')
  })
})

describe('kartenSchritt – kein Haemmern', () => {
  it('legt nach einem sofortigen Fehler eine Pause ein, statt in einer Schleife neu zu bauen', () => {
    // Ein gesperrter Schluessel meldet den Fehler in Millisekunden. Ohne
    // Pause hiesse "gescheitert und sichtbar" sofort wieder "aufbauen" –
    // eine Endlosschleife aus Karteninstanzen und Anfragen.
    const schritt = kartenSchritt({
      sichtbar: true,
      bereit: false,
      aufgebaut: false,
      gescheitert: true,
      seitScheiternMs: 200,
      verbrauchtMs: 0,
    })

    expect(schritt).toEqual({ art: 'pause', inMs: 29_800 })
  })
})
