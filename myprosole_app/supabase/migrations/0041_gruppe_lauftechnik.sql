-- ============================================================
-- 0041: Die fuenfte Gruppe – Lauftechnik
-- ============================================================
-- Warum
-- -----
-- Die vier Gruppen aus 0040 kraeftigen und dehnen. Keine davon aendert,
-- WIE jemand laeuft. Fuer eine App, deren Kern die Ganganalyse ist, fehlte
-- damit ausgerechnet die Gruppe, die am naechsten am Produkt liegt: Wer
-- sieht, wie er abrollt, will auch wissen, wie er es aendert.
--
-- Sechs Uebungen aus dem Lauf-ABC, alle ohne Geraet und ueberall machbar.
--
-- Herkunft
-- --------
--   4 aus free-exercise-db (Unlicense, gemeinfrei)
--   2 selbst geschrieben
--
-- Warum zwei selbst
-- -----------------
-- Der Fussgelenkslauf fehlt in allen geprueften Quellen. Das ist dieselbe
-- Luecke wie bei den Fussuebungen aus 0040 – allgemeine Fitnessdatenbanken
-- kennen den Fuss nicht als eigenes Thema.
--
-- Das Anfersen steht zwar als "Double Leg Butt Kick" in free-exercise-db,
-- ist dort aber etwas anderes: ein Strecksprung mit angezogenen Fersen, kein
-- Lauf-ABC. Die Anleitung spricht von "jump for maximum vertical height".
-- Uebernommen haette das den Namen richtig und die Bewegung falsch gehabt.
--
-- Zur Reihenfolge
-- ---------------
-- Position 5, also unten. Das ist eine Anzeigeentscheidung und kein Urteil
-- ueber die Wichtigkeit; sie laesst sich mit einer Zeile aendern.
--
-- Fachliche Durchsicht steht auch hier aus.
-- ============================================================

insert into public.exercise_groups (slug, name_de, lead_de, position) values
  ('lauftechnik', 'Lauftechnik',
   'Lauf-ABC: kurze Übungen, die den Bewegungsablauf schulen. Vor dem Lauf, je 15 bis 20 Meter, zwei bis drei Durchgänge.', 5)
on conflict (slug) do nothing;

