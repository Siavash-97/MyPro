-- ============================================================
-- 0034: Einwilligungen an einer Stelle, mit nachweisbarem Wortlaut
-- ============================================================
-- Warum
-- -----
-- Heute wird an drei Stellen um Erlaubnis gefragt: in der Anamnese, im
-- Trainingstagebuch (das direkt nach jedem Lauf aufgeht) und im
-- Zykluskalender. Wer laeuft, bekommt die Frage also immer wieder. Gemeint
-- war einmal fragen, gebaut war dreimal.
--
-- Ausserdem fehlt der Nachweis. Nach Art. 7 Abs. 1 DSGVO muss belegbar
-- sein, dass jemand eingewilligt hat. Die alte Tabelle haelt fest, WER,
-- WAS und WANN – aber nicht, WELCHEM TEXT. Aendert sich die Formulierung,
-- laesst sich fuer einen alten Fall nicht mehr zeigen, was auf dem
-- Bildschirm stand. Genau daran ist eine Einwilligung schon vor Gericht
-- gescheitert (VG Duesseldorf zum Double-Opt-In): Adresse, IP und
-- Zeitstempel allein genuegen nicht.
--
-- Was diese Migration anlegt
-- --------------------------
-- Ein eigenes Schema `einwilligung` mit zwei Tabellen:
--
--   texte           – die Wortlaute, versioniert. Das Beweisstueck.
--   einwilligungen  – die Entscheidungen, unveraenderlich.
--
-- Ein eigenes Schema und nicht public: Die Bereiche der Datenbank sollen
-- klar trennbar sein. Rechte lassen sich dann je Bereich vergeben, und im
-- Werkzeug steht jeder Bereich als eigener Ordner. Dies ist das erste der
-- geplanten Schemata; die uebrigen folgen einzeln.
--
-- Was diese Migration NICHT tut
-- -----------------------------
-- Sie fasst public.art9_consents nicht an. Kein Umbenennen, kein Loeschen,
-- keine geaenderte Spalte.
--
-- Der Grund ist die Regel "erst erweitern, nie sofort wegnehmen": Auf
-- Telefonen laeuft eine eingefrorene Fassung der App, die die alte Tabelle
-- abfragt. Wuerde diese Migration sie umbauen, bricht die App auf jedem
-- Geraet, das noch nicht neu gebaut wurde – und die Datenbank aktualisiert
-- sich fuer alle sofort, das Telefon aber nicht.
--
-- Reihenfolge deshalb:
--   1. Neues daneben anlegen              <- diese Migration
--   2. Neue App-Fassung benutzt das Neue
--   3. Erst wenn keine alte Fassung mehr laeuft: art9_consents entfernen
--
-- Bis Schritt 3 bleibt art9_consents als Archiv stehen. Sie ist seit 0027
-- unveraenderlich; ihr Inhalt ist damit weiterhin ein gueltiger Nachweis
-- fuer den Zeitraum, in dem sie benutzt wurde.
--
-- Keine IP-Adresse
-- ----------------
-- Bewusst nicht erhoben. Eine IP-Adresse ist ein personenbezogenes Datum
-- (EuGH C-582/14, BGH VI ZR 135/13) und braeuchte einen eigenen Zweck,
-- eine Frist und einen Eintrag in der Datenschutzerklaerung. Fuer die drei
-- Dinge, die sie hier leisten sollte, taugt sie ohnehin nicht: Das
-- Betriebssystem steht nicht in ihr, und wer mit wem laeuft, steht bereits
-- in den Verabredungen. Land und Plattform kommen deshalb als eigene
-- Felder – siehe die folgende Migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Das Schema
-- ------------------------------------------------------------
create schema if not exists einwilligung;

comment on schema einwilligung is
  'Erlaubnisse der Nutzer und die Wortlaute, denen sie zugestimmt haben. '
  'Getrennt von den uebrigen Bereichen, damit Rechte je Bereich vergeben '
  'werden koennen und der Nachweis an genau einer Stelle liegt.';

