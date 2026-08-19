# MyProSole – App Design

Zentraler Ordner für das App-Design (unabhängig vom bestehenden Streamlit-Frontend).

## Plattform-Strategie

- **Phase 1 (jetzt):** Android – Design-Basis auf **Material Design 3**
- **Phase 2 (später):** iOS folgt auf derselben Grundlage, angepasst an Apple HIG
- Design-System wird so aufgebaut, dass Tokens (Farben, Typografie, Abstände) plattformunabhängig definiert sind und pro Plattform nur die Component-Regeln angepasst werden müssen.

## Struktur

- `design-system/` – Grundlagen: Farben, Typografie, Abstände, Komponenten-Regeln (Basis: Material Design 3, später erweitert um Apple HIG)
- `mockups/` – Bildschirm-Entwürfe, Screens, User Flows (zunächst Android)
- `assets/` – Icons, Illustrationen, Logos, Export-Grafiken für das Design

## Lokale Vorschau

`mockups/index.html` ist der Einstiegspunkt für den klickbaren Prototyp. Er öffnet
automatisch den Welcome-Screen. Neue Nutzer:innen gelangen nach der Registrierung
direkt zur Home-Ansicht. Dort können sie die optionale Einrichtung ihres
Läuferprofils sofort beginnen oder auf später verschieben.
Bestehende Nutzer:innen gelangen nach dem Login direkt zu Home.

Home startet im **App-only-Modus**: Läufe können ohne Einlagen per GPS erfasst
werden. Die App behauptet in diesem Zustand weder eine Sensorverbindung noch
sensorbasierte Technikdaten. Der Ablauf endet deshalb in
`mockups/lauf-zusammenfassung.html` mit Zeit, Strecke, Tempo und Route.

Einlagen bleiben optional und werden bewusst nicht auf Home beworben. Im Profil
führt der vorhandene Eintrag `Einlage verbinden` zu
`mockups/einlage-verbinden.html`. Dort ist bei Bedarf die Erklärung in
`mockups/einlagen-entdecken.html` erreichbar. Die Vorschau fordert keine
Bluetooth-Berechtigung an und greift auf kein Gerät zu.

Google und Facebook simulieren im statischen Prototyp einen erfolgreichen ersten
Login. Die Person gelangt sofort zu Home und sieht dort einen optionalen Hinweis
zur Profil-Personalisierung. Sie kann das Profil direkt einrichten oder den Hinweis
mit `Später` ausblenden. In der späteren App entscheidet der Profilstatus nach dem
OAuth-Callback, ob dieser Hinweis nötig ist; fertige Profile sehen ihn nicht erneut.
Solange das Profil offen ist, erscheint im Profil zusätzlich der Banner
`Profil vervollständigen`.

## Beispieldaten

Der Prototyp dient als Spezifikation für die spätere App. Widersprechen sich
die Beispielwerte zwischen den Screens, wird der Widerspruch mitgebaut.
Verbindlich ist deshalb die Aufzeichnungskette: `live-tracking.html` und
`lauf-zusammenfassung.html` definieren den letzten Lauf, alle übrigen Screens
übernehmen dieselben Werte. Der Referenzlauf ist aktuell
`Heute, 07:42 Uhr · 8,2 km · 48:20 min · 5:54 min/km · 64 Höhenmeter`
mit Lauf-Score 74.

Die Wochenwerte auf `home.html` und `verlauf.html` sind Aggregate der in
`verlauf.html` gelisteten Läufe und keine frei gewählten Zahlen. Beides prüft
`tests/test_design_mockups.py`: Tempo muss zu Strecke und Zeit passen, Summe
und Ø Lauf-Score müssen die Liste abbilden. Wer einen Lauf ändert, muss die
Aggregate mitziehen.

Der Ø Lauf-Score erscheint in `verlauf.html` als Ring der Komponente
`.md-score` – derselbe wie in der Einzelanalyse. Der gefüllte Anteil des Rings
muss dem Wert in seiner Mitte entsprechen und wird mitgeprüft.

Für die Vorschau in VS Code `mockups/index.html` mit **Live Preview** öffnen.
Nach Dateiänderungen die Vorschau neu laden, falls die Erweiterung nicht automatisch
aktualisiert.

