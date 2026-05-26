"""Matplotlib visualizations for pressure analysis."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.patches import Ellipse, PathPatch
from matplotlib.path import Path

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

SOLE_CMAP = LinearSegmentedColormap.from_list(
    "myprosole_sole_silver",
    ["#9ca3af", "#e5e7eb", "#f8fafc"],
)

PRESSURE_CMAP = LinearSegmentedColormap.from_list(
    "myprosole_pressure",
    ["#2563eb", "#22c55e", "#facc15", "#dc2626"],
)

GRID_SIZE = 280

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

    fig, axes = plt.subplots(1, 2, figsize=(11.5, 5.8))
    for ax, foot in zip(axes, FOOT_ORDER):
        _draw_foot_map(ax, analysis, foot, norm)

    sm = plt.cm.ScalarMappable(norm=norm, cmap=PRESSURE_CMAP)
    sm.set_array([])
    fig.colorbar(
        sm,
        ax=axes.ravel().tolist(),
        shrink=0.52,
        orientation="horizontal",
        pad=0.08,
        label="Ø Rohdruck (relativ zur Messung)",
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
    fig.subplots_adjust(top=0.84, bottom=0.24, wspace=0.22)
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
    ax.set_xlim(-0.22, 1.22)
    ax.set_ylim(0, 1.04)
    ax.set_aspect("equal")
    ax.axis("off")

    outline_path = _smooth_outline_path(visual_outline_for_foot(foot))
    outline = _draw_sole_base(ax, outline_path, has_foot_sensors)
    _draw_pressure_heatmap(ax, analysis, foot, norm, outline)

    for region in REGION_ORDER:
        visual = visual_region_for_foot(foot, region)
        raw_value, percentage = _region_values(analysis, foot, region)
        is_available = _region_available(analysis, foot, region)
        if not is_available:
            missing_zone = Ellipse(
                (visual.x, visual.y),
                width=visual.width,
                height=visual.height,
                angle=visual.angle,
                facecolor="none",
                edgecolor="#6b7280",
                linewidth=0.9,
                linestyle=(0, (3, 3)),
                alpha=0.7,
                zorder=4,
            )
            ax.add_patch(missing_zone)

        _draw_region_callout(ax, visual, region, raw_value, percentage, is_available)


def _draw_sole_base(ax, outline_path: Path, has_foot_sensors: bool) -> PathPatch:
    edge_color = "#4b5563" if has_foot_sensors else "#9ca3af"
    outline = PathPatch(
        outline_path,
        facecolor="#d1d5db",
        edgecolor=edge_color,
        linewidth=1.8,
        alpha=1.0 if has_foot_sensors else 0.55,
        zorder=1,
    )
    ax.add_patch(outline)

    x = np.linspace(0.0, 1.0, GRID_SIZE)
    y = np.linspace(0.0, 1.0, GRID_SIZE)
    grid_x, grid_y = np.meshgrid(x, y)
    center_highlight = np.exp(
        -(
            ((grid_x - 0.48) ** 2) / (2 * 0.24**2)
            + ((grid_y - 0.52) ** 2) / (2 * 0.46**2)
        )
    )
    medial_shadow = 0.18 * np.clip(grid_x - 0.18, 0.0, 1.0)
    silver_field = np.clip(0.38 + 0.50 * center_highlight - medial_shadow, 0.0, 1.0)

    sole_shading = ax.imshow(
        silver_field,
        extent=(0, 1, 0, 1),
        origin="lower",
        cmap=SOLE_CMAP,
        interpolation="bicubic",
        alpha=0.95 if has_foot_sensors else 0.42,
        zorder=1.5,
    )
    sole_shading.set_clip_path(outline)
    return outline


def _draw_pressure_heatmap(
    ax,
    analysis: PressureAnalysisResult,
    foot: str,
    norm: Normalize,
    outline: PathPatch,
) -> None:
    x = np.linspace(0.0, 1.0, GRID_SIZE)
    y = np.linspace(0.0, 1.0, GRID_SIZE)
    grid_x, grid_y = np.meshgrid(x, y)
    pressure_field = np.zeros_like(grid_x)
    alpha_field = np.zeros_like(grid_x)

    for region in REGION_ORDER:
        if not _region_available(analysis, foot, region):
            continue

        raw_value, _ = _region_values(analysis, foot, region)
        visual = visual_region_for_foot(foot, region)
        blob = _elliptical_gaussian(grid_x, grid_y, visual)
        intensity = float(norm(raw_value))
        pressure_field = np.maximum(pressure_field, raw_value * blob)
        alpha_field = np.maximum(
            alpha_field,
            (0.18 + 0.60 * intensity) * np.power(blob, 0.72),
        )

    if not np.any(alpha_field):
        return

    heatmap = ax.imshow(
        pressure_field,
        extent=(0, 1, 0, 1),
        origin="lower",
        cmap=PRESSURE_CMAP,
        norm=norm,
        interpolation="bicubic",
        alpha=np.clip(alpha_field, 0.0, 0.82),
        zorder=3,
    )
    heatmap.set_clip_path(outline)


def _draw_region_callout(
    ax,
    visual,
    region: str,
    raw_value: float,
    percentage: float,
    is_available: bool,
) -> None:
    label = REGION_LABELS[region].split(" / ")[0]
    text = (
        f"{label}\n{percentage:.1f} % · raw {raw_value:.0f}"
        if is_available
        else f"{label}\nkein Sensor"
    )
    text_color = "#111827" if is_available else "#6b7280"
    edge_color = "#94a3b8" if is_available else "#cbd5e1"
    box_color = "#ffffff" if is_available else "#f1f5f9"
    horizontal_alignment = "left" if visual.callout_x >= visual.x else "right"

    ax.annotate(
        text,
        xy=(visual.x, visual.y),
        xytext=(visual.callout_x, visual.callout_y),
        ha=horizontal_alignment,
        va="center",
        fontsize=8,
        color=text_color,
        fontweight="bold" if is_available else "normal",
        linespacing=1.25,
        arrowprops={
            "arrowstyle": "-",
            "color": "#64748b" if is_available else "#94a3b8",
            "lw": 1.0,
            "linestyle": "solid" if is_available else (0, (3, 3)),
            "shrinkA": 4,
            "shrinkB": 4,
        },
        bbox={
            "boxstyle": "round,pad=0.35",
            "fc": box_color,
            "ec": edge_color,
            "lw": 0.9,
            "alpha": 0.96,
        },
        zorder=5,
    )


def _elliptical_gaussian(grid_x: np.ndarray, grid_y: np.ndarray, visual) -> np.ndarray:
    sigma_x = visual.sigma_x if visual.sigma_x is not None else visual.width / 3.0
    sigma_y = visual.sigma_y if visual.sigma_y is not None else visual.height / 3.0
    angle = np.deg2rad(visual.angle)
    shifted_x = grid_x - visual.x
    shifted_y = grid_y - visual.y
    rotated_x = np.cos(angle) * shifted_x + np.sin(angle) * shifted_y
    rotated_y = -np.sin(angle) * shifted_x + np.cos(angle) * shifted_y
    return np.exp(-0.5 * ((rotated_x / sigma_x) ** 2 + (rotated_y / sigma_y) ** 2))


def _smooth_outline_path(points: tuple[tuple[float, float], ...]) -> Path:
    smoothed_points = _catmull_rom_closed(points)
    vertices = np.vstack([smoothed_points, smoothed_points[0]])
    codes = (
        [Path.MOVETO]
        + [Path.LINETO] * (len(smoothed_points) - 1)
        + [Path.CLOSEPOLY]
    )
    return Path(vertices, codes)


def _catmull_rom_closed(
    points: tuple[tuple[float, float], ...],
    samples_per_segment: int = 16,
) -> np.ndarray:
    vertices = np.asarray(points, dtype=float)
    curve_points = []
    for index in range(len(vertices)):
        p0 = vertices[(index - 1) % len(vertices)]
        p1 = vertices[index]
        p2 = vertices[(index + 1) % len(vertices)]
        p3 = vertices[(index + 2) % len(vertices)]
        for t in np.linspace(0.0, 1.0, samples_per_segment, endpoint=False):
            t2 = t * t
            t3 = t2 * t
            curve_points.append(
                0.5
                * (
                    (2.0 * p1)
                    + (-p0 + p2) * t
                    + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                    + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
                )
            )
    return np.asarray(curve_points)


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
