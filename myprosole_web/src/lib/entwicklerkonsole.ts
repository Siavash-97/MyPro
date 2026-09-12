/**
 * Die Konsole der Entwicklungsfassung - und nur die.
 *
 * Warum es das seit dem 05.09.2026 gibt
 * -------------------------------------
 * DEVELOPMENT_STANDARDS.md: "Interne Diagnoseinformationen gehoeren
 * ausschliesslich in geschuetzte Logs." Die Browserkonsole einer
 * ausgelieferten App ist keines: Wer die Entwicklerwerkzeuge oeffnet, liest
 * mit. Ein Supabase-Rohtext traegt Tabellen-, Spalten- und Bedingungsnamen.
 *
 * Nachgezaehlt am 04.09.2026: zehn `console.`-Aufrufe im Produktivcode,
 * acht davon mit fremdem Rohtext, null hinter `import.meta.env.DEV` - und
 * vier Kommentare, die das als Muster festschrieben ("dorthin gehoert er").
 * Die Regel, die trennt, steht seit dem 05.09. im Standard:
 *
 *   Text, den die Anwendung nicht selbst formuliert hat, gehoert nicht in
 *   die Konsole der ausgelieferten Fassung.
 *
 * Warum ein Helfer und nicht acht `if (import.meta.env.DEV)`
 * ----------------------------------------------------------
 * Damit die Regel EINMAL steht. Wer den elften Aufruf schreibt, ruft diese
 * Funktion und erbt die Regel, statt sie zu kopieren - oder zu vergessen.
 * Ein `grep console.` ueber src/ - ohne Tests, ohne Kommentarzeilen, nur
 * Aufrufe - soll danach genau drei Stellen finden:
 * diese, und die zwei in lib/laufdauer.ts, die eigene Zahlen in eigenen
 * Saetzen ausgeben (geschlossene Menge - der Standard laesst sie zu).
 *
 * Was hier NICHT passiert: kein Sammeln, kein Senden, kein geschuetztes
 * Log. In der ausgelieferten Fassung verschwindet der Text. Das ist Absicht
 * und steht so im Standard; wer den Grund im Feld braucht, hat den
 * Rueckgabewert - heute `error` im Stoppergebnis, kuenftig `rohtext` im
 * Hindernis (docs/authhindernis-entwurf.md; das Feld gibt es noch nicht).
 */
export function entwicklerWarnung(text: string): void {
  if (import.meta.env.DEV) console.warn(text)
}
