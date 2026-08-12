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

  // Direkt nach dem Lauf fuehrt "Eintrag speichern" zurueck in die
  // Zusammenfassung, die dort noch die Mikroroutine anbieten kann - das
  // Tagebuch liegt jetzt vor ihr, nicht mehr dahinter. Ueber "Mehr" im
  // Uebungen-Tab aufgerufen (kein from=tracking) bleibt es beim Wochenplan,
  // wie im Formular hinterlegt.
  //
  // "from=tracking" als eigenes Feld, nicht in der action-URL: bei
  // method="get" ersetzt der Browser eine vorhandene Query in der action
  // vollstaendig durch die Formularfelder, statt sie zu ergaenzen - direkt
  // in die URL geschrieben wuerde es beim Absenden also wieder verschwinden.
  const diaryForm = document.querySelector(".md-diary");
  if (diaryForm && justFinished) {
    diaryForm.setAttribute("action", "lauf-zusammenfassung.html");
    const fromField = document.createElement("input");
    fromField.type = "hidden";
    fromField.name = "from";
    fromField.value = "tracking";
    diaryForm.append(fromField);
  }

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

  // Laufplan-Editor: Wochensumme und Sprung gegenüber der Vorwoche werden
  // beim Tippen mitgerechnet. Die Schwellen stammen aus dem Trainingskonzept
  // (A.4): über 20 Prozent Zuwachs steigt das Verletzungsrisiko deutlich.
  // Es wird nichts blockiert – die Farbe zeigt es nur an.
  const LAST_WEEK_KM = 31.6;
  const CAUTION_PERCENT = 10;
  const HIGH_PERCENT = 20;

  const weekGrid = document.querySelector("[data-week-grid]");
  const weekSum = document.querySelector("[data-week-sum]");

  if (weekGrid && weekSum) {
    const total = document.querySelector("[data-week-total]");
    const delta = document.querySelector("[data-week-delta]");
    const fill = document.querySelector("[data-week-fill]");
    const restDayHint = document.querySelector("[data-rest-day-hint]");

    const recalculate = () => {
      let kilometres = 0;
      let hasRestDay = false;
      weekGrid.querySelectorAll("input").forEach((field) => {
        const value = Number.parseFloat(field.value);
        if (Number.isFinite(value) && value > 0) {
          kilometres += value;
        } else if (value === 0) {
          hasRestDay = true;
        }
      });

      if (restDayHint) {
        restDayHint.hidden = hasRestDay;
      }

      const change = ((kilometres - LAST_WEEK_KM) / LAST_WEEK_KM) * 100;
      const rounded = Math.round(change);

      if (total) {
        total.textContent = kilometres.toFixed(1).replace(/\.0$/, "").replace(".", ",");
      }
      if (delta) {
        delta.textContent = `${rounded > 0 ? "+" : ""}${rounded} %`;
      }
      if (fill) {
        // Die Vorwoche liegt bei 70 Prozent der Breite, damit Wachstum und
        // Rückgang beide sichtbar werden. transform statt width (siehe
        // components.css): skaliert nur die Compositor-Ebene, kein Reflow
        // bei jedem Tastendruck.
        const share = Math.min(100, (kilometres / LAST_WEEK_KM) * 70);
        fill.style.transform = `scaleX(${share / 100})`;
      }

      weekSum.dataset.weekLevel =
        change > HIGH_PERCENT ? "high" : change > CAUTION_PERCENT ? "caution" : "calm";
    };

    weekGrid.addEventListener("input", recalculate);
    recalculate();
  }

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
