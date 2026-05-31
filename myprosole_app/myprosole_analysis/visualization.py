"""
visualization.py
================
Einfache matplotlib-Visualisierungen der Analyseergebnisse (keine UI-Frameworks).

Enthaltene Darstellungen:
1. Zeitreihe aller Sensoren (L und R)
2. Erkannte Schritte im Zeitverlauf markiert
3. Balkendiagramm Peak-Druck L vs R
4. Balkendiagramm durchschnittlicher Gesamtdruck L vs R
5. Balkendiagramm mediale/laterale Ratio L vs R
6. Tabelle der Schrittklassifikationen

Die Figuren werden standardmaessig als PNG gespeichert. Nur wenn ein
interaktives Backend verfuegbar ist, werden sie zusaetzlich angezeigt. So
crasht das Skript auch ohne Display nicht.
"""

from __future__ import annotations

import os

import matplotlib
import matplotlib.pyplot as plt

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config


def _save_and_maybe_show(fig, save_path: str, show: bool) -> None:
    """Speichert eine Figur als PNG und zeigt sie optional an."""
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    fig.savefig(save_path, dpi=110, bbox_inches="tight")
    if show:
        plt.show()
    plt.close(fig)


def is_interactive_backend() -> bool:
    """True, wenn ein interaktives matplotlib-Backend aktiv ist (Display vorhanden)."""
    backend = matplotlib.get_backend().lower()
    return "agg" not in backend


def build_sensor_timeseries_figure(df):
    """(1) Baut die Figur 'Zeitreihe aller 6 Sensoren' und gibt sie zurueck.

    Reine Figur-Erzeugung ohne Speichern/Anzeigen, damit sie sowohl in der CLI
    als auch in Streamlit (st.pyplot) verwendet werden kann.
    """
    time = df[config.TIME_COLUMN]
    fig, (ax_l, ax_r) = plt.subplots(2, 1, figsize=(12, 7), sharex=True)

    labels = ["Ferse (S1)", "lateraler Vorfuß (S2)", "medialer Vorfuß (S3)"]

    for col, label in zip(config.LEFT_SENSOR_COLUMNS, labels):
        ax_l.plot(time, df[col], label=label, linewidth=1.0)
    ax_l.axhline(config.SENSOR_THRESHOLD, color="gray", linestyle="--", linewidth=0.8,
                 label="Schwellenwert")
    ax_l.set_title("Linker Fuß – Sensor-Zeitreihe")
    ax_l.set_ylabel("Druck (Rohwert)")
    ax_l.legend(loc="upper right", fontsize=8)
    ax_l.grid(True, alpha=0.3)

    for col, label in zip(config.RIGHT_SENSOR_COLUMNS, labels):
        ax_r.plot(time, df[col], label=label, linewidth=1.0)
    ax_r.axhline(config.SENSOR_THRESHOLD, color="gray", linestyle="--", linewidth=0.8,
                 label="Schwellenwert")
    ax_r.set_title("Rechter Fuß – Sensor-Zeitreihe")
    ax_r.set_xlabel("Zeit (s)")
    ax_r.set_ylabel("Druck (Rohwert)")
    ax_r.legend(loc="upper right", fontsize=8)
    ax_r.grid(True, alpha=0.3)

    fig.tight_layout()
    return fig


def build_detected_steps_figure(df, steps: list[dict]):
    """(2) Baut die Figur 'erkannte Standphasen im Zeitverlauf' (L oben, R unten)."""
    time = df[config.TIME_COLUMN]
    fig, (ax_l, ax_r) = plt.subplots(2, 1, figsize=(12, 7), sharex=True)

    # Hintergrund: Gesamtdruck pro Fuß als Orientierung.
    left_sum = df[config.LEFT_SENSOR_COLUMNS].sum(axis=1)
    right_sum = df[config.RIGHT_SENSOR_COLUMNS].sum(axis=1)
    ax_l.plot(time, left_sum, color="steelblue", linewidth=1.0, label="Summe L")
    ax_r.plot(time, right_sum, color="darkorange", linewidth=1.0, label="Summe R")

    for step in steps:
        ax = ax_l if step["foot"] == "L" else ax_r
        ax.axvspan(step["stance_start_time"], step["stance_end_time"],
                   color="green", alpha=0.15)
        # Schritt-ID mittig beschriften.
        mid = (step["stance_start_time"] + step["stance_end_time"]) / 2.0
        ax.text(mid, ax.get_ylim()[1] * 0.9, str(step["step_id"]),
                ha="center", va="top", fontsize=7, color="green")

    ax_l.set_title("Linker Fuß – erkannte Standphasen (grün)")
    ax_l.set_ylabel("Summendruck")
    ax_l.grid(True, alpha=0.3)
    ax_l.legend(loc="upper right", fontsize=8)

    ax_r.set_title("Rechter Fuß – erkannte Standphasen (grün)")
    ax_r.set_xlabel("Zeit (s)")
    ax_r.set_ylabel("Summendruck")
    ax_r.grid(True, alpha=0.3)
    ax_r.legend(loc="upper right", fontsize=8)

    fig.tight_layout()
    return fig


