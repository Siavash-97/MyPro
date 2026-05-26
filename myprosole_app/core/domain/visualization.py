"""Matplotlib visualizations for pressure analysis."""

from __future__ import annotations

import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.patches import Ellipse, Polygon

from core.domain.pressure_analysis import PressureAnalysisResult
from core.domain.sensor_mapping import (
    FOOT_LABELS,
    FOOT_ORDER,
    HEEL,
    LATERAL_FOREFOOT,
    MEDIAL_FOREFOOT,
    REGION_ORDER,
    REGION_LABELS,
    VISUAL_FOOT_SIZE_EU,
    columns_for_region,
    visual_outline_for_foot,
    visual_region_for_foot,
)

PRESSURE_CMAP = LinearSegmentedColormap.from_list(
    "myprosole_pressure",
    ["#2563eb", "#22c55e", "#facc15", "#dc2626"],
)

REGION_SUMMARY_KEYS = {
    HEEL: ("heel_pressure_raw", "heel_percentage"),
    LATERAL_FOREFOOT: ("lateral_forefoot_raw", "lateral_forefoot_percentage"),
    MEDIAL_FOREFOOT: ("medial_forefoot_raw", "medial_forefoot_percentage"),
}


def plot_pressure_distribution(analysis: PressureAnalysisResult):
    """Draw a size-44 left/right foot pressure map from aggregate analysis data."""
    raw_values: list[float] = []
    for foot in FOOT_ORDER:
        for region in REGION_ORDER:
            if _region_available(analysis, foot, region):
                raw_value, _ = _region_values(analysis, foot, region)
                raw_values.append(raw_value)

    max_pressure = max(raw_values) if raw_values else 0.0
    norm = Normalize(vmin=0.0, vmax=max_pressure if max_pressure > 0 else 1.0)

    fig, axes = plt.subplots(1, 2, figsize=(10, 5))
    for ax, foot in zip(axes, FOOT_ORDER):
        _draw_foot_map(ax, analysis, foot, norm)

    sm = plt.cm.ScalarMappable(norm=norm, cmap=PRESSURE_CMAP)
    sm.set_array([])
    fig.colorbar(
        sm,
        ax=axes.ravel().tolist(),
        shrink=0.78,
        label="Ø Rohdruck (global skaliert)",
    )

    left_distribution = analysis.bilateral_summary.get(
        "left_right_distribution_percentage", 0.0
    )
    total_pressure = analysis.bilateral_summary.get("total_pressure_both", 0.0)
    right_distribution = 100.0 - left_distribution if total_pressure > 0 else 0.0
    fig.suptitle(f"Druckkarte Fußform Größe {VISUAL_FOOT_SIZE_EU}")
    fig.text(
        0.5,
        0.04,
        (
            "Links/Rechts-Verteilung: "
            f"{left_distribution:.1f} % links | {right_distribution:.1f} % rechts"
        ),
        ha="center",
        fontsize=10,
    )
    fig.subplots_adjust(top=0.84, bottom=0.16, wspace=0.18)
    return fig


def _draw_foot_map(ax, analysis: PressureAnalysisResult, foot: str, norm: Normalize) -> None:
    foot_summary = analysis.per_foot_summary.get(foot, {})
    total_pressure = foot_summary.get("total_pressure_raw", 0.0)
    has_foot_sensors = bool(analysis.sensor_columns.get(foot))
    title_status = (
        f"gesamt {total_pressure:.0f} raw" if has_foot_sensors else "nicht verfügbar"
    )

    ax.set_title(
        f"{FOOT_LABELS.get(foot, foot.title())} - {title_status}"
    )
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_aspect("equal")
    ax.axis("off")

    outline = Polygon(
        visual_outline_for_foot(foot),
        closed=True,
        facecolor="#f8fafc",
        edgecolor="#111827",
        linewidth=1.6,
        zorder=1,
    )
    ax.add_patch(outline)

    for region in REGION_ORDER:
        visual = visual_region_for_foot(foot, region)
        raw_value, percentage = _region_values(analysis, foot, region)
        is_available = _region_available(analysis, foot, region)
        intensity = float(norm(raw_value)) if is_available else 0.0
        zone = Ellipse(
            (visual.x, visual.y),
            width=visual.width,
            height=visual.height,
            facecolor=PRESSURE_CMAP(intensity) if is_available else "#e5e7eb",
            edgecolor="#111827" if is_available else "#9ca3af",
            linewidth=1.0,
            linestyle="solid" if is_available else "dashed",
            alpha=0.92 if is_available else 0.75,
            zorder=2,
        )
        ax.add_patch(zone)

        text_color = "white" if intensity >= 0.68 else "#111827"
        label = REGION_LABELS[region].split(" / ")[0]
        zone_label = (
            f"{label}\n{percentage:.1f} %\nraw {raw_value:.0f}"
            if is_available
            else f"{label}\nnicht\nverfügbar"
        )
        ax.text(
            visual.x,
            visual.y,
            zone_label,
            ha="center",
            va="center",
            fontsize=8,
            color=text_color,
            fontweight="bold",
            zorder=3,
        )

    ax.text(
        0.5,
        -0.04,
        "Farben: Blau niedrig, Grün/Gelb mittel, Rot hoch",
        ha="center",
        va="top",
        fontsize=8,
        color="#4b5563",
    )


def _region_values(
    analysis: PressureAnalysisResult,
    foot: str,
    region: str,
) -> tuple[float, float]:
    raw_key, percentage_key = REGION_SUMMARY_KEYS[region]
    foot_summary = analysis.per_foot_summary.get(foot, {})
    return (
        float(foot_summary.get(raw_key, 0.0)),
        float(foot_summary.get(percentage_key, 0.0)),
    )


def _region_available(analysis: PressureAnalysisResult, foot: str, region: str) -> bool:
    available_columns = set(analysis.sensor_columns.get(foot, []))
    return any(column in available_columns for column in columns_for_region(foot, region))
