import { haversineM } from './geo'

/**
 * Bewegt sich die Person gerade – oder steht sie nur da und das GPS wandert?
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Die App zeigte Geschwindigkeit, obwohl niemand gelaufen ist. Nachgerechnet
 * erzeugte ein stillliegendes Telefon in einer halben Stunde 7,3 Kilometer.
 * Der Grund: Strecke entstand aus dem Abstand zwischen zwei Messungen, und
 * dieser Abstand ist im Stand nicht null, sondern Rauschen.
 *
 * Eine Mindestdistanz je Messung hilft dagegen nur, solange sie groesser ist
 * als das Rauschen. Nachgerechnet mit der doppelten Schwelle: 7133 statt 7306
 * Metern – also so gut wie gar nicht.
 *
 * Was traegt, ist eine zweite, unabhaengige Quelle: die Geschwindigkeit, die
 * der Empfaenger selbst meldet. Sie entsteht aus der Frequenzverschiebung der
 * Satellitensignale (Doppler), nicht aus dem Vergleich zweier Positionen –
 * und weiss deshalb im Stand, dass gestanden wird.
 *
 * Alle Zahlen hier stehen mit ihrer Herkunft in docs/gps-genauigkeit.md,
 * Teil 3.
 */

/**
 * Ab hier gilt es als Bewegung: 0,9 m/s sind 3,2 km/h oder 18:38 min/km.
 *
 * Strava beschreibt seine Bewegungszeit ueber "anything faster than a
 * 30-minute mile pace" – das sind genau diese 0,894 m/s. Der Wert beschreibt
 * kein Rauschen, sondern die Festlegung, ab wann Bewegung als Bewegung
 * zaehlt. Deshalb ist er hier die Untergrenze: Ein gemessener Ruhepegel darf
 * das Tor anheben, nie senken.
 */
export const BEWEGUNG_MPS = 0.9

/**
 * So lange muss das Tempo unter dem Tor liegen, bevor "steht" gilt.
 *
 * Zehn Sekunden nennen Strava und OpenTracks unabhaengig voneinander.
 * Kuerzer waere empfindlicher gegen einen einzelnen schlechten Messwert;
 * laenger liesse mehr Rauschen als Strecke durch.
 *
 * Der Preis, offen benannt: Nach dem Stehenbleiben zaehlen die naechsten zehn
 * Sekunden noch als Bewegung.
 */
export const HALTEZEIT_MS = 10_000

/**
 * Fenster fuer die Nettoverschiebung – siehe stehtStill().
 */
export const NETTO_FENSTER_MS = 30_000

/**
 * Darunter gilt die Nettoverschiebung als Stillstand.
 *
 * Wer geht, legt in 30 Sekunden rund 40 Meter zurueck; 15 Meter sind also
 * reichlich Abstand nach unten und lassen zugleich Raum fuer Rauschen.
 */
export const NETTO_STILL_M = 15

/** Kuerzere Abstaende gelten nicht als Strecke (OpenTracks-Vorgabe). */
export const MIN_SEGMENT_M = 10

/**
 * Zuschlag auf den gemessenen Ruhepegel.
 *
 * Das 95. Perzentil laesst jede zwanzigste Ruhemessung darueber liegen; der
 * Zuschlag faengt diese ab. Selbst gewaehlt, nicht belegt.
 */
export const RUHE_ZUSCHLAG_MPS = 0.2

/** So viele Ruhemessungen braucht es, bevor der Pegel benutzt wird. */
export const RUHE_MIN_PROBEN = 60

/** So viele werden behalten. Aeltere fallen heraus, damit sich der Pegel an
 *  neue Umgebungen anpasst – unter freiem Himmel misst es sich anders als
 *  zwischen Haeusern. */
export const RUHE_MAX_PROBEN = 300

