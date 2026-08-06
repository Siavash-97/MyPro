/*
  Zykluskalender – Zustand des klickbaren Prototyps.

  Zyklusdaten sind Gesundheitsdaten nach DSGVO Art. 9. Dieser Prototyp hält
  deshalb bewusst KEINE Zyklusdaten: keine Perioden-Tage, keine Zykluslänge,
  kein Datum und auch nicht die gewählte Geschlechtsangabe. Gespeichert werden
  ausschließlich drei validierte Zustände, die der Klickablauf braucht:

    - ob der Kalender im Profil angeboten wird,
    - ob die Einwilligung erteilt wurde,
    - ob der Zyklus regelmäßig oder unregelmäßig erfasst wird.

  Die Geschlechtsangabe wird beim Absenden nur gelesen, um daraus einen
  booleschen Zustand abzuleiten; der Wert selbst verlässt die Funktion nicht.
  Die echte App speichert ihn im normalen Profildatensatz.
*/
(() => {
  "use strict";

  const ELIGIBLE_KEY = "myprosole.prototype.cycle-eligible";
  const CONSENT_KEY = "myprosole.prototype.cycle-consent";
  const MODE_KEY = "myprosole.prototype.cycle-mode";

  const ELIGIBLE_SEX = "female";
  const GRANTED = "granted";
  const REGULAR = "regular";
  const IRREGULAR = "irregular";

  const ALLOWED_CONSENT = new Set([GRANTED]);
  const ALLOWED_MODES = new Set([REGULAR, IRREGULAR]);

  const read = (key, allowed) => {
    try {
      const value = window.sessionStorage.getItem(key);
      return allowed.has(value) ? value : null;
    } catch {
      return null;
    }
  };

  const write = (key, value, allowed) => {
    if (!allowed.has(value)) {
      return;
    }
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Die Vorschau bleibt auch ohne verfügbaren Sitzungsspeicher bedienbar.
    }
  };

  const clear = (key) => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Siehe oben.
    }
  };

  const readFlag = (key) => {
    try {
      return window.sessionStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  };

  const writeFlag = (key, enabled) => {
    try {
      if (enabled) {
        window.sessionStorage.setItem(key, "true");
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Siehe oben.
    }
  };

  const forgetEverything = () => {
    clear(CONSENT_KEY);
    clear(MODE_KEY);
  };

  // Profileinrichtung: aus der Auswahl wird ein boolescher Zustand. Die
  // Auswahl selbst wird nicht abgelegt.
  document.querySelectorAll("[data-cycle-eligibility]").forEach((field) => {
    const form = field.closest("form");
    if (!form) {
      return;
    }
    form.addEventListener("submit", () => {
      const eligible = field.value === ELIGIBLE_SEX;
      writeFlag(ELIGIBLE_KEY, eligible);
      if (!eligible) {
        forgetEverything();
      }
    });
  });

  const eligible = readFlag(ELIGIBLE_KEY);
  const consent = read(CONSENT_KEY, ALLOWED_CONSENT);

  // Wie in der Laufanalyse kann die Erfassungsart zum Ansehen ueber die URL
  // vorgegeben werden. Sonst waere der Kalender beim direkten Oeffnen ohne
  // Sitzungszustand halb leer. Ein gueltiger Parameter hat Vorrang, danach
  // die getroffene Wahl, sonst die regelmaessige Ansicht.
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  const mode = ALLOWED_MODES.has(requestedMode)
    ? requestedMode
    : read(MODE_KEY, ALLOWED_MODES) || REGULAR;

  document.querySelectorAll("[data-cycle-entry]").forEach((element) => {
    element.hidden = !eligible;
  });

  document.querySelectorAll("[data-cycle-status]").forEach((element) => {
    element.textContent = consent === GRANTED ? "Aktiv" : "Nicht eingerichtet";
  });

  // Einwilligung erteilen und Erfassungsart wählen.
  document.querySelectorAll("[data-cycle-mode]").forEach((element) => {
    element.addEventListener("click", () => {
      const chosen = element.dataset.cycleMode;
      if (!ALLOWED_MODES.has(chosen)) {
        return;
      }
      write(CONSENT_KEY, GRANTED, ALLOWED_CONSENT);
      write(MODE_KEY, chosen, ALLOWED_MODES);
    });
  });

  // Löschen: der Prototyp zeigt damit den Weg, den die echte App für das
  // Widerrufen der Einwilligung und das Entfernen der Daten braucht.
  document.querySelectorAll("[data-cycle-forget]").forEach((element) => {
    element.addEventListener("click", () => {
      forgetEverything();
    });
  });

  document.querySelectorAll("[data-cycle-view]").forEach((element) => {
    const expected = element.dataset.cycleView;
    if (expected === "consent") {
      element.hidden = consent === GRANTED;
    } else if (expected === "calendar") {
      element.hidden = consent !== GRANTED;
    } else if (ALLOWED_MODES.has(expected)) {
      element.hidden = mode !== expected;
    }
  });
})();
