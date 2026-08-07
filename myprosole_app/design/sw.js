/*
  Service Worker – macht den Prototyp offline benutzbar.

  Was hier zwischengespeichert wird, sind ausschliesslich die Dateien des
  Entwurfs: HTML, Stylesheets, Skripte, Symbole. Nichts, was jemand eingibt.
  Der Prototyp legt Eingaben ohnehin nur im Sitzungsspeicher ab, und der ist
  beim Schliessen des Fensters weg.

  Zwei Strategien, aus einem Grund:

  - Seiten holen wir zuerst aus dem Netz. Wer den Link testet, soll den
    aktuellen Stand sehen, nicht den von letzter Woche. Erst wenn kein Netz da
    ist, kommt die zwischengespeicherte Fassung.
  - Stylesheets, Skripte und Symbole kommen zuerst aus dem Speicher, werden
    aber im Hintergrund erneuert. Das haelt die Screens schnell, ohne dass eine
    Aenderung dauerhaft haengen bleibt.
*/
const CACHE = "myprosole-prototyp-v1";

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
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nur eigene Dateien und nur Abrufe. Alles andere geht unveraendert durch.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => put(request, response))
        .catch(() => caches.match(request).then((hit) => hit || caches.match("mockups/welcome.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const fromNetwork = fetch(request)
        .then((response) => put(request, response))
        .catch(() => hit);
      return hit || fromNetwork;
    }),
  );
});