Authentifizierung und Profil sind nur simuliert: Formularwerte werden lokal
validiert, aber nicht gespeichert oder an einen Server übertragen. Die
Profileinrichtung kann im Prototyp jederzeit übersprungen werden. Die Social-Login-
Buttons stellen keine Verbindung zu Google oder Facebook her und übertragen keine
Daten. Für den klickbaren Ablauf speichert der Prototyp ausschließlich die beiden
booleschen Sitzungszustände `Profil offen` und `Home-Hinweis ausgeblendet` im
Tab-Speicher; persönliche Angaben und Formularwerte gehören nicht dazu.

Der Menüpunkt `Verlauf` ist zugleich die Übersicht „Meine Läufe“. Jeder Eintrag
öffnet `mockups/analyse-ergebnis.html`. Der Lauf-Score bleibt dort sichtbar;
`Erkannte Auffälligkeiten`, `Deine Laufwerte` und `Biomechanik-Analyse` lassen
sich einzeln aufklappen. Der Vorschauparameter `mode=gps` zeigt den App-only-
Zustand mit Einlagen-Hinweis, `mode=insole` die zusätzlichen biomechanischen
Werte.

Übungen werden nicht direkt in der Laufanalyse angeboten. Nach der ersten
Einlagenanalyse fragt die Vorschau einmal ausdrücklich, ob Analysedaten die
Übungsauswahl personalisieren dürfen. Die Entscheidung wird ausschließlich als
`accepted` oder `declined` im Tab-Speicher gehalten; Lauf-, Sensor- und
Gesundheitsdaten werden dabei nicht gespeichert. Spätere Läufe sollen im Produkt
im Hintergrund verglichen werden. Erst bei einer relevanten Veränderung wird
erneut gefragt, bevor sich der Übungsplan ändert.

Am Ende der Laufzusammenfassung und Laufanalyse führt `Social-Post erstellen` in
`mockups/social-studio.html`. Das Social-Studio trennt die Bildgestaltung bewusst
vom allgemeinen Agent-Chat: Nutzende wählen ein Laufbild, besprechen im Chat-Stil
die gewünschte Gestaltung und öffnen anschließend die Story-Vorschau in
`mockups/share-export.html`.

Das Teilen-Symbol im Kopf des Laufergebnisses ist bewusst vom KI-Ablauf getrennt:
Es öffnet direkt `mockups/share-export.html?source=data` und erzeugt ein sachliches
Laufbild mit Route und Kennzahlen, ohne Chat oder Foto-Upload. Nur der große Button
`Social-Post erstellen` unter dem Ergebnis führt in das Social-Studio. Dessen
KI-Entwurf verwendet auf derselben Exportseite den Zustand `source=ai`.

Der validierte Vorschaukontext `from` führt beim Zurückgehen entweder in dieselbe
Laufanalyse oder in die unmittelbar zuvor geöffnete Laufzusammenfassung. Ein
vorhandener Analysemodus (`gps` oder `insole`) bleibt dabei erhalten. Strecke, Zeit
und Tempo des gewählten Laufs werden im Studio bereits als übernommen angezeigt
und müssen nicht erneut eingegeben werden.
Die lokale Fotoauswahl wird nach dem Verlassen des Studios bewusst nicht
persistiert. Kehrt man aus der Exportvorschau zurück, muss das Foto im statischen
Prototyp erneut gewählt werden. Die spätere App benötigt dafür einen geschützten,
zeitlich begrenzten und löschbaren Entwurfspeicher.

Die Fotoauswahl ist im Prototyp eine rein lokale Vorschau. Zulässig sind JPG, PNG
und WebP bis 10 MB; die Datei wird weder gespeichert noch an einen Server
übertragen. Vor einer produktiven KI-Verarbeitung müssen Upload, Zweck,
Aufbewahrungsfrist, Löschung und ausdrückliche Einwilligung separat umgesetzt
werden. Die fertige Exportseite ist derzeit ebenfalls nur ein klickbarer Entwurf;
eine echte PNG-Erzeugung folgt mit dem Bild-Backend.

## Laufergebnis mit und ohne Einlagen

`mockups/lauf-zusammenfassung.html` zeigt beide Zustände desselben Laufs über
denselben Parameter wie die Laufanalyse:

- ohne Parameter oder `mode=gps` den App-only-Zustand mit dem Hinweis, dass
  Technikdaten Sensoreinlagen brauchen,
