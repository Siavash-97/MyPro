import { create } from 'zustand'
import { BleClient, numberToUUID, ScanMode } from '@capacitor-community/bluetooth-le'

/**
 * Verbindung zu Bluetooth-Geraeten.
 *
 * Was hier generisch ist und was nicht
 * ------------------------------------
 * Das Geruest – Suchen, Verbinden, Trennen, Werte abonnieren – ist bei
 * jedem Bluetooth-LE-Geraet gleich. Die Daten sind es nicht: Ein Geraet
 * bietet "Dienste" mit Kennungen an, und nur ein Teil davon ist genormt.
 *
 * Genormt und herstellerunabhaengig:
 *   0x180D Herzfrequenz  – Brustgurte, Uhren im Sendemodus
 *   0x180F Akkustand
 *
 * Nicht genormt: die kommende Einlage. Sie bekommt einen eigenen Dienst mit
 * eigener Kennung, und dessen Format legen wir selbst fest. Deshalb steht
 * hier bewusst kein "verbinde mit der Einlage" – das waere geraten. Wenn
 * die Firmware da ist, kommt ein Dienst dazu; das Geruest bleibt.
 *
 * Was hier NICHT herkommt
 * -----------------------
 * Die Aktivitaetsdaten von Smartwatches – Schlaf, Trainings, Schritte des
 * Tages. Garmin, Polar und Apple geben die nicht ueber Bluetooth heraus.
 * Der Weg dorthin ist Health Connect (Android) beziehungsweise HealthKit
 * (iPhone). Ueber Bluetooth kommt von einer Uhr hoechstens die
 * Herzfrequenz im Sendemodus – und die ist genau der genormte Dienst oben.
 */

/** Genormte Dienste. Die Zahlen stehen so in der Bluetooth-Spezifikation. */
const DIENST_HERZFREQUENZ = numberToUUID(0x180d)
const WERT_HERZFREQUENZ = numberToUUID(0x2a37)
const DIENST_AKKU = numberToUUID(0x180f)
const WERT_AKKU = numberToUUID(0x2a19)

export interface GefundenesGeraet {
  deviceId: string
  name: string | null
  /** Bietet es den genormten Herzfrequenz-Dienst an? */
  kannPuls: boolean
  /**
   * Signalstaerke in dBm, oder null wenn das Telefon keine liefert.
   *
   * Der staerkste gemessene Wert, nicht der letzte: Die Staerke schwankt
   * von Aussendung zu Aussendung um zehn und mehr dB, je nachdem ob gerade
   * ein Koerper oder eine Wand dazwischen war. Der staerkste Wert ist der
   * mit dem freiesten Weg – und damit der ehrlichste Anhaltspunkt fuer die
   * Entfernung.
   */
  rssi: number | null
  /**
   * Wie oft sich das Geraet waehrend der Suche gemeldet hat.
   *
   * Das ist der Unterschied zwischen "steht hier" und "kam vorbei". Ein
   * Geraet, mit dem man sich verbinden kann, sendet unablaessig – alle paar
   * Zehntelsekunden, solange die Suche laeuft. Ein einzelnes Telegramm von
   * einer wechselnden Adresse taucht einmal auf und nie wieder; genau das
   * sind die Eintraege, die es "nicht gibt".
   */
  meldungen: number
  /** Sendet es ueberhaupt eine Dienstkennung mit? */
  hatDienste: boolean
}

/** Warum es gerade nicht geht – damit die Seite es benennen kann. */
export type BluetoothHindernis = 'aus' | 'keine-erlaubnis' | 'geht-nicht' | null

/**
 * Ab wie vielen Meldungen ein namenloses Geraet als vorhanden gilt.
 *
 * Zwei genuegt: Wer zweimal innerhalb derselben Suche unter derselben
 * Adresse sendet, hat keine wechselnde. Hoeher anzusetzen wuerde sparsame
 * Geraete wegwerfen, die nur jede Sekunde senden.
 */
const MELDUNGEN_MINDESTENS = 2

