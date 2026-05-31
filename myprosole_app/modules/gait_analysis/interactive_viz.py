"""
interactive_viz.py
==================
Interaktive Plotly-Visualisierungen NUR für die Streamlit-Gang-/Laufanalyse.

Diese Diagramme unterstützen natives Zoomen/Schwenken (Plotly-Toolbar) und das
Ein-/Ausblenden einzelner Sensortypen (S1 Ferse, S2 lateraler Vorfuß,
S3 medialer Vorfuß) sowie der Füße (links/rechts).

Wichtig: Die CLI nutzt weiterhin die statischen matplotlib-PNGs aus
``myprosole_analysis/visualization.py`` – dieses Modul ersetzt sie NICHT,
sondern ergänzt die interaktive Darstellung in der Web-UI.
"""

from __future__ import annotations

import plotly.graph_objects as go
from plotly.subplots import make_subplots

from myprosole_analysis import config as gait_config

# Sensor-Rollen (Index innerhalb der 3er-Spaltenliste eines Fußes) und Labels.
_SENSOR_ROLES = (
    ("S1", "heel", "Ferse (S1)", "#1f77b4"),
    ("S2", "lateral", "lateraler Vorfuß (S2)", "#ff7f0e"),
    ("S3", "medial", "medialer Vorfuß (S3)", "#2ca02c"),
)

_FOOT_COLUMNS = {
    "L": gait_config.LEFT_SENSOR_COLUMNS,
    "R": gait_config.RIGHT_SENSOR_COLUMNS,
}
_FOOT_TITLES = {"L": "Linker Fuß", "R": "Rechter Fuß"}


def _visible_feet(show_left: bool, show_right: bool) -> list[str]:
    feet = []
    if show_left:
        feet.append("L")
    if show_right:
        feet.append("R")
    return feet


def _visible_roles(show_s1: bool, show_s2: bool, show_s3: bool) -> list[tuple]:
    flags = {"S1": show_s1, "S2": show_s2, "S3": show_s3}
    return [role for role in _SENSOR_ROLES if flags[role[0]]]


def build_sensor_timeseries_plotly(
    df,
    *,
    show_s1: bool = True,
    show_s2: bool = True,
    show_s3: bool = True,
    show_left: bool = True,
    show_right: bool = True,
):
    """Interaktive Sensor-Zeitreihe (zoombar). Zeichnet nur sichtbare Sensoren/Füße."""
    feet = _visible_feet(show_left, show_right)
    roles = _visible_roles(show_s1, show_s2, show_s3)
    time = df[gait_config.TIME_COLUMN]

    if not feet:
        feet = ["L", "R"]  # Sicherheitsnetz: nie ganz leer rendern.

    titles = [f"{_FOOT_TITLES[f]} – Sensor-Zeitreihe" for f in feet]
    fig = make_subplots(
        rows=len(feet), cols=1, shared_xaxes=True, subplot_titles=titles,
        vertical_spacing=0.12,
    )

    for row_idx, foot in enumerate(feet, start=1):
        cols = _FOOT_COLUMNS[foot]
        for role_key, _role, label, color in roles:
            col = cols[gait_config.SENSOR_ROLE_INDEX[_role]]
            fig.add_trace(
                go.Scatter(
                    x=time,
                    y=df[col],
                    mode="lines",
                    name=f"{foot} {label}",
                    line=dict(color=color, width=1.4),
                    legendgroup=foot,
                    hovertemplate="t=%{x:.2f}s<br>%{y:.1f}<extra></extra>",
                ),
                row=row_idx,
                col=1,
            )
        # Schwellenwert-Linie.
        fig.add_hline(
            y=gait_config.SENSOR_THRESHOLD,
            line=dict(color="gray", dash="dash", width=1),
            row=row_idx,
            col=1,
        )
        fig.update_yaxes(title_text="Druck (Rohwert)", row=row_idx, col=1)

    fig.update_xaxes(title_text="Zeit (s)", row=len(feet), col=1)
    fig.update_layout(
        height=320 * len(feet),
        margin=dict(l=60, r=20, t=50, b=50),
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        dragmode="zoom",
    )
    return fig


def build_detected_steps_plotly(
    df,
    steps: list[dict],
    *,
    show_left: bool = True,
    show_right: bool = True,
):
    """Interaktive Standphasen-/Schrittansicht (zoombar) mit markierten Schritten."""
    feet = _visible_feet(show_left, show_right)
    if not feet:
        feet = ["L", "R"]

    time = df[gait_config.TIME_COLUMN]
    titles = [f"{_FOOT_TITLES[f]} – erkannte Standphasen" for f in feet]
    fig = make_subplots(
        rows=len(feet), cols=1, shared_xaxes=True, subplot_titles=titles,
        vertical_spacing=0.12,
    )

    foot_color = {"L": "#1f77b4", "R": "#ff7f0e"}
    for row_idx, foot in enumerate(feet, start=1):
        cols = _FOOT_COLUMNS[foot]
        foot_sum = df[cols].sum(axis=1)
        fig.add_trace(
            go.Scatter(
                x=time,
                y=foot_sum,
                mode="lines",
                name=f"Summe {foot}",
                line=dict(color=foot_color[foot], width=1.4),
                hovertemplate="t=%{x:.2f}s<br>Summe=%{y:.1f}<extra></extra>",
            ),
            row=row_idx,
            col=1,
        )

        y_max = float(foot_sum.max()) if len(foot_sum) else 1.0
        for step in steps:
            if step["foot"] != foot:
                continue
            start = step["stance_start_time"]
            end = step["stance_end_time"]
            fig.add_vrect(
                x0=start,
                x1=end,
                fillcolor="green",
                opacity=0.15,
                line_width=0,
                row=row_idx,
                col=1,
            )
            mid = (start + end) / 2.0
            fig.add_annotation(
                x=mid,
                y=y_max * 0.92 if y_max > 0 else 1.0,
                text=str(step["step_id"]),
                showarrow=False,
                font=dict(size=9, color="green"),
                row=row_idx,
                col=1,
            )
        fig.update_yaxes(title_text="Summendruck", row=row_idx, col=1)

    fig.update_xaxes(title_text="Zeit (s)", row=len(feet), col=1)
    fig.update_layout(
        height=320 * len(feet),
        margin=dict(l=60, r=20, t=50, b=50),
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        dragmode="zoom",
    )
    return fig