- `mode=insole` zusätzlich den Block `Deine Lauftechnik` mit Kadenz,
  Bodenkontaktzeit, Belastungsverteilung und Aufsatzmuster.

Die GPS-Kennzahlen oben bleiben in beiden Zuständen identisch – es ist derselbe
Lauf, nur mit mehr Sensorik. Die Umschaltung übernimmt das vorhandene
`scripts/prototype-analysis-state.js`; es gibt bewusst keine zweite Mechanik
dafür.

Der Block ist ein Auszug und keine zweite Auswertung. Die vollständige Analyse
bleibt in `mockups/analyse-ergebnis.html?mode=insole` und wird von hier nur
verlinkt. Bodenkontaktzeit und Belastungsverteilung müssen deshalb auf beiden
Screens übereinstimmen; `tests/test_design_mockups.py` prüft das, ebenso ob die
Kadenz zu Strecke und Zeit eine plausible Schrittlänge ergibt.

## Trainingsbegleitung

Die Regeln stammen nicht aus dem Design, sondern aus
`Training/Masterdokument_Trainingskonzept_Personalisierung_v5.pdf`. Die Screens
geben ihnen nur eine Oberfläche:

| Screen | Regel im Konzept |
|---|---|
| Karte nach dem Lauf | D.2 – bei dieser Trainingslast Routine nach 2–3 von 4 Läufen, nicht nach jedem |
| Reihenfolge der Übungen | F.2 – höchstpriorisiert, zweitpriorisiert, Rumpf/Gleichgewicht, je 2 Sätze |
| Sätze und Wiederholungen | F.1 – je Übung, hier für weibliche Angabe mit Knie-Historie |
| Wochenplan | B.3 Grundgerüst, E.11 Stufe Standard (2–3 Einheiten pro Woche) |
| Kein Zusatz nach dem langen Lauf | D.2 Zusatzregel – lang-dominant, Fokus Regeneration |

Die Mikroroutine wird **als Karte in der Laufzusammenfassung** angeboten, nicht
als Dialog. Ein Dialog verdeckt das Laufergebnis und wird reflexhaft
weggetippt; die so entstehende Ablehnung wäre keine echte Entscheidung.

`Heute nicht` lässt die Einheit bis Sonntag offen und nachholbar; die neue
Woche startet bei null. Das folgt E.11, wonach ein Hinweis auf ausgesetztes
Krafttraining ausdrücklich `informativ, nicht blockierend` sein soll, und E.0,
wonach fehlende Angaben positiv statt vorwurfsvoll benannt werden.

`mockups/trainingseinheit.html` führt Übung für Übung durch die Einheit. Der
Vorschauparameter `schritt` nimmt `1`, `2`, `3` oder `fertig`; ein unbekannter
Wert fällt auf den ersten Schritt zurück. Derselbe Screen dient später auch der
separaten Krafteinheit – nur mit längerer Zusammenstellung.

Der Sicherheitshinweis des Konzepts (`keine medizinische Bewertung`, `ersetzt
keine individuelle ärztliche Beratung`) steht in den Screens selbst, nicht nur
im PDF. Das Konzept trägt zudem den Vermerk, dass es vor Produktivsetzung mit
Sportmedizin oder Physiotherapie gegenzuprüfen ist.

**Prototyp-Heute ist Sonntag, der 9. August 2026.** Alle Screens beziehen sich
darauf: die vier Läufe der Woche liegen auf Di, Do, Sa und So und passen damit
in das Grundgerüst B.3, der Zykluskalender markiert den 9. August als heute.
`tests/test_design_mockups.py` prüft, dass Wochenplan und Verlauf dieselben
Läufe an denselben Tagen zeigen.

### Offene Frage an das Konzept

E.2 nennt für ein Zeitbudget von 5–10 Minuten `4–5 Übungen`, F.2 beschreibt die
Standard-Mikroroutine für dieselben 5–10 Minuten dagegen mit drei Übungen und
einer vierten erst ab 15 Minuten. Der Prototyp folgt F.2 mit drei Übungen, weil
das die speziellere Angabe ist. Der Widerspruch gehört bei der fachlichen
Gegenprüfung geklärt.

## Selbst gestalten

Drei Module hinter dem Drei-Punkte-Menü im Übungen-Tab, beschrieben in
`Training/Selbst_gestalten_Module_Logik_und_Einfachheit.docx`:

