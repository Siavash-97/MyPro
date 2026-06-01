"""
config.py
=========
Zentrale Konfiguration für die MyProSole Gang-/Laufanalyse.

Hier sind ALLE Parameter der Analyse an einer Stelle gebündelt, damit das
Verhalten der Module ohne Eingriff in den eigentlichen Analysecode angepasst
werden kann. Die Werte sind als sinnvolle Defaults für eine smarte Einlage mit
3 FSR-Drucksensoren pro Fuß gewählt und ausführlich kommentiert.

Sensorbelegung pro Fuß (gilt für L wie R):
    Sensor 1 (S1) = Ferse / heel
    Sensor 2 (S2) = lateraler Vorfuß (unter kleiner Zeh)
    Sensor 3 (S3) = medialer Vorfuß (unter großer Zeh)
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Pflicht-Spaltennamen der Eingangs-CSV
# ---------------------------------------------------------------------------
# Diese Spalten MÜSSEN in der CSV vorhanden sein. data_loader.py prüft das.
TIME_COLUMN = "time_s"

# Sensor-Spalten je Fuß, in der Reihenfolge [Ferse, lateraler VF, medialer VF].
LEFT_SENSOR_COLUMNS = ["L1_heel", "L2_lateral_forefoot", "L3_medial_forefoot"]
RIGHT_SENSOR_COLUMNS = ["R1_heel", "R2_lateral_forefoot", "R3_medial_forefoot"]

# Alle Pflichtspalten zusammengefasst.
REQUIRED_COLUMNS = [TIME_COLUMN] + LEFT_SENSOR_COLUMNS + RIGHT_SENSOR_COLUMNS

# Logische Sensor-Rollen -> Index innerhalb der 3er-Liste eines Fußes.
# So kann der Code unabhängig vom Fuß (L/R) auf "Ferse", "lateral", "medial"
# zugreifen.
SENSOR_ROLE_INDEX = {
    "heel": 0,        # S1
    "lateral": 1,     # S2
    "medial": 2,      # S3
}


# ---------------------------------------------------------------------------
# Abtastrate (Sampling Rate)
# ---------------------------------------------------------------------------
# Default-Abtastrate in Hz, falls sie nicht aus den Zeitstempeln geschätzt
# werden kann (z. B. zu wenige Datenpunkte).
DEFAULT_SAMPLING_RATE_HZ = 100.0


def estimate_sampling_rate(time_values, default: float = DEFAULT_SAMPLING_RATE_HZ) -> float:
    """Schätzt die Abtastrate (Hz) automatisch aus der Zeitspalte ``time_s``.

    Vorgehen: Median der Zeitdifferenzen zwischen aufeinanderfolgenden
    Messpunkten bilden (robust gegen einzelne Ausreißer/Lücken) und daraus die
    Frequenz berechnen. Schlägt die Schätzung fehl (zu wenige Punkte, dt <= 0),
    wird der übergebene Default zurückgegeben.

    Args:
        time_values: Sequenz/Array der Zeitstempel in Sekunden.
        default: Rückfallwert in Hz.

    Returns:
        Geschätzte Abtastrate in Hz (float).
    """
    time_array = np.asarray(time_values, dtype=float)
    if time_array.size < 2:
        return float(default)

    # Differenzen aufeinanderfolgender Zeitstempel.
    diffs = np.diff(time_array)
    # Nur positive Differenzen verwenden (Schutz gegen doppelte/fehlerhafte Zeiten).
    diffs = diffs[diffs > 0]
    if diffs.size == 0:
        return float(default)

    median_dt = float(np.median(diffs))
    if median_dt <= 0:
        return float(default)

    return 1.0 / median_dt


# ---------------------------------------------------------------------------
# Schwellenwerte für die Sensoraktivierung
# ---------------------------------------------------------------------------
# Ab diesem Druckwert gilt ein Sensor als "aktiv" (Bodenkontakt/Last).
# Die FSR-Rohwerte werden hier als 0..1023 (10 Bit) bzw. nach Normalisierung
# als 0..100 angenommen; 30 ist ein konservativer Default für Rohwerte.
SENSOR_THRESHOLD = 30.0

# Werte fuer Sensitivitaetsanalysen (Phase 0): Stabilitaet der Erkennung pruefen.
SENSOR_THRESHOLD_SENSITIVITY_VALUES = (20.0, 25.0, 30.0, 35.0, 40.0)

# Prozentualer Aktivierungsschwellenwert (0..100). Wird genutzt, um relativ zum
# Maximaldruck eines Schritts zu entscheiden, ob ein Sensor "nennenswert" aktiv
# war (z. B. für schwache Vorfußbelastung).
ACTIVATION_THRESHOLD_PERCENT = 15.0


# ---------------------------------------------------------------------------
# Zeitliche Grenzen für gültige Schritte / Phasen
# ---------------------------------------------------------------------------
# Standphasen, die kürzer/länger als diese Grenzen sind, werden als Artefakte
# verworfen (z. B. Sensorrauschen oder Stillstand).
MIN_STEP_DURATION_MS = 150.0     # minimale plausible Standphasendauer
MAX_STEP_DURATION_MS = 2000.0    # maximale plausible Standphasendauer

# Minimale plausible Schwungphasendauer. Kürzere "Schwungphasen" gelten als
# nicht belastbar und werden nicht gewertet.
MIN_SWING_DURATION_MS = 100.0


# ---------------------------------------------------------------------------
# Parameter für die Kontaktmuster-Klassifikation
# ---------------------------------------------------------------------------
# Zeitfenster (ms) nach dem ersten Fersenkontakt: Wird der Vorfuß innerhalb
# dieses Fensters aktiv, gilt der Aufsatz als "flach" (fast_flat_foot_contact)
# statt als klarer Fersenaufsatz. Legacy-Absolutschwelle – parallel wird auch
# FLAT_FOOT_STANCE_RATIO (relativ zur Standphase) verwendet.
FLAT_FOOT_TIME_WINDOW_MS = 120.0

# Heuristik: Vorfuß folgt innerhalb dieses Anteils der Standphase -> flacher
# Aufsatz (Screening, keine medizinische Norm). Beispiel: 0.15 = 15 %.
FLAT_FOOT_STANCE_RATIO = 0.15

# Wird die Ferse erst NACH dieser Zeit (ms) ab Standphasenbeginn aktiv, gilt der
# Fersenkontakt als "spät" (relevant für forefoot_strike_with_late_heel_contact).
LATE_HEEL_CONTACT_THRESHOLD_MS = 150.0


# ---------------------------------------------------------------------------
# Medial/Lateral-Verteilung
# ---------------------------------------------------------------------------
# Schwellwert für die Differenz zwischen medialem und lateralem Anteil am
# Vorfußdruck. Liegt |medial_ratio - lateral_ratio| über diesem Wert, wird eine
# Seite als dominant markiert (medial_dominant / lateral_dominant).
# Beispiel: 0.20 entspricht 20 Prozentpunkten Unterschied.
MEDIAL_LATERAL_THRESHOLD = 0.20


# ---------------------------------------------------------------------------
# Links-Rechts-Analyse
# ---------------------------------------------------------------------------
# Ab dieser prozentualen Mehrbelastung einer Seite wird ein Asymmetrie-Hinweis
# ausgegeben.
ASYMMETRY_THRESHOLD_PERCENT = 15.0


# ---------------------------------------------------------------------------
# Vorverarbeitung (preprocessing.py)
# ---------------------------------------------------------------------------
# Fenstergröße (Anzahl Samples) für die gleitende Mittelwert-Glättung.
# Klein halten, um die Flanken (Aktivierungszeitpunkte) nicht zu verschmieren.
SMOOTHING_WINDOW_SAMPLES = 3

# Soll pro Sensor auf 0..100 normalisiert werden? Default: aus, damit der
# physikalische Schwellenwert SENSOR_THRESHOLD direkt auf Rohwerte passt.
NORMALIZE_PER_SENSOR = False

# Zielbereich der optionalen Normalisierung.
NORMALIZE_RANGE_MAX = 100.0


# ---------------------------------------------------------------------------
# Rollende Statistiken / Glättung über mehrere Schritte
# ---------------------------------------------------------------------------
# Anzahl Schritte für rollende Mittelwerte (z. B. zur Stabilisierung von
# Verteilungskennzahlen über die Zeit).
ROLLING_WINDOW_STEPS = 5


# ---------------------------------------------------------------------------
# Visualisierung / Ausgabe
# ---------------------------------------------------------------------------
# Verzeichnisname (relativ zum Arbeitsverzeichnis), in das Plots gespeichert
# werden, wenn kein interaktives Display verfügbar ist.
OUTPUT_DIR = "output"


def summarize_config() -> "pd.DataFrame":
    """Gibt die wichtigsten Parameter als pandas DataFrame zurück (für Logs/Debug)."""
    params = {
        "sensor_threshold": SENSOR_THRESHOLD,
        "activation_threshold_percent": ACTIVATION_THRESHOLD_PERCENT,
        "min_step_duration_ms": MIN_STEP_DURATION_MS,
        "max_step_duration_ms": MAX_STEP_DURATION_MS,
        "min_swing_duration_ms": MIN_SWING_DURATION_MS,
        "flat_foot_time_window_ms": FLAT_FOOT_TIME_WINDOW_MS,
        "flat_foot_stance_ratio": FLAT_FOOT_STANCE_RATIO,
        "late_heel_contact_threshold_ms": LATE_HEEL_CONTACT_THRESHOLD_MS,
        "medial_lateral_threshold": MEDIAL_LATERAL_THRESHOLD,
        "asymmetry_threshold_percent": ASYMMETRY_THRESHOLD_PERCENT,
        "smoothing_window_samples": SMOOTHING_WINDOW_SAMPLES,
        "rolling_window_steps": ROLLING_WINDOW_STEPS,
    }
    return pd.DataFrame(list(params.items()), columns=["parameter", "value"])
