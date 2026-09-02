import type { Laufmerker } from './laufMerker'
import type { TrackingPhase } from '../store/run'

/**
 * In welchem Zustand eine Aufzeichnung ist - als Summe, nicht als Produkt.
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * Bis zum 31.08.2026 beschrieben vier Felder in `store/run.ts` denselben
 * Begriff: `phase`, `activeRunId`, `sitzungId`, `zeileSteht`. Nachgezaehlt
 * **25 Schreibstellen aus sechs Zustaendigkeiten**, keine davon prueft die
 * Gueltigkeit der Kombination. Darstellbar waren `6 x 2 x 2 x 2 = 48`
 * Zustaende; gueltig ist ein Bruchteil.
 *
 * Was das im August 2026 gekostet hat, jeder Fall mit eigenem Bericht:
 *
 *   28.08.  `anzahl()`      Anzeigezahl UND Abbruchbedingung
 *   31.08.  `bestaetigt`    Bestaetigung UND Existenz der Zeile
 *   31.08.  `activeRunId`   Kennung UND Existenz
 *   31.08.  `zeileSteht`    drei Setzstellen, eine Ruecksetzstelle
 *                           -> der ZWEITE Lauf jeder App-Sitzung waere
 *                              verloren gewesen
 *
 * Der Entwurf steht in `docs/aufzeichnungszustand-entwurf.md`, mit allen
 * fuenfzehn Entwurfsfragen und ihren Entscheidungen.
 *
 * Was dieses Modul NICHT tut
 * --------------------------
 * Es hat **keine Wirkung nach aussen**. Kein `set`, kein Netz, kein
 * Geraetespeicher, kein Dienst. Der Dienst bleibt ausdruecklich draussen
 * (Entwurfsfrage Q4): Jeder Lagewechsel geht heute mit einem Dienstbefehl
 * einher, und die Versuchung ist gross, ihn mitzunehmen - aber er ist
 * asynchron und kann scheitern. Das gehoert hinter eine andere Naht.
 *
 * Der Merker wird hier nur **abgeleitet** (`merkerAus`), nicht geschrieben.
 * Geschrieben wird er von der duennen Huelle im Store.
 */

/** Die acht Lagen. Was hier nicht steht, gibt es nicht. */
export type Aufzeichnungszustand =
  | { art: 'ruht' }
  | { art: 'zeichnet auf'; sitzung: string; zeileSteht: boolean; stoppversuche: number }
  | { art: 'pausiert'; sitzung: string; zeileSteht: boolean; stoppversuche: number }
  | { art: 'speichert'; sitzung: string; zeileSteht: boolean; stoppversuche: number }
  | { art: 'abgebrochen'; sitzung: string; zeileSteht: boolean; stoppversuche: number }
  /**
   * Die Nutzlast hat die App verlassen, die Antwort steht aus.
   *
   * Eine eigene Lage und kein Merkmal an `abgeschlossen` (Q7): Vier
   * Aufrufer verhalten sich unterschiedlich - die Navigation ins
   * Trainingstagebuch, die Nachholschleife, die Sendesperre fuer Punkte
   * ohne Zeile und die Sichtbarkeits-Frist.
   */
  | {
      art: 'abgeschickt'
      lauf: string
      /**
       * Existiert die Zeile schon?
       *
       * Zwei unabhaengige, gleichzeitig wahre Tatsachen in einer Lage -
       * `lauf` ist die Identitaet, `zeileSteht` die Existenz. Das ist keine
       * Ruecknahme von Q1: Dort ging es um zwei KONKURRIERENDE Geschichten
       * in einem Feld, hier um zwei getrennte Felder, dieselbe Form wie
       * `stoppversuche` neben `sitzung` in `zeichnet auf`.
       *
       * Notwendig, weil 'abgeschickt' aus BEIDEN Wegen entsteht: Im
       * `update`-Fall existiert die Zeile seit dem Start, im `upsert`-Fall
       * nicht. `punkteUebertragen` spart Laeufe ohne Zeile aus - ein
       * geratener Wert kostet hier entweder Fremdschluesselfehler oder
       * grundlos liegengebliebene Punkte. Befund 9 des Agenten `pruefung`,
       * 31.08.2026.
       */
      zeileSteht: boolean
    }
  /**
   * Die Nachholschleife hat aufgegeben - ein dauerhafter Fehler.
   *
   * Getrennt von `abgebrochen` (Q12/Q13), weil sich unterscheidet, **was
   * der Mensch schon hat**: Hier hat er seinen Lauf laengst gesehen; bei
   * `abgebrochen` wartet er noch auf eine Entscheidung.
   */
  | { art: 'nicht angekommen'; lauf: string }
  | { art: 'abgeschlossen'; lauf: string }

