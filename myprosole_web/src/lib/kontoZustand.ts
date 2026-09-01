/**
 * Was beim Abmelden vom Konto vergessen wird.
 *
 * Der Befund, der das ausgeloest hat
 * ----------------------------------
 * Der Agent `pruefung` fand am 25.08.2026: `signOut` raeumte den
 * Auth-Store und den Anamnese-Stand - **fuenfzehn weitere Speicher blieben
 * stehen.** Und `signOut` loest nirgends ein Neuladen der Seite aus
 * (`Profile.tsx`, `Anamnese.tsx` navigieren nur), der Arbeitsspeicher
 * ueberlebt den Kontowechsel also.
 *
 * Darin lagen unter anderem Zyklusdaten und `pain_locations` aus dem
 * Trainingstagebuch - **besondere Kategorien nach Art. 9 DSGVO** - sowie
 * die Einwilligungshistorie und private Unterhaltungen des vorigen Kontos.
 *
 * Praktisch ueberschreibt die naechste Abfrage das meiste. Aber bis dahin
 * sieht der Naechste die Daten des Vorigen, und fuer diese Zeitspanne gibt
 * es keine Grenze.
 *
 * Warum eine Anmeldeliste und keine sechzehn Aufrufe in auth.ts
 * ------------------------------------------------------------
 * Sechzehn Aufrufe waeren die Liste, die beim siebzehnten Speicher
 * vergessen wird. Genau die Bauart, an der dieses Projekt schon dreimal
 * gescheitert ist - 0037, 0048 und 0049 schrieben "keine neuen
 * Zeilenrechte noetig", und daraus wurde B17.
 *
 * Stattdessen meldet jeder kontogebundene Speicher sich SELBST an. Das hat
 * eine Eigenschaft, die zaehlt: **Ein Speicher, der nie geladen wurde, hat
 * auch nichts zu vergessen.** Er meldet sich dann nicht an, und das ist
 * richtig so, nicht ein Versehen.
 *
 * Was hier NICHT hingehoert
 * -------------------------
 * Geraeteeinstellungen. `myprosole_theme` gehoert zum Telefon, nicht zum
 * Konto - wer sich abmeldet, will nicht, dass die App wieder hell wird.
 * Dasselbe gilt fuer den gemessenen Ruhepegel: Er beschreibt den
 * EMPFAENGER, nicht die Person.
 */

/** Was beim Abmelden zu tun ist, eingesammelt von den Speichern selbst. */
const vergesser: Array<() => void> = []

/**
 * Ein Speicher meldet an, wie er sich selbst leert.
 *
 * Aufzurufen auf Modulebene, direkt nach `create(...)`. Dadurch meldet sich
 * genau das an, was auch tatsaechlich geladen wurde.
 */
export function beimAbmeldenVergessen(vergessen: () => void): void {
  vergesser.push(vergessen)
}

/**
 * Eine Kopie, die keine gemeinsamen Sammlungen mehr traegt.
 *
 * Der Anfangszustand wird EINMAL beim Laden des Moduls festgehalten. Wer ihn
 * beim Zuruecksetzen unveraendert wieder einsetzt, gibt DIESELBE Map, DIESELBE
 * Menge und DIESELBE Liste zurueck - also genau die, die das vorige Konto
 * vollgeschrieben hat. `answers` in `store/anamnese.ts` ist so eine Map, und
 * sie traegt die Antworten selbst.
 *
 * Eine Ebene tief reicht: Zustand-Speicher halten flache Felder, und was
 * darin liegt, wird beim naechsten Laden ohnehin ersetzt.
 */
function frisch(wert: unknown): unknown {
  if (wert instanceof Map) return new Map(wert)
  if (wert instanceof Set) return new Set(wert)
  if (Array.isArray(wert)) return [...wert]
  return wert
}

/** Das Wenige, das ein Zustand-Speicher hier koennen muss. */
interface Speicher<T> {
  getState: () => T
  setState: (teil: Partial<T>) => void
}

