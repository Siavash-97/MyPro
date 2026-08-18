import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useConsent } from '../store/consent'
import { useAnamnese } from '../store/anamnese'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useSnackbar } from '../components/ui/Snackbar'
import { schrittMerken, gemerkterSchritt, schrittVergessen } from '../lib/anamneseSpaeter'

type StepId =
  | 'ankuendigung'
  | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8'
  | 'd1' | 'd2' | 'd3' | 'd4' | 'd5'
  | 'a9' | 'a10'
  | 'plan-fertig'
  | 'b1' | 'b2'
  | 'abschluss'

/**
 * Alle Schritte in ihrer festen Reihenfolge. Jeder Weg durch die Anamnese
 * besucht eine Teilmenge davon, immer in dieser Reihenfolge – uebersprungene
 * Schritte werden ausgelassen, nie vorgezogen.
 */
const ALL_STEPS: StepId[] = [
  'ankuendigung',
  'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8',
  'd1', 'd2', 'd3', 'd4', 'd5',
  'a9', 'a10',
  'plan-fertig',
  'b1', 'b2',
  'abschluss',
]

/**
 * Der Fortschritt ist die Position in dieser festen Reihenfolge. Damit kann
 * die Leiste nicht mehr zurueckspringen.
 *
 * Zwei fruehere Versuche gingen schief: eine handgepflegte Tabelle (dort stand
 * d5 bei 66 und das folgende a9 bei 63) und die Position im aktuellen Pfad
 * (der Pfad waechst um fuenf Schritte, sobald jemand Schmerzen angibt – der
 * Nenner aenderte sich also mitten im Ablauf). Eine feste Reihenfolge hat
 * beide Probleme nicht.
 */
function progressFor(step: StepId): number {
  const idx = ALL_STEPS.indexOf(step)
  if (idx < 0) return 0
  return Math.round((idx / (ALL_STEPS.length - 1)) * 100)
}

