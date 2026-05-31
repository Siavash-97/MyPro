"""
generate_sample_data.py
========================
Erzeugt ein realistisches synthetisches Beispiel-CSV (sample_data.csv) fuer die
MyProSole-Analyse. KEINE echten Messdaten – nur plausibel modellierte Verlaeufe.

Modell je Fuß und Schritt:
- Gangzyklus ~1.1 s, Standphase ~0.62 s, Schwungphase Rest.
- Linker und rechter Fuß sind zeitlich versetzt (alternierendes Gehen).
- Jeder Sensor wird als glatter "Druck-Hubbel" (halbe Sinuswelle) modelliert.
- Verschiedene Schrittvarianten, damit unterschiedliche Kontaktmuster auftreten:
  Fersenaufsatz, flacher Aufsatz, Vorfußaufsatz, medial/lateral dominant, usw.

Aufruf:
    python generate_sample_data.py
"""

from __future__ import annotations

import os

import numpy as np
import pandas as pd

SAMPLING_RATE_HZ = 100.0
N_STEPS_PER_FOOT = 20
GAIT_CYCLE_S = 1.10           # Dauer eines vollen Gangzyklus pro Fuß
STANCE_S = 0.62               # mittlere Standphasendauer
RNG = np.random.default_rng(42)  # fester Seed -> reproduzierbar


def _bump(t_rel: np.ndarray, start_frac: float, end_frac: float,
          peak: float) -> np.ndarray:
    """Erzeugt einen glatten Druckverlauf (halbe Sinuswelle) innerhalb eines Fensters.

    Args:
        t_rel: normierte Zeit innerhalb der Standphase (0..1).
        start_frac: relativer Start der Sensoraktivitaet (0..1).
        end_frac: relatives Ende der Sensoraktivitaet (0..1).
        peak: Maximaldruck dieses Sensors.

    Returns:
        Array gleicher Laenge wie t_rel mit dem Druckverlauf.
    """
    out = np.zeros_like(t_rel)
    mask = (t_rel >= start_frac) & (t_rel <= end_frac)
    if np.any(mask) and end_frac > start_frac:
        phase = (t_rel[mask] - start_frac) / (end_frac - start_frac)
        out[mask] = peak * np.sin(np.pi * phase)
    return out


def _step_profile(variant: str) -> dict:
    """Liefert die Sensorparameter (Fenster + Peaks) fuer eine Schrittvariante."""
    # Defaults: klassischer Fersenaufsatz mit ausgeglichenem Vorfuß.
    profile = {
        "S1": (0.00, 0.55, 620.0),   # Ferse: frueh aktiv
        "S2": (0.35, 1.00, 480.0),   # lateraler Vorfuß: spaeter
        "S3": (0.38, 1.00, 500.0),   # medialer Vorfuß: spaeter
    }

    if variant == "heel_normal":
        return profile

    if variant == "flat_foot":
        # Vorfuß folgt sehr schnell auf die Ferse.
        profile["S2"] = (0.06, 1.00, 470.0)
        profile["S3"] = (0.07, 1.00, 500.0)
        return profile

    if variant == "forefoot_late_heel":
        # Vorfuß zuerst, Ferse folgt spaeter in der Standphase.
        profile["S1"] = (0.30, 0.85, 420.0)
        profile["S2"] = (0.00, 0.95, 540.0)
        profile["S3"] = (0.02, 0.95, 560.0)
        return profile

    if variant == "forefoot_no_heel":
        # Vorfuß belastet, kaum/kein Fersenkontakt.
        profile["S1"] = (0.00, 0.10, 10.0)   # bleibt unter Schwelle
        profile["S2"] = (0.00, 1.00, 560.0)
        profile["S3"] = (0.02, 1.00, 580.0)
        return profile

    if variant == "medial_dominant":
        profile["S2"] = (0.35, 1.00, 300.0)
        profile["S3"] = (0.36, 1.00, 640.0)
        return profile

    if variant == "lateral_dominant":
        profile["S2"] = (0.35, 1.00, 640.0)
        profile["S3"] = (0.36, 1.00, 300.0)
        return profile

    if variant == "early_medial":
        # Ferse zuerst, medialer Vorfuß sehr frueh, lateral niedrig/spaet.
        profile["S3"] = (0.08, 1.00, 560.0)
        profile["S2"] = (0.55, 1.00, 220.0)
        return profile

    return profile


