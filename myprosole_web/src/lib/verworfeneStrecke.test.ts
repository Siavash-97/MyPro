import { describe, it, expect } from 'vitest'
import { verworfeneStreckeText, MELDESCHWELLE_M } from './verworfeneStrecke'
import { laufBilanz, type Bilanzpunkt } from './laufBilanz'

/**
 * Die Zeile behauptet drei Dinge, und alle drei sind hier festgehalten:
 * eine Zahl in Kilometern, das Wort "mindestens" und einen Grund, den die
 * App tatsaechlich gemessen hat. Faellt eines davon weg, faellt ein Test.
 */
describe('verworfeneStreckeText', () => {
  it('schweigt bei drei verworfenen Metern', () => {
    // Drei Meter ohne Zeitabstand sind ein Sprung (segmenturteil.ts) und
    // trotzdem keine Meldung wert.
    expect(verworfeneStreckeText(3)).toBeNull()
  })

  it('nennt die Strecke in Kilometern und sagt, warum sie nicht dasteht', () => {
    expect(verworfeneStreckeText(1234)).toBe(
      'Gezählt wird nur Laufstrecke: mindestens 1,2 km waren schneller als Laufen.',
    )
  })

  it('sagt nie "0,0 km" - genau darum liegt die Schwelle bei 100 m', () => {
    expect(verworfeneStreckeText(MELDESCHWELLE_M - 1)).toBeNull()
    expect(verworfeneStreckeText(MELDESCHWELLE_M)).toBe(
      'Gezählt wird nur Laufstrecke: mindestens 0,1 km waren schneller als Laufen.',
    )
  })

  it('sagt "mindestens" - der groessere Verlust liegt vor dieser Rechnung', () => {
    // Kein Schoenheitswort: Die Bewegungserkennung verwirft Messungen,
    // bevor ein Punkt entsteht. Ohne "mindestens" behauptet die Zeile eine
    // Vollstaendigkeit, die sie nicht hat (1,73 km angekommen gegen
    // 3,54 km bei Strava, 22.08.2026).
    expect(verworfeneStreckeText(2000)).toContain('mindestens')
  })

  it('macht aus der Zahl kein Guthaben', () => {
    // ZWECK, nicht Wortlaut. Hier stand bis zum 28.08.2026
    // `toContain('verworfen')`. Das Anliegen war richtig, das Pruefmittel
    // nicht: Es hing an einem Wort, das aus einem ganz anderen Grund
    // weichen musste (Glossar, siehe naechster Test) - der Test waere
    // gefallen, ohne dass seine Zusicherung verletzt gewesen waere. Ein
    // Test, der beim Umbenennen rot wird, bewacht den Namen, nicht die
    // Aussage.
    //
    // Die Aussage: Ein stillliegendes Telefon erzeugt aus Rauschen 7,3 km
    // (docs/gps-genauigkeit.md). Wer daraus "7,3 km fehlen dir" macht,
    // schreibt dem Menschen Kilometer gut, die er nie gelaufen ist.
    const text = verworfeneStreckeText(7300) ?? ''

    // 1. Kein Verlustwort. Dieser negative Sollwert ist nicht bequem, er
    //    ist die Aussage selbst: Die App WEISS nicht, ob die Strecke aus
    //    Rauschen kam oder echt war (bahnfahrt.test.ts: 0,90 km waren
    //    echt, gegen die Gleisgeometrie geprueft). Jedes Verlustwort
    //    entscheidet eine Frage, die offen ist. Faellt diese Zeile, steht
    //    auf dem Bildschirm eine Behauptung ueber Kilometer, die in der
    //    Haelfte der Faelle falsch ist.
    expect(text).not.toMatch(/fehl|verloren|abgezogen|nicht (mit)?gezählt/i)

    // 2. Keine zweite Person. "dir"/"dein" macht aus einer Messgroesse
    //    einen Besitz - genau der Schritt, der aus 7,3 km Rauschen ein
    //    Guthaben machen wuerde, auch ganz ohne das Wort "fehlt".
    expect(text).not.toMatch(/\b(dir|dein\w*|Ihnen|Ihre\w*)\b/i)

    // 3. Der Grund steht VOR der Zahl - die positive Haelfte, und der
    //    Grund, warum 1. und 2. allein nicht reichen: "1,6 km: nur
    //    Laufstrecke zaehlt" enthaelt kein Verlustwort und liest sich
    //    trotzdem als Abzug, weil das Auge mit der Zahl anfaengt.
    //    Der Sollwert 10 trennt die beiden Bauarten sicher: Ein Satz, der
    //    mit der Zahl beginnt, hat 0; die kuerzeste je gebaute Vorspann-
    //    variante ("GPS sprang: ") hatte 12, die heutige 30.
    expect(text.search(/\d/)).toBeGreaterThan(10)
  })

  it('benutzt "verwerfen" nicht - das Wort gehoert dem Abbruch', () => {
    // docs/ubiquitous-language.md:107 vergibt **Verwerfen** bereits an
    // `punkteVerwerfen`: "Punkte wegwerfen, weil der Lauf abgebrochen
    // wurde". Auf dem Bildschirm steht es dreimal in genau dieser
    // Bedeutung (pages/LiveTracking.tsx): Knopf "Lauf verwerfen", Dialog
    // "Lauf verwerfen?", Meldung "Lauf verworfen.".
    //
    // Bis zum 28.08.2026 stand dasselbe Wort in DIESER Zeile fuer etwas
    // anderes: eine Anzeige-Entscheidung bei laufendem, nicht
    // abgebrochenem Lauf. Ein Wort, zwei Bedeutungen, beide dem Kunden
    // sichtbar - wer "verworfen" unter seiner Strecke las, kannte es aus
    // dem Abbruchdialog, wo es tatsaechlich "ist jetzt weg" heisst.
    //
    // Der negative Sollwert ist hier nicht bequem: Er ist die einzige
    // Stelle, an der ein spaeterer, arg loser Griff zum naheliegendsten
    // deutschen Wort auffaellt, bevor er auf dem Geraet landet.
    expect(verworfeneStreckeText(1600) ?? '').not.toMatch(/verwerf|verworfen/i)
  })

  it('nennt keinen Grund, den die App nicht gemessen hat', () => {
    // Gemessen ist der Sprung, nicht der Empfang. Laut
    // docs/gps-genauigkeit.md entsteht bei GUTEM Empfang sogar mehr
    // erfundene Strecke.
    expect(verworfeneStreckeText(1200) ?? '').not.toMatch(/Empfang|Signal|Tunnel/i)
  })

  it('schweigt bei fehlendem und unsinnigem Wert', () => {
    expect(verworfeneStreckeText(null)).toBeNull()
    expect(verworfeneStreckeText(undefined)).toBeNull()
    expect(verworfeneStreckeText(NaN)).toBeNull()
    expect(verworfeneStreckeText(-500)).toBeNull()
  })
})

