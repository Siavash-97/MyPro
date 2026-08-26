-- ============================================================
-- 0056: zeigt_mir, sichtbar_fuer und der Schalter werden privat
-- ============================================================
-- Der Befund (B17, Agent `sicherheit`, 23.08.2026, beim Prueflauf ueber 0052)
-- --------------------------------------------------------------------------
-- 0023 gab community_profiles eine Leseregel fuer alle Angemeldeten:
--
--   create policy community_profiles_select ... for select
--     to authenticated using (true);
--
-- Das war fuer den Inhalt von damals richtig: Bio, Sportarten, "laeuft
-- seit" sind das, was ein Community-Profil zeigen SOLL. Die Tabelle ist
-- seither dreimal gewachsen (0048, 0049, 0052), die Regel nie angefasst
-- worden. 0048 und 0049 schreiben sogar ausdruecklich "keine neuen
-- Zeilenrechte noetig" - und genau darin liegt der Fehler: Eine Regel, die
-- `true` sagt, gilt fuer jede kuenftige Spalte, ohne dass jemand sie noch
-- einmal liest.
--
-- Geerbt haben das seit 0049/0052 drei Spalten, die keine Anzeige sind,
-- sondern EINSTELLUNGEN der Person:
--
--   zeigt_mir              "Wen will ich sehen?"
--   sichtbar_fuer          "Wem darf ich gezeigt werden?"
--   zusammenlauf_sichtbar  "Nehme ich ueberhaupt teil?"
--
-- Jeder angemeldete Account kann sie heute von JEDEM fremden Profil lesen -
-- auch von Leuten, die zusammenlauf_sichtbar auf false stehen haben, die
-- also gerade nicht teilnehmen wollen. In einem Wischstapel-Muster ist das
-- nicht harmlos: `zeigt_mir = {maennlich}` bei einer Person mit
-- `identitaet = maennlich` legt eine sexuelle Orientierung nahe. Das ist
-- Art. 9 DSGVO - eine besondere Kategorie, fuer die es hier weder eine
-- Einwilligung noch einen Zweck gibt. Den Leuten wurden die beiden Felder
-- in 0049 als FILTER erklaert, nicht als Angabe, die Fremde zu sehen
-- bekommen.
--
-- 0052 hat den Riss bereits benannt (Kopf, "Bewusst hingenommene
-- Restrisiken", woertlich: "Das ist ein GEERBTER Riss aus 0049, kein neuer
-- - aber 0052 macht ihn relevanter. Er braucht eine eigene Entscheidung
-- (Spaltenrechte oder eine View fuer den Feed)"). Diese Migration ist die
-- Entscheidung. Der Nutzer hat sie am 24.08.2026 getroffen: Spaltenrechte
-- plus eine Funktion fuer die eigenen Werte.
--
--
-- Warum Spaltenrechte und nicht die Leseregel
-- -------------------------------------------
-- Eine Zeilenregel kann nur ganze ZEILEN freigeben oder sperren, nicht
-- einzelne Spalten. Wollte man dasselbe ueber die Regel erreichen, muesste
-- man fremde Profile komplett unlesbar machen - dann faellt der
-- Community-Feed um, der zu Beitraegen Bio und Bild zeigt. Postgres hat
-- fuer genau diesen Fall Spaltenrechte, und die wirken VOR den
-- Zeilenregeln. Die Regel `using (true)` bleibt deshalb Wort fuer Wort
-- stehen; was sie freigibt, ist nur nicht mehr die ganze Zeile.
--
-- Der Preis dieser Wahl steht hier, damit ihn niemand spaeter fuer einen
-- Fehler haelt: **Ein `grant select (spalte)` ist NICHT zeilenweise.**
-- Es gibt kein "der Eigentuemer darf seine eigene sichtbar_fuer lesen" -
-- die Rolle `authenticated` ist eine einzige Rolle fuer alle Angemeldeten.
-- Entweder alle duerfen die Spalte lesen oder niemand. Deshalb sperrt ein
-- reines Revoke den Eigentuemer aus seiner eigenen Einstellungsseite aus,
-- und deshalb kommt zwingend eine Funktion dazu (unten, Teil 3).
--
--
-- Was diese Migration NICHT anfasst
-- ---------------------------------
-- - `identitaet` bleibt lesbar. Entscheidung des Nutzers: Die Angabe
--   gehoert zum freiwillig gezeigten Profil, und die Vorschlagsfunktion
--   aus 0052 gibt sie ohnehin heraus (dort Zeile 344).
-- - Alle Zeilenregeln aus 0023 bleiben unveraendert.
-- - Keine Spalte, kein Index, keine Tabelle entsteht oder faellt weg. Damit
--   keine Frage nach created_at/updated_at/Soft-Delete (die Tabelle hat
--   beides seit 0023), keine Normalform-Frage, keine Zeitreihen-Frage.
-- - `show_stats` bleibt lesbar. **Das ist eine bewusst offene Stelle, kein
--   Uebersehen:** 0052 zaehlt show_stats im Kommentar zu den Einstellungen,
--   "die Fremde nichts angehen" (dort Zeile 354/355). Der Auftrag zu dieser
--   Migration nennt ausdruecklich drei Spalten und sagt "der Rest bleibt
--   unveraendert" - also bleibt show_stats hier drin und wird nicht
--   heimlich mitgenommen. Wer das aendern will, braucht eine eigene
--   Entscheidung und eine eigene Migration; technisch ist es dann derselbe
--   Handgriff wie hier (Spalte aus der Liste unten streichen, Feld in
--   meine_profil_einstellungen aufnehmen).
--
--
-- Gegen die Supabase-Automatik (der Grund fuer den Revoke ganz vorn)
-- ------------------------------------------------------------------
-- Spaltenrechte sind ADDITIV zu Tabellenrechten. Ein einziges
-- tabellenweites `grant select on community_profiles to authenticated`
-- hebelt jede Spaltenliste dieser Datei vollstaendig aus - lautlos, ohne
-- Fehler, ohne Spur in irgendeiner Migration.
--
-- Genau so ein Grant steht hier mit hoher Wahrscheinlichkeit: 0037 hat ihn
-- selbst vergeben (die Schleife dort leitet die Rechte aus den Zeilenregeln
-- ab und vergibt fuer jede select-Regel ein tabellenweites select), und
-- Supabases "Automatically expose new tables" (aktiv bis 30.10.2026, siehe
-- supabase/config.toml und 0054) vergibt daneben moeglicherweise noch
-- einmal dasselbe.
--
-- Deshalb dieselbe Reihenfolge wie in 0052 und 0054: erst ALLES entziehen,
-- dann exakt das wieder vergeben, was gelten soll. Das ist zugleich die
-- Wiederholbarkeit - ein zweiter Lauf stellt denselben Zustand her, und ein
-- spaeteres versehentliches Auto-Grant wird durch einen dritten Lauf wieder
-- entfernt.
--
--
-- DER ABLAUF, in einem Absatz - alles Weitere ist Begruendung
-- --------------------------------------------------------------------------
--   1. DIESE Datei einspielen   -> nichts aendert sich fuer irgendwen
--   2. App ausliefern           -> findet die Funktionen schon vor
--   3. 0057 einspielen          -> B17 geschlossen, alte Fassung ist weg
--
-- Zu keinem Zeitpunkt ist etwas kaputt. Warum diese Reihenfolge und keine
-- andere: weiter unten unter "AUFGETEILT AM 25.08.2026".
--
--
-- WELCHE STELLEN DER RECHTEENTZUG BRICHT (das tut 0057, nicht diese Datei)
-- --------------------------------------------------------------------------
-- Bis zum 25.08.2026 stand hier die Ueberschrift "Diese Migration bricht die
-- App, wenn sie allein eingespielt wird". Fuer 0056 ist das FALSCH - genau
-- deshalb wurde aufgeteilt. Sie galt fuer den Rechteentzug, und der steht
-- jetzt in 0057. Angestrichen vom Agenten `pruefung` am 26.08.2026: Die
-- Richtigstellung stand 45 Zeilen tiefer, und wer eine 300-Zeilen-Datei nach
-- Ueberschriften ueberfliegt, liest zuerst die widerrufene Warnung.
--
-- Drei Stellen im Anwendungscode (Stand `main`) lesen die gesperrten
-- Spalten. Sie scheitern NACH 0057 mit 42501 (PostgREST: HTTP 403,
-- "permission denied for table community_profiles"):
--
--   myprosole_web/src/store/communityProfile.ts:101 (Stand `main`)
--     .select('*')  -> `*` verlangt Leserecht auf JEDE Spalte. Das ist die
--     schwerste Stelle: Es bricht nicht ein Feld, sondern das Laden JEDES
--     Profils, auch des fremden. Muss eine ausgeschriebene Spaltenliste
--     werden (die 14 Spalten aus Teil 2 unten).
--
--   myprosole_web/src/store/communityProfile.ts:140-142 (Stand `main`)
--     .upsert(...).select().single()  -> `.select()` ohne Argument ist
--     ebenfalls `select=*` und setzt `Prefer: return=representation`;
--     PostgREST liest mit RETURNING zurueck. Auch hier muss die Liste
--     ausgeschrieben werden. Das SCHREIBEN der drei Spalten bleibt erlaubt
--     (Teil 2 vergibt insert/update tabellenweit) - nur das Zuruecklesen
--     nicht.
--
--   myprosole_web/src/store/zusammenlauf.ts:151 (Stand `main`)
--     .select('zusammenlauf_sichtbar')  -> muss durch den Aufruf von
--     public.meine_profil_einstellungen() ersetzt werden.
--
-- FALSCH, richtiggestellt am 24.08.2026 - der folgende Absatz stand hier
-- als Zusicherung und ist GEMESSEN widerlegt (siehe Teil 3b): Ein upsert auf
-- diese Spalten scheitert mit 42501, weil `on conflict do update` das
-- SELECT-Recht auf die ZIELSPALTE der Zuweisung verlangt. Die Begruendung
-- unten betrachtet nur die EXCLUDED-Seite; dort stimmt sie.
--
-- Der Schreibweg laeuft deshalb ueber
-- public.meine_profil_einstellungen_setzen(). Der Absatz bleibt stehen,
-- damit sichtbar bleibt, welche Annahme hier falsch war:
--
-- Nicht betroffen: zusammenlauf.ts:189 `.upsert({ user_id,
-- zusammenlauf_sichtbar })`. Ohne angehaengtes `.select()` schickt
-- supabase-js kein `return=representation` (nachgesehen in
-- postgrest-js/dist/index.cjs: der Prefer-Header wird erst in select()
-- gesetzt), PostgREST erzeugt also kein RETURNING. Und `excluded.spalte` im
-- ON CONFLICT DO UPDATE braucht kein Leserecht - Postgres setzt fuer die
-- EXCLUDED-Pseudorelation ausdruecklich keine Rechteanforderung.
--
-- Reihenfolge beim Ausliefern: **erst die App-Aenderung, dann der
-- Rechteentzug.** Andersherum steht die Profilseite fuer alle still.
--
-- ACHTUNG, seit der Aufteilung am 25.08.2026: Der Rechteentzug steht in
-- **0057**, nicht mehr hier. Fuer DIESE Datei gilt das Gegenteil - sie
-- gehoert ZUERST eingespielt, vor der App, weil die neue App ihre
-- Funktionen braucht. Der ganze Ablauf steht unten unter "AUFGETEILT AM
-- 25.08.2026".
--
--
-- Die versteckte dritte Bruchstelle: eine Zeilenregel auf einer ANDEREN
-- Tabelle (Teil 4)
-- --------------------------------------------------------------------------
-- 0052 prueft beim Anlegen einer Kontaktanfrage im with-check:
--
--   exists (select 1 from public.community_profiles cp
--           where cp.user_id = an_id and cp.zusammenlauf_sichtbar
--             and (cp.sichtbar_fuer = '{}' or ...))
--
-- Diese Unterabfrage laeuft mit den Rechten dessen, der die Anfrage stellt,
-- nicht mit denen des Regelverfassers. Nimmt man `authenticated` das
-- Leserecht auf zusammenlauf_sichtbar und sichtbar_fuer, scheitert die
-- Regel selbst - und damit jedes Anfragen. Das ist der Fehlertyp vom
-- 17.08.2026 in neuer Gestalt: eine spaetere Aenderung, die eine fruehere
-- Festlegung nicht kennt. Teil 4 verlegt die Pruefung deshalb in eine
-- security-definer-Funktion, wortgleich zur bisherigen Bedingung.
--
-- Damit aendert diese Migration eine Regel auf community_kontakt_anfragen,
-- obwohl der Auftrag "nur community_profiles" lautete. Das ist keine
-- Ausweitung, sondern die Bedingung dafuer, dass die Sperre ueberhaupt
-- einspielbar ist - benannt statt stillschweigend getan.
--
--
-- Neues Restrisiko, das dabei ENTSTEHT
-- ------------------------------------
-- 0052 begruendete die Sichtbarkeitspruefung in der Insert-Regel damit,
-- dass ein Fehlschlag nichts Geheimes verrate: "sichtbar_fuer ist ueber die
-- using-(true)-Leseregel ohnehin oeffentlich" (dort Punkt 5). Dieses
-- Argument faellt mit dieser Migration weg. Was bleibt:
--
--   Wer die Schnittstelle von Hand bedient, erfaehrt aus einem
--   fehlgeschlagenen Insert ein BIT ueber eine namentlich benannte Person:
--   "die will dir gerade nicht vorgeschlagen werden". Wer zusaetzlich die
--   eigene `identitaet` durchprobiert (fuenf Werte), kann daraus die Menge
--   `sichtbar_fuer` dieser einen Person weitgehend rekonstruieren.
--
-- Abgewogen und hingenommen, weil das Bit deutlich weniger ist als die
-- heutige Lage (jeder liest die Mengen roh, von allen, ohne Aufwand), und
-- weil die Alternative - die Pruefung ganz aus der Insert-Regel nehmen -
-- das Opt-in aus 0052 aufheben wuerde. Der saubere Ausweg ist eine eigene
-- Funktion `kontakt_anfrage_stellen(ziel)`, die bei fehlender Sichtbarkeit
-- schweigend nichts tut statt zu scheitern; sie aendert den Schreibweg der
-- App und gehoert deshalb in eine eigene Aufgabe. **Hier als Nachfolgepunkt
-- notiert, nicht als erledigt behauptet.**
--
--
-- Nachweis (nach dem Einspielen im SQL-Editor)
-- ------------------------------------------
--   -- Die vier Funktionen muessen da sein und ausfuehrbar. Erwartet:
--   -- vier Zeilen, drei in `public`, `darf_ich_anfragen` in `intern`.
--   select n.nspname as schema, p.proname as funktion, p.prosecdef as definer
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.proname in ('meine_profil_einstellungen',
--                       'meine_profil_einstellungen_setzen',
--                       'meine_sichtbarkeit_setzen',
--                       'darf_ich_anfragen')
--   order by 1, 2;
--
--   -- Die eigene Seite liest ihre Einstellungen (als angemeldeter Nutzer
--   -- ueber die App oder mit gesetztem request.jwt.claims). Leere Menge
--   -- ist in Ordnung - sie heisst "noch kein Community-Profil".
--   select * from public.meine_profil_einstellungen();
--
--   -- Und die Anfragen-Regel zeigt auf die Funktion in `intern`:
--   select policyname, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and policyname = 'kontakt_anfragen_anlegen';
--
-- WAS HIER NICHT MEHR STEHT, und warum
-- ------------------------------------
-- Bis zum 25.08.2026 standen hier drei Pruefungen auf Tabellen- und
-- Spaltenrechte ("kein SELECT mehr", "genau 14 Spalten", "zeigt_mir gibt
-- 42501"). Nach der Aufteilung setzt DIESE Datei kein einziges Tabellenrecht
-- - sie lieferten also nach Schritt 1 dreimal das Gegenteil des Sollwerts,
-- und wer sie faehrt, schliesst daraus, die Migration sei fehlgeschlagen.
--
-- Sie stehen jetzt in 0057, wo sie hingehoeren. Gefunden vom Agenten
-- `pruefung` am 25.08.2026.
--
--

-- Rueckwaerts
-- -----------
-- ZUERST LESEN, DANN KOPIEREN. Zwei Dinge gehoeren NICHT in diesen Block:
--
-- (a) Das tabellenweite Leserecht auf community_profiles wieder zu vergeben.
--     Dieser Befehl stand bis zum 25.08.2026 hier und ist eine Falle: Er
--     nimmt **0057** zurueck, nicht diese Datei. Wer ihn mitkopiert, stellt
--     das tabellenweite Lesen wieder her und oeffnet B17 lautlos - genau die
--     Bauart, gegen die 0057 argumentiert. Der Befehl steht deshalb hier
--     NICHT ausgeschrieben; er steht in 0057, wo er hingehoert.
--     (Die Warnung steht bewusst VOR den gueltigen Befehlen und nicht
--     dahinter: Wer einen Block markiert, nimmt das Ende mit, nicht den
--     Anfang. Angestrichen vom Agenten `pruefung` am 26.08.2026.)
--
-- (b) Die Reihenfolge ist nicht beliebig - siehe die zwei ACHTUNG-Absaetze
--     unter diesem Block.
--
--   drop function if exists public.meine_profil_einstellungen();
--   drop function if exists public.meine_profil_einstellungen_setzen(text[], text[]);
--   drop function if exists public.meine_sichtbarkeit_setzen(boolean);
--   -- und die Insert-Regel aus 0052 (dort Zeile 261-281) woertlich wieder
--   -- herstellen, erst danach: drop function intern.darf_ich_anfragen(uuid);
--
-- ACHTUNG 1, Reihenfolge: Solange 0057 gilt, braucht die App diese
-- Funktionen. Wer sie loescht, ohne vorher 0057 zurueckzunehmen, laesst die
-- Einstellungsseite und den ZusammenLauf-Schalter ins Leere laufen.
--
-- ACHTUNG 2, und das steht hier, weil die Anleitung es selbst ausloest:
-- Schritt vier stellt die Insert-Regel aus 0052 WOERTLICH wieder her, und
-- die liest `zusammenlauf_sichtbar` und `sichtbar_fuer` direkt in ihrer
-- with-check-Unterabfrage - mit den Rechten des Anfragenden. Solange 0057
-- gilt, scheitert damit JEDE Kontaktanfrage mit 42501, fuer alle, nicht nur
-- fuer den, der zurueckrollt. Also auch hier: erst 0057 zurueck, dann diese
-- Datei. Angestrichen vom Agenten `pruefung` am 26.08.2026.
--
-- Es gehen keine Daten verloren; diese Datei aendert Funktionen und eine
-- Zeilenregel, keine Tabellenrechte.

--
-- AUFGETEILT AM 25.08.2026 - und warum das keine Kosmetik ist
-- --------------------------------------------------------------------------
-- Diese Datei enthielt urspruenglich BEIDE Haelften: den Rechteentzug und
-- die Funktionen. In dieser Form ist sie nicht ausliefbar, ohne dass etwas
-- kaputtgeht - egal in welcher Reihenfolge:
--
--   Migration zuerst  -> Die ausgelieferte App liest `.select('*')`
--                        (communityProfile.ts:101 und :140-142 - NICHT :103, das ist
--                        community_profile_photos und behaelt seine Rechte). `*` verlangt
--                        Leserecht auf JEDE Spalte. Die ganze
--                        Community-Profilseite stirbt fuer alle, sofort.
--
--   App zuerst        -> Die neue App ruft meine_profil_einstellungen(),
--                        die es noch nicht gibt. Einstellungen und
--                        ZusammenLauf-Schalter sind voruebergehend tot.
--
-- Beides vermeidbar. Die Funktionen sind rein ADDITIV - sie stoeren keine
-- laufende Fassung. Der Rechteentzug ist der einzige Bruch. Also:
--
--   1. DIESE Datei einspielen        -> nichts aendert sich fuer irgendwen
--   2. App ausliefern                -> findet die Funktionen schon vor
--   3. 0057 einspielen               -> B17 geschlossen, alte Fassung ist weg
--
-- **Zu keinem Zeitpunkt ist etwas kaputt.** Der Rechteentzug steht in
-- `0057_profil_spalten_werden_gesperrt.sql`; ohne ihn ist B17 NICHT
-- behoben.
--
-- Genauer, weil "aendert kein einziges Recht" hier zu grob waere: Diese
-- Datei aendert keine TABELLENRECHTE auf community_profiles. Sie setzt sehr
-- wohl Rechte auf FUNKTIONEN (vier `revoke all on function`, vier
-- `grant execute`) und tauscht die Zeilenregel `kontakt_anfragen_anlegen`
-- aus - wirkungsgleich zur Fassung aus 0052, aber kein Nichts.
-- Angestrichen vom Agenten `pruefung` am 25.08.2026.
--
-- Der Absatz "Reihenfolge beim Ausliefern" oben ist deshalb am 25.08.2026
-- umformuliert worden ("dann der Rechteentzug" statt "dann diese
-- Migration"); er gilt nicht mehr fuer diese Datei - er gilt
-- fuer 0057. Er bleibt stehen, weil er die Gefahr richtig beschreibt.

-- ============================================================


-- ------------------------------------------------------------
-- 3. Die eigenen Einstellungen lesen
-- ------------------------------------------------------------
-- Ohne diese Funktion waere die Sperre oben ein Eigentor: Die
-- Einstellungsseite koennte die Haekchen nicht mehr vorbelegt anzeigen -
-- sie ginge jedes Mal leer auf, und wer nur "speichern" tippt,
-- ueberschriebe seine eigenen Angaben mit nichts.
--
-- Warum eine Funktion und kein feineres Recht: Spaltenrechte gelten fuer
-- die ROLLE, nicht fuer die Zeile (Begruendung im Kopf). "Nur die eigene
-- Zeile" laesst sich in Postgres allein ueber Zeilenregeln sagen - und die
-- greifen erst, wenn das Spaltenrecht schon da waere. Also derselbe Weg wie
-- bei community_stats (0023/0025), ist_blockiert (0047) und
-- zusammenlauf_vorschlaege (0052): erhoehte Rechte, feste Rueckgabe.
--
-- **Kein Parameter.** Das ist die eigentliche Sicherheitsentscheidung
-- dieser Funktion. Ein `ziel uuid` waere bequem und genau die Tuer, die
-- gerade zugemacht wird: Ein spaeterer Aufrufer haette irgendwann eine
-- fremde Kennung hineingereicht, und die Funktion mit ihren erhoehten
-- Rechten haette geantwortet. Ohne Parameter gibt es diese Moeglichkeit
-- nicht, in keiner kuenftigen Fassung.
--
-- Feste Spaltenliste statt `setof community_profiles` - aus demselben
-- Grund wie in 0052 Punkt 1: Was hier nicht steht, verlaesst die Funktion
-- nicht, auch keine kuenftige Spalte.
--
-- Keine eigene Zeile heisst LEERE MENGE, nicht (null, null, null): Wer nie
-- ein Community-Profil angelegt hat, hat die Voreinstellungen der Datenbank
-- ('{}', '{}', false). Die App muss das genauso behandeln - so wie
-- zusammenlauf.ts es fuer den Schalter heute schon tut ("Kein Profil
-- heisst: Schalter aus"). Anders als bei community_stats (0025) haelt die
-- leere Menge hier nichts zurueck, sie sagt nur "es gibt noch nichts".
--
-- set search_path = '' und ausgeschriebene Namen: sonst koennte jemand mit
-- einer eigenen Tabelle im Suchpfad steuern, welche Tabelle die Funktion
-- mit ihren erhoehten Rechten tatsaechlich liest.
create or replace function public.meine_profil_einstellungen()
returns table (
  zeigt_mir             text[],
  sichtbar_fuer         text[],
  zusammenlauf_sichtbar boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.zeigt_mir, cp.sichtbar_fuer, cp.zusammenlauf_sichtbar
  from public.community_profiles cp
  where cp.user_id = (select auth.uid());
$$;

-- Standardmaessig darf PUBLIC jede neue Funktion ausfuehren; zusaetzlich
-- kann die Supabase-Automatik sie an anon/authenticated vergeben. Also
-- beides entziehen und nur das eine Recht setzen, das gemeint ist.
revoke all on function public.meine_profil_einstellungen() from public, anon;
grant execute on function public.meine_profil_einstellungen() to authenticated;

comment on function public.meine_profil_einstellungen() is
  'Die drei Einstellungen des ANGEMELDETEN Kontos - zeigt_mir, '
  'sichtbar_fuer, zusammenlauf_sichtbar. Absichtlich ohne Parameter: Es '
  'gibt keinen Weg, sie fuer eine fremde Kennung zu erfragen. Leere Menge, '
  'wenn noch kein Community-Profil existiert; dann gelten die '
  'Voreinstellungen ({}, {}, false). Ersatz fuer das Lesen dieser Spalten, '
  'das 0057 der Rolle authenticated entzogen hat.';


-- ------------------------------------------------------------
-- 3b. Die eigenen Einstellungen SCHREIBEN
-- ------------------------------------------------------------
-- Nachgetragen am 24.08.2026, nachdem der Agent `oberflaeche` GEMESSEN hat,
-- was zwei Agenten aus dem Quelltext falsch abgeleitet hatten - und was im
-- Kopf dieser Datei bis eben falsch stand.
--
-- Der Kopf behauptete: "Nicht betroffen: zusammenlauf.ts:189 .upsert(...).
-- Ohne angehaengtes .select() kein RETURNING, und excluded.spalte braucht
-- kein Leserecht."
--
-- Der zweite Halbsatz stimmt und ist die Falle. Postgres verlangt fuer
--
--   insert ... on conflict do update set spalte = excluded.spalte
--
-- das SELECT-Recht auf die ZIELSPALTE der Zuweisung. Die EXCLUDED-Seite ist
-- rechtefrei, die linke Seite nicht. Gemessen gegen PostgREST mit echtem
-- Token:
--
--   upsert mit zusammenlauf_sichtbar  ->  403 / 42501
--   upsert mit bio                    ->  200
--
-- Ohne diese Funktion braeche also der ZusammenLauf-Schalter - und mit ihm
-- der Einwilligungs-Nachweis aus 0053, der davor geschrieben wird.
--
-- Warum eine Funktion und nicht "erst insert, dann update": Der Zwei-Schritt
-- kann halb gelingen. Bei einer Datenschutzeinstellung ist "halb" der
-- schlechteste Ausgang - die Person glaubt, eingeschraenkt zu haben.
--
-- Warum kein Parameter fuer die Zielperson: dieselbe Ueberlegung wie bei
-- meine_profil_einstellungen(). Die Kennung kommt aus auth.uid() und
-- nirgendwo sonst. Damit kann diese Funktion in keiner kuenftigen Fassung
-- eine fremde Zeile schreiben - auch nicht versehentlich.
--
-- ZUR SICHERHEIT AUSDRUECKLICH: `security definer` laeuft als Eigentuemer,
-- und ein Tabelleneigentuemer umgeht die Zeilenregeln. Diese Funktion
-- schreibt deshalb ausschliesslich in die Zeile mit `user_id = auth.uid()`,
-- fest verdrahtet. Die Zeilenregel aus 0023 waere hier wirkungslos - die
-- Sicherheit steckt in der Konstruktion, nicht in der Regel.
-- ZWEI Funktionen, nicht eine - der zweite Fund derselben Runde. Eine
-- gemeinsame Setzfunktion haette verlangt, dass JEDER Schreiber alle drei
-- Werte mitschickt. Der ZusammenLauf-Schalter aendert aber nur einen; er
-- muesste die anderen zwei durchreichen, die er beim Oeffnen gelesen hat.
-- Wer den Schalter auf einem zweiten Geraet umlegt, waehrend die
-- Profilseite offen steht, verloere seine Praeferenzen stillschweigend.
--
-- Genau die Klasse Fehler, gegen die diese Migration gebaut ist. Deshalb
-- kann keine Funktion etwas schreiben, was ihr Aufrufer nicht gemeint hat.
create or replace function public.meine_profil_einstellungen_setzen(
  p_zeigt_mir     text[],
  p_sichtbar_fuer text[]
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.community_profiles (user_id, zeigt_mir, sichtbar_fuer)
  values ((select auth.uid()), p_zeigt_mir, p_sichtbar_fuer)
  on conflict (user_id) do update
    set zeigt_mir     = excluded.zeigt_mir,
        sichtbar_fuer = excluded.sichtbar_fuer,
        updated_at    = now();
$$;

revoke all on function public.meine_profil_einstellungen_setzen(text[], text[])
  from public, anon;
grant execute on function public.meine_profil_einstellungen_setzen(text[], text[])
  to authenticated;

comment on function public.meine_profil_einstellungen_setzen(text[], text[]) is
  'Schreibt zeigt_mir und sichtbar_fuer des ANGEMELDETEN Kontos - NICHT den '
  'Schalter, dafuer gibt es meine_sichtbarkeit_setzen().';

-- Der Schalter allein. Er haengt an einer Einwilligungszeile (0053) und
-- wird von einer anderen Seite bedient als die zwei Praeferenzen.
create or replace function public.meine_sichtbarkeit_setzen(p_sichtbar boolean)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.community_profiles (user_id, zusammenlauf_sichtbar)
  values ((select auth.uid()), p_sichtbar)
  on conflict (user_id) do update
    set zusammenlauf_sichtbar = excluded.zusammenlauf_sichtbar,
        updated_at            = now();
$$;

revoke all on function public.meine_sichtbarkeit_setzen(boolean) from public, anon;
grant execute on function public.meine_sichtbarkeit_setzen(boolean) to authenticated;

comment on function public.meine_sichtbarkeit_setzen(boolean) is
  'Legt den ZusammenLauf-Schalter des ANGEMELDETEN Kontos um - und NICHTS '
  'sonst. Getrennt, damit kein Schreiber Werte mitschickt, die er nicht '
  'gemeint hat.';


-- ------------------------------------------------------------
-- 4. Die Insert-Regel aus 0052 kommt ohne die gesperrten Spalten aus
-- ------------------------------------------------------------
-- Warum das hier stehen MUSS und nicht warten kann: siehe Kopf. Die
-- Bedingung ist wortgleich uebernommen, sie steht nur nicht mehr direkt in
-- der Regel, sondern in einer Funktion mit erhoehten Rechten. Damit liest
-- die Pruefung die Spalten, der Anfragende aber nicht.
--
-- Das `coalesce` links vom `= any` ist TRAGEND und wird deshalb aus 0052
-- mitsamt seiner Begruendung uebernommen: Eine nackte Unterabfrage in den
-- Klammern von `= any (...)` gilt als Zeilenmenge und ergab dort beim
-- ersten Einspielen 42883. Hier steht rechts mit `cp.sichtbar_fuer` ein
-- echter Array-Ausdruck - die unproblematische Form; das coalesce sitzt
-- links und zaehlt eine fehlende eigene Identitaet als 'keine_angabe'.
create or replace function intern.darf_ich_anfragen(ziel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_profiles cp
    where cp.user_id = ziel
      -- Der Opt-in-Schalter aus 0052.
      and cp.zusammenlauf_sichtbar
      -- Und "wem darf ich gezeigt werden" muss zu meiner Identitaet passen.
      -- Leer heisst alle (0049).
      and (
        cp.sichtbar_fuer = '{}'
        or coalesce(
             (select me.identitaet from public.community_profiles me
               where me.user_id = (select auth.uid())),
             'keine_angabe'
           ) = any (cp.sichtbar_fuer)
      )
  );
$$;

revoke all on function intern.darf_ich_anfragen(uuid) from public, anon;
-- Ausfuehrungsrecht ist noetig, auch wenn die Funktion "nur" in einer
-- Zeilenregel steht: Postgres prueft das Recht beim Ausfuehren gegen den
-- aufrufenden Nutzer, nicht gegen den Verfasser der Regel. Dasselbe gilt
-- fuer ist_blockiert seit 0047.
grant execute on function intern.darf_ich_anfragen(uuid) to authenticated, service_role;

comment on function intern.darf_ich_anfragen(uuid) is
  'Darf das angemeldete Konto der Person ziel eine Kontaktanfrage schicken? '
  'Prueft zusammenlauf_sichtbar und sichtbar_fuer - Spalten, die seit 0057 '
  'niemand mehr direkt lesen darf. Wortgleich zu der Bedingung, die bis '
  '0056 in der Regel kontakt_anfragen_anlegen stand.';

-- Die Regel selbst: unveraendert in ihrer Wirkung, nur die dritte Bedingung
-- ist jetzt ein Funktionsaufruf. von_id und stand bleiben, wie 0052 sie
-- geschrieben hat. ist_blockiert steht hier weiterhin ABSICHTLICH nicht -
-- die Begruendung (kein Orakel "du wurdest blockiert") gilt unveraendert,
-- siehe 0052 Punkt 2.
drop policy if exists kontakt_anfragen_anlegen on public.community_kontakt_anfragen;
create policy kontakt_anfragen_anlegen
  on public.community_kontakt_anfragen for insert
  to authenticated
  with check (
    von_id = (select auth.uid())
    and stand = 'offen'
    and intern.darf_ich_anfragen(an_id)
  );
