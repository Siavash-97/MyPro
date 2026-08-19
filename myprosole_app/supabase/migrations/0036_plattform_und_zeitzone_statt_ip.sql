-- ============================================================
-- 0036: Plattform und Zeitzone – die Statistik ohne IP-Adresse
-- ============================================================
-- Wofuer
-- ------
-- Zwei Fragen sollen beantwortbar sein: Aus welchen Laendern kommen die
-- Nutzer, und wie viele davon nutzen Android, iPhone oder den Browser.
--
-- Warum nicht ueber die IP-Adresse
-- --------------------------------
-- Naheliegend waere gewesen, die IP-Adresse mitzuschreiben und daraus das
-- Land abzuleiten. Drei Gruende dagegen:
--
-- 1. Eine IP-Adresse ist ein personenbezogenes Datum (EuGH C-582/14
--    "Breyer", BGH VI ZR 135/13, ausdruecklich auch fuer wechselnde
--    Adressen). Sie zu speichern braucht einen eigenen Zweck, eine Frist
--    und einen Eintrag in der Datenschutzerklaerung.
--
-- 2. Fuer die zweite Frage taugt sie ohnehin nicht: In einer IP-Adresse
--    steht kein Betriebssystem.
--
-- 3. Der Zweck "Nachweis der Einwilligung" und der Zweck "Statistik" sind
--    verschieden. Eine fuer den Nachweis gespeicherte Adresse spaeter fuer
--    Auswertungen zu nutzen, verstiesse gegen die Zweckbindung
--    (Art. 5 Abs. 1 lit. b DSGVO).
--
-- Was stattdessen
-- ---------------
-- Zwei Angaben, die das Geraet von sich aus kennt und die niemanden
-- identifizieren:
--
--   plattform  'android' | 'ios' | 'web'  – exakt, kommt von Capacitor
--   zeitzone   'Europe/Berlin'            – ein Hinweis, keine Tatsache
--
-- Die Zeitzone ist bewusst nur ein Naeherungswert fuer das Land. Wer sie
-- umstellt, erscheint anderswo; wer reist, auch. Fuer die Frage "grob
-- woher" reicht das, und es kostet kein personenbezogenes Datum.
--
-- Beide Felder werden NUR gefuellt, wenn die Erlaubnis 'analyse' gilt, und
-- beim Widerruf wieder geleert. Das erzwingt die Datenbank nicht – sie
-- kennt den Zusammenhang nicht –, sondern die App (store/einwilligung.ts).
-- Deshalb steht es hier als Kommentar an der Spalte, damit die Regel bei
-- der Tabelle steht und nicht nur im Quelltext.
--
-- Warum auf profiles und nicht in einem eigenen Schema
-- ----------------------------------------------------
-- Zwei Spalten rechtfertigen keine eigene Tabelle. Sie gehoeren zur
-- Person, stehen also dort, wo die Person steht. Zieht profiles spaeter in
-- das Schema `konto`, ziehen sie mit.
--
-- Erweitern, nicht wegnehmen: Beide Spalten sind nullbar und ohne
-- Vorgabewert. Eine aeltere App-Fassung auf einem Telefon kennt sie nicht,
-- schreibt sie nicht und laeuft unveraendert weiter.
-- ============================================================

alter table public.profiles
  add column if not exists plattform text;

alter table public.profiles
  add column if not exists zeitzone text;

-- Nur die drei Werte, die es gibt. Ohne Pruefung landet dort frueher oder
-- spaeter 'Android', 'ANDROID' und 'android' nebeneinander, und jede
-- Auswertung muesste raten, was gemeint ist.
do $$
begin
  alter table public.profiles
    add constraint profiles_plattform_gueltig
    check (plattform is null or plattform in ('android', 'ios', 'web'));
exception when duplicate_object then null;
end $$;

-- Zeitzonennamen der IANA-Datenbank: 'Europe/Berlin', 'America/New_York'.
-- Geprueft wird nur die Form, nicht die Existenz – die Liste aendert sich
-- mehrmals im Jahr, und eine Pruefung dagegen waere staendig veraltet.
do $$
begin
  alter table public.profiles
    add constraint profiles_zeitzone_form
    check (zeitzone is null or zeitzone ~ '^[A-Za-z_]+/[A-Za-z_+-]+(/[A-Za-z_+-]+)?$');
exception when duplicate_object then null;
end $$;

comment on column public.profiles.plattform is
  'Womit die App zuletzt benutzt wurde: android, ios oder web. Nur gefuellt, '
  'solange die Erlaubnis "analyse" gilt; beim Widerruf wird sie geleert. '
  'Ersetzt zusammen mit zeitzone die Auswertung von IP-Adressen (0036).';

comment on column public.profiles.zeitzone is
  'Zeitzone des Geraets als grobe Herkunftsangabe, etwa Europe/Berlin. Ein '
  'Hinweis, keine Tatsache: umstellbar und beim Reisen abweichend. Nur '
  'gefuellt, solange die Erlaubnis "analyse" gilt.';
