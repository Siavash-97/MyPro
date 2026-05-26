"""Calibration helpers for pressure-derived values."""

from __future__ import annotations

from typing import TypeVar

T = TypeVar("T")


def normalized_calibration_factor(calibration_factor: float | None) -> float | None:
    """Return a usable kg/raw-unit factor or None if calibration is disabled."""
    if calibration_factor is None:
        return None
    factor = float(calibration_factor)
    if factor <= 0:
        return None
    return factor


def estimate_body_weight_kg(total_pressure_raw: T, calibration_factor: float | None) -> T | None:
    """Estimate body weight from total raw pressure when a factor is available."""
    factor = normalized_calibration_factor(calibration_factor)
    if factor is None:
        return None
    return total_pressure_raw * factor
