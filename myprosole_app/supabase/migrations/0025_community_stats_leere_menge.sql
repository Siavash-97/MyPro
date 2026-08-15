-- ============================================================
-- 0025: community_stats gibt wirklich nichts zurueck
-- ============================================================
-- Der Fehler in 0023
-- ------------------
-- Die Funktion sollte eine leere Menge liefern, wenn jemand den Schalter
-- "Kilometer & Rekord zeigen" aus hat. Sie tat es nicht:
--
--   select coalesce(sum(...), 0), coalesce(max(...), 0)
--   from public.runs r
--   where r.user_id = ziel and exists (... show_stats ...)
--
-- Eine Abfrage mit sum() und ohne group by gibt IMMER genau eine Zeile
-- zurueck – auch wenn die where-Bedingung auf nichts passt. Statt einer
-- leeren Menge kam also (0, 0). Nachgeprueft mit einer erfundenen Kennung:
-- geantwortet wurde {"kilometer":0.00,"laengster_lauf_km":0.00}.
--
-- Sichtbar war das so: Bei einer Person mit ausgeschaltetem Schalter zeigte
-- das Community-Profil "Kilometer gesamt 0,0 km", statt den Block
-- wegzulassen. Kein Datenabfluss – die Zahl war immer 0 –, aber es stand
-- etwas da, wo nichts stehen sollte.
--
-- Die Berichtigung
-- ----------------
-- Die Zeilenquelle ist jetzt community_profiles, nicht runs. Passt dort
-- keine Zeile – weil es kein Community-Profil gibt oder weil der Schalter
-- aus ist –, kommt keine Zeile heraus. Die zwei Zahlen werden in
-- Unterabfragen berechnet, die nur laufen, wenn es die Zeile gibt.
-- ============================================================

create or replace function public.community_stats(ziel uuid)
returns table (kilometer numeric, laengster_lauf_km numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(r.distance_km) from public.runs r
      where r.user_id = cp.user_id and r.status = 'completed'
    ), 0)::numeric(10, 2),
    coalesce((
      select max(r.distance_km) from public.runs r
      where r.user_id = cp.user_id and r.status = 'completed'
    ), 0)::numeric(10, 2)
  from public.community_profiles cp
  where cp.user_id = ziel
    and cp.show_stats;
$$;

revoke all on function public.community_stats(uuid) from public;
grant execute on function public.community_stats(uuid) to authenticated;
