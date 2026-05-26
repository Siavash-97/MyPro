"""Matplotlib visualizations for pressure analysis."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.patches import FancyBboxPatch

from core.domain.pressure_analysis import PressureAnalysisResult
from core.domain.sensor_mapping import (
    FOOT_LABELS,
    FOOT_ORDER,
    HEEL,
    LATERAL_FOREFOOT,
    MEDIAL_FOREFOOT,
    REGION_ORDER,
    REGION_LABELS,
    RIGHT,
    VISUAL_FOOT_SIZE_EU,
    columns_for_region,
    visual_region_for_foot,
)

PRESSURE_CMAP = LinearSegmentedColormap.from_list(
    "myprosole_pressure",
    ["#2563eb", "#22c55e", "#facc15", "#dc2626"],
)

GRID_SIZE = 280
APP_ROOT = Path(__file__).resolve().parents[2]
FOOT_TEMPLATE_LEFT_PATH = APP_ROOT / "assets" / "foot_template_left.png"

REGION_SUMMARY_KEYS = {
    HEEL: ("heel_pressure_raw", "heel_percentage"),
    LATERAL_FOREFOOT: ("lateral_forefoot_raw", "lateral_forefoot_percentage"),
    MEDIAL_FOREFOOT: ("medial_forefoot_raw", "medial_forefoot_percentage"),
}


def plot_pressure_distribution(
    analysis: PressureAnalysisResult,
    *,
    show_labels: bool = False,
):
    """Draw an app-style left/right pressure map from aggregate analysis data."""
    raw_values: list[float] = []
    for foot in FOOT_ORDER:
        for region in REGION_ORDER:
            if _region_available(analysis, foot, region):
                raw_value, _ = _region_values(analysis, foot, region)
                raw_values.append(raw_value)

    max_pressure = max(raw_values) if raw_values else 0.0
    norm = Normalize(vmin=0.0, vmax=max_pressure if max_pressure > 0 else 1.0)

    fig, axes = plt.subplots(1, 2, figsize=(10.5, 5.8))
    fig.patch.set_facecolor("#f8fafc")
    for ax, foot in zip(axes, FOOT_ORDER):
        _draw_foot_map(ax, analysis, foot, norm, show_labels=show_labels)

    left_distribution = analysis.bilateral_summary.get(
        "left_right_distribution_percentage", 0.0
    )
    total_pressure = analysis.bilateral_summary.get("total_pressure_both", 0.0)
    right_distribution = 100.0 - left_distribution if total_pressure > 0 else 0.0
    fig.suptitle("Druckkarte", fontsize=15, fontweight="bold", y=0.95)
    fig.text(
        0.5,
        0.075,
        (
            "Links/Rechts-Verteilung: "
            f"{left_distribution:.1f} % links | {right_distribution:.1f} % rechts"
        ),
        ha="center",
        fontsize=9.5,
        color="#334155",
    )
    fig.text(
        0.5,
        0.035,
        (
            f"Template Größe {VISUAL_FOOT_SIZE_EU}; Heatmap aus vorhandenen "
            "Sensorwerten, Farbintensität relativ zur aktuellen Messung."
        ),
        ha="center",
        fontsize=8.5,
        color="#64748b",
    )
    fig.subplots_adjust(top=0.86, bottom=0.16, left=0.04, right=0.96, wspace=0.08)
    return fig


def _draw_foot_map(
    ax,
    analysis: PressureAnalysisResult,
    foot: str,
    norm: Normalize,
    *,
    show_labels: bool,
) -> None:
    foot_summary = analysis.per_foot_summary.get(foot, {})
    total_pressure = foot_summary.get("total_pressure_raw", 0.0)
    has_foot_sensors = bool(analysis.sensor_columns.get(foot))

    _style_foot_axis(ax)
    _draw_card(ax)
    ax.text(
        0.08,
        0.935,
        FOOT_LABELS.get(foot, foot.title()),
        transform=ax.transAxes,
        ha="left",
        va="center",
        fontsize=12,
        fontweight="bold",
        color="#0f172a",
        zorder=6,
    )

    if not has_foot_sensors:
        ax.text(
            0.5,
            0.52,
            "Keine Daten",
            ha="center",
            va="center",
            fontsize=13,
            fontweight="bold",
            color="#94a3b8",
            zorder=6,
        )
        return

    ax.text(
        0.92,
        0.935,
        f"{total_pressure:.0f} raw",
        transform=ax.transAxes,
        ha="right",
        va="center",
        fontsize=9,
        color="#64748b",
        zorder=6,
    )

    template = _foot_template_for(foot)
    ax.imshow(
        template,
        extent=(0, 1, 0, 1),
        origin="lower",
        interpolation="bicubic",
        zorder=1,
    )
    _draw_pressure_heatmap(ax, analysis, foot, norm, _template_alpha_for(foot))

    if show_labels:
        for region in REGION_ORDER:
            if not _region_available(analysis, foot, region):
                continue
            visual = visual_region_for_foot(foot, region)
            raw_value, percentage = _region_values(analysis, foot, region)
            _draw_region_label(ax, visual, region, raw_value, percentage)


def _style_foot_axis(ax) -> None:
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(0.0, 1.04)
    ax.set_aspect("equal")
    ax.axis("off")


def _draw_card(ax) -> None:
    card = FancyBboxPatch(
        (0.02, 0.02),
        0.96,
        0.96,
        boxstyle="round,pad=0.018,rounding_size=0.04",
        transform=ax.transAxes,
        facecolor="#ffffff",
        edgecolor="#e2e8f0",
        linewidth=1.0,
        zorder=0,
    )
    ax.add_patch(card)


@lru_cache(maxsize=1)
def _left_foot_template() -> np.ndarray:
    if not FOOT_TEMPLATE_LEFT_PATH.is_file():
        raise FileNotFoundError(
            f"Foot template image not found: {FOOT_TEMPLATE_LEFT_PATH}"
        )
    image = plt.imread(str(FOOT_TEMPLATE_LEFT_PATH))
    if image.dtype == np.uint8:
        image = image.astype(float) / 255.0
    if image.ndim == 2:
        image = np.dstack([image, image, image, np.ones_like(image)])
    if image.shape[2] == 3:
        image = np.dstack([image, np.ones(image.shape[:2])])
    return image


@lru_cache(maxsize=2)
def _foot_template_for(foot: str) -> np.ndarray:
    image = _left_foot_template()
    if foot == RIGHT:
        return np.flip(image, axis=1)
    return image


@lru_cache(maxsize=2)
def _template_alpha_for(foot: str) -> np.ndarray:
    alpha = _foot_template_for(foot)[..., 3]
    y_idx = np.linspace(0, alpha.shape[0] - 1, GRID_SIZE).astype(int)
    x_idx = np.linspace(0, alpha.shape[1] - 1, GRID_SIZE).astype(int)
    return alpha[np.ix_(y_idx, x_idx)]


def _draw_pressure_heatmap(
    ax,
    analysis: PressureAnalysisResult,
    foot: str,
    norm: Normalize,
    template_alpha: np.ndarray,
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
    heatmap.set_alpha(np.clip(alpha_field, 0.0, 0.80) * template_alpha)


def _draw_region_label(
    ax,
    visual,
    region: str,
    raw_value: float,
    percentage: float,
) -> None:
    label = REGION_LABELS[region].split(" / ")[0]
    ax.text(
        visual.x,
        visual.y,
        f"{label}\n{percentage:.1f} % · {raw_value:.0f} raw",
        ha="center",
        va="center",
        fontsize=7.5,
        color="#0f172a",
        fontweight="bold",
        linespacing=1.25,
        bbox={
            "boxstyle": "round,pad=0.28",
            "fc": "#ffffff",
            "ec": "#e2e8f0",
            "lw": 0.8,
            "alpha": 0.88,
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
