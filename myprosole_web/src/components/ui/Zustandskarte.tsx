import type { ReactNode } from 'react'
import Icon from './Icon'

/**
 * Eine Karte fuer die Faelle, in denen es nichts zu zeigen gibt: leer,
 * gescheitert, nicht vorhanden.
 *
 * Warum nicht `EmptyState`
 * ------------------------
 * `EmptyState` gibt es schon, und es ist die falsche Bauart fuer einen
 * Fehler. Es ist ein zentrierter Block aus Tailwind-Hilfsklassen
 * (`py-12`, `text-center`) ohne Flaeche - richtig fuer "in dieser Liste
 * steht noch nichts", falsch fuer "das Laden ist schiefgegangen":
 *
 *  - Es ist keine Karte. Laufdetails und Laufanalyse sind Stapel aus
 *    `.md-card`; ein Fehler ohne Flaeche schwebt zwischen den Raendern.
 *  - Es hat keinen Ansageweg. Ein Fehler MUSS angesagt werden
 *    (`role="alert"`), sonst merkt ihn nur, wer hinsieht.
 *  - Es kennt keinen Unterschied zwischen leer und kaputt. Genau der ist
 *    hier die ganze Aufgabe.
 *
 * Das Designsystem hat fuer diesen Fall bereits `.md-leer`
 * (styles/components.css) - ehrliche Karte mit Zeichen, Titel, Satz und
 * Platz fuer genau eine Handlung. `Zusammenlauf.tsx` benutzt sie seit dem
 * 23.08.2026 fuer dieselbe Unterscheidung. Diese Datei macht daraus ein
 * Bauteil, damit die dritte und vierte Abschrift nicht von Hand entsteht.
 *
 * Genau EINE Handlung, nicht zwei: `.md-button` ist `inline-flex`, zwei
 * Knoepfe stellten sich in der zentrierten Karte nebeneinander und
 * umbraechen auf schmalen Geraeten. Der Weg zurueck steht ohnehin schon
 * als Pfeil in der Kopfzeile (`TopAppBar`).
 */
interface ZustandskarteProps {
  /** Zeichen aus dem Sprite (`IconSprite.tsx`), z. B. `warn` oder `history`. */
  icon: string
  titel: string
  text: string
  /** Der eine Ausweg. Ohne ihn ist die Karte eine Sackgasse. */
  aktion?: ReactNode
  /**
   * Ist etwas schiefgegangen?
   *
   * Dann traegt die Karte `role="alert"` und wird vorgelesen, sobald sie
   * erscheint. Bei "gibt es nicht" waere das falsch laut: Da ist nichts
   * kaputt, der Lauf ist nur nicht da.
   */
  fehler?: boolean
}

export default function Zustandskarte({
  icon,
  titel,
  text,
  aktion,
  fehler = false,
}: ZustandskarteProps) {
  return (
    <section className="md-card md-leer" role={fehler ? 'alert' : undefined}>
      <div className="md-feature-heading__icon" aria-hidden="true">
        <Icon name={icon} className="icon" />
      </div>
      <h2 className="md-section-title">{titel}</h2>
      <p className="md-leer__text">{text}</p>
      {aktion}
    </section>
  )
}
