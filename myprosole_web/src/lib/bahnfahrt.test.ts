import { describe, it, expect } from 'vitest'
import fahrt from './__fixtures__/bahnfahrt-2026-08-24.json'
import { segmenturteil } from './segmenturteil'
import { haversineM } from './geo'
import { MIN_SEGMENT_M } from './bewegung'
// Aus dem Quelltext, NICHT nachgebaut: Zwei Zahlen fuer eine Regel laufen
// auseinander, und dann behauptet der Test weiter, das Tor sei gemessen.
import { MAX_ACCURACY_M } from '../store/run'

/**
 * Feldtest 24.08.2026: Strassenbahn Linie 1 und ein Fussweg.
 *
 * Warum dieser Datensatz zaehlt
 * -----------------------------
 * Er ist der erste, bei dem drei Zahlen unabhaengig voneinander vorliegen:
 * eine externe Referenz, Strava und die eigene App.
 *
 * Die Referenz ist die **Gleisgeometrie** aus der OSM-Relation der Linie
 * (ueber die OSM-API, 48 Wegstuecke knotenscharf aufgefaedelt, Laengen
 * geodaetisch): 4338 m zwischen den beiden Halten, dazu 179 m Fussweg.
 *
 *   Referenz            4518 m   100,0 %
 *   eigene App roh      4600 m   +1,8 %   (3700 angezeigt + 900 verworfen)
 *   Strava              4683 m   +3,7 %
 *   eigene App gezeigt  3700 m  -18,1 %
 *
 * Beide Apps ueberschaetzen leicht - das ist das richtige Vorzeichen:
 * GPS-Rauschen addiert Weglaenge, es zieht nie ab.
 *
 * ZWEI VERWORFENE REFERENZEN, damit sie niemand wieder aufnimmt: Der
 * Fussweg (4,40 km) und die Autostrecke (4,90 km) aus Google Maps sind
 * BEIDE falsch - der Fussweg ist eine andere Route, das Auto umfaehrt das
 * Ziel (550 m Umweg). Mit ihnen gerechnet kam die App auf 100 % bzw.
 * 91 %, und beide Male schien eine Erklaerung noetig, die es nicht gibt.
 *
 * Damit ist B13 belegt statt vermutet: Die 0,90 km, die als "GPS sprang"
 * verworfen wurden, sind **echte Strecke**. Die Grenze MAX_TEMPO_MPS
 * (12,5 m/s = 45 km/h) schneidet eine Strassenbahnfahrt mitten durch.
 *
 * Was dieser Test bewacht
 * -----------------------
 * NICHT die Genauigkeit - die ist beim L1-Empfaenger hardwarebegrenzt und
 * ausdruecklich kein Arbeitsgegenstand. Bewacht wird, dass ein RUECKSCHRITT
 * auffaellt: dass die Rechenkette denselben Fussweg morgen nicht ploetzlich
 * halbiert oder verdoppelt.
 *
 * Warum nur der Fussweg als Punktfolge dasteht
 * --------------------------------------------
 * Die Punkte wurden waehrend der Fahrt per ADB aus dem Dienstspeicher
 * mitgeschrieben. Der haelt nur rund zwanzig Sekunden - die App holt im
 * Sekundentakt ab, bestaetigt, und der Dienst loescht. Als die Mitschrift
 * begann, war der Bahnteil laengst in der Datenbank. Vom Bahnteil bleiben
 * deshalb nur die Kennzahlen.
 */

type P = {
  recorded_at: string
  latitude: number
  longitude: number
  accuracy_m: number
  tempo_guete_mps: number | null
  altitude_m: number | null
}
const punkte = fahrt.punkte as P[]

/** Das Speichertor der App: nur weit genug entfernte, genaue genug Punkte. */
function gespeicherte(p: P[]): P[] {
  const raus: P[] = []
  for (const x of p) {
    if (x.accuracy_m > MAX_ACCURACY_M) continue
    const l = raus[raus.length - 1]
    if (!l) { raus.push(x); continue }
    if (haversineM(l.latitude, l.longitude, x.latitude, x.longitude) >= MIN_SEGMENT_M) raus.push(x)
  }
  return raus
}

