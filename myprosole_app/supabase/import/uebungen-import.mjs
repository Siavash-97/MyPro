/**
 * Erzeugt die Migration mit den Uebungen aus free-exercise-db.
 *
 * Aufruf aus diesem Verzeichnis:
 *   node uebungen-import.mjs
 *
 * Liest:
 *   free-exercise-db-auswahl.json  Die ausgewaehlten Datensaetze der Quelle,
 *                                  unveraendert uebernommen (gemeinfrei).
 *   uebungen-de.json               Deutsche Namen und Anleitungen, von Hand
 *                                  geschrieben - keine woertliche Uebersetzung.
 *
 * Schreibt:
 *   ../migrations/0015_seed_exercises_free_db.sql
 *
 * Warum ein Skript und nicht handgeschriebenes SQL: Die Migration hat ueber
 * 200 Zeilen mit vielen Wiederholungen. Von Hand gepflegt schleichen sich
 * Fehler ein, und ein Nachtrag weiterer Uebungen waere Fleissarbeit. So ist
 * der Weg nachvollziehbar und wiederholbar.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HIER = dirname(fileURLToPath(import.meta.url))
const QUELLE = JSON.parse(readFileSync(join(HIER, 'free-exercise-db-auswahl.json'), 'utf8'))
const DEUTSCH = JSON.parse(readFileSync(join(HIER, 'uebungen-de.json'), 'utf8'))
const ZIEL = join(HIER, '..', 'migrations', '0015_seed_exercises_free_db.sql')

/** Quell-Kategorie auf unser Enum exercise_category. */
const KATEGORIE = {
  strength: 'strength',
  // Sprungkraft ist Krafttraining, nur explosiv - eine eigene Kategorie
  // dafuer haetten wir nicht, und "technique" waere irrefuehrend.
  plyometrics: 'strength',
  // Dehnen und Faszienrollen gehoeren beides zur Beweglichkeit.
  stretching: 'mobility',
}

/** Quell-Stufe auf unser Enum exercise_difficulty. */
const STUFE = { beginner: 'beginner', intermediate: 'intermediate', expert: 'advanced' }

/**
 * Quell-Geraet auf unser Enum exercise_modality.
 * "both" heisst hier: braucht zwar etwas, aber kein Studio - Band, Rolle und
 * Ball hat man auch zu Hause.
 */
const MODALITAET = {
  'body only': 'bodyweight',
  bands: 'both',
  'foam roll': 'both',
  'exercise ball': 'both',
  'medicine ball': 'both',
  kettlebells: 'both',
  dumbbell: 'gym',
  barbell: 'gym',
  machine: 'gym',
  cable: 'gym',
  'e-z curl bar': 'gym',
  other: 'both',
}

/** Muskelbezeichnungen der Quelle auf unsere muscle_groups.slug. */
const MUSKEL = {
  abdominals: 'abs',
  // Die Abduktoren sind ueberwiegend die kleinen Gesaessmuskeln - eine
  // eigene Gruppe dafuer fuehren wir nicht.
  abductors: 'glutes',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'lower_back',
  'middle back': 'upper_back',
  quadriceps: 'quads',
  shoulders: 'shoulders',
  traps: 'upper_back',
  triceps: 'triceps',
  neck: null, // keine passende Gruppe - wird ausgelassen
}

const QUELLE_NAME = 'free-exercise-db'
const QUELLE_LIZENZ = 'Unlicense (gemeinfrei)'
const QUELLE_URL = 'https://github.com/yuhonas/free-exercise-db'

/** Einfachanfuehrungszeichen fuer SQL verdoppeln. */
const q = (t) => (t == null ? 'null' : `'${String(t).replace(/'/g, "''")}'`)

/** Aus der Quell-Kennung einen stabilen, kleingeschriebenen Slug machen. */
const slugVon = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const zeilen = []
const muskelZeilen = []
const fehlend = []