export default function Anamnese() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const blockBOnly = searchParams.get('teil') === 'b'

  const { hasActiveConsent, grantConsent, fetchConsents, loading: consentLoading } = useConsent()
  const {
    fetchSessions, fetchAnswers, startSession, completeSession, saveAnswer,
    hasCompletedBlock,
  } = useAnamnese()

  const showSnackbar = useSnackbar()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [step, setStep] = useState<StepId>(blockBOnly ? 'b1' : 'ankuendigung')
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [consentGranting, setConsentGranting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      await fetchConsents()
      await fetchSessions()

      // Dort weitermachen, wo man aufgehoert hat.
      //
      // Die Antworten lagen schon in der Datenbank – sie werden bei jedem
      // "Weiter" gespeichert. Geholt wurden sie beim Oeffnen nur nie, und
      // die Stelle im Ablauf war ueberhaupt nicht gemerkt. Deshalb begann
      // alles wieder von vorn, obwohl nichts verlorengegangen war.
      const offen = useAnamnese.getState().sessions.find(
        (s) => s.block === (blockBOnly ? 'b' : 'a') && s.completed_at === null,
      )
      if (offen) {
        setSessionId(offen.id)
        await fetchAnswers(offen.id)

        const gespeichert = useAnamnese.getState().answers.get(offen.id) ?? []
        const zurueck: Record<string, string[]> = {}
        for (const a of gespeichert) {
          zurueck[a.question_key] = [...(zurueck[a.question_key] ?? []), a.answer_value]
        }
        setAnswers(zurueck)

        const schritt = gemerkterSchritt(offen.id)
        if (schritt && ALL_STEPS.includes(schritt as StepId)) setStep(schritt as StepId)
      }

      setInitialized(true)
    }
    init()
  }, [fetchConsents, fetchSessions, fetchAnswers, blockBOnly])

  const hasConsent = hasActiveConsent('anamnese')
  const blockADone = hasCompletedBlock('a')

  // Scheitert das Speichern, muss man das sehen. Vorher wurde der Rueckgabewert
  // verworfen – der Knopf sprang zurueck auf "Einwilligung erteilen" und sonst
  // geschah nichts, ohne jeden Hinweis warum.
  const handleGrantConsent = async () => {
    setConsentGranting(true)
    const fehler = await grantConsent('anamnese')
    setConsentGranting(false)
    if (fehler) showSnackbar('Einwilligung konnte nicht gespeichert werden: ' + fehler)
  }

  const currentBlock = useMemo<'a' | 'b'>(() => {
    if (step.startsWith('b') || step === 'abschluss' && blockBOnly) return 'b'
    return 'a'
  }, [step, blockBOnly])

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId
    const s = await startSession(currentBlock)
    if (s) {
      setSessionId(s.id)
      return s.id
    }
    return null
  }, [sessionId, currentBlock, startSession])

  const setAnswer = (key: string, values: string[]) => {
    setAnswers((prev) => ({ ...prev, [key]: values }))
  }

  const toggleMulti = (key: string, value: string) => {
    setAnswers((prev) => {
      const current = prev[key] ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  const setSingle = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: [value] }))
  }

  const getStepSequence = useCallback((): StepId[] => {
    if (blockBOnly) return ['b1', 'b2', 'abschluss']

    const seq: StepId[] = ['ankuendigung', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']

    if (answers['andere-sportarten']?.[0] === 'ja') seq.push('a7')

    seq.push('a8')

    if (answers['schmerzen']?.[0] === 'ja') {
      seq.push('d1', 'd2', 'd3', 'd4', 'd5')
    }

    seq.push('a9', 'a10', 'plan-fertig')

    // Block B gehoert mit in die Folge, auch wenn man ihn erst am Ende
    // waehlt. Fehlte er, fand "Weiter" den Schritt b1 nicht und sprang zum
    // allerersten Bildschirm zurueck.
    seq.push('b1', 'b2', 'abschluss')
    return seq
  }, [answers, blockBOnly])

  const handleNext = async () => {
    const seq = getStepSequence()
    const idx = seq.indexOf(step)

    // Save answers for question steps
    const sid = await ensureSession()
    if (sid && step !== 'ankuendigung' && step !== 'plan-fertig' && step !== 'abschluss') {
      setSaving(true)
      const questionKeys = getQuestionKeysForStep(step)
      for (const key of questionKeys) {
        if (answers[key]?.length) {
          await saveAnswer(sid, key, answers[key])
        }
      }
      setSaving(false)
    }

    if (idx < seq.length - 1) {
      const naechster = seq[idx + 1]
      setStep(naechster)
      if (sid) schrittMerken(sid, naechster)
    }
  }

  const handleBlockBChoice = async (choice: 'jetzt' | 'spaeter' | 'nein') => {
    // Complete block A session
    if (sessionId) {
      await completeSession(sessionId)
      schrittVergessen(sessionId)
    }

    if (choice === 'jetzt') {
      setSessionId(null)
      setStep('b1')
    } else {
      if (choice === 'spaeter') {
        localStorage.setItem('myprosole_blockb_reminder', 'true')
      }
      navigate('/')
    }
  }

  const handleFinish = async () => {
    if (sessionId) {
      await completeSession(sessionId)
      schrittVergessen(sessionId)
    }
    navigate('/')
  }

  const progress = progressFor(step)

  if (!initialized || consentLoading) return <LoadingSpinner />

  if (!hasConsent) {
    return (
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="rounded-xl bg-surface-container p-5">
          <div className="flex items-start gap-3 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-primary shrink-0 mt-0.5">
              <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5z" />
            </svg>
            <div>
              <h2 className="text-base font-medium text-on-surface mb-1">
                Einwilligung erforderlich
              </h2>
              <p className="md-anamnese__lead">
                Die Anamnese erfasst Gesundheitsdaten (Schmerzen, Verletzungen, körperliche Angaben).
                Gemäß DSGVO Art. 9 benötigen wir deine ausdrückliche Einwilligung.
                Deine Daten werden verschlüsselt gespeichert und nur für deine Übungs- und Planauswahl verwendet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGrantConsent}
            disabled={consentGranting}
            className="md-button md-button--filled md-anamnese__next"
          >
            {consentGranting ? 'Wird gespeichert…' : 'Einwilligung erteilen'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/profil')}
            className="w-full h-10 mt-2 rounded-full text-on-surface-variant text-sm"
          >
            Zurück
          </button>
        </div>
      </div>
    )
  }

  if (blockBOnly && blockADone && hasCompletedBlock('b')) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-12">
        <p className="md-anamnese__question">Anamnese vollständig</p>
        <p className="text-sm text-on-surface-variant text-center">
          Du hast beide Blöcke bereits ausgefüllt.
        </p>
        <button
          type="button"
          onClick={() => navigate('/profil')}
          className="md-button md-button--filled"
        >
          Zum Profil
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const seq = getStepSequence()
            const idx = seq.indexOf(step)
            if (idx > 0) {
              const vorheriger = seq[idx - 1]
              setStep(vorheriger)
              if (sessionId) schrittMerken(sessionId, vorheriger)
            } else {
              // Am Anfang fuehrt Zurueck hinaus. navigate(-1) landete hier
              // wieder, weil der Waechter sofort zurueckschickte.
              navigate('/profil')
            }
          }}
          className="p-1 text-on-surface shrink-0"
          aria-label="Zurück"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
        </button>
        <div className="flex-1 h-1 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col gap-4 px-4 py-4 overflow-y-auto">
        {step === 'ankuendigung' && (
          <StepAnnouncement onNext={handleNext} />
        )}
        {step === 'a1' && <StepA1 value={answers['ziel']?.[0]} onChange={(v) => setSingle('ziel', v)} />}
        {step === 'a2' && (
          <StepA2
            wiedereinstieg={answers['wiedereinstieg']?.[0]}
            pauseDauer={answers['pause-dauer']?.[0]}
            pauseGrund={answers['pause-grund']?.[0] ?? ''}
            onChange={(k, v) => setSingle(k, v)}
            onChangeText={(k, v) => setAnswer(k, [v])}
          />
        )}
        {step === 'a3' && (
          <StepA3
            laufeWoche={answers['laufe-woche']?.[0] ?? '3'}
            kmLauf={answers['km-lauf']?.[0] ?? '5'}
            onChange={(k, v) => setAnswer(k, [v])}
          />
        )}
        {step === 'a4' && <StepA4 value={answers['training-gesamt']?.[0]} onChange={(v) => setSingle('training-gesamt', v)} />}
        {step === 'a5' && (
          <StepA5
            kraftAktuell={answers['kraft-aktuell']?.[0] ?? '0'}
            kraftWunsch={answers['kraft-wunsch']?.[0] ?? '1'}
            onChange={(k, v) => setAnswer(k, [v])}
          />
        )}
        {step === 'a6' && (
          <StepA6
            andereSportarten={answers['andere-sportarten']?.[0]}
            sportarten={answers['sportart'] ?? []}
            onChangeAndereSportarten={(v) => setSingle('andere-sportarten', v)}
            onToggleSportart={(v) => toggleMulti('sportart', v)}
          />
        )}
        {step === 'a7' && <StepA7 value={answers['beschwerden-anderswo']?.[0]} onChange={(v) => setSingle('beschwerden-anderswo', v)} />}
        {step === 'a8' && <StepA8 value={answers['schmerzen']?.[0]} onChange={(v) => setSingle('schmerzen', v)} />}
        {step === 'd1' && <StepD1 values={answers['stelle'] ?? []} onToggle={(v) => toggleMulti('stelle', v)} />}
        {step === 'd2' && <StepD2 value={answers['seit-wann']?.[0]} onChange={(v) => setSingle('seit-wann', v)} />}
        {step === 'd3' && (
          <StepD3
            wann={answers['wann']?.[0]}
            abKm={answers['ab-km']?.[0] ?? '5'}
            onChange={(k, v) => setAnswer(k, [v])}
            onChangeSingle={(k, v) => setSingle(k, v)}
          />
        )}
        {step === 'd4' && <StepD4 value={answers['verlauf']?.[0]} onChange={(v) => setSingle('verlauf', v)} />}
        {step === 'd5' && <StepD5 value={answers['umgang']?.[0]} onChange={(v) => setSingle('umgang', v)} />}
        {step === 'a9' && (
          <StepA9
            operationen={answers['operationen']?.[0]}
            opDetails={answers['op-details']?.[0] ?? ''}
            onChange={(v) => setSingle('operationen', v)}
            onChangeText={(v) => setAnswer('op-details', [v])}
          />
        )}
        {step === 'a10' && (
          <StepA10
            geschlecht={answers['geschlecht']?.[0]}
            groesse={answers['groesse']?.[0] ?? ''}
            gewicht={answers['gewicht']?.[0] ?? ''}
            onChangeSingle={(k, v) => setSingle(k, v)}
            onChangeText={(k, v) => setAnswer(k, [v])}
          />
        )}
        {step === 'plan-fertig' && <StepPlanFertig onChoice={handleBlockBChoice} />}
        {step === 'b1' && <StepB1 values={answers['dranbleiben'] ?? []} onToggle={(v) => toggleMulti('dranbleiben', v)} />}
        {step === 'b2' && <StepB2 value={answers['schlaf']?.[0]} onChange={(v) => setSingle('schlaf', v)} />}
        {step === 'abschluss' && <StepAbschluss onFinish={handleFinish} blockBOnly={blockBOnly} />}
      </div>

      {/* Footer button for question steps */}
      {step !== 'ankuendigung' && step !== 'plan-fertig' && step !== 'abschluss' && (
        <div className="px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="md-button md-button--filled md-anamnese__next"
          >
            {saving ? 'Wird gespeichert…' : 'Weiter'}
          </button>
        </div>
      )}
    </div>
  )
}