export interface Ortung {
  latitude: number
  longitude: number
  /** Zeitpunkt in Millisekunden. */
  zeit: number
  /** Gemeldete Ungenauigkeit in Metern, oder null. */
  genauigkeitM: number | null
  /** Vom Empfaenger gemeldetes Tempo in m/s, oder null wenn es keines liefert. */
  gemeldetesTempoMps: number | null
}

/** So viele Messungen werden an jedem Ende des Fensters gemittelt. */
const SCHWERPUNKT_PUNKTE = 5

/** Ohne so viele Messungen im Fenster wird nicht geurteilt. */
const NETTO_MIN_PUNKTE = 2 * SCHWERPUNKT_PUNKTE

function schwerpunkt(punkte: Ortung[]): { latitude: number; longitude: number } {
  const n = punkte.length
  return {
    latitude: punkte.reduce((summe, p) => summe + p.latitude, 0) / n,
    longitude: punkte.reduce((summe, p) => summe + p.longitude, 0) / n,
  }
}

/**
 * Wie weit ist die Person in den letzten Sekunden tatsaechlich gekommen?
 *
 * Nicht die Summe der Einzelabstaende, sondern der Abstand zwischen Anfang
 * und Ende des Fensters. Das ist der Trick:
 *
 *   Wer steht, kommt trotz wanderndem Rauschen nicht vom Fleck – die
 *   Nettoverschiebung bleibt klein, waehrend die Weglaenge beliebig waechst.
 *   Wer geht, ist nach 30 Sekunden rund 40 Meter weiter.
 *
 * Gemessen wird zwischen zwei **Schwerpunkten**, nicht zwischen zwei
 * einzelnen Messungen. Der Unterschied ist nicht kosmetisch: Bei 8 Metern
 * Streuung liegen zwei einzelne Messungen desselben ruhenden Punktes im
 * Mittel rund 14 Meter auseinander – die Schwelle von 15 Metern waere damit
 * eine Muenzwurf-Entscheidung gewesen. Der erste Testlauf hat genau das
 * gezeigt. Ein Mittel aus fuenf Messungen streut nur noch mit dem Bruchteil
 * eins durch Wurzel fuenf, also gut halb so weit.
 *
 * Dieses Mass ist gegen Drift unempfindlich, weil Rauschen um einen festen
 * Punkt streut, statt sich in eine Richtung fortzusetzen. Und es braucht
 * keine Geschwindigkeit – nur deshalb laesst sich damit der Ruhepegel
 * messen, ohne ihn schon zu kennen.
 *
 * Null, solange das Fenster noch nicht gefuellt ist.
 */
export function nettoVerschiebungM(verlauf: Ortung[], jetztMs: number): number | null {
  const fenster = verlauf.filter((o) => jetztMs - o.zeit <= NETTO_FENSTER_MS)
  if (fenster.length < NETTO_MIN_PUNKTE) return null

  // Das Fenster muss auch zeitlich voll sein. Sonst waere direkt nach dem
  // Start jeder Lauf ein Stillstand, weil in zwei Sekunden niemand weit
  // kommt.
  const spanne = fenster[fenster.length - 1].zeit - fenster[0].zeit
  if (spanne < NETTO_FENSTER_MS * 0.8) return null

  const anfang = schwerpunkt(fenster.slice(0, SCHWERPUNKT_PUNKTE))
  const ende = schwerpunkt(fenster.slice(-SCHWERPUNKT_PUNKTE))

  return haversineM(anfang.latitude, anfang.longitude, ende.latitude, ende.longitude)
}

/** Steht die Person, gemessen ohne jede Geschwindigkeitsangabe? */
export function stehtStill(verlauf: Ortung[], jetztMs: number): boolean {
  const netto = nettoVerschiebungM(verlauf, jetztMs)
  return netto !== null && netto < NETTO_STILL_M
}