/**
 * Die Zeile wird nicht aus einer Zahl gebaut, die jemand von Hand eintippt,
 * sondern aus `laufBilanz`. Dieser Test haelt fest, dass die beiden Teile
 * zusammenpassen - und dass ein sauberer Lauf schweigt.
 */
describe('verworfeneStreckeText an einer echten Bilanz', () => {
  /** Ein Punkt, verschoben um `gradOst` Laengengrad, `sekunden` spaeter. */
  function punkt(sekunden: number, gradOst: number): Bilanzpunkt {
    return {
      latitude: 50.9,
      longitude: 6.9 + gradOst,
      recorded_at: new Date(Date.UTC(2026, 7, 23, 6, 0, sekunden)).toISOString(),
    }
  }

  it('schweigt bei einem Lauf ohne Sprung', () => {
    // Rund 70 m in 30 s - laufbares Tempo, nichts zu verwerfen.
    const punkte = [punkt(0, 0), punkt(30, 0.001), punkt(60, 0.002)]
    const bilanz = laufBilanz(punkte)

    expect(bilanz.verworfeneStreckeM).toBe(0)
    expect(verworfeneStreckeText(bilanz.verworfeneStreckeM)).toBeNull()
  })

  it('meldet den Sprung eines Laufs, der einen hatte', () => {
    // 0,05 Grad Laenge sind rund 3,5 km - in 10 s unmoeglich, also Sprung.
    const punkte = [punkt(0, 0), punkt(10, 0.05)]
    const bilanz = laufBilanz(punkte)

    expect(bilanz.verworfeneStreckeM).toBeGreaterThan(MELDESCHWELLE_M)
    expect(verworfeneStreckeText(bilanz.verworfeneStreckeM)).toMatch(
      /^Gezählt wird nur Laufstrecke: mindestens \d+,\d km waren schneller als Laufen\.$/,
    )
  })
})