def build_peak_pressure_lr_figure(lr: dict):
    """(3) Baut das Balkendiagramm 'durchschnittlicher Peak-Druck L vs R'."""
    fig, ax = plt.subplots(figsize=(6, 5))
    values = [lr["average_peak_pressure_left"], lr["average_peak_pressure_right"]]
    bars = ax.bar(["Links", "Rechts"], values, color=["steelblue", "darkorange"])
    ax.set_title("Durchschnittlicher Peak-Druck L vs R")
    ax.set_ylabel("Peak-Druck (Rohwert)")
    _label_bars(ax, bars)
    ax.grid(True, axis="y", alpha=0.3)
    fig.tight_layout()
    return fig


def build_total_pressure_lr_figure(lr: dict):
    """(4) Baut das Balkendiagramm 'durchschnittlicher Gesamtdruck L vs R'."""
    fig, ax = plt.subplots(figsize=(6, 5))
    values = [lr["average_total_pressure_left"], lr["average_total_pressure_right"]]
    bars = ax.bar(["Links", "Rechts"], values, color=["steelblue", "darkorange"])
    ax.set_title("Durchschnittlicher Gesamtdruck L vs R")
    ax.set_ylabel("Gesamtdruck (Summe Peaks)")
    _label_bars(ax, bars)
    ax.grid(True, axis="y", alpha=0.3)
    fig.tight_layout()
    return fig


def build_medial_lateral_ratio_figure(lr: dict):
    """(5) Baut das Balkendiagramm 'mediale/laterale Ratio L vs R'."""
    fig, ax = plt.subplots(figsize=(7, 5))
    groups = ["Links", "Rechts"]
    medial = [lr["average_medial_ratio_left"], lr["average_medial_ratio_right"]]
    lateral = [lr["average_lateral_ratio_left"], lr["average_lateral_ratio_right"]]

    x = range(len(groups))
    width = 0.35
    bars_m = ax.bar([i - width / 2 for i in x], medial, width,
                    label="medial (S3)", color="mediumseagreen")
    bars_l = ax.bar([i + width / 2 for i in x], lateral, width,
                    label="lateral (S2)", color="indianred")
    ax.set_xticks(list(x))
    ax.set_xticklabels(groups)
    ax.set_title("Mediale vs. laterale Vorfuß-Ratio")
    ax.set_ylabel("Anteil am Vorfußdruck")
    ax.set_ylim(0, 1.0)
    ax.legend()
    _label_bars(ax, bars_m, fmt="{:.2f}")
    _label_bars(ax, bars_l, fmt="{:.2f}")
    ax.grid(True, axis="y", alpha=0.3)
    fig.tight_layout()
    return fig


def build_classification_table_figure(steps: list[dict]):
    """(6) Baut die Tabelle der Schrittklassifikationen als Figur."""
    columns = ["step_id", "foot", "contact_pattern", "classification", "notes"]
    rows = []
    for s in steps:
        rows.append([
            s["step_id"],
            s["foot"],
            s.get("contact_pattern", ""),
            s.get("classification", ""),
            _shorten(s.get("classification_notes", ""), 45),
        ])

    # Tabellenhoehe an Zeilenanzahl anpassen.
    fig_height = max(2.0, 0.35 * (len(rows) + 1))
    fig, ax = plt.subplots(figsize=(12, fig_height))
    ax.axis("off")
    table = ax.table(cellText=rows, colLabels=columns, loc="center", cellLoc="left")
    table.auto_set_font_size(False)
    table.set_fontsize(7)
    table.scale(1, 1.2)
    ax.set_title("Schrittklassifikationen", fontweight="bold")
    fig.tight_layout()
    return fig


