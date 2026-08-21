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
/**
 * Ab wann ist eine Schrittfolge Gehen und kein Wippen?
 *
 * Langsames Gehen liegt bei etwa 1,6 Schritten je Sekunde, Laufen bei 2,5
 * bis 3. Wer im Stehen das Gewicht verlagert, erzeugt einzelne Ereignisse,
 * aber keine Folge. Ein Schritt je Sekunde trennt beides sauber.
 */
export const SCHRITTE_BEWEGUNG_MIN = 1.0

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
  /**
   * Wie sicher sich der Empfaenger bei diesem Tempo ist, in m/s.
   *
   * Optional, weil aeltere Geraete sie nicht melden. Fehlt sie, gilt das
   * Tempo wie bisher.
   */
  gueteMps?: number | null
}

/**
 * Ab welcher Guete ist eine Tempoangabe wertlos?
 *
 * Gemessen am Testgeraet (Samsung A56) am 21.08.2026, im Stand:
 *
 *   Tempo 0,88 m/s bei Guete 2,31 -> irgendwo zwischen 0 und 3,2
 *   Tempo 0,75 m/s bei Guete 2,84 -> wertlos
 *   Tempo 0,00 m/s bei Guete 0,12 -> belastbar
 *
 * Ein Meter je Sekunde trennt beides deutlich. Er liegt zugleich ueber der
 * Bewegungsschwelle von 0,9 - eine Angabe, deren Unsicherheit groesser ist
 * als der Unterschied zwischen Stehen und Gehen, kann diesen Unterschied
 * nicht belegen.
 */
export const TEMPO_GUETE_MAX = 1.0

/**
 * Taugt das gemeldete Tempo dieser Messung als Beleg?
 *
 * Fehlende Guete heisst "unbekannt", nicht "schlecht": Sonst faellt die
 * Bewegungserkennung auf Geraeten ohne diese Angabe vollstaendig aus.
 */
