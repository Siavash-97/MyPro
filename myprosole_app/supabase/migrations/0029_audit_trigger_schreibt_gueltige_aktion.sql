-- ============================================================
-- 0029: Der Nachweis-Eintrag verhinderte den Vorgang, den er belegen sollte
-- ============================================================
-- Der Fehler
-- ----------
-- Auf dem Telefon war keine Einwilligung mehr zu erteilen:
--
--   new row for relation "data_access_log" violates check constraint
--   "data_access_log_action_check"
--
-- data_access_log ist das Zugriffsprotokoll aus 0010. Bei jedem Schreiben
-- auf Gesundheitsdaten legt ein Ausloeser dort eine Zeile an. Die Spalte
-- action darf laut Pruefbedingung nur 'read', 'write', 'delete' oder
-- 'export' enthalten – geschrieben hat der Ausloeser aber tg_op, und das
-- ist 'INSERT', 'UPDATE' oder 'DELETE' in Grossbuchstaben.
--
-- Es passte also nie. Der Ausloeser scheiterte, und weil er im selben
-- Vorgang laeuft wie die eigentliche Aenderung, riss er sie mit: Der
-- Nachweis, dass etwas geschehen ist, verhinderte, dass es geschieht.
--
-- Betroffen waren alle drei Tabellen mit diesem Ausloeser –
-- anamnese_sessions, art9_consents und training_diary_pain_locations.
-- Also die Anamnese, die Einwilligung und die Schmerzangaben; genau die
-- Daten, um deren Nachweisbarkeit es hier geht.
--
-- Die Loesung
-- -----------
-- Uebersetzt wird jetzt in die Sprache der Spalte, statt sie zu umgehen:
-- Anlegen und Aendern sind ein 'write', Loeschen ist ein 'delete'. Die
-- Pruefbedingung bleibt, wie sie ist – sie hat richtig gemeldet.
--
-- Zwei Haerten kommen dazu:
--
--   Ohne angemeldete Person wird nichts protokolliert, statt an der
--   Nicht-Null-Bedingung von user_id zu scheitern. Das betrifft
--   Migrationen und Wartungsaufgaben, die als Dienst laufen – dort gibt
--   es keinen Zugriff einer Person, der zu protokollieren waere. Sonst
--   wuerde eine spaetere Bestandsaenderung wieder alles blockieren.
--
--   Der Suchpfad der Funktion wird festgelegt. Sie laeuft als "security
--   definer", also mit den Rechten ihres Eigentuemers; ohne festen
--   Suchpfad koennte ein untergeschobenes Schema bestimmen, welche
--   Tabelle "public.data_access_log" bezeichnet.
-- ============================================================

create or replace function public.log_health_data_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  wer uuid := auth.uid();
begin
  -- Kein Zugriff einer Person, also nichts zu protokollieren.
  if wer is null then
    return coalesce(new, old);
  end if;

  insert into public.data_access_log (user_id, domain_id, action, resource)
  values (
    wer,
    'gesundheit',
    case tg_op when 'DELETE' then 'delete' else 'write' end,
    tg_table_name
  );

  -- Bei DELETE ist new leer; der Rueckgabewert eines nachgelagerten
  -- Ausloesers wird zwar nicht ausgewertet, aber null zurueckzugeben,
  -- waere irrefuehrend.
  return coalesce(new, old);
end;
$$;

comment on function public.log_health_data_access() is
  'Schreibt einen Eintrag ins Zugriffsprotokoll, wenn Gesundheitsdaten '
  'angelegt, geaendert oder geloescht werden (DSGVO Art. 5 Abs. 2). '
  'Anlegen und Aendern gelten als write, Loeschen als delete. Ohne '
  'angemeldete Person wird nichts geschrieben.';