-- ------------------------------------------------------------
-- 2. Wofuer um Erlaubnis gefragt wird
-- ------------------------------------------------------------
-- Drei Zwecke, bewusst wenige. Jeder weitere Zweck kommt als eigener Wert
-- dazu; ein Enum laesst sich erweitern, ohne bestehende Zeilen anzufassen.
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'zweck' and n.nspname = 'einwilligung'
  ) then
    create type einwilligung.zweck as enum (
      -- Art. 9 DSGVO. Anamnese, Beschwerden, Zyklus, Trainingstagebuch.
      -- Ohne sie kann die App ihren Zweck nicht erfuellen.
      'gesundheitsdaten',
      -- Anmeldung und Sitzung. Rechtlich keine echte Wahl, aber der
      -- Hinweis wird mitprotokolliert, damit die Reihe vollstaendig ist.
      'notwendige_cookies',
      -- Nutzung auswerten, um die App zu verbessern. Freiwillig,
      -- abwaehlbar, ohne Nachteil.
      'analyse'
    );
  end if;
end $$;

-- Was die Zeile festhaelt.
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'entscheidung' and n.nspname = 'einwilligung'
  ) then
    create type einwilligung.entscheidung as enum ('erteilt', 'widerrufen');
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. Die Wortlaute
-- ------------------------------------------------------------
-- Das eigentliche Beweisstueck. Wer spaeter zeigen muss, wozu jemand Ja
-- gesagt hat, braucht den Text von damals – nicht den von heute.
--
-- wortlaut_hash ist berechnet, nicht eingetragen: Eine Pruefsumme, die man
-- von Hand setzen kann, beweist nichts. So kann sie vom Text nicht
-- abweichen.
create table if not exists einwilligung.texte (
  id            uuid primary key default gen_random_uuid(),
  zweck         einwilligung.zweck not null,
  -- Sprechend statt fortlaufend, damit in der Einwilligungszeile lesbar
  -- steht, welcher Stand gemeint ist. Zum Beispiel '2026-08-v1'.
  version       text not null,
  titel         text not null,
  wortlaut      text not null,
  -- Ohne diese Erlaubnis laesst sich die App nicht sinnvoll benutzen.
  -- Steuert nur die Darstellung; erzwungen wird nichts in der Datenbank.
  pflicht       boolean not null default false,
  wortlaut_hash text generated always as (
    encode(extensions.digest(wortlaut, 'sha256'), 'hex')
  ) stored,
  gueltig_ab    timestamptz not null default now(),
  erstellt_am   timestamptz not null default now(),

  constraint texte_version_je_zweck unique (zweck, version),
  constraint texte_version_format
    check (version ~ '^[0-9]{4}-[0-9]{2}-v[0-9]+$' or version like 'bestand-%'),
  constraint texte_titel_nicht_leer
    check (char_length(btrim(titel)) between 1 and 200),
  constraint texte_wortlaut_nicht_leer
    check (char_length(btrim(wortlaut)) >= 10)
);

comment on table einwilligung.texte is
  'Die Wortlaute, denen zugestimmt werden kann – versioniert. Wird ein Text '
  'geaendert, kommt eine neue Version dazu; die alte bleibt stehen, weil '
  'alte Einwilligungen auf sie verweisen.';

comment on column einwilligung.texte.wortlaut_hash is
  'SHA-256 des Wortlauts, von der Datenbank berechnet. Damit laesst sich '
  'zeigen, dass der hinterlegte Text seit der Einwilligung unveraendert ist.';

-- ------------------------------------------------------------
-- 4. Die Entscheidungen
-- ------------------------------------------------------------
-- Unveraenderlich, wie schon art9_consents seit 0027: nur lesen und
-- anlegen. Ein Widerruf ist eine neue Zeile, kein update. Ob eine
-- Erlaubnis gerade gilt, ist die juengste Zeile zum jeweiligen Zweck –
-- eine Ableitung, die von den Daten nicht abweichen kann.
create table if not exists einwilligung.einwilligungen (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  zweck         einwilligung.zweck not null,
  entscheidung  einwilligung.entscheidung not null,
  zeitpunkt     timestamptz not null default now(),

  -- Der Verweis auf den Wortlaut. Zusammengesetzt, damit nicht versehentlich
  -- die Version eines anderen Zwecks eingetragen werden kann.
  text_version  text not null,
  -- Mitgeschrieben, nicht nur verwiesen: Wuerde jemand mit Datenbankrechten
  -- den Text spaeter austauschen, faellt es beim Vergleich auf.
  text_hash     text not null,

  -- Wo die Erlaubnis erteilt wurde. Fuer die Nachvollziehbarkeit des
  -- Vorgangs, ohne dafuer personenbezogene Daten zu erheben.
  quelle        text not null,

  erstellt_am   timestamptz not null default now(),

  constraint einwilligungen_text_gueltig
    foreign key (zweck, text_version)
    references einwilligung.texte (zweck, version),

  constraint einwilligungen_quelle_gueltig
    check (quelle in ('registrierung', 'profil', 'uebernahme'))
);

