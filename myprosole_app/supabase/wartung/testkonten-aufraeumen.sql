-- ============================================================
-- Einmalige Bereinigung: Testkonten und eigene Testlaeufe
-- ============================================================
-- Hintergrund
-- -----------
-- Waehrend der Entwicklung sind in der Datenbank rund 20 Konten entstanden:
-- Konten aus automatisierten Tests (*.test, *.example, *.dev), Konten aus
-- Sicherheitspruefungen (pentest-*, rate-test-*, weakpw2) und das eigene
-- Konto mit Laeufen, die nie stattgefunden haben.
--
-- Entschieden am 15.08.2026: Alles weg bis auf das eigene Konto. Das eigene
-- Konto bleibt mitsamt Profil, Anamnese und Laufplan bestehen - nur seine
-- Laeufe werden entfernt.
--
-- Kein Test haengt an diesen Konten. runner@example.test kommt zwar in
-- project-planner/e2e/myprosole-design.spec.ts vor, dieser Test registriert
-- sich aber gegen die Mockup-Datei register.html, nicht gegen die Datenbank.
--
-- Warum das Loeschen in auth.users reicht
-- ---------------------------------------
-- profiles.id verweist auf auth.users (id) mit ON DELETE CASCADE
-- (Migration 0001), und alle Nutzer-Tabellen haengen ihrerseits mit
-- ON DELETE CASCADE an profiles. Ein Loeschen in auth.users raeumt damit
-- Profil, Laeufe, Punkte, Abschnitte, Anamnese, Einwilligungen und Laufplan
-- automatisch mit weg.
--
-- Anwendung
-- ---------
-- Dashboard -> SQL Editor -> New query. Die vier Bloecke EINZELN und in
-- dieser Reihenfolge ausfuehren. Bloecke 2 und 3 sind unwiderruflich.
--
-- Die eigene Adresse steht in jedem Block an genau EINER Stelle.
-- ============================================================


-- ── Block 1: Vorschau - wer verschwindet? ───────────────────
-- Aendert nichts. Erwartet werden nur Adressen auf *.test, *.example oder
-- *.dev. Steht dort eine Adresse, die bleiben soll: abbrechen.

select email, created_at
from auth.users
where email is distinct from 's.gheshlaghi97@gmail.com'   -- <<< eigene Adresse
order by created_at;


-- ── Block 2: Eigene Laeufe loeschen ─────────────────────────
-- Unwiderruflich. Das Konto selbst bleibt bestehen; Profil, Anamnese und
-- Laufplan bleiben unangetastet. Nur die Laeufe gehen.

delete from public.runs r
using auth.users u
where u.id = r.user_id
  and u.email = 's.gheshlaghi97@gmail.com';                -- <<< eigene Adresse


-- ── Block 3: Alle anderen Konten entfernen ──────────────────
-- Unwiderruflich. Durch die Kaskade gehen deren Profile, Laeufe, Anamnesen
-- und Einwilligungen mit.
--
-- "is distinct from" statt "<>": So werden auch Konten ohne
-- E-Mail-Adresse erfasst. Mit "<>" blieben solche Zeilen stillschweigend
-- stehen, weil ein Vergleich mit NULL weder wahr noch falsch ist.

delete from auth.users
where email is distinct from 's.gheshlaghi97@gmail.com';   -- <<< eigene Adresse


-- ── Block 4: Nachsehen ──────────────────────────────────────
-- Erwartet: konten = 1, laeufe = 0, profile = 1.

select
  (select count(*) from auth.users)      as konten,
  (select count(*) from public.runs)     as laeufe,
  (select count(*) from public.profiles) as profile;


-- ============================================================
-- Variante: komplett bei null anfangen
-- ============================================================
-- Statt der Bloecke 1 bis 3, nicht zusaetzlich. Loescht ALLE Konten,
-- einschliesslich des eigenen.
--
-- Folge: Man muss sich in der App neu registrieren und die Anamnese noch
-- einmal ausfuellen. Ein Passwort-Reset hilft dann nicht mehr, das Konto
-- existiert nicht mehr.
--
-- Was bleibt: der Uebungskatalog. exercises, equipment, muscle_groups,
-- security_domains und deren Verknuepfungstabellen sind Stammdaten und
-- haengen an keinem Nutzer.
--
-- Zum Ausfuehren die Zeile entkommentieren:

-- delete from auth.users;


-- Nachsehen danach. Erwartet: konten, profile und laeufe auf 0, waehrend
-- uebungen_bleiben unveraendert die Katalogzahl zeigt.
--
-- select
--   (select count(*) from auth.users)       as konten,
--   (select count(*) from public.profiles)  as profile,
--   (select count(*) from public.runs)      as laeufe,
--   (select count(*) from public.exercises) as uebungen_bleiben;
