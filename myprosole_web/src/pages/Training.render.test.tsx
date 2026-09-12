// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EMPTY_WEEK } from '../lib/runningPlan'
import type { WeekPlan } from '../lib/runningPlan'

/**
 * Nachbau der vier Stores, die Training.tsx liest.
 *
 * Umgebung und `cleanup`-Pflicht wie in Seitenkopf.render.test.tsx: Docblock
 * in Zeile 1 statt vite.config.ts (die uebrigen Testdateien laufen unter
 * "node" und bleiben schneller), `cleanup` in afterEach, weil ohne
 * `globals: true` niemand sonst aufraeumt.
 *
 * Training.tsx ruft useRun() und useRunningPlan() OHNE Selektor auf - die
 * Rueckgabe wird direkt destrukturiert (`const { recentRuns, fetchRecentRuns }
 * = useRun()`). useWorkout() und useExercises() dagegen NUR mit Selektor
 * (`useWorkout((s) => s.mikroroutinenDieseWoche)`). Der Nachbau bildet genau
 * das ab, statt einen gemeinsamen Selektor-Mechanismus fuer alle vier zu
 * erfinden, der in Training.tsx gar nicht gebraucht wird.
 *
 * Ein echter Store-Import (`create<RunState>()` aus store/run.ts) ist hier
 * bewusst NICHT der Weg: run.ts allein zieht ueber eigeneKennung()
 * store/auth.ts nach, dazu aufzeichnungBruecke, punktePuffer, punkteSenden,
 * laufMerker, ruhepegelSpeicher (siehe deren Mock-Liste in
 * store/bergung.test.ts, sechs vi.mock-Aufrufe allein fuer diesen einen
 * Store) - weit mehr als die vier Stores und den Router, die dieser Auftrag
 * erlaubt. Der Nachbau ersetzt die vier Store-MODULE direkt, bevor
 * Training.tsx sie importiert, und keiner ihrer echten Abhaengigkeiten wird
 * je geladen.
 *
 * Die vier Fixtures stehen aussen und werden je Test MUTIERT, nicht neu
 * zugewiesen: Die `vi.mock`-Aufrufe werden vor die Imports gehoben, aber die
 * hier uebergebenen Fabriken lesen `runState` & Co. erst, wenn der jeweilige
 * Hook beim Rendern wirklich aufgerufen wird - lange nach dieser Deklaration.
 * Die Fabrik selbst (die aeussere Funktion) fasst die Fixtures nicht an,
 * genau deshalb ist die Zugriffsreihenfolge unkritisch.
 */
interface RunFake {
  recentRuns: { status: string; started_at: string; distance_km: number | null }[]
  fetchRecentRuns: (limit?: number) => void
}
const runState: RunFake = { recentRuns: [], fetchRecentRuns: vi.fn() }

interface RunningPlanFake {
  plan: WeekPlan
  fetchPlan: () => void
}
const runningPlanState: RunningPlanFake = { plan: { ...EMPTY_WEEK }, fetchPlan: vi.fn() }

interface WorkoutFake {
  mikroroutinenDieseWoche: number
  fetchMikroroutinenAb: (ab: Date) => void
}
const workoutState: WorkoutFake = { mikroroutinenDieseWoche: 0, fetchMikroroutinenAb: vi.fn() }

interface ExercisesFake {
  // Leer gehalten und bewusst NICHT in einem Test befuellt: Sobald
  // `groups` Eintraege haette, zeigte Training.tsx zusaetzlich den Katalog
  // und den Einlagen-Hinweis (`gruppen.length > 0`) - beides gehoert nicht
  // zu diesem Auftrag, der dem Laufplan-Zugang gilt.
  groups: { id: string; name_de: string; lead_de: string }[]
  fetchReferenceData: () => void
  uebungenDerGruppe: (groupId: string) => unknown[]
}
const exercisesState: ExercisesFake = {
  groups: [],
  fetchReferenceData: vi.fn(),
  uebungenDerGruppe: () => [],
}

vi.mock('../store/run', () => ({
  useRun: () => runState,
}))
vi.mock('../store/runningPlan', () => ({
  useRunningPlan: () => runningPlanState,
}))
vi.mock('../store/workout', () => ({
  useWorkout: (selector: (s: WorkoutFake) => unknown) => selector(workoutState),
}))
vi.mock('../store/exercises', () => ({
  useExercises: (selector: (s: ExercisesFake) => unknown) => selector(exercisesState),
}))

import Training from './Training'

function renderTraining() {
  return render(
    <MemoryRouter>
      <Training />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  runState.recentRuns = []
  runningPlanState.plan = { ...EMPTY_WEEK }
  workoutState.mikroroutinenDieseWoche = 0
  exercisesState.groups = []
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Training-Tab: Zugang zum Laufplan ohne bestehenden Plan', () => {
  it('zeigt ohne Plan einen Link "Laufplan anlegen" auf /training/laufplan', () => {
    // hasPlan(EMPTY_WEEK) ist false, also planExists === false. Geprueft
    // wird Training.tsx Zeile 67, `{!planExists && (...)}`: Nur DIESER
    // Zweig traegt den Link "Laufplan anlegen" (Zeile 77-79).
    renderTraining()

    const link = screen.getByRole('link', { name: 'Laufplan anlegen' })
    expect(link.getAttribute('href')).toBe('/training/laufplan')
  })

  it('zeigt mit Plan keinen "Laufplan anlegen"-Link mehr, sondern "Plan bearbeiten"', () => {
    // Ein einziger Tag mit Kilometern genuegt fuer hasPlan() === true
    // (lib/runningPlan.ts, hasPlan: "sobald an mindestens einem Tag
    // Kilometer stehen"). planExists wird damit true, der Zweig aus dem
    // ersten Fall verschwindet, und der `planExists && (...)`-Zweig
    // (Zeile 86ff.) mit "Plan bearbeiten" (Zeile 124-126) erscheint
    // stattdessen.
    runningPlanState.plan = { ...EMPTY_WEEK, mo: '5' }

    renderTraining()

    expect(screen.queryByRole('link', { name: 'Laufplan anlegen' })).toBeNull()
    const bearbeiten = screen.getByRole('link', { name: 'Plan bearbeiten' })
    expect(bearbeiten.getAttribute('href')).toBe('/training/laufplan')
  })
})
