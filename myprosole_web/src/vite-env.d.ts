/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Kartenkacheln von MapTiler. Fehlt der Schluessel, zeigt RouteMap die
   *  gezeichnete Flaeche aus dem Entwurf – die App laeuft also auch ohne. */
  readonly VITE_MAPTILER_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