/**
 * Ist das ein Geraet, mit dem man etwas anfangen kann?
 *
 * Gemessen am Telefon: Eine Suche findet zwei Dutzend Funkkontakte, davon
 * zwei mit Namen – und vier der namenlosen standen auf "ganz nah". Eine
 * Entfernungsschwelle allein raeumt die also nicht weg; sie sind wirklich
 * im Raum. Es sind nur keine Geraete im Sinne von "damit verbinde ich
 * mich": Kopfhoerer im Suchruf ihres Herstellers, Fernseher, fremde
 * Telefone, Schluesselfinder.
 *
 * Drei Merkmale unterscheiden sie, alle drei aus dem Funktelegramm selbst:
 *
 *   Name       – wer sich vorstellt, will gefunden werden
 *   Dienste    – wer eine Dienstkennung mitsendet, bietet etwas an
 *   Bestaendig – wer bleibt, hat eine feste Adresse
 *
 * Ein Name allein genuegt. Ohne Namen muessen die beiden anderen
 * zusammenkommen. Die kommende Einlage erfuellt alle drei – sie bekommt
 * Namen und eigene Dienstkennung –, faellt hier also nie durchs Raster.
 */
export function istBrauchbar(g: GefundenesGeraet): boolean {
  if (g.name) return true
  return g.hatDienste && g.meldungen >= MELDUNGEN_MINDESTENS
}

interface BluetoothState {
  bereit: boolean
  /** Woran es liegt, wenn nichts geht. Null heisst: kein Hindernis. */
  hindernis: BluetoothHindernis
  suchtGerade: boolean
  gefunden: GefundenesGeraet[]
  verbundenMit: GefundenesGeraet | null
  /** Letzter gemessener Puls, oder null wenn nichts verbunden ist. */
  herzfrequenz: number | null
  /** Liefert das verbundene Geraet Herzfrequenz? Sonst ist es nur verbunden. */
  liefertPuls: boolean
  akkustand: number | null
  fehler: string | null

  vorbereiten: () => Promise<string | null>
  /** Bittet Android, Bluetooth einzuschalten (nur Android). */
  einschalten: () => Promise<string | null>
  suchen: (sekunden?: number) => Promise<void>
  verbinden: (geraet: GefundenesGeraet) => Promise<string | null>
  trennen: () => Promise<void>
}

/**
 * Der Puls steht im zweiten Byte, wenn das erste Bit des ersten Bytes 0 ist –
 * sonst in Byte 2 und 3 als 16-Bit-Wert. So steht es in der Spezifikation
 * des Dienstes; ohne diese Unterscheidung liest man bei manchen Geraeten
 * Unsinn.
 */
function herzfrequenzLesen(daten: DataView): number {
  const flags = daten.getUint8(0)
  const sechzehnBit = (flags & 0x01) !== 0
  return sechzehnBit ? daten.getUint16(1, true) : daten.getUint8(1)
}

/**
 * Die laufende Zaehlung waehrend einer Suche – bewusst neben dem Zustand.
 *
 * Mit allowDuplicates meldet Android jede einzelne Aussendung. Bei zwei
 * Dutzend Geraeten sind das in acht Sekunden schnell tausend Meldungen.
 * Jede davon sofort in den Zustand zu schreiben hiesse tausend
 * Neuzeichnungen der Liste – die Suche wuerde ruckeln, und genau das soll
 * sie nicht. Hier wird gezaehlt, in den Zustand geht es im Takt.
 */
const zaehlung = new Map<string, GefundenesGeraet>()

