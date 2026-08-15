-- ============================================================
-- 0014: Gewicht und Satzpause je Planuebung
-- ============================================================
-- Warum
-- -----
-- Eine Planuebung konnte bisher nur Saetze, Wiederholungen und eine Dauer
-- festhalten. Zum Krafttraining gehoeren aber zwei weitere Angaben, ohne die
-- ein Plan unvollstaendig ist: das Gewicht und die Pause zwischen den Saetzen.
-- Ohne sie muss man sich beides merken oder in die Notiz schreiben.
--
-- Beide Spalten sind bewusst optional. Koerpergewichtsuebungen haben kein
-- Zusatzgewicht, und wer keine feste Pause vorgibt, soll dazu nichts eintragen
-- muessen.
--
-- Wertebereiche
-- -------------
-- weight_kg: numeric(5,1) reicht bis 9999,9 kg bei 100-Gramm-Schritten. Die
--   Pruefung begrenzt auf 0 bis 500 kg - darueber ist es ein Tippfehler, kein
--   Gewicht. Null ist erlaubt, etwa fuer eine leere Langhantelstange als
--   bewusste Angabe.
-- rest_seconds: ganze Sekunden, hoechstens eine Stunde. Auch hier faengt die
--   Obergrenze Tippfehler ab.
--
-- Bestehende Zeilen bekommen NULL und bleiben damit gueltig; die Bedingung
-- "Saetze oder Dauer" aus 0005 bleibt unberuehrt.
-- ============================================================

alter table public.gym_plan_exercises
  add column if not exists weight_kg    numeric(5,1),
  add column if not exists rest_seconds integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gym_plan_exercises_weight_range'
  ) then
    alter table public.gym_plan_exercises
      add constraint gym_plan_exercises_weight_range
      check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 500));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gym_plan_exercises_rest_range'
  ) then
    alter table public.gym_plan_exercises
      add constraint gym_plan_exercises_rest_range
      check (rest_seconds is null or (rest_seconds > 0 and rest_seconds <= 3600));
  end if;
end $$;

comment on column public.gym_plan_exercises.weight_kg is
  'Zusatzgewicht in Kilogramm, optional. NULL bei Koerpergewichtsuebungen.';

comment on column public.gym_plan_exercises.rest_seconds is
  'Pause zwischen den Saetzen in Sekunden, optional.';