for (const e of QUELLE) {
  const de = DEUTSCH[e.id]
  if (!de) { fehlend.push(e.id); continue }

  const slug = slugVon(e.id)
  zeilen.push(
    `  (${q(slug)}, ${q(de.name_de)}, ${q(e.name)},\n` +
    `   ${q(de.description_de)},\n` +
    `   ${q(e.instructions.join(' '))},\n` +
    `   ${q(KATEGORIE[e.category])}, ${q(STUFE[e.level])}, ${q(MODALITAET[e.equipment] ?? 'both')},\n` +
    `   ${q('/uebungen/' + e.id + '/0.jpg')}, ${q(QUELLE_NAME)}, ${q(QUELLE_URL)}, ${q(QUELLE_LIZENZ)}, ${q(e.id)})`,
  )

  const gesehen = new Set()
  for (const [rolle, liste] of [['primary', e.primaryMuscles], ['secondary', e.secondaryMuscles]]) {
    for (const m of liste) {
      const ziel = MUSKEL[m]
      // Eine Uebung kann denselben Muskel primaer und sekundaer nennen; der
      // Primaerschluessel laesst ihn nur einmal zu.
      if (!ziel || gesehen.has(ziel)) continue
      gesehen.add(ziel)
      muskelZeilen.push(
        `  ((select id from public.exercises where slug = ${q(slug)}),` +
        ` (select id from public.muscle_groups where slug = ${q(ziel)}), ${q(rolle)})`,
      )
    }
  }
}

if (fehlend.length) {
  console.error('Ohne deutsche Uebersetzung, nicht uebernommen:', fehlend.join(', '))
}

const sql = `-- ============================================================
-- 0015: Uebungskatalog aus free-exercise-db
-- ============================================================
-- ERZEUGT von supabase/import/uebungen-import.mjs - nicht von Hand aendern.
-- Aenderungen gehoeren in uebungen-de.json oder in das Skript, danach neu
-- erzeugen.
--
-- Quelle
-- ------
-- ${QUELLE_URL}
-- Lizenz: Unlicense, also gemeinfrei. Keine Namensnennung noetig, keine
-- Weitergabepflicht. Wir nennen die Quelle trotzdem in jeder Zeile
-- (source_name, source_url, source_license), weil es sich gehoert und weil
-- spaeter nachvollziehbar sein soll, woher ein Eintrag stammt.
--
-- Auswahl
-- -------
-- Aus 873 Uebungen sind ${QUELLE.length} uebernommen: die fuer Laufende
-- relevanten aus Kraft, Dehnen und Sprungkraft, beschraenkt auf Geraete, die
-- man zu Hause oder im Studio hat. Bodybuilding-Uebungen fuer Brust, Arme und
-- Ruecken sind bewusst aussen vor.
--
-- Texte
-- -----
-- name_de und description_de sind von Hand geschrieben, keine maschinelle
-- Uebersetzung. Die englischen Originale stehen als name_en und
-- description_en daneben. Eine fachliche Durchsicht durch Physiotherapie oder
-- Trainerin steht noch aus.
--
-- Bilder
-- ------
-- Liegen unter myprosole_web/public/uebungen/<external_id>/0.jpg und werden
-- von unserer eigenen Adresse ausgeliefert. Bewusst kein fremdes CDN: Sonst
-- erfuehre ein Dritter, welche Uebung sich wer ansieht - bei Gesundheitsdaten
-- keine Nebensaechlichkeit.
--
-- Wiederholbar: on conflict (slug) do nothing laesst bestehende Zeilen in
-- Ruhe, die 22 Uebungen aus 0007 bleiben unveraendert.
-- ============================================================

insert into public.exercises
  (slug, name_de, name_en, description_de, description_en,
   category, difficulty, modality, image_url,
   source_name, source_url, source_license, external_id) values
${zeilen.join(',\n')}
on conflict (slug) do nothing;


-- Muskelgruppen je Uebung -------------------------------------
-- Die Unterabfragen loesen die Kennungen ueber die Slugs auf, damit die
-- Migration keine fest verdrahteten UUIDs enthaelt.

insert into public.exercise_muscles (exercise_id, muscle_group_id, role) values
${muskelZeilen.join(',\n')}
on conflict do nothing;
`

writeFileSync(ZIEL, sql, 'utf8')
console.log(`Geschrieben: ${ZIEL}`)
console.log(`  ${zeilen.length} Uebungen, ${muskelZeilen.length} Muskelzuordnungen`)
