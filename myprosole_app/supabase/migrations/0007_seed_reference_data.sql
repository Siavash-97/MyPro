-- =============================================================================
-- 0007_seed_reference_data.sql
-- Seed-Daten für Referenztabellen: equipment, muscle_groups, exercises
-- sowie Zuordnungen exercise_muscles und exercise_equipment.
--
-- Wiederholbarkeit: INSERT ... ON CONFLICT (slug) DO NOTHING.
-- Ausführung erfordert service_role (RLS-Bypass), da die RLS-Policies
-- dieser Tabellen nur SELECT für authenticated zulassen.
--
-- Quelle: Eigene Zusammenstellung für MyProSole.
-- Lauftechnik-Übungen basieren auf dem bestehenden exercises_catalog.py.
-- Gym-Übungen sind allgemein bekannte Grundübungen.
-- =============================================================================

-- =============================================================================
-- Equipment
-- =============================================================================
insert into public.equipment (slug, name_de, name_en) values
  ('barbell',           'Langhantel',           'Barbell'),
  ('dumbbell',          'Kurzhantel',           'Dumbbell'),
  ('kettlebell',        'Kettlebell',           'Kettlebell'),
  ('cable_machine',     'Kabelzug',             'Cable Machine'),
  ('pull_up_bar',       'Klimmzugstange',       'Pull-Up Bar'),
  ('resistance_band',   'Widerstandsband',      'Resistance Band'),
  ('bench',             'Flachbank',            'Bench'),
  ('incline_bench',     'Schrägbank',           'Incline Bench'),
  ('leg_press',         'Beinpresse',           'Leg Press'),
  ('smith_machine',     'Multipresse',          'Smith Machine'),
  ('lat_pulldown',      'Latzug',               'Lat Pulldown'),
  ('rowing_machine',    'Rudergerät',           'Rowing Machine'),
  ('foam_roller',       'Faszienrolle',         'Foam Roller'),
  ('stability_ball',    'Gymnastikball',        'Stability Ball'),
  ('trx',              'Schlingentrainer',      'TRX / Suspension Trainer'),
  ('box_step',         'Stepbox',              'Box / Step'),
  ('medicine_ball',    'Medizinball',          'Medicine Ball'),
  ('ez_bar',           'SZ-Stange',            'EZ Curl Bar')
on conflict (slug) do nothing;

-- =============================================================================
-- Muscle Groups
-- =============================================================================
insert into public.muscle_groups (slug, name_de, name_en) values
  ('chest',             'Brust',                'Chest'),
  ('upper_back',        'Oberer Rücken',        'Upper Back'),
  ('lats',              'Latissimus',           'Lats'),
  ('lower_back',        'Unterer Rücken',       'Lower Back'),
  ('shoulders',         'Schultern',            'Shoulders'),
  ('biceps',            'Bizeps',               'Biceps'),
  ('triceps',           'Trizeps',              'Triceps'),
  ('forearms',          'Unterarme',            'Forearms'),
  ('abs',               'Bauch',                'Abs'),
  ('obliques',          'Seitliche Bauchmuskulatur', 'Obliques'),
  ('quads',             'Quadrizeps',           'Quads'),
  ('hamstrings',        'Hintere Oberschenkel', 'Hamstrings'),
  ('glutes',            'Gesäß',                'Glutes'),
  ('calves',            'Waden',                'Calves'),
  ('hip_flexors',       'Hüftbeuger',           'Hip Flexors'),
  ('adductors',         'Adduktoren',           'Adductors'),
  ('tibialis',          'Schienbeinmuskel',     'Tibialis Anterior')
on conflict (slug) do nothing;

