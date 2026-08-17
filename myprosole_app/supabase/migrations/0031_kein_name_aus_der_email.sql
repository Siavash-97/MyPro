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
-- Die Aenderung
-- -------------
-- Der Rueckfall auf die E-Mail faellt weg. Kommt kein Name von aussen,
-- bleibt das Feld leer – und die Person traegt ihn selbst ein.
--
-- Nebenbei: search_path
-- ---------------------
-- Die Funktion laeuft mit erhoehten Rechten (security definer), hatte aber
-- keinen festen Suchpfad. Damit koennte jemand mit einer eigenen Tabelle im
-- Suchpfad steuern, in welche Tabelle sie tatsaechlich schreibt. Mit
-- set search_path = '' und voll ausgeschriebenen Namen ist das
-- ausgeschlossen. Das ist unabhaengig vom Namensproblem und war der
-- eigentliche Fund.
-- ============================================================

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


-- Bestandsdaten: Namen leeren, die aus der E-Mail abgeleitet wurden.
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


comment on function public.handle_new_user() is
  'Legt bei jeder Registrierung eine Profilzeile an. Der Anzeigename kommt '
  'nur aus den Angaben des Anmeldedienstes (full_name); aus der E-Mail wird '
  'nichts mehr abgeleitet. Ohne Namen fuehrt die App durch die Einrichtung.';
