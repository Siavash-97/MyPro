/*
  Meldet den Service Worker an, damit sich der Prototyp auf dem Telefon
  installieren und ohne Netz bedienen laesst.

  Kein Zustand, keine Daten. Der einzige sichtbare Effekt ist die Klasse
  "is-installed" am <html>-Element, sobald die Seite ohne Browser-Rahmen
  laeuft – daran haengt der Abstand zur Statusleiste.
*/
(() => {
  "use strict";

  // Ohne HTTPS gibt es keinen Service Worker. Beim Vorschau-Server im WLAN ist
  // das normal; die Screens funktionieren dort trotzdem, nur eben nicht offline.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("../sw.js", document.baseURI)).catch(() => {
        // Ohne sicheren Kontext oder im privaten Fenster nicht moeglich.
        // Der Prototyp bleibt vollstaendig bedienbar.
      });
    });
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (standalone) {
    document.documentElement.classList.add("is-installed");
  }

  /*
    Hoehe des sichtbaren Bereichs nachmessen.

    Vom Startbildschirm gestartet meldet Android fuer 100dvh die volle
    Bildschirmhoehe – einschliesslich des Streifens, in dem das System seine
    eigene Navigationsleiste zeichnet. Der Rahmen wird dadurch hoeher als das,
    was man sieht, und unsere Leiste rutscht dahinter. Im Browser faellt das
    nicht auf, weil die Adresszeile den Unterschied ohnehin aufbraucht.

    window.innerHeight meldet den Bereich, der tatsaechlich zur Verfuegung
    steht. Der Abstand zur Systemleiste bleibt Sache von env(safe-area-inset-*)
    in components.css – beides zusammen deckt beide Faelle ab.
  */
  const measure = () => {
    document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
  };

  measure();
  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", measure);
})();
