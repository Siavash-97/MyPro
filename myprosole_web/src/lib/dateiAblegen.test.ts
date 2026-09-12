import { describe, it, expect } from 'vitest'
import { dateiMitZeile, verwaisteDateien, type Ablage } from './dateiAblegen'

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

/**
 * Die Naht, die bis zum 08.09.2026 keine Runde gesehen hat.
 *
 * `fehler` ist Text; ein Text hat keinen `code` und kein `statusCode`. Wer
 * ihn uebersetzt, bekommt `unbekannt` - `zu-gross` und `format-abgelehnt`
 * haetten nie entstehen koennen (docs/authhindernis-entwurf.md,
 * "Nachgesehen vor 4c"). Deshalb faehrt das Objekt jetzt neben dem Text mit,
 * und diese zwei Faelle belegen, dass es die Strecke wirklich zuruecklegt.
 */
describe('dateiMitZeile: das rohe Fehlerobjekt', () => {
  it('reicht beim gescheiterten Hochladen das Objekt der Ablage durch', async () => {
    const storageFehler = {
      name: 'StorageApiError',
      message: 'The object exceeded the maximum allowed size',
      status: 400,
      statusCode: '413',
      code: 'EntityTooLarge',
    }
    const ablage: Ablage = {
      async hochladen() {
        return { fehler: storageFehler.message, roh: storageFehler }
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
        zeileSchreiben: async () => ({ data: null, error: null }),
      },
      ablage,
    )

    // `toBe`, nicht `toEqual`: Eine gleich aussehende Kopie wuerde die Naht
    // nicht belegen. Genau dieses Objekt muss ankommen.
    expect(ergebnis.roh).toBe(storageFehler)
    // Der Text bleibt daneben, unveraendert - die drei anderen Aufrufer
    // lesen weiter nur ihn.
    expect(ergebnis.fehler).toBe(storageFehler.message)
  })

  it('reicht bei gescheiterter Zeile das Fehlerobjekt aus zeileSchreiben durch', async () => {
    const zeilenFehler = { message: 'permission denied for table profiles', code: '42501' }

    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'avatars',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei: new Blob(['x'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => ({ data: null, error: zeilenFehler }),
      },
      ablageDieGelingt(),
    )

    expect(ergebnis.roh).toBe(zeilenFehler)
    // Der zusammengesetzte Text bleibt, wie er war: message samt Code.
    expect(ergebnis.fehler).toBe('permission denied for table profiles (42501)')
  })

  /**
   * Die Zusicherung, ohne die das Feld gefaehrlicher waere als kein Feld:
   * `fehler !== null` heisst `roh !== null`.
   *
   * Warum sie hier stehen MUSS, und nicht beim Aufrufer: `ablageHindernis`
   * und `profilHindernis` lesen ein `null` als "kein Hindernis"
   * (`hindernis.ts`, `merkmale(null)` gibt `null`). Ein `Ergebnis` mit Text,
   * aber ohne Objekt, wuerde beim Uebersetzen also zu "hat geklappt" - ein
   * Fehlschlag, der als Erfolg ankommt. Ein Rueckfall beim Aufrufer wuerde
   * das verdecken; hier wird es geschlossen, einmal, fuer alle vier.
   *
   * Zwei Wege fuehren hinein, deshalb zwei Faelle.
   */
  it('fuellt roh selbst, wenn der Satz aus diesem Modul stammt (leerer Praefix)', async () => {
    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'avatars',
        praefix: '',
        datei: new Blob(['x'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => ({ data: null, error: null }),
      },
      ablageDieGelingt(),
    )

    expect(ergebnis.fehler).not.toBeNull()
    expect(ergebnis.roh).toBeInstanceOf(Error)
    expect((ergebnis.roh as Error).message).toBe(ergebnis.fehler)
  })

  it('fuellt roh selbst, wenn die Ablage es weglaesst', async () => {
    // Erlaubt: `roh` ist in `Ablage` optional, damit die anderen Aufrufer
    // und die Nachbauten unveraendert bleiben. Das Modul gleicht es aus,
    // statt die Luecke weiterzureichen.
    const ablage: Ablage = {
      async hochladen() {
        return { fehler: 'x' }
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
        zeileSchreiben: async () => ({ data: null, error: null }),
      },
      ablage,
    )

    expect(ergebnis.roh).toBeInstanceOf(Error)
    expect((ergebnis.roh as Error).message).toBe('x')
  })

  it('fuellt roh selbst, wenn zeileSchreiben einen Nullwert wirft', async () => {
    // Der dritte Weg, gefunden beim Bau von 4c (08.09.2026): `throw null`
    // liesse `fehler` auf "null" und `roh` auf null - ein Text ohne Objekt,
    // und `ablageHindernis(null)` hiesse "kein Hindernis". Aus keiner der
    // vier Aufrufstellen erreichbar; die Zusicherung gilt trotzdem ganz,
    // nicht bis auf einen Fall.
    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'avatars',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei: new Blob(['x'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => {
          throw null
        },
      },
      ablageDieGelingt(),
    )

    expect(ergebnis.fehler).toBe('null')
    expect(ergebnis.roh).toBeInstanceOf(Error)
    expect((ergebnis.roh as Error).message).toBe(ergebnis.fehler)
  })
})