def _variant_for_index(i: int) -> str:
    """Verteilt Varianten ueber die Schritte (meist Fersenaufsatz, einige Sonderfaelle)."""
    special = {
        3: "flat_foot",
        6: "forefoot_late_heel",
        9: "lateral_dominant",
        11: "medial_dominant",
        14: "forefoot_no_heel",
        16: "early_medial",
        18: "flat_foot",
    }
    return special.get(i, "heel_normal")


def _generate_foot(time: np.ndarray, foot_offset_s: float) -> dict:
    """Erzeugt die 3 Sensor-Zeitreihen fuer einen Fuß."""
    s1 = np.zeros_like(time)
    s2 = np.zeros_like(time)
    s3 = np.zeros_like(time)

    for i in range(N_STEPS_PER_FOOT):
        # Startzeitpunkt der Standphase inkl. kleiner zufaelliger Schwankung.
        cycle_start = foot_offset_s + i * GAIT_CYCLE_S
        jitter = RNG.normal(0.0, 0.015)
        stance_start = cycle_start + jitter
        stance_dur = STANCE_S + RNG.normal(0.0, 0.03)
        stance_end = stance_start + stance_dur

        # Indizes der Standphase im Zeitvektor.
        mask = (time >= stance_start) & (time <= stance_end)
        if not np.any(mask):
            continue
        t_rel = (time[mask] - stance_start) / stance_dur

        variant = _variant_for_index(i)
        profile = _step_profile(variant)

        # Kleine zufaellige Peak-Variation pro Schritt fuer Realismus.
        scale = RNG.normal(1.0, 0.05)

        for sensor, target in zip(("S1", "S2", "S3"), (s1, s2, s3)):
            start_frac, end_frac, peak = profile[sensor]
            target[mask] += _bump(t_rel, start_frac, end_frac, peak * scale)

    # Leichtes Sensorrauschen ergaenzen.
    noise = lambda: RNG.normal(0.0, 4.0, size=time.shape)
    s1 = np.clip(s1 + noise(), 0, None)
    s2 = np.clip(s2 + noise(), 0, None)
    s3 = np.clip(s3 + noise(), 0, None)
    return {"heel": s1, "lateral": s2, "medial": s3}


def generate(output_path: str) -> None:
    """Erzeugt die komplette CSV und speichert sie."""
    total_duration = N_STEPS_PER_FOOT * GAIT_CYCLE_S + 1.0
    n_samples = int(total_duration * SAMPLING_RATE_HZ)
    time = np.arange(n_samples) / SAMPLING_RATE_HZ

    # Rechter Fuß startet um einen halben Gangzyklus versetzt (alternierend).
    left = _generate_foot(time, foot_offset_s=0.20)
    right = _generate_foot(time, foot_offset_s=0.20 + GAIT_CYCLE_S / 2.0)

    df = pd.DataFrame(
        {
            "time_s": np.round(time, 3),
            "L1_heel": np.round(left["heel"], 1),
            "L2_lateral_forefoot": np.round(left["lateral"], 1),
            "L3_medial_forefoot": np.round(left["medial"], 1),
            "R1_heel": np.round(right["heel"], 1),
            "R2_lateral_forefoot": np.round(right["lateral"], 1),
            "R3_medial_forefoot": np.round(right["medial"], 1),
        }
    )
    df.to_csv(output_path, index=False)
    print(f"sample_data.csv erzeugt: {output_path} ({len(df)} Zeilen)")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data.csv")
    generate(out)
