-- ============================================================
-- Einmalige Bereinigung: Laeufe, die nie gelaufen wurden
-- ============================================================
-- Hintergrund
-- -----------
-- Bis zum 15.08.2026 legte die App bereits beim OEFFNEN des
-- Live-Tracking-Bildschirms einen Lauf in der Datenbank an. Wer den
-- Bildschirm nur ansah und wieder verliess, hinterliess dadurch einen
-- Eintrag. Beendete jemand die Aufzeichnung ohne GPS-Bewegung (etwa in der
-- Wohnung), entstand ein abgeschlossener Lauf ueber 0,0 km.
--
-- Die Ursache ist behoben: Der Lauf wird jetzt erst beim Beenden
-- geschrieben, und nur wenn mindestens 0,1 km und 60 Sekunden zusammenkamen.
-- Dieses Skript raeumt auf, was vorher entstanden ist.
--
-- Anwendung
-- ---------
-- Im Supabase-SQL-Editor ausfuehren. ERST Schritt 1 (nur ansehen), dann
-- entscheiden, dann Schritt 2. Schritt 2 loescht unwiderruflich.
--
-- Achtung: Das Skript wirkt auf das Konto, mit dem es ausgefuehrt wird
-- (RLS). Im SQL-Editor als Projektinhaber wirkt es auf ALLE Konten - dort
-- also nur bewusst und nach Sichtung von Schritt 1 ausfuehren.
-- ============================================================


-- ── Schritt 1: Ansehen, was betroffen waere ─────────────────
-- Nichts wird veraendert. Pruefe die Liste, bevor du weitergehst.

select
  id,
  status,
  started_at,
  distance_km,
  duration_s,
  case
    when status in ('tracking', 'paused') then 'nie beendet'
    when distance_km is null                then 'ohne Strecke'
    when distance_km < 0.1                  then 'unter 0,1 km'
    when duration_s is null or duration_s < 60 then 'unter 60 Sekunden'
  end as grund
from public.runs
where
  -- nie beendet: der Bildschirm wurde geoeffnet und wieder verlassen
  status in ('tracking', 'paused')
  -- oder abgeschlossen, aber ohne nennenswerte Aufzeichnung
  or (status = 'completed' and (
        distance_km is null
     or distance_km < 0.1
     or duration_s is null
     or duration_s < 60
  ))
order by started_at desc;


-- ── Schritt 2: Loeschen ─────────────────────────────────────
-- Erst ausfuehren, wenn Schritt 1 nur Eintraege zeigt, die weg sollen.
-- Zugehoerige Punkte und Abschnitte verschwinden automatisch mit
-- (Fremdschluessel mit Loeschweitergabe aus Migration 0008).
--
-- Zum Ausfuehren die folgenden Zeilen entkommentieren:

-- delete from public.runs
-- where
--   status in ('tracking', 'paused')
--   or (status = 'completed' and (
--         distance_km is null
--      or distance_km < 0.1
--      or duration_s is null
--      or duration_s < 60
--   ));


-- ── Schritt 3: Ergebnis pruefen ─────────────────────────────
-- select count(*) as verbleibende_laeufe from public.runs;
