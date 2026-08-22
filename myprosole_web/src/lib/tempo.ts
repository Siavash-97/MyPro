/**
 * Wie schnell war ein Lauf im Schnitt?
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * Die Frage wurde in sieben Dateien unabhaengig voneinander beantwortet -
 * drei mit der Bewegungszeit, vier mit der Uhr. Derselbe Lauf zeigte auf der
 * Startseite ein anderes Tempo als auf seiner eigenen Detailseite.
 *
 * Am 22.08.2026 fiel es auf: 2,28 km, 509 s an der Uhr, rund 60 s an einer
 * Ampel gestanden. Die Splits standen bei 3:07 und 3:06, der Durchschnitt
 * darueber bei 3:43 - langsamer als jeder einzelne Kilometer desselben
 * Bildschirms.
 *
 * Die Regel steht ab jetzt hier und nur hier.
 */

/**
 * Unter dieser Strecke ist ein Tempo bedeutungslos: Auf 20 Metern macht eine
 * Sekunde Unterschied Minuten pro Kilometer aus.
 */
export const MIN_TEMPO_STRECKE_KM = 0.05

/**
 * Was ein Bildschirm ueber einen Lauf weiss - gespeichert oder gerade laufend.
 *
 * Alle Felder sind unsicher, weil die Aufrufer aus verschiedenen Quellen
 * kommen: die Datenbankzeile, der laufende Zustand, ein Bestandslauf von
 * vor der Bewegungszeit.
 */
export interface Tempogrundlage {
  streckeKm: number | null | undefined
  /** Der beim Speichern berechnete Schnitt. Hat Vorrang, wenn vorhanden. */
  gespeichertesTempoSJeKm?: number | null
  /** Was von der Laufzeit Bewegung war. */
  bewegungszeitS?: number | null
  /** Was die Uhr sagt, Pausen eingeschlossen. */
  gesamtzeitS?: number | null
}

/** Sekunden je Kilometer als `M:SS`. */
function alsText(sekundenJeKm: number): string {
  const min = Math.floor(sekundenJeKm / 60)
  const sek = Math.floor(sekundenJeKm % 60)
  return `${min}:${String(sek).padStart(2, '0')}`
}

/**
 * Der Durchschnitt als `M:SS`, oder `--:--` wenn er sich nicht sagen laesst.
 */
export function durchschnittstempoText(grundlage: Tempogrundlage): string {
  const { gespeichertesTempoSJeKm, streckeKm, bewegungszeitS, gesamtzeitS } = grundlage

  // Die Mindeststrecke gilt vor allem anderen, auch vor dem gespeicherten
  // Wert: Ein Schnitt ueber 20 Meter ist keine Aussage, egal wer ihn
  // ausgerechnet hat.
  if (streckeKm == null || !(streckeKm >= MIN_TEMPO_STRECKE_KM)) return '--:--'

  if (gespeichertesTempoSJeKm != null && gespeichertesTempoSJeKm > 0) {
    return alsText(gespeichertesTempoSJeKm)
  }

  // Die Bewegungszeit zuerst - sonst faelscht ein Halt an der Ampel das
  // Tempo des ganzen Laufs. Die Uhr ist der Rueckfall fuer Bestandslaeufe
  // von vor der Bewegungszeit: ein zu langsamer Wert ist besser als keiner.
  const zeitS = bewegungszeitS != null && bewegungszeitS > 0 ? bewegungszeitS : gesamtzeitS
  if (zeitS == null || !(zeitS > 0)) return '--:--'

  return alsText(zeitS / streckeKm)
}
