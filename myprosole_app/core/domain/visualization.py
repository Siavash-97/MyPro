"""Matplotlib visualizations for pressure analysis."""

from __future__ import annotations

import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib.patches import Circle

from core.domain.pressure_analysis import PressureAnalysisResult
from core.domain.sensor_mapping import (
    FOOT_LABELS,
    FOOT_ORDER,
    HEEL,
    LATERAL_FOREFOOT,
    MEDIAL_FOREFOOT,
    REGION_LABELS,
)

REGION_POSITIONS = {
    HEEL: (0.5, 0.2),
    LATERAL_FOREFOOT: (0.25, 0.75),
    MEDIAL_FOREFOOT: (0.75, 0.75),
}


def plot_pressure_distribution(analysis: PressureAnalysisResult):
    """Draw separate left/right pressure maps colored by mean intensity."""
    means: list[float] = []
    for foot in FOOT_ORDER:
        for region in (HEEL, LATERAL_FOREFOOT, MEDIAL_FOREFOOT):
            means.append(float(analysis.df[f"{foot}_{region}_raw"].mean()))

    max_pressure = max(means) if means else 0.0
    norm = Normalize(vmin=0.0, vmax=max_pressure if max_pressure > 0 else 1.0)
    cmap = plt.get_cmap("YlOrRd")

    fig, axes = plt.subplots(1, 2, figsize=(9, 4))
    for ax, foot in zip(axes, FOOT_ORDER):
        ax.set_title(FOOT_LABELS.get(foot, foot.title()))
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.set_aspect("equal")
        ax.axis("off")

        for region in (HEEL, LATERAL_FOREFOOT, MEDIAL_FOREFOOT):
            x, y = REGION_POSITIONS[region]
            value = float(analysis.df[f"{foot}_{region}_raw"].mean())
            circle = Circle(
                (x, y),
                radius=0.16,
                facecolor=cmap(norm(value)),
                edgecolor="black",
                linewidth=1.0,
            )
            ax.add_patch(circle)
            ax.text(
                x,
                y,
                f"{value:.0f}",
                ha="center",
                va="center",
                fontsize=10,
                color="black",
            )
            ax.text(
                x,
                y - 0.24,
                REGION_LABELS[region].split(" / ")[0],
                ha="center",
                va="center",
                fontsize=8,
            )

    sm = plt.cm.ScalarMappable(norm=norm, cmap=cmap)
    sm.set_array([])
    fig.colorbar(sm, ax=axes.ravel().tolist(), shrink=0.8, label="Ø Rohdruck")
    fig.suptitle("Druckverteilung links/rechts")
    return fig