/**
 * B1 der Durchsicht vom 08.09.2026: die zwei Tore entschieden am TEXT.
 *
 * `if (hochladen)` und `if (fehler)` sind Wahrheitswerte auf einer
 * Zeichenfolge - und `''` ist falsch. Genau diese Gestalt baut postgrest-js
 * bei leerem Antwortkoerper (`dist/index.cjs`, Nicht-OK-Zweig:
 * `{ message: '' }`), und storage-js kann sie ebenso liefern. Ergebnis vor
 * der Reparatur: kein Zurueckrollen, `pfad !== null`, `fehler` falsy - fuer
 * `setAvatar` ein Erfolg, der das ALTE Profilbild loeschte, waehrend die
 * Zeile nie geschrieben wurde.
 *
 * Der Vertrag sagt es seit dem 06.09.2026 (docs/authhindernis-entwurf.md,
 * Abschnitt 10; Kopf von `lib/hindernis.ts`): "Ob ein Hindernis vorliegt,
 * entscheidet die Existenz des Fehlerobjekts, nicht sein Inhalt." An diesen
 * beiden Toren war er nicht eingeloest.
 *
 * OHNE Code in beiden Faellen: mit Code waere der zusammengesetzte Text
 * " (PGRST…)" und damit wahr - der Fall verschwaende sich selbst.
 */
describe('dateiMitZeile: die Existenz entscheidet, nicht der Text', () => {
  it('laesst die Zeile aus, wenn das Hochladen mit leerem Text scheitert', async () => {
    let zeileVersucht = false
    const ablage: Ablage = {
      async hochladen() {
        return { fehler: '' }
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

    // Nichts liegt im Behaelter - eine Zeile zeigte auf eine Datei, die es
    // nicht gibt.
    expect(zeileVersucht).toBe(false)
    // `pfad === null` ist zugleich die Phasenauskunft an den Aufrufer
    // (`store/auth.ts`): gescheitert VOR der Zeile, also Storage-Fachgebiet.
    expect(ergebnis.pfad).toBeNull()
    // Die Zusicherung gilt auch hier: Text da (leer), Objekt da.
    expect(ergebnis.roh).toBeInstanceOf(Error)
  })

  it('rollt zurueck, wenn die Zeile ein leeres Fehlerobjekt liefert', async () => {
    // Die Gestalt von postgrest-js bei leerem Antwortkoerper, unveraendert.
    const zeilenFehler = { message: '', code: undefined }
    const ablage = ablageDieGelingt()

    const ergebnis = await dateiMitZeile(
      {
        behaelter: 'avatars',
        praefix: 'a0000000-0000-0000-0000-000000000000',
        datei: new Blob(['x'], { type: 'image/png' }),
        rueckfallEndung: 'jpg',
        rueckfallTyp: 'image/jpeg',
        zeileSchreiben: async () => ({ data: null, error: zeilenFehler }),
      },
      ablage,
    )

    expect(ablage.entfernt).toEqual(ablage.hochgeladen)
    // `toBe`: genau dieses Objekt, damit der Aufrufer es uebersetzen kann.
    expect(ergebnis.roh).toBe(zeilenFehler)
    // Und der Text bleibt leer - er wird nicht erfunden. Nicht `null`:
    // `null` hiesse "kein Fehler", und genau das war der Schaden.
    expect(ergebnis.fehler).toBe('')
  })

  it('merkt die liegengebliebene Datei, wenn das Wegraeumen leer scheitert', async () => {
    // Dasselbe Tor, dieselbe Klasse, derselbe Tag: Das dritte
    // Wahrheitswert-Tor stand am Ergebnis des WEGRAEUMENS. Scheitert das
    // mit leerer Meldung, liegt eine Datei ohne Zeile im Behaelter - und
    // niemand erfaehrt es, weil `verwaisteDateien()` leer bleibt und
    // `verwaisterPfad` `null` meldet. Genau die Schweige-Fehlerart, gegen
    // die es diese Liste ueberhaupt gibt.
    const ablage: Ablage = {
      async hochladen() {
        return { fehler: null }
      },
      async entfernen() {
        return { fehler: '' }
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
    expect(verwaisteDateien().map((eintrag) => eintrag.pfad)).toContain(ergebnis.pfad)
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
