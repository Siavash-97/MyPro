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
`.md-score` – derselbe wie in der Einzelanalyse – ergänzt um
`.md-score-trend`, eine Balkengrafik der einzelnen Läufe. Die Balken laufen
zeitlich aufsteigend, die Liste darunter beginnt dagegen beim jüngsten Lauf;
die Reihenfolge ist also bewusst umgekehrt. Der gefüllte Anteil des Rings und
jede Balkenhöhe entsprechen direkt den Score-Werten und werden mitgeprüft.

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
