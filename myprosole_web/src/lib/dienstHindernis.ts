import type { AufzeichnungHindernis } from './aufzeichnungBruecke'

/**
 * Was ein Hindernis beim Start des Aufzeichnungsdienstes fuer den Laeufer
 * bedeutet.
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * `dienstHindernis` wurde seit jeher im Speicher gesetzt und von **keinem**
 * Bildschirm gelesen. Daneben stand im Quelltext „Die Oberflaeche sagt es
 * dann" - eine Zusicherung, die es nicht gab. Aufgefallen am 22.08.2026
 * durch eine Architektur-Analyse.
 *
 * Was auf dem Spiel steht: Ohne den Dienst laeuft die Aufzeichnung nur,
 * solange der Bildschirm an und die Seite im Vordergrund ist. Wer das
 * Telefon einsteckt und losgeht, zeichnet nichts auf - und erfaehrt es erst
 * hinterher an einem leeren Lauf.
 *
 * Warum hier uebersetzt wird und in `punkteSenden.ts` nicht
 * ----------------------------------------------------------
 * Das ist eine **geschlossene, bekannte Menge von drei Faellen**, die wir
 * selbst benannt haben. Jeder hat eine andere Folge fuer den Laeufer und
 * einen anderen naechsten Schritt. Ein Datenbankfehler ist das Gegenteil:
 * eine offene Menge fremder Meldungen, deren Uebersetzung nur raten koennte.
 *
 * Das ist die Trennlinie - nicht „Oberflaeche gegen Speicher", sondern
 * geschlossen gegen offen.
 */

export interface Hindernismeldung {
  /** Was los ist, in vier bis fuenf Woertern. */
  titel: string
  /** Was das fuer diesen Lauf heisst. Das Wichtigste. */
  folge: string
  /** Was der Laeufer dagegen tun kann - oder null, wenn nichts. */
  abhilfe: string | null
}

/**
 * Die Folge steht in jedem Fall vor der Ursache: Wer gerade loslaufen will,
 * muss zuerst wissen, dass er den Bildschirm anlassen muss - nicht, wie die
 * Android-Berechtigung heisst.
 */
const MELDUNGEN: Record<
  Exclude<AufzeichnungHindernis, null> | 'kein-telefon',
  Hindernismeldung | null
> = {
  'keine-erlaubnis': {
    titel: 'Standort im Hintergrund nicht erlaubt',
    folge:
      'Dieser Lauf wird nur aufgezeichnet, solange der Bildschirm an bleibt und die App offen ist.',
    abhilfe: 'In den Einstellungen den Standortzugriff auf „Immer erlauben" setzen.',
  },
  'gps-aus': {
    titel: 'GPS ist ausgeschaltet',
    folge:
      'Ohne GPS entsteht keine Strecke. Der Lauf läuft mit, aber ohne Kilometer und ohne Karte.',
    abhilfe: 'GPS in den Schnelleinstellungen einschalten.',
  },
  'start-abgelehnt': {
    titel: 'Hintergrunddienst konnte nicht starten',
    folge:
      'Dieser Lauf wird nur aufgezeichnet, solange der Bildschirm an bleibt und die App offen ist.',
    abhilfe: null,
  },
  // Kein Hindernis, sondern eine andere Umgebung. Im Browser gibt es keinen
  // Dienst und nichts zu melden.
  'kein-telefon': null,
}

export function hindernisMeldung(
  hindernis: AufzeichnungHindernis | 'kein-telefon' | null,
): Hindernismeldung | null {
  if (hindernis == null) return null
  return MELDUNGEN[hindernis]
}