export const useBluetooth = create<BluetoothState>((set, get) => ({
  bereit: false,
  hindernis: null,
  suchtGerade: false,
  gefunden: [],
  verbundenMit: null,
  herzfrequenz: null,
  liefertPuls: false,
  akkustand: null,
  fehler: null,

  vorbereiten: async () => {
    try {
      // Fragt beim ersten Mal nach der Erlaubnis. Der Dialog gehoert an
      // diese Stelle: ausgeloest durch einen Druck, nicht durch das blosse
      // Oeffnen einer Seite.
      await BleClient.initialize({ androidNeverForLocation: true })
    } catch (e) {
      // Hier landet vor allem die abgelehnte Erlaubnis.
      set({ bereit: false, hindernis: 'keine-erlaubnis', fehler: (e as Error).message })
      return 'keine-erlaubnis'
    }

    // Erlaubnis heisst noch nicht eingeschaltet. Das war der eigentliche
    // Grund, warum die Suche still nichts fand: Bluetooth war am Telefon
    // aus, und die App sagte es nicht.
    try {
      const an = await BleClient.isEnabled()
      if (!an) {
        set({ bereit: false, hindernis: 'aus', fehler: null })
        return 'aus'
      }
    } catch {
      // Manche Geraete beantworten die Frage nicht. Dann wird es beim
      // Suchen scheitern, und dort steht die Meldung.
    }

    set({ bereit: true, hindernis: null, fehler: null })
    return null
  },

  /**
   * Bittet Android, Bluetooth einzuschalten.
   *
   * Nur auf Android moeglich – das iPhone erlaubt keiner App, Bluetooth zu
   * schalten. Dort bleibt der Hinweis, es von Hand zu tun.
   *
   * Der Dialog, der dabei erscheint, gehoert Android und nicht uns: Seit
   * Android 13 laesst sich Bluetooth nicht mehr stillschweigend
   * einschalten, die Nachfrage ist Vorschrift. (BluetoothAdapter.enable()
   * gibt es noch, es scheitert aber ab Ziel-Version 33 – unsere ist 36.)
   * Gestalten laesst sich deshalb alles davor und danach, nicht die
   * Nachfrage selbst.
   */
  einschalten: async () => {
    try {
      await BleClient.requestEnable()
      return await get().vorbereiten()
    } catch {
      return 'aus'
    }
  },

  suchen: async (sekunden = 8) => {
    if (get().suchtGerade) return
    zaehlung.clear()
    set({ suchtGerade: true, gefunden: [], fehler: null })

    const takt = setInterval(() => set({ gefunden: [...zaehlung.values()] }), 400)

    try {
      // Ohne Dienstfilter: Es wird alles empfangen, was in Reichweite
      // sendet.
      //
      // Vorher stand hier ein Filter auf den Herzfrequenz-Dienst. Der war
      // fuer den Zweck "Puls messen" richtig, fuer den Zweck "ein Geraet
      // verbinden" falsch: Er versteckte jede Uhr, die gerade nicht sendet,
      // und liess die Suche leer aussehen, obwohl Geraete da waren.
      //
      // Aussortiert wird stattdessen hinterher, an dem was gemessen wurde –
      // siehe istBrauchbar. Der Unterschied ist wichtig: Ein Filter im
      // Funk wirft weg, bevor man weiss was es war; hinterher laesst sich
      // dieselbe Messung auch wieder vollstaendig anzeigen.
      await BleClient.requestLEScan(
        {
          // Jede Aussendung melden, nicht nur die erste. Das kostet nichts
          // und bringt zweierlei: Man sieht, wer bleibt und wer nur
          // vorbeikam – und ein Name, der erst im zweiten Telegramm steht,
          // geht nicht mehr verloren.
          allowDuplicates: true,
          // Waehrend jemand auf die Liste schaut, darf die Suche den
          // Funkteil voll auslasten. Im ausgeglichenen Modus – der
          // Voreinstellung – laesst Android den Empfaenger zwischendurch
          // schlafen; Geraete tauchen dann spaeter oder gar nicht auf.
          scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
        },
        (ergebnis) => {
          const id = ergebnis.device.deviceId
          const dienste = ergebnis.uuids ?? []
          // Manche Geraete tragen ihren Namen nur im Funktelegramm
          // (localName) statt im Geraeteeintrag.
          const name = ergebnis.device.name ?? ergebnis.localName ?? null
          const kannPuls = dienste.some(
            (u) => u.toLowerCase() === DIENST_HERZFREQUENZ.toLowerCase(),
          )
          // 127 ist kein Messwert, sondern Androids Angabe "unbekannt".
          const rssi =
            typeof ergebnis.rssi === 'number' && ergebnis.rssi !== 127 ? ergebnis.rssi : null

          const bisher = zaehlung.get(id)
          if (!bisher) {
            zaehlung.set(id, {
              deviceId: id,
              name,
              kannPuls,
              rssi,
              meldungen: 1,
              hatDienste: dienste.length > 0,
            })
            return
          }
          // Nie zuruecknehmen, was ein frueheres Telegramm schon verraten
          // hat: Ein Geraet sendet Name und Dienste nicht in jeder
          // Aussendung mit. Wuerde hier ueberschrieben, verloere ein
          // benanntes Geraet seinen Namen wieder.
          zaehlung.set(id, {
            ...bisher,
            name: bisher.name ?? name,
            kannPuls: bisher.kannPuls || kannPuls,
            hatDienste: bisher.hatDienste || dienste.length > 0,
            rssi: rssi === null ? bisher.rssi : Math.max(rssi, bisher.rssi ?? -999),
            meldungen: bisher.meldungen + 1,
          })
        },
      )

      await new Promise((r) => setTimeout(r, sekunden * 1000))
    } catch (e) {
      set({ fehler: (e as Error).message })
    } finally {
      // Ins finally, nicht in den Ablauf: Scheitert etwas nach dem Start,
      // liefe die Suche sonst weiter und zoege Akku, ohne dass jemand
      // davon weiss. Ein Stoppen ohne laufende Suche ist harmlos.
      clearInterval(takt)
      try { await BleClient.stopLEScan() } catch { /* lief gar nicht */ }
      set({ gefunden: [...zaehlung.values()], suchtGerade: false })
    }
  },

  verbinden: async (geraet) => {
    try {
      // onDisconnect: Bricht die Verbindung ab – Gurt verrutscht, Batterie
      // leer, zu weit weg –, muss die Anzeige das zeigen, statt den letzten
      // Wert stehen zu lassen. Ein eingefrorener Puls waere schlimmer als
      // gar keiner.
      await BleClient.connect(geraet.deviceId, () => {
        set({ verbundenMit: null, herzfrequenz: null, liefertPuls: false, akkustand: null })
      })

      // Herzfrequenz nur versuchen. Bietet das Geraet den Dienst nicht an,
      // ist die Verbindung trotzdem gelungen – sie liefert dann eben noch
      // keine Werte. Ein Fehler waere hier irrefuehrend: Verbunden ist
      // verbunden.
      try {
        await BleClient.startNotifications(
          geraet.deviceId,
          DIENST_HERZFREQUENZ,
          WERT_HERZFREQUENZ,
          (daten) => set({ herzfrequenz: herzfrequenzLesen(daten) }),
        )
        set({ liefertPuls: true })
      } catch {
        set({ liefertPuls: false })
      }

      // Akkustand einmalig. Nicht jedes Geraet bietet ihn an – dann bleibt
      // das Feld leer, und das ist kein Fehler.
      try {
        const akku = await BleClient.read(geraet.deviceId, DIENST_AKKU, WERT_AKKU)
        set({ akkustand: akku.getUint8(0) })
      } catch {
        set({ akkustand: null })
      }

      set({ verbundenMit: geraet, fehler: null })
      return null
    } catch (e) {
      const meldung = (e as Error).message
      set({ fehler: meldung, verbundenMit: null })
      return meldung
    }
  },

  trennen: async () => {
    const geraet = get().verbundenMit
    if (!geraet) return
    try {
      await BleClient.disconnect(geraet.deviceId)
    } catch {
      // Schon getrennt – das Ergebnis ist dasselbe.
    }
    set({ verbundenMit: null, herzfrequenz: null, liefertPuls: false, akkustand: null })
  },
}))
