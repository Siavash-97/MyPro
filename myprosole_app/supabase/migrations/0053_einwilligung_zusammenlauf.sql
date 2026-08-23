-- ============================================================
-- 0053: Der Einwilligungswortlaut fuer ZusammenLauf
-- ============================================================
-- Getrennt von 0052, und zwar aus einem technischen Grund: Der Enum-Wert
-- 'zusammenlauf' entsteht dort, und PostgreSQL verbietet, einen neuen
-- Enum-Wert in derselben Transaktion zu BENUTZEN, in der er entstand.
-- Diese Datei wird deshalb als EIGENER Lauf eingespielt, nach 0052.
--
-- Warum es diesen Text ueberhaupt braucht
-- ---------------------------------------
-- Der Schalter zusammenlauf_sichtbar allein ist nach dem eigenen Massstab
-- des Projekts (0034) kein Nachweis: ein ueberschreibbarer Boolean ohne
-- Zeitpunkt, ohne Wortlaut, ohne Historie. 0034 hat festgelegt, dass
-- Einwilligungen unveraenderliche Zeilen mit versioniertem Wortlaut und
-- Hash sind - "WER, WAS, WANN reicht ohne WELCHEM TEXT nicht."
--
-- ZusammenLauf spielt Profilangaben aktiv an Fremde aus - darunter die
-- Geschlechtsidentitaet, die die Person freiwillig angegeben hat. Das ist
-- mehr als Speichern (0049) und braucht eine informierte, nachweisbare
-- Zustimmung. Die App schreibt beim Einschalten des Schalters eine
-- 'erteilt'-Zeile und beim Ausschalten eine 'widerrufen'-Zeile - der
-- Schalter selbst bleibt die WIRKUNG, die Einwilligungszeile ist der
-- NACHWEIS.
--
-- Der Wortlaut benennt ehrlich, was gezeigt wird - und dass die
-- Praeferenzfelder (wen will ich sehen / wem darf ich gezeigt werden)
-- NICHT dazugehoeren: Sie steuern nur die Auswahl.
-- ============================================================

insert into einwilligung.texte (zweck, version, titel, wortlaut, pflicht)
values (
  'zusammenlauf',
  '2026-08-v1',
  'Sichtbar für ZusammenLauf',
  'Wenn ich diese Funktion einschalte, wird mein Community-Profil anderen '
  'angemeldeten Läuferinnen und Läufern als Laufpartner-Vorschlag gezeigt. '
  'Dazu gehören: mein Profiltext, meine Lauferfahrung und Sportarten, meine '
  'Antworten auf die Profilfragen sowie – falls ich sie angegeben habe – '
  'meine Geschlechtsidentität. Meine Einstellungen, wen ich sehen möchte '
  'und wem ich gezeigt werden darf, werden dabei niemandem gezeigt; sie '
  'steuern nur die Auswahl. Wer mich nach links wischt, bekommt mich '
  'dauerhaft nicht mehr vorgeschlagen; wer mich anfragt, tut das mit '
  'sichtbarem Namen. Ich kann diese Sichtbarkeit jederzeit im Profil '
  'wieder ausschalten - dann werde ich niemandem mehr vorgeschlagen; '
  'bereits gestellte Anfragen bleiben bestehen.',
  false
)
on conflict (zweck, version) do nothing;