/**
 * Was einer Aufzeichnung zustossen kann.
 *
 * `zurueckZu` bei `speichernGescheitert` ist kein Zierrat: Der Rueckweg
 * fuehrt in DEN Zustand, aus dem gestoppt wurde, nicht pauschal in die
 * Aufzeichnung. Wer aus der Pause beendet und scheitert, landete sonst in
 * 'tracking' mit einem `pauseStart`, den weder Pausieren noch Fortsetzen je
 * erzeugen koennen - Befund vom 24.08.2026.
 */
export type Ereignis =
  | { art: 'beginnt'; sitzung: string }
  /**
   * Ein Abbruch wird wieder aufgenommen, BEVOR das Beenden beginnt.
   *
   * `stopRun` setzt bei einem Versuch aus 'abgebrochen' sofort
   * `phase: 'tracking'` (run.ts:1009) - vor `aufzeichnungStoppen()` und
   * `punkteEinsammeln()`. Der Grund steht dort: `addPoint` steigt bei
   * `phase !== 'tracking'` aus, und `punkteBestaetigen` loescht danach beim
   * Dienst genau die Punkte, die nie angekommen sind. Befund des Agenten
   * `oberflaeche` vom 24.08.2026.
   */
  | { art: 'wiederaufgenommen' }
  /**
   * `sitzung` gehoert dazu, weil dieses Ereignis nach einem `await` faellt.
   *
   * `zeileNachziehen` liest seine Wache einmal (run.ts:954-956) und
   * schreibt danach ungeprueft (run.ts:971); der `insert` bei 960 hat KEINE
   * Zeitgrenze. In diesem Fenster kann laengst ein anderer Lauf laufen -
   * dann meldete das Ereignis dessen Zeile als vorhanden.
   */
  | { art: 'zeileEntstanden'; sitzung: string }
  | { art: 'pausiert' }
  | { art: 'fortgesetzt' }
  | { art: 'beendenBegonnen' }
  | { art: 'gespeichert'; lauf: string }
  | { art: 'abgeschicktOhneAntwort'; lauf: string }
  /** `lauf` aus demselben Grund wie bei `zeileEntstanden`. */
  | { art: 'nachholenGelungen'; lauf: string }
  | { art: 'nachholenAufgegeben'; lauf: string }
  | {
      art: 'speichernGescheitert'
      dauerhaft: boolean
      /**
       * 'abgebrochen' gehoert dazu: `phaseVorher` kann das sein
       * (run.ts:1015-1019), und `zurueck()` gibt bei einem WIEDERHOLBAREN
       * Fehler genau dorthin zurueck. Ohne diesen Wert wuerde der Dienst
       * wieder angeworfen und die Marke fiele weg.
       */
      // 'abgebrochen' ist HEUTE TOT und war es von Anfang an.
      //
      // Die Begruendung darueber behauptet, `zurueck()` gebe bei einem
      // wiederholbaren Fehler dorthin zurueck. Nachgesehen am 02.09.2026
      // (Agent `pruefung`, von mir am Quelltext nachgeprueft): Der einzige
      // Aufrufer faengt den Fall vorher ab - `abbruchUndWeiterAufzeichnen`
      // schickt `zurueckZu === 'abgebrochen'` in den Zweig
      // `dauerhaft: true` und setzt dort ein erfundenes
      // `zurueckZu: 'zeichnet auf'`; die andere Abbildung kennt nur
      // 'paused' und sonst 'zeichnet auf'. `art: 'abgebrochen'` kann aus
      // keinem Store-Aufruf entstehen.
      //
      // Kein Verhaltensunterschied zu vorher, also keine Regression - aber
      // die Zusicherung im Kommentar gibt es nicht. Das Glied bleibt
      // stehen, weil `speichernGescheitert` es fuer den Typ braucht;
      // gestrichen wird es mit Schritt 5, wo der Aufrufer ohnehin
      // angefasst wird.
      zurueckZu: 'zeichnet auf' | 'pausiert' | 'abgebrochen'
    }
  | { art: 'verworfen' }
  | { art: 'geborgen'; sitzung: string; zeileSteht: boolean }

