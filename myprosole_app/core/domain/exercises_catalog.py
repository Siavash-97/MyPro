"""Zentraler Übungskatalog (reine Daten, ohne Streamlit)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Exercise:
    """Eine Übung mit Metadaten für Anzeige und spätere Video-Einbindung."""

    id: str
    title: str
    description: str
    steps: tuple[str, ...]
    video_url: str = ""


# pattern_id → Übungs-IDs (Reihenfolge wie in recommendations._EXERCISE_MAP)
_DIAGNOSIS_EXERCISE_IDS: dict[str, tuple[str, ...]] = {
    "heel_strike_tendency": (
        "barefoot_march",
        "skipping_drill",
        "calf_raises_eccentric",
    ),
    "low_cadence": (
        "metronome_cadence",
        "short_stride_walk",
        "knee_lift_abc",
    ),
    "high_step_variability": (
        "metronome_rhythm",
        "single_leg_balance",
        "line_walk",
    ),
    "long_stance_phase": (
        "ankle_rocking",
        "hop_runs",
        "wall_ankle_mobility",
    ),
    "asymmetric_load_distribution": (
        "single_leg_balance",
        "line_walk",
        "stability_circuit",
    ),
    "unremarkable_profile": (
        "foot_mobility",
        "stability_circuit",
        "running_abc_warmup",
    ),
}

EXERCISE_CATALOG: dict[str, Exercise] = {
    "barefoot_march": Exercise(
        id="barefoot_march",
        title="Barfuß-Marsch mit mittigem Fußaufsatz",
        description=(
            "Bewusster, leiser Kontakt in Richtung Mittel-/Vorfuß – "
            "Grundlage für einen weicheren Initialkontakt."
        ),
        steps=(
            "Barfuß auf ebener, rutschfester Fläche stehen.",
            "Langsam marschieren, Fokus auf leisem, mittigem Fußaufsatz.",
            "3 × 45 Sekunden, kurze Pause dazwischen.",
        ),
    ),
    "skipping_drill": Exercise(
        id="skipping_drill",
        title="Skippings / kurze Anfersen",
        description="Aktiviert Vorfuß und Waden für einen dynamischeren Kontakt.",
        steps=(
            "Lockeres Skipping oder kurze Anfersen in leichter Frequenz.",
            "Oberkörper aufrecht, leichte Fußarbeit.",
            "3 × 20 Meter.",
        ),
    ),
    "calf_raises_eccentric": Exercise(
        id="calf_raises_eccentric",
        title="Wadenheben (exzentrisch)",
        description="Kräftigt die Waden und unterstützt kontrolliertes Abrollen.",
        steps=(
            "Beidbeinig auf die Zehenspitzen heben.",
            "Langsam und kontrolliert wieder absenken (exzentrisch).",
            "3 × 12 Wiederholungen.",
        ),
    ),
    "metronome_cadence": Exercise(
        id="metronome_cadence",
        title="Metronom-Laufdrill",
        description="Erhöht die Schrittfrequenz moderat ohne Temposteigerung.",
        steps=(
            "Metronom-App auf ca. +5 % Ihrer aktuellen Kadenz stellen.",
            "4 × 1 Minute im Takt laufen oder gehen.",
            "Zwischen den Intervallen 30 s Pause.",
        ),
    ),
    "short_stride_walk": Exercise(
        id="short_stride_walk",
        title="Kurze Schrittlänge bei gleicher Geschwindigkeit",
        description="Reduziert Überstriding und fördert höhere Kadenz.",
        steps=(
            "Gleiche Geh-/Laufgeschwindigkeit beibehalten.",
            "Bewusst kürzere Schritte setzen.",
            "2–3 Minuten üben, dann kurz ausruhen.",
        ),
    ),
    "knee_lift_abc": Exercise(
        id="knee_lift_abc",
        title="Lauf-ABC: Kniehebelauf",
        description="Koordinationsübung für aktivere Schrittgestaltung.",
        steps=(
            "Lockerer Kniehebelauf mit aufrechtem Oberkörper.",
            "Arme im Gegengang mitführen.",
            "3 × 20 Meter.",
        ),
    ),
    "metronome_rhythm": Exercise(
        id="metronome_rhythm",
        title="Gehen/Laufen im Metronom-Takt",
        description="Stabilisiert Rhythmus und Schrittkonstanz.",
        steps=(
            "Metronom auf gleichmäßigen Takt stellen.",
            "3 × 2 Minuten im Takt gehen oder laufen.",
            "Auf gleichmäßige Schrittzeiten achten.",
        ),
    ),
    "single_leg_balance": Exercise(
        id="single_leg_balance",
        title="Einbeinstand mit leichtem Neigen",
        description="Verbessert Stabilität und Gleichgewicht pro Seite.",
        steps=(
            "Einbeinig stehen, Oberkörper leicht nach vorne neigen.",
            "3 × 30 Sekunden pro Seite.",
            "Bei Bedarf Wand oder Stuhl zur Hilfe nutzen.",
        ),
    ),
    "line_walk": Exercise(
        id="line_walk",
        title="Linienlauf",
        description="Trainiert gleichmäßige Schrittabfolge und Fokus.",
        steps=(
            "Linie auf dem Boden oder Band als Führung.",
            "4 × 15 Meter mit gleichmäßiger Schrittabfolge.",
        ),
    ),
    "ankle_rocking": Exercise(
        id="ankle_rocking",
        title="Fußgelenksarbeit im Stand",
        description="Mobilisiert Sprunggelenk für dynamischeres Abrollen.",
        steps=(
            "Im Stand Gewicht zwischen Vorfuß und Ferse verlagern.",
            "2 × 60 Sekunden langsam und kontrolliert.",
        ),
    ),
    "hop_runs": Exercise(
        id="hop_runs",
        title="Kurze Hopserläufe",
        description="Fördert elastischen Abdruck und kürzere Standphase.",
        steps=(
            "Kurze, weiche Hopserläufe mit leichtem Fußaufsatz.",
            "3 × 15 Meter, ausreichend Pause dazwischen.",
        ),
    ),
    "wall_ankle_mobility": Exercise(
        id="wall_ankle_mobility",
        title="Sprunggelenk-Mobilität an der Wand",
        description="Erhöht Dorsalextension für besseres Abrollen.",
        steps=(
            "Fuß nah an die Wand, Knie Richtung Wand führen.",
            "2 × 10 Wiederholungen pro Seite.",
            "Kein Schmerz – nur angenehmer Dehnreiz.",
        ),
    ),
    "foot_mobility": Exercise(
        id="foot_mobility",
        title="Dynamische Fußmobilität",
        description="Erhält Beweglichkeit und Prävention bei ausgeglichenem Muster.",
        steps=(
            "Zehen greifen, Fuß kreisen, Ferse-Vorfuß-Rollen.",
            "2 × 60 Sekunden abwechselnd.",
        ),
    ),
    "stability_circuit": Exercise(
        id="stability_circuit",
        title="Stabi-Zirkel: Einbeinstand + Wadenheben",
        description="Kombiniert Gleichgewicht und Kraft für stabile Lauftechnik.",
        steps=(
            "Einbeinstand 20 s, dann 10 Wadenheben – eine Seite.",
            "Seite wechseln, 3 Runden insgesamt.",
        ),
    ),
    "running_abc_warmup": Exercise(
        id="running_abc_warmup",
        title="Lockeres Lauf-ABC als Warm-up",
        description="Erhält Koordination und Technik im Alltag.",
        steps=(
            "Klassisches Lauf-ABC (Kniehebel, Anfersen, etc.) locker ausführen.",
            "Ca. 5 Minuten als Warm-up vor Training.",
        ),
    ),
}


def exercise_ids_for_diagnosis(diagnosis_id: str) -> tuple[str, ...]:
    return _DIAGNOSIS_EXERCISE_IDS.get(diagnosis_id, ())


def exercises_for_diagnosis_ids(diagnosis_ids: list[str]) -> list[Exercise]:
    """Übungen aus Analyse-Mustern, ohne Duplikate, Reihenfolge stabil."""
    seen: set[str] = set()
    result: list[Exercise] = []
    for diagnosis_id in diagnosis_ids:
        for exercise_id in exercise_ids_for_diagnosis(diagnosis_id):
            if exercise_id in seen:
                continue
            exercise = EXERCISE_CATALOG.get(exercise_id)
            if exercise is None:
                continue
            seen.add(exercise_id)
            result.append(exercise)
    return result


def all_exercises() -> list[Exercise]:
    """Alle Übungen im Katalog (alphabetisch nach Titel)."""
    return sorted(EXERCISE_CATALOG.values(), key=lambda e: e.title)


def get_exercise(exercise_id: str) -> Exercise | None:
    return EXERCISE_CATALOG.get(exercise_id)
