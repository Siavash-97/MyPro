# Paket 06 — Community-Unterseiten

**Voraussetzung:** Paket 00 **und** Paket 05 sind abgenommen.
Diese Seiten benutzen dieselben Bausteine wie die Community-Reiter.

Gemeinsame Farben und Tokens:
[`../00-fundament/FUNDAMENT-DESIGN.md`](../00-fundament/FUNDAMENT-DESIGN.md)

---

## 1. Alle sieben auf einen Blick

| # | Screenshot | Vorlage | Zieldatei |
| --- | --- | --- | --- |
| 1 | `01-beitrag.png` | `community-beitrag.html` | *(Detailansicht eines Beitrags)* |
| 2 | `02-neuer-beitrag.png` | `community-neuer-beitrag.html` | *(Beitrag verfassen)* |
| 3 | `03-gruppe-detail.png` | `community-gruppe-detail.html` | `GroupDetail.tsx` |
| 4 | `04-gruppe-erstellen.png` | `community-gruppe-erstellen.html` | `GroupCreate.tsx` |
| 5 | `05-zusammenlauf-filter.png` | `community-zusammenlauf-filter.html` | *(Filter für ZusammenLauf)* |
| 6 | `06-community-profil.png` | `community-profil.html` | `CommunityProfile.tsx` |
| 7 | `07-meine-gruppen.png` | `community-meine-gruppen.html` | *(Meine Gruppen)* |

> **Erste Aufgabe:** Für vier der sieben ist die Zieldatei nicht eindeutig.
> `GroupJoin.tsx` und `CommunityChats.tsx` gibt es zusätzlich, und manche
> Entwürfe könnten in der App als Dialog statt als eigene Seite umgesetzt sein.
> **Ordne zuerst zu, welcher Entwurf zu welcher Datei gehört, und leg mir die
> Zuordnung vor** — bevor du irgendetwas änderst.

---

## 2. Der gemeinsame Baustein: der schmale Kopf

Alle sieben tragen denselben kompakten Kopf: Zurück-Pfeil und Titel in einer
Zeile. Kein Wortmark, keine Kennzahlen, weniger Polsterung unten.

```
┌ .md-page-hero.md-page-hero--compact ───────────┐
│  ←   Frühaufsteher München                     │  ← __top-row
└────────────────────────────────────────────────┘
```

```html
<div class="md-page-hero md-page-hero--compact">
  <div class="md-page-hero__top-row">
    <a class="md-home-hero__icon-btn" href="…" aria-label="Zurück">
      <svg class="icon"><use href="#icon-back"/></svg>
    </a>
    <p class="md-page-hero__title">Frühaufsteher München</p>
  </div>
</div>
```

```css
.md-page-hero--compact { padding-bottom: 16px; gap: 0; }
.md-page-hero__top-row { display: flex; align-items: center; gap: 8px; }
.md-page-hero__top-row .md-page-hero__title { font-size: 18px; }
```

**Der Zurück-Pfeil muss dorthin führen, woher man kam.** Im Mockup ist das fest
verdrahtet (Gruppe-Detail → Gruppen). In der App ist das oft der
Browser-Verlauf. Prüfen, was richtig ist: Ein fester Pfad ist verlässlicher,
wenn man die Seite direkt aufruft; der Verlauf ist richtiger, wenn man aus
verschiedenen Richtungen kommt. **Nicht raten — kurz melden.**

---

## 3. Was je Seite dazukommt

Diese Seiten sind klein. Statt für jede eine eigene Beschreibung: die Vorlage
im Browser öffnen, nachmessen, und diese Regeln anwenden.

| Baustein | Regel |
| --- | --- |
| Listen von Personen oder Gruppen | `.md-list-item--tint-indigo` bzw. `.md-card--tint-indigo` |
| Beiträge und Kommentare | **keine Tönung** (wie im Feed) |
| Formulare (Gruppe erstellen, Filter, Beitrag verfassen) | `.md-form-section` mit unsichtbarer `<legend>` und sichtbarem `<p class="md-form-section__title">` |
| Filter-Chips | `.md-filter-row` mit `min-height: 38px` |
| Hinweise | `.md-info-note` |
| Knöpfe | `.md-button--filled` / `--tonal` / `--text` |

### Zwei Seiten mit Eigenheiten

**Beitrag (1):** Benutzt `.device-frame--app-shell` — der Originalbeitrag steht
oben fest, darunter scrollt der Antwort-Verlauf, unten sitzt die Eingabezeile
am Rand. Diese Aufteilung ist der Zweck der Seite und muss erhalten bleiben.

**Community-Profil (6):** Zeigt, was **andere** von einem sehen. Hier gilt die
Zurückhaltung aus Paket 05 doppelt: Was hier steht, ist öffentlich. Vor jeder
Änderung an sichtbaren Feldern nachfragen.

---

## 4. Inhalte

Für jede der sieben Seiten gilt dieselbe Regel wie überall: **Zahlen und Namen
in den Screenshots sind erfunden.** „214 Mitglieder", „486 km", „Tobias, 31" —
nichts übernehmen.

### Vorhandene Quellen

| Bereich | Store |
| --- | --- |
| Gruppen, Mitglieder, Beitritt | `store/groups.ts` |
| Verabredungen, Anfragen | `store/zusammenlauf.ts` |
| Beiträge, Kommentare, Reaktionen | `store/feed.ts` |
| Öffentliches Profil | `store/communityProfile.ts` |
| Direktnachrichten | `store/chats.ts` |
| Sichtbarkeits-Einwilligung | `store/einwilligung.ts` |

### ⚠️ Zu klären

| Punkt | Frage |
| --- | --- |
| **Zuordnung Entwurf → Datei** | Siehe Abschnitt 1. Die wichtigste offene Frage dieses Pakets. |
| **Zurück-Pfeil** | Fester Pfad oder Browser-Verlauf? Siehe Abschnitt 2. |
| **Filter für ZusammenLauf** | Welche Felder sind wirklich speicherbar? Umkreis, Tempo-Spanne, Wochentage — steht das so in der Datenbank? |
| **„Diese Woche gemeinsam gelaufen"** | Wird die Gruppensumme gerechnet, oder ist sie im Entwurf erfunden? |
| **Gruppe erstellen** | Welche Felder sind Pflicht? Gibt es eine Moderation, bevor eine Gruppe sichtbar wird? |

---

## 5. Vorgehen

Diese sieben Seiten sind klein und unabhängig voneinander. **Eine nach der
anderen**, jede einzeln abnehmen lassen. Nicht alle sieben in einem Rutsch — bei
sieben gleichzeitig geänderten Dateien ist ein Fehler schwer zuzuordnen.

Vorgeschlagene Reihenfolge (einfach → schwierig):

1. Meine Gruppen (7) — reine Liste
2. Gruppe erstellen (4) — Formular
3. Filter für ZusammenLauf (5) — Formular
4. Gruppe Detail (3) — Liste plus Kopfbereich
5. Neuer Beitrag (2) — Formular mit Bild
6. Community-Profil (6) — Sichtbarkeit, sorgfältig
7. Beitrag (1) — eigene Hülle mit fester Eingabezeile

---

## 6. Abnahme je Seite

- [ ] Schmaler Kopf mit Zurück-Pfeil, führt an die richtige Stelle
- [ ] Tönungsregeln eingehalten (Listen indigo, Beiträge ungetönt)
- [ ] Formulare benutzen das `<legend>`-Muster des Projekts
- [ ] Kein erfundener Inhalt
- [ ] Leere Zustände gebaut
- [ ] Hell und dunkel gezeigt
