-- ============================================================
-- 0040: Die Grundausstattung an Uebungen
-- ============================================================
-- Was hier entsteht
-- -----------------
-- 24 Uebungen in vier Gruppen, alle ohne jedes Geraet. Sie sind die
-- kostenlose Grundlage auf der Trainingsseite. Das personalisierte Angebot
-- fuer Menschen mit Einlagen setzt spaeter darauf auf – dieselben Bereiche,
-- aber auf die Person zugeschnitten.
--
-- Der Katalog wurde mit 0039 geleert, weil der uebernommene Bestand nie
-- ausgewaehlt war. Dies ist die bewusste Auswahl. Der Vorschlag mit allen
-- Texten und Begruendungen steht in
-- docs/uebungen-vorschlag-grundausstattung.md und wurde am 19.08.2026
-- durchgesehen und angenommen.
--
-- Herkunft und Lizenz
-- -------------------
--   16 aus free-exercise-db (Unlicense, gemeinfrei)
--    8 selbst geschrieben
--
-- Die deutschen Texte stammen durchgehend von uns und sind keine woertliche
-- Uebersetzung. An der Grundausstattung haengt damit keine einzige
-- Lizenzpflicht: kein Quellenverzeichnis, keine Namensnennung, keine
-- Abhaengigkeit von einem Anbieter, der seine Bedingungen aendern kann.
--
-- Trotzdem steht die Herkunft je Zeile in source_name, source_license und
-- source_url. Nicht weil eine Pflicht besteht, sondern damit in zwei Jahren
-- noch nachvollziehbar ist, woher ein Text kam.
--
-- Warum eine eigene Gruppentabelle
-- --------------------------------
-- Die vorhandene Spalte `category` beschreibt die ART einer Uebung
-- (strength, mobility, technique, injury_prevention). Die vier Gruppen sind
-- etwas anderes: eine Einteilung fuer die Anzeige, nach Koerperbereich und
-- Ziel. "Knie kraeftigen" und "Bauch und Po kraeftigen" waeren beide
-- `strength` – die Kategorie kann sie nicht auseinanderhalten.
--
-- Deshalb eine kleine Referenztabelle mit Namen, Beschreibung und
-- Reihenfolge, und eine Spalte auf exercises. Bewusst keine
-- Verknuepfungstabelle: Jede Uebung gehoert heute in genau eine Gruppe, und
-- eine Tabelle weniger ist eine Tabelle weniger. Sollte spaeter eine Uebung
-- in zwei Gruppen gehoeren, wird daraus eine Verknuepfung – das ist dann
-- eine Migration und kein Umbau.
--
-- Was noch fehlt
-- --------------
-- Bilder und Videos: keine. Die Spalten bleiben leer, und die Uebungsseite
-- sollte den Videoplatz ehrlich beschriften, statt so auszusehen, als lade
-- gleich etwas.
--
-- Saetze, Wiederholungen und Dauer: stehen noch nicht je Uebung. Die
-- Mikroroutine gibt heute pauschal "2 Saetze, 12 Wiederholungen" vor. Das
-- passt fuer die Kraeftigung, nicht fuer Dehnungen und nicht fuer gehaltene
-- Uebungen wie den Wandsitz. Eigene Migration.
--
-- Fachliche Durchsicht: steht aus. Das sind Gesundheitsinhalte fuer
-- Menschen, die in der Anamnese Schmerzen angegeben haben. Vor der
-- Auslieferung gehoert das von jemandem aus Physiotherapie oder
-- Sportwissenschaft angesehen.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Die Fussmuskulatur bekommt eine eigene Gruppe
-- ------------------------------------------------------------
-- Das Vokabular kannte bisher `calves` (Waden) und `tibialis`
-- (Schienbeinmuskel) – beides Unterschenkel. Die kleinen Muskeln im Fuss
-- selbst fehlten. Fuer eine Einlagenfirma ist ausgerechnet das die
-- wichtigste Gruppe.
insert into public.muscle_groups (slug, name_de, name_en)
values ('foot', 'Fußmuskulatur', 'Intrinsic foot muscles')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 2. Die vier Gruppen
-- ------------------------------------------------------------
create table if not exists public.exercise_groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_de     text not null,
  -- Ein Satz, der auf der Seite ueber den Uebungen steht.
  lead_de     text not null,
  -- Reihenfolge auf der Trainingsseite. Klein bedeutet weiter oben.
  position    smallint not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint exercise_groups_position_unique unique (position),
  constraint exercise_groups_slug_form check (slug ~ '^[a-z][a-z0-9-]{2,40}$')
);

