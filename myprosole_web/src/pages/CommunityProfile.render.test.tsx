// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ProfilFoto } from '../store/communityProfile'
import { fotoNachsignieren } from '../store/communityProfile'
import CommunityProfile from './CommunityProfile'

/**
 * Dieselbe Frage wie in `components/community/ProfilSchaukasten.render.
 * test.tsx`, nur an der ZWEITEN Stelle, an der Profilfotos haengen.
 *
 * Warum es zwei Dateien braucht
 * -----------------------------
 * Die Seite zeigt Fotos auf zwei Wegen, und beide haben ihre eigene
 * Verdrahtung:
 *
 *  - Der Schaukasten (`ProfilSchaukasten.tsx:63`) - das fremde Profil und
 *    die Vorschau. Grosses Bild, zum Ansehen.
 *  - Die KACHELN (`CommunityProfile.tsx:170`, gerendert ab Zeile 523) - das
 *    eigene Profil im Bearbeiten-Zustand. Kleine Quadrate zum Entfernen und
 *    Hinzufuegen.
 *
 * Beide fuehren einen eigenen `versucht`-Merker, und der Kommentar in
 * CommunityProfile.tsx:152 sagt ausdruecklich, warum sie getrennt bleiben:
 * Sie stehen nie gleichzeitig und zaehlen jeweils ihre EIGENEN
 * `<img>`-Knoten. Getrennte Verdrahtung heisst getrennt gemessen - ein
 * gruener Schaukasten sagt ueber die Kacheln nichts.
 *
 * Umgebung als Docblock in Zeile 1, `cleanup` in `afterEach`: Vorbild
 * `pages/Training.render.test.tsx` (dort auch die Begruendung fuer beides).
 */

/**
 * Zwei Speicher als MODUL ersetzt, nichts sonst - und warum das reicht.
 *
 * Die Seite importiert fuenfzehn Dinge (CommunityProfile.tsx:1-15).
 * Gemockt sind genau zwei davon, beide Speicher. Die uebrigen brauchen es
 * nachweislich nicht:
 *
 *  - `lib/supabase` wird an genau EINER Stelle benutzt (Zeile 246, der
 *    Kopf-Abruf aus `profiles`), und dieser Zweig steigt vier Zeilen vorher
 *    aus, wenn es das EIGENE Profil ist und der Auth-Speicher ein Profil
 *    fuehrt (Zeile 236). Genau so steht der Nachbau unten. Das Modul wird
 *    geladen, aber kein Aufruf geht hinaus.
 *  - `useSnackbar` braucht keinen Anbieter: `SnackbarContext` hat als
 *    Vorgabe eine leere Funktion (`components/ui/Snackbar.tsx:9`), der
 *    Aufruf ausserhalb des Anbieters ist also still und nicht fehlerhaft.
 *  - `lib/blockieren` und `lib/profilFragen` werden erst beim Antippen
 *    gebraucht bzw. sind reine Funktionen.
 *  - `useParams` liefert ohne Route kein `id`; der Router steht trotzdem
 *    da, weil `useNavigate` (Zeile 107) ausserhalb eines Routers wirft.
 *
 * `MemoryRouter` ohne `Routes`: Kein `id` heisst `eigenes === true`
 * (Zeile 105) - und das ist genau der Zustand, in dem die Kacheln stehen.
 */
const authState = {
  user: { id: 'nutzer-1' },
  profile: {
    id: 'nutzer-1',
    display_name: 'Testperson',
    avatar_url: null,
    created_at: '2026-08-01T00:00:00.000Z',
  },
}

vi.mock('../store/auth', () => ({
  // Die Seite ruft `useAuth` NUR mit Selektor (Zeilen 102 und 103), nie
  // ohne. Der Nachbau bildet genau das ab.
  useAuth: (auswahl: (s: typeof authState) => unknown) => auswahl(authState),
}))

/**
 * Der Nachbau des Profil-Speichers.
 *
 * `fotos` wird je Test MUTIERT, nicht neu zugewiesen - derselbe Grund wie in
 * Training.render.test.tsx: Die `vi.mock`-Aufrufe werden vor die Importe
 * gehoben, aber die Fabrik unten fasst `profilState` nicht an; erst die
 * zurueckgegebenen Funktionen lesen es, und die laufen beim Rendern.
 *
 * `getState` steht daneben, weil die Seite es an einer Stelle ohne Hook
 * braucht: `useCommunityProfil.getState().fehler` (Zeile 216).
 */