| Screen | Startzustand |
|---|---|
| `trainingstagebuch.html` | Distanz, Dauer und Tempo aus dem Lauf übernommen; `?from=tracking` zeigt zusätzlich den Ausweg „Später eintragen" |
| `laufplan.html` | Wochenraster vorbelegt, Summe und Farbe rechnen beim Tippen mit |

Die Schmerzfrage im Tagebuch steht eigenständig da, nicht unter einer
optionalen Aufklapp-Zeile: `current_pain` ist im Regelwerk ein harter
Filter. Bei „Nein" ist sie mit
einem Tipp erledigt, bei „Ja" folgen Kilometer und Ort. Die Chips sind der
Eingang ins Regelwerk – nur ein strukturierter Ort kann die Übungsauswahl
steuern. Der Chip `Woanders` blendet ein Freitextfeld ein, und daneben steht,
dass dieser Text der Coach liest und die Auswahl nicht steuert.

Die Farbschwellen im Laufplan (10 % und 20 % Zuwachs) stammen aus Teil A.4 des
Trainingskonzepts. Sie färben nur; gespeichert wird immer.

Die drei Erstellungsarten `auto`, `manual` und `hybrid` aus dem Dokument sind
interne Kategorien und erscheinen nirgends im Screen. Näheres in
[`../docs/trainingsplan-kopplung.md`](../docs/trainingsplan-kopplung.md).

## Zykluskalender

Optionaler Bereich im Profil. Sichtbar wird er nur, wenn in der
Profileinrichtung `Geschlecht` auf `Weiblich` steht; `Keine Angabe` ist
ausdrücklich möglich, damit niemand zur Offenlegung gezwungen wird.

`mockups/zyklus-einrichten.html` erklärt vor jeder Eingabe, was erfasst wird
(nur Beginn und Ende der Periode), was sich dadurch ändert (die
Übungsvorschläge berücksichtigen die Zyklusphase) und wie sich das wieder
beenden lässt. Erst die Wahl zwischen `Regelmäßig` und `Unregelmäßig` gilt als
Einwilligung. Bei regelmäßigem Zyklus sagt `mockups/zyklus-kalender.html` den
nächsten Beginn vorher und markiert ihn gestrichelt; bei unregelmäßigem gibt es
keine Vorhersage und ausschließlich selbst gesetzte Einträge. Der Vorschau-
parameter `mode=regular` bzw. `mode=irregular` zeigt beide Zustände direkt.

Der Kalender bleibt eine Trainingsfunktion. Er stellt keine Diagnose, gibt
keine medizinische Bewertung ab und ersetzt keine ärztliche Beratung; die
Screens sagen das ausdrücklich.

### Datenschutz und bekannte Abweichung

Zyklusdaten sind besondere personenbezogene Daten nach DSGVO Art. 9. Die
`DEVELOPMENT_STANDARDS` verlangen dafür Verschlüsselung bei Speicherung und
Übertragung, einen dokumentierten Zweck und minimale Rechte.

- **Nicht erfüllte Regel:** Verschlüsselung, Aufbewahrung und Export der
  Zyklusdaten sind nicht umgesetzt.
- **Grund:** Der Prototyp ist statisches HTML ohne Backend und ohne
  Schlüsselverwaltung. Das Risiko ist hier gering, weil er bewusst gar keine
  Zyklusdaten hält.
- **Aktuelle Ersatzlösung:** `scripts/prototype-cycle-state.js` speichert
  ausschließlich drei validierte Zustände im Tab-Speicher – ob der Kalender
  angeboten wird, ob eingewilligt wurde und ob regelmäßig oder unregelmäßig
  erfasst wird. Weder Perioden-Tage noch Datum, Zykluslänge oder die
  Geschlechtsangabe werden abgelegt; die Angabe wird beim Absenden nur
  verglichen. `tests/test_design_mockups.py` prüft das.
- **Folgeaufgabe:** Vor der ersten echten Erfassung müssen Speicherung mit
  Verschlüsselung, Zweckbindung, Aufbewahrungsfrist, Löschung, Export und der
  dokumentierte Widerruf der Einwilligung umgesetzt und die Zugriffsrechte auf
  das Nötigste begrenzt werden. Erst danach darf der Kalender Daten annehmen.