comment on table public.exercise_groups is
  'Die Gruppen, in denen Uebungen auf der Trainingsseite stehen. Eine '
  'Einteilung fuer die Anzeige nach Koerperbereich und Ziel – nicht zu '
  'verwechseln mit exercises.category, die die Art der Uebung beschreibt.';

alter table public.exercise_groups enable row level security;

-- Uebungsgruppen sind Nachschlagewerk, kein Nutzerbesitz: Jeder Angemeldete
-- liest dieselben. Geschrieben wird nur ueber Migrationen.
drop policy if exists exercise_groups_lesen on public.exercise_groups;
create policy exercise_groups_lesen on public.exercise_groups
  for select to authenticated using (true);

-- Ohne dieses Recht bliebe die Tabelle trotz Regel unsichtbar (siehe 0037).
grant select on public.exercise_groups to authenticated;
grant all on public.exercise_groups to service_role;

create or replace trigger exercise_groups_set_updated_at
  before update on public.exercise_groups
  for each row execute function public.set_updated_at();

insert into public.exercise_groups (slug, name_de, lead_de, position) values
  ('beweglichkeit-laufer', 'Beweglichkeit für Läufer',
   'Die sechs Stellen, die beim Laufen zuerst dicht werden. Nach dem Lauf, je Seite ruhig 30 Sekunden halten.', 1),
  ('knie-kraeftigen', 'Knie kräftigen',
   'Nicht das Knie selbst, sondern was es führt: Oberschenkel und Hüfte.', 2),
  ('bauch-po-kraeftigen', 'Bauch und Po kräftigen',
   'Rumpfstabilität. Ohne sie geht Kraft aus den Beinen im Oberkörper verloren.', 3),
  ('fuss-uebungen', 'Fuß-Übungen',
   'Die kleinen Muskeln im Fuß selbst. Sie tragen das Gewölbe – die Waden können das nicht ersetzen.', 4)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 3. Die Zuordnung an den Uebungen
-- ------------------------------------------------------------
-- Nullbar: Eine Uebung kann bestehen, ohne in einer Gruppe der freien
-- Grundausstattung zu stehen – etwa eine, die spaeter nur personalisiert
-- ausgespielt wird.
alter table public.exercises
  add column if not exists group_id uuid references public.exercise_groups (id) on delete set null;

create index if not exists exercises_group_idx on public.exercises (group_id);

comment on column public.exercises.group_id is
  'In welcher Gruppe die Uebung auf der Trainingsseite steht. Null heisst: '
  'in keiner – die Uebung gehoert dann nicht zur freien Grundausstattung.';

-- ------------------------------------------------------------
-- 4. Die Uebungen
-- ------------------------------------------------------------
-- Die Herkunft steht je Zeile, damit sie nachvollziehbar bleibt.
-- external_id traegt bei uebernommenen Uebungen den Namen aus der Quelle;
-- so laesst sich spaeter gegen das Original abgleichen.