/**
 * Der Ruhepegel dieses Geraets: Was meldet es als Tempo, wenn nichts passiert?
 *
 * Warum das gemessen und nicht eingetragen wird
 * ---------------------------------------------
 * Der Restfehler der Doppler-Messung im Stand ist geraeteabhaengig. Eine
 * Messreihe an Android-Telefonen fand beim einen Geraet Zentimeter pro
 * Sekunde, beim anderen bis 0,4 m/s – Faktor zehn zwischen zwei Telefonen
 * derselben Klasse. Jede fest eingetragene Zahl waere ein Kompromiss zwischen
 * zwei fremden Geraeten.
 *
 * Niemand kann von aussen wissen, wie ruhig ein bestimmtes Telefon unter
 * einem bestimmten Himmel ist. Also misst die App es selbst.
 */
export class Ruhepegel {
  private proben: number[]

  constructor(proben: number[] = []) {
    this.proben = proben.slice(-RUHE_MAX_PROBEN)
  }

  /** Eine Messung aus erkanntem Stillstand aufnehmen. */
  hinzufuegen(tempoMps: number): void {
    if (!Number.isFinite(tempoMps) || tempoMps < 0) return
    this.proben.push(tempoMps)
    if (this.proben.length > RUHE_MAX_PROBEN) {
      this.proben = this.proben.slice(-RUHE_MAX_PROBEN)
    }
  }

  /** 95. Perzentil, oder null solange zu wenige Messungen vorliegen. */
  wert(): number | null {
    if (this.proben.length < RUHE_MIN_PROBEN) return null
    const sortiert = [...this.proben].sort((a, b) => a - b)
    const stelle = Math.min(
      sortiert.length - 1,
      Math.floor(sortiert.length * 0.95),
    )
    return sortiert[stelle]
  }

  /** Zum Sichern auf dem Geraet. Der Wert gehoert zum Telefon, nicht zur
   *  Person – er verlaesst es nicht. */
  zumSichern(): number[] {
    return [...this.proben]
  }

  anzahl(): number {
    return this.proben.length
  }
}

/**
 * Ab welchem Tempo zaehlt es als Bewegung?
 *
 * Der gemessene Pegel darf das Tor nur anheben. Ein Geraet, das im Stand
 * saubere Nullen meldet, bekommt trotzdem die 0,9 m/s – denn die beschreiben
 * nicht Rauschen, sondern was als Bewegung gelten soll.
 */
export function torMps(ruhepegelMps: number | null): number {
  if (ruhepegelMps === null) return BEWEGUNG_MPS
  return Math.max(BEWEGUNG_MPS, ruhepegelMps + RUHE_ZUSCHLAG_MPS)
}

/**
 * Welches Tempo gilt für diese Messung?
 *
 * Zuerst das, was der Empfaenger meldet. Die Android-Doku sagt zu getSpeed()
 * selbst, es koenne genauer sein als Distanz durch Zeit, "such as if the
 * Doppler measurements from GNSS satellites are taken into account".
 * OpenTracks benutzt ausschliesslich diesen Wert, ganz ohne Rueckfall.
 *
 * Wir behalten den Rueckfall, weil nicht jedes Geraet und nicht jeder Browser
 * einen Wert liefert – dann ist Distanz durch Zeit besser als nichts.
 *
 * Abweichung von RunnerUp, ausdruecklich: Dort gilt ein gemeldetes Tempo von
 * exakt 0.0 als verdaechtig und loest den Rueckfall aus. Bei uns nicht. Eine
 * echte Null heisst "steht", und das ist genau die Auskunft, die wir suchen –
 * ausgerechnet dann auf die verrauschte Rechnung umzuschalten, hiesse das
 * Werkzeug wegzulegen, wenn man es braucht.
 */
export function tempoErmitteln(
  ortung: Ortung,
  vorherige: Ortung | null,
): { mps: number; ausMessung: boolean } {
  const gemeldet = ortung.gemeldetesTempoMps
  if (gemeldet !== null && Number.isFinite(gemeldet) && gemeldet >= 0) {
    return { mps: gemeldet, ausMessung: true }
  }

  if (!vorherige) return { mps: 0, ausMessung: false }

  const sekunden = (ortung.zeit - vorherige.zeit) / 1000
  if (sekunden <= 0) return { mps: 0, ausMessung: false }

  const meter = haversineM(
    vorherige.latitude,
    vorherige.longitude,
    ortung.latitude,
    ortung.longitude,
  )
  return { mps: meter / sekunden, ausMessung: false }
}

