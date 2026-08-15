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
-- Dashboard -> SQL Editor -> New query. Die vier Bloecke EINZELN ausfuehren,
-- in dieser Reihenfolge. Dort laeufst du als Projektinhaber, RLS greift also
-- nicht - deshalb ist jeder Block auf ein Konto eingegrenzt.
--
-- Die E-Mail-Adresse steht in jedem Block an genau EINER Stelle. Bleibt der
-- Platzhalter stehen, findet die Abfrage kein Konto und es passiert nichts
-- (DELETE 0) - fehlerfrei, aber wirkungslos.
--
-- Schritt 2 loescht unwiderruflich.
-- ============================================================


-- ── Schritt 0: Welches Konto ist es? ────────────────────────
-- Aendert nichts. Eine Zeile pro Konto. Such deine ALTE Adresse - die mit
-- den Laeufen, die du nie gemacht hast - und kopiere sie genau so heraus.

select
  u.email,
  u.created_at                          as konto_erstellt,
  count(r.id)                           as anzahl_laeufe,
  round(sum(r.distance_km)::numeric, 1) as summe_km
from auth.users u
left join public.runs r on r.user_id = u.id
group by u.email, u.created_at
order by u.created_at;


-- ── Schritt 1: Was wuerde geloescht? ────────────────────────
-- Aendert nichts. In der Spalte "grund" steht bei jeder Zeile, warum sie als
-- Geisterlauf gilt. Taucht ein Lauf auf, den du wirklich gemacht hast:
-- abbrechen, nicht weitermachen.

select
  r.started_at,
  r.status,
  r.distance_km,
  r.duration_s,
  case
    when r.status in ('tracking', 'paused')        then 'nie beendet'
    when r.distance_km is null                     then 'ohne Strecke'
    when r.distance_km < 0.1                       then 'unter 0,1 km'
    when r.duration_s is null or r.duration_s < 60 then 'unter 60 Sekunden'
  end as grund
from public.runs r
join auth.users u on u.id = r.user_id
where u.email = 'deine-alte-adresse@example.com'   -- <<< hier eintragen
  and (
        r.status in ('tracking', 'paused')
     or (r.status = 'completed' and (
              r.distance_km is null
           or r.distance_km < 0.1
           or r.duration_s is null
           or r.duration_s < 60
        ))
      )
order by r.started_at desc;


-- ── Schritt 2: Loeschen ─────────────────────────────────────
-- Endgueltig. Erst ausfuehren, wenn Schritt 1 nur Eintraege zeigt, die weg
-- sollen. Dieselbe Adresse eintragen wie dort.
--
-- Punkte und Abschnitte verschwinden automatisch mit (Fremdschluessel mit
-- Loeschweitergabe aus Migration 0008). Der Editor meldet danach "DELETE n" -
-- das n sollte der Zeilenzahl aus Schritt 1 entsprechen.

delete from public.runs r
using auth.users u
where u.id = r.user_id
  and u.email = 'deine-alte-adresse@example.com'   -- <<< dieselbe Adresse
  and (
        r.status in ('tracking', 'paused')
     or (r.status = 'completed' and (
              r.distance_km is null
           or r.distance_km < 0.1
           or r.duration_s is null
           or r.duration_s < 60
        ))
      );


-- ── Schritt 3: Nachsehen ────────────────────────────────────
-- Zeigt, was auf dem Konto uebrig bleibt. Sollten nur noch echte Laeufe
-- sein - oder 0, wenn es dort nie einen gab.

select count(*) as verbleibende_laeufe
from public.runs r
join auth.users u on u.id = r.user_id
where u.email = 'deine-alte-adresse@example.com';  -- <<< dieselbe Adresse


-- ── Nur im Notfall: ALLE Laeufe des Kontos ──────────────────
-- Statt Schritt 2, nicht zusaetzlich. Nimm das nur, wenn auf dem alten Konto
-- ueberhaupt kein echter Lauf stattgefunden hat - hier faellt die Sicherung
-- weg, die oben verhindert, dass ein echter Lauf getroffen wird.
--
-- delete from public.runs r
-- using auth.users u
-- where u.id = r.user_id
--   and u.email = 'deine-alte-adresse@example.com';
