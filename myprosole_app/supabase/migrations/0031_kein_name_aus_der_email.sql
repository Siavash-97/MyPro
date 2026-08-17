-- ============================================================
-- 0031: Der Anzeigename wird nicht mehr aus der E-Mail geraten
-- ============================================================
-- Vorgeschichte
-- -------------
-- In der Datenbank lag ein Ausloeser, der in keiner Migration stand:
--
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user()
--
-- Er legt bei jeder Registrierung eine Profilzeile an – das ist richtig und
-- bleibt. Nur setzte er dabei auch einen Namen:
--
--   coalesce(new.raw_user_meta_data->>'full_name',
--            split_part(new.email, '@', 1))
--
-- Der erste Teil ist gut: Wer sich ueber Google anmeldet, bringt seinen
-- Namen mit. Der zweite ist es nicht. Aus s.gheshlaghi97@gmail.com wurde
-- der Anzeigename "s.gheshlaghi97" – im Profil, im Feed, in jeder Gruppe.
-- Niemand hat das je eingegeben; die Datenbank hat es geraten.
--
-- Was dadurch ausserdem kaputt war
-- --------------------------------
-- Die App entscheidet am Anzeigenamen, ob jemand seine Einrichtung schon
-- durchlaufen hat. Weil der Ausloeser ihn sofort setzte, galt jedes neue
-- Konto als eingerichtet: Die Profil-Einrichtung wurde uebersprungen, und
-- mit ihr der Weg in die Anamnese. Der Fehler sah aus wie ein Fehler in der
-- App und lag in der Datenbank.
--
-- Warum die Spalte nullbar werden muss
-- ------------------------------------
-- Der erste Versuch dieser Migration wollte den geratenen Namen einfach auf
-- null setzen. Das ging nicht, und der Grund ist aufschlussreich:
--
--   display_name text not null
--   check (char_length(btrim(display_name)) between 1 and 50)
--
-- Die Tabelle kennt den Zustand "noch kein Name" gar nicht – weder null
-- noch leer sind erlaubt. Genau deshalb musste der Ausloeser sich etwas
-- ausdenken: Er hatte keine Wahl, er musste irgendetwas hineinschreiben.
-- Der geratene Name war nicht der Fehler, sondern seine Folge.
--
-- "Zwischen Registrierung und Einrichtung gibt es noch keinen Namen" ist
-- ein voellig normaler Zustand. Die Spalte wird deshalb nullbar, und die
-- Laengenpruefung gilt nur noch, wenn ein Name da ist. Was nicht faellt:
-- Ein Name, der da ist, muss weiterhin zwischen 1 und 50 Zeichen lang sein
-- und darf kein Markup enthalten (0011).
-- ============================================================

-- 1. Der Zustand "noch kein Name" wird moeglich.
alter table public.profiles
  alter column display_name drop not null;

alter table public.profiles
  drop constraint if exists profiles_display_name_length;

alter table public.profiles
  add constraint profiles_display_name_length
  check (
    display_name is null
    or char_length(btrim(display_name)) between 1 and 50
  );

-- Die Markup-Sperre aus 0011 muss null ebenfalls durchlassen.
alter table public.profiles
  drop constraint if exists profiles_display_name_no_html;

alter table public.profiles
  add constraint profiles_display_name_no_html
  check (display_name is null or display_name !~ '[<>]');


-- 2. Kein Name mehr aus der E-Mail.
--
-- set search_path = '': Die Funktion laeuft mit erhoehten Rechten
-- (security definer), hatte aber keinen festen Suchpfad. Damit koennte
-- jemand mit einer eigenen Tabelle im Suchpfad steuern, in welche Tabelle
-- sie tatsaechlich schreibt. Das ist unabhaengig vom Namensproblem und war
-- der eigentliche Fund.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$function$;


-- 3. Bestandsdaten: Namen leeren, die aus der E-Mail abgeleitet wurden.
--
-- Erkennbar sind sie daran, dass sie genau dem Teil vor dem @ entsprechen.
-- Wer zufaellig genau so heisst und ihn selbst eingetragen hat, verliert ihn
-- – das ist der Preis, und er ist gering: Die Person wird einmalig durch die
-- Einrichtung geschickt und traegt ihn erneut ein. Umgekehrt einen geratenen
-- Namen stehen zu lassen, waere schlechter; er steht im Feed und in jeder
-- Gruppe.
update public.profiles p
   set display_name = null
  from auth.users u
 where u.id = p.id
   and p.display_name is not null
   and p.display_name = split_part(u.email, '@', 1);


comment on column public.profiles.display_name is
  'Der selbst gewaehlte Anzeigename. Null bedeutet: noch nicht eingerichtet '
  '– die App fuehrt dann durch die Profil-Einrichtung. Aus der E-Mail wird '
  'nichts abgeleitet.';

comment on function public.handle_new_user() is
  'Legt bei jeder Registrierung eine Profilzeile an. Der Anzeigename kommt '
  'nur aus den Angaben des Anmeldedienstes (full_name); sonst bleibt er '
  'leer und die App fragt danach.';
