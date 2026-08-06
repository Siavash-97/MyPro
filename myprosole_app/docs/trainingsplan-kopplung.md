# Kopplung von Lauf, Plan und Training

> Festgehalten am 6. August 2026. Punkt 1 und 2 sind entschieden und im
> Design umgesetzt, Punkt 3 bis 5 bleiben offen.
> Betrifft `design/mockups/home.html`, `live-tracking.html`,
> `lauf-zusammenfassung.html` und `uebungen.html`.

## Das Problem

Plan und Lauf sind im Prototyp zwei getrennte Welten. Wer auf Home
`Laufen starten` drückt, löst im Wochenplan nichts aus. Steht dort für heute
`12 km locker` und die Person läuft genau das, bleibt der Eintrag trotzdem
offen.

Die App stürzt dadurch nicht ab – sie zeigt etwas Falsches an, und das ist
schlechter. Ein Absturz ist sichtbar, ein stiller Falschzustand nicht. Die
Person sieht am Sonntag eine offene Einheit, die sie am Donnerstag gemacht
hat, und verliert das Vertrauen in den Plan.

## Die eigentliche Frage

**Schreibt der Plan vor, oder beschreibt er?**

- **Vorschreibend:** Die App sagt, was zu tun ist. Jede Abweichung ist ein
  Versäumnis. Erfordert, dass die Person vor dem Lauf erklärt, was sie vorhat.
- **Beschreibend:** Der Lauf ist die Tatsache. Der Plan wird ihm danach
  zugeordnet. Abweichung ist normal und erzeugt keinen Falschzustand.

Diese Entscheidung bestimmt alles Weitere, auch ob es einen oder zwei
Startknöpfe braucht.

## Szenarien

Drei unabhängige Achsen: Planquelle, Planbefolgung, Sensorik. Die Sensorik ist
orthogonal – mit Einlagen kommen nur mehr Kennzahlen hinzu, der Ablauf bleibt
gleich. Entscheidend sind die ersten beiden.

| # | Situation | Was heute passiert | Was passieren müsste |
|---|---|---|---|
| A | Plan von MyProSole, Person folgt ihm | Lauf wird erfasst, Planeintrag bleibt offen | Eintrag wird nach dem Lauf erledigt |
| B | Plan vorhanden, Person läuft anders (5 km schnell statt 12 km locker) | wie A | Nicht automatisch abhaken. Einmal nachfragen oder unerledigt lassen |
| C | Plan vorhanden, Person läuft gar nicht, macht aber Kraft im Studio | Krafteinheit bleibt offen | `Ich habe das schon gemacht` muss möglich sein |
| D | Kein Plan, nur Tracking | funktioniert bereits | unverändert lassen – das ist der App-only-Modus |
| E | Eigener Plan der Person, MyProSole nur als Ergänzung | nicht vorgesehen | Plan muss von der Person kommen können |
| F | Marathon-Vorbereitung von MyProSole, Kraft aber komplett extern | Kraft bleibt dauerhaft offen | Kraftanteil muss abwählbar sein |

Szenario B ist der häufigste Fall und zugleich der gefährlichste: Wer
automatisch abhakt, sobald irgendein Lauf stattfand, produziert genau die
Falschzustände, die den Plan entwerten.

Szenario F trifft eine Regel aus dem Trainingskonzept: E.11 blendet nach drei
Wochen ohne geloggtes Krafttraining einen Konsistenz-Hinweis ein. Wer sein
Krafttraining außerhalb der App macht, bekäme diesen Hinweis zu Unrecht.

## Empfehlung

**Ein Startknopf, Zuordnung nach dem Lauf.**

Zwei Startknöpfe (`Nach Plan` / `Ohne Plan`) verlangen eine Entscheidung zu
einem Zeitpunkt, an dem die Person sie oft nicht treffen kann – vor dem Lauf
steht selten fest, ob es die geplanten 12 km werden. Wer sich falsch
entscheidet, erzeugt denselben Falschzustand, den die Trennung verhindern
sollte. Außerdem schwächt ein zweiter gleichrangiger Knopf die wichtigste
Aktion auf Home.

Stattdessen:

1. **Home zeigt den Plan als Kontext**, nicht als Wahl: über dem Startknopf
   steht `Heute geplant: 12 km locker`. Der Knopf bleibt einer.
