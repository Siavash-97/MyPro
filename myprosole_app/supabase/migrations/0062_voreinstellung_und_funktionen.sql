-- ============================================================
-- 0062: Voreinstellung fuer kuenftige Tabellen, und die Funktionen, die
--       anon heute erreichen kann (Teil 2 von 2 - 0061 zuerst)
-- ============================================================
-- Zwei Dateien im Ordner, ein Einspielvorgang — beide nacheinander in
-- demselben SQL-Editor-Lauf. Die Probe-Tabelle wird erst nach beiden
-- gefahren, und der Bericht nennt beide Dateien in einem Zug.
--
-- Die Voreinstellung traegt Tabellen und Sequenzen, nicht Funktionen;
-- dort ist jeder Fall einzeln zu entziehen, und das Prueftor dafuer
-- fehlt noch (Funktionsteil unten - eigenes Paket nach dieser Migration,
-- nicht Teil davon).
--
-- Riegel gegen die falsche Reihenfolge: prueft ALLE Tabellen in `public`,
-- ohne Ausnahmeliste - auch `community_profiles` und
-- `community_kontakt_anfragen` nicht, obwohl 0061 sie wegen ihrer
-- Spaltenrechte nicht anfasst (Kopf 0061). Frueher genuegte eine
-- Leittabelle (`profiles`); wenn ausgerechnet die eine gewaehlte Tabelle
-- sauber waere und 0061 trotzdem fehlte, liefe der Riegel lautlos durch
-- (sicherheit-Bericht 2026-09-12_1357, B1). Auf Nutzer-Wort vom 12.09.
-- deshalb ueber alle 46 gehaertet: bricht ab, sobald irgendeine Tabelle
-- in `public` noch ein Tabellenrecht fuer `anon` traegt, egal welche -
-- `community_profiles`/`community_kontakt_anfragen` eingeschlossen, denn
-- `0052:248`/`0057:186` (`revoke all ... from anon, authenticated`) haben
-- beide bereits entrechtet: lokal gemessen
-- `bool_or(has_table_privilege('anon', ...))` ueber alle sieben Rechte ->
-- false fuer beide.
--
-- Sieben Rechte, nicht acht: MAINTAIN fehlt absichtlich. Es gibt es erst
-- ab PostgreSQL 17 - `has_table_privilege(..., 'MAINTAIN')` wuerde auf
-- einer PG15-Instanz mit einem Fehler abbrechen statt zu pruefen, und der
-- Riegel muss auf beiden Versionen laufen. Kein Restrisiko dadurch:
-- MAINTAIN kommt ausschliesslich aus derselben Voreinstellungs-Vergabe
-- wie die anderen sechs geerbten Rechte, nie allein - `revoke all` in
-- 0061 entzieht es mit, der Riegel prueft nur die sieben, die es auf PG15
-- UND PG17 gibt (sicherheit-Bericht B1).
--
-- Gegen `has_table_privilege`, nicht gegen `information_schema`: dort
-- ist MAINTAIN unsichtbar (0061-Kopf, Nachweis) - eine Pruefung darueber
-- liefe bei fortbestehender Luecke lautlos durch.
--
-- Vier plus drei: lokal (`supabase db reset`, Stand bis 0060, gemessen
-- 12.09.2026) traegt `anon` auf keiner Tabelle je SELECT/INSERT/UPDATE/
-- DELETE - nur REFERENCES/TRIGGER/TRUNCATE aus der lokalen Voreinstellung
-- (`auto_expose_new_tables` ist lokal aus, gehostet nach altem Verhalten
-- noch an, config.toml-Kommentar). Mit nur den vier urspruenglich
-- vorgegebenen Rechten haette der Riegel LOKAL NIE ausgeloest - deshalb
-- zusaetzlich REFERENCES/TRIGGER/TRUNCATE: strenger, nicht schwaecher.
-- ============================================================

do $$
declare
  v_tabelle text;
begin
  select t.tablename into v_tabelle
    from pg_tables t
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','REFERENCES','TRIGGER','TRUNCATE']) as p(recht)
   where t.schemaname = 'public'
     and has_table_privilege('anon', format('public.%I', t.tablename), p.recht)
   limit 1;

  if v_tabelle is not null then
    raise exception 'Migration 0062 setzt voraus, dass 0061 bereits lief: anon haelt in public.% noch mindestens ein Tabellenrecht. 0061 zuerst einspielen, dann 0062 - beide im selben SQL-Editor-Lauf.', v_tabelle;
  end if;
end $$;

