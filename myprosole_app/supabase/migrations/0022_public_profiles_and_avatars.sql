-- ============================================================
-- 0022: Fremde Profile sichtbar machen, Profilbild ermoeglichen
-- ============================================================
-- Das Problem
-- -----------
-- profiles hatte nur eine Regel: jeder sieht sein eigenes Profil. Seit es
-- Feed, Gruppen und Chats gibt, ist das zu eng. Ueberall, wo der Name einer
-- anderen Person stehen sollte, kam nichts zurueck und die App zeigte
-- ersatzweise "Jemand" – im Feed, bei den Gruppenmitgliedern, bei
-- Verabredungen und Beitrittsanfragen.
--
-- Die Entscheidung
-- ----------------
-- Angemeldete Nutzer duerfen Profile lesen. Damit ist eine Bedingung
-- verbunden, die hier festgehalten gehoert:
--
--   In profiles darf ab jetzt nichts stehen, was nicht jeder Angemeldete
--   sehen darf.
--
-- Das ist heute erfuellt: Die Tabelle enthaelt Anzeigename, Profilbild sowie
-- running_level und weekly_goal_km – beide werden seit der Entscheidung zum
-- Profil-Einrichten nicht mehr gefuellt. Gesundheitsdaten liegen in den
-- Anamnese-Tabellen mit eigenen, engen Regeln und sind davon nicht beruehrt.
--
-- Kommt spaeter ein Feld dazu, das privat bleiben soll, gehoert es in eine
-- eigene Tabelle – nicht hierher.
--
-- Warum keine Sicht (View) mit nur zwei Spalten: Zeilenrechte wirken auf
-- Zeilen, nicht auf Spalten, und eine Sicht haette alle bestehenden
-- Verweis-Abfragen der App umgeschrieben. Der Gewinn waere gering gewesen,
-- weil in der Tabelle ohnehin nichts Schutzwuerdiges steht.
-- ============================================================

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public
  on public.profiles for select
  to authenticated
  using (true);

-- Die alte Regel bleibt bestehen; sie ist jetzt eine Teilmenge der neuen und
-- schadet nicht. Sie ausdruecklich stehen zu lassen, macht beim Lesen der
-- Rechte deutlich, dass das eigene Profil in jedem Fall lesbar ist.

comment on table public.profiles is
  'Oeffentliches Profil. Fuer alle angemeldeten Nutzer lesbar – hier darf '
  'deshalb nichts stehen, was privat bleiben soll. Gesundheitsdaten gehoeren '
  'in die Anamnese-Tabellen.';


-- Profilbilder ---------------------------------------------------
-- Eigener Behaelter, oeffentlich lesbar: Ein Profilbild ist dafuer gemacht,
-- gesehen zu werden. Schreiben darf jeder nur in seinem eigenen Ordner.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on column public.profiles.avatar_url is
  'Pfad im Behaelter "avatars", nicht die volle Adresse – die kann sich '
  'aendern, der Pfad nicht.';
