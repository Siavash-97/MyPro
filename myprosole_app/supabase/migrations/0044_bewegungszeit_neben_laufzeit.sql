-- Bewegungszeit neben der Laufzeit
--
-- Bisher gab es nur duration_s: die Zeit vom Startknopf bis zum Stopp,
-- abzueglich ausdruecklicher Pausen. Damit war der Schnitt eines Laufs
-- falsch, sobald jemand an einer Ampel stand - die Wartezeit ging in die
-- Pace ein.
--
-- Getrennt wird jetzt wie bei Strava:
--
--   duration_s     was die Uhr sagt
--   moving_time_s  was davon unterwegs verbracht wurde
--
-- Bewegung heisst dabei: Der Empfaenger meldete mindestens 0,9 m/s - das
-- sind 3,2 km/h, Stravas dokumentierte Schwelle ("30-minute mile pace").
-- Die Herleitung steht in docs/gps-genauigkeit.md, Teil 3.
--
-- Nur erweitern, nichts wegnehmen: Die Datenbank aktualisiert sich fuer alle
-- sofort, die App auf dem Telefon nicht. Eine aeltere App-Fassung schreibt
-- weiter nur duration_s, und das muss weiter gehen.

alter table public.runs
  add column if not exists moving_time_s integer;

comment on column public.runs.moving_time_s is
  'Sekunden, in denen Bewegung erkannt wurde. Null bei Laeufen, die vor der '
  'Bewegungserkennung aufgezeichnet wurden - dort ist die Angabe unbekannt, '
  'nicht null.';

-- Bewusst NICHT nachgetragen: Fuer alte Laeufe koennte man moving_time_s auf
-- duration_s setzen. Das waere eine Behauptung, keine Messung - niemand weiss,
-- ob dabei gestanden wurde. Null heisst hier ehrlich "unbekannt".

-- Was drinsteht, muss plausibel sein: Bewegungszeit kann nicht negativ und
-- nicht laenger als die Laufzeit sein. Ohne Pruefung waere ein Rechenfehler
-- in der App still in den Daten gelandet.
--
-- not valid: Die Regel gilt ab sofort fuer neue und geaenderte Zeilen, ohne
-- den Bestand zu pruefen. Alte Zeilen tragen null und verletzen sie ohnehin
-- nicht - aber so bleibt die Migration auch dann schnell, wenn spaeter viele
-- Laeufe drinstehen.
alter table public.runs
  drop constraint if exists runs_moving_time_plausibel;

alter table public.runs
  add constraint runs_moving_time_plausibel
  check (
    moving_time_s is null
    or (moving_time_s >= 0 and (duration_s is null or moving_time_s <= duration_s))
  )
  not valid;
