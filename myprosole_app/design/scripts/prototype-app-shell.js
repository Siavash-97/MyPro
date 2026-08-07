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
})();