-- =============================================================================
-- Exercises: Lauftechnik & Prävention (aus exercises_catalog.py)
-- =============================================================================
insert into public.exercises (slug, name_de, name_en, description_de, description_en, category, difficulty, modality, source_name, source_license) values
  ('barefoot_march',
   'Barfuß-Marsch mit mittigem Fußaufsatz',
   'Barefoot Mid-Foot March',
   'Bewusster, leiser Kontakt in Richtung Mittel-/Vorfuß – Grundlage für einen weicheren Initialkontakt. 3 × 45 Sekunden.',
   'Conscious, quiet contact toward mid-/forefoot – foundation for a softer initial contact. 3 × 45 seconds.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('skipping_drill',
   'Skippings / kurze Anfersen',
   'Skipping Drill',
   'Aktiviert Vorfuß und Waden für einen dynamischeren Kontakt. 3 × 20 Meter.',
   'Activates forefoot and calves for more dynamic contact. 3 × 20 meters.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('calf_raises_eccentric',
   'Wadenheben (exzentrisch)',
   'Eccentric Calf Raises',
   'Kräftigt die Waden und unterstützt kontrolliertes Abrollen. Beidbeinig heben, langsam absenken. 3 × 12.',
   'Strengthens calves and supports controlled roll-off. Raise bilaterally, lower slowly. 3 × 12.',
   'strength', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('metronome_cadence',
   'Metronom-Laufdrill',
   'Metronome Cadence Drill',
   'Erhöht die Schrittfrequenz moderat ohne Temposteigerung. Metronom-App auf +5 % der aktuellen Kadenz. 4 × 1 Minute.',
   'Moderately increases step frequency without speed increase. Metronome app at +5% of current cadence. 4 × 1 min.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('short_stride_walk',
   'Kurze Schrittlänge bei gleicher Geschwindigkeit',
   'Short Stride at Same Speed',
   'Reduziert Überstriding und fördert höhere Kadenz. 2–3 Minuten üben.',
   'Reduces overstriding and promotes higher cadence. Practice 2–3 minutes.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('knee_lift_abc',
   'Lauf-ABC: Kniehebelauf',
   'Running ABC: High Knees',
   'Koordinationsübung für aktivere Schrittgestaltung. 3 × 20 Meter.',
   'Coordination drill for more active stride formation. 3 × 20 meters.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('single_leg_balance',
   'Einbeinstand mit leichtem Neigen',
   'Single Leg Balance with Forward Lean',
   'Verbessert Stabilität und Gleichgewicht pro Seite. 3 × 30 Sekunden pro Seite.',
   'Improves stability and balance per side. 3 × 30 seconds per side.',
   'injury_prevention', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('line_walk',
   'Linienlauf',
   'Line Walk',
   'Trainiert gleichmäßige Schrittabfolge und Fokus. 4 × 15 Meter.',
   'Trains even stride sequence and focus. 4 × 15 meters.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('ankle_rocking',
   'Fußgelenksarbeit im Stand',
   'Ankle Rocking',
   'Mobilisiert Sprunggelenk für dynamischeres Abrollen. Gewicht zwischen Vorfuß und Ferse verlagern. 2 × 60 s.',
   'Mobilizes ankle for more dynamic roll-off. Shift weight between forefoot and heel. 2 × 60s.',
   'mobility', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('hop_runs',
   'Kurze Hopserläufe',
   'Hop Runs',
   'Fördert elastischen Abdruck und kürzere Standphase. 3 × 15 Meter.',
   'Promotes elastic push-off and shorter stance phase. 3 × 15 meters.',
   'technique', 'intermediate', 'bodyweight', 'myprosole', 'proprietary'),

  ('wall_ankle_mobility',
   'Sprunggelenk-Mobilität an der Wand',
   'Wall Ankle Mobility',
   'Erhöht Dorsalextension für besseres Abrollen. Knie Richtung Wand führen. 2 × 10 pro Seite.',
   'Increases dorsiflexion for better roll-off. Drive knee toward wall. 2 × 10 per side.',
   'mobility', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('foot_mobility',
   'Dynamische Fußmobilität',
   'Dynamic Foot Mobility',
   'Erhält Beweglichkeit und Prävention. Zehen greifen, Fuß kreisen, Ferse-Vorfuß-Rollen. 2 × 60 s.',
   'Maintains mobility and prevention. Toe grips, foot circles, heel-forefoot rolls. 2 × 60s.',
   'mobility', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('stability_circuit',
   'Stabi-Zirkel: Einbeinstand + Wadenheben',
   'Stability Circuit: Single Leg + Calf Raises',
   'Kombiniert Gleichgewicht und Kraft. Einbeinstand 20 s, dann 10 Wadenheben. 3 Runden pro Seite.',
   'Combines balance and strength. Single leg stand 20s, then 10 calf raises. 3 rounds per side.',
   'injury_prevention', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('running_abc_warmup',
   'Lockeres Lauf-ABC als Warm-up',
   'Running ABC Warm-up',
   'Erhält Koordination und Technik im Alltag. Klassisches Lauf-ABC locker ausführen, ca. 5 Minuten.',
   'Maintains coordination and technique. Perform classic running ABC loosely, approx. 5 minutes.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('metronome_rhythm',
   'Gehen/Laufen im Metronom-Takt',
   'Metronome Rhythm Walk/Run',
   'Stabilisiert Rhythmus und Schrittkonstanz. 3 × 2 Minuten im Takt gehen oder laufen.',
   'Stabilizes rhythm and stride consistency. 3 × 2 minutes walking or running in rhythm.',
   'technique', 'beginner', 'bodyweight', 'myprosole', 'proprietary')
on conflict (slug) do nothing;

-- =============================================================================
-- Exercises: Gym-Grundübungen (Kraft / Fitness)
-- =============================================================================
insert into public.exercises (slug, name_de, name_en, description_de, description_en, category, difficulty, modality, source_name, source_license) values
  ('squat',
   'Kniebeugen',
   'Squat',
   'Grundübung für die gesamte Beinmuskulatur. Fersen bleiben am Boden, Knie in Zehenrichtung.',
   'Fundamental leg exercise. Heels stay on the ground, knees track over toes.',
   'strength', 'beginner', 'both', 'myprosole', 'proprietary'),

  ('deadlift',
   'Kreuzheben',
   'Deadlift',
   'Ganzkörperübung mit Schwerpunkt auf hinterer Kette. Rücken gerade, Gewicht nah am Körper führen.',
   'Full body exercise focusing on posterior chain. Keep back straight, weight close to body.',
   'strength', 'intermediate', 'gym', 'myprosole', 'proprietary'),

  ('bench_press',
   'Bankdrücken',
   'Bench Press',
   'Grundübung für Brustmuskulatur. Schulterblätter zusammen, kontrolliertes Absenken zur Brust.',
   'Fundamental chest exercise. Squeeze shoulder blades, controlled lowering to chest.',
   'strength', 'intermediate', 'gym', 'myprosole', 'proprietary'),

  ('overhead_press',
   'Schulterdrücken',
   'Overhead Press',
   'Drückbewegung über Kopf für Schultern und Trizeps. Rumpf stabil, kein Hohlkreuz.',
   'Overhead pressing for shoulders and triceps. Core stable, no excessive arching.',
   'strength', 'intermediate', 'both', 'myprosole', 'proprietary'),

  ('barbell_row',
   'Langhantelrudern',
   'Barbell Row',
   'Ruderbewegung für oberen Rücken und Latissimus. Oberkörper ca. 45° geneigt, Ellenbogen nah am Körper.',
   'Rowing for upper back and lats. Upper body at ~45°, elbows close to body.',
   'strength', 'intermediate', 'gym', 'myprosole', 'proprietary'),

  ('pull_up',
   'Klimmzug',
   'Pull-Up',
   'Eigengewichtsübung für Rücken und Bizeps. Schulterbreit greifen, aus dem Hang hochziehen.',
   'Bodyweight exercise for back and biceps. Shoulder-width grip, pull from dead hang.',
   'strength', 'intermediate', 'bodyweight', 'myprosole', 'proprietary'),

  ('dumbbell_lunge',
   'Kurzhantel-Ausfallschritt',
   'Dumbbell Lunge',
   'Unilaterale Beinübung für Quads, Glutes und Stabilität. Knie nicht über Zehenspitzen.',
   'Unilateral leg exercise for quads, glutes, and stability. Knee does not pass toes.',
   'strength', 'beginner', 'both', 'myprosole', 'proprietary'),

  ('plank',
   'Unterarmstütz',
   'Plank',
   'Isometrische Rumpfstabilisation. Körper bildet eine gerade Linie, kein Durchhängen.',
   'Isometric core stabilization. Body forms a straight line, no sagging.',
   'strength', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('side_plank',
   'Seitlicher Unterarmstütz',
   'Side Plank',
   'Stabilisiert seitliche Rumpfmuskulatur und Obliques. Hüfte nicht absinken lassen.',
   'Stabilizes lateral core and obliques. Do not let hip drop.',
   'strength', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('hip_thrust',
   'Hip Thrust',
   'Hip Thrust',
   'Isoliert die Gesäßmuskulatur. Schultern auf der Bank, Hüfte bis zur vollen Extension heben.',
   'Isolates glutes. Shoulders on bench, drive hips to full extension.',
   'strength', 'intermediate', 'gym', 'myprosole', 'proprietary'),

  ('leg_curl',
   'Beincurl',
   'Leg Curl',
   'Isolationsübung für die hintere Oberschenkelmuskulatur. Kontrollierte Bewegung.',
   'Isolation exercise for hamstrings. Controlled movement.',
   'strength', 'beginner', 'gym', 'myprosole', 'proprietary'),

  ('lat_pulldown_exercise',
   'Latzug',
   'Lat Pulldown',
   'Zugübung für den Latissimus. Schulterblätter nach unten ziehen, Ellenbogen zum Körper.',
   'Pull exercise for lats. Drive shoulder blades down, elbows toward body.',
   'strength', 'beginner', 'gym', 'myprosole', 'proprietary'),

  ('dumbbell_curl',
   'Bizeps-Curl mit Kurzhanteln',
   'Dumbbell Bicep Curl',
   'Isolationsübung für den Bizeps. Oberarm fixiert, kontrolliertes Heben und Senken.',
   'Isolation exercise for biceps. Upper arm fixed, controlled lift and lower.',
   'strength', 'beginner', 'gym', 'myprosole', 'proprietary'),

  ('triceps_pushdown',
   'Trizepsdrücken am Kabelzug',
   'Tricep Pushdown',
   'Isolationsübung für den Trizeps am Kabelzug. Ellenbogen eng am Körper.',
   'Isolation exercise for triceps on cable machine. Elbows close to body.',
   'strength', 'beginner', 'gym', 'myprosole', 'proprietary'),

  ('romanian_deadlift',
   'Rumänisches Kreuzheben',
   'Romanian Deadlift',
   'Betont die hintere Kette (Hamstrings, Glutes). Leicht gebeugte Knie, Hüftbeugung betonen.',
   'Emphasizes posterior chain (hamstrings, glutes). Slight knee bend, hinge at hips.',
   'strength', 'intermediate', 'gym', 'myprosole', 'proprietary'),

  ('goblet_squat',
   'Goblet Squat',
   'Goblet Squat',
   'Kniebeuge mit Kurzhantel/Kettlebell vor der Brust. Ideal zum Erlernen der Kniebeugen-Technik.',
   'Squat with dumbbell/kettlebell at chest. Ideal for learning squat technique.',
   'strength', 'beginner', 'gym', 'myprosole', 'proprietary'),

  ('face_pull',
   'Face Pull',
   'Face Pull',
   'Kabelzugübung für hintere Schulter und Rotatorenmanschette. Seil zum Gesicht ziehen, Ellenbogen hoch.',
   'Cable exercise for rear delts and rotator cuff. Pull rope to face, elbows high.',
   'injury_prevention', 'beginner', 'gym', 'myprosole', 'proprietary'),

  ('hip_flexor_stretch',
   'Hüftbeuger-Dehnung',
   'Hip Flexor Stretch',
   'Knieend dehnen: hinteres Bein gestreckt, vorderes 90°. 2 × 45 Sekunden pro Seite.',
   'Kneeling stretch: back leg extended, front at 90°. 2 × 45 seconds per side.',
   'mobility', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('foam_rolling_quads',
   'Faszienrollen Oberschenkel',
   'Foam Rolling Quads',
   'Selbstmassage für Quadrizeps und IT-Band. Langsam rollen, an Triggerpunkten verweilen.',
   'Self-massage for quads and IT band. Roll slowly, pause on trigger points.',
   'mobility', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('glute_bridge',
   'Glute Bridge',
   'Glute Bridge',
   'Grundübung für Gesäßaktivierung. Auf dem Rücken liegend, Hüfte nach oben drücken. 3 × 15.',
   'Fundamental glute activation. Lying on back, drive hips upward. 3 × 15.',
   'strength', 'beginner', 'bodyweight', 'myprosole', 'proprietary'),

  ('push_up',
   'Liegestütz',
   'Push-Up',
   'Grundübung für Brust, Schultern und Trizeps. Körper gerade, Ellenbogen ca. 45° zum Körper.',
   'Fundamental exercise for chest, shoulders, and triceps. Body straight, elbows ~45° from body.',
   'strength', 'beginner', 'bodyweight', 'myprosole', 'proprietary')
on conflict (slug) do nothing;

-- =============================================================================
-- Exercise ↔ Muscle Groups (Zuordnungen)
-- =============================================================================
-- Hilfsfunktion: Vermeidet Wiederholungen und macht die Zuordnung lesbarer.
-- Wird am Ende des Skripts wieder entfernt.
create or replace function public._seed_exercise_muscle(
  p_exercise_slug text,
  p_muscle_slug   text,
  p_role          public.muscle_role default 'primary'
) returns void language plpgsql as $$
declare
  v_exercise_id uuid;
  v_muscle_id   uuid;
begin
  select id into v_exercise_id from public.exercises where slug = p_exercise_slug;
  select id into v_muscle_id   from public.muscle_groups where slug = p_muscle_slug;
  if v_exercise_id is not null and v_muscle_id is not null then
    insert into public.exercise_muscles (exercise_id, muscle_group_id, role)
    values (v_exercise_id, v_muscle_id, p_role)
    on conflict (exercise_id, muscle_group_id) do nothing;
  end if;
end;
$$;

-- Lauftechnik-Übungen
select public._seed_exercise_muscle('barefoot_march',       'calves',       'primary');
select public._seed_exercise_muscle('barefoot_march',       'tibialis',     'secondary');
select public._seed_exercise_muscle('skipping_drill',       'calves',       'primary');
select public._seed_exercise_muscle('skipping_drill',       'hip_flexors',  'secondary');
select public._seed_exercise_muscle('calf_raises_eccentric','calves',       'primary');
select public._seed_exercise_muscle('single_leg_balance',   'calves',       'primary');
select public._seed_exercise_muscle('single_leg_balance',   'glutes',       'secondary');
select public._seed_exercise_muscle('hop_runs',             'calves',       'primary');
select public._seed_exercise_muscle('hop_runs',             'quads',        'secondary');
select public._seed_exercise_muscle('wall_ankle_mobility',  'calves',       'primary');
select public._seed_exercise_muscle('wall_ankle_mobility',  'tibialis',     'secondary');
select public._seed_exercise_muscle('ankle_rocking',        'tibialis',     'primary');
select public._seed_exercise_muscle('ankle_rocking',        'calves',       'secondary');
select public._seed_exercise_muscle('stability_circuit',    'calves',       'primary');
select public._seed_exercise_muscle('stability_circuit',    'glutes',       'secondary');
select public._seed_exercise_muscle('knee_lift_abc',        'hip_flexors',  'primary');
select public._seed_exercise_muscle('knee_lift_abc',        'quads',        'secondary');

-- Gym-Grundübungen
select public._seed_exercise_muscle('squat',                'quads',        'primary');
select public._seed_exercise_muscle('squat',                'glutes',       'primary');
select public._seed_exercise_muscle('squat',                'hamstrings',   'secondary');
select public._seed_exercise_muscle('squat',                'calves',       'secondary');

select public._seed_exercise_muscle('deadlift',             'hamstrings',   'primary');
select public._seed_exercise_muscle('deadlift',             'glutes',       'primary');
select public._seed_exercise_muscle('deadlift',             'lower_back',   'primary');
select public._seed_exercise_muscle('deadlift',             'quads',        'secondary');
select public._seed_exercise_muscle('deadlift',             'forearms',     'secondary');

select public._seed_exercise_muscle('bench_press',          'chest',        'primary');
select public._seed_exercise_muscle('bench_press',          'triceps',      'secondary');
select public._seed_exercise_muscle('bench_press',          'shoulders',    'secondary');

select public._seed_exercise_muscle('overhead_press',       'shoulders',    'primary');
select public._seed_exercise_muscle('overhead_press',       'triceps',      'secondary');

select public._seed_exercise_muscle('barbell_row',          'upper_back',   'primary');
select public._seed_exercise_muscle('barbell_row',          'lats',         'primary');
select public._seed_exercise_muscle('barbell_row',          'biceps',       'secondary');

select public._seed_exercise_muscle('pull_up',              'lats',         'primary');
select public._seed_exercise_muscle('pull_up',              'upper_back',   'secondary');
select public._seed_exercise_muscle('pull_up',              'biceps',       'secondary');

select public._seed_exercise_muscle('dumbbell_lunge',       'quads',        'primary');
select public._seed_exercise_muscle('dumbbell_lunge',       'glutes',       'primary');
select public._seed_exercise_muscle('dumbbell_lunge',       'hamstrings',   'secondary');

select public._seed_exercise_muscle('plank',                'abs',          'primary');
select public._seed_exercise_muscle('plank',                'obliques',     'secondary');
select public._seed_exercise_muscle('plank',                'shoulders',    'secondary');

select public._seed_exercise_muscle('side_plank',           'obliques',     'primary');
select public._seed_exercise_muscle('side_plank',           'abs',          'secondary');

select public._seed_exercise_muscle('hip_thrust',           'glutes',       'primary');
select public._seed_exercise_muscle('hip_thrust',           'hamstrings',   'secondary');

select public._seed_exercise_muscle('leg_curl',             'hamstrings',   'primary');

select public._seed_exercise_muscle('lat_pulldown_exercise','lats',         'primary');
select public._seed_exercise_muscle('lat_pulldown_exercise','biceps',       'secondary');
select public._seed_exercise_muscle('lat_pulldown_exercise','upper_back',   'secondary');

select public._seed_exercise_muscle('dumbbell_curl',        'biceps',       'primary');
select public._seed_exercise_muscle('dumbbell_curl',        'forearms',     'secondary');

select public._seed_exercise_muscle('triceps_pushdown',     'triceps',      'primary');

select public._seed_exercise_muscle('romanian_deadlift',    'hamstrings',   'primary');
select public._seed_exercise_muscle('romanian_deadlift',    'glutes',       'primary');
select public._seed_exercise_muscle('romanian_deadlift',    'lower_back',   'secondary');

select public._seed_exercise_muscle('goblet_squat',         'quads',        'primary');
select public._seed_exercise_muscle('goblet_squat',         'glutes',       'secondary');

select public._seed_exercise_muscle('face_pull',            'upper_back',   'primary');
select public._seed_exercise_muscle('face_pull',            'shoulders',    'secondary');

select public._seed_exercise_muscle('hip_flexor_stretch',   'hip_flexors',  'primary');

select public._seed_exercise_muscle('foam_rolling_quads',   'quads',        'primary');

select public._seed_exercise_muscle('glute_bridge',         'glutes',       'primary');
select public._seed_exercise_muscle('glute_bridge',         'hamstrings',   'secondary');

select public._seed_exercise_muscle('push_up',              'chest',        'primary');
select public._seed_exercise_muscle('push_up',              'triceps',      'secondary');
select public._seed_exercise_muscle('push_up',              'shoulders',    'secondary');

-- Hilfsfunktion entfernen
drop function public._seed_exercise_muscle(text, text, public.muscle_role);

-- =============================================================================
-- Exercise ↔ Equipment (Zuordnungen)
-- =============================================================================
create or replace function public._seed_exercise_equipment(
  p_exercise_slug  text,
  p_equipment_slug text
) returns void language plpgsql as $$
declare
  v_exercise_id  uuid;
  v_equipment_id uuid;
begin
  select id into v_exercise_id  from public.exercises where slug = p_exercise_slug;
  select id into v_equipment_id from public.equipment where slug = p_equipment_slug;
  if v_exercise_id is not null and v_equipment_id is not null then
    insert into public.exercise_equipment (exercise_id, equipment_id)
    values (v_exercise_id, v_equipment_id)
    on conflict (exercise_id, equipment_id) do nothing;
  end if;
end;
$$;

select public._seed_exercise_equipment('deadlift',              'barbell');
select public._seed_exercise_equipment('bench_press',           'barbell');
select public._seed_exercise_equipment('bench_press',           'bench');
select public._seed_exercise_equipment('overhead_press',        'barbell');
select public._seed_exercise_equipment('barbell_row',           'barbell');
select public._seed_exercise_equipment('pull_up',               'pull_up_bar');
select public._seed_exercise_equipment('dumbbell_lunge',        'dumbbell');
select public._seed_exercise_equipment('hip_thrust',            'bench');
select public._seed_exercise_equipment('hip_thrust',            'barbell');
select public._seed_exercise_equipment('leg_curl',              'cable_machine');
select public._seed_exercise_equipment('lat_pulldown_exercise', 'lat_pulldown');
select public._seed_exercise_equipment('dumbbell_curl',         'dumbbell');
select public._seed_exercise_equipment('triceps_pushdown',      'cable_machine');
select public._seed_exercise_equipment('romanian_deadlift',     'barbell');
select public._seed_exercise_equipment('goblet_squat',          'dumbbell');
select public._seed_exercise_equipment('goblet_squat',          'kettlebell');
select public._seed_exercise_equipment('face_pull',             'cable_machine');
select public._seed_exercise_equipment('foam_rolling_quads',    'foam_roller');

-- Hilfsfunktion entfernen
drop function public._seed_exercise_equipment(text, text);
