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
const SCHLUESSEL = 'myprosole.ruhepegel.v1'

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
  } catch {
    // Voller Speicher im privaten Modus. Der Pegel gilt dann nur fuer diesen
    // Lauf – immer noch besser als keiner.
  }
}
