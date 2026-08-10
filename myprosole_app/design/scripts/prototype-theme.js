/*
  Helles oder dunkles Design – die Wahl trifft die Person, nicht das Geraet.

  Frueher hing das Thema an der Systemeinstellung. Das wurde geloest, weil
  waehrend der Abstimmung ueberall dasselbe zu sehen sein muss. Jetzt gibt es
  den Schalter im Profil, und damit gehoert die Entscheidung dorthin, wo sie
  hingehoert.

  Daneben stehen die Paletten-Schalter: die Logo-Palette (Violett aus dem
  PRO), die Vital-Palette (Petrol, hergeleitet aus Zielgruppe und
  Wettbewerb) und Set B (das gelieferte Farbsystem aus LOGO/Farbe: Cyan fuer
  Aktionen, Indigo als Markenbasis). Alle tauschen die Strukturfarben aus,
  damit die Farbwelten am lebenden Entwurf verglichen werden koennen. Es
  kann nur eine zugleich an sein – ein Mischmasch waere kein Vergleich.
  Nach der Entscheidung bleibt eine Palette und die Schalter fliegen raus.

  Dieses Skript steht im <head> und nicht am Seitenende. Am Ende wuerde die
  Seite erst hell aufblitzen und dann umspringen – bei jedem Wechsel des
  Screens erneut.

  Gespeichert werden zwei einzelne Woerter im Sitzungsspeicher: das Thema
  ("dark" oder "light") und die Palette ("logo", "vital" oder "standard").
  Nichts ueber die Person, und beim Schliessen des Fensters ist es weg.
*/
(() => {
  "use strict";

  const THEMA_KEY = "myprosole.prototype.theme";
  const DARK = "dark";
  const LIGHT = "light";
  const ERLAUBT = new Set([DARK, LIGHT]);

  const PALETTE_KEY = "myprosole.prototype.palette";
  const LOGO = "logo";
  const VITAL = "vital";
  const SETB = "setb";
  const STANDARD = "standard";
  const PALETTEN = new Set([LOGO, VITAL, SETB, STANDARD]);

  // Farbe der Statusleiste des Telefons. Sie soll zur Flaeche darunter passen,
  // sonst sitzt im dunklen Design ein heller Streifen ueber dem Screen.
  // Pro Palette und Thema eine eigene Farbe: hell traegt die Strukturfarbe,
  // dunkel den jeweiligen Flaechenton.
  const STATUSLEISTE = {
    [STANDARD]: { [LIGHT]: "#16213E", [DARK]: "#0D0F16" },
    [LOGO]: { [LIGHT]: "#460059", [DARK]: "#120D18" },
    [VITAL]: { [LIGHT]: "#0F5257", [DARK]: "#0D1414" },
    [SETB]: { [LIGHT]: "#272053", [DARK]: "#13161F" },
  };

  const lesen = (key, erlaubt, sonst) => {
    try {
      const wert = window.sessionStorage.getItem(key);
      return erlaubt.has(wert) ? wert : sonst;
    } catch {
      return sonst;
    }
  };

  const schreiben = (key, wert) => {
    try {
      window.sessionStorage.setItem(key, wert);
    } catch {
      // Ohne Sitzungsspeicher gilt die Wahl nur fuer diesen Screen.
    }
  };

  const anwenden = () => {
    const thema = lesen(THEMA_KEY, ERLAUBT, LIGHT);
    const palette = lesen(PALETTE_KEY, PALETTEN, STANDARD);
    document.documentElement.dataset.theme = thema;
    if (palette === STANDARD) {
      delete document.documentElement.dataset.palette;
    } else {
      document.documentElement.dataset.palette = palette;
    }
    const marke = document.querySelector('meta[name="theme-color"]');
    if (marke) {
      marke.setAttribute("content", STATUSLEISTE[palette][thema]);
    }
    // Die Paletten-Schalter schliessen sich gegenseitig aus. Wer Vital
    // anschaltet, sieht Logo in derselben Sekunde ausgehen – ohne diese
    // Zeile staenden beide auf "an" und niemand wuesste, was gerade gilt.
    document.querySelectorAll("[data-palette-switch]").forEach((schalter) => {
      schalter.checked = schalter.getAttribute("data-palette-switch") === palette;
    });
  };

  anwenden();

  // Die Schalter selbst stehen erst im Body, deshalb hier warten.
  document.addEventListener("DOMContentLoaded", () => {
    anwenden();
    document.querySelectorAll("[data-theme-switch]").forEach((schalter) => {
      schalter.checked = lesen(THEMA_KEY, ERLAUBT, LIGHT) === DARK;
      schalter.addEventListener("change", () => {
        schreiben(THEMA_KEY, schalter.checked ? DARK : LIGHT);
        anwenden();
      });
    });
    document.querySelectorAll("[data-palette-switch]").forEach((schalter) => {
      const eigene = schalter.getAttribute("data-palette-switch");
      if (!PALETTEN.has(eigene)) {
        return;
      }
      schalter.addEventListener("change", () => {
        schreiben(PALETTE_KEY, schalter.checked ? eigene : STANDARD);
        anwenden();
      });
    });
  });
})();
