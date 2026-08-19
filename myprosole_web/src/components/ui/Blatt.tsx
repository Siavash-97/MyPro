import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

/**
 * Ein Blatt, das von unten hereinfaehrt.
 *
 * Warum von unten und nicht als Kasten in der Mitte
 * -------------------------------------------------
 * Das Telefon wird mit dem Daumen bedient, und der reicht nach unten
 * weiter als nach oben. Was zum Antippen da ist, gehoert dorthin, wo die
 * Hand ohnehin ist. Ein Kasten in der Bildmitte sieht am Rechner gut aus
 * und zwingt am Telefon zum Umgreifen.
 *
 * Warum ein natives <dialog>
 * --------------------------
 * Escape schliesst, der Hintergrund wird unbedienbar, der Tastaturfokus
 * bleibt drinnen, Vorleseprogramme kennen es. Das bringt der Browser mit;
 * nachgebaut waere es viel Code, der genau diese Dinge erfahrungsgemaess
 * vergisst. Dasselbe Argument wie beim vergroesserten Profilbild.
 *
 * Gesteuert von aussen: `offen` sagt, was sein soll, `onSchliessen` meldet
 * einen Schliesswunsch. Das Blatt schliesst sich nie selbst – so gibt es
 * genau eine Stelle, die den Zustand kennt, und keine zwei, die sich
 * widersprechen koennen.
 */
export default function Blatt({
  offen,
  onSchliessen,
  titel,
  children,
}: {
  offen: boolean
  onSchliessen: () => void
  titel: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [faehrtAus, setFaehrtAus] = useState(false)

  useEffect(() => {
    const d = dialog.current
    if (!d) return

    if (offen && !d.open) {
      setFaehrtAus(false)
      d.showModal()
      // Der Hintergrund darf nicht mitscrollen. Ein <dialog> macht ihn
      // unbedienbar, aber nicht unbeweglich – ohne das hier wandert die
      // Seite darunter weg, waehrend man in der Liste blaettert.
      document.body.style.overflow = 'hidden'
      return
    }

    if (!offen && d.open) {
      // Bei abgeschalteter Bewegung gibt es keine Animation und damit auch
      // kein animationend. Dann sofort zu, sonst bliebe das Blatt offen.
      const ohneBewegung = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (ohneBewegung) {
        d.close()
        document.body.style.overflow = ''
      } else {
        setFaehrtAus(true)
      }
    }
  }, [offen])

  // Wird die Seite gewechselt, waehrend das Blatt offen ist, bliebe die
  // Sperre sonst am Koerper haengen und die ganze App liesse sich nicht
  // mehr scrollen.
  useEffect(() => () => { document.body.style.overflow = '' }, [])

  return (
    <dialog
      ref={dialog}
      className={`md-blatt${faehrtAus ? ' md-blatt--faehrt-aus' : ''}`}
      aria-label={titel}
      // Escape: Der Browser wuerde sofort schliessen, ohne Nachlauf. Wir
      // fangen es ab und gehen denselben Weg wie jeder andere Schliesswunsch.
      onCancel={(e) => { e.preventDefault(); onSchliessen() }}
      // Ein Klick daneben schliesst: Das Ziel ist dann das dialog-Element
      // selbst, nicht der Inhalt darin.
      onClick={(e) => { if (e.target === dialog.current) onSchliessen() }}
      onAnimationEnd={(e) => {
        if (!faehrtAus || e.target !== dialog.current) return
        dialog.current?.close()
        setFaehrtAus(false)
        document.body.style.overflow = ''
      }}
    >
      <div className="md-blatt__inhalt">
        <div className="md-blatt__kopf">
          {/* Der Griff sagt ohne Worte, woher das Blatt kam und wohin es
              wieder verschwindet. Er ist Zierde, kein Bedienelement –
              deshalb aria-hidden. Geschlossen wird ueber das Kreuz, den
              Bereich daneben oder Escape. */}
          <span className="md-blatt__griff" aria-hidden="true" />
          <h2 className="md-blatt__titel">{titel}</h2>
          <button
            type="button"
            className="md-blatt__zu"
            onClick={onSchliessen}
            aria-label="Schließen"
          >
            <Icon name="remove" size={20} className="icon-sm" />
          </button>
        </div>
        <div className="md-blatt__koerper">{children}</div>
      </div>
    </dialog>
  )
}
