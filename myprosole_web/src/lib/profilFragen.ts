/**
 * Die Fragen im Community-Profil.
 *
 * Sie sind der Rohstoff des Zuordnens - siehe
 * docs/zusammenlauf-und-melden.md Abschnitt 3b. Zwei davon gab es schon
 * (Laufjahre, Sportarten), sechs kamen mit Migration 0048 dazu.
 *
 * Warum sie hier stehen und nicht in der Oberflaeche
 * --------------------------------------------------
 * Die Seite fragt nur nach Fragen und nach Vollstaendigkeit. Welche
 * Schluessel es gibt, welche Werte erlaubt sind und in welcher Reihenfolge
 * gefragt wird, weiss sie nicht. Damit kostet eine siebte Frage einen
 * Eintrag hier und keine Aenderung am Bildschirm.
 */

export type FrageSchluessel =
  | 'km_woche'
  | 'lauf_grund'
  | 'lieber'
  | 'gelaende'
  | 'running_years'
  | 'sports'
  | 'im_verein'
  | 'schoen_am_laufen'

/** Eine Antwortmoeglichkeit zum Antippen. */
export interface Antwort {
  /** Was in der Datenbank steht. Nie uebersetzt. */
  wert: string
  /** Was der Mensch liest. */
  text: string
}

export interface Frage {
  schluessel: FrageSchluessel
  /** Was der Mensch liest. */
  text: string
  /** Wofuer die Antwort beim Zuordnen taugt - steht unter der Frage. */
  wofuer: string
  /**
   * Zum Antippen. Fehlt sie, wird die Frage anderswo beantwortet:
   * Laufjahre und Sportarten haben eigene Felder, "was ist schoen" ist der
   * einzige Freitext.
   */
  antworten?: Antwort[]
}

/**
 * In der Reihenfolge ihres Gewichts fuer das Zuordnen.
 *
 * Die Wochenkilometer stehen vorn, weil das Dokument sie "die haerteste
 * Passungsgroesse" nennt: Wer 60 km laeuft und wer 8 km laeuft, passen auch
 * dann nicht zusammen, wenn sonst alles stimmt.
 */
export const FRAGEN: Frage[] = [
  {
    schluessel: 'km_woche',
    text: 'Wie viele Kilometer in der Woche?',
    wofuer: 'Der Umfang – wer 60 km läuft und wer 8 km läuft, passt selten zusammen',
    antworten: [
      { wert: 'bis_10', text: 'bis 10' },
      { wert: 'bis_25', text: '10 bis 25' },
      { wert: 'bis_50', text: '25 bis 50' },
      { wert: 'ueber_50', text: 'über 50' },
    ],
  },
  {
    schluessel: 'lauf_grund',
    text: 'Warum läufst du?',
    wofuer: 'Die Absicht – Wettkampf trifft nicht gern auf Spazieren',
    antworten: [
      { wert: 'kopf_frei', text: 'Kopf frei bekommen' },
      { wert: 'gesundheit', text: 'Gesundheit' },
      { wert: 'wettkampf', text: 'Wettkampf' },
      { wert: 'abnehmen', text: 'Abnehmen' },
      { wert: 'geselligkeit', text: 'Geselligkeit' },
      { wert: 'draussen', text: 'Draußen sein' },
    ],
  },
  {
    schluessel: 'lieber',
    text: 'Lieber allein oder in der Gruppe?',
    wofuer: 'Ob überhaupt jemand gesucht wird',
    antworten: [
      { wert: 'allein', text: 'Allein' },
      { wert: 'gruppe', text: 'In der Gruppe' },
      { wert: 'beides', text: 'Beides' },
    ],
  },
  {
    schluessel: 'gelaende',
    text: 'Wo läufst du?',
    wofuer: 'Die Gegend – ohne zu verraten, wo genau',
    antworten: [
      { wert: 'stadt', text: 'Stadt' },
      { wert: 'wald', text: 'Wald' },
      { wert: 'feld', text: 'Feld und Wege' },
      { wert: 'bahn', text: 'Bahn' },
      { wert: 'berg', text: 'Berg' },
    ],
  },
  {
    schluessel: 'running_years',
    text: 'Seit wann läufst du?',
    wofuer: 'Erfahrung',
  },
  {
    schluessel: 'sports',
    text: 'Welche Sportarten machst du sonst?',
    wofuer: 'Gemeinsamkeiten jenseits des Laufens',
  },
  {
    schluessel: 'im_verein',
    text: 'Bist du in einem Verein oder Lauftreff?',
    wofuer: 'Ein Anschluss, der schon besteht',
    antworten: [
      { wert: 'ja', text: 'Ja' },
      { wert: 'nein', text: 'Nein' },
    ],
  },
  {
    schluessel: 'schoen_am_laufen',
    text: 'Was ist schön am Laufen?',
    wofuer: 'Ton und Haltung – das Einzige, was keine Liste treffen kann',
  },
]

export interface Vollstaendigkeit {
  /** Zwischen 0 und 1. */
  anteil: number
  /**
   * Wie viele Fragen beantwortet sind, und wie viele es gibt.
   *
   * Die Oberflaeche zeigt "5 von 8" statt "63 %": Eine Zahl, die sagt, wie
   * viel noch fehlt, laesst sich weiterfuellen; ein Prozentsatz muss erst
   * zurueckgerechnet werden. Gezaehlt wird hier und nicht am Bildschirm,
   * damit die Acht an einer Stelle steht.
   */
  beantwortet: number
  gesamt: number
  /** Was als Naechstes am meisten braechte, oder null wenn alles da ist. */
  naechsteFrage: Frage | null
}

/** Ist auf diese Frage geantwortet? */
function beantwortet(wert: unknown): boolean {
  if (wert === null || wert === undefined) return false
  if (typeof wert === 'string') return wert.trim().length > 0
  if (Array.isArray(wert)) return wert.length > 0
  return true
}

/**
 * Wie vollstaendig ist dieses Profil, und was fehlt als Naechstes?
 */
export function profilVollstaendigkeit(
  profil: Partial<Record<FrageSchluessel, unknown>>,
): Vollstaendigkeit {
  const offen = FRAGEN.filter((f) => !beantwortet(profil[f.schluessel]))
  return {
    anteil: (FRAGEN.length - offen.length) / FRAGEN.length,
    beantwortet: FRAGEN.length - offen.length,
    gesamt: FRAGEN.length,
    naechsteFrage: offen[0] ?? null,
  }
}
