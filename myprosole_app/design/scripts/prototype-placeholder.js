/*
  Bedienelemente, die es im Entwurf noch nicht gibt.

  Ein Prototyp ist nie vollstaendig. Entscheidend ist, was passiert, wenn
  jemand auf etwas tippt, das noch nicht angelegt ist. Bisher passierte
  entweder nichts – dann haelt man den Knopf fuer kaputt und meldet einen
  Fehler, den es nicht gibt – oder die Seite lud sich neu, weil href=""
  auf die eigene Adresse zeigt. Beides kostet in einer Testrunde Zeit und
  Glaubwuerdigkeit.

  Stattdessen sagt der Entwurf es: eine kurze Einblendung, dass dieser Teil
  noch nicht angelegt ist.

  Erkannt wird automatisch, nicht von Hand gepflegt. Regel: Wer ein
  Bedienelement verdrahtet, gibt ihm ein data-Attribut – so arbeiten alle
  Prototyp-Skripte hier. Was weder Ziel noch Formular noch data-Attribut hat,
  ist offen. Damit bekommt auch jeder kuenftige Knopf die Behandlung, ohne
  dass jemand daran denken muss.

  Die Elemente sehen unveraendert aus. Ein Entwurf voller ausgegrauter
  Knoepfe zeigt nicht mehr, wie die App wirken soll – und genau darum geht es
  in dieser Phase.
*/
(() => {
  "use strict";

  const HINWEIS = "Dieser Teil ist im Entwurf noch nicht angelegt.";
  const DAUER = 2600;

  const istOffen = (element) => {
    // Ein data-Attribut heisst: ein Skript kuemmert sich darum.
    if (Object.keys(element.dataset).length > 0) {
      return false;
    }
    if (element.tagName === "A") {
      const ziel = element.getAttribute("href");
      return !ziel || ziel === "#";
    }
    if (element.tagName === "BUTTON") {
      const art = (element.getAttribute("type") || "submit").toLowerCase();
      if (art !== "submit") {
        return true;
      }
      const formular = element.closest("form");
      if (!formular) {
        return true;
      }
      // Ein Formular ist bedient, wenn es ein Ziel hat oder wenn ein Skript
      // sein Absenden uebernimmt. Letzteres traegt – wie ueberall hier – ein
      // data-Attribut, und zwar am Formular, nicht am Knopf. Ohne diesen Fall
      // haette die Erkennung das Absenden im Social-Studio abgewuergt.
      return !formular.getAttribute("action") && Object.keys(formular.dataset).length === 0;
    }
    return false;
  };

  const offene = [...document.querySelectorAll("a, button")].filter(istOffen);

  offene.forEach((element) => {
    element.dataset.entwurfOffen = "";
    // Ein <a> ohne Ziel ist weder mit der Tastatur erreichbar noch wird es
    // als Bedienelement angesagt. Beides nachgeruestet.
    if (element.tagName === "A") {
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
    }
  });

  if (offene.length === 0) {
    return;
  }

  let einblendung = null;
  let abblenden = 0;

  const zeigen = () => {
    if (!einblendung) {
      einblendung = document.createElement("p");
      einblendung.className = "md-snackbar";
      // Vorlesesoftware soll den Hinweis melden, ohne den Fokus zu stehlen.
      einblendung.setAttribute("role", "status");
      document.body.append(einblendung);
    }
    einblendung.textContent = HINWEIS;
    einblendung.classList.add("md-snackbar--visible");

    window.clearTimeout(abblenden);
    abblenden = window.setTimeout(() => {
      einblendung.classList.remove("md-snackbar--visible");
    }, DAUER);
  };

  const behandeln = (ereignis) => {
    const element = ereignis.target.closest("[data-entwurf-offen]");
    if (!element) {
      return;
    }
    // href="" zeigt auf die eigene Adresse und wuerde die Seite neu laden.
    ereignis.preventDefault();
    zeigen();
  };

  document.addEventListener("click", behandeln);
  document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key === "Enter" || ereignis.key === " ") {
      const element = ereignis.target.closest?.("[data-entwurf-offen]");
      if (element && element.tagName === "A") {
        behandeln(ereignis);
      }
    }
  });
})();
