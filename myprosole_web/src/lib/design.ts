/**
 * Hell oder dunkel.
 *
 * Ein tiefes Modul fuer eine kleine Sache: Wer das Design umschalten will,
 * muss nicht wissen, dass es an einem Attribut am Wurzelelement haengt, wie
 * der Schluessel im Speicher heisst, oder was gilt, wenn noch nie jemand
 * gewaehlt hat.
 *
 * Vorher stand genau das doppelt im Quelltext - einmal beim Programmstart,
 * einmal in den Einstellungen. Zwei Orte fuer dieselbe Regel sind zwei
 * Gelegenheiten, sie verschieden zu aendern.
 */

export type Design = 'hell' | 'dunkel'

/** Der Schluessel ist gewachsen und heisst englisch. Nur hier steht er. */
const SCHLUESSEL = 'myprosole_theme'

/** Ohne Wahl ist es dunkel - so war es von Anfang an. */
const VOREINSTELLUNG: Design = 'dunkel'

function alsAttribut(d: Design): string {
  return d === 'dunkel' ? 'dark' : 'light'
}

/**
 * Was gerade gilt.
 *
 * Fragt das Wurzelelement, nicht den Speicher: Das Element ist die Wahrheit,
 * der Speicher nur die Erinnerung. Waeren beide verschieden, zaehlt was man
 * sieht.
 */
export function designLesen(): Design {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'hell'
    : 'dunkel'
}

/** Beim Programmstart einmal anwenden, was zuletzt gewaehlt war. */
export function designAnwenden(): Design {
  const gemerkt = localStorage.getItem(SCHLUESSEL)
  const design: Design =
    gemerkt === 'light' ? 'hell' : gemerkt === 'dark' ? 'dunkel' : VOREINSTELLUNG
  document.documentElement.setAttribute('data-theme', alsAttribut(design))
  return design
}

/** Umschalten und merken. Gibt zurueck, was jetzt gilt. */
export function designUmschalten(): Design {
  const neu: Design = designLesen() === 'dunkel' ? 'hell' : 'dunkel'
  document.documentElement.setAttribute('data-theme', alsAttribut(neu))
  localStorage.setItem(SCHLUESSEL, alsAttribut(neu))
  return neu
}