comment on table einwilligung.einwilligungen is
  'Geschichte aller Erlaubnisse – unveraenderlich. Nur lesen und anlegen; '
  'ein Widerruf ist eine neue Zeile. Ob eine Erlaubnis gilt, ist die '
  'juengste Zeile zum jeweiligen Zweck.';

comment on column einwilligung.einwilligungen.text_hash is
  'Pruefsumme des Wortlauts zum Zeitpunkt der Entscheidung. Weicht sie von '
  'einwilligung.texte ab, wurde der Text nachtraeglich veraendert.';

create index if not exists einwilligungen_user_idx
  on einwilligung.einwilligungen (user_id);
create index if not exists einwilligungen_user_zweck_zeit_idx
  on einwilligung.einwilligungen (user_id, zweck, zeitpunkt desc);

-- ------------------------------------------------------------
-- 5. Zeilenrechte
-- ------------------------------------------------------------
alter table einwilligung.texte enable row level security;
alter table einwilligung.einwilligungen enable row level security;

-- Die Wortlaute darf jeder Angemeldete lesen. Wer zustimmen soll, muss
-- vorher lesen koennen, womit. Geschrieben wird nur bei einer Migration.
drop policy if exists texte_lesen on einwilligung.texte;
create policy texte_lesen on einwilligung.texte
  for select to authenticated
  using (true);

-- Jeder sieht und erteilt nur seine eigenen Erlaubnisse.
drop policy if exists einwilligungen_eigene_lesen on einwilligung.einwilligungen;
create policy einwilligungen_eigene_lesen on einwilligung.einwilligungen
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists einwilligungen_eigene_anlegen on einwilligung.einwilligungen;
create policy einwilligungen_eigene_anlegen on einwilligung.einwilligungen
  for insert to authenticated
  with check (user_id = auth.uid());

-- Bewusst keine Regel fuer update und delete. Ohne Regel gibt es kein
-- Recht: Ein Nachweis, den der Nachgewiesene umschreiben kann, ist keiner.
-- Das Recht auf Loeschung bleibt unberuehrt – der Fremdschluessel auf
-- profiles hat "on delete cascade", und eine Weiterleitung ueber den
-- Fremdschluessel fragt die Zeilenregeln nicht.

-- ------------------------------------------------------------
-- 6. Zugriff ueber die Schnittstelle
-- ------------------------------------------------------------
-- Ohne diese Rechte ist das Schema fuer die App unsichtbar, auch wenn es
-- in den API-Einstellungen freigegeben ist. Beides wird gebraucht.
grant usage on schema einwilligung to anon, authenticated, service_role;

grant select on einwilligung.texte to authenticated, service_role;
grant select, insert on einwilligung.einwilligungen to authenticated;
grant all on einwilligung.einwilligungen to service_role;

-- Damit spaetere Tabellen in diesem Schema nicht einzeln freigegeben
-- werden muessen.
alter default privileges in schema einwilligung
  grant select on tables to authenticated;
alter default privileges in schema einwilligung
  grant all on tables to service_role;