function getQuestionKeysForStep(step: StepId): string[] {
  const map: Record<string, string[]> = {
    a1: ['ziel'],
    a2: ['wiedereinstieg', 'pause-dauer', 'pause-grund'],
    a3: ['laufe-woche', 'km-lauf'],
    a4: ['training-gesamt'],
    a5: ['kraft-aktuell', 'kraft-wunsch'],
    a6: ['andere-sportarten', 'sportart'],
    a7: ['beschwerden-anderswo'],
    a8: ['schmerzen'],
    d1: ['stelle'],
    d2: ['seit-wann'],
    d3: ['wann', 'ab-km'],
    d4: ['verlauf'],
    d5: ['umgang'],
    a9: ['operationen', 'op-details'],
    a10: ['geschlecht', 'groesse', 'gewicht'],
    b1: ['dranbleiben'],
    b2: ['schlaf'],
  }
  return map[step] ?? []
}

/* ── Reusable micro-components ─────────────────────────────── */

/*
 * Die Bausteine der Anamnese, jetzt mit den Klassen des Entwurfs statt mit
 * eigenen Tailwind-Kombinationen. Das Aussehen kommt damit aus
 * components.css, wie auf jeder anderen Seite auch.
 *
 * Die Auswahl steckt wie im Entwurf in einem versteckten Radio im Label –
 * das CSS faerbt ueber :has(input:checked). Ein <button> mit aria-checked
 * saehe gleich aus, waere aber ein anderes Bedienelement: Ein Radio kennt
 * seine Gruppe, laesst sich mit den Pfeiltasten durchgehen und wird von
 * Screenreadern als "eins von mehreren" angesagt.
 */

