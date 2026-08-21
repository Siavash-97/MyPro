import { Ruhepegel } from './bewegung'

/**
 * Der gemessene Ruhepegel bleibt auf dem Geraet.
 *
 * Warum nicht in der Datenbank: Der Wert beschreibt das Telefon, nicht die
 * Person – wie ruhig sein Empfaenger im Stand meldet. Fuer die App ist er
 * ausserhalb dieses Geraets ohne Nutzen. Was nicht gespeichert wird, kann
 * nicht auslaufen; dieselbe Ueberlegung wie bei der IP-Adresse.
 *
 * Nebenbei traegt er auch keine Ortsangabe: Es sind reine
 * Geschwindigkeitswerte, keine Positionen.
 */
/**
 * v2 seit dem 21.08.2026.
 *
 * Die Fassung v1 konnte Gehgeschwindigkeiten als Stillstandsrauschen lernen -
 * auf dem Testgeraet standen Proben bis 1,86 m/s. Der Deckel in Ruhepegel
 * verhindert das kuenftig, aber bereits gespeicherte Proben blieben sonst
 * liegen und haetten die App auf betroffenen Geraeten weiter blind gehalten.
 *
 * Eine neue Zaehlung ist der einzige Weg, der ohne Wanderungsschritt
 * auskommt: v1 wird nicht gelesen, sondern beim naechsten Sichern entfernt.
 * Der Preis ist ein Lauf Einlernzeit.
 */
const SCHLUESSEL = 'myprosole.ruhepegel.v2'
const SCHLUESSEL_ALT = 'myprosole.ruhepegel.v1'

export function ruhepegelLaden(): Ruhepegel {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (!roh) return new Ruhepegel()
    const werte: unknown = JSON.parse(roh)
    if (!Array.isArray(werte)) return new Ruhepegel()
    return new Ruhepegel(werte.filter((w): w is number => typeof w === 'number'))
  } catch {
    // Kaputter oder gesperrter Speicher: Dann faengt die Messung eben von
    // vorn an. Ein Lauf darf daran nicht scheitern.
    return new Ruhepegel()
  }
}

export function ruhepegelSichern(pegel: Ruhepegel): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(pegel.zumSichern()))
    // Die alte Zaehlung wird nicht mehr gebraucht und soll nicht als
    // Altlast liegenbleiben.
    localStorage.removeItem(SCHLUESSEL_ALT)
  } catch {
    // Voller Speicher im privaten Modus. Der Pegel gilt dann nur fuer diesen
    // Lauf – immer noch besser als keiner.
  }
}
