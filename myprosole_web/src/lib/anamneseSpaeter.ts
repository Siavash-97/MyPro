/**
 * "Spaeter" fuer die Anamnese.
 *
 * Der Waechter schickt jeden, der die Anamnese nicht gemacht hat, dorthin –
 * das ist gewollt, denn ohne sie rechnet die App mit Durchschnittswerten.
 * Ohne Ausweg wurde daraus aber eine Sackgasse: Die Einwilligungsseite
 * erschien bei jedem Start, der Zurueck-Knopf fuehrte zurueck in dieselbe
 * Seite, und man kam gar nicht in die App.
 *
 * Deshalb ein einmaliges "spaeter" – aber nur fuer diese Sitzung.
 * sessionStorage und nicht localStorage: Beim naechsten Oeffnen der App
 * wird wieder gefragt. Wer sie wirklich nicht machen will, wird also nicht
 * gefangen; wer sie nur gerade nicht machen will, wird erinnert.
 *
 * Die Glocke auf der Startseite zeigt sie derweil als offenen Punkt.
 */
const SCHLUESSEL = 'myprosole_anamnese_spaeter'

export function anamneseVerschieben(): void {
  sessionStorage.setItem(SCHLUESSEL, 'true')
}

export function anamneseVerschoben(): boolean {
  return sessionStorage.getItem(SCHLUESSEL) === 'true'
}
