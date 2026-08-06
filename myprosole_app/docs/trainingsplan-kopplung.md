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

## Eigener Plan (Idee: wie Lyfta)

Sinnvoll, aber eine eigene Ausbaustufe. Drei Quellen wären denkbar:

- Plan von MyProSole (heute)
- Plan von der Person selbst angelegt
- eigener Plan plus MyProSole-Vorschläge als optionale Ergänzung

Die dritte Variante ist die interessanteste und zugleich die aufwendigste: Sie
verlangt, dass Vorschlag und Zusage getrennt modelliert sind – wer den Plan
gebaut hat, muss am Eintrag hängen. Das gehört ins Datenmodell, bevor der
erste Screen dafür entsteht, sonst wird es später ein Umbau.

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
