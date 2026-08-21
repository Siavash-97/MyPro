import { describe, expect, it } from 'vitest'
import { profilVollstaendigkeit } from './profilFragen'

/**
 * Die Fragen im Community-Profil.
 *
 * Aus docs/zusammenlauf-und-melden.md Abschnitt 3b. Zwei der acht Fragen gab
 * es schon (Laufjahre, Sportarten), sechs sind neu.
 *
 * Die Reihenfolge ist nicht beliebig: Das Dokument nennt die Wochenkilometer
 * "die haerteste Passungsgroesse". Wer nur eine Frage beantwortet, soll die
 * beantworten.
 */
describe('profilVollstaendigkeit', () => {
  it('nennt bei leerem Profil die Frage mit dem groessten Gewicht zuerst', () => {
    const v = profilVollstaendigkeit({})
    expect(v.anteil).toBe(0)
    expect(v.naechsteFrage?.schluessel).toBe('km_woche')
  })

  it('ist mit einer Antwort noch nicht fertig', () => {
    // Acht Fragen stehen im Dokument. Eine beantwortet heisst nicht
    // vollstaendig - und die naechste ist die Absicht.
    const v = profilVollstaendigkeit({ km_woche: 'bis_25' })
    expect(v.anteil).toBeLessThan(1)
    expect(v.naechsteFrage?.schluessel).toBe('lauf_grund')
  })

  it('gilt erst als vollstaendig, wenn alle acht Fragen beantwortet sind', () => {
    // Die Acht steht im Dokument, nicht im Quelltext - deshalb hier
    // ausgeschrieben und nicht aus FRAGEN.length abgeleitet.
    const alles = {
      km_woche: 'bis_25',
      lauf_grund: 'kopf_frei',
      lieber: 'beides',
      gelaende: 'wald',
      running_years: 3,
      sports: ['Radfahren'],
      im_verein: false,
      schoen_am_laufen: 'Die Stille am Morgen',
    }
    const voll = profilVollstaendigkeit(alles)
    expect(voll.anteil).toBe(1)
    expect(voll.naechsteFrage).toBeNull()

    // Eine weglassen genuegt, damit es nicht mehr vollstaendig ist.
    const { schoen_am_laufen: _weg, ...fastAlles } = alles
    expect(profilVollstaendigkeit(fastAlles).anteil).toBeLessThan(1)
  })

  it('nennt die Zahl der beantworteten Fragen, nicht nur den Anteil', () => {
    // Der Bildschirm zeigt "2 von 8 Fragen beantwortet". Waere die Zahl dort
    // gerechnet, stuende die Acht an zwei Stellen.
    const v = profilVollstaendigkeit({ km_woche: 'bis_25', lieber: 'beides' })
    expect(v.beantwortet).toBe(2)
    expect(v.gesamt).toBe(8)
  })

  it('zaehlt eine leere Antwort nicht als Antwort', () => {
    // Ein leeres Textfeld oder eine leere Liste ist keine Auskunft.
    expect(profilVollstaendigkeit({ km_woche: '   ' }).anteil).toBe(0)
    expect(profilVollstaendigkeit({ sports: [] }).anteil).toBe(0)
    // false ist dagegen eine Antwort: "nein, kein Verein".
    expect(profilVollstaendigkeit({ im_verein: false }).anteil).toBeGreaterThan(0)
  })
})
