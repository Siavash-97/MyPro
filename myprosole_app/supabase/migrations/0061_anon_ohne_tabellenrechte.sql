-- ============================================================
-- 0061: anon ohne Tabellenrechte in public (Teil 1 von 2 - siehe 0062)
-- ============================================================
-- Zwei Dateien im Ordner, ein Einspielvorgang — beide nacheinander in
-- demselben SQL-Editor-Lauf. Die Probe-Tabelle wird erst nach beiden
-- gefahren, und der Bericht nennt beide Dateien in einem Zug.
--
-- Die Richtung "0061 eingespielt, 0062 vergessen" laesst sich von innen
-- nicht bewachen - 0061 selbst kann nicht pruefen, ob 0062 je folgt.
-- Deshalb der eine Lauf. 0062 traegt umgekehrt einen Riegel, der
-- abbricht, falls jemand ihn allein oder vor 0061 faehrt (siehe dort).
--
-- Vorgeschichte, gekuerzt (voll: `sicherheit`s Bericht 2026-09-10_1445,
-- Nutzer-Nachtrag vom selben Tag). `anon` traegt auf 37 von 46 Tabellen
-- in public REFERENCES/TRIGGER/TRUNCATE/MAINTAIN aus Supabases
-- Voreinstellung fuer neu angelegte Tabellen (0034:236 ist die einzige
-- `anon`-Zeile im ganzen Bestand - Schema-`usage`, kein Tabellenrecht).
-- Der Entzug hat also keinen Gegenspieler im Code, nur in der
-- Voreinstellung, die 0062 festhaelt - sonst braechte die naechste
-- `create table` dieselbe Luecke zurueck (belegt an running_plans/
-- running_plan_days durch 0060, gegen die laufende App bestaetigt).
--
-- Herleitung der 44 Rechte-Saetze: aus `pg_policy` der lokal
-- zurueckgesetzten Datenbank (0001-0060), Logik wie 0037s Schleife -
-- eine Regel zaehlt, wenn sie `authenticated` nennt ODER gar keine Rolle
-- nennt (`polroles = 0`: runs/run_points/run_splits/running_plans/
-- running_plan_days). Hausmuster (0052:188/:248, 0054:65-84, 0060): erst
-- ALLES entziehen, dann exakt vergeben, was die Regeln vorsehen.
-- `service_role` erhaelt wie im Haus ueblich alle Rechte, idempotent.
--
-- Zwei Tabellen, die dieses Muster BEWUSST NICHT anfasst
-- --------------------------------------------------------
-- community_profiles (`0057:202-217`, `grant select` ueber 14 einzelne
-- Spalten) und community_kontakt_anfragen (`0052:312-314`, spaltenweises
-- `insert`/`update`) tragen Spaltenrechte. Ein tabellenweites `grant`
-- wuerde diese Spaltenlisten lautlos aushebeln - 0057 warnt woertlich
-- davor. Beide sind bereits unter den sieben Tabellen ohne jedes
-- `anon`-Recht - fuer sie ist nichts zu tun.
--
-- GRENZE: ausschliesslich Tabellen- und Sequenzrechte. NICHT angefasst:
-- `usage on schema public`/`einwilligung` (0034:236), Schema `storage`
-- (absichtlich oeffentlich, 0019:137-145/0022:53-61). Wirkt nur, solange
-- Migrationen als `postgres` eingespielt werden, und nur solange
-- `handle_new_user()` (0031:80-84) `security definer` bleibt (siehe
-- Funktionsteil in 0062).
--
-- Nachweis (Wegwerftabelle; erst NACH 0062 pruefen): `create table
-- public._probe(id int); select grantee, privilege_type from
-- information_schema.role_table_grants where table_schema='public' and
-- table_name='_probe';` - nach 0061 allein noch REFERENCES/TRIGGER/
-- TRUNCATE fuer `anon`/`authenticated` (plus MAINTAIN, dort unsichtbar
-- in information_schema); nach 0061+0062 keine Zeile mit `anon`, keine
-- mit `authenticated`.
-- ============================================================

-- ------------------------------------------------------------
-- Profil (0001)
-- ------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
-- community_profiles: siehe Kopf. Absichtlich NICHT hier - Spaltenrechte
-- aus 0057 blieben sonst nach dem naechsten Lauf ausgehebelt.


-- ------------------------------------------------------------
-- Anamnese und Trainingstagebuch (0006)
-- ------------------------------------------------------------
revoke all on public.art9_consents from anon, authenticated;
grant select, insert on public.art9_consents to authenticated;
grant all on public.art9_consents to service_role;

revoke all on public.anamnese_sessions from anon, authenticated;
grant select, insert, update, delete on public.anamnese_sessions to authenticated;
grant all on public.anamnese_sessions to service_role;

