// Minimaler Service Worker – nur zum Erfüllen der PWA-Installierbarkeits-
// Kriterien (Android Chrome "App installieren"). Kein Offline-Caching.
self.addEventListener("fetch", () => {});
