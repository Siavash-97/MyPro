-- ============================================================
-- 0063: Ein Community-Bild liest, wer die Tabellenzeile lesen darf
-- ============================================================
-- Nachtrag 13.09.2026 (sicherheit, Befund B Scheibe 2, Bericht
-- 2026-09-13_0938_…): Die beiden `exists`-Klauseln unten pruefen NUR
-- `p.path = storage.objects.name` bzw. `i.path = storage.objects.name` -
-- nicht, dass die gefundene Zeile ihrem Eigentuemer gehoert. Beide
-- Insert-Regeln auf den Tabellen pruefen `user_id = auth.uid()`, aber
-- KEINE prueft, dass `path` im eigenen Ordner liegt. Damit genuegte EIN
-- eigener `insert` mit einem fremden Pfad, um die gefundene Datei lesbar zu
-- machen - gemessen (lokal, `begin … rollback`): Nutzer A, kein Mitglied
-- der geschlossenen Gruppe von B, haengt B's Gruppenbild-Pfad an eine
-- eigene `community_profile_photos`-Zeile ODER an ein Bild des eigenen
-- offenen Beitrags in `community_post_images` - A sieht das Gruppenbild
-- danach (vorher 0, nachher 1), obwohl A nie Mitglied wurde. Die App legt
-- jede Datei durchgaengig unter `${userId}/${randomUUID()}.${endung}` ab
-- (`myprosole_web/src/lib/dateiAblegen.ts:238`, Praefix aus
-- `store/feed.ts:136` und `store/communityProfile.ts:353`, beide
-- `userId`) - Ordner und `user_id` sind fuer jeden legitimen Weg also
-- immer gleich, und die Ergaenzung unten schliesst nur den illegitimen.
-- Beide `exists` bekommen deshalb zusaetzlich
-- `(storage.foldername(storage.objects.name))[1] = p.user_id::text` bzw.
-- `= i.user_id::text`. Alle zehn ABNAHME-Saetze der ausgelieferten Fassung
-- bleiben unveraendert gruen (lokal nachgemessen); Angriffsweg 1 und 2
-- gehen von 1 auf 0.
--
-- Was fehlte
-- ----------
-- Zwei Orte entschieden ueber dieselbe Frage, und sie klafften auseinander:
-- Die Tabelle `community_post_images` ist seit 0032 auf Mitglieder der
-- Gruppe beschraenkt (`community_post_images_select_all … using
-- (public.darf_beitrag_sehen(post_id))`, 0032:110-113); der Behaelter
-- `community` blieb aus 0019 oeffentlich fuer JEDE Rolle
-- (`community_images_read … using (bucket_id = 'community')`, ohne `to`,
-- 0019:142-145 - Kommentar dort: "Lesen: fuer alle. Ein Feed-Bild ist
-- ohnehin fuer alle bestimmt.", geschrieben, bevor es geschlossene Gruppen
-- gab). Wer die Adresse eines Beitragsbilds aus einer geschlossenen Gruppe
-- kannte, lud es ohne Sitzung und unabhaengig von der Mitgliedschaft.
-- Befund: Fehlerbericht
-- `2026-09-10_1512_bilder-geschlossener-gruppen-liegen-im-oeffentlichen-
-- behaelter.md`.
--
-- Warum so (Weg b', Recherche 2026-09-12_2124, Fragen 1 und 6)
-- --------------------------------------------------------------
-- Frage 1: `createSignedUrl(s)` prueft vor dem Ausstellen des Tokens ein
-- reines `select … from storage.objects` gegen die Verbindung des
-- AUFRUFENDEN Nutzers - mit dessen Rolle und JWT-Claims (Recherche,
-- supabase/storage src/storage/object.ts:819-826, src/storage/database/
-- pg.ts:1352-1390, src/internal/database/postgres/scope.ts). Eine
-- Storage-Regel, die je Objekt in der Tabelle nachschlaegt, greift also
-- schon beim Signieren, nicht erst beim Oeffnen der Adresse.
-- Frage 6: Eine Storage-Regel darf eine `security definer`-Funktion aus
-- `public` aufrufen, ohne sie in PostgREST freizugeben (offizielle
-- Troubleshooting-Doku, zitiert in der Recherche). Diese Datei tut das
-- BEWUSST NICHT: Die Regel unten ruft keine Fachfunktion (kein
-- `darf_beitrag_sehen(...)`), sondern prueft nur, ob unter der laufenden
-- Rolle eine Tabellenzeile mit diesem Pfad lesbar ist. Es gibt dann je
-- Bildart genau einen Entscheidungsort, die Tabelle - wird deren Regel
-- spaeter enger, wirkt das auf diese Datei mit, ohne dass hier etwas
-- geaendert werden muss.
--
-- Was die Datei tut
-- ------------------
-- Eine SELECT-Regel auf `storage.objects` fuer `bucket_id = 'community'`,
-- fuer `authenticated`, die genau dann zutrifft, wenn mindestens eine
-- Bedingung gilt:
--   (1) Eigentuemer per Ordner - derselbe Ausdruck wie in der
--       Delete-Regel (`community_images_delete_own`, 0019:158-165):
--       `(storage.foldername(storage.objects.name))[1] = auth.uid()::text`.
--       Ein Objekt ohne Tabellenzeile bleibt damit fuer seinen Eigentuemer
--       lesbar (und damit loeschbar, siehe Nachtrag unten) statt fuer
--       niemanden.
--   (2) es existiert eine Zeile in `community_profile_photos` mit
--       `path = storage.objects.name` UND deren Ordner (`storage.
--       foldername(storage.objects.name))[1]`) dem `user_id` dieser Zeile
--       entspricht, lesbar unter der Regel dieser Tabelle
--       (`community_profile_photos_select`, `to authenticated using
--       (true)`, 0023:105-109) - heute: jeder Angemeldete. Der
--       Eigentuemer-Bezug (Nachtrag 13.09.2026, sicherheit Befund 1) ist
--       noetig, weil die Insert-Regel dieser Tabelle nur `user_id =
--       auth.uid()` prueft, nicht dass `path` im eigenen Ordner liegt -
--       ohne den Bezug haette jeder Angemeldete sich per eigenem `insert`
--       mit einem fremden Pfad das Lesen dieser Datei verschaffen koennen.
--   (3) es existiert eine Zeile in `community_post_images` mit
--       `path = storage.objects.name` UND demselben Eigentuemer-Bezug,
--       lesbar unter deren Regel (`community_post_images_select_all`,
--       `public.darf_beitrag_sehen(post_id)`, 0032:106-113) - nur
--       Gruppenmitglieder bei gruppengebundenen Beitraegen.
-- Spaltenname durchgaengig qualifiziert `storage.objects.name`: Keine der
-- beiden Tabellen hat heute eine Spalte `name` (0023:86-98, 0026:12-26,
-- ihre Bildspalte heisst `path`) - ein unqualifiziertes `name` in der
-- Unterabfrage traefe deshalb heute nichts Falsches, bliebe aber ein
-- stiller Bruch, sobald eine der beiden Tabellen jemals eine Spalte
-- `name` bekaeme (Nutzer-Vorgabe, Nachtrag 12.09.2026 22:35).
-- Zwei Indizes auf `path`: `createSignedUrls` fuehrt die `exists`-Pruefung
-- je signiertem Pfad aus; auf `path` liegt heute nur `(user_id, position)`
-- bzw. `(post_id, position)` (0023:100-101, 0026:28-29) - kein Index, der
-- eine gezielte Suche nach `path` allein traegt.
--
-- Was sie NICHT tut
-- ------------------
-- Kein `security definer`-Aufruf (siehe oben) - die Tabellenregeln
-- entscheiden, diese Datei fragt nur nach. Kein Anfassen von
-- `storage.buckets` (Scheibe 3, eigene Migration, Nutzer). Keine
-- Insert-/Delete-Regeln auf `storage.objects`, keine Aenderung an den
-- Tabellenregeln von `community_profile_photos`/`community_post_images`.
-- Keine Ausnahme fuer `anon`: `anon` traegt nach 0063 keine Regel mehr auf
-- `bucket_id = 'community'` und liest damit nichts - Nutzer-Entscheidung
-- 13.09.2026, "kein Weg fuer anon".
--
-- Nebenwirkung, gemessen statt behauptet (Nutzer-Befund 12.09.2026, 22:35)
-- --------------------------------------------------------------------
-- Alle drei Loeschwege der App loeschen zuerst die Tabellenzeile, danach
-- die Datei (feed.ts:285→289, feed.ts:296→304, communityProfile.ts:
-- 352→362). `storage.remove()` braucht dafuer SELECT auf `storage.objects`
-- (Berichtigung 13.09.2026, sicherheit Befund 2 - der Grund liegt in
-- Postgres, nicht im Aufrufpfad der Storage-API, `supabase/storage
-- src/storage/object.ts:191-215`, `src/storage/database/pg.ts:1266-1291`):
-- ein `DELETE … WHERE` auf einer Tabelle mit RLS braucht das SELECT-Recht
-- und damit die SELECT-Regel, um die Zeile ueberhaupt zu finden, und das
-- `RETURNING *` (dort `DELETE FROM storage.objects WHERE … RETURNING *`)
-- verlangt sie ein zweites Mal. Ohne die Eigentuemer-Klausel (1) haette
-- SELECT nach dem Loeschen der Zeile keine Grundlage mehr, `remove()`
-- liefe lautlos ins Leere (`error: null`, nichts geloescht,
-- `verwaistMerken` wird nie gerufen) - ein still brechender Loeschweg. Die
-- Klausel (1) haelt das offen: Der Eigentuemer liest seine eigene Datei
-- ueber den Ordner, unabhaengig davon, ob die Tabellenzeile schon fort
-- ist. Siehe ABNAHME (8), ROT GESEHEN.
--
-- Riegel: keiner
-- ---------------
-- Diese Migration setzt weder 0061 noch 0062 voraus (Tabellenrechte in
-- `public` bzw. Rollen-Voreinstellungen) - sie aendert ausschliesslich
-- eine Regel und zwei Indizes im Schema `storage`/`public`, unabhaengig
-- von jener Rechtevergabe. Ein Riegel nach dem Muster 0061/0062 waere
-- hier ohne Gegenstand.
--
-- Rueckweg (auskommentiert, nicht ausgefuehrt)
-- ---------------------------------------------
-- drop policy if exists community_images_read on storage.objects;
-- create policy community_images_read
--   on storage.objects for select
--   using (bucket_id = 'community');
-- drop index if exists public.community_profile_photos_path_idx;
-- drop index if exists public.community_post_images_path_idx;
--
-- Fundstellen: Fehlerbericht 2026-09-10_1512_…; Auftragspaket
-- 2026-09-12_2212_…, Nachtrag 22:35 (Eigentuemer-Klausel, qualifizierter
-- Spaltenname, zwei Indizes); Recherche 2026-09-12_2124_…, Fragen 1 und 6;
-- 0019_community_feed.sql:142-166 (alte Regel, Delete-Regel mit
-- Ordnerpruefung); 0023_community_profiles.sql:86-109; 0032_beitraege_in_
-- gruppen.sql:61-113; 0026_post_edit_and_comment_replies.sql:12-35;
-- Pruefbericht sicherheit 2026-09-13_0938_… (Befunde 1, 2, 4 - alle drei
-- hier nachvollzogen).
-- ============================================================

drop policy if exists community_images_read on storage.objects;
create policy community_images_read
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'community'
    and (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      or exists (
        select 1 from public.community_profile_photos p
        where p.path = storage.objects.name
          and (storage.foldername(storage.objects.name))[1] = p.user_id::text
      )
      or exists (
        select 1 from public.community_post_images i
        where i.path = storage.objects.name
          and (storage.foldername(storage.objects.name))[1] = i.user_id::text
      )
    )
  );

create index if not exists community_profile_photos_path_idx
  on public.community_profile_photos (path);

create index if not exists community_post_images_path_idx
  on public.community_post_images (path);
