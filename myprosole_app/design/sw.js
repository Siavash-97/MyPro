/*
  Service Worker – macht den Prototyp offline benutzbar.

  Was hier zwischengespeichert wird, sind ausschliesslich die Dateien des
  Entwurfs: HTML, Stylesheets, Skripte, Symbole. Nichts, was jemand eingibt.
  Der Prototyp legt Eingaben ohnehin nur im Sitzungsspeicher ab, und der ist
  beim Schliessen des Fensters weg.

  Alles kommt zuerst aus dem Netz, der Speicher ist nur die Rueckfalloption.

  Das ist langsamer als der uebliche Weg, Stylesheets und Skripte zuerst aus
  dem Speicher zu nehmen. Aber solange am Design taeglich etwas geaendert wird,
  waere der uebliche Weg eine Falle: Testende bekaemen eine Korrektur erst beim
  zweiten Start zu sehen und meldeten in der Zwischenzeit Fehler, die es
  laengst nicht mehr gibt. Ein Entwurf, ueber den man sich unterhalten will,
  muss zeigen, was gerade gilt.

  Offline funktioniert es trotzdem: was einmal geladen wurde, liegt im
  Speicher und wird genommen, sobald das Netz fehlt.
*/
/* Die Nummer steigt, wenn ein alter Speicherbestand Schaden anrichten kann:
   beim Wechsel auf v3 hatte ein Telefon die neue Profilseite samt
   Paletten-Schalter, aber noch das alte Stylesheet ohne die Farben dazu –
   der Schalter tat sichtbar nichts. Mit neuer Nummer wirft activate den
   kompletten alten Bestand weg, statt Neues und Altes zu mischen. */
const CACHE = "myprosole-prototyp-v3";

self.addEventListener("install", (event) => {
  // Sofort uebernehmen. Ein Prototyp, der zwei Versionen parallel haelt, waere
  // in einer Testrunde nur verwirrend.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        "manifest.webmanifest",
        "design-system/tokens.css",
        "design-system/components.css",
        "icons/icon-192.png",
        "icons/icon-512.png",
      ]),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

const put = async (request, response) => {
  // Nur vollstaendige eigene Antworten. Eine Teilantwort nimmt der Speicher
  // nicht an, und ein gescheiterter Speicherversuch darf niemals die Antwort
  // mitreissen – die Seite soll ausgeliefert werden, ob sie im Speicher landet
  // oder nicht.
  if (response && response.status === 200 && response.type === "basic") {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    } catch {
      // Nicht speicherbar ist kein Grund, nichts anzuzeigen.
    }
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nur eigene Dateien und nur Abrufe. Alles andere geht unveraendert durch.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Ein Video holt sich der Browser nicht am Stueck, sondern abschnittsweise:
  // "gib mir ab Byte 0" – und bekommt eine Teilantwort zurueck. Solche
  // Antworten laesst der Speicher nicht zu; der Versuch scheiterte und riss
  // die ganze Antwort mit, das Video kam nie an. Auf dem Rechner fiel das
  // nicht auf, weil der Browser dort oft die ganze Datei am Stueck holt. Auf
  // dem Telefon blieb der Laufhintergrund des Willkommensbildschirms weg.
  //
  // Abschnittsweise Anfragen gehen deshalb am Service Worker vorbei und
  // direkt ans Netz. Ohne Netz bleibt das Video weg und der Platzhalter
  // darunter uebernimmt – das ist der Zustand, den es vorher immer hatte.
  if (request.headers.has("range")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => put(request, response))
      .catch(() =>
        caches
          .match(request)
          .then((hit) =>
            hit ||
            // Eine unbekannte Seite ohne Netz: lieber der Einstieg als ein
            // Fehlerbildschirm des Browsers.
            (request.mode === "navigate" ? caches.match("mockups/welcome.html") : undefined),
          ),
      ),
  );
});