with g as (
  select id from public.exercise_groups where slug = 'lauftechnik'
),
neu (slug, name_de, name_en, description_de, kategorie, schwierigkeit,
     quelle, lizenz, quell_url, fremd_id) as (values

('fussgelenkslauf', 'Fußgelenkslauf', null,
 'Lauf mit ganz kurzen Schritten vorwärts und roll dabei bewusst über den ganzen Fuß ab – Ferse, Mittelfuß, Ballen, Zehen. Die Knie bleiben fast gestreckt, die Bewegung kommt allein aus dem Sprunggelenk. Langsam und sauber, nicht schnell. Warum: Die Grundübung des Lauf-ABC. Sie schult das Abrollen und weckt die Muskeln, die beim Abdruck den letzten Teil leisten – genau die Stelle, die eine Einlage unterstützt.',
 'technique', 'beginner', 'MyProSole', 'eigene Inhalte', null, null),

('kniehebelauf-am-wandstuetz', 'Kniehebelauf am Wandstütz', 'Linear Acceleration Wall Drill',
 'Stütz dich mit gestreckten Armen schräg an eine Wand, etwa 45 Grad, Körper in einer Linie, Gesäß angespannt. Zieh ein Knie zügig nach oben, halte kurz, und setz den Fuß gerade nach unten wieder auf. Dann das andere Bein. Zum Schluss schnell im Wechsel. Warum: Übt den Kniehub und den senkrechten Fußaufsatz unter dem Körper – ohne dass man dabei gleichzeitig das Gleichgewicht halten muss.',
 'technique', 'beginner', 'free-exercise-db', 'Unlicense (gemeinfrei)',
 'https://github.com/yuhonas/free-exercise-db', 'Linear_Acceleration_Wall_Drill'),

('anfersen', 'Anfersen', null,
 'Lauf locker vorwärts und lass dabei die Fersen zum Gesäß hochschnellen. Die Oberschenkel bleiben nahezu senkrecht, der Unterschenkel klappt nur nach hinten ein. Der Oberkörper bleibt aufrecht, das Tempo langsam – es geht um die Bewegung, nicht um Strecke. Warum: Löst den vorderen Oberschenkel und übt das schnelle Einklappen des Unterschenkels nach dem Abdruck. Wer das nicht tut, schleppt das Bein durch und verliert Frequenz.',
 'technique', 'beginner', 'MyProSole', 'eigene Inhalte', null, null),

('hopserlauf', 'Hopserlauf', 'Fast Skipping',
 'Ein Hüpfschritt im Wechsel: rechts-rechts-Schritt, links-links-Schritt. Bleib flach über dem Boden, kurze Bodenkontakte, zügiger Rhythmus statt hoher Sprünge. Warum: Bringt Rhythmus und Spannung in den Fuß und schult den federnden Bodenkontakt.',
 'technique', 'beginner', 'free-exercise-db', 'Unlicense (gemeinfrei)',
 'https://github.com/yuhonas/free-exercise-db', 'Fast_Skipping'),

('greifender-fussaufsatz', 'Greifender Fußaufsatz', 'Moving Claw Series',
 'Lauf locker und setz den Fuß bewusst aktiv auf: Der Unterschenkel schwingt nach vorn und der Fuß zieht beim Aufsetzen leicht nach hinten, als würdest du den Boden nach hinten wegziehen. Arme arbeiten kurz und zügig mit. Warum: Ein Fuß, der bremsend vor dem Körper landet, kostet bei jedem Schritt Tempo. Diese Übung bringt den Aufsatz unter den Körper.',
 'technique', 'intermediate', 'free-exercise-db', 'Unlicense (gemeinfrei)',
 'https://github.com/yuhonas/free-exercise-db', 'Moving_Claw_Series'),

('armarbeit-im-kniestand', 'Armarbeit im Kniestand', 'Kneeling Arm Drill',
 'Geh in den Kniestand, ein Fuß vorn, und drück über die vordere Ferse, damit Gesäß und hintere Oberschenkel Spannung haben. Schwing die Arme wie beim Laufen: Ellbogen etwa rechtwinklig, die Bewegung kommt aus der Schulter, die Hände führen bis zur Hüfte und zügig wieder nach vorn. Erst locker, dann schneller. Seite wechseln. Warum: Die Arme geben den Takt vor. Im Kniestand lässt sich das üben, ohne dass die Beine ablenken.',
 'technique', 'beginner', 'free-exercise-db', 'Unlicense (gemeinfrei)',
 'https://github.com/yuhonas/free-exercise-db', 'Kneeling_Arm_Drill')
)
insert into public.exercises
  (slug, name_de, name_en, description_de, category, difficulty, modality,
   group_id, source_name, source_license, source_url, external_id, is_active)
select
  n.slug, n.name_de, n.name_en, n.description_de,
  n.kategorie::public.exercise_category,
  n.schwierigkeit::public.exercise_difficulty,
  'bodyweight'::public.exercise_modality,
  g.id, n.quelle, n.lizenz, n.quell_url, n.fremd_id, true
from neu n cross join g
on conflict (slug) do nothing;

insert into public.exercise_muscles (exercise_id, muscle_group_id, role)
select e.id, m.id, z.rolle::public.muscle_role
from (values
  ('fussgelenkslauf',            'calves',      'primary'),
  ('fussgelenkslauf',            'foot',        'primary'),
  ('fussgelenkslauf',            'tibialis',    'secondary'),
  ('kniehebelauf-am-wandstuetz', 'hip_flexors', 'primary'),
  ('kniehebelauf-am-wandstuetz', 'glutes',      'secondary'),
  ('anfersen',                   'hamstrings',  'primary'),
  ('anfersen',                   'quads',       'secondary'),
  ('hopserlauf',                 'calves',      'primary'),
  ('hopserlauf',                 'quads',       'secondary'),
  ('greifender-fussaufsatz',     'hamstrings',  'primary'),
  ('greifender-fussaufsatz',     'glutes',      'secondary'),
  ('armarbeit-im-kniestand',     'shoulders',   'primary'),
  ('armarbeit-im-kniestand',     'upper_back',  'secondary')
) as z(uebung, muskel, rolle)
join public.exercises e on e.slug = z.uebung
join public.muscle_groups m on m.slug = z.muskel
on conflict (exercise_id, muscle_group_id) do nothing;
