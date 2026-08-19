-- ============================================================
-- 0043: Zwei Uebungen fuer den Mittelfussaufsatz
-- ============================================================
-- Warum
-- -----
-- In der Gruppe Lauftechnik fehlte die Uebung, die den Fussaufsatz selbst
-- schult: flach aufsetzen statt ueber die Ferse. Fuer eine Einlagenfirma
-- ist das die naheliegendste Technikfrage ueberhaupt.
--
-- Zwei statt einer, weil beides zusammengehoert: Erst das Gefuehl (auf der
-- Stelle laufen laesst keinen Fersenaufsatz zu), dann die Uebertragung nach
-- vorn (kurze, schnelle Schritte verlegen den Aufsatz von selbst).
--
-- Was die Recherche ergeben hat – und was im Text stehen muss
-- ----------------------------------------------------------
-- Der Mittelfussaufsatz ist keine Verbesserung, sondern ein Tausch:
--
--   Rund 95 Prozent aller Laeufer setzen mit der Ferse auf. Das ist die
--   Regel, nicht der Fehler.
--
--   Der Aufsatz weiter vorn nimmt Last vom Knie – und legt sie auf
--   Achillessehne und Wade. In einer Studie ueber zwoelf Wochen Umstellung
--   stieg die Spitzenkraft an der Achillessehne um 20,3 Prozent.
--
--   Es gibt einen dokumentierten Fall, in dem jemand zum FERSENAUFSATZ
--   umgestellt wurde, um wiederkehrende Wadenrisse zu beenden.
--
--   Eine Umstellung braucht acht bis zwoelf Wochen, und der Laufumfang
--   soll dabei um 30 bis 50 Prozent gesenkt werden.
--
-- Deshalb tragen beide Uebungen den Hinweis im Beschreibungstext. Eine App,
-- die Menschen mit Achillesbeschwerden Uebungen zeigt, darf die Umstellung
-- nicht als Verbesserung anpreisen. Sie ist ein Werkzeug mit einem Preis,
-- und der gehoert dazugesagt.
--
-- Quellen: Laufcampus und Running School of Hannover fuer die Durchfuehrung;
-- fuer die Belastungsverschiebung die systematischen Uebersichtsarbeiten zu
-- Fussaufsatzmustern (u. a. Journal of Orthopaedic & Sports Physical Therapy
-- und die Transitionsstudie ueber zwoelf Wochen mit Minimalschuhen).
-- Beide Texte sind selbst geschrieben, nicht uebernommen.
--
-- Damit hat die Gruppe Lauftechnik acht Uebungen statt sechs. Wenn das zu
-- viel ist, faellt eher die Armarbeit weg als eine von diesen beiden.
-- ============================================================

with g as (
  select id from public.exercise_groups where slug = 'lauftechnik'
),
neu (slug, name_de, description_de, kategorie, schwierigkeit, saetze,
     wiederholungen, dauer_von, dauer_bis) as (values

('laufen-auf-der-stelle', 'Laufen auf der Stelle',
 'Lauf auf der Stelle, ohne dich fortzubewegen, und lass die Füße locker unter dir auf und ab gehen. Achte darauf, wie du landest: Auf der Stelle geht ein Fersenaufsatz gar nicht – der Fuß setzt von selbst flach auf, Ballen und Ferse fast gleichzeitig. Merk dir dieses Gefühl. 30 bis 60 Sekunden, dann zwei bis drei Schritte vorwärts, ohne es zu verlieren. Warum: Der schnellste Weg, den Mittelfußaufsatz zu spüren statt ihn zu erklären. Wichtig: Rund 95 Prozent aller Läufer setzen mit der Ferse auf, und das ist keine Fehlfunktion. Ein Aufsatz weiter vorn nimmt Last vom Knie und legt sie auf Achillessehne und Wade – bei einer Umstellung steigt die Belastung der Achillessehne deutlich. Übe das Gefühl, aber stell deinen Laufstil nicht über Nacht um.',
 'technique', 'beginner', 3, null, 30, 60),

('kurze-schnelle-schritte', 'Kurze schnelle Schritte',
 'Lauf ein Stück bewusst mit kürzeren Schritten und dafür schnellerer Schrittfolge – etwa so, als müsstest du mehr Schritte auf dieselbe Strecke bringen. Das Tempo bleibt gleich, nur die Schritte werden kleiner. Achte darauf, dass der Fuß dabei näher unter dem Körper landet. 15 bis 20 Meter, dann locker auslaufen. Warum: Der Fußaufsatz lässt sich schwer direkt steuern, die Schrittlänge dagegen leicht. Kürzere Schritte verlegen den Aufsatz von allein nach hinten unter den Körper und nehmen das Bremsen aus dem Schritt. Wichtig: Wenn du dabei auf Mittelfuß umstellst, senke den Laufumfang für die ersten Wochen um ein Drittel bis die Hälfte, und nimm Wadenverhärtungen ernst.',
 'technique', 'beginner', 3, null, null, null)
)
insert into public.exercises
  (slug, name_de, name_en, description_de, category, difficulty, modality,
   group_id, saetze, wiederholungen, dauer_sekunden_von, dauer_sekunden_bis,
   source_name, source_license, source_url, external_id, is_active)
select
  n.slug, n.name_de, null, n.description_de,
  n.kategorie::public.exercise_category,
  n.schwierigkeit::public.exercise_difficulty,
  'bodyweight'::public.exercise_modality,
  -- Ausdruecklich gecastet: Steht in einer values-Liste in ALLEN Zeilen
  -- null, tippt PostgreSQL die Spalte als text – und text passt nicht in
  -- smallint. Genau daran ist der erste Lauf dieser Migration gescheitert.
  g.id, n.saetze::smallint, n.wiederholungen::smallint,
  n.dauer_von::smallint, n.dauer_bis::smallint,
  'MyProSole', 'eigene Inhalte', null, null, true
from neu n cross join g
on conflict (slug) do nothing;

insert into public.exercise_muscles (exercise_id, muscle_group_id, role)
select e.id, m.id, z.rolle::public.muscle_role
from (values
  ('laufen-auf-der-stelle',   'calves',   'primary'),
  ('laufen-auf-der-stelle',   'foot',     'secondary'),
  ('kurze-schnelle-schritte', 'calves',   'primary'),
  ('kurze-schnelle-schritte', 'glutes',   'secondary')
) as z(uebung, muskel, rolle)
join public.exercises e on e.slug = z.uebung
join public.muscle_groups m on m.slug = z.muskel
on conflict (exercise_id, muscle_group_id) do nothing;

-- Der Einleitungstext der Gruppe nannte sechs Uebungen ueber 15 bis 20
-- Meter. Beides stimmt so nicht mehr: Es sind acht, und "Laufen auf der
-- Stelle" hat keine Strecke.
update public.exercise_groups
   set lead_de = 'Lauf-ABC: kurze Übungen, die den Bewegungsablauf schulen. Vor dem Lauf, zwei bis drei Durchgänge – die laufenden Übungen über 15 bis 20 Meter.'
 where slug = 'lauftechnik';