revoke all on public.anamnese_answers from anon, authenticated;
grant select, insert, update, delete on public.anamnese_answers to authenticated;
grant all on public.anamnese_answers to service_role;

revoke all on public.training_diary_entries from anon, authenticated;
grant select, insert, update, delete on public.training_diary_entries to authenticated;
grant all on public.training_diary_entries to service_role;

revoke all on public.training_diary_pain_locations from anon, authenticated;
grant select, insert, update, delete on public.training_diary_pain_locations to authenticated;
grant all on public.training_diary_pain_locations to service_role;


-- ------------------------------------------------------------
-- Trainingskatalog - reine Nachschlagetabellen, nur select (0005, 0010, 0040)
-- ------------------------------------------------------------
revoke all on public.equipment from anon, authenticated;
grant select on public.equipment to authenticated;
grant all on public.equipment to service_role;

revoke all on public.muscle_groups from anon, authenticated;
grant select on public.muscle_groups to authenticated;
grant all on public.muscle_groups to service_role;

revoke all on public.exercises from anon, authenticated;
grant select on public.exercises to authenticated;
grant all on public.exercises to service_role;

revoke all on public.exercise_muscles from anon, authenticated;
grant select on public.exercise_muscles to authenticated;
grant all on public.exercise_muscles to service_role;

revoke all on public.exercise_equipment from anon, authenticated;
grant select on public.exercise_equipment to authenticated;
grant all on public.exercise_equipment to service_role;

revoke all on public.exercise_groups from anon, authenticated;
grant select on public.exercise_groups to authenticated;
grant all on public.exercise_groups to service_role;

revoke all on public.security_domains from anon, authenticated;
grant select on public.security_domains to authenticated;
grant all on public.security_domains to service_role;


-- ------------------------------------------------------------
-- Workout-Protokoll (0005)
-- ------------------------------------------------------------
revoke all on public.workout_logs from anon, authenticated;
grant select, insert, update, delete on public.workout_logs to authenticated;
grant all on public.workout_logs to service_role;

revoke all on public.workout_log_exercises from anon, authenticated;
grant select, insert, update, delete on public.workout_log_exercises to authenticated;
grant all on public.workout_log_exercises to service_role;


-- ------------------------------------------------------------
-- GPS und Laufplan (0008, 0013) - Regeln ohne `to`, gelten also fuer jede
-- erreichende Rolle (0037-Fund); Rechte trotzdem nur an authenticated,
-- anon bleibt ohne Tabellenrecht und erreicht die Regeln damit gar nicht.
-- ------------------------------------------------------------
revoke all on public.runs from anon, authenticated;
grant select, insert, update, delete on public.runs to authenticated;
grant all on public.runs to service_role;

revoke all on public.run_points from anon, authenticated;
grant select, insert, delete on public.run_points to authenticated;
grant all on public.run_points to service_role;

revoke all on public.run_splits from anon, authenticated;
grant select, insert, delete on public.run_splits to authenticated;
grant all on public.run_splits to service_role;

revoke all on public.running_plans from anon, authenticated;
grant select, insert, update, delete on public.running_plans to authenticated;
grant all on public.running_plans to service_role;

revoke all on public.running_plan_days from anon, authenticated;
grant select, insert, update, delete on public.running_plan_days to authenticated;
grant all on public.running_plan_days to service_role;


-- ------------------------------------------------------------
-- Zyklus (0024)
-- ------------------------------------------------------------
revoke all on public.cycle_settings from anon, authenticated;
grant select, insert, update, delete on public.cycle_settings to authenticated;
grant all on public.cycle_settings to service_role;

revoke all on public.cycle_periods from anon, authenticated;
grant select, insert, update, delete on public.cycle_periods to authenticated;
grant all on public.cycle_periods to service_role;


-- ------------------------------------------------------------
-- Audit-Protokoll (0010) - nur insert; kein select fuer authenticated,
-- ein Protokoll ist zum Schreiben da, nicht zum Nachlesen durch das Konto.
-- ------------------------------------------------------------
revoke all on public.data_access_log from anon, authenticated;
grant insert on public.data_access_log to authenticated;
grant all on public.data_access_log to service_role;


-- ------------------------------------------------------------
-- Community: gemeinsame Laeufe, Treffpunkte, Anfragen, Chats
-- (0017, 0018, 0021)
-- ------------------------------------------------------------
revoke all on public.community_runs from anon, authenticated;
grant select, insert, update, delete on public.community_runs to authenticated;
grant all on public.community_runs to service_role;

revoke all on public.community_run_meeting_points from anon, authenticated;
grant select, insert, update, delete on public.community_run_meeting_points to authenticated;
grant all on public.community_run_meeting_points to service_role;

