import { create } from 'zustand'
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le'

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
}

interface BluetoothState {
  bereit: boolean
  suchtGerade: boolean
  gefunden: GefundenesGeraet[]
  verbundenMit: GefundenesGeraet | null
  /** Letzter gemessener Puls, oder null wenn nichts verbunden ist. */
  herzfrequenz: number | null
  akkustand: number | null
  fehler: string | null

  vorbereiten: () => Promise<string | null>
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

export const useBluetooth = create<BluetoothState>((set, get) => ({
  bereit: false,
  suchtGerade: false,
  gefunden: [],
  verbundenMit: null,
  herzfrequenz: null,
  akkustand: null,
  fehler: null,

  vorbereiten: async () => {
    try {
      await BleClient.initialize({ androidNeverForLocation: true })
      set({ bereit: true, fehler: null })
      return null
    } catch (e) {
      // Bluetooth aus, Berechtigung abgelehnt, oder das Geraet kann es
      // nicht. Alles drei endet hier, und alles drei heisst fuer die App
      // dasselbe: Es geht gerade nicht.
      const meldung = (e as Error).message
      set({ bereit: false, fehler: meldung })
      return meldung
    }
  },

  suchen: async (sekunden = 8) => {
    if (get().suchtGerade) return
    set({ suchtGerade: true, gefunden: [], fehler: null })

    try {
      // Nur Geraete mit Herzfrequenz-Dienst. Ohne diesen Filter steht in der
      // Liste jeder Kopfhoerer und jeder Fernseher in der Wohnung.
      await BleClient.requestLEScan({ services: [DIENST_HERZFREQUENZ] }, (ergebnis) => {
        const neu = { deviceId: ergebnis.device.deviceId, name: ergebnis.device.name ?? null }
        set((s) =>
          s.gefunden.some((g) => g.deviceId === neu.deviceId)
            ? s
            : { gefunden: [...s.gefunden, neu] },
        )
      })

      await new Promise((r) => setTimeout(r, sekunden * 1000))
    } catch (e) {
      set({ fehler: (e as Error).message })
    } finally {
      // Ins finally, nicht in den Ablauf: Scheitert etwas nach dem Start,
      // liefe die Suche sonst weiter und zoege Akku, ohne dass jemand
      // davon weiss. Ein Stoppen ohne laufende Suche ist harmlos.
      try { await BleClient.stopLEScan() } catch { /* lief gar nicht */ }
      set({ suchtGerade: false })
    }
  },

  verbinden: async (geraet) => {
    try {
      // onDisconnect: Bricht die Verbindung ab – Gurt verrutscht, Batterie
      // leer, zu weit weg –, muss die Anzeige das zeigen, statt den letzten
      // Wert stehen zu lassen. Ein eingefrorener Puls waere schlimmer als
      // gar keiner.
      await BleClient.connect(geraet.deviceId, () => {
        set({ verbundenMit: null, herzfrequenz: null, akkustand: null })
      })

      await BleClient.startNotifications(
        geraet.deviceId,
        DIENST_HERZFREQUENZ,
        WERT_HERZFREQUENZ,
        (daten) => set({ herzfrequenz: herzfrequenzLesen(daten) }),
      )

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
    set({ verbundenMit: null, herzfrequenz: null, akkustand: null })
  },
}))
