/*
  Helles oder dunkles Design – die Wahl trifft die Person, nicht das Geraet.

  Frueher haing das Thema an der Systemeinstellung. Das wurde geloest, weil
  waehrend der Abstimmung ueberall dasselbe zu sehen sein muss. Jetzt gibt es
  den Schalter im Profil, und damit gehoert die Entscheidung dorthin, wo sie
  hingehoert.

  Dieses Skript steht im <head> und nicht am Seitenende. Am Ende wuerde die
  Seite erst hell aufblitzen und dann umspringen – bei jedem Wechsel des
  Screens erneut.

  Gespeichert wird ein einziges Wort im Sitzungsspeicher: "dark" oder "light".
  Nichts ueber die Person, und beim Schliessen des Fensters ist es weg.
*/
(() => {
  "use strict";

  const KEY = "myprosole.prototype.theme";
  const DARK = "dark";
  const LIGHT = "light";
  const ERLAUBT = new Set([DARK, LIGHT]);

  // Farbe der Statusleiste des Telefons. Sie soll zur Flaeche darunter passen,
  // sonst sitzt im dunklen Design ein heller Streifen ueber dem Screen.
  const STATUSLEISTE = { [DARK]: "#0D0F16", [LIGHT]: "#16213E" };

  const lesen = () => {
    try {
      const wert = window.sessionStorage.getItem(KEY);
      return ERLAUBT.has(wert) ? wert : LIGHT;
    } catch {
      return LIGHT;
    }
  };

  const schreiben = (wert) => {
    if (!ERLAUBT.has(wert)) {
      return;
    }
    try {
      window.sessionStorage.setItem(KEY, wert);
    } catch {
      // Ohne Sitzungsspeicher gilt die Wahl nur fuer diesen Screen.
    }
  };

  const anwenden = (wert) => {
    document.documentElement.dataset.theme = wert;
    const marke = document.querySelector('meta[name="theme-color"]');
    if (marke) {
      marke.setAttribute("content", STATUSLEISTE[wert]);
    }
  };

  anwenden(lesen());

  // Der Schalter selbst steht erst im Body, deshalb hier warten.
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-switch]").forEach((schalter) => {
      schalter.checked = lesen() === DARK;
      schalter.addEventListener("change", () => {
        const wert = schalter.checked ? DARK : LIGHT;
        schreiben(wert);
        anwenden(wert);
      });
    });
  });
})();