const profilState = {
  profil: null,
  fotos: [] as ProfilFoto[],
  stats: null,
  laedt: false,
  fehler: null as string | null,
  laden: vi.fn(),
  speichern: vi.fn(),
  fotoHinzufuegen: vi.fn(),
  fotoEntfernen: vi.fn(),
  einstellungen: null,
  einstellungenLaden: vi.fn(),
  einstellungenSpeichern: vi.fn(),
}

vi.mock('../store/communityProfile', () => ({
  useCommunityProfil: Object.assign(() => profilState, { getState: () => profilState }),
  // Die Seite liest sie nur, um selbst eingetragene Sportarten von den
  // vorgegebenen zu trennen (Zeile 264). Ein Eintrag genuegt dafuer.
  SPORTARTEN: ['Radfahren'],
  fotoNachsignieren: vi.fn(),
}))

const nachsignieren = vi.mocked(fotoNachsignieren)

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

beforeEach(() => {
  nachsignieren.mockClear()
  profilState.fotos = []
})

afterEach(() => {
  cleanup()
})

/**
 * Die Kacheln tragen `alt=""` (CommunityProfile.tsx:539) und sind damit
 * ausdruecklich dekorativ - die Beschriftung steht am umgebenden Knopf
 * ("Foto entfernen"). Ein `<img alt="">` traegt nach ARIA die Rolle
 * `presentation`, nicht `img`; `getAllByRole('img')` faende hier nichts.
 * Gemessen, nicht vermutet: Genau daran fielen die ersten zwei Faelle der
 * Schwesterdatei, bevor sie auf diese Abfrage umgestellt wurden.
 *
 * Weitere `<img>` stehen nicht im Baum: Der `Avatar` im Kopf loest nur dann
 * ein Bild auf, wenn ein Pfad da ist (`components/ui/Avatar.tsx:32`) - im
 * Nachbau oben ist `avatar_url` deshalb `null`.
 */
function kacheln(fotos: ProfilFoto[]) {
  profilState.fotos = fotos
  const { container } = render(
    <MemoryRouter>
      <CommunityProfile />
    </MemoryRouter>,
  )
  return Array.from(container.querySelectorAll('img'))
}

describe('CommunityProfile: die Foto-Kacheln signieren genau einmal nach', () => {
  it('eine Kachel mit Adresse ruft bei Fehlschlag genau einmal - mit ihrem Pfad', () => {
    const [kachel] = kacheln([MIT_ADRESSE])

    fireEvent.error(kachel)
    // Auch die frische Adresse traegt nicht: ohne Sperre signierte die
    // Seite im Kreis, solange sie offen liegt.
    fireEvent.error(kachel)
    fireEvent.error(kachel)

    expect(nachsignieren.mock.calls).toEqual([['nutzer-1/profil-1.jpg']])
  })

  it('nach einer geladenen Kachel steht der eine Versuch erneut zu', () => {
    const [kachel] = kacheln([MIT_ADRESSE])

    fireEvent.error(kachel)
    expect(nachsignieren.mock.calls).toEqual([['nutzer-1/profil-1.jpg']])

    // `onLoad` ist der Beleg, dass die neue Adresse getragen hat - und auch
    // die laeuft nach einer Stunde ab.
    fireEvent.load(kachel)
    fireEvent.error(kachel)
    expect(nachsignieren.mock.calls).toEqual([
      ['nutzer-1/profil-1.jpg'],
      ['nutzer-1/profil-1.jpg'],
    ])

    // Ohne zwischenzeitliches Laden bleibt es bei den zwei Aufrufen.
    fireEvent.error(kachel)
    fireEvent.error(kachel)
    expect(nachsignieren.mock.calls).toEqual([
      ['nutzer-1/profil-1.jpg'],
      ['nutzer-1/profil-1.jpg'],
    ])
  })

  it('eine Kachel ohne Adresse ruft nie - nur die mit Adresse ruft', () => {
    const [mitAdresse, ohneAdresse] = kacheln([MIT_ADRESSE, OHNE_ADRESSE])

    fireEvent.error(ohneAdresse)
    fireEvent.error(ohneAdresse)
    expect(nachsignieren).toHaveBeenCalledTimes(0)

    // Gegenprobe im selben Baum: Am Rueckruf selbst liegt es nicht.
    fireEvent.error(mitAdresse)
    expect(nachsignieren.mock.calls).toEqual([['nutzer-1/profil-1.jpg']])
  })
})
