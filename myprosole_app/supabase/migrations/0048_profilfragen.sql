-- ============================================================
-- 0048: Die Fragen im Community-Profil
-- ============================================================
-- Warum
-- -----
-- Wer mehr beantwortet, bekommt spaeter bessere Vorschlaege. Die Fragen sind
-- der Rohstoff des Zuordnens - siehe docs/zusammenlauf-und-melden.md
-- Abschnitt 3b.
--
-- Zwei der acht Fragen gab es schon: "Laeuft seit" (running_years) und
-- "Sportarten" (sports) aus 0023. Hier kommen die sechs fehlenden dazu.
--
-- Warum Auswahlwerte und kein Freitext
-- ------------------------------------
-- Wer tippen muss, fuellt nicht aus - und ein leeres Profil bekommt schlechte
-- Vorschlaege, also gibt er auf. Deshalb feste Werte zum Antippen, mit
-- Pruefbedingung. Ausnahme ist "was ist schoen am Laufen": Dort ist der Ton
-- die Antwort, und den kann keine Liste treffen.
--
-- Warum alles null sein darf
-- --------------------------
-- Keine Frage ist Pflicht. Ein Profil ohne Antworten ist ein gueltiges
-- Profil - es bekommt nur weniger passende Vorschlaege. Zwang an dieser
-- Stelle erzeugt Falschangaben, keine Daten.

alter table public.community_profiles
  -- Warum laeufst du? Absicht - Wettkampf trifft nicht gern auf Spazieren.
  add column if not exists lauf_grund text,

  -- Wochenkilometer als Spanne, nicht als Zahl. Eine Zahl waere genauer,
  -- als jemand sie kennt, und sie veraendert sich staendig.
  add column if not exists km_woche text,

  -- Allein oder in der Gruppe? Sagt, ob jemand ueberhaupt gesucht wird.
  add column if not exists lieber text,

  -- Wo laeufst du? Gegend, ausdruecklich ohne Ortsangabe.
  add column if not exists gelaende text,

  -- Verein oder Lauftreff - ein Anschluss, der schon besteht.
  add column if not exists im_verein boolean,

  -- Der einzige Freitext. Begrenzt, damit er eine Antwort bleibt und kein
  -- zweites Bio-Feld wird.
  add column if not exists schoen_am_laufen text;

-- Die Werte stehen in der Datenbank und nicht nur in der App: Eine
-- Auswahlliste, die nur die Oberflaeche kennt, laesst sich mit einer
-- eigenen Abfrage umgehen - und dann steht Unsinn in einer Spalte, auf die
-- sich spaeter das Zuordnen stuetzt.
alter table public.community_profiles
  drop constraint if exists community_profiles_lauf_grund;
alter table public.community_profiles
  add constraint community_profiles_lauf_grund check (
    lauf_grund is null or lauf_grund in
      ('kopf_frei', 'gesundheit', 'wettkampf', 'abnehmen', 'geselligkeit', 'draussen')
  );

alter table public.community_profiles
  drop constraint if exists community_profiles_km_woche;
alter table public.community_profiles
  add constraint community_profiles_km_woche check (
    km_woche is null or km_woche in ('bis_10', 'bis_25', 'bis_50', 'ueber_50')
  );

alter table public.community_profiles
  drop constraint if exists community_profiles_lieber;
alter table public.community_profiles
  add constraint community_profiles_lieber check (
    lieber is null or lieber in ('allein', 'gruppe', 'beides')
  );

alter table public.community_profiles
  drop constraint if exists community_profiles_gelaende;
alter table public.community_profiles
  add constraint community_profiles_gelaende check (
    gelaende is null or gelaende in ('stadt', 'wald', 'feld', 'bahn', 'berg')
  );

alter table public.community_profiles
  drop constraint if exists community_profiles_schoen_laenge;
alter table public.community_profiles
  add constraint community_profiles_schoen_laenge check (
    schoen_am_laufen is null or char_length(schoen_am_laufen) <= 200
  );

-- Keine neuen Zeilenrechte noetig: Es sind Spalten einer Tabelle, deren
-- Regeln in 0023 stehen. Wer das Profil sehen darf, sieht auch die Antworten;
-- wer es aendern darf, aendert auch sie.
