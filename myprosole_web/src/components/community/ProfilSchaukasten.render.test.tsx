// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ProfilFoto } from '../../store/communityProfile'
import { fotoNachsignieren } from '../../store/communityProfile'
import ProfilSchaukasten from './ProfilSchaukasten'

/**
 * Die `onError`-Verdrahtung der PROFILfotos, gerendert gemessen.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Scheibe 1b von Befund B hat den Schaukasten auf denselben Stand gebracht
 * wie die Feed-Galerie: ein Versuch je Foto, `onLoad` gibt ihn wieder frei,
 * ein Foto ohne Adresse ruft nie. Gemessen war das bis zum Rueckweg der
 * Leitung vom 13.09.2026 nur fuer die Galerie
 * (`Bildergalerie.render.test.tsx`) - dort nimmt die Ansicht den Rueckruf
 * als Requisite entgegen, und ein Test kann ihn hineinreichen.
 *
 * Hier liegt der Fall anders, und das ist der eigentliche Grund fuer die
 * Datei: Der Schaukasten holt `fotoNachsignieren` DIREKT aus dem Speicher
 * (`ProfilSchaukasten.tsx:10`, mit Begruendung im Kopf der Datei) - er hat
 * genau einen Aufrufer und keinen Vorschau-Fall. Damit gibt es keine Naht,
 * durch die ein Test einen Spion reichen koennte; die einzige Naht ist das
 * MODUL. Deshalb `vi.mock` statt einer Requisite - nicht, weil der Speicher
 * zu schwer zu laden waere, sondern weil das die Stelle ist, an der diese
 * Ansicht ihren Rueckruf bekommt.
 *
 * Was hier NICHT gemessen wird: was `fotoNachsignieren` selbst tut. Das
 * steht in `store/communityProfile.test.ts`. Diese Datei misst
 * ausschliesslich, OB und WIE OFT die Ansicht sie ruft - und mit welchem
 * Argument (dem `path`, nicht der `id`: der Speicher signiert Pfade nach).
 *
 * Umgebung als Docblock in Zeile 1, `cleanup` in `afterEach`: dasselbe
 * Vorgehen und derselbe Grund wie in `Bildergalerie.render.test.tsx` und
 * `components/layout/Seitenkopf.render.test.tsx` - ohne `globals: true`
 * (nachgesehen in vite.config.ts, dort steht unter `test` nur `exclude`)
 * meldet @testing-library/react sein Aufraeumen nicht selbst an.
 */

/**
 * Der Speicher als Modul ersetzt, nicht nachgebaut.
 *
 * Der Schaukasten importiert aus `store/communityProfile` genau zwei Dinge:
 * die Typen (`CommunityProfil`, `ProfilFoto`, `CommunityStats` - beim
 * Uebersetzen entfernt, zur Laufzeit nicht vorhanden) und die Funktion
 * `fotoNachsignieren`. Kein Hook, kein Zustand. Die Fabrik bildet deshalb
 * genau diese eine Funktion ab; alles Weitere waere Erfindung.
 *
 * Nebenwirkung, die den Test erst schnell macht: Der echte Speicher zieht
 * beim Laden `lib/supabase`, `store/feed`, `lib/dateiAblegen`,
 * `lib/eigeneKennung` und `lib/kontoZustand` nach und meldet sich am Ende
 * per `speicherAnmelden` beim Abmelde-Ereignis an. Nichts davon wird hier
 * geladen.
 */
vi.mock('../../store/communityProfile', () => ({
  fotoNachsignieren: vi.fn(),
}))

const nachsignieren = vi.mocked(fotoNachsignieren)

beforeEach(() => {
  nachsignieren.mockClear()
})

afterEach(() => {
  cleanup()
})

/**
 * Zwei Fotos: eines mit abgelaufener Adresse, eines ohne Adresse.
 *
 * `position` steht ausdruecklich dran, weil der Schaukasten selbst danach
 * sortiert (`fotos.slice().sort(...)`, ProfilSchaukasten.tsx:43) - die
 * Reihenfolge in `getAllByRole('img')` ist damit die hier gesetzte und
 * nicht die Reihenfolge des Feldes.
 */
const MIT_ADRESSE: ProfilFoto = {
  id: 'foto-1',
  user_id: 'nutzer-1',
  path: 'nutzer-1/profil-1.jpg',
  position: 0,
  url: 'https://beispiel.test/profil-1.jpg?token=abgelaufen',
}

const OHNE_ADRESSE: ProfilFoto = {
  id: 'foto-2',
  user_id: 'nutzer-1',
  path: 'nutzer-1/profil-2.jpg',
  position: 1,
  url: null,
}