def plot_sensor_timeseries(df, save_path: str, show: bool = False) -> None:
    """(1) Zeitreihe aller 6 Sensoren – baut die Figur und speichert sie als PNG."""
    fig = build_sensor_timeseries_figure(df)
    _save_and_maybe_show(fig, save_path, show)


def plot_detected_steps(df, steps: list[dict], save_path: str, show: bool = False) -> None:
    """(2) Markiert erkannte Standphasen im Zeitverlauf und speichert sie als PNG."""
    fig = build_detected_steps_figure(df, steps)
    _save_and_maybe_show(fig, save_path, show)


def plot_peak_pressure_lr(lr: dict, save_path: str, show: bool = False) -> None:
    """(3) Balkendiagramm: durchschnittlicher Peak-Druck L vs R (als PNG)."""
    fig = build_peak_pressure_lr_figure(lr)
    _save_and_maybe_show(fig, save_path, show)


def plot_total_pressure_lr(lr: dict, save_path: str, show: bool = False) -> None:
    """(4) Balkendiagramm: durchschnittlicher Gesamtdruck L vs R (als PNG)."""
    fig = build_total_pressure_lr_figure(lr)
    _save_and_maybe_show(fig, save_path, show)


def plot_medial_lateral_ratio(lr: dict, save_path: str, show: bool = False) -> None:
    """(5) Balkendiagramm: mediale/laterale Ratio L vs R (als PNG)."""
    fig = build_medial_lateral_ratio_figure(lr)
    _save_and_maybe_show(fig, save_path, show)


def plot_classification_table(steps: list[dict], save_path: str, show: bool = False) -> None:
    """(6) Tabelle der Schrittklassifikationen (als PNG)."""
    fig = build_classification_table_figure(steps)
    _save_and_maybe_show(fig, save_path, show)


def _label_bars(ax, bars, fmt: str = "{:.1f}") -> None:
    """Beschriftet Balken mit ihrem Wert."""
    for bar in bars:
        height = bar.get_height()
        ax.annotate(fmt.format(height),
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3), textcoords="offset points",
                    ha="center", va="bottom", fontsize=8)


def _shorten(text: str, max_len: int) -> str:
    """Kuerzt langen Text fuer die Tabellendarstellung."""
    if text and len(text) > max_len:
        return text[: max_len - 1] + "…"
    return text


def create_all_visualizations(df, steps: list[dict], lr: dict,
                              output_dir: str | None = None,
                              show: bool | None = None) -> list[str]:
    """Erzeugt alle Visualisierungen und gibt die Liste der Speicherpfade zurueck.

    Args:
        df: Bereinigter DataFrame.
        steps: Klassifizierte Schritte.
        lr: Ergebnis der Links-Rechts-Analyse.
        output_dir: Zielverzeichnis fuer PNGs (Default: config.OUTPUT_DIR).
        show: Erzwingt Anzeigen (True) oder Nur-Speichern (False). None = automatisch.

    Returns:
        Liste der erzeugten Dateipfade.
    """
    if output_dir is None:
        output_dir = config.OUTPUT_DIR
    if show is None:
        show = is_interactive_backend()

    paths = {
        "01_sensor_timeseries.png": lambda p: plot_sensor_timeseries(df, p, show),
        "02_detected_steps.png": lambda p: plot_detected_steps(df, steps, p, show),
        "03_peak_pressure_lr.png": lambda p: plot_peak_pressure_lr(lr, p, show),
        "04_total_pressure_lr.png": lambda p: plot_total_pressure_lr(lr, p, show),
        "05_medial_lateral_ratio.png": lambda p: plot_medial_lateral_ratio(lr, p, show),
        "06_classification_table.png": lambda p: plot_classification_table(steps, p, show),
    }

    created: list[str] = []
    for filename, plot_func in paths.items():
        full_path = os.path.join(output_dir, filename)
        plot_func(full_path)
        created.append(full_path)
    return created
