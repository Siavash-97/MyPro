"""
generate_sample_data.py
========================
Erzeugt synthetische Beispiel-CSVs fuer die MyProSole-Analyse.
KEINE echten Messdaten – nur plausibel modellierte Verlaeufe.

Profile (je nach Lauf-/Belastungsstil):
- mixed            : gemischte Kontaktmuster (Default)
- heel_striker     : ueberwiegend klassischer Fersenaufsatz
- flat_foot        : flacher Aufsatz (Vorfuß folgt sehr schnell)
- forefoot_runner  : Vorfuß zuerst (mit/spaeter ohne Ferse)
- lateral_dominant : erhoehte laterale Vorfußbelastung
- variable_pace    : wechselnde Standphasenlaenge (langsam/schnell)

Aufruf:
    python generate_sample_data.py
    python generate_sample_data.py --profile forefoot_runner
    python generate_sample_data.py --all
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass

import numpy as np
import pandas as pd

SAMPLING_RATE_HZ = 100.0
N_STEPS_PER_FOOT = 20
GAIT_CYCLE_S = 1.10
STANCE_S = 0.62
RNG = np.random.default_rng(42)

PROFILE_NAMES = (
    "mixed",
    "heel_striker",
    "flat_foot",
    "forefoot_runner",
    "lateral_dominant",
    "variable_pace",
)


@dataclass(frozen=True)
class ProfileConfig:
    name: str
    description: str
    gait_cycle_s: float = GAIT_CYCLE_S
    stance_s: float = STANCE_S
    stance_jitter: float = 0.03


def _bump(
    t_rel: np.ndarray,
    start_frac: float,
    end_frac: float,
    peak: float,
) -> np.ndarray:
    out = np.zeros_like(t_rel)
    mask = (t_rel >= start_frac) & (t_rel <= end_frac)
    if np.any(mask) and end_frac > start_frac:
        phase = (t_rel[mask] - start_frac) / (end_frac - start_frac)
        out[mask] = peak * np.sin(np.pi * phase)
    return out


def _step_profile(variant: str) -> dict[str, tuple[float, float, float]]:
    profile = {
        "S1": (0.00, 0.55, 620.0),
        "S2": (0.35, 1.00, 480.0),
        "S3": (0.38, 1.00, 500.0),
    }

    if variant == "heel_normal":
        return profile

    if variant == "flat_foot":
        profile["S2"] = (0.06, 1.00, 470.0)
        profile["S3"] = (0.07, 1.00, 500.0)
        return profile

    if variant == "flat_foot_simultaneous":
        profile["S2"] = (0.00, 1.00, 500.0)
        profile["S3"] = (0.00, 1.00, 520.0)
        return profile

    if variant == "forefoot_late_heel":
        profile["S1"] = (0.30, 0.85, 420.0)
        profile["S2"] = (0.00, 0.95, 540.0)
        profile["S3"] = (0.02, 0.95, 560.0)
        return profile

    if variant == "forefoot_no_heel":
        profile["S1"] = (0.00, 0.10, 10.0)
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
        profile["S3"] = (0.08, 1.00, 560.0)
        profile["S2"] = (0.55, 1.00, 220.0)
        return profile

    return profile


def _variant_for_profile(profile: str, step_index: int) -> str:
    if profile == "heel_striker":
        return "heel_normal"

    if profile == "flat_foot":
        return "flat_foot_simultaneous" if step_index % 4 == 0 else "flat_foot"

    if profile == "forefoot_runner":
        return "forefoot_no_heel" if step_index % 3 == 0 else "forefoot_late_heel"

    if profile == "lateral_dominant":
        if step_index % 5 == 0:
            return "heel_normal"
        return "lateral_dominant"

    if profile == "variable_pace":
        return "heel_normal"

    special = {
        3: "flat_foot",
        6: "forefoot_late_heel",
        9: "lateral_dominant",
        11: "medial_dominant",
        14: "forefoot_no_heel",
        16: "early_medial",
        18: "flat_foot",
    }
    return special.get(step_index, "heel_normal")


def _stance_duration_for_profile(profile: str, step_index: int, base: float) -> float:
    if profile != "variable_pace":
        return base + RNG.normal(0.0, 0.03)

    pace_cycle = ("slow", "normal", "fast")
    pace = pace_cycle[step_index % len(pace_cycle)]
    if pace == "slow":
        return 0.78 + RNG.normal(0.0, 0.02)
    if pace == "fast":
        return 0.48 + RNG.normal(0.0, 0.02)
    return 0.62 + RNG.normal(0.0, 0.02)


def _generate_foot(
    time: np.ndarray,
    foot_offset_s: float,
    profile: str,
    *,
    gait_cycle_s: float,
    stance_s: float,
) -> dict[str, np.ndarray]:
    s1 = np.zeros_like(time)
    s2 = np.zeros_like(time)
    s3 = np.zeros_like(time)

    for i in range(N_STEPS_PER_FOOT):
        cycle_start = foot_offset_s + i * gait_cycle_s
        jitter = RNG.normal(0.0, 0.015)
        stance_start = cycle_start + jitter
        stance_dur = _stance_duration_for_profile(profile, i, stance_s)
        stance_end = stance_start + stance_dur

        mask = (time >= stance_start) & (time <= stance_end)
        if not np.any(mask):
            continue
        t_rel = (time[mask] - stance_start) / stance_dur

        variant = _variant_for_profile(profile, i)
        step_profile = _step_profile(variant)
        scale = RNG.normal(1.0, 0.05)

        for sensor, target in zip(("S1", "S2", "S3"), (s1, s2, s3)):
            start_frac, end_frac, peak = step_profile[sensor]
            target[mask] += _bump(t_rel, start_frac, end_frac, peak * scale)

    noise = lambda: RNG.normal(0.0, 4.0, size=time.shape)
    return {
        "heel": np.clip(s1 + noise(), 0, None),
        "lateral": np.clip(s2 + noise(), 0, None),
        "medial": np.clip(s3 + noise(), 0, None),
    }


def generate_dataframe(profile: str) -> pd.DataFrame:
    if profile not in PROFILE_NAMES:
        raise ValueError(f"Unbekanntes Profil: {profile}")

    gait_cycle_s = GAIT_CYCLE_S
    stance_s = STANCE_S
    if profile == "variable_pace":
        gait_cycle_s = 1.05

    total_duration = N_STEPS_PER_FOOT * gait_cycle_s + 1.0
    n_samples = int(total_duration * SAMPLING_RATE_HZ)
    time = np.arange(n_samples) / SAMPLING_RATE_HZ

    left = _generate_foot(
        time,
        foot_offset_s=0.20,
        profile=profile,
        gait_cycle_s=gait_cycle_s,
        stance_s=stance_s,
    )
    right = _generate_foot(
        time,
        foot_offset_s=0.20 + gait_cycle_s / 2.0,
        profile=profile,
        gait_cycle_s=gait_cycle_s,
        stance_s=stance_s,
    )

    return pd.DataFrame(
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


def generate(output_path: str, profile: str = "mixed") -> None:
    df = generate_dataframe(profile)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"{profile}: {output_path} ({len(df)} Zeilen)")


def generate_all(output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)
    for profile in PROFILE_NAMES:
        filename = "sample_data.csv" if profile == "mixed" else f"sample_{profile}.csv"
        generate(os.path.join(output_dir, filename), profile=profile)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthetische MyProSole-CSVs erzeugen")
    parser.add_argument(
        "--profile",
        default="mixed",
        choices=PROFILE_NAMES,
        help="Lauf-/Belastungsprofil",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Ziel-CSV (Default: sample_data/ im Skriptverzeichnis)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Alle Profile in sample_data/ erzeugen",
    )
    return parser.parse_args()


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_dir = os.path.join(script_dir, "sample_data")
    args = _parse_args()

    if args.all:
        generate_all(default_dir)
        root_copy = os.path.join(os.path.dirname(script_dir), "sample_data.csv")
        mixed_path = os.path.join(default_dir, "sample_data.csv")
        if os.path.isfile(mixed_path):
            pd.read_csv(mixed_path).to_csv(root_copy, index=False)
            print(f"mixed -> {root_copy}")
        return

    output = args.output
    if output is None:
        filename = (
            "sample_data.csv"
            if args.profile == "mixed"
            else f"sample_{args.profile}.csv"
        )
        output = os.path.join(default_dir, filename)
    generate(output, profile=args.profile)


if __name__ == "__main__":
    main()
