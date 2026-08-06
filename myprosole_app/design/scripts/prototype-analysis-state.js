(() => {
  "use strict";

  const ANALYSIS_MODE_PARAM = "mode";
  const GPS_MODE = "gps";
  const INSOLE_MODE = "insole";
  const TRAINING_PERSONALIZATION_KEY =
    "myprosole.prototype.training-personalization";
  const ACCEPTED = "accepted";
  const DECLINED = "declined";
  const ALLOWED_DECISIONS = new Set([ACCEPTED, DECLINED]);

  const requestedMode = new URLSearchParams(window.location.search).get(
    ANALYSIS_MODE_PARAM,
  );
  const analysisMode = requestedMode === INSOLE_MODE ? INSOLE_MODE : GPS_MODE;

  document.querySelectorAll("[data-analysis-mode]").forEach((element) => {
    element.hidden = element.dataset.analysisMode !== analysisMode;
  });

  // Weg in die Laufanalyse, z. B. aus der Laufzusammenfassung heraus. Der
  // Modus wird mitgenommen, damit dort derselbe Lauf im selben Zustand steht.
  document.querySelectorAll("[data-analysis-entry]").forEach((link) => {
    link.href = `analyse-ergebnis.html?mode=${analysisMode}`;
  });

  document.querySelectorAll("[data-social-entry]").forEach((link) => {
    link.href = `social-studio.html?from=analysis&mode=${analysisMode}`;
  });
  document.querySelectorAll("[data-data-share-entry]").forEach((link) => {
    link.href = `share-export.html?source=data&from=analysis&mode=${analysisMode}`;
  });

  if (analysisMode !== INSOLE_MODE) {
    return;
  }

  const readDecision = () => {
    try {
      const decision = window.sessionStorage.getItem(
        TRAINING_PERSONALIZATION_KEY,
      );
      return ALLOWED_DECISIONS.has(decision) ? decision : null;
    } catch {
      return null;
    }
  };

  const writeDecision = (decision) => {
    if (!ALLOWED_DECISIONS.has(decision)) {
      return;
    }
    try {
      window.sessionStorage.setItem(TRAINING_PERSONALIZATION_KEY, decision);
    } catch {
      // Die Vorschau bleibt auch ohne verfügbaren Sitzungsspeicher bedienbar.
    }
  };

  const renderDecision = (decision) => {
    const prompt = document.querySelector("[data-training-consent-prompt]");
    const status = document.querySelector("[data-training-consent-status]");
    const title = document.querySelector("[data-training-consent-title]");
    const copy = document.querySelector("[data-training-consent-copy]");

    if (!prompt || !status || !title || !copy) {
      return;
    }

    prompt.hidden = decision !== null;
    status.hidden = decision === null;
    if (decision === ACCEPTED) {
      title.textContent = "Personalisierung ist aktiviert";
      copy.textContent =
        "Wir informieren dich, bevor eine erkannte Veränderung deinen Übungsplan anpasst.";
    } else if (decision === DECLINED) {
      title.textContent = "Übungen bleiben unverändert";
      copy.textContent =
        "Diese Laufanalyse verändert deine Übungen nicht. Du kannst später neu entscheiden.";
    }
  };

  document.querySelectorAll("[data-training-consent]").forEach((button) => {
    button.addEventListener("click", () => {
      const decision = button.dataset.trainingConsent;
      if (!ALLOWED_DECISIONS.has(decision)) {
        return;
      }
      writeDecision(decision);
      renderDecision(decision);
    });
  });

  renderDecision(readDecision());
})();