/**
 * Der naechste Zustand - oder derselbe, wenn der Weg nicht existiert.
 *
 * Ein unpassendes Ereignis aendert nichts und wirft nicht. Das ist
 * Absicht und entspricht dem, was der bisherige Code an seinen Waechtern
 * tat (`if (phase !== 'paused') return`): Die Ereignisse kommen aus Knoepfen
 * und aus Hintergrundschleifen, die einander ueberholen koennen. Ein Wurf
 * waere dort kein Schutz, sondern ein zweiter Fehlerweg.
 *
 * **Dass ein Uebergang NICHT stattfindet, ist die Haelfte der Zusicherung.**
 * Genau diese Haelfte kann eine Sammlung von Einzelfeldern nicht geben - und
 * genau sie fehlte, als `zeileSteht` nach einem gespeicherten Lauf stehen
 * blieb.
 */
export function naechsterZustand(
  jetzt: Aufzeichnungszustand,
  ereignis: Ereignis,
): Aufzeichnungszustand {
  // Verwerfen geht aus jeder Lage - der Mensch darf immer abbrechen.
  if (ereignis.art === 'verworfen') return { art: 'ruht' }

  switch (ereignis.art) {
    case 'beginnt':
      // Nur aus einer Lage ohne laufende Aufzeichnung. Die Wache steht
      // heute in `startRun` (run.ts:842) und ist hier eine Eigenschaft des
      // Uebergangs statt eine Zeile im Aufrufer.
      if (jetzt.art !== 'ruht' && jetzt.art !== 'abgeschlossen' && jetzt.art !== 'nicht angekommen') {
        return jetzt
      }
      // Neu gebaut, nicht Feld fuer Feld gesetzt. Deshalb kann `zeileSteht`
      // hier nicht aus einem frueheren Lauf stehenbleiben.
      return { art: 'zeichnet auf', sitzung: ereignis.sitzung, zeileSteht: false, stoppversuche: 0 }

    case 'zeileEntstanden':
      // Auch aus 'speichert', und das ist kein Versehen: `zeileNachziehen`
      // liest seine Wache einmal vor dem Netzaufruf und schreibt danach
      // ohne erneute Pruefung (run.ts:954-971). Setzt `stopRun` in dieser
      // Zeit auf 'saving', laeuft der Aufruf trotzdem zu Ende.
      //
      // 'abgebrochen' ist ausgenommen: Dort ist der Dienst gestoppt und die
      // Nachholschleife laeuft nicht.
      if (jetzt.art !== 'zeichnet auf' && jetzt.art !== 'pausiert' && jetzt.art !== 'speichert') {
        return jetzt
      }
      // Nur die eigene Aufzeichnung. Ein `zeileNachziehen` aus einem
      // frueheren Lauf darf die Zeile eines spaeteren nicht als vorhanden
      // melden - siehe die Begruendung am Ereignis.
      if (jetzt.sitzung !== ereignis.sitzung) return jetzt
      return { ...jetzt, zeileSteht: true }

    case 'pausiert':
      if (jetzt.art !== 'zeichnet auf') return jetzt
      return { ...jetzt, art: 'pausiert' }

    case 'fortgesetzt':
      if (jetzt.art !== 'pausiert') return jetzt
      return { ...jetzt, art: 'zeichnet auf' }

    case 'beendenBegonnen':
      // Aus 'abgebrochen' heraus ausdruecklich erlaubt (run.ts:1009) -
      // sonst saesse der Mensch nach drei Fehlversuchen fest.
      if (jetzt.art !== 'zeichnet auf' && jetzt.art !== 'pausiert' && jetzt.art !== 'abgebrochen') {
        return jetzt
      }
      return { ...jetzt, art: 'speichert' }

    case 'wiederaufgenommen':
      if (jetzt.art !== 'abgebrochen') return jetzt
      return { ...jetzt, art: 'zeichnet auf' }

    case 'gespeichert':
      if (jetzt.art !== 'speichert') return jetzt
      return { art: 'abgeschlossen', lauf: ereignis.lauf }

    case 'abgeschicktOhneAntwort':
      if (jetzt.art !== 'speichert') return jetzt
      return { art: 'abgeschickt', lauf: ereignis.lauf, zeileSteht: jetzt.zeileSteht }

    case 'nachholenGelungen':
      // Nur, wenn wirklich etwas aussteht. Die Nachholschleife laeuft bis
      // zu einer Stunde; startet der Mensch in dieser Zeit einen neuen
      // Lauf, darf sie dessen Lage nicht anfassen - derselbe Fehler, gegen
      // den `merkerLoeschenFalls` am 29.08.2026 gebaut wurde.
      if (jetzt.art !== 'abgeschickt' || jetzt.lauf !== ereignis.lauf) return jetzt
      return { art: 'abgeschlossen', lauf: jetzt.lauf }

    case 'nachholenAufgegeben':
      if (jetzt.art !== 'abgeschickt' || jetzt.lauf !== ereignis.lauf) return jetzt
      // NUR, wenn es die Zeile nie gab.
      //
      // `nicht angekommen` behauptet "es gibt keine Zeile" - `ableiten`
      // setzt dafuer `activeRunId: null` und `zeileSteht: false`. Ein
      // dauerhafter Fehlercode beweist aber nur, dass DIESER
      // SCHREIBVORGANG nicht durchkommt, nicht dass die Zeile fehlt.
      //
      // `bestaetigungNachholen` bedient zwei Wege. Auf dem `update`-Weg
      // existiert die Zeile seit `startRun`; ein 23514 aus
      // `runs_moving_time_plausibel` (Migration 0044) laesst sie
      // unberuehrt stehen. Diese Lage waere dort eine Behauptung, keine
      // Auskunft - und `punkteUebertragen` (run.ts) sperrt bei
      // `!zeileSteht` die gepufferten Punkte GENAU DIESES Laufs aus,
      // obwohl der Fremdschluessel greifen wuerde.
      //
      // Das Kriterium stand seit dem 01.09.2026 woertlich am dritten
      // Ausgang der Schleife ("Ein dauerhafter Fehlercode ist ein Beweis,
      // eine Zeitgrenze ist keiner") und war hier verletzt. Gefunden vom
      // Agenten `pruefung` am 02.09.2026, mit rotem Test nachgestellt.
      //
      // Bleibt die Lage 'abgeschickt', ist das kein Rueckschritt: Der
      // Zustand sagt dann "raus, unbestaetigt" - was stimmt -, die Punkte
      // gehen raus, und `haengendeLaeufeAbschliessen` schliesst die Zeile
      // beim naechsten Start an der Datenbank ab.
      if (jetzt.zeileSteht) return jetzt
      return { art: 'nicht angekommen', lauf: jetzt.lauf }

    case 'speichernGescheitert': {
      // Aus JEDER Lage mit Zaehler, nicht nur aus 'speichert'.
      //
      // `zurueck()` erhoeht `stoppversuche` ausserhalb jeder Phasenpruefung
      // (run.ts:1030), und die werfenden Stellen `aufzeichnungStoppen` und
      // `punkteEinsammeln` liegen VOR `set({ phase: 'saving' })`. Zaehlte
      // das Modell nur aus 'speichert', erreichte `versuche >=
      // MAX_VERSUCHE` fuer diese Fehlerklasse nie - und die Endlosschleife,
      // gegen die `lib/stoppfehler.ts` geschrieben wurde, kaeme zurueck.
      if (
        jetzt.art !== 'zeichnet auf' &&
        jetzt.art !== 'pausiert' &&
        jetzt.art !== 'speichert' &&
        jetzt.art !== 'abgebrochen'
      ) {
        return jetzt
      }
      const versuche = jetzt.stoppversuche + 1
      if (ereignis.dauerhaft) return { ...jetzt, art: 'abgebrochen', stoppversuche: versuche }
      return { ...jetzt, art: ereignis.zurueckZu, stoppversuche: versuche }
    }

    case 'geborgen':
      // Nur aus der Ruhe. Ohne diese Wache ueberschriebe eine Bergung die
      // Sitzung eines gerade gestarteten Laufs und holte seine Punkte in
      // die falsche Ablage - das Fenster, das `run.ts:1815` heute mit einer
      // zweiten Abfrage schuetzt.
      if (jetzt.art !== 'ruht') return jetzt
      return {
        art: 'zeichnet auf',
        sitzung: ereignis.sitzung,
        zeileSteht: ereignis.zeileSteht,
        stoppversuche: 0,
      }
  }
}

