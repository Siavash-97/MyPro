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
-- Im Supabase-SQL-Editor ausfuehren (Dashboard -> SQL Editor -> New query).
-- Dort laeufst du als Projektinhaber, RLS greift nicht - deshalb ist jede
-- Abfrage unten auf EIN Konto eingegrenzt.
--
-- Reihenfolge: Schritt 0, dann 1, dann erst 2. Schritt 2 loescht
-- unwiderruflich; es gibt kein Rueckgaengig.
-- ============================================================


-- ── Schritt 0: Das richtige Konto finden ────────────────────
-- Zeigt alle Konten mit der Anzahl ihrer Laeufe. Suche die Zeile mit
-- deiner ALTEN Adresse (das Siavash-Konto) und merke dir die E-Mail
-- genau so, wie sie hier steht.

select
  u.email,
  u.created_at as konto_erstellt,
  count(r.id)  as anzahl_laeufe
from auth.users u
left join public.runs r on r.user_id = u.id
group by u.email, u.created_at
order by u.created_at;


-- ── Schritt 1: Ansehen, was geloescht wuerde ────────────────
-- Nichts wird veraendert. Trage unten deine ALTE Adresse ein und pruefe
-- die Liste. Steht hier ein Lauf, den du wirklich gemacht hast, dann
-- nicht weitermachen, sondern erst Bescheid geben.

select
  r.id,
  r.status,
  r.started_at,
  r.distance_km,
  r.duration_s,
  case
    when r.status in ('tracking', 'paused')       then 'nie beendet'
    when r.distance_km is null                    then 'ohne Strecke'
    when r.distance_km < 0.1                      then 'unter 0,1 km'
    when r.duration_s is null or r.duration_s < 60 then 'unter 60 Sekunden'
  end as grund
from public.runs r
where r.user_id = (
        select id from auth.users
        where email = 'HIER-DEINE-ALTE-ADRESSE'   -- <<< anpassen
      )
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
-- Erst ausfuehren, wenn Schritt 1 nur Eintraege zeigt, die weg sollen.
-- Dieselbe Adresse eintragen wie in Schritt 1.
-- Punkte und Abschnitte verschwinden automatisch mit (Fremdschluessel
-- mit Loeschweitergabe aus Migration 0008).

delete from public.runs r
where r.user_id = (
        select id from auth.users
        where email = 'HIER-DEINE-ALTE-ADRESSE'   -- <<< anpassen
      )
  and (
        r.status in ('tracking', 'paused')
     or (r.status = 'completed' and (
              r.distance_km is null
           or r.distance_km < 0.1
           or r.duration_s is null
           or r.duration_s < 60
        ))
      );


-- ── Schritt 2b: Alternative - wirklich ALLE Laeufe des Kontos ──
-- Nur nehmen, wenn auf dem alten Konto ueberhaupt kein echter Lauf
-- stattgefunden hat und auch Eintraege mit Strecke weg sollen.
-- Statt Schritt 2 ausfuehren, nicht zusaetzlich.
--
-- delete from public.runs
-- where user_id = (
--         select id from auth.users
--         where email = 'HIER-DEINE-ALTE-ADRESSE'
--       );


-- ── Schritt 3: Ergebnis pruefen ─────────────────────────────
-- Sollte 0 zurueckgeben (oder nur noch echte Laeufe zeigen).

select count(*) as verbleibende_laeufe
from public.runs
where user_id = (
        select id from auth.users
        where email = 'HIER-DEINE-ALTE-ADRESSE'   -- <<< anpassen
      );
