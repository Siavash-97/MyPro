import { describe, it, expect } from 'vitest'
import { dateiMitZeile, type Ablage } from './dateiAblegen'

/** Eine Ablage, die alles annimmt und mitschreibt, was sie tun sollte. */
function ablageDieGelingt(): Ablage & { hochgeladen: string[]; entfernt: string[] } {
  const hochgeladen: string[] = []
  const entfernt: string[] = []
  return {
    hochgeladen,
    entfernt,
    async hochladen(_behaelter, pfad) {
      hochgeladen.push(pfad)
      return { fehler: null }
    },
    async entfernen(_behaelter, pfad) {
      entfernt.push(pfad)
      return { fehler: null }
    },
  }
}

describe('dateiMitZeile: die Endung', () => {
  it('macht aus audio/webm;codecs=opus eine .webm-Datei, keine .jpg', () => {
    // Der Fallstrick: MediaRecorder liefert auf Android-Chrome
    // "audio/webm;codecs=opus". Wer nur an "/" trennt, bekommt
    // "webm;codecs=opus", faellt durch jede Pruefung und landet beim
    // Rueckfall - bei einer gemeinsamen Bildfunktion waere das ".jpg".
    const ablage = ablageDieGelingt()
    const aufnahme = new Blob(['ton'], { type: 'audio/webm;codecs=opus' })

    return dateiMitZeile(
      {
        behaelter: 'chat-audio',
        praefix: 'c0ffee00-0000-0000-0000-000000000000',
        datei: aufnahme,
        rueckfallEndung: 'webm',
        rueckfallTyp: 'audio/webm',
        zeileSchreiben: async () => ({ data: { id: 1 }, error: null }),
      },
      ablage,
    ).then((ergebnis) => {
      expect(ergebnis.pfad?.endsWith('.webm')).toBe(true)
      expect(ergebnis.fehler).toBeNull()
    })
  })
})

describe('dateiMitZeile: zurueckrollen', () => {
  it('raeumt die Datei weg, wenn die Zeile scheitert', async () => {
    const ablage = ablageDieGelingt()

    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'community',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei: new Blob(['bild'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => ({
          data: null,
          error: { message: 'duplicate key value', code: '23505' },
        }),
      },
      ablage,
    )

    expect(ablage.entfernt).toEqual(ablage.hochgeladen)
    expect(ergebnis.fehler).toBe('duplicate key value (23505)')
    expect(ergebnis.verwaisterPfad).toBeNull()
  })

  it('raeumt auch weg, wenn der Rueckruf eine Ausnahme wirft', async () => {
    // Der Fall, den niemand testet: kein zurueckgegebener Fehler, sondern
    // eine geworfene Ausnahme - Netz weg, Tippfehler im Aufrufer. Ohne
    // try/catch liefe die Funktion daran vorbei und liesse die Datei liegen.
    const ablage = ablageDieGelingt()

    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'community',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei: new Blob(['bild'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => {
          throw new TypeError('Failed to fetch')
        },
      },
      ablage,
    )

    expect(ablage.entfernt).toEqual(ablage.hochgeladen)
    expect(ergebnis.fehler).toContain('Failed to fetch')
  })
})

describe('dateiMitZeile: Fehler vor der Zeile', () => {
  it('schreibt keine Zeile, wenn schon das Hochladen scheitert', async () => {
    let zeileVersucht = false
    const ablage: Ablage = {
      async hochladen() {
        return { fehler: 'Payload too large (413)' }
      },
      async entfernen() {
        return { fehler: null }
      },
    }

    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'avatars',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei: new Blob(['x'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => {
          zeileVersucht = true
          return { data: null, error: null }
        },
      },
      ablage,
    )

    expect(zeileVersucht).toBe(false)
    expect(ergebnis.fehler).toBe('Payload too large (413)')
  })

  it('weist einen leeren Praefix ab, bevor irgendetwas passiert', async () => {
    // Ohne Praefix waere der erste Pfadteil die Zufallskennung. Das weist
    // jede der drei Zugriffsregeln ab - mit einer Meldung ueber
    // Zeilenrechte, die nach allem klingt ausser nach der Ursache.
    const ablage = ablageDieGelingt()

    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'avatars',
        praefix: '',
        datei: new Blob(['x'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => ({ data: null, error: null }),
      },
      ablage,
    )

    expect(ablage.hochgeladen).toEqual([])
    expect(ergebnis.fehler).toMatch(/Pr[aä]fix/)
  })

  it('nennt den verwaisten Pfad, wenn das Wegraeumen selbst scheitert', async () => {
    const ablage: Ablage = {
      async hochladen() {
        return { fehler: null }
      },
      async entfernen() {
        return { fehler: 'not found' }
      },
    }

    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'community',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei: new Blob(['x'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => ({ data: null, error: { message: 'nein' } }),
      },
      ablage,
    )

    expect(ergebnis.verwaisterPfad).toBe(ergebnis.pfad)
  })
})

describe('dateiMitZeile: Endung aus dem Dateinamen', () => {
  async function pfadFuer(datei: Blob): Promise<string | null> {
    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'community',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei,
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => ({ data: null, error: null }),
      },
      ablageDieGelingt(),
    )
    return ergebnis.pfad
  }

  it('nimmt den Dateinamen, wenn der Typ nichts hergibt', async () => {
    // Manche Android-Auswahldialoge liefern Dateien ohne Typ. Ohne diesen
    // Zweig hiesse ein HEIC-Foto ".jpg" - so lag feed.ts richtig und die
    // beiden anderen falsch.
    const pfad = await pfadFuer(new File(['x'], 'urlaub.HEIC', { type: '' }))

    expect(pfad?.endsWith('.heic')).toBe(true)
  })

  it('faellt auf die Pflichtendung zurueck, wenn auch der Name nichts hergibt', async () => {
    const pfad = await pfadFuer(new File(['x'], 'ohnepunkt', { type: '' }))

    expect(pfad?.endsWith('.jpg')).toBe(true)
  })
})
