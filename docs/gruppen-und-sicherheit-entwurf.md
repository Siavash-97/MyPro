# Gruppen, ZusammenLauf und Sicherheit

Entwurf vom 19.08.2026, nichts davon gebaut. Grundlage: dein Vorbild
[mdrza.de/bundesweit](https://www.mdrza.de/bundesweit), deine Beschreibung von
ZusammenLauf als Profilsuche, und Recherche zu den Sicherheitsfragen.

---

## 1. Was von mdrza zu übernehmen ist

Nachgesehen, was die Seite tatsächlich tut:

- Eine **Kampagne mit Zeitraum und Ziel** (1.5.–31.8., „20 Radtage")
- **Gesamtzahlen** öffentlich: Teilnehmende, Kilometer, eingespartes CO₂
- Eine **Teamrangliste** mit Team, Teilnehmerzahl, Gesamttagen, Kilometern

**Der wichtigste Einfall steckt in einem Detail:** Die Platzierung richtet
sich nach *durchschnittlichen Tagen pro Teilnehmendem*, nicht nach der Summe.

Das ist der Unterschied zwischen einem Wettbewerb, der funktioniert, und
einem, der es nicht tut. Nach Summe gewinnt immer die größte Firma, und ein
Fünf-Personen-Betrieb meldet sich gar nicht erst an. Nach Durchschnitt kann
das kleine Team gewinnen — und plötzlich lohnt es sich, **alle** mitzunehmen
statt nur die drei Schnellen.

**Für MyProSole heißt das:** Nicht Kilometer summieren, sondern *Lauftage je
Person* zählen. Wer dreimal fünf Kilometer läuft, ist gesünder unterwegs als
wer einmal fünfzehn läuft — und der Marathonläufer im Team zieht die Wertung
nicht allein.

---

## 2. Gruppen: drei Arten, ein Aufbau

| Art | Wer | Besonderheit |
|---|---|---|
| **Freundeskreis** | privat, per Einladung | wie heute |
| **Verein** | Laufgruppe, Sportverein | öffentlich auffindbar, Aufnahme durch Leitung |
| **Firma** | Betrieb, Abteilung | **Beitritt nur mit Firmen-E-Mail**, Auswertung nur in Summe |

Der Aufbau ist derselbe — Mitglieder, Beitrittsregel, Fragen beim Beitritt —,
es kommt nur die Art dazu und, bei Firmen, die Bindung an eine E-Mail-Domäne.

### Wettbewerbe

Ein Wettbewerb gehört nicht an die Gruppe, sondern **daneben**: Ein Zeitraum,
ein Ziel, und Gruppen treten darin an. So kann dieselbe Gruppe an mehreren
Wettbewerben teilnehmen, und ein Wettbewerb überlebt das Ende einer Gruppe
nicht als Datenmüll.

```
wettbewerb        Name, von, bis, Ziel, Wertung
wettbewerb_gruppe welche Gruppe nimmt teil
```

Die Rangliste wird **berechnet, nicht gespeichert** — aus den Läufen im
Zeitraum. Ein gespeicherter Punktestand kann von den Daten abweichen, eine
Ableitung nicht. (Dieselbe Überlegung wie bei den Einwilligungen in 0034.)

---

## 3. Der Punkt, an dem Firmengesundheit rechtlich kippt

**Ein Arbeitgeber darf die Gesundheitsdaten einzelner Beschäftigter nicht
sehen.** Nicht die Kilometer von Frau Meier, nicht ihre Lauftage, nicht ihre
Beschwerden. Das ist keine Feinheit, sondern der Punkt, an dem so ein Angebot
im Betrieb scheitert — spätestens beim Betriebsrat.

Daraus folgen zwei Regeln, die in der Datenbank stehen müssen und nicht in
einer Beschreibung:

**Nur Summen.** Eine Firmengruppe zeigt Gesamtzahlen und einen
Durchschnitt — nie eine Liste mit Namen und Werten.

**Mindestgröße.** Unter einer Schwelle (Vorschlag: 5 aktive Teilnehmende)
wird gar nichts angezeigt. Bei drei Teilnehmenden ist ein Durchschnitt keine
Anonymisierung, sondern eine Rechenaufgabe.

Innerhalb eines Vereins oder Freundeskreises darf eine Namensliste stehen —
dort ist die Teilnahme freiwillig und unter Gleichen. Der Unterschied liegt
im Machtverhältnis, nicht in der Technik.

---

## 4. ZusammenLauf als Profilsuche — und was das aufmacht

Du beschreibst es als Suche nach Stadt, Kilometern und Tempo, zum
Durchblättern wie bei einer Partnerbörse.

**Das ist ein durchsuchbares Verzeichnis von Läuferinnen nach Wohnort.**
Genau das, wovor du selbst gewarnt hast. Zwei Rechercheergebnisse, die
zeigen, dass die Sorge begründet ist:

**Zum Standort:** Forscher der NC State University haben gezeigt, dass sich
aus Stravas öffentlicher Heatmap zusammen mit Profilangaben **Wohnadressen
bestimmen** lassen — über die Start- und Endpunkte der Aufzeichnungen. Stravas
Antwort darauf sind *Privatzonen*: ein Bereich um eine Adresse, in dem Anfang
und Ende jeder Aufzeichnung abgeschnitten werden.
([BleepingComputer](https://www.bleepingcomputer.com/news/security/strava-heatmap-feature-can-be-abused-to-find-home-addresses/),
[Cybernews](https://cybernews.com/privacy/strava-heatmap-might-reveal-your-home-address/))

**Zum Treffen:** In der Sicherheitsgestaltung von Kennenlern-Apps setzt sich
**bauliche statt vorschriftlicher Sicherheit** durch — der Unterschied
zwischen „die App verhindert es" und „der Nutzer muss daran denken". Ein
Ansatz macht die erste Begegnung grundsätzlich zu einer **kleinen Gruppe an
einem öffentlichen Ort**. Das räumt die ganze Gefahrenklasse „allein mit einer
fremden Person" ab, ohne dass jemand eine Regel befolgen muss.

Und eine Ernüchterung, die dazugehört: Ein Prüfsiegel bestätigt, dass eine
Prüfung stattgefunden hat — **nicht, wer jemand ist oder wie er sich
verhält**. Wer es als Sicherheit verkauft, macht es schlimmer.

---

## 5. Vorschlag: neun Maßnahmen, sieben davon baulich

Geordnet danach, wie viel sie tragen — nicht danach, wie leicht sie zu bauen
sind.

**1. Privatzone um Zuhause, von Anfang an an.**
Die ersten und letzten Hundert Meter jeder Aufzeichnung werden nie
gespeichert — nicht versteckt, sondern gar nicht erst übertragen. Was nicht
da ist, kann nicht auslaufen. Der Radius ist einstellbar, das Abschalten
nicht.

**2. Erste Begegnung als Gruppenlauf.**
Ein Zusammenlauf mit mindestens drei Zusagen ist der Normalfall; das Treffen
zu zweit ist die Ausnahme, die man ausdrücklich wählt. Baulich statt
vorschriftlich.

**3. Beidseitiges Interesse vor dem Schreiben.**
Schreiben kann nur, wer angefragt **und** eine Zusage bekommen hat. Eine
einseitige Kontaktaufnahme gibt es nicht. Das ist bereits so — es gehört
festgeschrieben, nicht nur gebaut.

**4. Kein Filter nach Geschlecht.**
Der erste Filter, den ein Nachsteller setzen würde. Er bringt für den Zweck
nichts, was Tempo und Strecke nicht besser leisten.

**5. Keine genauen Zeiten öffentlich.**
„Morgens" statt „06:30 Uhr". Regelmäßigkeit plus Ort plus Uhrzeit ist das,
was ein Auflauern überhaupt möglich macht — und die Uhrzeit ist der Teil, der
für die Suche am wenigsten gebraucht wird.

**6. Anfragen begrenzen.**
Wer zwanzig Anfragen am Tag schickt, sucht keine Laufpartnerin. Eine Grenze
je Tag kostet niemanden etwas und macht das Durchprobieren teuer.

**7. Der Treffpunkt bleibt bis zur Zusage grob.**
Bereits so gebaut. Zusätzlich: Treffpunkte nur an öffentlichen, benannten
Orten — kein frei eingetippter Punkt auf der Karte.

**8. Melden und Sperren, mit Beleg.**
Eine Meldung nimmt die Verabredungskette mit: wer, wann, mit wem, was
geschrieben wurde. Ohne diesen Beleg ist eine Meldung Aussage gegen Aussage.

**9. Sichtbarkeit als Schalter, mit klarem Satz.**
Der Schalter „Sichtbar für ZusammenLauf" im Profil — heute nicht
angeschlossen — bedeutet: *Mein Profil erscheint in der Suche, und meine
Verabredungen sind auffindbar.* Aus heißt: Ich suche selbst, werde aber nicht
gefunden. Standard: **aus**.

### Und der Hinweis zu den Standortdaten

Du wolltest einen Hinweis auf den Konten, was mit dem GPS geschieht. Er
gehört an die Stelle, an der es passiert — beim ersten Lauf, nicht in einer
Einstellungsliste. Drei Sätze reichen:

> Deine Laufstrecke wird gespeichert, damit du sie später ansehen kannst.
> Anfang und Ende werden dabei um 100 Meter gekürzt, damit deine Adresse nicht
> daraus hervorgeht. Geteilt wird nichts, solange du es nicht ausdrücklich
> tust.

Und dieser Satz muss dann stimmen. Das ist Maßnahme 1.

---

## 6. Was ich zuerst bauen würde

1. **Privatzone** — sie schützt alle, auch die, die nie in die Community
   gehen, und sie muss vor der ersten Aufzeichnung stehen, die man behalten
   will. Alles andere kann warten, das hier nicht.
2. **Sichtbarkeitsschalter** anschließen — der ist heute ein Versprechen ohne
   Wirkung.
3. **Gruppenarten** und die Firmenregel (Summen, Mindestgröße).
4. **Wettbewerbe** mit Wertung nach Lauftagen je Person.
5. Die Profilsuche — **zuletzt**, wenn 1, 2 und 8 stehen.

Die Reihenfolge ist Absicht: Die Profilsuche ist der Teil, der die
Gefahrenlage schafft. Sie zuerst zu bauen und die Maßnahmen nachzureichen,
hieße, das Risiko zuerst auszuliefern.
