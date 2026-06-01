"""
threshold_sensitivity.py
========================
Phase-0-Hilfsskript: prueft, wie stabil Schritterkennung und Klassifikation
bei verschiedenen SENSOR_THRESHOLD-Werten bleiben.

Aufruf:
    python threshold_sensitivity.py
    python threshold_sensitivity.py myprosole_analysis/sample_data/sample_flat_foot.csv
"""

from __future__ import annotations

import os
import sys
from collections import Counter

try:
    from . import config
    from . import data_loader
    from . import gait_classification
    from . import preprocessing
    from . import step_detection
    from . import step_features
except ImportError:
    import config
    import data_loader
    import gait_classification
    import preprocessing
    import step_detection
    import step_features


def analyze_thresholds(
    csv_path: str,
    thresholds: tuple[float, ...] | None = None,
) -> list[dict]:
    thresholds = thresholds or config.SENSOR_THRESHOLD_SENSITIVITY_VALUES
    df_raw = data_loader.load_csv(csv_path)
    df = preprocessing.clean_and_smooth(df_raw)

    rows: list[dict] = []
    for threshold in thresholds:
        steps = step_detection.detect_all_steps(df, threshold=threshold)
        step_features.compute_features_for_steps(steps, threshold=threshold)
        gait_classification.classify_steps(steps)

        classifications = Counter(s.get("classification", "unclear") for s in steps)
        patterns = Counter(s.get("contact_pattern", "unclear") for s in steps)
        ratios = [
            s["heel_to_forefoot_ratio"]
            for s in steps
            if s.get("heel_to_forefoot_ratio") is not None
        ]
        avg_ratio = sum(ratios) / len(ratios) if ratios else None

        rows.append(
            {
                "threshold": threshold,
                "step_count": len(steps),
                "classifications": dict(classifications),
                "contact_patterns": dict(patterns),
                "avg_heel_to_forefoot_ratio": avg_ratio,
            }
        )
    return rows


def _format_row(row: dict) -> str:
    ratio = row["avg_heel_to_forefoot_ratio"]
    ratio_text = f"{ratio:.3f}" if ratio is not None else "n/a"
    return (
        f"threshold={row['threshold']:.0f} | steps={row['step_count']} | "
        f"avg_ratio={ratio_text} | classes={row['classifications']}"
    )


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_csv = os.path.join(script_dir, "sample_data", "sample_data.csv")
    csv_path = sys.argv[1] if len(sys.argv) > 1 else default_csv

    if not os.path.isfile(csv_path):
        print(f"FEHLER: Datei nicht gefunden: {csv_path}")
        print("Bitte zuerst: python generate_sample_data.py --all")
        sys.exit(1)

    print("=" * 80)
    print("MyProSole – Threshold-Sensitivitaet (Phase 0)")
    print("=" * 80)
    print(f"Eingabe: {csv_path}\n")

    rows = analyze_thresholds(csv_path)
    for row in rows:
        print(_format_row(row))

    step_counts = [row["step_count"] for row in rows]
    stable_steps = max(step_counts) - min(step_counts)
    print(
        f"\nStabilitaet Schrittzahl ueber alle Thresholds: "
        f"min={min(step_counts)}, max={max(step_counts)}, delta={stable_steps}"
    )


if __name__ == "__main__":
    main()
