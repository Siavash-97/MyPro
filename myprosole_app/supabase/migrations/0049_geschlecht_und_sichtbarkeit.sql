-- ============================================================
-- 0049: Geschlechtsidentitaet, Vorliebe und Sichtbarkeit
-- ============================================================
-- Grundlage: docs/zusammenlauf-und-melden.md Abschnitt 3a.
--
-- Drei Felder, drei verschiedene Fragen
-- ------------------------------------
--   identitaet    Wer bin ich?
--   zeigt_mir     Wen will ich sehen?
--   sichtbar_fuer Wem darf ich gezeigt werden?
--
-- Die letzten beiden sind NICHT dasselbe, auch wenn sie meistens
-- zusammenfallen. Wer nur mit Frauen laufen will, will deshalb nicht
-- zwangsläufig nur Frauen gezeigt werden - und umgekehrt. Sie in ein Feld zu
-- legen waere bequem und falsch.
--
-- Warum die Identitaet die Sichtbarkeit NICHT steuert
-- ---------------------------------------------------
-- Wer nichtbinaer ist, will deshalb nicht zwangsläufig nur mit nichtbinaeren
-- Menschen laufen - genauso wenig, wie eine Frau nur mit Frauen laufen will.
-- Wuerde die Identitaet die Sichtbarkeit steuern, wuerde aus einer
-- Repraesentationsfunktion eine Ausgrenzung: In einer kleinen Nutzerbasis
-- saehe wer nichtbinaer auswaehlt praktisch niemanden mehr.
--
-- Was hier NICHT steht
-- --------------------
-- Der Transstatus. Er gehoert nach demselben Abschnitt in ein eigenes,
-- freiwilliges Feld mit eigener Sichtbarkeit, weil er jemanden outen kann -
-- in einer Funktion, die Profile an Fremde zeigt. Er kommt, wenn entschieden
-- ist, wer ihn sehen darf.
--
-- Und das biologische Geschlecht: Das gehoert zur Registrierung und wird
-- erst gebaut, wenn der erste Rechenweg es liest. Heute liest es niemand.

alter table public.community_profiles
  -- Wer bin ich? Eine Angabe, freiwillig.
  add column if not exists identitaet text,

  -- Wen will ich vorgeschlagen bekommen? Mehrfachauswahl.
  -- Leer heisst "alle" - das ist die Voreinstellung und wird nicht als
  -- leere Menge gelesen. Wer nichts einstellt, schliesst niemanden aus.
  add column if not exists zeigt_mir text[] not null default '{}',

  -- Wem darf ich gezeigt werden? Ebenfalls Mehrfachauswahl, leer heisst alle.
  add column if not exists sichtbar_fuer text[] not null default '{}';

-- Die erlaubten Werte stehen in der Datenbank und nicht nur in der App.
-- Sonst schreibt eine eigene Abfrage Unsinn in eine Spalte, auf die sich
-- spaeter das Zuordnen stuetzt.
alter table public.community_profiles
  drop constraint if exists community_profiles_identitaet;
alter table public.community_profiles
  add constraint community_profiles_identitaet check (
    identitaet is null or identitaet in
      ('weiblich', 'maennlich', 'nichtbinaer', 'agender', 'keine_angabe')
  );

-- Fuer die beiden Mengen gilt dieselbe Werteliste. Eine Pruefbedingung ueber
-- ein Feld braucht einen Unterausdruck; er laeuft nur beim Schreiben und
-- ueber hoechstens fuenf Eintraege.
alter table public.community_profiles
  drop constraint if exists community_profiles_zeigt_mir;
alter table public.community_profiles
  add constraint community_profiles_zeigt_mir check (
    zeigt_mir <@ array['weiblich', 'maennlich', 'nichtbinaer', 'agender', 'keine_angabe']::text[]
  );

alter table public.community_profiles
  drop constraint if exists community_profiles_sichtbar_fuer;
alter table public.community_profiles
  add constraint community_profiles_sichtbar_fuer check (
    sichtbar_fuer <@ array['weiblich', 'maennlich', 'nichtbinaer', 'agender', 'keine_angabe']::text[]
  );

-- Keine neuen Zeilenrechte: Spalten einer Tabelle, deren Regeln in 0023
-- stehen.
--
-- ACHTUNG fuer den Tag, an dem Teil B gebaut wird: sichtbar_fuer ist bis
-- dahin eine gespeicherte Absicht und kein Schutz. Wirksam wird sie erst,
-- wenn die Vorschlagsabfrage sie in den Zeilenregeln beruecksichtigt - ein
-- Filter in der App waere Bequemlichkeit, kein Schutz.