/**
 * Was im Geraetespeicher stehen muss, damit die Lage einen Absturz
 * ueberlebt.
 *
 * **Abgeleitet, nicht gepflegt.** Bis zum 31.08.2026 lagen zehn
 * Merker-Aufrufe verstreut ueber fuenf Zustaendigkeiten - zwei Wahrheiten,
 * die auseinanderlaufen konnten. Aus der Lage folgt eindeutig, was im
 * Speicher stehen muss; also gibt es nur noch eine.
 *
 * `runId` traegt seit A2 keine eigene Kennung mehr, sondern sagt nur, DASS
 * die Zeile existiert - beide Schreibstellen im alten Code uebergaben
 * dieselbe Zeichenkette wie `sitzungId` (run.ts:871, 973), und
 * `run.ts:1879` las es bereits so. Der Name bleibt vorerst, damit der
 * Geraetespeicher lesbar bleibt; die Umbenennung gehoert in den Schritt,
 * der `laufMerker.ts` anfasst.
 */
export function merkerAus(zustand: Aufzeichnungszustand): Laufmerker | null {
  // Nichts zu bergen: keine Aufzeichnung, oder eine, die sicher steht.
  if (zustand.art === 'ruht' || zustand.art === 'abgeschlossen') return null

  if (zustand.art === 'abgeschickt' || zustand.art === 'nicht angekommen') {
    return {
      sitzungId: zustand.lauf,
      // Ohne Zeile keine `runId`. Sonst liest `verwaisteAufzeichnungBergen`
      // daraus `zeileSteht: true` (run.ts:1879) und `stopRun` schriebe ein
      // `update` auf eine nie angelegte Zeile.
      runId: zustand.art === 'abgeschickt' && zustand.zeileSteht ? zustand.lauf : null,
      // Q12: Die beiden dauerhaft gescheiterten Lagen unterscheiden sich
      // darin, was der Mensch schon hat - im Merker sind sie dasselbe.
      dauerhaftGescheitert: zustand.art === 'nicht angekommen',
    }
  }

  return {
    sitzungId: zustand.sitzung,
    runId: zustand.zeileSteht ? zustand.sitzung : null,
    dauerhaftGescheitert: zustand.art === 'abgebrochen',
  }
}

