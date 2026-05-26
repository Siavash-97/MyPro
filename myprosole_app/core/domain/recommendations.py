"""Regelbasierte Druck- und Gangmuster für Übungsempfehlungen."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from core.domain.pressure_analysis import PressureAnalysisResult
from core.domain.sensor_mapping import FOOT_LABELS, FOOT_ORDER

# Schwellenwerte (MVP, später konfigurierbar)
HEEL_DOMINANCE_THRESHOLD = 0.65
HEEL_LOAD_THRESHOLD_PERCENT = 55.0
LEFT_RIGHT_ASYMMETRY_LOW_PERCENT = 40.0
LEFT_RIGHT_ASYMMETRY_HIGH_PERCENT = 60.0
LOW_CADENCE_THRESHOLD_SPM = 155.0
STEP_CV_THRESHOLD_PERCENT = 8.0
STANCE_RATIO_THRESHOLD = 0.68


@dataclass(frozen=True)
class Diagnosis:
    """Erkanntes Druck- oder Bewegungsmuster aus Metriken und Events."""

    id: str
    title: str
    finding: str
    metrics: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ExerciseRecommendation:
    """Übungsvorschlag, abgeleitet aus einem erkannten Muster."""

    diagnosis_id: str
    title: str
    because: str
    goal: str
    exercises: tuple[str, ...]


def _heel_dominance(df: pd.DataFrame, events: dict) -> float | None:
    hs_idx = np.asarray(events.get("hs_idx", []), dtype=int)
    if len(hs_idx) == 0 or "FSR1" not in df.columns or "FSR2" not in df.columns:
        return None
    hs_fsr1 = df["FSR1"].iloc[hs_idx]
    hs_fsr2 = df["FSR2"].iloc[hs_idx]
    return float((hs_fsr1 > hs_fsr2).mean())


def metrics_snapshot(
    df: pd.DataFrame,
    events: dict,
    summary: dict,
    pressure_analysis: PressureAnalysisResult | None = None,
) -> dict:
    """Relevante Kennzahlen für die Analyse-Zusammenfassung in der UI."""
    heel = _heel_dominance(df, events)
    snapshot = {
        "n_steps_valid": int(summary.get("n_steps_valid", 0)),
        "cadence_spm": float(summary.get("cadence_spm", 0.0)),
        "step_time_cv_percent": float(summary.get("step_time_cv_percent", 0.0)),
        "stance_ratio_mean": float(summary.get("stance_ratio_mean", 0.0)),
        "stance_time_mean_s": float(summary.get("stance_time_mean_s", 0.0)),
        "step_time_mean_s": float(summary.get("step_time_mean_s", 0.0)),
    }
    if heel is not None:
        snapshot["heel_dominance_percent"] = round(heel * 100.0, 1)
    if pressure_analysis is not None:
        bilateral = pressure_analysis.bilateral_summary
        snapshot.update(
            {
                "total_pressure_left": round(bilateral.get("total_pressure_left", 0.0), 1),
                "total_pressure_right": round(bilateral.get("total_pressure_right", 0.0), 1),
                "left_right_distribution_percentage": round(
                    bilateral.get("left_right_distribution_percentage", 0.0), 1
                ),
            }
        )
        if "estimated_body_weight_kg" in bilateral:
            snapshot["estimated_body_weight_kg"] = round(
                bilateral["estimated_body_weight_kg"], 1
            )
    return snapshot


def _pressure_pattern_diagnoses(
    pressure_analysis: PressureAnalysisResult | None,
) -> list[Diagnosis]:
    if pressure_analysis is None:
        return []

    diagnoses: list[Diagnosis] = []
    heel_feet: list[str] = []
    for foot in FOOT_ORDER:
        foot_summary = pressure_analysis.per_foot_summary.get(foot, {})
        heel_percentage = float(foot_summary.get("heel_percentage", 0.0))
        if heel_percentage >= HEEL_LOAD_THRESHOLD_PERCENT:
            heel_feet.append(f"{FOOT_LABELS.get(foot, foot)} ({heel_percentage:.0f} %)")

    if heel_feet:
        diagnoses.append(
            Diagnosis(
                id="heel_strike_tendency",
                title="Mögliches Muster: erhöhte Fersenbelastung",
                finding=(
                    "Erhöhte Belastung im Fersenbereich: "
                    + ", ".join(heel_feet)
                    + "."
                ),
                metrics={"heel_load_feet": heel_feet},
            )
        )

    left_share = float(
        pressure_analysis.bilateral_summary.get("left_right_distribution_percentage", 0.0)
    )
    if (
        left_share < LEFT_RIGHT_ASYMMETRY_LOW_PERCENT
        or left_share > LEFT_RIGHT_ASYMMETRY_HIGH_PERCENT
    ):
        diagnoses.append(
            Diagnosis(
                id="asymmetric_load_distribution",
                title="Mögliches Muster: asymmetrische Belastungsverteilung",
                finding=(
                    f"Die mittlere Belastungsverteilung liegt bei {left_share:.1f} % links "
                    f"und {100.0 - left_share:.1f} % rechts."
                ),
                metrics={"left_right_distribution_percentage": round(left_share, 1)},
            )
        )

    return diagnoses


def diagnose(
    df: pd.DataFrame,
    events: dict,
    summary: dict,
    pressure_analysis: PressureAnalysisResult | None = None,
) -> list[Diagnosis]:
    """Metriken und Events → erkannte Muster (regelbasiert, MVP)."""
    diagnoses: list[Diagnosis] = []

    diagnoses.extend(_pressure_pattern_diagnoses(pressure_analysis))

    heel_dominance = _heel_dominance(df, events)
    cadence = float(summary.get("cadence_spm", 0.0))
    step_cv = float(summary.get("step_time_cv_percent", 0.0))
    stance_ratio = float(summary.get("stance_ratio_mean", 0.0))

    if (
        pressure_analysis is None
        and heel_dominance is not None
        and heel_dominance >= HEEL_DOMINANCE_THRESHOLD
    ):
        diagnoses.append(
            Diagnosis(
                id="heel_strike_tendency",
                title="Mögliches Muster: erhöhte Fersenbelastung",
                finding=(
                    f"Bei {heel_dominance * 100:.0f} % der Initialkontakte ist das "
                    "Fersen-Signal höher als das Vorfuß-Signal."
                ),
                metrics={"heel_dominance_percent": round(heel_dominance * 100.0, 1)},
            )
        )

    if cadence > 0 and cadence < LOW_CADENCE_THRESHOLD_SPM:
        diagnoses.append(
            Diagnosis(
                id="low_cadence",
                title="Mögliches Muster: reduzierte Kadenz",
                finding=f"Kadenz liegt bei {cadence:.1f} Schritten/min.",
                metrics={"cadence_spm": round(cadence, 1)},
            )
        )

    if step_cv >= STEP_CV_THRESHOLD_PERCENT:
        diagnoses.append(
            Diagnosis(
                id="high_step_variability",
                title="Mögliches Muster: erhöhte Schrittzeit-Variabilität",
                finding=f"Schrittzeit-CV liegt bei {step_cv:.1f} %.",
                metrics={"step_time_cv_percent": round(step_cv, 1)},
            )
        )

    if stance_ratio > STANCE_RATIO_THRESHOLD:
        diagnoses.append(
            Diagnosis(
                id="long_stance_phase",
                title="Mögliches Muster: längere Standphase",
                finding=(
                    f"Mittlere Stance-Ratio liegt bei {stance_ratio:.2f}."
                ),
                metrics={"stance_ratio_mean": round(stance_ratio, 2)},
            )
        )

    if not diagnoses:
        diagnoses.append(
            Diagnosis(
                id="unremarkable_profile",
                title="Ausgeglichenes Belastungsmuster",
                finding="In den aktuellen Kennzahlen ist keine klare Priorität sichtbar.",
                metrics={},
            )
        )

    return diagnoses


_EXERCISE_MAP: dict[str, ExerciseRecommendation] = {
    "heel_strike_tendency": ExerciseRecommendation(
        diagnosis_id="heel_strike_tendency",
        title="Kontakt Richtung Mittel-/Vorfuß",
        because="weil erhöhte Belastung im Fersenbereich sichtbar ist",
        goal="Kontakt schrittweise in Richtung Mittel-/Vorfuß verbessern.",
        exercises=(
            "Barfuß-Marsch mit bewusst leisem, mittigem Fußaufsatz (3 × 45 s).",
            "Skippings / kurze Anfersen in lockerer Frequenz (3 × 20 m).",
            "Wadenheben langsam exzentrisch (3 × 12 Wiederholungen).",
        ),
    ),
    "low_cadence": ExerciseRecommendation(
        diagnosis_id="low_cadence",
        title="Schrittfrequenz moderat erhöhen",
        because="weil die Kadenz reduziert ist",
        goal="Schrittfrequenz moderat erhöhen, um Überstriding zu reduzieren.",
        exercises=(
            "Metronom-Laufdrill mit +5 % Kadenz für 4 × 1 min.",
            "Kurze Schrittlänge bei gleicher Geschwindigkeit üben.",
            "Lauf-ABC: Kniehebelauf locker (3 × 20 m).",
        ),
    ),
    "high_step_variability": ExerciseRecommendation(
        diagnosis_id="high_step_variability",
        title="Rhythmus und Schrittkonstanz",
        because="weil die Schrittzeit stärker variiert",
        goal="Rhythmus und Schrittkonstanz verbessern.",
        exercises=(
            "Gehen/Laufen im Takt (Metronom), 3 × 2 min.",
            "Einbeinstand mit leichtem Oberkörper-Neigen (3 × 30 s pro Seite).",
            "Linienlauf mit gleichmäßiger Schrittabfolge (4 × 15 m).",
        ),
    ),
    "long_stance_phase": ExerciseRecommendation(
        diagnosis_id="long_stance_phase",
        title="Dynamischeres Abrollen",
        because="weil die Standphase im Mittel länger ist",
        goal="Dynamischeres Abrollen und effizientere Abdruckphase.",
        exercises=(
            "Fußgelenksarbeit im Stand (Vor-/Rückverlagerung) 2 × 60 s.",
            "Kurze Hopserläufe mit weichem Fußaufsatz (3 × 15 m).",
            "Sprunggelenk-Mobilität an der Wand (2 × 10 pro Seite).",
        ),
    ),
    "asymmetric_load_distribution": ExerciseRecommendation(
        diagnosis_id="asymmetric_load_distribution",
        title="Seitliche Belastung ausgleichen",
        because="weil links und rechts unterschiedlich belastet werden",
        goal="Belastung bewusster zwischen linker und rechter Seite verteilen.",
        exercises=(
            "Einbeinstand mit leichtem Oberkörper-Neigen (3 × 30 s pro Seite).",
            "Linienlauf mit gleichmäßiger Schrittabfolge (4 × 15 m).",
            "Stabi-Zirkel: Einbeinstand + Wadenheben (3 Runden).",
        ),
    ),
    "unremarkable_profile": ExerciseRecommendation(
        diagnosis_id="unremarkable_profile",
        title="Prävention und Technik erhalten",
        because="weil aktuell kein priorisiertes Muster vorliegt",
        goal="Prävention und Lauftechnik erhalten.",
        exercises=(
            "Dynamische Fußmobilität (2 × 60 s).",
            "Stabi-Zirkel: Einbeinstand + Wadenheben (3 Runden).",
            "Lockeres Lauf-ABC als Warm-up (5 Minuten).",
        ),
    ),
}


def recommend_exercises(diagnoses: list[Diagnosis]) -> list[ExerciseRecommendation]:
    """Muster → personalisierte Übungsvorschläge mit Kurzbegründung."""
    recommendations: list[ExerciseRecommendation] = []
    for diagnosis in diagnoses:
        template = _EXERCISE_MAP.get(diagnosis.id)
        if template is None:
            continue
        recommendations.append(
            ExerciseRecommendation(
                diagnosis_id=template.diagnosis_id,
                title=template.title,
                because=f"{template.because} ({diagnosis.title})",
                goal=template.goal,
                exercises=template.exercises,
            )
        )
    return recommendations


def analyze_and_recommend(
    df: pd.DataFrame,
    events: dict,
    summary: dict,
    pressure_analysis: PressureAnalysisResult | None = None,
) -> dict:
    """Vollständige Pipeline: Kennzahlen → Muster → Empfehlungen."""
    metrics = metrics_snapshot(df, events, summary, pressure_analysis=pressure_analysis)
    diagnoses = diagnose(df, events, summary, pressure_analysis=pressure_analysis)
    recommendations = recommend_exercises(diagnoses)
    return {
        "metrics": metrics,
        "diagnoses": diagnoses,
        "recommendations": recommendations,
    }


def build_exercise_recommendations(
    df: pd.DataFrame,
    events: dict,
    summary: dict,
    pressure_analysis: PressureAnalysisResult | None = None,
) -> list[dict]:
    """Abwärtskompatibel: flache Dict-Liste für ältere Aufrufer."""
    result = analyze_and_recommend(
        df, events, summary, pressure_analysis=pressure_analysis
    )
    return [
        {
            "title": rec.title,
            "insight": rec.because,
            "goal": rec.goal,
            "exercises": list(rec.exercises),
            "diagnosis_id": rec.diagnosis_id,
        }
        for rec in result["recommendations"]
    ]


def diagnosis_to_dict(diagnosis: Diagnosis) -> dict:
    return asdict(diagnosis)


def recommendation_to_dict(recommendation: ExerciseRecommendation) -> dict:
    return {
        "diagnosis_id": recommendation.diagnosis_id,
        "title": recommendation.title,
        "because": recommendation.because,
        "goal": recommendation.goal,
        "exercises": list(recommendation.exercises),
    }
