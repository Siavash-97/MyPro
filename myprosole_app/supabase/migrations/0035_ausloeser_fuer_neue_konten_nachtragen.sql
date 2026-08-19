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
-- Warum das ernst ist
-- -------------------
-- 1. Die lokale Datenbank bildet die produktive nicht ab. Jede Pruefung,
--    die an einer Registrierung haengt, prueft dort etwas anderes.
-- 2. Muesste die produktive Datenbank je aus den Migrationen neu aufgebaut
--    werden – nach einem Ausfall, bei einem Umzug, fuer eine zweite
--    Umgebung –, bekaeme kein neues Konto mehr ein Profil. Die
--    Registrierung waere still kaputt: Das Konto entsteht, das Profil nicht,
--    und der Waechter schickt in eine Einrichtung, deren Speichern
--    scheitern muss.
-- 3. DEVELOPMENT_STANDARDS.md verlangt, dass jede Schemaaenderung als
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
