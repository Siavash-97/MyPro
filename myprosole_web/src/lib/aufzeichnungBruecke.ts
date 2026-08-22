import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Der Draht zum Aufzeichnungsdienst auf dem Telefon.
 *
 * Warum es den Dienst gibt
 * ------------------------
 * Capacitor friert eine im Hintergrund liegende Seite nach fuenf Minuten
 * ein. Wer den Bildschirm ausschaltet und das Telefon einsteckt – also jeder
 * Laeufer – haette danach keine Aufzeichnung mehr. Der Dienst laeuft
 * ausserhalb der Seite weiter und schreibt selbst auf die Platte.
 *
 * Daraus die Arbeitsteilung, die diese Datei durchsetzt:
 *
 *   Der Dienst sammelt und speichert. Er ist die Wahrheit.
 *   JavaScript rechnet und zeigt an. Es ist die Anzeige.
 *
 * Warum die Punkte in zwei Schritten abgeholt werden
 * --------------------------------------------------
 * Erst holen, dann bestaetigen, dann loescht der Dienst. Ein Absturz
 * dazwischen kostet nichts: Die Punkte kommen beim naechsten Abholen erneut.
 * Doppelt ist harmlos, weg waere es nicht.
 */

/** Eine rohe Messung, wie der Dienst sie abgelegt hat. */
export interface DienstPunkt {
  /** Fortlaufende Kennung in der Datenbank des Dienstes. */
  id: number
  /** Millisekunden seit 1970. */
  zeit: number
  breite: number
  laenge: number
  genauigkeitM: number | null
  tempoMps: number | null
  /**
   * Die Guete der Geschwindigkeit selbst, in m/s – ab Android 8.
   *
   * Kein kostenloses Plugin reicht dieses Feld durch; das kostenpflichtige
   * wirbt damit. Weil wir den Dienst selbst gebaut haben, ist es da. Benutzt
   * wird es noch nicht: Die Bewegungserkennung filtert bisher nur nach der
   * Ortsgenauigkeit. Es zu speichern kostet nichts und macht den naechsten
   * Schritt moeglich.
   */
  tempoGueteMps: number | null
  hoeheM: number | null
}

/** Warum der Dienst nicht startet – damit die Seite es benennen kann. */
export type AufzeichnungHindernis = 'keine-erlaubnis' | 'gps-aus' | 'start-abgelehnt' | null

interface AufzeichnungPlugin {
  starten(o: { laufId: string }): Promise<{ gelungen: boolean; hindernis: AufzeichnungHindernis }>
  stoppen(): Promise<{ gelungen: boolean }>
  abholen(o: { laufId: string }): Promise<{ punkte: DienstPunkt[]; offen: number }>
  bestaetigen(o: { laufId: string; bisId: number }): Promise<{ geloescht: number; offen: number }>
  verwerfen(o: { laufId: string }): Promise<{ geloescht: number }>
  pausieren(o: { an: boolean }): Promise<{ gelungen: boolean }>
  stand(o: { laufId?: string }): Promise<DienstStand>
}

export interface DienstStand {
  /** Wie viele Punkte warten noch auf das Abholen. */
  offen: number
  erlaubt: boolean
  gpsAn: boolean
  pausiert: boolean
  /** Laeuft ueberhaupt eine Aufzeichnung? */
  laeuft: boolean
  /**
   * Welche Aufzeichnung der Dienst haelt - auch ohne dass man danach fragt.
   *
   * Bis zum 22.08.2026 gab er sie nie heraus. Die App hielt die Kennung nur
   * im Arbeitsspeicher; schoss Android sie ab, war sie weg, und die
   * gesammelten Punkte lagen unerreichbar im Dienstspeicher. Gemessen: 611
   * verwaiste Punkte und neun von sechzehn Laeufen auf "tracking".
   */
  laufId: string | null
  /** Wann kam die letzte Messung? Null heisst: gar keine. */
  letzterPunktMs: number | null
  /**
   * Hat jemand in der Benachrichtigung auf "Beenden" getippt?
   *
   * Einmalige Nachricht, kein Zustand: Der Dienst loescht sie beim Lesen.
   * Bliebe sie stehen, fragte die App nach jedem Oeffnen erneut nach - auch
   * wenn man laengst abgelehnt hat.
   */
  beendenGewuenscht: boolean
}

const plugin = registerPlugin<AufzeichnungPlugin>('Aufzeichnung')

/**
 * Laeuft die App auf einem Telefon?
 *
 * Im Browser gibt es den Dienst nicht. Das ist kein Mangel: Die Web-App wird
 * nicht mehr angeboten, der Browser dient nur noch der Entwicklung. Dort
 * bleibt die Aufzeichnung bei navigator.geolocation und hoert auf, sobald
 * der Tab in den Hintergrund geht – fuer die Arbeit an der Oberflaeche
 * genuegt das.
 */
export function aufTelefon(): boolean {
  return Capacitor.isNativePlatform()
}

export async function aufzeichnungStarten(
  laufId: string,
): Promise<AufzeichnungHindernis | 'kein-telefon'> {
  if (!aufTelefon()) return 'kein-telefon'
  try {
    const antwort = await plugin.starten({ laufId })
    return antwort.gelungen ? null : antwort.hindernis
  } catch {
    return 'start-abgelehnt'
  }
}

export async function aufzeichnungStoppen(): Promise<void> {
  if (!aufTelefon()) return
  try {
    await plugin.stoppen()
  } catch {
    // Schon gestoppt oder gar nicht gestartet – das Ergebnis ist dasselbe.
  }
}

export async function punkteAbholen(laufId: string): Promise<DienstPunkt[]> {
  if (!aufTelefon()) return []
  try {
    const antwort = await plugin.abholen({ laufId })
    return antwort.punkte ?? []
  } catch {
    return []
  }
}

export async function punkteBestaetigen(laufId: string, bisId: number): Promise<void> {
  if (!aufTelefon()) return
  try {
    await plugin.bestaetigen({ laufId, bisId })
  } catch {
    // Nicht bestaetigt heisst: beim naechsten Mal noch einmal. Harmlos.
  }
}

export async function punkteVerwerfen(laufId: string): Promise<void> {
  if (!aufTelefon()) return
  try {
    await plugin.verwerfen({ laufId })
  } catch {
    // Bleibt liegen und wird beim naechsten Verwerfen mitgenommen.
  }
}

/**
 * Pausieren oder fortsetzen.
 *
 * Der Dienst behaelt seine Punkte und laeuft weiter; nur der Empfaenger wird
 * abgemeldet. Die Zeitrechnung bleibt Sache der App.
 */
export async function aufzeichnungPausieren(an: boolean): Promise<void> {
  if (!aufTelefon()) return
  try {
    await plugin.pausieren({ an })
  } catch {
    // Der Dienst laeuft dann weiter und sammelt. Aergerlich fuer den Akku,
    // aber kein Datenverlust - und die App zeigt trotzdem "pausiert".
  }
}

export async function aufzeichnungStand(laufId?: string): Promise<DienstStand | null> {
  if (!aufTelefon()) return null
  try {
    return await plugin.stand({ laufId })
  } catch {
    return null
  }
}
