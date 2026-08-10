/*
  Anamnese – Schrittsteuerung fuer den Entwurf "Anamnese V2".

  Grundsaetze aus dem Entwurf:
  - Beide Bloecke sind VOR der ersten Frage angekuendigt; Block B erscheint
    also nie unangekuendigt (Lehre aus der Fitify-Analyse).
  - EIN durchgehender Fortschrittsbalken ueber alle Stationen. Er startet
    zwischen den Bloecken nicht neu bei null.
  - Der Verletzungs-Detailblock (d1–d5) erscheint nur nach "Ja" auf die
    Schmerzfrage; der Balken rechnet die zusaetzlichen Schritte ein.
  - "Spaeter erinnern" muss technisch halten: das Profil traegt dann eine
    Erinnerung, und ueber anamnese.html?teil=b laesst sich Block B nachholen.

  Nach den Fragen folgt die Geraete-Station: Smartwatch und Einlagen auf
  einer Seite, einzeln waehlbar, beides auch spaeter moeglich (die Wege
  dafuer stehen im Profil). Den Abschluss bildet die Zusage, dass der Plan
  aus den eigenen Antworten erstellt wurde.

  Datenhaltung: Der Zwischenstand (Schritt + Antworten) liegt im
  Sitzungsspeicher – wie jede Eingabe in diesem Prototyp: beim Schliessen
  des Fensters weg, an keinen Server uebertragen. Ohne diesen Stand begann
  die Anamnese von vorn, sobald das Telefon die Seite im Hintergrund
  verwarf und neu lud – mitten im Fragebogen ist das der sicherste Weg,
  jemanden zu verlieren. Beim Abschluss wird der Stand geloescht.
*/
(() => {
  "use strict";

  const BLOCKB_KEY = "myprosole.prototype.anamnese-blockb-offen";
  const STAND_KEY = "myprosole.prototype.anamnese-stand";

  // Erinnerung sichtbar machen, wo eine vorgesehen ist (Profil). Das steht
  // vor dem Seiten-Check, weil das Profil dieses Skript nur dafuer laedt.
  document.querySelectorAll("[data-anamnese-reminder]").forEach((element) => {
    let offen = false;
    try {
      offen = window.sessionStorage.getItem(BLOCKB_KEY) === "true";
    } catch {
      offen = false;
    }
    element.hidden = !offen;
  });

  const wurzel = document.querySelector("[data-anamnese]");
  if (!wurzel) {
    return;
  }

  const schritte = [...wurzel.querySelectorAll("[data-anamnese-schritt]")];
  const balken = document.querySelector("[data-anamnese-progress]");
  const fussleiste = wurzel.querySelector("[data-anamnese-fussleiste]");

  const BLOCK_A = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"];
  const DETAIL = ["d1", "d2", "d3", "d4", "d5"];
  const BLOCK_B = ["b1", "b2"];
  // Stationen mit eigenen Knoepfen statt der Weiter-Leiste.
  const EIGENE_KNOEPFE = new Set([
    "ankuendigung", "plan-fertig", "geraete",
    "verbinde-watch", "verbinde-einlage", "abschluss", "fertig",
  ]);
  // Feste Marken fuer den Balken nach Block A (Block A fuellt 0–70 %).
  const MARKEN = {
    "plan-fertig": 70, b1: 78, b2: 85, geraete: 90,
    "verbinde-watch": 94, "verbinde-einlage": 97, abschluss: 100, fertig: 100,
  };

  // Antworten der Auswahlfragen; Grundlage fuer Verzweigung und Balken.
  let antworten = {};
  // Geraetewahl von der Geraete-Station.
  const geraete = { watch: false, einlage: false };

  const standSchreiben = (schritt) => {
    try {
      window.sessionStorage.setItem(STAND_KEY, JSON.stringify({ schritt, antworten }));
    } catch {
      // Ohne Sitzungsspeicher beginnt ein Neuladen eben wieder vorn.
    }
  };
  const standLesen = () => {
    try {
      const roh = window.sessionStorage.getItem(STAND_KEY);
      return roh ? JSON.parse(roh) : null;
    } catch {
      return null;
    }
  };
  const standLoeschen = () => {
    try {
      window.sessionStorage.removeItem(STAND_KEY);
    } catch {
      // Siehe oben.
    }
  };

  const reihenfolge = () => {
    let pfad = [...BLOCK_A];
    if (antworten["andere-sportarten"] !== "ja") {
      pfad = pfad.filter((s) => s !== "a7");
    }
    if (antworten["schmerzen"] === "ja") {
      const nach = pfad.indexOf("a8") + 1;
      pfad = [...pfad.slice(0, nach), ...DETAIL, ...pfad.slice(nach)];
    }
    return ["ankuendigung", ...pfad, "plan-fertig", ...BLOCK_B, "geraete", "abschluss"];
  };

  let aktuell = "ankuendigung";
  let nurTeilB = false;

  const zeigen = (schritt) => {
    aktuell = schritt;
    schritte.forEach((element) => {
      element.hidden = element.getAttribute("data-anamnese-schritt") !== schritt;
    });
    if (fussleiste) {
      fussleiste.hidden = EIGENE_KNOEPFE.has(schritt);
    }
    fortschritt();
    standSchreiben(schritt);
    wurzel.scrollTop = 0;
  };

  const fortschritt = () => {
    if (!balken) {
      return;
    }
    const pfad = reihenfolge();
    const aTeil = pfad.slice(1, pfad.indexOf("plan-fertig"));
    let anteil = 0;
    if (aktuell === "ankuendigung") {
      anteil = 0;
    } else if (aTeil.includes(aktuell)) {
      anteil = ((aTeil.indexOf(aktuell) + 1) / aTeil.length) * 70;
    } else {
      anteil = MARKEN[aktuell] ?? 100;
    }
    balken.style.width = `${Math.round(anteil)}%`;
  };

  const beantwortet = (schritt) => {
    const element = schritte.find(
      (e) => e.getAttribute("data-anamnese-schritt") === schritt,
    );
    const gruppen = new Set(
      [...element.querySelectorAll('input[type="radio"]')].map((e) => e.name),
    );
    for (const name of gruppen) {
      const gewaehlt = element.querySelector(`input[name="${name}"]:checked`);
      const sichtbar = element.querySelector(`input[name="${name}"]`).closest("[hidden]") === null;
      if (!gewaehlt && sichtbar) {
        return false;
      }
    }
    return true;
  };

  const weiter = () => {
    if (aktuell !== "ankuendigung" && !beantwortet(aktuell)) {
      hinweis("Bitte wähle eine Antwort aus.");
      return;
    }
    if (nurTeilB) {
      // Nachholen aus dem Profil: nur b1 -> b2 -> Danke.
      zeigen(aktuell === "b1" ? "b2" : "fertig");
      return;
    }
    const pfad = reihenfolge();
    const index = pfad.indexOf(aktuell);
    if (index >= 0 && index < pfad.length - 1) {
      zeigen(pfad[index + 1]);
    }
  };

  let einblendung = null;
  let abblenden = 0;
  const hinweis = (text) => {
    if (!einblendung) {
      einblendung = document.createElement("p");
      einblendung.className = "md-snackbar";
      einblendung.setAttribute("role", "status");
      document.body.append(einblendung);
    }
    einblendung.textContent = text;
    einblendung.classList.add("md-snackbar--visible");
    window.clearTimeout(abblenden);
    abblenden = window.setTimeout(() => {
      einblendung.classList.remove("md-snackbar--visible");
    }, 2600);
  };

  const folgenAktualisieren = () => {
    wurzel.querySelectorAll("[data-anamnese-folge]").forEach((folge) => {
      const [name, wert] = folge.getAttribute("data-anamnese-folge").split("=");
      folge.hidden = antworten[name] !== wert;
    });
  };

  wurzel.addEventListener("change", (ereignis) => {
    const feld = ereignis.target;
    if (feld.type === "radio") {
      antworten[feld.name] = feld.value;
      standSchreiben(aktuell);
    }
    folgenAktualisieren();
  });

  // Stepper: robuste Zahleneingabe ohne Freitext.
  wurzel.querySelectorAll("[data-anamnese-stepper]").forEach((stepper) => {
    const wert = stepper.querySelector(".md-stepper__value");
    const min = Number(stepper.getAttribute("data-min"));
    const max = Number(stepper.getAttribute("data-max"));
    const setzen = (neu) => {
      wert.value = String(Math.min(max, Math.max(min, neu)));
    };
    stepper.querySelector("[data-stepper-minus]").addEventListener("click", () => {
      setzen(Number(wert.value) - 1);
    });
    stepper.querySelector("[data-stepper-plus]").addEventListener("click", () => {
      setzen(Number(wert.value) + 1);
    });
  });

  wurzel.querySelectorAll("[data-anamnese-weiter]").forEach((knopf) => {
    knopf.addEventListener("click", weiter);
  });

  // Block-B-Wahl. Alle drei Wege fuehren weiter zur Geraete-Station –
  // Block B versperrt nie etwas, uebersprungen wird er nur schneller.
  wurzel.querySelectorAll("[data-anamnese-blockb]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      const wahl = knopf.getAttribute("data-anamnese-blockb");
      try {
        if (wahl === "spaeter") {
          window.sessionStorage.setItem(BLOCKB_KEY, "true");
        } else {
          window.sessionStorage.removeItem(BLOCKB_KEY);
        }
      } catch {
        // Ohne Sitzungsspeicher entfaellt nur die spaetere Erinnerung.
      }
      zeigen(wahl === "jetzt" ? "b1" : "geraete");
    });
  });

  // Geraete-Station: Auswahl einsammeln, dann der Reihe nach verbinden.
  const geraeteWahl = () => {
    geraete.watch = !!wurzel.querySelector('input[name="geraet-watch"]:checked');
    geraete.einlage = !!wurzel.querySelector('input[name="geraet-einlage"]:checked');
  };
  wurzel.querySelectorAll("[data-anamnese-verbinden]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      geraeteWahl();
      if (!geraete.watch && !geraete.einlage) {
        hinweis("Wähle ein Gerät aus – oder tippe auf „Später verbinden“.");
        return;
      }
      zeigen(geraete.watch ? "verbinde-watch" : "verbinde-einlage");
    });
  });
  wurzel.querySelectorAll("[data-anamnese-geraete-spaeter]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      zeigen("abschluss");
    });
  });
  wurzel.querySelectorAll("[data-anamnese-verbunden]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      if (aktuell === "verbinde-watch" && geraete.einlage) {
        zeigen("verbinde-einlage");
      } else {
        zeigen("abschluss");
      }
    });
  });

  // Abschluss: Stand und – nach Block B – auch die Erinnerung aufraeumen.
  wurzel.querySelectorAll("[data-anamnese-abschluss]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      standLoeschen();
      if (nurTeilB || antworten["schlaf"]) {
        try {
          window.sessionStorage.removeItem(BLOCKB_KEY);
        } catch {
          // Siehe oben.
        }
      }
    });
  });

  // Einstieg. ?teil=b holt Block B aus der Profil-Erinnerung nach; sonst
  // wird ein unterbrochener Durchlauf an derselben Stelle fortgesetzt.
  const teilB = new URLSearchParams(window.location.search).get("teil") === "b";
  if (teilB) {
    nurTeilB = true;
    standLoeschen();
    zeigen("b1");
  } else {
    const stand = standLesen();
    if (stand && stand.schritt && stand.schritt !== "ankuendigung") {
      antworten = stand.antworten || {};
      // Die gemerkten Auswahlantworten zurueck in die Felder, damit die
      // Pruefung "erst antworten, dann weiter" nicht doppelt fragt.
      Object.entries(antworten).forEach(([name, wert]) => {
        const feld = wurzel.querySelector(`input[name="${name}"][value="${wert}"]`);
        if (feld) {
          feld.checked = true;
        }
      });
      folgenAktualisieren();
      zeigen(stand.schritt);
    } else {
      zeigen("ankuendigung");
    }
  }
})();