export interface Bewegungszustand {
  inBewegung: boolean
  /** Seit wann liegt das Tempo unter dem Tor? Null heisst: darueber. */
  unterTorSeit: number | null
  /** Wo wurde der Stillstand festgestellt? */
  haltepunkt: { latitude: number; longitude: number } | null
}

export const START_ZUSTAND: Bewegungszustand = {
  inBewegung: false,
  unterTorSeit: null,
  haltepunkt: null,
}

/**
 * Den Bewegungszustand um eine Messung fortschreiben.
 *
 * Zwei Regeln, die nicht symmetrisch sind – und das ist Absicht:
 *
 * Zum Stehen kommt man ueber die Zeit: Das Tempo muss HALTEZEIT_MS lang unter
 * dem Tor liegen. Ein einzelner schlechter Messwert soll den Lauf nicht
 * anhalten.
 *
 * Zum Laufen kommt man ueber Zeit UND Weg: Das Tempo muss ueber dem Tor
 * liegen und die Person muss sich vom Haltepunkt entfernt haben. Nur so
 * herum ist es dicht gegen Drift – im Stand schlaegt das gemeldete Tempo
 * gelegentlich nach oben aus, aber der Ort bleibt derselbe. Strava
 * beschreibt genau diese Kombination.
 *
 * Der noetige Abstand ist mindestens MIN_SEGMENT_M, bei schlechtem Empfang
 * aber die gemeldete Ungenauigkeit: Wer behauptet, sich fuenf Meter bewegt zu
 * haben, obwohl er seine Position nur auf dreissig Meter genau kennt,
 * behauptet mehr, als er weiss. Diese Kopplung an die Genauigkeit ist unsere
 * eigene Ueberlegung und steht in keiner der Vorlagen.
 */
export function bewegungFortschreiben(
  zustand: Bewegungszustand,
  ortung: Ortung,
  tempoMps: number,
  tor: number,
): Bewegungszustand {
  if (tempoMps >= tor) {
    if (zustand.inBewegung) {
      return { inBewegung: true, unterTorSeit: null, haltepunkt: null }
    }

    // Aus dem Stand heraus: Es braucht zusaetzlich echten Abstand.
    if (zustand.haltepunkt) {
      const noetig = Math.max(MIN_SEGMENT_M, ortung.genauigkeitM ?? 0)
      const weg = haversineM(
        zustand.haltepunkt.latitude,
        zustand.haltepunkt.longitude,
        ortung.latitude,
        ortung.longitude,
      )
      if (weg < noetig) return zustand
    }

    return { inBewegung: true, unterTorSeit: null, haltepunkt: null }
  }

  // Unter dem Tor.
  const seit = zustand.unterTorSeit ?? ortung.zeit
  if (ortung.zeit - seit >= HALTEZEIT_MS) {
    return {
      inBewegung: false,
      unterTorSeit: seit,
      // Der erste festgestellte Haltepunkt bleibt stehen. Ihn mitwandern zu
      // lassen waere selbst wieder ein Drift-Einfallstor: Nach langem Stehen
      // haette sich der Bezug unbemerkt verschoben, und der Weg zurueck zur
      // echten Position zaehlte als Aufbruch.
      //
      // Auch wenn hier schon "steht" galt, muss der Haltepunkt gesetzt
      // werden: Am Anfang eines Laufs steht man, ohne je gelaufen zu sein.
      // Ohne diesen Zweig gaebe es dort keinen Bezugspunkt, und ein
      // einzelner Rauschausschlag wuerde den Lauf starten.
      haltepunkt:
        zustand.haltepunkt ?? { latitude: ortung.latitude, longitude: ortung.longitude },
    }
  }

  return { ...zustand, unterTorSeit: seit }
}