/**
 * Die uebrigen Requisiten interessieren hier nicht und stehen deshalb an
 * einer Stelle: Name, Datum, Profil und Zahlen aendern an der
 * Fehler-Verdrahtung nichts. `profil`/`stats` bleiben `null`, damit der
 * Baum klein bleibt; `fotos` ist das Einzige, was je Fall wechselt.
 */
function schaukasten(fotos: ProfilFoto[]) {
  const { container } = render(
    <ProfilSchaukasten
      name="Testperson"
      avatarPfad={null}
      dabeiSeit={null}
      profil={null}
      fotos={fotos}
      stats={null}
      eigenes={false}
    />,
  )
  /**
   * Warum `querySelectorAll` und nicht `getAllByRole('img')`.
   *
   * Nachgemessen, nicht angenommen: Mit `getAllByRole('img')` fielen die
   * ersten zwei Faelle dieser Datei mit "Unable to find an accessible
   * element with the role img" - der dritte (zwei Fotos) lief. Der Grund
   * steht in ProfilSchaukasten.tsx:100: `alt` ist NUR bei mehr als einem
   * Foto ein Text ("Foto 1 von 2"), bei genau einem Foto ist es `''`. Ein
   * `<img alt="">` ist nach ARIA ausdruecklich dekorativ und traegt die
   * Rolle `presentation`, nicht `img`.
   *
   * Das ist richtig so und wird hier deshalb nicht umgangen, sondern
   * beruecksichtigt: Ein einzelnes Profilfoto neben dem Namen derselben
   * Person sagt einem Screenreader nichts, was er nicht schon hat. Eine
   * Abfrage ueber die Rolle wuerde diese Ansicht zwingen, ihre
   * Zugaenglichkeit fuer den Test zu aendern - also fragt der Test die
   * Elemente ab, um die es ihm geht.
   *
   * Der Baum enthaelt in diesen Faellen keine weiteren `<img>`: Der
   * `Avatar`-Zweig steht im `else` von `sortiert.length > 0`
   * (ProfilSchaukasten.tsx:82/113) und kommt nie in den Baum, solange Fotos
   * uebergeben werden.
   */
  return Array.from(container.querySelectorAll('img'))
}

describe('ProfilSchaukasten: onError laesst genau einmal nachsignieren', () => {
  it('ein Foto mit Adresse ruft bei Fehlschlag genau einmal - mit seinem Pfad', () => {
    const [foto] = schaukasten([MIT_ADRESSE])

    fireEvent.error(foto)
    // Der zweite und dritte Fehlschlag desselben Fotos: Auch die frische
    // Adresse traegt nicht. Ohne Sperre signierte die Seite im Kreis,
    // solange sie offen liegt.
    fireEvent.error(foto)
    fireEvent.error(foto)

    expect(nachsignieren.mock.calls).toEqual([['nutzer-1/profil-1.jpg']])
  })

  it('nach einem geladenen Foto steht der eine Versuch erneut zu', () => {
    const [foto] = schaukasten([MIT_ADRESSE])

    fireEvent.error(foto)
    expect(nachsignieren.mock.calls).toEqual([['nutzer-1/profil-1.jpg']])

    // `onLoad` ist der Beleg, dass die neue Adresse getragen hat - und die
    // laeuft ihrerseits nach einer Stunde ab. Erst danach darf dasselbe
    // Foto wieder nachsignieren.
    fireEvent.load(foto)
    fireEvent.error(foto)
    expect(nachsignieren.mock.calls).toEqual([
      ['nutzer-1/profil-1.jpg'],
      ['nutzer-1/profil-1.jpg'],
    ])

    // Ohne zwischenzeitliches Laden bleibt es bei den zwei Aufrufen.
    fireEvent.error(foto)
    fireEvent.error(foto)
    expect(nachsignieren.mock.calls).toEqual([
      ['nutzer-1/profil-1.jpg'],
      ['nutzer-1/profil-1.jpg'],
    ])
  })

  it('ein Foto ohne Adresse ruft nie - nur das mit Adresse ruft', () => {
    const [mitAdresse, ohneAdresse] = schaukasten([MIT_ADRESSE, OHNE_ADRESSE])

    // Ohne Adresse steht kein `src`, der Browser holt nichts, und es gibt
    // nichts nachzusignieren (Befund 9 der Pruefung vom 13.09.2026). Ein
    // Foto, das nie eine Adresse hatte, kann keine abgelaufene haben.
    fireEvent.error(ohneAdresse)
    fireEvent.error(ohneAdresse)
    expect(nachsignieren).toHaveBeenCalledTimes(0)

    // Gegenprobe im selben Baum: Am Rueckruf selbst liegt es nicht.
    fireEvent.error(mitAdresse)
    expect(nachsignieren.mock.calls).toEqual([['nutzer-1/profil-1.jpg']])
  })
})