function gemeldetesTempoBrauchbar(o: Ortung): boolean {
  const t = o.gemeldetesTempoMps
  if (t == null || !Number.isFinite(t) || t < 0) return false
  const g = o.gueteMps
  if (g == null || !Number.isFinite(g)) return true
  return g <= TEMPO_GUETE_MAX
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

/** Was ein einzelner Bewegungsschritt ergibt. */
export interface Bewegungsschritt {
  /** Tempo dieser Messung in m/s. */
  tempoMps: number
  /** Die Schwelle, die fuer diese Messung gilt. */
  tor: number
  /** Der fortgeschriebene Zustand. */
  bewegung: Bewegungszustand
  /** Sekunden, die zur Bewegungszeit zaehlen. */
  bewegungszeitZuwachsS: number
  /** Wurde eine Probe aufgenommen? Dann gehoert der Pegel gesichert. */
  ruhepegelErweitert: boolean
}

/**
 * Eine Messung, eine Reihenfolge.
 *
 * Die Folge - Tempo ermitteln, Ruhepegel bei Stillstand fuettern, Tor
 * berechnen, Bewegung fortschreiben, Bewegungszeit zuwachsen - stand bis zum
 * 21.08.2026 nirgends als Schnittstelle. Sie war im Speicher von Hand
 * zusammengesetzt und an einer zweiten Stelle nachgebaut. Zwei Kopien
 * derselben Regel koennen auseinanderlaufen, und genau das ist passiert.
 *
 * Warum der Ruhepegel hineingereicht und nicht zurueckgegeben wird
 * ---------------------------------------------------------------
 * Er ist veraenderlich; ihn zurueckzugeben taeuschte Unveraenderlichkeit vor.
 * Stattdessen sagt `ruhepegelErweitert`, ob sich etwas geaendert hat - der
 * Aufrufer weiss dann, dass er sichern muss, und muss nichts vergleichen.
 *
 * @param verlauf Die Messungen einschliesslich der neuen; die letzte ist die
 *                aktuelle.
 */
export function bewegungSchritt(
  zustand: Bewegungszustand,
  ruhepegel: Ruhepegel,
  verlauf: Ortung[],
  jetztMs: number,
): Bewegungsschritt {
  const ortung = verlauf[verlauf.length - 1]
  const vorherige = verlauf[verlauf.length - 2] ?? null

  const { mps: tempoMps, ausMessung } = tempoErmitteln(ortung, vorherige)

  // Nur echte Messungen im erkannten Stillstand. Eine gerechnete
  // Geschwindigkeit wuerde den Pegel mit genau dem Rauschen fuellen, gegen
  // das er schuetzen soll.
  const ruhepegelErweitert = ausMessung && stehtStill(verlauf, jetztMs)
  if (ruhepegelErweitert) ruhepegel.hinzufuegen(tempoMps)

  const tor = torMps(ruhepegel.wert())
  const bewegung = bewegungFortschreiben(zustand, ortung, tempoMps, tor)

  const lueckeS = vorherige ? (ortung.zeit - vorherige.zeit) / 1000 : 0
  return {
    tempoMps,
    tor,
    bewegung,
    bewegungszeitZuwachsS: bewegungszeitZuwachsS(
      bewegung.inBewegung,
      tempoMps,
      tor,
      lueckeS,
    ),
    ruhepegelErweitert,
  }
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

  /**
   * Eine Messung aus erkanntem Stillstand aufnehmen.
   *
   * Der Deckel ist der Kern dieser Klasse und keine Feinheit: Was nach
   * unserer eigenen Festlegung als Bewegung gilt, kann kein
   * Stillstandsrauschen sein. Kein Empfaenger rauscht mit Gehgeschwindigkeit.
   *
   * Ohne ihn konnte der Pegel Gehgeschwindigkeiten lernen und sein eigenes
   * Tor darueber heben - dann galt Gehen nie als Bewegung, und die App
   * zeichnete bei bestem Empfang nichts auf. Genau das ist am 21.08.2026 im
   * Feld passiert; das Tor stand bei 2,1 m/s.
   *
   * Der Deckel ist absichtlich BEWEGUNG_MPS und keine eigene Zahl: Zwei
   * Grenzen, die dasselbe meinen, laufen frueher oder spaeter auseinander.
   */
  hinzufuegen(tempoMps: number): void {
    if (!Number.isFinite(tempoMps) || tempoMps < 0) return
    if (tempoMps >= BEWEGUNG_MPS) return
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
  if (gemeldetesTempoBrauchbar(ortung)) {
    return { mps: ortung.gemeldetesTempoMps as number, ausMessung: true }
  }

  // Gemeldet, aber die Guete taugt nichts. Dann NICHT aus den Positionen
  // rechnen: Wo der Empfaenger sein eigenes Tempo nicht kennt, ist auch die
  // Position unruhig, und eine gerechnete Geschwindigkeit waere dasselbe
  // Rauschen in anderer Verpackung - genau der Fehler vom 20.08.
  //
  // Null heisst hier "kein Beleg fuer Bewegung". Der Weg zurueck in die
  // Bewegung fuehrt dann ueber den Mindestabstand zum Haltepunkt, und der
  // haelt Rauschen aus.
  if (ortung.gemeldetesTempoMps != null) return { mps: 0, ausMessung: false }

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

/**
 * So weit zurueck reicht "jetzt".
 *
 * Fuenf Sekunden sind der Ausgleich zwischen zwei Fehlern: Zu kurz, und die
 * Anzeige zappelt bei jedem Empfangsausschlag. Zu lang, und sie haengt dem
 * Laeufer hinterher - genau der Fehler, der am 21.08.2026 aufgefallen ist.
 */
export const TEMPO_FENSTER_MS = 5_000

/** Aelter als das, und wir behaupten lieber nichts. */
const TEMPO_HOECHSTALTER_MS = 8_000

/**
 * Das Tempo im Moment, in Metern je Sekunde.
 *
 * Warum es das ueberhaupt gibt
 * ----------------------------
 * Eine Zahl kann nicht zugleich schnell und ruhig sein. Der Schnitt eines
 * Laufs muss ruhig sein - er wuerde sonst bei jeder Ampel springen. Das
 * Tempo jetzt muss schnell sein - es ist sonst wertlos. Deshalb zwei
 * Groessen und nicht eine.
 *
 * Warum der Median und kein Mittelwert
 * ------------------------------------
 * Ein einzelner Ausschlag auf 12 m/s ist Empfangsrauschen und kein Sprint.
 * Einen Mittelwert reisst er mit, den Median nicht: Der Median fragt nicht,
 * wie gross ein Wert ist, sondern nur, wie viele darueber und darunter
 * liegen.
 *
 * Woher der Wert kommt
 * --------------------
 * Bevorzugt vom Empfaenger selbst (`gemeldetesTempoMps`, aus der
 * Frequenzverschiebung). Das ist genauer als jede Rechnung aus zwei Orten,
 * weil es nicht zwei Positionsfehler addiert. Meldet das Geraet nichts, wird
 * aus dem Ortswechsel gerechnet.
 *
 * Was diese Funktion NICHT tut
 * ----------------------------
 * Sie entscheidet nicht, ob jemand laeuft. Das macht `bewegungFortschreiben`
 * mit deutlich strengeren Regeln - denn eine kurz falsch angezeigte Zahl
 * kostet nichts, eine falsch gezaehlte Strecke ruiniert den Lauf.
 *
 * @returns Tempo in m/s, 0 bei Stillstand, oder null wenn es zu wenige oder
 *          zu alte Messungen gibt.
 */
export function tempoJetztMps(verlauf: Ortung[], jetztMs: number): number | null {
  const letzte = verlauf[verlauf.length - 1]
  if (!letzte) return null
  if (jetztMs - letzte.zeit > TEMPO_HOECHSTALTER_MS) return null

  const werte: number[] = []
  for (let i = 0; i < verlauf.length; i++) {
    const o = verlauf[i]
    if (jetztMs - o.zeit > TEMPO_FENSTER_MS) continue
    // Unbrauchbare Angaben werden uebergangen, nicht als Null gezaehlt: Eine
    // Null waere selbst eine Behauptung.
    if (o.gemeldetesTempoMps != null && !gemeldetesTempoBrauchbar(o)) continue
    const { mps } = tempoErmitteln(o, verlauf[i - 1] ?? null)
    if (Number.isFinite(mps)) werte.push(mps)
  }

  // Eine einzelne Messung ist kein Urteil, sondern ein Zufall.
  if (werte.length < 2) return null

  werte.sort((a, b) => a - b)
  const mitte = werte.length / 2
  return werte.length % 2 === 1
    ? werte[Math.floor(mitte)]
    : (werte[mitte - 1] + werte[mitte]) / 2
}

/**
 * Groesster Abstand zwischen zwei Messungen, der noch als Bewegung zaehlt.
 *
 * Nach einem laengeren Abriss weiss niemand, was dazwischen war.
 */
export const MAX_LUECKE_S = 15

/**
 * Wie viele Sekunden dieser Messabstand zur Bewegungszeit beitraegt.
 */
export function bewegungszeitZuwachsS(
  inBewegung: boolean,
  tempoMps: number,
  tor: number,
  lueckeS: number,
): number {
  if (!inBewegung) return 0
  if (tempoMps < tor) return 0
  if (lueckeS <= 0 || lueckeS > MAX_LUECKE_S) return 0
  return lueckeS
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
  schritteProSekunde: number | null = null,
): Bewegungszustand {
  // Zwei Zeugen, und sie sehen Verschiedenes: Das GPS sagt, ob sich der ORT
  // aendert, der Schrittsensor, ob sich die BEINE bewegen. In einer
  // Haeuserschlucht schweigt der erste und der zweite nicht.
  //
  // null heisst "kein Sensor oder keine Erlaubnis" und nicht "keine
  // Schritte". Dann zaehlt allein das GPS, genau wie bisher.
  const schritteSagenBewegung =
    schritteProSekunde !== null && schritteProSekunde >= SCHRITTE_BEWEGUNG_MIN

  if (tempoMps >= tor || schritteSagenBewegung) {
    if (zustand.inBewegung) {
      return { inBewegung: true, unterTorSeit: null, haltepunkt: null }
    }

    // Aus dem Stand heraus: Es braucht zusaetzlich echten Abstand - aber nur,
    // wenn das GPS der einzige Zeuge ist. Schritte sind der direktere Beweis:
    // Wer geht, hat sich bewegt, auch wenn der Empfaenger es noch nicht
    // gemerkt hat. Das spart beim Losgehen die zehn bis fuenfzig Meter.
    if (!schritteSagenBewegung && zustand.haltepunkt) {
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

  // Beide Zeugen schweigen.
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