function ChipRadio({ name, value, selected, onChange, children }: {
  name: string; value: string; selected: boolean; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <label className="md-choice-chip">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      {children}
    </label>
  )
}

function ChoiceCard({ name, value, selected, onChange, title, desc }: {
  name: string; value: string; selected: boolean; onChange: (v: string) => void; title: string; desc?: string
}) {
  return (
    <label className="md-choice-card md-anamnese__option">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      <span className="md-choice-card__title">{title}</span>
      {desc && <span className="md-choice-card__desc">{desc}</span>}
    </label>
  )
}

function Stepper({ value, onChange, min, max, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; label: string
}) {
  const id = `stepper-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="md-anamnese__stepper-row">
      <span className="md-anamnese__sublabel" id={id}>{label}</span>
      <div className="md-stepper" role="group" aria-labelledby={id}>
        <button
          className="md-stepper__btn"
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label="Weniger"
        >
          −
        </button>
        <output className="md-stepper__value">{value}</output>
        <button
          className="md-stepper__btn"
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="Mehr"
        >
          +
        </button>
      </div>
    </div>
  )
}

function WhyNote({ children }: { children: React.ReactNode }) {
  return <p className="md-anamnese__why">{children}</p>
}

/* ── Step components ───────────────────────────────────────── */

function StepAnnouncement({ onNext }: { onNext: () => void }) {
  return (
    <div className="md-anamnese__step">
      <h1 className="md-anamnese__title">
        Lass uns deinen Laufplan erstellen
      </h1>
      <p className="md-anamnese__lead">
        Das dauert nur 3–5 Minuten. Wir fragen dich nach deinem Laufpensum und
        eventuellen Beschwerden – danach ist dein Plan startklar.
      </p>
      <div className="flex items-start gap-2 rounded-xl bg-surface-container p-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant shrink-0 mt-0.5">
          <path d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z" />
        </svg>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Danach gibt es noch 2 freiwillige Fragen zu Motivation und
          Regeneration (ca. 30 Sekunden) – aber nur, wenn du willst.
          Du kannst sie auch jederzeit später in deinem Profil nachholen.
        </p>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="md-button md-button--filled md-anamnese__next"
      >
        Weiter
      </button>
    </div>
  )
}

function StepA1({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const opts = [
    { value: 'schmerzfrei', title: 'Schmerzfrei laufen' },
    { value: 'wiedereinstieg', title: 'Wiedereinstieg nach Pause' },
    { value: 'steigern', title: 'Distanz oder Zeit steigern' },
    { value: 'fitter', title: 'Allgemein fitter werden' },
    { value: 'wettkampf', title: 'Auf einen Wettkampf hin' },
  ]
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Was ist dein Ziel?</h2>
      <div className="md-choice-cards">
        {opts.map((o) => (
          <ChoiceCard key={o.value} name="ziel" value={o.value} selected={value === o.value} onChange={onChange} title={o.title} />
        ))}
      </div>
      <WhyNote>Dein Ziel steuert, ob dein Plan Schmerzfreiheit oder Leistung in den Vordergrund stellt.</WhyNote>
    </div>
  )
}

function StepA2({ wiedereinstieg, pauseDauer, pauseGrund, onChange, onChangeText }: {
  wiedereinstieg?: string; pauseDauer?: string; pauseGrund: string
  onChange: (key: string, v: string) => void
  onChangeText: (key: string, v: string) => void
}) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Ist das gerade ein Wiedereinstieg nach einer laufbedingten Pause?
      </h2>
      <div className="md-chip-set" role="radiogroup">
        <ChipRadio name="wiedereinstieg" value="ja" selected={wiedereinstieg === 'ja'} onChange={(v) => onChange('wiedereinstieg', v)}>Ja</ChipRadio>
        <ChipRadio name="wiedereinstieg" value="nein" selected={wiedereinstieg === 'nein'} onChange={(v) => onChange('wiedereinstieg', v)}>Nein</ChipRadio>
      </div>
      {wiedereinstieg === 'ja' && (
        <div className="flex flex-col gap-3 mt-2">
          <p className="text-xs text-on-surface-variant">Wie lange war die Pause?</p>
          <div className="md-chip-set" role="radiogroup">
            {(['unter4w', '1-6m', 'ueber6m'] as const).map((v) => (
              <ChipRadio key={v} name="pause-dauer" value={v} selected={pauseDauer === v} onChange={(val) => onChange('pause-dauer', val)}>
                {v === 'unter4w' ? 'Unter 4 Wochen' : v === '1-6m' ? '1–6 Monate' : 'Über 6 Monate'}
              </ChipRadio>
            ))}
          </div>
          <div>
            <label htmlFor="pause-grund" className="md-anamnese__sublabel">Was war der Grund? (kurz)</label>
            <input
              id="pause-grund"
              type="text"
              value={pauseGrund}
              onChange={(e) => onChangeText('pause-grund', e.target.value)}
              placeholder="z. B. Verletzung, Zeit, Motivation"
              className="md-field__input"
            />
          </div>
        </div>
      )}
      <WhyNote>Ein Wiedereinstieg bestimmt, wie behutsam dein Plan beginnt.</WhyNote>
    </div>
  )
}

function StepA3({ laufeWoche, kmLauf, onChange }: {
  laufeWoche: string; kmLauf: string; onChange: (k: string, v: string) => void
}) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Wie sieht dein Laufpensum aktuell aus?</h2>
      <Stepper label="Läufe pro Woche" value={Number(laufeWoche)} min={0} max={7}
        onChange={(v) => onChange('laufe-woche', String(v))} />
      <Stepper label="Kilometer pro Lauf (Schnitt)" value={Number(kmLauf)} min={1} max={42}
        onChange={(v) => onChange('km-lauf', String(v))} />
      <WhyNote>Dein aktuelles Pensum ist die Basis, von der aus dein Plan steigert.</WhyNote>
    </div>
  )
}

function StepA4({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const opts = ['0-1', '2-3', '4-5', '6+']
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Wie oft trainierst du insgesamt pro Woche – Laufen und alles andere zusammen?
      </h2>
      <div className="md-chip-set" role="radiogroup">
        {opts.map((o) => (
          <ChipRadio key={o} name="training-gesamt" value={o} selected={value === o} onChange={onChange}>
            {o} Tage
          </ChipRadio>
        ))}
      </div>
      <WhyNote>Deine Gesamtbelastung entscheidet, wie viel dein Plan obendrauf legen darf.</WhyNote>
    </div>
  )
}

function StepA5({ kraftAktuell, kraftWunsch, onChange }: {
  kraftAktuell: string; kraftWunsch: string; onChange: (k: string, v: string) => void
}) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Machst du aktuell Krafttraining?</h2>
      <Stepper label="Aktuell pro Woche" value={Number(kraftAktuell)} min={0} max={7}
        onChange={(v) => onChange('kraft-aktuell', String(v))} />
      <Stepper label="Künftig gewünscht pro Woche" value={Number(kraftWunsch)} min={0} max={7}
        onChange={(v) => onChange('kraft-wunsch', String(v))} />
      <WhyNote>So können wir Kraftübungen fest in deinen Laufplan einbauen.</WhyNote>
    </div>
  )
}

function StepA6({ andereSportarten, sportarten, onChangeAndereSportarten, onToggleSportart }: {
  andereSportarten?: string; sportarten: string[]
  onChangeAndereSportarten: (v: string) => void; onToggleSportart: (v: string) => void
}) {
  const sportOptions = [
    { value: 'rad', label: 'Radfahren' },
    { value: 'schwimmen', label: 'Schwimmen' },
    { value: 'ball', label: 'Ballsport' },
    { value: 'kraft', label: 'Kraftsport' },
    { value: 'sonstiges', label: 'Sonstiges' },
  ]
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Betreibst du regelmäßig andere Sportarten?</h2>
      <div className="md-chip-set" role="radiogroup">
        <ChipRadio name="andere-sportarten" value="ja" selected={andereSportarten === 'ja'} onChange={onChangeAndereSportarten}>Ja</ChipRadio>
        <ChipRadio name="andere-sportarten" value="nein" selected={andereSportarten === 'nein'} onChange={onChangeAndereSportarten}>Nein</ChipRadio>
      </div>
      {andereSportarten === 'ja' && (
        <div className="mt-2">
          <p className="text-xs text-on-surface-variant mb-2">Welche?</p>
          <div className="md-chip-set">
            {sportOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onToggleSportart(o.value)}
                className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                  sportarten.includes(o.value)
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <WhyNote>Andere Sportarten zählen zu deiner Gesamtbelastung – und helfen, Beschwerden richtig einzuordnen.</WhyNote>
    </div>
  )
}

function StepA7({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Hast du dort die gleichen Beschwerden wie beim Laufen?
      </h2>
      <div className="md-chip-set" role="radiogroup">
        <ChipRadio name="beschwerden" value="ja" selected={value === 'ja'} onChange={onChange}>Ja</ChipRadio>
        <ChipRadio name="beschwerden" value="nein" selected={value === 'nein'} onChange={onChange}>Nein</ChipRadio>
        <ChipRadio name="beschwerden" value="keine" selected={value === 'keine'} onChange={onChange}>Habe keine Beschwerden</ChipRadio>
      </div>
      <WhyNote>So unterscheiden wir, ob ein Schmerz vom Laufen selbst kommt – oder ein allgemeines körperliches Thema ist.</WhyNote>
    </div>
  )
}

function StepA8({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Hast du aktuell oder in letzter Zeit Schmerzen oder Verletzungen im Zusammenhang mit dem Laufen?
      </h2>
      <div className="md-chip-set" role="radiogroup">
        <ChipRadio name="schmerzen" value="ja" selected={value === 'ja'} onChange={onChange}>Ja</ChipRadio>
        <ChipRadio name="schmerzen" value="nein" selected={value === 'nein'} onChange={onChange}>Nein</ChipRadio>
      </div>
      <WhyNote>Das ist die wichtigste Frage für uns: Sie steuert direkt, welche Übungen dein Plan enthält – und welche nicht.</WhyNote>
    </div>
  )
}

function StepD1({ values, onToggle }: { values: string[]; onToggle: (v: string) => void }) {
  const locs = [
    { value: 'knie', label: 'Knie' },
    { value: 'sprunggelenk', label: 'Sprunggelenk/Ferse' },
    { value: 'schienbein', label: 'Schienbein' },
    { value: 'achillessehne', label: 'Achillessehne' },
    { value: 'huefte', label: 'Hüfte' },
    { value: 'ruecken', label: 'Rücken' },
    { value: 'sonstiges', label: 'Sonstiges' },
  ]
  return (
    <div className="md-anamnese__step">
      <p className="md-anamnese__lead">
        Damit wir Übungen sicher für dich auswählen können, noch ein paar Details.
      </p>
      <h2 className="md-anamnese__question">
        Welche Körperstellen sind betroffen?
      </h2>
      <div className="md-chip-set">
        {locs.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => onToggle(l.value)}
            className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
              values.includes(l.value)
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <WhyNote>Mehrere Angaben sind möglich – die Stelle entscheidet, welche Übungen gezielt helfen.</WhyNote>
    </div>
  )
}

function StepD2({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Seit wann bestehen die Beschwerden?</h2>
      <div className="md-chip-set" role="radiogroup">
        {[
          { v: 'unter4w', l: 'Unter 4 Wochen' },
          { v: '1-6m', l: '1–6 Monate' },
          { v: 'ueber6m', l: 'Über 6 Monate' },
          { v: 'wiederkehrend', l: 'Immer wiederkehrend' },
        ].map((o) => (
          <ChipRadio key={o.v} name="seit-wann" value={o.v} selected={value === o.v} onChange={onChange}>{o.l}</ChipRadio>
        ))}
      </div>
      <WhyNote>Akute und chronische Beschwerden brauchen ein unterschiedliches Vorgehen.</WhyNote>
    </div>
  )
}

function StepD3({ wann, abKm, onChange, onChangeSingle }: {
  wann?: string; abKm: string
  onChange: (k: string, v: string) => void
  onChangeSingle: (k: string, v: string) => void
}) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Wann treten die Schmerzen beim Laufen typischerweise auf?
      </h2>
      <div className="md-chip-set" role="radiogroup">
        {[
          { v: 'vorher', l: 'Schon vor dem Lauf' },
          { v: 'anfang', l: 'In den ersten Kilometern' },
          { v: 'ab-km', l: 'Ab einem bestimmten Kilometer' },
          { v: 'danach', l: 'Erst nach dem Lauf' },
          { v: 'folgetag', l: 'Erst am Folgetag' },
        ].map((o) => (
          <ChipRadio key={o.v} name="wann" value={o.v} selected={wann === o.v} onChange={(val) => onChangeSingle('wann', val)}>{o.l}</ChipRadio>
        ))}
      </div>
      {wann === 'ab-km' && (
        <div className="mt-2">
          <Stepper label="Ab ungefähr Kilometer" value={Number(abKm)} min={1} max={42}
            onChange={(v) => onChange('ab-km', String(v))} />
        </div>
      )}
      <WhyNote>Der Zeitpunkt verrät oft die Ursache – Aufwärmen, Ermüdung oder Überlastung.</WhyNote>
    </div>
  )
}

function StepD4({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Gehen die Schmerzen von selbst wieder weg?</h2>
      <div className="md-chip-set" role="radiogroup">
        {[
          { v: 'waehrend', l: 'Verschwinden während des Laufs' },
          { v: 'danach-weg', l: 'Nach dem Laufen weg' },
          { v: 'stunden-tage', l: 'Bleiben Stunden bis Tage' },
          { v: 'dauerhaft', l: 'Dauerhaft' },
        ].map((o) => (
          <ChipRadio key={o.v} name="verlauf" value={o.v} selected={value === o.v} onChange={onChange}>{o.l}</ChipRadio>
        ))}
      </div>
      <WhyNote>Ob ein Schmerz bleibt, ist ein wichtiges Warnsignal für deine Trainingssteuerung.</WhyNote>
    </div>
  )
}

function StepD5({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Wie gehst du aktuell damit um?</h2>
      <div className="md-choice-cards">
        <ChoiceCard name="umgang" value="weiter" selected={value === 'weiter'} onChange={onChange} title="Ich laufe trotzdem weiter" />
        <ChoiceCard name="umgang" value="pausiert" selected={value === 'pausiert'} onChange={onChange} title="Ich habe pausiert" />
        <ChoiceCard name="umgang" value="behandlung" selected={value === 'behandlung'} onChange={onChange}
          title="Ich bin in ärztlicher oder physiotherapeutischer Behandlung" />
      </div>
      <WhyNote>Davon hängt ab, wie vorsichtig dein Plan starten muss.</WhyNote>
    </div>
  )
}

function StepA9({ operationen, opDetails, onChange, onChangeText }: {
  operationen?: string; opDetails: string
  onChange: (v: string) => void; onChangeText: (v: string) => void
}) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Gab es frühere Operationen oder bestehende strukturelle Einschränkungen?
      </h2>
      <p className="md-anamnese__lead">
        Zum Beispiel ein Bandscheibenvorfall oder eine Kreuzband- oder Meniskus-OP.
      </p>
      <div className="md-chip-set" role="radiogroup">
        <ChipRadio name="operationen" value="ja" selected={operationen === 'ja'} onChange={onChange}>Ja</ChipRadio>
        <ChipRadio name="operationen" value="nein" selected={operationen === 'nein'} onChange={onChange}>Nein</ChipRadio>
      </div>
      {operationen === 'ja' && (
        <div className="mt-2">
          <label htmlFor="op-details" className="md-anamnese__sublabel">Was genau? (kurz)</label>
          <input
            id="op-details"
            type="text"
            value={opDetails}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="z. B. Meniskus-OP links, 2024"
            className="md-field__input"
          />
        </div>
      )}
      <WhyNote>Das ist sicherheitsrelevant für die Übungsauswahl – auch wenn gerade nichts weh tut.</WhyNote>
    </div>
  )
}

function StepA10({ geschlecht, groesse, gewicht, onChangeSingle, onChangeText }: {
  geschlecht?: string; groesse: string; gewicht: string
  onChangeSingle: (k: string, v: string) => void
  onChangeText: (k: string, v: string) => void
}) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">Zuletzt: ein paar Angaben zu dir</h2>
      <div className="md-chip-set" role="radiogroup">
        {[
          { v: 'w', l: 'Weiblich' }, { v: 'm', l: 'Männlich' },
          { v: 'd', l: 'Divers' }, { v: 'ka', l: 'Keine Angabe' },
        ].map((o) => (
          <ChipRadio key={o.v} name="geschlecht" value={o.v} selected={geschlecht === o.v} onChange={(v) => onChangeSingle('geschlecht', v)}>{o.l}</ChipRadio>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="groesse" className="md-anamnese__sublabel">Größe (cm)</label>
          <input
            id="groesse"
            type="number"
            inputMode="numeric"
            min={120}
            max={230}
            value={groesse}
            onChange={(e) => onChangeText('groesse', e.target.value)}
            placeholder="175"
            className="md-field__input"
          />
        </div>
        <div>
          <label htmlFor="gewicht" className="md-anamnese__sublabel">Gewicht (kg)</label>
          <input
            id="gewicht"
            type="number"
            inputMode="numeric"
            min={30}
            max={250}
            value={gewicht}
            onChange={(e) => onChangeText('gewicht', e.target.value)}
            placeholder="70"
            className="md-field__input"
          />
        </div>
      </div>
      <WhyNote>Diese Werte fließen als neutrale Zahlen in deine Lauf- und Belastungsanalyse ein – ohne Bewertung und ohne Kategorien.</WhyNote>
    </div>
  )
}

function StepPlanFertig({ onChoice }: { onChoice: (c: 'jetzt' | 'spaeter' | 'nein') => void }) {
  return (
    <div className="flex flex-col gap-4 items-center text-center py-4">
      <h1 className="md-anamnese__title">
        Geschafft – deine Angaben sind komplett
      </h1>
      <p className="md-anamnese__lead">
        Noch 2 kurze, freiwillige Fragen, die uns helfen, dich besser zu unterstützen?
      </p>
      <div className="flex flex-col gap-2 w-full mt-2">
        <button
          type="button"
          onClick={() => onChoice('jetzt')}
          className="md-button md-button--filled md-anamnese__next"
        >
          Jetzt machen
        </button>
        <button
          type="button"
          onClick={() => onChoice('spaeter')}
          className="md-button md-button--tonal"
        >
          Später erinnern
        </button>
        <button
          type="button"
          onClick={() => onChoice('nein')}
          className="md-button md-button--text"
        >
          Nicht interessiert
        </button>
      </div>
      <WhyNote>„Nicht interessiert" ist völlig in Ordnung – die App steht dir so oder so vollständig offen.</WhyNote>
    </div>
  )
}

function StepB1({ values, onToggle }: { values: string[]; onToggle: (v: string) => void }) {
  const opts = [
    { value: 'erinnerungen', label: 'Erinnerungen' },
    { value: 'fortschritt', label: 'Fortschritts-Tracking' },
    { value: 'nichts', label: 'Nichts Bestimmtes' },
  ]
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Was hilft dir erfahrungsgemäß am meisten, dranzubleiben?
      </h2>
      <div className="md-chip-set">
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
              values.includes(o.value)
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <WhyNote>Danach richtet sich, welche Motivations-Funktionen wir dir zeigen – und welche nicht.</WhyNote>
    </div>
  )
}

function StepB2({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="md-anamnese__step">
      <h2 className="md-anamnese__question">
        Wie viele Stunden schläfst du im Schnitt pro Nacht?
      </h2>
      <div className="md-chip-set" role="radiogroup">
        {[
          { v: 'unter6', l: 'Unter 6' },
          { v: '6-7', l: '6–7' },
          { v: '7-8', l: '7–8' },
          { v: 'ueber8', l: 'Über 8' },
        ].map((o) => (
          <ChipRadio key={o.v} name="schlaf" value={o.v} selected={value === o.v} onChange={onChange}>{o.l}</ChipRadio>
        ))}
      </div>
      <WhyNote>Dein Schlaf beeinflusst, wie viel Regeneration dein Plan einplant.</WhyNote>
    </div>
  )
}

function StepAbschluss({ onFinish, blockBOnly }: { onFinish: () => void; blockBOnly: boolean }) {
  return (
    <div className="flex flex-col gap-4 items-center text-center py-8">
      <h1 className="md-anamnese__title">
        {blockBOnly ? 'Danke dir!' : 'Dein Plan ist erstellt'}
      </h1>
      <p className="text-sm text-on-surface-variant max-w-xs">
        {blockBOnly
          ? 'Alles beisammen – dein Plan wartet auf dich.'
          : 'Aus deinem Ziel, deinem Wochenpensum und deinen Angaben zu Beschwerden haben wir deinen persönlichen Laufplan zusammengestellt – von dir mitgestaltet und auf dich zugeschnitten.'}
      </p>
      <button
        type="button"
        onClick={onFinish}
        className="h-12 px-8 rounded-full bg-primary text-on-primary font-medium mt-4"
      >
        {blockBOnly ? 'Zur App' : 'Zu deinem Plan'}
      </button>
    </div>
  )
}
