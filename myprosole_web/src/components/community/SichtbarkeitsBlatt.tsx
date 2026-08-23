import { useEffect, useState } from 'react'
import Blatt from '../ui/Blatt'
import Icon from '../ui/Icon'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useSnackbar } from '../ui/Snackbar'
import { useEinwilligung } from '../../store/einwilligung'
import { useZusammenlauf } from '../../store/zusammenlauf'

/**
 * Das Blatt vor dem Einschalten von "Sichtbar fuer ZusammenLauf".
 *
 * Der Schalter allein waere keine Einwilligung: Wer zustimmt, muss den
 * Wortlaut GESEHEN haben, dem er zustimmt (Massstab von Migration 0034,
 * Art. 7 DSGVO). Deshalb schaltet nicht der Schalter, sondern der Knopf
 * unter diesem Text - und ohne hinterlegten Wortlaut (Migration 0053 noch
 * nicht eingespielt) laesst sich nichts einschalten: Der Store weigert
 * sich, und dieses Blatt sagt vorher, warum.
 *
 * Ausschalten braucht kein Blatt - einen Schutz zurueckzunehmen ist keine
 * Einwilligung, sondern ein Widerruf, und der ist immer sofort erlaubt.
 */
export default function SichtbarkeitsBlatt({
  offen,
  onSchliessen,
}: {
  offen: boolean
  onSchliessen: () => void
}) {
  const showSnackbar = useSnackbar()
  const geladen = useEinwilligung((s) => s.geladen)
  const laedt = useEinwilligung((s) => s.laedt)
  const textFehler = useEinwilligung((s) => s.fehler)
  const laden = useEinwilligung((s) => s.laden)
  const aktuellerText = useEinwilligung((s) => s.aktuellerText)
  const sichtbarkeitSetzen = useZusammenlauf((s) => s.sichtbarkeitSetzen)
  const [speichert, setSpeichert] = useState(false)

  // Erst beim Oeffnen nachladen - wer das Blatt nie oeffnet, holt auch
  // nichts.
  useEffect(() => {
    if (offen && !geladen) void laden()
  }, [offen, geladen, laden])

  const text = aktuellerText('zusammenlauf')

  const bestaetigen = async () => {
    setSpeichert(true)
    await sichtbarkeitSetzen(true)
    setSpeichert(false)
    const { sichtbar, fehler } = useZusammenlauf.getState()
    if (sichtbar && !fehler) {
      showSnackbar('Du bist jetzt für ZusammenLauf sichtbar.')
      onSchliessen()
      return
    }
    // Blatt bleibt offen: Die Person wollte einschalten, und es hat nicht
    // geklappt - Schliessen saehe aus wie Erfolg.
    showSnackbar('Einschalten fehlgeschlagen: ' + (fehler ?? 'Unbekannter Fehler'))
  }

  return (
    <Blatt
      offen={offen}
      onSchliessen={onSchliessen}
      titel={text?.titel ?? 'Sichtbar für ZusammenLauf'}
    >
      {text ? (
        <>
          <p className="md-wortlaut">{text.wortlaut}</p>
          <div className="md-aktions-zeile">
            <button
              type="button"
              className="md-button md-button--outlined"
              disabled={speichert}
              onClick={onSchliessen}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="md-button md-button--filled"
              disabled={speichert}
              onClick={bestaetigen}
            >
              {speichert ? 'Wird gespeichert…' : 'Einwilligen'}
            </button>
          </div>
        </>
      ) : laedt ? (
        <LoadingSpinner />
      ) : (
        <div className="md-info-note">
          <Icon name="warn" size={20} className="icon icon-sm" />
          <p>
            Der Einwilligungstext konnte nicht geladen werden
            {textFehler ? ` (${textFehler})` : ''} – ohne ihn lässt sich die
            Sichtbarkeit nicht einschalten. Versuche es später noch einmal.
          </p>
        </div>
      )}
    </Blatt>
  )
}
