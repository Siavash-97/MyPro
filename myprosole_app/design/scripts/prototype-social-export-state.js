(() => {
  "use strict";

  const ALLOWED_ORIGINS = new Set(["analysis", "summary"]);
  const ALLOWED_ANALYSIS_MODES = new Set(["gps", "insole"]);
  const ALLOWED_SOURCES = new Set(["data", "ai"]);
  const backLink = document.querySelector("[data-social-export-back]");

  if (!backLink) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedSource = params.get("source");
  const source = ALLOWED_SOURCES.has(requestedSource) ? requestedSource : "data";
  const requestedOrigin = params.get("from");
  const origin = ALLOWED_ORIGINS.has(requestedOrigin)
    ? requestedOrigin
    : "analysis";
  const requestedMode = params.get("mode");
  const analysisMode = ALLOWED_ANALYSIS_MODES.has(requestedMode)
    ? requestedMode
    : "gps";

  const resultTarget =
    origin === "summary"
      ? "lauf-zusammenfassung.html"
      : `analyse-ergebnis.html?mode=${analysisMode}`;
  const studioTarget =
    origin === "summary"
      ? "social-studio.html?from=summary"
      : `social-studio.html?from=analysis&mode=${analysisMode}`;
  backLink.href = source === "ai" ? studioTarget : resultTarget;
  backLink.setAttribute(
    "aria-label",
    source === "ai" ? "Zurück zum Social-Studio" : "Zurück zum Laufergebnis",
  );

  document.querySelectorAll("[data-share-source]").forEach((element) => {
    element.hidden = element.dataset.shareSource !== source;
  });
  const title = document.querySelector("[data-share-title]");
  const downloadLabel = document.querySelector("[data-share-download-label]");
  const caption = document.querySelector("[data-share-caption]");
  if (title) {
    title.textContent = source === "ai" ? "Dein Social-Post" : "Lauf teilen";
  }
  if (downloadLabel) {
    downloadLabel.textContent =
      source === "ai" ? "PNG herunterladen" : "Laufbild herunterladen";
  }
  if (caption) {
    caption.textContent =
      source === "ai"
        ? "Vorschau für Instagram- und TikTok-Storys"
        : "Route und Laufwerte als Bild teilen";
  }

  backLink.addEventListener("click", (event) => {
    if (source === "ai" && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  });
})();