describe('Fussweg nach dem Ausstieg, 24.08.2026', () => {
  it('rechnet die Strecke im gemessenen Band', () => {
    const g = gespeicherte(punkte)
    let m = 0
    for (let i = 1; i < g.length; i++) {
      const s = (Date.parse(g[i].recorded_at) - Date.parse(g[i - 1].recorded_at)) / 1000
      m += segmenturteil(
        haversineM(g[i - 1].latitude, g[i - 1].longitude, g[i].latitude, g[i].longitude),
        s,
      ).streckeM
    }
    // Gemessen wurden 179 m. Das Band ist weit genug fuer Rundung und
    // Reihenfolgeeffekte, eng genug, um eine Halbierung zu fangen - genau
    // die stand am 22.08. im Verdacht.
    expect(m).toBeGreaterThan(160)
    expect(m).toBeLessThan(200)
  })

  it('loest zu Fuss NIE die Sprung-Grenze aus', () => {
    // Der Kern von B13: Die 45-km/h-Grenze ist ausschliesslich ein Zug- und
    // Radproblem. Beim Gehen darf sie nie greifen. Taete sie es, waere ein
    // Rechenfehler im Segmenturteil die naheliegendste Erklaerung.
    const g = gespeicherte(punkte)
    for (let i = 1; i < g.length; i++) {
      const s = (Date.parse(g[i].recorded_at) - Date.parse(g[i - 1].recorded_at)) / 1000
      const u = segmenturteil(
        haversineM(g[i - 1].latitude, g[i - 1].longitude, g[i].latitude, g[i].longitude),
        s,
      )
      expect(u.urteil).not.toBe('sprung')
    }
  })

  it('verliert durch das Speichertor fast nichts', () => {
    // 117 Rohpunkte im Sekundentakt gegen die Punkte nach dem 10-m-Tor:
    // gemessen 189 m roh gegen 179 m danach. Das Tor entfernt Rauschen, keine
    // Strecke - anders als am 22.08. befuerchtet.
    let roh = 0
    for (let i = 1; i < punkte.length; i++) {
      roh += haversineM(
        punkte[i - 1].latitude, punkte[i - 1].longitude,
        punkte[i].latitude, punkte[i].longitude,
      )
    }
    const g = gespeicherte(punkte)
    let getort = 0
    for (let i = 1; i < g.length; i++) {
      getort += haversineM(g[i - 1].latitude, g[i - 1].longitude, g[i].latitude, g[i].longitude)
    }
    expect(getort / roh).toBeGreaterThan(0.85)

    // Zusaetzlich ein ABSOLUTER Anker. Das Verhaeltnis allein waere blind
    // gegen einen Skalierungsfehler in `haversineM`: Zaehler und Nenner
    // laufen beide durch dieselbe Funktion, ein falscher Erdradius kuerzt
    // sich heraus. Gemessen wurden 189 m roh.
    expect(roh).toBeGreaterThan(170)
    expect(roh).toBeLessThan(210)
  })

})

/**
 * Diese zwei pruefen KEINEN Code, sondern die MESSDATEN.
 *
 * Der Unterschied ist wichtig genug fuer einen eigenen Block: Keine Mutation
 * im Quelltext kann sie toeten - eine Mutationsprobe hat das bestaetigt.
 * Was sie bewachen, ist die Fixture selbst: dass niemand sie glaettet,
 * kuerzt oder ein Feld leert und damit einen belegten Befund unsichtbar
 * macht.
 *
 * Als Tests in einem Tor, das "fertig" definiert, waeren sie ein
 * Sicherheitsgefuehl ohne Deckung. Als Datenwaechter sind sie richtig -
 * deshalb stehen sie hier und nicht oben. Gefunden vom Agenten `pruefung`,
 * 24.08.2026.
 */
describe('Die Messdaten selbst - kein Codetest', () => {
  it('belegt, dass die Hoehe unbrauchbar ist', () => {
    // Zwei Minuten flacher Altstadtweg. Das Ziel liegt laut amtlichem Modell (1-m-
    // Raster, amtlich) bei 46,9 m ueber NHN. Das Geraet meldet 103 bis 117 m.
    //
    // Nicht der Versatz ist der Befund - der waere eine Konstante und
    // korrigierbar (Ellipsoid statt Meereshoehe). Der Befund ist die SPANNE:
    // 14 m Rauschen bei 6,6 m Ortsgenauigkeit, auf ebener Strecke. Jede
    // Schwelle, die das daempft, loescht auch echte Anstiege - die drei
    // Etagen vom 22.08. hatten neun Meter und wurden als 0,0 gemessen.
    const h = punkte.map((p) => p.altitude_m).filter((x): x is number => x !== null)
    expect(h.length).toBeGreaterThan(100)
    const spanne = Math.max(...h) - Math.min(...h)
    expect(spanne).toBeGreaterThan(9)   // groesser als drei Etagen Treppenhaus
  })

  it('traegt die Guete der Tempoangabe - erstmals', () => {
    // Am 22.08. war `tempo_guete_mps` in allen 387 Punkten der Zugfahrt null;
    // das Feld kam erst spaeter dazu. Hier ist es belegt. Der Test haelt
    // fest, dass es nicht wieder verschwindet - TEMPO_GUETE_MAX haengt daran.
    const mitGuete = punkte.filter((p) => p.tempo_guete_mps !== null)
    expect(mitGuete.length).toBe(punkte.length)
  })
})
