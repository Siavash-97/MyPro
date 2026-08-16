-- ============================================================
-- 0027: Einwilligungen sind unveraenderlich
-- ============================================================
-- Warum
-- -----
-- Eine Einwilligung ist kein Geheimnis, sondern ein Nachweis: der Beleg,
-- dass wir Gesundheitsdaten ueberhaupt verarbeiten duerfen. Nach Art. 7
-- Abs. 1 DSGVO muss dieser Nachweis erbringbar sein.
--
-- Bisher war er das nur bedingt. Die Tabelle erlaubte update und delete auf
-- die eigenen Zeilen. Wer sich anmeldet, konnte damit den Zeitpunkt einer
-- Einwilligung nachtraeglich verschieben oder sie ganz verschwinden lassen
-- – und niemand haette es gemerkt. Ein Nachweis, den man umschreiben kann,
-- ist keiner.
--
-- Ab jetzt: nur lesen und anlegen. Kein Aendern, kein Loeschen.
--
-- Wie ein Widerruf dann funktioniert
-- ----------------------------------
-- Nicht mehr, indem revoked_at in die bestehende Zeile geschrieben wird –
-- das waere ja ein update. Stattdessen wird eine neue Zeile angelegt, die
-- den Widerruf festhaelt. Die Tabelle wird damit vom Zustand zur
-- Geschichte:
--
--   2026-08-14  anamnese  granted
--   2026-09-02  anamnese  revoked
--   2026-09-20  anamnese  granted
--
-- Ob eine Einwilligung gerade gilt, ist dann die juengste Zeile zu diesem
-- Bereich. Das ist eine Ableitung statt eines gespeicherten Zustands – und
-- eine Ableitung kann nicht von den Daten abweichen.
--
-- Zum Loeschen des Kontos
-- -----------------------
-- Der Verweis auf profiles hat weiterhin "on delete cascade". Wird das
-- Konto geloescht, gehen die Einwilligungen mit. Eine Weiterleitung ueber
-- den Fremdschluessel fragt die Zeilenregeln nicht – das Recht auf
-- Loeschung bleibt also unberuehrt. Nur einzeln herauspicken kann man
-- nichts mehr.
-- ============================================================

-- Was in der Zeile steht: erteilt oder widerrufen.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'art9_consent_action') then
    create type public.art9_consent_action as enum ('granted', 'revoked');
  end if;
end $$;

alter table public.art9_consents
  add column if not exists action public.art9_consent_action not null default 'granted';


-- Bestehende Widerrufe in die neue Form bringen: Aus jeder Zeile mit
-- gesetztem revoked_at wird zusaetzlich eine Widerrufszeile. Die
-- urspruengliche Zeile bleibt als Erteilung stehen – so bleibt beides
-- erhalten, der Zeitpunkt der Erteilung und der des Widerrufs.
--
-- Laeuft die Migration versehentlich zweimal, entstehen keine Dubletten:
-- Die zweite Ausfuehrung findet die Widerrufszeile bereits vor.
insert into public.art9_consents (user_id, consent_scope, action, consented_at)
select c.user_id, c.consent_scope, 'revoked', c.revoked_at
from public.art9_consents c
where c.revoked_at is not null
  and c.action = 'granted'
  and not exists (
    select 1 from public.art9_consents w
    where w.user_id = c.user_id
      and w.consent_scope = c.consent_scope
      and w.action = 'revoked'
      and w.consented_at = c.revoked_at
  );

comment on column public.art9_consents.revoked_at is
  'Nicht mehr benutzt. Ein Widerruf ist seit 0027 eine eigene Zeile mit '
  'action = revoked. Die Spalte bleibt, damit der alte Stand nachvollziehbar '
  'ist.';

comment on column public.art9_consents.consented_at is
  'Zeitpunkt des Vorgangs – je nach action der Erteilung oder des Widerrufs.';


-- Nur lesen und anlegen.
drop policy if exists art9_consents_update_own on public.art9_consents;
drop policy if exists art9_consents_delete_own on public.art9_consents;

-- Der Ausloeser fuer updated_at haette nichts mehr zu tun. Er bleibt
-- harmlos, wird aber entfernt, damit niemand aus seiner Anwesenheit
-- schliesst, hier duerfe geaendert werden.
drop trigger if exists set_updated_at on public.art9_consents;

comment on table public.art9_consents is
  'Geschichte der Einwilligungen nach Art. 9 DSGVO – unveraenderlich. Nur '
  'lesen und anlegen; ein Widerruf ist eine neue Zeile. Ob eine Einwilligung '
  'gilt, ist die juengste Zeile zum jeweiligen Bereich.';
