import { create } from 'zustand'
import {
  appEinstellungenOeffnen,
  schrittrechtAnfordern,
  schrittrechtStand,
} from '../lib/aufzeichnungBruecke'
import { schrittrechtAus, type Schrittrecht } from '../lib/schrittrecht'

/**
 * Der Zustand der Schrittzaehler-Berechtigung, an einer Stelle.
 *
 * Warum eine Ablage und nicht zwei Mal `useState`
 * ----------------------------------------------
 * Zwei Bildschirme zeigen denselben Zustand: der Laufbildschirm und
 * "Was dein Telefon kann". Wer ihn auf dem einen erteilt, muss ihn auf dem
 * anderen erteilt sehen - sonst steht dort weiter "darf noch nicht", und
 * genau dieser falsche Satz ist der Schaden, den messquellen.md Abschnitt 4
 * abwenden will.
 *
 * Warum die Fachlogik NICHT hier steht
 * ------------------------------------
 * Die Uebersetzung der Antwort und die Frage "darf der Lauf fragen?" sind
 * reine Funktionen in `lib/schrittrecht.ts` und dort geprueft. Hier steht
 * nur, wer wann fragt.
 */

/**
 * Haben wir auf diesem Geraet schon einmal den Systemdialog gezeigt?
 *
 * Auf dem Geraet, nicht am Konto: Die Berechtigung gehoert dem Telefon.
 * Dauerhaft, nicht nur fuer die Sitzung - sonst gibt der Laufbildschirm
 * nach jedem Neustart der App wieder einen der zwei Versuche aus, die
 * Android insgesamt zulaesst.
 *
 * Dasselbe Muster wie `myprosole_home_reminder_dismissed` in `Home.tsx`.
 */
const SCHLUESSEL_GEFRAGT = 'myprosole.schrittrecht.gefragt.v1'

function gefragtLaden(): boolean {
  try {
    return localStorage.getItem(SCHLUESSEL_GEFRAGT) === 'true'
  } catch {
    // Privater Modus, gesperrter Speicher: Dann lieber "noch nie gefragt"
    // annehmen. Der schlimmste Fall ist ein Angebot zu viel, nicht ein
    // verlorener Versuch.
    return false
  }
}

function gefragtMerken() {
  try {
    localStorage.setItem(SCHLUESSEL_GEFRAGT, 'true')
  } catch {
    // Nicht speicherbar heisst: naechstes Mal wieder anbieten. Aergerlich,
    // aber kein Schaden.
  }
}

interface SchrittrechtState {
  stand: Schrittrecht
  /** Laeuft gerade ein Systemdialog? Solange darf der Knopf nicht doppeln. */
  fragtGerade: boolean
  /** Wurde der Systemdialog auf diesem Geraet schon einmal gezeigt? */
  schonGefragt: boolean
  /** Nachsehen, ohne zu fragen. Loest keinen Dialog aus. */
  pruefen: () => Promise<void>
  /** Den Systemdialog zeigen. Nur aus einer Nutzerhandlung heraus. */
  anfordern: () => Promise<void>
  /** Die Systemeinstellungen oeffnen. Meldet, ob es ging. */
  einstellungenOeffnen: () => Promise<boolean>
}

export const useSchrittrecht = create<SchrittrechtState>((set) => ({
  stand: 'unbekannt',
  fragtGerade: false,
  schonGefragt: gefragtLaden(),

  pruefen: async () => {
    set({ stand: schrittrechtAus(await schrittrechtStand()) })
  },

  anfordern: async () => {
    set({ fragtGerade: true })
    // Der Merker faellt VOR dem Dialog, nicht danach: Wird die App
    // waehrend des Dialogs abgeschossen - Android haelt sie dabei an -,
    // waere der Versuch sonst verbraucht und wir wuessten es nicht.
    gefragtMerken()
    set({ schonGefragt: true })
    try {
      set({ stand: schrittrechtAus(await schrittrechtAnfordern()) })
    } finally {
      set({ fragtGerade: false })
    }
  },

  einstellungenOeffnen: () => appEinstellungenOeffnen(),
}))
