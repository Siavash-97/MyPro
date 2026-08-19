-- ============================================================
-- 0035: Der Ausloeser fuer neue Konten wird nachgetragen
-- ============================================================
-- Was fehlte
-- ----------
-- Bei jeder Registrierung muss eine Zeile in public.profiles entstehen.
-- Dafuer gibt es die Funktion public.handle_new_user() – angelegt in 0031,
-- sauber, mit security definer und festem search_path.
--
-- Nur wurde sie nie gerufen. Der Ausloeser, der sie an auth.users bindet,
-- steht in keiner Migration. Er existiert allein in der produktiven
-- Datenbank, wo ihn irgendwann jemand von Hand angelegt hat. In 0031 wird
-- er zwar erwaehnt – aber nur im Kommentar, als Beschreibung des
-- Vorgefundenen, nicht als Anweisung.
--
-- Wie es aufgefallen ist
-- ----------------------
-- Beim ersten vollstaendigen Durchlauf aller Migrationen gegen eine leere
-- Datenbank (supabase db reset, 19.08.2026). Dort wurde ein Testkonto
-- angelegt, und es entstand kein Profil. In der Produktion faellt das nicht
-- auf, weil der Ausloeser dort ja steht.
--
-- Was ohne ihn tatsaechlich passiert
-- ----------------------------------
-- Nachgemessen, nicht geschlossen: Ausloeser lokal entfernt, ueber die
-- Schnittstelle registriert, den Weg der App nachgefahren (19.08.2026).
--
--   Registrierung gelingt ................................ ja
--   Profilzeile entsteht dabei ........................... nein
--   Profil-Einrichtung legt sie dann selbst an ........... ja
--
-- Der Grund fuer die dritte Zeile: createProfile() in store/auth.ts macht
-- kein insert, sondern ein upsert. Fehlt die Zeile, wird sie dort angelegt.
-- Die App heilt den fehlenden Ausloeser also selbst.
--
-- Eine fruehere Fassung dieses Kommentars behauptete, die Registrierung
-- waere ohne ihn "still kaputt". Das stimmt nicht und steht hier
-- richtiggestellt, weil ein falscher Befund im Kommentar schlimmer ist als
-- gar keiner: Er laesst den naechsten Leser an der falschen Stelle suchen.
--
-- Warum er trotzdem gebraucht wird
-- --------------------------------
-- 1. Der Name aus der Google-Anmeldung geht verloren. handle_new_user()
--    uebernimmt full_name aus den Anmeldedaten – ohne Ausloeser laeuft das
--    nicht, und wer sich ueber Google anmeldet, muss seinen Namen von Hand
--    eintippen, obwohl er mitgeliefert wurde.
-- 2. Die lokale Datenbank bildet die produktive nicht ab. Jede Pruefung,
--    die an einer Registrierung haengt, prueft dort etwas anderes.
-- 3. Zwischen Registrierung und Einrichtung gibt es kein Profil. Heute
--    fragt nichts danach; die naechste Stelle, die es tut, faende nichts
--    vor – und der Fehler saehe nach einem Fehler in der App aus.
-- 4. DEVELOPMENT_STANDARDS.md verlangt, dass jede Schemaaenderung als
--    Migration vorliegt. Ein von Hand gesetzter Ausloeser ist genau der
--    Fall, den die Regel verhindern soll.
--
-- Warum das nichts kaputt macht
-- -----------------------------
-- In der Produktion gibt es den Ausloeser schon. "drop trigger if exists"
-- gefolgt von "create trigger" ersetzt ihn durch einen wortgleichen – der
-- Zustand danach ist derselbe, die Migration ist wiederholbar, und beide
-- Datenbanken stimmen anschliessend ueberein.
--
-- Die Funktion selbst wird nicht angefasst. Sie stammt aus 0031 und ist
-- richtig: Sie uebernimmt einen Namen, wenn die Anmeldung ueber Google
-- einen mitbringt, und laesst ihn sonst leer – sie raet nichts mehr aus der
-- E-Mail-Adresse.
-- ============================================================

-- auth.users gehoert nicht uns, sondern Supabase. Ein Ausloeser darauf ist
-- der vorgesehene Weg, an der Registrierung teilzunehmen; die Funktion
-- laeuft mit security definer und festem search_path, damit sie in
-- public.profiles schreiben darf, ohne dem Aufrufer Rechte zu geben.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Legt bei jeder Registrierung die Profilzeile an. Uebernimmt einen '
  'Anzeigenamen nur, wenn der Anmeldedienst einen mitliefert (Google); '
  'sonst bleibt er leer, bis die Person ihn selbst setzt (siehe 0031). '
  'Gebunden an auth.users durch den Ausloeser on_auth_user_created (0035).';