/**
 * Was beim naechsten App-Start aus einem gespeicherten Merker wird.
 *
 * Die Umkehrung ist absichtlich **nicht** vollstaendig: Aus 'pausiert' oder
 * 'speichert' wird eine Aufzeichnung. Das ist richtig - der Dienst hat
 * waehrenddessen weitergesammelt, und was er hat, ist die Wahrheit.
 *
 * Alte Merker (Q9)
 * ----------------
 * Vor dem 31.08.2026 vergab die Datenbank die Lauf-Kennung; `runId` und
 * `sitzungId` waren dann verschieden. Solche Merker liegen weiter im
 * Geraetespeicher.
 *
 * **Was hier bewusst NICHT geschieht:** die alte Lauf-Kennung mitnehmen.
 * Das Modell kennt seit A2 nur EINE Kennung je Aufzeichnung; eine zweite
 * waere genau der Namensraum-Bruch, den A2 abgeschafft hat. Ein solcher
 * Merker wird deshalb als Aufzeichnung OHNE Zeile gelesen - die Zeile unter
 * der alten Kennung bleibt liegen und wird nach der Schonfrist von
 * `haengendeLaeufeAbschliessen` abgeschlossen.
 *
 * Das ist eine Einschraenkung gegenueber Q9, und sie steht im Bericht.
 */
export function merkerZu(merker: Laufmerker | null): Aufzeichnungszustand {
  if (!merker) return { art: 'ruht' }

  // Eine Kennung, die nicht der Sitzung entspricht, stammt aus der Zeit vor
  // A2. Dann gilt: Zeile unbekannt, neu anlegen.
  const eigeneZeile = merker.runId != null && merker.runId === merker.sitzungId

  if (merker.dauerhaftGescheitert) {
    return {
      art: 'abgebrochen',
      sitzung: merker.sitzungId,
      zeileSteht: eigeneZeile,
      stoppversuche: 0,
    }
  }

  return {
    art: 'zeichnet auf',
    sitzung: merker.sitzungId,
    zeileSteht: eigeneZeile,
    stoppversuche: 0,
  }
}


/** Die vier Lesefelder, wie `store/run.ts` sie heute traegt. */
export interface Lesefelder {
  phase: TrackingPhase
  activeRunId: string | null
  sitzungId: string | null
  zeileSteht: boolean
  /**
   * Gehoert dazu, weil `zurueck()` in `store/run.ts` es aus dem Store
   * liest, nicht aus der Lage. Solange der Zwischenschritt laeuft, muessen
   * beide denselben Wert tragen - sonst zaehlt der eine, waehrend der
   * andere entscheidet.
   */
  stoppversuche: number
}

