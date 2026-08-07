/*
  Trainingsbegleitung – Zustand des klickbaren Prototyps.

  Gespeichert wird ausschließlich, wie die heutige Mikroroutine ausgegangen
  ist: erledigt, für heute abgelehnt oder noch offen. Keine Übungsinhalte,
  keine Wiederholungszahlen, keine Zeiten und nichts über den Körper.

  Der Schritt innerhalb einer Einheit steht in der URL und nicht im Speicher –
  eine halb begonnene Einheit soll nicht als Zustand fortbestehen.
*/
(() => {
  "use strict";

  const ROUTINE_KEY = "myprosole.prototype.routine-today";
  const DONE = "done";
  const DECLINED = "declined";
  const ALLOWED_STATES = new Set([DONE, DECLINED]);

  const FIRST_STEP = "1";
  const FINAL_STEP = "fertig";
  const ALLOWED_STEPS = new Set([FIRST_STEP, "2", "3", FINAL_STEP]);

  const read = () => {
    try {
      const state = window.sessionStorage.getItem(ROUTINE_KEY);
      return ALLOWED_STATES.has(state) ? state : null;
    } catch {
      return null;
    }
  };

  const write = (state) => {
    if (!ALLOWED_STATES.has(state)) {
      return;
    }
    try {
      window.sessionStorage.setItem(ROUTINE_KEY, state);
    } catch {
      // Die Vorschau bleibt auch ohne verfügbaren Sitzungsspeicher bedienbar.
    }
  };

  // Schritt der geführten Einheit. Ein unbekannter Wert faellt auf den ersten
  // Schritt zurueck, statt einen leeren Screen zu zeigen.
  const requestedStep = new URLSearchParams(window.location.search).get("schritt");
  const step = ALLOWED_STEPS.has(requestedStep) ? requestedStep : FIRST_STEP;

  document.querySelectorAll("[data-step]").forEach((section) => {
    section.hidden = section.dataset.step !== step;
  });

  if (step === FINAL_STEP) {
    write(DONE);
  }

  document.querySelectorAll("[data-routine-decline]").forEach((element) => {
    element.addEventListener("click", () => {
      write(DECLINED);
    });
  });

  const state = read();

  // Die Laufzusammenfassung dient zwei Situationen. Direkt nach dem Lauf
  // (from=tracking) wird die Routine angeboten. Wer denselben Lauf spaeter
  // aus dem Verlauf oeffnet, soll kein Angebot sehen, sondern den Zustand –
  // ein Angebot zu einem Lauf von gestern waere sinnlos.
  const justFinished =
    new URLSearchParams(window.location.search).get("from") === "tracking";

  // Angebot: nur frisch nach dem Lauf und nur solange nichts entschieden ist.
  document.querySelectorAll("[data-routine-offer]").forEach((element) => {
    element.hidden = !justFinished || state !== null;
  });

  // Zustand: beim Nachschauen, und auch frisch nach einer Entscheidung.
  document.querySelectorAll("[data-routine-status]").forEach((element) => {
    const expected = element.dataset.routineStatus;
    const shown = state === DONE ? "done" : "open";
    element.hidden = expected !== shown || (justFinished && state === null);
  });

  // Alles, was nur unmittelbar nach dem Lauf sinnvoll ist. Blendet nur aus,
  // zeigt nie – damit vorher gesetzte Zustaende (etwa der Analysemodus)
  // erhalten bleiben.
  if (!justFinished) {
    document.querySelectorAll("[data-fresh-only]").forEach((element) => {
      element.hidden = true;
    });
  }

  // Trainingstagebuch: Werte kommen aus dem Lauf, koennen aber selbst gesetzt
  // werden. Ein leeres Formular ist nie der Startpunkt.
  const ALLOWED_DIARY_VIEWS = new Set(["auto", "manuell"]);
  const requestedView = new URLSearchParams(window.location.search).get("werte");
  const diaryView = ALLOWED_DIARY_VIEWS.has(requestedView) ? requestedView : "auto";

  document.querySelectorAll("[data-diary-view]").forEach((element) => {
    element.hidden = element.dataset.diaryView !== diaryView;
  });

  // Vorschlag der App im Plan-Editor: offen, übernommen oder abgelehnt.
  // Er hält niemanden auf – Speichern geht in jedem Zustand.
  const ALLOWED_REVIEW = new Set(["uebernommen", "abgelehnt"]);
  const requestedReview = new URLSearchParams(window.location.search).get("vorschlag");
  const reviewState = ALLOWED_REVIEW.has(requestedReview)
    ? { uebernommen: "accepted", abgelehnt: "declined" }[requestedReview]
    : "open";

  document.querySelectorAll("[data-review-state]").forEach((element) => {
    element.hidden = element.dataset.reviewState !== reviewState;
  });

  // Wochenplan: derselbe Eintrag, drei Zustaende.
  document.querySelectorAll("[data-routine-state]").forEach((element) => {
    const expected = element.dataset.routineState;
    if (expected === "open") {
      element.hidden = state !== null;
    } else {
      element.hidden = state !== expected;
    }
  });
})();