-- ============================================================
-- Die Voreinstellung - ohne sie bringt die naechste `create table` die
-- Luecke zurueck
-- ============================================================
-- Fuer TABELLEN: gemessen wirksam (Nachweis siehe Kopf). Kuenftige
-- Tabellen bekommen weder fuer `anon` noch fuer `authenticated`
-- automatisch irgendein Recht - jede neue Migration muss ihre Rechte
-- ausdruecklich vergeben, wie es die 0037-Regel seit jeher verlangt
-- ("jede Migration, die eine Tabelle anlegt, vergibt auch deren
-- Rechte"). Ein fehlender `grant` scheitert dann LAUT im lokalen Lauf
-- (PostgREST antwortet mit 42501/permission denied) - ein zu breiter
-- geerbter `grant` scheitert dagegen NIE, er faellt niemandem auf, bis
-- ihn jemand gezielt sucht (genau der Fehler, den 0037 urspruenglich
-- beheben sollte und den 0054/0060 zweimal nachtragen mussten).
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on tables from authenticated;

-- Fuer SEQUENZEN: aktuell keine einzige in public (Bestand,
-- Sicherheitsbericht Punkt 1) - wirkt erst, wenn eine kuenftige Tabelle
-- eine serial-/identity-Spalte bekommt. Getestet: wirkt wie bei
-- Tabellen (anon verliert USAGE auf einer neu angelegten Sequenz). Nur
-- fuer `anon` entzogen - die Nutzer-Entscheidung "auch authenticated"
-- galt ausdruecklich nur fuer kuenftige TABELLEN, nicht fuer Sequenzen.
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;

-- Fuer FUNKTIONEN: dieselbe Zeile wie bei Tabellen, aber GEMESSEN OHNE
-- WIRKUNG fuer kuenftige Funktionen - eine Postgres-Eigenheit, kein
-- Schreibfehler in dieser Migration. Test (11.09.2026, zwei einzeln
-- committete Anweisungen, keine gemeinsame Transaktion): nach
-- `alter default privileges for role postgres in schema public revoke
-- execute on functions from public;` zeigt `pg_default_acl` korrekt
-- KEINE PUBLIC-Zeile mehr fuer (postgres, public, f). Trotzdem hat eine
-- danach neu angelegte Funktion `proacl = {=X/postgres, postgres=X/
-- postgres, ...}` - das leere Grantee vor dem `=` ist PUBLIC, und
-- `has_function_privilege('anon', ..., 'execute')` bleibt wahr. Postgres
-- vergibt PUBLIC=EXECUTE beim Anlegen einer Funktion additiv, unabhaengig
-- von den Voreinstellungen - eine dokumentierte Altlast ("historically,
-- EXECUTE privilege for functions is granted to PUBLIC by default").
-- Die Zeile bleibt trotzdem stehen: sie ist Teil der urspruenglichen
-- Vorgabe, sie schadet nichts, und sie dokumentiert die Absicht - aber
-- sie ist KEIN Schutz fuer kuenftige Funktionen. Der wirkliche Schutz
-- bleibt der Hausbrauch: jede REST-erreichbare Funktion bekommt ihr
-- eigenes `revoke all on function ... from public, anon` in ihrer
-- eigenen Migration (0052:421, 0056:391/469/494, 0057-Funktionsteil,
-- hier unten fuer generate_customer_code).
alter default privileges for role postgres in schema public
  revoke all on functions from anon;

-- supabase_admin haelt eine EIGENE Voreinstellung (Init-Skript,
-- Sicherheitsbericht Rollenfrage: die Automatik setzt sie zweimal,
-- unqualifiziert = for role postgres, UND fuer user supabase_admin).
-- GEMESSEN nicht ausfuehrbar durch `postgres` (11.09.2026):
--
--   alter default privileges for role supabase_admin in schema public
--     revoke all on tables from anon, authenticated;
--   -- ERROR:  permission denied to change default privileges
--
-- `postgres` ist kein Mitglied von `supabase_admin` (Katalog-Nachweis,
-- Sicherheitsbericht) und darf dessen Eintrag nicht aendern - deshalb
-- HIER NICHT AUSGEFUEHRT, nur dokumentiert. Folgenlos, solange keine
-- Tabelle jemals von `supabase_admin` selbst angelegt wird.


-- ============================================================
-- Die eine Funktion, die `anon` heute wirklich erreichen kann
-- ============================================================
-- `generate_customer_code()` (0010:32) ist ohne jeden vorherigen Entzug
-- ueber `POST /rest/v1/rpc/generate_customer_code` von `anon` aufrufbar -
-- kein `security definer`, kein bestehendes `revoke`. Sie liest nichts,
-- schreibt nichts, gibt nur das Format `MPS-XXXX-XXXX` preis; geringes
-- Risiko, aber die einzige von `anon` erreichbare Funktion in `public`.
-- Fuenf weitere Funktionen ohne Entzug sind `returns trigger` und ueber
-- REST nicht aufrufbar (`handle_new_user`, `handle_updated_at`,
-- `set_customer_code`, `set_updated_at`, `log_health_data_access`) -
-- bleiben hier unangetastet, wie im Sicherheitsbericht festgehalten.
--
-- Voraussetzung, warum der Entzug den Registrierungsweg nicht bricht:
-- `handle_new_user()` (0031:80-84) bleibt `security definer` und schreibt
-- direkt in `profiles`; der danach feuernde Trigger `profiles_set_
-- customer_code` (0010:126-129) und die von ihm aufgerufenen
-- `set_customer_code()`/`generate_customer_code()` laufen dabei mit den
-- Rechten des Funktionseigentuemers (Definer-Semantik), nicht mit denen
-- von `anon` - der Registrierungsweg braucht also kein `anon`-Recht auf
-- `generate_customer_code()`. Bricht ausdruecklich NUR, wenn
-- `handle_new_user()` jemals `security definer` verliert.
--
-- Der zweite Weg - ein direktes Insert in `profiles` durch `authenticated`
-- ausserhalb des Auth-Triggers - braucht dagegen ausdruecklich `EXECUTE`
-- fuer `authenticated`: `set_customer_code()` ist selbst NICHT
-- `security definer` und laeuft dann mit den Rechten des einfuegenden
-- Kontos (dieselbe Ueberlegung wie im Muster fuer `ist_blockiert`,
-- 0047:80-96, seit 0055:175 in `intern`, und `darf_ich_anfragen`,
-- 0056:517-548, ebenfalls `intern` - `anon` dort ohne `usage`).
-- Deshalb der Gegen-`grant` unten - ohne ihn scheitert jedes `insert
-- into profiles` durch `authenticated` mit "permission denied for
-- function generate_customer_code" (Abnahmepunkt (e) im lokalen Lauf).
revoke all on function public.generate_customer_code() from public, anon;
grant execute on function public.generate_customer_code() to authenticated, service_role;