revoke all on public.community_run_requests from anon, authenticated;
grant select, insert, update, delete on public.community_run_requests to authenticated;
grant all on public.community_run_requests to service_role;

revoke all on public.community_chats from anon, authenticated;
grant select, insert, delete on public.community_chats to authenticated;
grant all on public.community_chats to service_role;

revoke all on public.community_chat_messages from anon, authenticated;
grant select, insert, delete on public.community_chat_messages to authenticated;
grant all on public.community_chat_messages to service_role;


-- ------------------------------------------------------------
-- Community: Gruppen (0020)
-- ------------------------------------------------------------
revoke all on public.community_groups from anon, authenticated;
grant select, insert, update, delete on public.community_groups to authenticated;
grant all on public.community_groups to service_role;

revoke all on public.community_group_members from anon, authenticated;
grant select, insert, update, delete on public.community_group_members to authenticated;
grant all on public.community_group_members to service_role;

revoke all on public.community_group_questions from anon, authenticated;
grant select, insert, update, delete on public.community_group_questions to authenticated;
grant all on public.community_group_questions to service_role;

revoke all on public.community_group_requests from anon, authenticated;
grant select, insert, update, delete on public.community_group_requests to authenticated;
grant all on public.community_group_requests to service_role;

revoke all on public.community_group_answers from anon, authenticated;
grant select, insert on public.community_group_answers to authenticated;
grant all on public.community_group_answers to service_role;


-- ------------------------------------------------------------
-- Community: Feed und Beitraege (0019, 0026)
-- ------------------------------------------------------------
revoke all on public.community_posts from anon, authenticated;
grant select, insert, update, delete on public.community_posts to authenticated;
grant all on public.community_posts to service_role;

revoke all on public.community_post_likes from anon, authenticated;
grant select, insert, update, delete on public.community_post_likes to authenticated;
grant all on public.community_post_likes to service_role;

revoke all on public.community_post_awards from anon, authenticated;
grant select, insert, update, delete on public.community_post_awards to authenticated;
grant all on public.community_post_awards to service_role;

revoke all on public.community_post_comments from anon, authenticated;
grant select, insert, update, delete on public.community_post_comments to authenticated;
grant all on public.community_post_comments to service_role;

revoke all on public.community_post_images from anon, authenticated;
grant select, insert, delete on public.community_post_images to authenticated;
grant all on public.community_post_images to service_role;

revoke all on public.community_comment_likes from anon, authenticated;
grant select, insert, delete on public.community_comment_likes to authenticated;
grant all on public.community_comment_likes to service_role;


-- ------------------------------------------------------------
-- Community: Profilbilder (0023) - community_profiles selbst siehe Kopf
-- ------------------------------------------------------------
revoke all on public.community_profile_photos from anon, authenticated;
grant select, insert, delete on public.community_profile_photos to authenticated;
grant all on public.community_profile_photos to service_role;


-- ------------------------------------------------------------
-- Moderation (0045, 0046, 0047, 0052) - community_kontakt_anfragen siehe
-- Kopf, dort spaltenweise Rechte aus 0052.
-- ------------------------------------------------------------
revoke all on public.meldungen from anon, authenticated;
grant select, insert on public.meldungen to authenticated;
grant all on public.meldungen to service_role;

revoke all on public.verborgene_beitraege from anon, authenticated;
grant select, insert, delete on public.verborgene_beitraege to authenticated;
grant all on public.verborgene_beitraege to service_role;

-- Ausdruecklich KEIN update: eine Blockierung wird gesetzt oder
-- aufgehoben, nie umgebogen (0047/0054).
revoke all on public.blockierungen from anon, authenticated;
grant select, insert, delete on public.blockierungen to authenticated;
grant all on public.blockierungen to service_role;

revoke all on public.zusammenlauf_weggewischt from anon, authenticated;
grant select, insert, delete on public.zusammenlauf_weggewischt to authenticated;
grant all on public.zusammenlauf_weggewischt to service_role;


-- ------------------------------------------------------------
-- Abschluss, als Netz - ersetzt die 44 Einzelsaetze oben nicht
-- ------------------------------------------------------------
-- Die Einzelsaetze sind die Absicht je Tabelle und tragen die Praezision
-- aus den Zeilenregeln (welches Recht, welche Tabelle). Dieser eine
-- pauschale Satz faengt zusaetzlich ab, was eine kuenftige Supabase-
-- Automatik oder ein Redaktionsfehler in einer spaeteren Fassung dieser
-- Datei an `anon` zurueckgeben koennte - er trifft ausschliesslich
-- `anon`, laesst `authenticated` und `service_role` unberuehrt und aendert
-- an den 44 Einzelsaetzen oben nichts (idempotent, kein Widerspruch).
revoke all privileges on all tables in schema public from anon;
