"""
main.py
=======
Einstiegspunkt der MyProSole Gang-/Laufanalyse.

Ablauf:
1. CSV laden            (data_loader)
2. Daten bereinigen     (preprocessing)
3. Schritte L/R erkennen (step_detection)
4. Features pro Schritt  (step_features)
5. Schritte klassifizieren (gait_classification)
6. Links-Rechts-Analyse  (left_right_analysis)
7. Ergebnistabellen ausgeben
8. Visualisierungen erzeugen (visualization)

Start:
    python main.py sample_data.csv
    python main.py            # nutzt automatisch sample_data.csv

Hinweis: matplotlib wird auf das nicht-interaktive Backend "Agg" gesetzt, damit
das Skript auch ohne Display nicht blockiert/abstuerzt. Die Plots werden als PNG
im Ordner ``output/`` gespeichert.
"""

from __future__ import annotations

import os
import sys

import matplotlib

# WICHTIG: Backend vor dem Import von pyplot/visualization festlegen.
# "Agg" ist nicht-interaktiv -> kein Display noetig, kein Blockieren.
matplotlib.use("Agg")

import pandas as pd

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
    from . import data_loader
    from . import preprocessing
    from . import step_detection
    from . import step_features
    from . import gait_classification
    from . import left_right_analysis
    from . import visualization
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config
    import data_loader
    import preprocessing
    import step_detection
    import step_features
    import gait_classification
    import left_right_analysis
    import visualization


# Anzeigeoptionen fuer pandas, damit die Tabellen sauber im Terminal erscheinen.
pd.set_option("display.max_columns", None)
pd.set_option("display.width", 200)
pd.set_option("display.float_format", lambda v: f"{v:,.2f}")


def build_step_table(steps: list[dict]) -> pd.DataFrame:
    """Erstellt die Step-Level-Tabelle mit den geforderten Spalten."""
    rows = []
    for s in steps:
        rows.append(
            {
                "step_id": s["step_id"],
                "foot": s["foot"],
                "start_time": round(s["start_time"], 3),
                "end_time": round(s["end_time"], 3),
                "stance_ms": _round_or_none(s.get("stance_duration_ms")),
                "swing_ms": _round_or_none(s.get("swing_duration_ms")),
                "cycle_ms": _round_or_none(s.get("gait_cycle_duration_ms")),
                "cadence_spm": _round_or_none(s.get("cadence_spm"), 1),
                "first_sensor": s.get("first_active_sensor"),
                "simultaneous": "+".join(s.get("simultaneous_sensors", [])) or None,
                "activation_order": "->".join(s.get("activation_order", [])),
                "heel_to_forefoot_ms": _round_or_none(s.get("heel_to_forefoot_time_ms")),
                "heel_to_forefoot_ratio": _round_or_none(
                    s.get("heel_to_forefoot_ratio"), 3
                ),
                "contact_pattern": s.get("contact_pattern"),
                "peak_S1": round(s.get("peak_S1", 0.0), 1),
                "peak_S2": round(s.get("peak_S2", 0.0), 1),
                "peak_S3": round(s.get("peak_S3", 0.0), 1),
                "medial_ratio": round(s.get("medial_ratio", 0.0), 2),
                "lateral_ratio": round(s.get("lateral_ratio", 0.0), 2),
                "classification_notes": s.get("classification_notes", ""),
            }
        )
    return pd.DataFrame(rows)


def build_summary_table(lr: dict) -> pd.DataFrame:
    """Erstellt die Summary-Tabelle (eine Kennzahl je Zeile)."""
    summary = {
        "total_step_count": lr["total_step_count"],
        "step_count_left": lr["step_count_left"],
        "step_count_right": lr["step_count_right"],
        "dominant_side": lr["dominant_side"],
        "load_difference_percent": round(lr["load_difference_percent"], 2),
        "average_stance_duration_left": round(lr["average_stance_duration_left"], 2),
        "average_stance_duration_right": round(lr["average_stance_duration_right"], 2),
        "average_swing_duration_left": round(lr["average_swing_duration_left"], 2),
        "average_swing_duration_right": round(lr["average_swing_duration_right"], 2),
        "stance_swing_ratio_left": round(lr["stance_swing_ratio_left"], 2),
        "stance_swing_ratio_right": round(lr["stance_swing_ratio_right"], 2),
    }
    return pd.DataFrame(list(summary.items()), columns=["Kennzahl", "Wert"])


def _round_or_none(value, ndigits: int = 1):
    """Rundet einen Wert oder gibt None unveraendert zurueck."""
    return round(value, ndigits) if value is not None else None


def run_analysis(csv_path: str) -> None:
    """Fuehrt die komplette Analysepipeline fuer eine CSV-Datei aus."""
    print("=" * 80)
    print("MyProSole – Gang-/Laufanalyse")
    print("=" * 80)
    print(f"Eingabedatei: {csv_path}\n")

    # 1) Laden
    df_raw = data_loader.load_csv(csv_path)
    sampling_rate = config.estimate_sampling_rate(df_raw[config.TIME_COLUMN])
    print(f"Datensaetze geladen: {len(df_raw)}")
    print(f"Geschaetzte Abtastrate: {sampling_rate:.1f} Hz\n")

    # 2) Bereinigen
    df = preprocessing.clean_and_smooth(df_raw)

    # 3) Schritte erkennen
    steps = step_detection.detect_all_steps(df)
    print(f"Erkannte Schritte gesamt: {len(steps)}")

    if not steps:
        print("Es wurden keine gueltigen Schritte erkannt. Analyse abgebrochen.")
        return

    # 4) Features berechnen
    step_features.compute_features_for_steps(steps)

    # 5) Klassifizieren
    gait_classification.classify_steps(steps)

    # 6) Links-Rechts-Analyse
    lr = left_right_analysis.analyze_left_right(steps)

    # 7) Tabellen ausgeben
    step_table = build_step_table(steps)
    summary_table = build_summary_table(lr)

    print("\n" + "-" * 80)
    print("STEP-LEVEL-TABELLE")
    print("-" * 80)
    print(step_table.to_string(index=False))

    print("\n" + "-" * 80)
    print("SUMMARY-TABELLE")
    print("-" * 80)
    print(summary_table.to_string(index=False))

    print("\n" + "-" * 80)
    print("HINWEIS LINKS/RECHTS")
    print("-" * 80)
    print(lr["asymmetry_note"])

    print("\nKontaktmuster-Verteilung (Links, % der Schritte):")
    _print_distribution(lr["contact_pattern_distribution_left"])
    print("\nKontaktmuster-Verteilung (Rechts, % der Schritte):")
    _print_distribution(lr["contact_pattern_distribution_right"])

    # 8) Visualisierungen
    print("\n" + "-" * 80)
    print("VISUALISIERUNGEN")
    print("-" * 80)
    created = visualization.create_all_visualizations(df, steps, lr)
    for path in created:
        print(f"  gespeichert: {path}")

    print("\nAnalyse abgeschlossen.")


def _print_distribution(distribution: dict) -> None:
    """Gibt eine Kontaktmuster-Verteilung kompakt aus."""
    for pattern, percent in distribution.items():
        print(f"  {pattern:<42}: {percent:5.1f} %")


def main() -> None:
    """Liest das CLI-Argument und startet die Analyse."""
    # Default: sample_data.csv im Verzeichnis dieses Skripts.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_csv = os.path.join(script_dir, "sample_data.csv")

    csv_path = sys.argv[1] if len(sys.argv) > 1 else default_csv

    try:
        run_analysis(csv_path)
    except (FileNotFoundError, data_loader.DataValidationError) as exc:
        print("FEHLER:", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