2. **Nach dem Lauf ordnet die App zu.** Passt der Lauf grob zum Plan, wird der
   Eintrag erledigt und das sichtbar gesagt – mit einer Möglichkeit,
   das zurückzunehmen.
3. **Passt er offensichtlich nicht,** wird einmal gefragt statt geraten.
4. **Ohne Plan ändert sich nichts.** Szenario D bleibt wie es ist.

Der Vorteil: ein Weg für alle Szenarien. Die Person muss nie etwas ankündigen,
und ein abweichender Lauf erzeugt keinen falschen Haken.

Offen bleibt, wie großzügig „passt grob" ist. Das ist eine fachliche Frage
(Distanz- und Tempotoleranz je Einheitentyp) und gehört zum Trainingskonzept,
nicht ins Design.

## Eigener Plan – im Konzept inzwischen beantwortet

`Training/Selbst_gestalten_Module_Logik_und_Einfachheit.docx` beschreibt die
Ausbaustufe vollständig. Die drei Quellen sind dort **Modi**, und meine
Vermutung, dass die dritte die aufwendigste ist, bestätigt sich:

| Modus | Wer erstellt | Was greift |
|---|---|---|
| `auto` | Algorithmus | Regelwerk vollständig |
| `manual` | die Person | nur die Sicherheitsschicht E.10 |
| `hybrid` | die Person, App schlägt danach vor | Review-Schicht plus E.10 |

Wichtig für das Datenmodell: `plan_source` hängt am Plan und wechselt bei jeder
Änderung; `pending_suggestions` hält je erkannte Abweichung Regel-ID, Text,
Belegverweis und Status. Genau die Trennung von Vorschlag und Zusage, die oben
gefordert war.

Die Sicherheitsschicht bleibt in **jedem** Modus aktiv – auch im manuellen. Nur
die Inhaltslogik wird dort ausgehebelt. Rotflag und Dauerschmerz sind keine
Vorschläge zum Wegklicken: informieren, bei Ignorieren protokollieren, nie
blockieren.

### Sieben Prinzipien, an die sich das Design halten muss

Das Dokument benennt Überforderung als das eigentliche Produktrisiko: Die
Fachspezifikation ist umfangreich, an der Oberfläche darf davon fast nichts
sichtbar werden. Verbindlich für alle künftigen Screens:

1. Ein Bildschirm, eine Entscheidung.
2. Vorschlag vor Auswahl – nie ein leeres Formular als Startpunkt.
3. Reviews sind ein Angebot, kein Gate. Speichern geht immer sofort.
4. Höchstens ein bis zwei Vorschläge auf einmal.
5. Einfache Sprache zuerst, Begründung optional aufklappbar.
6. Kein Modus-Zwang: `auto`, `manual`, `hybrid` sind interne Kategorien und
   erscheinen nie im Screen.
7. Fortschritt statt Formular – Standardeintrag im Tagebuch in drei Taps.

`tests/test_design_mockups.py` prüft Prinzip 5 und 6 maschinell: kein interner
Begriff und keine Regelnummer im sichtbaren Text, und die Begründung einer
Übung beginnt mit einem kurzen Satz ohne Fachbegriff.

## Entschieden

1. **Beschreibend.** Der Lauf ist die Tatsache, der Plan wird ihm zugeordnet.
2. **Ein Startknopf.** Der Plan steht als Kontext darüber (`md-plan-hint` auf
   Home), die Zuordnung wird nach dem Lauf sichtbar gemacht und ist
   korrigierbar (`md-plan-match` in der Laufzusammenfassung).

Im Design ist damit der Weg gezeigt, nicht die Logik. Die Screens behaupten
eine Zuordnung, die noch niemand berechnet.

## Weiterhin offen

3. Toleranz für die automatische Zuordnung – fachliche Festlegung nötig.
   Solange sie fehlt, ist `Als Regenerationslauf übernommen` im Prototyp eine
   feste Aussage ohne Regel dahinter.
4. Wann kommt der selbst erstellte Plan, und in welcher der drei Varianten?
5. Wie wird extern absolviertes Training erfasst, damit E.11 keine falschen
   Konsistenz-Hinweise erzeugt?
6. Was passiert bei mehreren Läufen an einem Tag? Der zweite Lauf darf die
   bereits erfolgte Zuordnung nicht überschreiben.
