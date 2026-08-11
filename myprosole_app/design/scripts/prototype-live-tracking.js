/*
  Live-Tracking – Herzfrequenz nur mit verbundener Smartwatch.

  Kein Sensor, kein Puls: ohne verbundenes Geraet gibt es keine echte
  Herzfrequenz zum Anzeigen, deshalb bleibt die Kachel weg statt einen Wert
  vorzutaeuschen. "Verbunden" ist hier ein Vorschauparameter
  (?smartwatch=verbunden), kein echter Bluetooth-Zustand - derselbe Ansatz
  wie ?mode=insole fuer die Laufanalyse.
*/
(() => {
  "use strict";

  const smartwatchVerbunden =
    new URLSearchParams(window.location.search).get("smartwatch") === "verbunden";

  document.querySelectorAll("[data-smartwatch-only]").forEach((element) => {
    element.hidden = !smartwatchVerbunden;
  });
})();