with g as (
  select slug, id from public.exercise_groups
),
neu (slug, name_de, name_en, description_de, kategorie, schwierigkeit,
     gruppe, quelle, lizenz, quell_url, fremd_id) as (values

-- ---- 1. Beweglichkeit für Läufer -------------------------------------
('hueftbeuger-dehnung-kniestand', 'Hüftbeuger-Dehnung im Kniestand', 'Kneeling Hip Flexor',
 'Geh in den Kniestand, ein Fuß vorn, das hintere Knie auf einer weichen Unterlage. Spann das Gesäß der hinteren Seite an und schieb die Hüfte langsam nach vorn, bis es vorn am Oberschenkel zieht. Oberkörper bleibt aufrecht. Warum: Vom vielen Sitzen verkürzt der Hüftbeuger. Er kippt das Becken nach vorn und bremst die Streckung beim Abdruck.',
 'mobility', 'beginner', 'beweglichkeit-laufer',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Kneeling_Hip_Flexor'),

('wadendehnung-gestrecktes-knie', 'Wadendehnung mit gestrecktem Knie', 'Standing Gastrocnemius Calf Stretch',
 'Stell dich mit den Händen an eine Wand, ein Bein weit nach hinten. Ferse bleibt am Boden, Knie gestreckt, Fußspitze zeigt nach vorn. Schieb die Hüfte zur Wand. Warum: Trifft den oberflächlichen Wadenmuskel, der über das Knie zieht.',
 'mobility', 'beginner', 'beweglichkeit-laufer',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Standing_Gastrocnemius_Calf_Stretch'),

('tiefe-wadendehnung-gebeugtes-knie', 'Tiefe Wadendehnung mit gebeugtem Knie', 'Standing Soleus And Achilles Stretch',
 'Dieselbe Haltung wie bei der Wadendehnung, aber das hintere Knie leicht beugen und die Ferse unten lassen. Das Ziehen wandert tiefer, Richtung Achillessehne. Warum: Der tiefe Wadenmuskel wird von der gestreckten Variante nicht erreicht. Er hängt direkt an der Achillessehne – der häufigsten Beschwerdestelle bei Läufern.',
 'mobility', 'beginner', 'beweglichkeit-laufer',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Standing_Soleus_And_Achilles_Stretch'),

('laeuferdehnung-hintere-oberschenkel', 'Läuferdehnung für die hinteren Oberschenkel', 'Runners Stretch',
 'Aus dem Ausfallschritt das vordere Bein strecken, Zehen anziehen, Gesäß nach hinten schieben. Rücken lang lassen, nicht rund machen. Warum: Kurze hintere Oberschenkel verkürzen den Schritt und ziehen am Becken.',
 'mobility', 'beginner', 'beweglichkeit-laufer',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Runners_Stretch'),

('gesaessdehnung-im-sitzen', 'Gesäßdehnung im Sitzen', 'Ankle On The Knee',
 'Setz dich, leg den einen Knöchel auf das andere Knie, sodass ein Viereck entsteht. Zieh das untere Bein zu dir heran, Rücken gerade. Warum: Der tiefe Gesäßmuskel liegt direkt am Ischiasnerv. Ist er fest, strahlt es ins Gesäß und in den hinteren Oberschenkel aus.',
 'mobility', 'beginner', 'beweglichkeit-laufer',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Ankle_On_The_Knee'),

('grosse-laeuferdehnung', 'Große Läuferdehnung', 'Worlds Greatest Stretch',
 'Weiter Ausfallschritt, beide Hände neben dem vorderen Fuß. Den Ellbogen der inneren Seite Richtung Boden führen, dann den anderen Arm zur Decke öffnen und dem Blick folgen. Warum: Eine Bewegung für Hüfte, Leiste und Brustwirbelsäule. In Bewegung statt gehalten – gut zum Aufwärmen.',
 'mobility', 'intermediate', 'beweglichkeit-laufer',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Worlds_Greatest_Stretch'),

-- ---- 2. Knie kräftigen -----------------------------------------------
('kniebeuge-ohne-gewicht', 'Kniebeuge ohne Gewicht', 'Bodyweight Squat',
 'Schulterbreit stehen, Hände vor der Brust. Knie und Hüfte beugen, Gesäß nach hinten schieben. So tief, wie es ohne Rundrücken geht, dann zügig hoch. Warum: Die Grundbewegung. Wer sie sauber kann, hält auch die Landung.',
 'strength', 'beginner', 'knie-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Bodyweight_Squat'),

('ausfallschritt-im-gehen', 'Ausfallschritt im Gehen', 'Bodyweight Walking Lunge',
 'Ein großer Schritt nach vorn, hinteres Knie Richtung Boden senken. Vorderes Knie bleibt über dem Fuß, nicht davor. Dann durchschreiten. Warum: Einbeinige Belastung – näher am Laufen als die beidbeinige Kniebeuge.',
 'strength', 'beginner', 'knie-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Bodyweight_Walking_Lunge'),

('wandsitz', 'Wandsitz', null,
 'Mit dem Rücken an die Wand, Füße einen Schritt davor, langsam absenken, bis Ober- und Unterschenkel etwa einen rechten Winkel bilden. Halten. Beginn mit 20 Sekunden, steigern bis 60. Warum: Kräftigt den vorderen Oberschenkel ohne Bewegung im Gelenk. Deshalb oft auch dann möglich, wenn Kniebeugen noch wehtun.',
 'strength', 'beginner', 'knie-kraeftigen',
 'MyProSole', 'eigene Inhalte', null, null),

('seitliches-beinheben-seitlage', 'Seitliches Beinheben in Seitlage', null,
 'Auf die Seite legen, unteres Bein angewinkelt, oberes gestreckt. Das obere Bein langsam heben und wieder senken, ohne die Hüfte nach hinten zu kippen. Fußspitze zeigt leicht nach unten, nicht zur Decke. Warum: Trainiert den seitlichen Gesäßmuskel. Ist er schwach, sinkt das Becken bei jedem Schritt ab und das Knie fällt nach innen – der häufigste Grund für Läuferknie.',
 'injury_prevention', 'beginner', 'knie-kraeftigen',
 'MyProSole', 'eigene Inhalte', null, null),

('einbeinige-bruecke', 'Einbeinige Brücke', 'Single Leg Glute Bridge',
 'Auf den Rücken, ein Fuß aufgestellt, das andere Bein gestreckt anheben. Hüfte hochdrücken, bis Körper und Oberschenkel eine Linie bilden. Langsam senken. Warum: Hintere Kette einbeinig – Gesäß und hintere Oberschenkel arbeiten zusammen, wie beim Abdruck.',
 'strength', 'beginner', 'knie-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Single_Leg_Glute_Bridge'),

('aufstieg-mit-knieanheben', 'Aufstieg mit Knieanheben', 'Step-up with Knee Raise',
 'Auf eine Stufe steigen, dabei das andere Knie nach oben führen. Kontrolliert wieder absteigen – das Absenken ist der wichtige Teil. Warum: Übt genau das, was beim Bergablaufen belastet: das kontrollierte Nachgeben.',
 'strength', 'beginner', 'knie-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Step-up_with_Knee_Raise'),

-- ---- 3. Bauch und Po kräftigen ---------------------------------------
('unterarmstuetz', 'Unterarmstütz', 'Plank',
 'Auf Unterarme und Fußspitzen, Körper eine gerade Linie. Bauch anspannen, Gesäß nicht hochstrecken und nicht durchhängen lassen. Warum: Hält den Rumpf gegen das Absacken – genau die Aufgabe beim Laufen.',
 'strength', 'beginner', 'bauch-po-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Plank'),

('seitstuetz', 'Seitstütz', 'Side Bridge',
 'Auf die Seite, Unterarm unter der Schulter, Hüfte anheben. Körper bildet eine Linie von Kopf bis Fuß. Warum: Die seitliche Rumpfmuskulatur verhindert das Wegkippen des Beckens.',
 'strength', 'beginner', 'bauch-po-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Side_Bridge'),

('toter-kaefer', 'Toter Käfer', 'Dead Bug',
 'Auf dem Rücken, Arme zur Decke, Knie über der Hüfte. Gegengleich einen Arm und das gegenüberliegende Bein absenken, ohne dass der untere Rücken vom Boden abhebt. Warum: Überkreuzte Bewegung bei stabilem Rumpf – das Muster des Laufens im Liegen, ohne Belastung.',
 'strength', 'beginner', 'bauch-po-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Dead_Bug'),

('beckenheben', 'Beckenheben', 'Butt Lift (Bridge)',
 'Auf den Rücken, beide Füße aufgestellt. Hüfte anheben, oben kurz das Gesäß fest anspannen, langsam senken. Warum: Der Gesäßmuskel ist der stärkste Antrieb beim Abdruck – und bei Vielsitzern der am wenigsten benutzte.',
 'strength', 'beginner', 'bauch-po-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Butt_Lift_Bridge'),

('beinheben-vierfuesslerstand', 'Beinheben im Vierfüßlerstand', 'Glute Kickback',
 'Auf Hände und Knie. Ein Bein mit angewinkeltem Knie nach hinten oben führen, als wolltest du die Fußsohle zur Decke drücken. Rücken bleibt ruhig. Warum: Isoliert den Gesäßmuskel, ohne dass der untere Rücken übernimmt.',
 'strength', 'beginner', 'bauch-po-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Glute_Kickback'),

('beckenheben-rueckwaerts', 'Beckenheben rückwärts', 'Reverse Crunch',
 'Auf dem Rücken, Knie angewinkelt. Das Becken vom Boden abrollen und die Knie zur Brust führen – mit dem Bauch, nicht mit Schwung. Warum: Trifft den unteren Bauch, den Sit-Ups weitgehend auslassen.',
 'strength', 'beginner', 'bauch-po-kraeftigen',
 'free-exercise-db', 'Unlicense (gemeinfrei)', 'https://github.com/yuhonas/free-exercise-db', 'Reverse_Crunch'),

-- ---- 4. Fuß-Übungen (alle selbst geschrieben) ------------------------
('kurzfuss', 'Kurzfuß', null,
 'Setz dich, Fuß flach am Boden. Zieh den Ballen Richtung Ferse, sodass sich das Längsgewölbe hebt – ohne die Zehen zu krallen und ohne Ferse oder Ballen abzuheben. Der Fuß wird kürzer, nicht kleiner. 5 Sekunden halten. Warum: Die Grundübung für die kleinen Muskeln im Fuß selbst. Sie tragen das Gewölbe; die Wadenmuskeln können das nicht ersetzen.',
 'strength', 'beginner', 'fuss-uebungen',
 'MyProSole', 'eigene Inhalte', null, null),

('zehen-spreizen', 'Zehen spreizen', null,
 'Fuß flach am Boden, alle Zehen auffächern, ohne sie anzuheben. Halten, lösen. Geht am Anfang oft kaum – das ist normal und der Grund, es zu üben. Warum: Enge Schuhe nehmen den Zehen jahrelang jeden Platz. Spreizfähigkeit ist die Voraussetzung für einen breiten, stabilen Abdruck.',
 'mobility', 'beginner', 'fuss-uebungen',
 'MyProSole', 'eigene Inhalte', null, null),

('grosszehe-einzeln-heben', 'Großzehe einzeln heben', null,
 'Alle Zehen am Boden lassen und nur die Großzehe anheben. Dann umgekehrt: nur die Großzehe unten lassen, die anderen vier heben. Warum: Die Großzehe leistet den letzten Teil des Abdrucks. Wer sie nicht getrennt ansteuern kann, drückt über die Außenkante ab.',
 'technique', 'beginner', 'fuss-uebungen',
 'MyProSole', 'eigene Inhalte', null, null),

('handtuch-heranziehen', 'Handtuch heranziehen', null,
 'Ein Handtuch flach vor dem sitzenden Fuß ausbreiten und nur mit den Zehen Stück für Stück zu dir heranziehen. Ferse bleibt am Boden. Warum: Kräftigt die Zehenbeuger unter Widerstand. Die einzige Übung hier, für die du etwas brauchst – ein Handtuch hat jeder.',
 'strength', 'beginner', 'fuss-uebungen',
 'MyProSole', 'eigene Inhalte', null, null),

('wadenheben-langsames-absenken', 'Wadenheben mit langsamem Absenken', null,
 'Auf beiden Beinen auf die Zehenspitzen, dann das Gewicht auf ein Bein verlagern und über 3 bis 4 Sekunden langsam absenken. Wechseln. Warum: Das langsame Absenken ist der Teil, der die Achillessehne belastbar macht – der am besten belegte Ansatz bei Achillesbeschwerden. Bei akuten Schmerzen erst ärztlich abklären.',
 'injury_prevention', 'beginner', 'fuss-uebungen',
 'MyProSole', 'eigene Inhalte', null, null),

('sprunggelenk-zur-wand', 'Sprunggelenk zur Wand', null,
 'Stell dich mit einem Fuß vor eine Wand, Ferse am Boden, und schieb das Knie Richtung Wand, ohne dass die Ferse abhebt. Rück den Fuß so weit zurück, wie es gerade noch geht. Warum: Ein steifes Sprunggelenk verlagert die Bewegung ins Knie und in die Hüfte. Der Abstand zur Wand ist zugleich ein Maß, das sich über die Zeit verfolgen lässt.',
 'mobility', 'beginner', 'fuss-uebungen',
 'MyProSole', 'eigene Inhalte', null, null)
)
insert into public.exercises
  (slug, name_de, name_en, description_de, category, difficulty, modality,
   group_id, source_name, source_license, source_url, external_id, is_active)
select
  n.slug, n.name_de, n.name_en, n.description_de,
  n.kategorie::public.exercise_category,
  n.schwierigkeit::public.exercise_difficulty,
  -- Ausnahmslos: Die ganze Grundausstattung geht ohne Geraet.
  'bodyweight'::public.exercise_modality,
  g.id, n.quelle, n.lizenz, n.quell_url, n.fremd_id, true
from neu n
join g on g.slug = n.gruppe
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 5. Welche Muskeln jede Uebung anspricht
-- ------------------------------------------------------------
-- Ohne diese Zuordnung zeigt die Uebungsseite unter dem Namen nichts an –
-- die Mikroroutine liest die primaeren Muskeln als Zielangabe.
insert into public.exercise_muscles (exercise_id, muscle_group_id, role)
select e.id, m.id, z.rolle::public.muscle_role
from (values
  -- Beweglichkeit
  ('hueftbeuger-dehnung-kniestand',      'hip_flexors', 'primary'),
  ('hueftbeuger-dehnung-kniestand',      'quads',       'secondary'),
  ('wadendehnung-gestrecktes-knie',      'calves',      'primary'),
  ('tiefe-wadendehnung-gebeugtes-knie',  'calves',      'primary'),
  ('laeuferdehnung-hintere-oberschenkel','hamstrings',  'primary'),
  ('gesaessdehnung-im-sitzen',           'glutes',      'primary'),
  ('grosse-laeuferdehnung',              'hip_flexors', 'primary'),
  ('grosse-laeuferdehnung',              'adductors',   'secondary'),
  ('grosse-laeuferdehnung',              'upper_back',  'secondary'),
  -- Knie
  ('kniebeuge-ohne-gewicht',             'quads',       'primary'),
  ('kniebeuge-ohne-gewicht',             'glutes',      'secondary'),
  ('ausfallschritt-im-gehen',            'quads',       'primary'),
  ('ausfallschritt-im-gehen',            'glutes',      'secondary'),
  ('wandsitz',                           'quads',       'primary'),
  ('seitliches-beinheben-seitlage',      'glutes',      'primary'),
  ('einbeinige-bruecke',                 'glutes',      'primary'),
  ('einbeinige-bruecke',                 'hamstrings',  'secondary'),
  ('aufstieg-mit-knieanheben',           'quads',       'primary'),
  ('aufstieg-mit-knieanheben',           'glutes',      'secondary'),
  -- Bauch und Po
  ('unterarmstuetz',                     'abs',         'primary'),
  ('seitstuetz',                         'obliques',    'primary'),
  ('toter-kaefer',                       'abs',         'primary'),
  ('beckenheben',                        'glutes',      'primary'),
  ('beckenheben',                        'hamstrings',  'secondary'),
  ('beinheben-vierfuesslerstand',        'glutes',      'primary'),
  ('beckenheben-rueckwaerts',            'abs',         'primary'),
  -- Fuß
  ('kurzfuss',                           'foot',        'primary'),
  ('zehen-spreizen',                     'foot',        'primary'),
  ('grosszehe-einzeln-heben',            'foot',        'primary'),
  ('handtuch-heranziehen',               'foot',        'primary'),
  ('wadenheben-langsames-absenken',      'calves',      'primary'),
  ('wadenheben-langsames-absenken',      'foot',        'secondary'),
  ('sprunggelenk-zur-wand',              'tibialis',    'primary'),
  ('sprunggelenk-zur-wand',              'calves',      'secondary')
) as z(uebung, muskel, rolle)
join public.exercises e on e.slug = z.uebung
join public.muscle_groups m on m.slug = z.muskel
on conflict (exercise_id, muscle_group_id) do nothing;
