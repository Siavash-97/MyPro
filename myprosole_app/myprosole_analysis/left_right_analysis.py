"""
left_right_analysis.py
======================
Vergleicht die Belastung und das Gangverhalten zwischen linkem und rechtem Fuß.

Berechnet u. a. Schrittzahlen, durchschnittliche Druck- und Phasendauern,
Stand-/Schwung-Verhaeltnis, mediale/laterale Verteilung sowie die prozentuale
Lastdifferenz zwischen den Seiten. Zusaetzlich wird die prozentuale Verteilung
der Kontaktmuster je Seite ermittelt.

Es werden nur neutrale Hinweise erzeugt (keine medizinische Diagnose).
"""

from __future__ import annotations

import numpy as np

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config

# Kontaktmuster, deren Verteilung je Seite ausgewiesen wird.
TRACKED_PATTERNS = [
    "heel_strike_normal",
    "fast_flat_foot_contact",
    "forefoot_strike_with_late_heel_contact",
    "forefoot_strike_no_heel_contact",
    "medial_dominant",
    "lateral_dominant",
]


def _mean_or_zero(values: list[float]) -> float:
    """Mittelwert einer Liste; 0.0 bei leerer Liste. Ignoriert None-Werte."""
    clean = [v for v in values if v is not None]
    return float(np.mean(clean)) if clean else 0.0


def analyze_left_right(steps: list[dict]) -> dict:
    """Erstellt die Links-Rechts-Vergleichsanalyse.

    Args:
        steps: Liste klassifizierter Step-Dictionaries (mit Features + classification).

    Returns:
        Dictionary mit allen Vergleichskennzahlen und Hinweisen.
    """
    left = [s for s in steps if s["foot"] == "L"]
    right = [s for s in steps if s["foot"] == "R"]

    result: dict = {}

    # --- Schrittzahlen ---
    result["step_count_left"] = len(left)
    result["step_count_right"] = len(right)
    result["total_step_count"] = len(left) + len(right)

    # Gangzyklen: Schritte mit gueltiger Gangzyklusdauer.
    result["gait_cycle_count_left"] = sum(
        1 for s in left if s.get("gait_cycle_duration_ms")
    )
    result["gait_cycle_count_right"] = sum(
        1 for s in right if s.get("gait_cycle_duration_ms")
    )

    # --- Durchschnittliche Druckwerte ---
    result["average_peak_pressure_left"] = _mean_or_zero(
        [max(s["peak_S1"], s["peak_S2"], s["peak_S3"]) for s in left]
    )
    result["average_peak_pressure_right"] = _mean_or_zero(
        [max(s["peak_S1"], s["peak_S2"], s["peak_S3"]) for s in right]
    )
    result["average_total_pressure_left"] = _mean_or_zero(
        [s["total_pressure"] for s in left]
    )
    result["average_total_pressure_right"] = _mean_or_zero(
        [s["total_pressure"] for s in right]
    )

    # --- Phasendauern ---
    result["average_stance_duration_left"] = _mean_or_zero(
        [s["stance_duration_ms"] for s in left]
    )
    result["average_stance_duration_right"] = _mean_or_zero(
        [s["stance_duration_ms"] for s in right]
    )
    result["average_swing_duration_left"] = _mean_or_zero(
        [s["swing_duration_ms"] for s in left]
    )
    result["average_swing_duration_right"] = _mean_or_zero(
        [s["swing_duration_ms"] for s in right]
    )

    # Stand-/Schwung-Verhaeltnis (sichere Division).
    result["stance_swing_ratio_left"] = _safe_ratio(
        result["average_stance_duration_left"], result["average_swing_duration_left"]
    )
    result["stance_swing_ratio_right"] = _safe_ratio(
        result["average_stance_duration_right"], result["average_swing_duration_right"]
    )

    # --- Mediale/laterale Verteilung ---
    result["average_medial_ratio_left"] = _mean_or_zero([s["medial_ratio"] for s in left])
    result["average_medial_ratio_right"] = _mean_or_zero([s["medial_ratio"] for s in right])
    result["average_lateral_ratio_left"] = _mean_or_zero([s["lateral_ratio"] for s in left])
    result["average_lateral_ratio_right"] = _mean_or_zero(
        [s["lateral_ratio"] for s in right]
    )

    # --- Lastdifferenz und dominante Seite ---
    load_left = result["average_total_pressure_left"]
    load_right = result["average_total_pressure_right"]
    load_diff_percent, dominant_side = _load_difference(load_left, load_right)
    result["load_difference_percent"] = load_diff_percent
    result["dominant_side"] = dominant_side

    # Neutraler Asymmetrie-Hinweis.
    result["asymmetry_note"] = _asymmetry_note(load_diff_percent, dominant_side)

    # --- Kontaktmuster-Verteilung je Seite (in Prozent) ---
    result["contact_pattern_distribution_left"] = _pattern_distribution(left)
    result["contact_pattern_distribution_right"] = _pattern_distribution(right)

    return result


def _safe_ratio(numerator: float, denominator: float) -> float:
    """Sichere Division (0.0 bei Nenner 0)."""
    if not denominator:
        return 0.0
    return float(numerator) / float(denominator)


def _load_difference(load_left: float, load_right: float) -> tuple[float, str]:
    """Berechnet die prozentuale Lastdifferenz und die dominante Seite.

    Die Differenz wird relativ zur staerker belasteten Seite angegeben.
    """
    if load_left <= 0 and load_right <= 0:
        return 0.0, "none"

    stronger = max(load_left, load_right)
    weaker = min(load_left, load_right)
    diff_percent = (stronger - weaker) / stronger * 100.0 if stronger > 0 else 0.0

    if load_left > load_right:
        dominant = "left"
    elif load_right > load_left:
        dominant = "right"
    else:
        dominant = "balanced"

    return float(diff_percent), dominant


def _asymmetry_note(load_diff_percent: float, dominant_side: str) -> str:
    """Erzeugt einen neutralen Hinweis, falls die Asymmetrie ueber dem Schwellwert liegt."""
    if load_diff_percent < config.ASYMMETRY_THRESHOLD_PERCENT:
        return "Die Belastung beider Seiten ist weitgehend ausgeglichen."
    if dominant_side == "left":
        return "Die linke Seite wurde im Durchschnitt stärker belastet."
    if dominant_side == "right":
        return "Die rechte Seite wurde im Durchschnitt stärker belastet."
    return "Die Belastung beider Seiten ist weitgehend ausgeglichen."


def _pattern_distribution(steps: list[dict]) -> dict:
    """Prozentuale Verteilung der verfolgten Kontaktmuster fuer eine Seite.

    Ein Schritt kann mehrere Muster tragen (z. B. Fersenaufsatz + medial_dominant);
    daher wird das Vorkommen jedes Musters auf die Schrittzahl der Seite bezogen.
    """
    distribution = {pattern: 0.0 for pattern in TRACKED_PATTERNS}
    n = len(steps)
    if n == 0:
        return distribution

    counts = {pattern: 0 for pattern in TRACKED_PATTERNS}
    for step in steps:
        for pattern in step.get("all_patterns", []):
            if pattern in counts:
                counts[pattern] += 1

    for pattern in TRACKED_PATTERNS:
        distribution[pattern] = round(counts[pattern] / n * 100.0, 1)

    return distribution