/**
 * Einen Speicher anmelden, ohne seinen Anfangszustand von Hand zu wiederholen.
 *
 * Aufzurufen auf Modulebene, direkt nach `create(...)` - dann steht der
 * Zustand noch so da, wie er gemeint ist, und keine Abfrage hat ihn
 * beruehrt.
 *
 * Nur DATENFELDER werden festgehalten. Die Aktionen bleiben, wie sie sind -
 * sonst waere der Speicher nach dem Abmelden unbenutzbar.
 */
export function speicherAnmelden<T extends object>(speicher: Speicher<T>): void {
  // ZWEIMAL kopieren, und beide Male aus einem Grund:
  //
  // Hier, beim Anmelden: Sonst haelt die Momentaufnahme eine REFERENZ auf
  // dieselbe Map, die der Speicher benutzt - das Konto schreibt sie voll,
  // und der "Anfangszustand" waechst mit. Genau daran ist die erste Fassung
  // dieser Funktion gescheitert, gefangen vom Test unten.
  //
  // Und unten, beim Zuruecksetzen: Sonst bekaemen alle Kontowechsel
  // DIESELBE Sammlung, und der zweite Wechsel raeumte nichts mehr weg.
  const anfang = Object.entries(speicher.getState())
    .filter(([, wert]) => typeof wert !== 'function')
    .map(([feld, wert]) => [feld, frisch(wert)] as const)
  beimAbmeldenVergessen(() => {
    const zuruecksetzen: Record<string, unknown> = {}
    for (const [feld, wert] of anfang) {
      zuruecksetzen[feld] = frisch(wert)
    }
    speicher.setState(zuruecksetzen as Partial<T>)
  })
}

/**
 * Kontogebundene Schluessel auf dem Geraet.
 *
 * Ausgeschrieben und nicht ueber ein Praefix: `myprosole_theme` und
 * `myprosole.ruhepegel.v1` fangen genauso an und muessen bleiben. Eine
 * Praefix-Regel haette sie mitgenommen, und niemand haette es gemerkt -
 * ausser dem Menschen, dessen App nach dem Abmelden wieder hell ist.
 *
 * Hier stehen nur Schluessel, die KEIN eigenes Modul besitzt. Wo es eines
 * gibt - `lib/anamneseEntwurf.ts`, `lib/chatGelesen.ts`, `lib/laufMerker.ts` -,
 * meldet dieses Modul sich selbst an und raeumt mit SEINER Konstanten auf.
 *
 * Der Grund ist der Fehler, den wir sonst einbauen wuerden: Eine Kopie des
 * Praefixes hier hoerte still auf zu greifen, sobald ihn jemand drueben
 * aendert. Ein Schluessel gehoert dem, der ihn schreibt.
 */
const KONTO_SCHLUESSEL = [
  'myprosole_pending_confirm_email',
  'myprosole_routine_erledigt',
  'myprosole_home_reminder_dismissed',
  'myprosole_blockb_reminder',
  'myprosole_zusammenlauf_sicherheit_gesehen',
] as const

/**
 * Alles vergessen, was zum bisherigen Konto gehoert.
 *
 * **Nichts hier darf werfen.** Ein Speicher, der beim Zuruecksetzen bricht,
 * darf nicht dazu fuehren, dass die Zyklus- und Tagebuchdaten des vorigen
 * Kontos stehenbleiben - und ein gesperrter localStorage darf das Abmelden
 * nicht anhalten. Deshalb faengt jeder Schritt fuer sich ab.
 */
export function kontoZustandVergessen(): void {
  for (const vergessen of vergesser) {
    try {
      vergessen()
    } catch {
      // Ein kaputter Speicher haelt die anderen nicht auf. Was hier
      // scheitert, wird beim naechsten Laden ohnehin ueberschrieben - was
      // NICHT geraeumt wuerde, saehe der Naechste.
    }
  }

  try {
    for (const schluessel of KONTO_SCHLUESSEL) {
      localStorage.removeItem(schluessel)
    }
  } catch {
    // Gesperrter oder fehlender Speicher darf das Abmelden nicht anhalten.
    // Der Preis ist, dass die Schluessel dann liegenbleiben - sichtbar wird
    // das nirgends, deshalb steht es hier.
  }
}