-- ------------------------------------------------------------
-- 7. Die ersten Wortlaute
-- ------------------------------------------------------------
-- Wortgleich mit dem, was die App anzeigen wird. Aendert sich der Text auf
-- dem Bildschirm, muss hier eine neue Version dazukommen – sonst verweist
-- die Einwilligung auf einen Text, den niemand gesehen hat.
insert into einwilligung.texte (zweck, version, titel, wortlaut, pflicht)
values
  ('gesundheitsdaten', '2026-08-v1',
   'Gesundheitsdaten verarbeiten',
   'Ich willige ein, dass MyProSole meine Gesundheitsdaten verarbeitet. '
   'Dazu gehoeren die Angaben aus der Anamnese, Beschwerden und Schmerzen, '
   'Eintraege im Trainingstagebuch und, wenn ich ihn nutze, der '
   'Zykluskalender. Diese Daten sind nach Art. 9 DSGVO besonders '
   'geschuetzt. Sie werden verwendet, um mir Uebungen und Trainingsplaene '
   'vorzuschlagen, und nicht an Dritte weitergegeben. Ich kann diese '
   'Einwilligung jederzeit in meinem Profil widerrufen; die Verarbeitung '
   'bis zum Widerruf bleibt davon unberuehrt.',
   true),

  ('notwendige_cookies', '2026-08-v1',
   'Notwendige Speicherung auf dem Geraet',
   'MyProSole speichert auf meinem Geraet, dass ich angemeldet bin, sowie '
   'Daten, die fuer den Betrieb noetig sind – etwa aufgezeichnete '
   'Laufpunkte, die noch nicht uebertragen werden konnten. Ohne diese '
   'Speicherung funktioniert die App nicht. Es findet keine Auswertung zu '
   'Werbezwecken statt, und es werden keine Daten an Dritte weitergegeben.',
   true),

  ('analyse', '2026-08-v1',
   'Nutzung auswerten',
   'Ich bin damit einverstanden, dass MyProSole auswertet, wie die App '
   'genutzt wird, um sie zu verbessern. Erfasst werden dabei die Plattform '
   '(Android, iPhone oder Web) und die Zeitzone meines Geraets als grobe '
   'Herkunftsangabe. Es wird keine IP-Adresse gespeichert. Diese '
   'Einwilligung ist freiwillig; ohne sie kann ich die App unveraendert '
   'nutzen. Ich kann sie jederzeit in meinem Profil widerrufen.',
   false)
on conflict (zweck, version) do nothing;

-- Der Wortlaut, der bis heute in der App stand. Nicht schoen, aber echt –
-- und die bestehenden Einwilligungen verweisen darauf. Ohne diese Zeile
-- haetten die uebernommenen Eintraege keinen Text, auf den sie zeigen.
insert into einwilligung.texte (zweck, version, titel, wortlaut, pflicht, gueltig_ab)
values
  ('gesundheitsdaten', 'bestand-bis-2026-08',
   'Einwilligung erforderlich (Wortlaut bis August 2026)',
   'Die Anamnese erfasst Gesundheitsdaten (Schmerzen, Verletzungen, '
   'koerperliche Angaben). Gemaess DSGVO Art. 9 benoetigen wir deine '
   'ausdrueckliche Einwilligung. Deine Daten werden verschluesselt '
   'gespeichert und nur fuer deine Uebungs- und Planauswahl verwendet.',
   true, '2026-01-01T00:00:00Z')
on conflict (zweck, version) do nothing;

-- ------------------------------------------------------------
-- 8. Bestehende Einwilligungen uebernehmen
-- ------------------------------------------------------------
-- Wer heute schon eingewilligt hat, soll nicht erneut gefragt werden.
--
-- Uebernommen wird der ZUSTAND, nicht die Geschichte. Die alten Bereiche
-- (anamnese, training_diary, cycle, all) gehen alle im Zweck
-- 'gesundheitsdaten' auf. Die Geschichte einfach umzuschreiben waere
-- falsch: Wer 'anamnese' erteilt und spaeter 'cycle' widerrufen hat,
-- haette in der zusammengefuehrten Reihenfolge einen Widerruf als
-- juengsten Eintrag – und gaelte faelschlich als komplett widerrufen.
--
-- Deshalb: Es zaehlt, ob zum Stichtag mindestens ein Bereich gilt. Die
-- vollstaendige alte Geschichte bleibt in art9_consents nachlesbar.
with juengste as (
  select distinct on (user_id, consent_scope)
         user_id, consent_scope, action, consented_at
  from public.art9_consents
  order by user_id, consent_scope, consented_at desc, id
),
gueltig as (
  select user_id, min(consented_at) as seit
  from juengste
  where action = 'granted'
  group by user_id
)
insert into einwilligung.einwilligungen
  (user_id, zweck, entscheidung, zeitpunkt, text_version, text_hash, quelle)
select
  g.user_id,
  'gesundheitsdaten',
  'erteilt',
  g.seit,
  'bestand-bis-2026-08',
  t.wortlaut_hash,
  'uebernahme'
from gueltig g
cross join einwilligung.texte t
where t.zweck = 'gesundheitsdaten'
  and t.version = 'bestand-bis-2026-08'
  -- Wiederholbar: Ein zweiter Lauf legt nichts doppelt an.
  and not exists (
    select 1 from einwilligung.einwilligungen e
    where e.user_id = g.user_id
      and e.zweck = 'gesundheitsdaten'
      and e.quelle = 'uebernahme'
  );
