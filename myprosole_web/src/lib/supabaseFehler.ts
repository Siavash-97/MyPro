/**
 * Was ein Supabase-Fehler bedeutet - an seinem Code, nicht an seinem Text.
 */

/** Verstoss gegen eine Eindeutigkeit (unique_violation). */
const DOPPELT = '23505'

/**
 * Ist dieser Fehler ein „gibt es schon"?
 *
 * Warum am Code und nicht am Wortlaut
 * -----------------------------------
 * Bis zum 22.08.2026 stand in `chats.ts` `error.message.includes('duplicate')`.
 * Das haengt an einer englischen Meldung von PostgreSQL. Aendert sich Wortlaut
 * oder Sprache, kippt die Pruefung lautlos ins Gegenteil - sie meldete dann
 * einen Fehler, wo keiner ist: bei einer zweiten Zusage, die nur herstellt,
 * was ohnehin schon gilt.
 *
 * Der Code ist Teil des SQL-Standards und aendert sich nicht.
 */
export function istDoppelt(
  // `message` steht bewusst im Typ, obwohl die Funktion ihn nicht liest:
  // Sie KOENNTE danach gehen und tut es nicht. Genau das prueft ein Test.
  fehler: { code?: string | null; message?: string } | null | undefined,
): boolean {
  return fehler?.code === DOPPELT
}

/**
 * Codes, hinter denen fuer den Menschen nichts Brauchbares steht.
 *
 *   42501  insufficient_privilege - eine Zeilenrechte-Ablehnung
 *   23505  unique_violation       - "gibt es schon"
 *
 * Beide sind fuer die Fehlersuche wertvoll und fuer den Laufenden wertlos.
 */
const STUMME_CODES = ['42501', DOPPELT]

/**
 * Eine Fehlermeldung, die einem Menschen gezeigt werden darf.
 *
 * Warum es das seit dem 31.08.2026 gibt - Auflage 3 des Agenten `sicherheit`
 * --------------------------------------------------------------------------
 * Mit der geraetevergebenen Lauf-Kennung (F1/A2) wird `runs` zu einer
 * Stelle, an der Zeilenrechte-Meldungen im NORMALBETRIEB entstehen koennen:
 * Ein zweiter Anlegeversuch trifft den eigenen Schluessel (23505), und eine
 * geratene fremde Kennung ergaebe 42501. Vorher waren beide Ausnahmen.
 *
 * Die Stores reichen `error.message` bis heute roh durch - ein bekannter
 * offener Verstoss. Diese Funktion schliesst ihn nicht allgemein; sie
 * schliesst die zwei Codes, die durch A2 haeufig werden.
 *
 * Der Rohtext geht NICHT verloren, er geht nur nicht an den Menschen: Die
 * Konsole bekommt ihn weiterhin, so wie es `lib/melden.ts` fuer alle
 * Datenbankmeldungen vorsieht ("Nie eine Datenbankmeldung").
 *
 * Was `null` heisst - und was nicht
 * ---------------------------------
 * `null` heisst: kein Fehler. Bis zum 05.09.2026 galt das nur fuer `null`
 * selbst; ein Objekt ohne Code und ohne Meldung lief bis `?? rueckfall`
 * durch. run.ts:1997 gab genau das nach JEDER gelungenen Uebertragung
 * hinein - "Das hat nicht geklappt" im Store, obwohl alles geklappt hatte.
 * Seitdem wird "kein Fehler" am Inhalt gelesen, nicht an der Identitaet.
 *
 * Die Kehrseite, ausdruecklich: Ein echter Fehlschlag, der weder Code noch
 * Meldung traegt, ist von Erfolg NICHT zu unterscheiden - und wird hier zu
 * `null`. Und das kommt vor: postgrest-js uebernimmt bei einer Nicht-OK-
 * Antwort einen JSON-Koerper ungeprueft als Fehlerobjekt und baut bei
 * leerem Koerper `{ message: '' }` (dist/index.cjs, Nicht-OK-Zweig; ein 502
 * eines Gateways ohne Koerper reicht). Diese Funktion kann das nicht sehen.
 * Wer Fehlschlag von Erfolg trennen muss, prueft davor, OB ein
 * Fehlerobjekt da ist - nicht, was drinsteht. Genau das tut das kuenftige
 * `lib/hindernis.ts` (docs/authhindernis-entwurf.md). Die Faelle stehen im
 * Test.
 *
 * VORAUSSETZUNG DIESER REGEL, ausdruecklich: Sie gilt nur, solange der
 * Aufrufer das Objekt SELBST baut - wie run.ts:1997, das es bedingungslos
 * auch bei Erfolg zusammensetzt. "Leer" heisst dort "bei Erfolg gebaut".
 * Das Objekt der Bibliothek ist bei Erfolg null; ist es NICHT null, ist
 * wirklich etwas schiefgegangen, auch wenn nichts drinsteht. Wer hier ein
 * Bibliotheksobjekt hineingibt, muss vorher hindernis.ts fragen - sonst
 * wird aus "kein Fehler" still ein verschluckter Fehlschlag. Dieselbe
 * postgrest-js-Messung begruendet dort "leer -> unbekannt" und hier
 * "leer -> null"; was die beiden trennt, ist die Herkunft der Eingabe.
 */
export function menschenlesbar(
  fehler: { code?: string | null; message?: string } | null | undefined,
  rueckfall = 'Das hat nicht geklappt. Versuch es spaeter noch einmal.',
): string | null {
  if (!fehler) return null
  // Nichts drin - weder Code noch Meldung (auch '' zaehlt als nichts; `??`
  // allein saehe das nicht). Siehe Kopf: das ist "kein Fehler".
  if (!fehler.code && !fehler.message) return null
  if (fehler.code && STUMME_CODES.includes(fehler.code)) return rueckfall
  // `||`, nicht `??`: '' ist auch hier nichts. Ein Code ohne Meldung bekommt
  // den Rueckfallsatz - sonst hiesse '' oben "kein Fehler" und hier "Meldung".
  return fehler.message || rueckfall
}
