-- ============================================================
-- 0042: Saetze, Wiederholungen und Haltedauer je Uebung
-- ============================================================
-- Was fehlte
-- ----------
-- Die Mikroroutine gab pauschal "2 Saetze, 12 Wiederholungen" vor – fest im
-- Quelltext, fuer jede Uebung dieselbe Angabe. Bei einer Kniebeuge geht das.
-- Beim Wandsitz und bei einer Dehnung ist es sinnlos: Die werden gehalten,
-- nicht wiederholt.
--
-- Die Vorgaben stehen jetzt je Uebung in der Datenbank. Entschieden am
-- 19.08.2026:
--
--   Wiederholt:  3 Saetze, 12 Wiederholungen
--   Gehalten:    30 Sekunden, steigern bis 60
--
-- Drei Arten, nicht zwei
-- ----------------------
-- Das Lauf-ABC ist beides nicht. Es wird ueber eine Strecke gelaufen –
-- 15 bis 20 Meter, zwei bis drei Durchgaenge. Diese Uebungen bekommen
-- deshalb nur die Zahl der Durchgaenge; die Strecke steht im Einleitungstext
-- der Gruppe, wo sie fuer alle sechs gleich gilt.
--
-- Deshalb verlangt die Pruefbedingung unten nicht "genau eine Angabe",
-- sondern "nicht beides". Weder Wiederholungen noch Dauer ist ein gueltiger
-- Zustand, kein Versehen.
--
-- Zwei Stellen, an denen ich unsicher bin
-- ---------------------------------------
-- Sie folgen der Vorgabe, sollten bei der fachlichen Durchsicht aber
-- angesehen werden:
--
--   Grosse Laeuferdehnung – 12 Wiederholungen je Seite sind viel fuer eine
--   Bewegung dieser Groesse; ueblich sind eher 5 bis 8.
--
--   Sprunggelenk zur Wand – dient auch als Messung (Abstand zur Wand). Als
--   Messung braucht es keine 36 Wiederholungen.
--
-- Ich weiche nicht eigenmaechtig ab, sondern schreibe es hierhin.
-- ============================================================

alter table public.exercises
  add column if not exists saetze smallint not null default 3;

alter table public.exercises
  add column if not exists wiederholungen smallint;

alter table public.exercises
  add column if not exists dauer_sekunden_von smallint;

alter table public.exercises
  add column if not exists dauer_sekunden_bis smallint;

comment on column public.exercises.saetze is
  'Wie oft der Durchgang wiederholt wird. Beim Lauf-ABC die Zahl der Laeufe.';
comment on column public.exercises.wiederholungen is
  'Wiederholungen je Satz. Null bei gehaltenen Uebungen und beim Lauf-ABC.';
comment on column public.exercises.dauer_sekunden_von is
  'Haltedauer, Einstieg. Null bei wiederholten Uebungen und beim Lauf-ABC.';
comment on column public.exercises.dauer_sekunden_bis is
  'Haltedauer, Ziel zum Hinsteigern. Immer zusammen mit dauer_sekunden_von.';

do $$
begin
  alter table public.exercises
    add constraint exercises_saetze_sinnvoll
    check (saetze between 1 and 10);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.exercises
    add constraint exercises_wiederholungen_sinnvoll
    check (wiederholungen is null or wiederholungen between 1 and 100);
exception when duplicate_object then null;
end $$;

-- Eine Dauer ist eine Spanne oder gar nichts. Ein halber Eintrag waere in
-- der Anzeige nicht darstellbar ("30 bis ?").
do $$
begin
  alter table public.exercises
    add constraint exercises_dauer_vollstaendig
    check (
      (dauer_sekunden_von is null and dauer_sekunden_bis is null)
      or (dauer_sekunden_von is not null and dauer_sekunden_bis is not null
          and dauer_sekunden_von between 5 and 600
          and dauer_sekunden_bis >= dauer_sekunden_von
          and dauer_sekunden_bis <= 600)
    );
exception when duplicate_object then null;
end $$;

-- Nicht beides zugleich. Eine Uebung wird wiederholt ODER gehalten – beides
-- anzugeben hiesse, dass die Anzeige sich entscheiden muesste, und diese
-- Entscheidung gehoert nicht in die Anzeige.
do $$
begin
  alter table public.exercises
    add constraint exercises_wiederholung_oder_dauer
    check (not (wiederholungen is not null and dauer_sekunden_von is not null));
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Die Werte
-- ------------------------------------------------------------

-- Alles wiederholt: 3 x 12. Der Vorgabewert von saetze ist bereits 3.
update public.exercises set wiederholungen = 12
 where slug in (
   'grosse-laeuferdehnung',
   'kniebeuge-ohne-gewicht', 'ausfallschritt-im-gehen',
   'seitliches-beinheben-seitlage', 'einbeinige-bruecke',
   'aufstieg-mit-knieanheben',
   'toter-kaefer', 'beckenheben', 'beinheben-vierfuesslerstand',
   'beckenheben-rueckwaerts',
   'kurzfuss', 'zehen-spreizen', 'grosszehe-einzeln-heben',
   'handtuch-heranziehen', 'wadenheben-langsames-absenken',
   'sprunggelenk-zur-wand'
 );

-- Alles gehalten: 30 Sekunden, steigern bis 60.
update public.exercises
   set dauer_sekunden_von = 30, dauer_sekunden_bis = 60
 where slug in (
   'hueftbeuger-dehnung-kniestand',
   'wadendehnung-gestrecktes-knie',
   'tiefe-wadendehnung-gebeugtes-knie',
   'laeuferdehnung-hintere-oberschenkel',
   'gesaessdehnung-im-sitzen',
   'wandsitz',
   'unterarmstuetz',
   'seitstuetz'
 );

-- Lauf-ABC: nur Durchgaenge. Weder Wiederholungen noch Dauer – die Strecke
-- steht im Einleitungstext der Gruppe.
update public.exercises e
   set wiederholungen = null, dauer_sekunden_von = null, dauer_sekunden_bis = null
  from public.exercise_groups g
 where g.id = e.group_id and g.slug = 'lauftechnik';

-- Der Text des Wandsitzes nannte noch 20 Sekunden als Einstieg. Jetzt steht
-- die Dauer in eigenen Spalten; der Text soll ihr nicht widersprechen.
update public.exercises
   set description_de = replace(description_de,
        'Beginn mit 20 Sekunden, steigern bis 60.', 'Halten und langsam steigern.')
 where slug = 'wandsitz';
