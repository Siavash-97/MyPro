-- ============================================================
-- 0016: Bilder fuer die Uebungen aus 0007
-- ============================================================
-- ERZEUGT von supabase/import/uebungen-import.mjs - nicht von Hand aendern.
--
-- Die 36 handgeschriebenen Uebungen aus Migration 0007 hatten nie eine
-- image_url und zeigten deshalb auf der Detailseite den grauen Platzhalter.
-- Diese Migration traegt Bilder aus free-exercise-db nach (gemeinfrei,
-- Unlicense), zugeordnet nach Bewegung statt nach Namensaehnlichkeit.
--
-- "and image_url is null" laesst bereits gesetzte Bilder in Ruhe - die
-- Migration laesst sich also gefahrlos mehrfach ausfuehren.
--
-- Bewusst ohne Bild bleiben die Lauf-Drills (Barfuss-Marsch, Lauf-ABC,
-- Metronom-Drills, Linienlauf und die uebrigen). Dafuer gibt es in
-- free-exercise-db nichts Passendes; das sind Lauftechnik-Uebungen, keine
-- Studio-Uebungen. Ein unpassendes Foto waere schlechter als keines.
-- ============================================================

update public.exercises set image_url = '/uebungen/Barbell_Full_Squat/0.jpg'
 where slug = 'squat' and image_url is null;
update public.exercises set image_url = '/uebungen/Barbell_Deadlift/0.jpg'
 where slug = 'deadlift' and image_url is null;
update public.exercises set image_url = '/uebungen/Barbell_Bench_Press_-_Medium_Grip/0.jpg'
 where slug = 'bench_press' and image_url is null;
update public.exercises set image_url = '/uebungen/Standing_Military_Press/0.jpg'
 where slug = 'overhead_press' and image_url is null;
update public.exercises set image_url = '/uebungen/Bent_Over_Barbell_Row/0.jpg'
 where slug = 'barbell_row' and image_url is null;
update public.exercises set image_url = '/uebungen/Pullups/0.jpg'
 where slug = 'pull_up' and image_url is null;
update public.exercises set image_url = '/uebungen/Pushups/0.jpg'
 where slug = 'push_up' and image_url is null;
update public.exercises set image_url = '/uebungen/Dumbbell_Lunges/0.jpg'
 where slug = 'dumbbell_lunge' and image_url is null;
update public.exercises set image_url = '/uebungen/Plank/0.jpg'
 where slug = 'plank' and image_url is null;
update public.exercises set image_url = '/uebungen/Side_Bridge/0.jpg'
 where slug = 'side_plank' and image_url is null;
update public.exercises set image_url = '/uebungen/Barbell_Hip_Thrust/0.jpg'
 where slug = 'hip_thrust' and image_url is null;
update public.exercises set image_url = '/uebungen/Butt_Lift_Bridge/0.jpg'
 where slug = 'glute_bridge' and image_url is null;
update public.exercises set image_url = '/uebungen/Lying_Leg_Curls/0.jpg'
 where slug = 'leg_curl' and image_url is null;
update public.exercises set image_url = '/uebungen/Full_Range-Of-Motion_Lat_Pulldown/0.jpg'
 where slug = 'lat_pulldown_exercise' and image_url is null;
update public.exercises set image_url = '/uebungen/Dumbbell_Bicep_Curl/0.jpg'
 where slug = 'dumbbell_curl' and image_url is null;
update public.exercises set image_url = '/uebungen/Triceps_Pushdown/0.jpg'
 where slug = 'triceps_pushdown' and image_url is null;
update public.exercises set image_url = '/uebungen/Romanian_Deadlift/0.jpg'
 where slug = 'romanian_deadlift' and image_url is null;
update public.exercises set image_url = '/uebungen/Goblet_Squat/0.jpg'
 where slug = 'goblet_squat' and image_url is null;
update public.exercises set image_url = '/uebungen/Face_Pull/0.jpg'
 where slug = 'face_pull' and image_url is null;
update public.exercises set image_url = '/uebungen/Kneeling_Hip_Flexor/0.jpg'
 where slug = 'hip_flexor_stretch' and image_url is null;
update public.exercises set image_url = '/uebungen/Quadriceps-SMR/0.jpg'
 where slug = 'foam_rolling_quads' and image_url is null;
update public.exercises set image_url = '/uebungen/Standing_Calf_Raises/0.jpg'
 where slug = 'calf_raises_eccentric' and image_url is null;
