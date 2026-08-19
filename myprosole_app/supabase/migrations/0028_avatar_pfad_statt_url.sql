-- ============================================================
-- 0028: Das Profilbild darf ein Pfad sein
-- ============================================================
-- Der Fehler
-- ----------
-- Das Profilbild liess sich auf dem Telefon nicht speichern. Das Hochladen
-- gelang, das Eintragen ins Profil nicht.
--
-- Die Ursache liegt zwischen zwei Migrationen, die einzeln richtig sind:
--
--   0011 hat verboten, dass in avatar_url etwas anderes steht als eine
--   https-Adresse. Der Grund war gut: Ein Angreifer sollte dort kein
--   "javascript:" oder "data:" unterbringen koennen.
--
--   0022 hat entschieden, dass dort gar keine Adresse mehr steht, sondern
--   der Pfad im Behaelter – "<Kennung>/<Datei>.jpg". Auch das war richtig:
--   Adressen koennen sich aendern, der Pfad nicht.
--
-- Nur passt ein Pfad nicht auf "faengt mit https:// an". Jeder Versuch, ein
-- Profilbild zu setzen, lief seit 0022 in die Pruefbedingung aus 0011. Die
-- App hat den Fehler sogar richtig behandelt – sie loescht das eben
-- hochgeladene Bild wieder und meldet den Fehlschlag. Nur half die Meldung
-- niemandem weiter, weil sie den Wortlaut der Datenbank durchreichte.
--
-- Die Loesung
-- -----------
-- Die Bedingung wird nicht gestrichen, sondern auf die neue Form erweitert.
-- Erlaubt ist ab jetzt:
--
--   - nichts (kein Bild gesetzt)
--   - eine https-Adresse (fuer Bilder, die von aussen kommen)
--   - ein Pfad im eigenen Ordner
--
-- "im eigenen Ordner" heisst woertlich: Der Pfad muss mit der Kennung
-- genau dieser Zeile beginnen. Damit steht die Regel aus 0022 – schreiben
-- darf jeder nur in seinem eigenen Ordner – nicht mehr nur im
-- Dateispeicher, sondern auch in der Tabelle. Wer je ein Recht auf ein
-- fremdes Profil erlangte, koennte dessen Bild trotzdem nicht auf einen
-- fremden Ordner zeigen lassen.
--
-- Was der Pfad nicht enthalten darf: einen Doppelpunkt. Damit bleibt die
-- Absicht von 0011 gewahrt – "javascript:..." erfuellt weder den
-- https-Zweig noch den Pfad-Zweig.
-- ============================================================

-- Bestandsdaten: Was die neue Bedingung nicht erfuellt, wird geleert – wie
-- schon in 0011. Betroffen waeren nur Zeilen, die von Hand gesetzt wurden;
-- ueber die App kann seit 0022 ohnehin nichts hineingekommen sein.
update public.profiles
  set avatar_url = null
  where avatar_url is not null
    and avatar_url !~ '^https://'
    and not (
      avatar_url like id::text || '/%'
      and avatar_url ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]{1,100}$'
    );

alter table public.profiles
  drop constraint if exists profiles_avatar_url_https_only;

alter table public.profiles
  drop constraint if exists profiles_avatar_url_form;

alter table public.profiles
  add constraint profiles_avatar_url_form
  check (
    avatar_url is null
    or avatar_url ~ '^https://'
    or (
      avatar_url like id::text || '/%'
      and avatar_url ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]{1,100}$'
    )
  );

comment on column public.profiles.avatar_url is
  'Pfad im Behaelter "avatars" – "<eigene Kennung>/<Datei>". Eine '
  'https-Adresse ist ebenfalls erlaubt, fuer Bilder von aussen. Andere '
  'Formen sind ausgeschlossen; siehe Migration 0028.';
