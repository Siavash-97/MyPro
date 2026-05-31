"""
gait_classification.py
======================
Regelbasierte (KEINE KI) Klassifikation jedes Schritts anhand der zuvor
berechneten Features.

WICHTIG: Es werden ausschliesslich neutrale, beschreibende Hinweise vergeben.
Es erfolgt KEINE medizinische Diagnose. Begriffe wie "Pronation" oder
"Supination" werden bewusst NICHT verwendet.

Jeder Schritt erhaelt:
- ``classification``      : Name des primaeren Kontaktmusters
- ``classification_notes``: lesbarer Hinweistext (primaer + ggf. Zusatzhinweise)
- ``all_patterns``        : Liste aller zutreffenden Muster (primaer + Verteilung),
                            wird u. a. fuer die Links-Rechts-Statistik genutzt.

Beruecksichtigte Kriterien: Aktivierungsreihenfolge, wie schnell weitere
Sensoren folgen, ob/wann die Ferse aktiv wird, mediale/laterale Verteilung
sowie Stand-/Schwungphasendauer.
"""

from __future__ import annotations

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config

# Zentrale Hinweistexte je Muster (neutral formuliert).
PATTERN_NOTES = {
    "heel_strike_normal": "Klassischer Fersenaufsatz.",
    "fast_flat_foot_contact": (
        "Ferse wurde zuerst aktiviert, aber der Vorfuß folgte sehr schnell. "
        "Hinweis auf eher flachen Fußaufsatz."
    ),
    "forefoot_strike_with_late_heel_contact": (
        "Vorfuß wurde zuerst aktiviert, Ferse folgte später in der Standphase."
    ),
    "forefoot_strike_no_heel_contact": (
        "Vorfuß wurde belastet, ohne messbaren Fersenkontakt."
    ),
    "lateral_dominant": "Erhöhte laterale Vorfußbelastung.",
    "medial_dominant": "Erhöhte mediale Vorfußbelastung.",
    "early_medial_shift": "Frühe mediale Druckverlagerung.",
    "weak_forefoot_loading": "Reduzierte Vorfußbelastung.",
    "unclear": "Kein eindeutiges Kontaktmuster erkennbar.",
}


def classify_steps(steps: list[dict]) -> list[dict]:
    """Klassifiziert alle Schritte (in-place) und gibt die Liste zurueck."""
    for step in steps:
        _classify_step(step)
    return steps


def _classify_step(step: dict) -> None:
    """Bestimmt primaeres Kontaktmuster und Zusatzhinweise fuer einen Schritt."""
    primary = _classify_primary_contact(step)

    # Zusatzhinweise aus der Druckverteilung / Belastung.
    extra_patterns = _classify_distribution(step)

    all_patterns = [primary] + extra_patterns

    # Hinweistexte zusammensetzen: primaerer Hinweis + Zusatzhinweise.
    notes = [PATTERN_NOTES.get(primary, "")]
    notes += [PATTERN_NOTES[p] for p in extra_patterns]
    classification_notes = " ".join(n for n in notes if n)

    step.update(
        {
            "classification": primary,
            "classification_notes": classification_notes,
            "all_patterns": all_patterns,
        }
    )


def _classify_primary_contact(step: dict) -> str:
    """Bestimmt das primaere Kontaktmuster (Regeln 1-4, sonst unclear)."""
    t_s1 = step.get("time_S1_on")       # Fersen-Aktivierung (ms) oder None
    t_s2 = step.get("time_S2_on")       # lateraler Vorfuß
    t_s3 = step.get("time_S3_on")       # medialer Vorfuß
    first = step.get("first_active_sensor")

    forefoot_delay = step.get("forefoot_contact_delay_ms")  # frueheste VF-Aktivierung
    heel_active = t_s1 is not None

    # --- Vorfuß zuerst (S2 oder S3) ---
    if first in ("S2", "S3"):
        if heel_active:
            # Regel 3: Vorfuß zuerst, Ferse folgt spaeter in der Standphase.
            return "forefoot_strike_with_late_heel_contact"
        # Regel 4: Vorfuß zuerst, ohne messbaren Fersenkontakt.
        return "forefoot_strike_no_heel_contact"

    # --- Ferse zuerst (S1) ---
    if first == "S1":
        if forefoot_delay is not None:
            # Zeit zwischen Fersen- und erstem Vorfußkontakt.
            heel_to_forefoot = forefoot_delay - t_s1
            if heel_to_forefoot <= config.FLAT_FOOT_TIME_WINDOW_MS:
                # Regel 2: Vorfuß folgt sehr schnell -> flacher Aufsatz.
                return "fast_flat_foot_contact"
            # Regel 1: Vorfuß folgt erst deutlich spaeter -> klassischer Fersenaufsatz.
            return "heel_strike_normal"
        # Ferse aktiv, Vorfuß nie nennenswert aktiv -> trotzdem Fersenaufsatz.
        return "heel_strike_normal"

    # Kein Sensor klar zuerst aktiv -> unklar.
    return "unclear"


def _classify_distribution(step: dict) -> list[str]:
    """Ermittelt zusaetzliche Verteilungs-/Belastungshinweise (Regeln 5-8)."""
    extra: list[str] = []

    medial_ratio = step.get("medial_ratio", 0.0)
    lateral_ratio = step.get("lateral_ratio", 0.0)
    forefoot_pressure = step.get("forefoot_pressure", 0.0)
    peak_s1 = step.get("peak_S1", 0.0)
    peak_s2 = step.get("peak_S2", 0.0)
    peak_s3 = step.get("peak_S3", 0.0)

    t_s1 = step.get("time_S1_on")
    t_s2 = step.get("time_S2_on")
    t_s3 = step.get("time_S3_on")

    # Regel 5/6: deutliche mediale bzw. laterale Dominanz im Vorfuß.
    # Nur sinnvoll, wenn ueberhaupt nennenswerter Vorfußdruck vorhanden ist.
    if forefoot_pressure > config.SENSOR_THRESHOLD:
        diff = medial_ratio - lateral_ratio
        if diff > config.MEDIAL_LATERAL_THRESHOLD:
            extra.append("medial_dominant")
        elif -diff > config.MEDIAL_LATERAL_THRESHOLD:
            extra.append("lateral_dominant")

    # Regel 7: fruehe mediale Druckverlagerung.
    # Ferse zuerst, S3 (medial) sehr frueh aktiv, S2 (lateral) niedrig/spaeter.
    if t_s1 is not None and t_s3 is not None:
        s3_after_heel = t_s3 - t_s1
        s2_low = (t_s2 is None) or (peak_s2 < 0.5 * peak_s3)
        s2_late = (t_s2 is not None) and ((t_s2 - t_s3) > config.FLAT_FOOT_TIME_WINDOW_MS)
        if s3_after_heel <= config.FLAT_FOOT_TIME_WINDOW_MS and (s2_low or s2_late):
            extra.append("early_medial_shift")

    # Regel 8: reduzierte Vorfußbelastung (S2+S3 sehr niedrig im Vergleich zur Ferse).
    # Schwelle: Vorfußdruck < 30 % des Fersen-Peaks.
    if peak_s1 > config.SENSOR_THRESHOLD and forefoot_pressure < 0.30 * peak_s1:
        extra.append("weak_forefoot_loading")

    return extra