/**
 * Die Lage auf die vier Lesefelder abbilden - der Zwischenschritt aus Q8.
 *
 * Die Lage ist die Wahrheit; diese vier bleiben daneben stehen und werden
 * nur noch aus EINER Stelle geschrieben. **Rueckwaerts darf niemand
 * schreiben** - sonst gaebe es wieder zwei Darstellungen desselben
 * Zustands, also genau das Muster, das dieser Umbau abschafft.
 *
 * Folgeauftrag F1 entfernt sie, sobald die Leser die Lage fragen. Es sind
 * **zwei** Leser, nicht vier - nachgezaehlt am 31.08.2026:
 *
 *   phase        nur pages/LiveTracking.tsx
 *   activeRunId  nur pages/RunSummary.tsx:225,228
 *   sitzungId    nur pages/LiveTracking.tsx:388
 *   zeileSteht   niemand ausserhalb des Stores
 *
 * Warum die drei Endlagen alle auf 'completed' abbilden
 * -----------------------------------------------------
 * `LiveTracking.tsx:224` und `:520` zeigen bei `phase === 'abgebrochen'`
 * eine Entscheidungsansicht. Wer seinen Lauf in der Zusammenfassung schon
 * gesehen hat, bekaeme dort eine Rueckfrage zu etwas, das fuer ihn fertig
 * ist. Und `:229` darf nicht `startRun()` ausloesen, was bei 'idle'
 * geschaehe.
 */
/**
 * Die Lage UND ihre Lesefelder als ein Stueck - die Form, in der eine Lage
 * in den Store geht.
 *
 * Es gab sie bis zum 01.09.2026 zweimal: einmal in `uebergangIn`
 * (`store/run.ts`) und einmal handgepflegt als Testhelfer `lage()` in
 * `store/bergung.test.ts`. Zwei Kopien derselben Schreibform sind genau die
 * Bauart, gegen die dieser ganze Umbau geht - nur eine Ebene hoeher: Waere
 * eine der beiden um ein Feld abgewichen, haetten Tests Zustaende gebaut,
 * die der Store so nie schreibt, und das faellt nicht auf, weil beide
 * Seiten fuer sich gruen bleiben.
 *
 * Die Reihenfolge ist Absicht: `ableiten` steht HINTER `aufzeichnung`, also
 * gewinnt die Ableitung. Wer `dazu` ein abgeleitetes Feld mitgibt, kommt
 * damit nicht durch.
 */
export function zustandsfelder(zustand: Aufzeichnungszustand) {
  return { aufzeichnung: zustand, ...ableiten(zustand) }
}

export function ableiten(zustand: Aufzeichnungszustand): Lesefelder {
  switch (zustand.art) {
    case 'ruht':
      return {
        phase: 'idle',
        activeRunId: null,
        sitzungId: null,
        zeileSteht: false,
        stoppversuche: 0,
      }

    case 'zeichnet auf':
    case 'pausiert':
    case 'speichert':
    case 'abgebrochen':
      return {
        phase:
          zustand.art === 'zeichnet auf'
            ? 'tracking'
            : zustand.art === 'pausiert'
              ? 'paused'
              : zustand.art === 'speichert'
                ? 'saving'
                : 'abgebrochen',
        activeRunId: zustand.sitzung,
        sitzungId: zustand.sitzung,
        zeileSteht: zustand.zeileSteht,
        stoppversuche: zustand.stoppversuche,
      }

    case 'abgeschickt':
      return {
        phase: 'completed',
        activeRunId: zustand.lauf,
        sitzungId: zustand.lauf,
        // Durchgereicht, nicht geraten - siehe die Begruendung am Feld.
        zeileSteht: zustand.zeileSteht,
        stoppversuche: 0,
      }

    case 'nicht angekommen':
      return {
        phase: 'completed',
        // KEIN Analyse-Link. `RunSummary.tsx:225` ist `{activeRunId && (`,
        // und bei dieser Lage steht sicher keine Zeile in der Datenbank -
        // der Link fuehrte ins Leere. Mit `null` versteckt die
        // Zusammenfassung ihn von selbst.
        activeRunId: null,
        sitzungId: zustand.lauf,
        zeileSteht: false,
        stoppversuche: 0,
      }

    case 'abgeschlossen':
      return {
        phase: 'completed',
        activeRunId: zustand.lauf,
        sitzungId: zustand.lauf,
        zeileSteht: true,
        stoppversuche: 0,
      }
  }
}
