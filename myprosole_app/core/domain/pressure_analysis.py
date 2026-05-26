"""Pressure analysis for paired left/right MyProSole insoles."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from core.domain.calibration import estimate_body_weight_kg, normalized_calibration_factor
from core.domain.sensor_mapping import (
    FOOT_ORDER,
    HEEL,
    LATERAL_FOREFOOT,
    MEDIAL_FOREFOOT,
    REGION_ORDER,
    SENSOR_DEFINITIONS,
    SENSOR_COLUMNS,
    TIMESTAMP_COLUMN,
    columns_for_foot,
    columns_for_region,
)

TARGET_HEEL_SHARE = 0.60
TARGET_FOREFOOT_SHARE = 0.40
BALANCE_TOLERANCE = 0.08
BALANCE_RED_DEVIATION = 0.22
NEUTRAL_BALANCE_COLOR_INTENSITY = 0.32
INCOMPLETE_BALANCE_MAX_COLOR_INTENSITY = 0.62


@dataclass(frozen=True)
class PressureAnalysisResult:
    """Time-series pressure metrics plus aggregate summaries."""

    df: pd.DataFrame
    per_foot_summary: dict[str, dict[str, float]]
    bilateral_summary: dict[str, float]
    sensor_columns: dict[str, list[str]]
    calibration_factor: float | None = None
    available_sensor_columns: tuple[str, ...] = field(default_factory=tuple)
    missing_sensor_columns: tuple[str, ...] = field(default_factory=tuple)
    availability_notes: tuple[str, ...] = field(default_factory=tuple)
    source_format: str | None = None
    heel_forefoot_balance: dict[str, dict[str, object]] = field(default_factory=dict)

    @property
    def summary(self) -> dict:
        return {
            "per_foot": self.per_foot_summary,
            "bilateral": self.bilateral_summary,
        }

    def to_export_frame(self) -> pd.DataFrame:
        export_cols = [TIMESTAMP_COLUMN]
        for foot in FOOT_ORDER:
            export_cols.extend(
                [
                    f"{foot}_total_pressure_raw",
                    f"{foot}_heel_pressure_raw",
                    f"{foot}_medial_forefoot_raw",
                    f"{foot}_lateral_forefoot_raw",
                    f"{foot}_heel_percentage",
                    f"{foot}_medial_forefoot_percentage",
                    f"{foot}_lateral_forefoot_percentage",
                    f"{foot}_medial_lateral_ratio",
                    f"{foot}_forefoot_heel_ratio",
                ]
            )
        export_cols.extend(
            [
                "total_pressure_left",
                "total_pressure_right",
                "total_pressure_both",
                "left_right_distribution_percentage",
            ]
        )
        if "estimated_body_weight_kg" in self.df.columns:
            export_cols.append("estimated_body_weight_kg")
        existing_cols = [column for column in export_cols if column in self.df.columns]
        return self.df[existing_cols].copy()


def _safe_divide(numerator, denominator):
    numerator_values = np.asarray(numerator, dtype=float)
    denominator_values = np.asarray(denominator, dtype=float)
    return np.divide(
        numerator_values,
        denominator_values,
        out=np.zeros_like(numerator_values, dtype=float),
        where=denominator_values > 0,
    )


def _series_sum(df: pd.DataFrame, columns: tuple[str, ...]) -> pd.Series:
    if not columns:
        return pd.Series(0.0, index=df.index)
    return df[list(columns)].sum(axis=1)


def _mean(series: pd.Series) -> float:
    return float(series.mean()) if len(series) else 0.0


def _max(series: pd.Series) -> float:
    return float(series.max()) if len(series) else 0.0


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def _availability_from_dataframe(df: pd.DataFrame) -> tuple[tuple[str, ...], tuple[str, ...]]:
    attr_available = df.attrs.get("available_sensor_columns")
    if attr_available is None:
        available = tuple(column for column in SENSOR_COLUMNS if column in df.columns)
    else:
        available = tuple(column for column in attr_available if column in SENSOR_COLUMNS)

    missing = tuple(column for column in SENSOR_COLUMNS if column not in available)
    return available, missing


def _region_available(
    sensor_columns: dict[str, list[str]],
    foot: str,
    region: str,
) -> bool:
    available_columns = set(sensor_columns.get(foot, []))
    return any(column in available_columns for column in columns_for_region(foot, region))


def _balance_color_intensity(deviation: float) -> float:
    if deviation <= BALANCE_TOLERANCE:
        return NEUTRAL_BALANCE_COLOR_INTENSITY
    severity = (deviation - BALANCE_TOLERANCE) / (
        BALANCE_RED_DEVIATION - BALANCE_TOLERANCE
    )
    return 0.38 + 0.62 * _clamp(severity, 0.0, 1.0)


def evaluate_heel_forefoot_balance(
    per_foot_summary: dict[str, dict[str, float]],
    sensor_columns: dict[str, list[str]],
) -> dict[str, dict[str, object]]:
    """Evaluate the pressure-only 60/40 heel/forefoot distribution per foot."""
    balance: dict[str, dict[str, object]] = {}

    for foot in FOOT_ORDER:
        summary = per_foot_summary.get(foot, {})
        heel = float(summary.get("heel_pressure_raw", 0.0))
        medial = float(summary.get("medial_forefoot_raw", 0.0))
        lateral = float(summary.get("lateral_forefoot_raw", 0.0))
        forefoot = medial + lateral
        total = heel + forefoot

        has_heel = _region_available(sensor_columns, foot, HEEL)
        has_medial = _region_available(sensor_columns, foot, MEDIAL_FOREFOOT)
        has_lateral = _region_available(sensor_columns, foot, LATERAL_FOREFOOT)
        complete = has_heel and has_medial and has_lateral

        heel_share = (heel / total) if total > 0 else 0.0
        forefoot_share = (forefoot / total) if total > 0 else 0.0
        missing_regions = [
            label
            for available, label in (
                (has_heel, "Ferse"),
                (has_lateral, "lateraler Vorfuss"),
                (has_medial, "medialer Vorfuss"),
            )
            if not available
        ]

        if not complete:
            balance[foot] = {
                "complete": False,
                "status": "incomplete",
                "targetHeelShare": TARGET_HEEL_SHARE * 100.0,
                "targetForefootShare": TARGET_FOREFOOT_SHARE * 100.0,
                "heelShare": heel_share * 100.0,
                "forefootShare": forefoot_share * 100.0,
                "elevatedZone": None,
                "zoneColorIntensity": {},
                "missingRegions": missing_regions,
                "note": (
                    "Vollstaendige 60/40-Bewertung eingeschraenkt: "
                    f"{', '.join(missing_regions)} fehlt."
                ),
            }
            continue

        if total <= 0:
            balance[foot] = {
                "complete": True,
                "status": "no_pressure",
                "targetHeelShare": TARGET_HEEL_SHARE * 100.0,
                "targetForefootShare": TARGET_FOREFOOT_SHARE * 100.0,
                "heelShare": 0.0,
                "forefootShare": 0.0,
                "elevatedZone": None,
                "zoneColorIntensity": {
                    HEEL: 0.0,
                    "forefoot": 0.0,
                },
                "missingRegions": [],
                "note": "Keine verwertbare Drucksumme fuer die 60/40-Bewertung.",
            }
            continue

        deviation = abs(heel_share - TARGET_HEEL_SHARE)
        color_intensity = _balance_color_intensity(deviation)
        is_balanced = deviation <= BALANCE_TOLERANCE
        elevated_zone = None
        status = "balanced"
        note = "Fersenanteil und Vorfussanteil liegen im Zielbereich."
        zone_color_intensity = {
            HEEL: NEUTRAL_BALANCE_COLOR_INTENSITY,
            "forefoot": NEUTRAL_BALANCE_COLOR_INTENSITY,
        }

        if not is_balanced and heel_share > TARGET_HEEL_SHARE:
            elevated_zone = HEEL
            status = "heel_elevated"
            note = "Abweichende Druckverteilung: erhoehter Fersenanteil."
            zone_color_intensity[HEEL] = color_intensity
        elif not is_balanced:
            elevated_zone = "forefoot"
            status = "forefoot_elevated"
            note = "Abweichende Druckverteilung: erhoehter Vorfussanteil."
            zone_color_intensity["forefoot"] = color_intensity

        balance[foot] = {
            "complete": True,
            "status": status,
            "targetHeelShare": TARGET_HEEL_SHARE * 100.0,
            "targetForefootShare": TARGET_FOREFOOT_SHARE * 100.0,
            "heelShare": heel_share * 100.0,
            "forefootShare": forefoot_share * 100.0,
            "deviationPercentagePoints": deviation * 100.0,
            "elevatedZone": elevated_zone,
            "zoneColorIntensity": zone_color_intensity,
            "missingRegions": [],
            "note": note,
        }

    return balance


def analyze_pressure(
    df: pd.DataFrame,
    calibration_factor: float | None = None,
) -> PressureAnalysisResult:
    """Compute pressure metrics from all currently available mapped sensors."""
    available_sensor_columns, missing_sensor_columns = _availability_from_dataframe(df)
    result_df = df.copy()
    for sensor in SENSOR_DEFINITIONS:
        if sensor.column not in result_df.columns:
            result_df[sensor.column] = 0.0
        result_df[sensor.column] = (
            pd.to_numeric(result_df[sensor.column], errors="coerce").fillna(0.0)
        )

    per_foot_summary: dict[str, dict[str, float]] = {}
    sensor_columns: dict[str, list[str]] = {}

    for foot in FOOT_ORDER:
        foot_cols = columns_for_foot(foot)
        sensor_columns[foot] = [
            column for column in foot_cols if column in available_sensor_columns
        ]

        total = _series_sum(result_df, foot_cols)
        heel = _series_sum(result_df, columns_for_region(foot, HEEL))
        medial = _series_sum(result_df, columns_for_region(foot, MEDIAL_FOREFOOT))
        lateral = _series_sum(result_df, columns_for_region(foot, LATERAL_FOREFOOT))
        forefoot = medial + lateral

        result_df[f"{foot}_total_pressure_raw"] = total
        result_df[f"{foot}_heel_pressure_raw"] = heel
        result_df[f"{foot}_medial_forefoot_raw"] = medial
        result_df[f"{foot}_lateral_forefoot_raw"] = lateral
        result_df[f"{foot}_heel_percentage"] = _safe_divide(heel, total) * 100.0
        result_df[f"{foot}_medial_forefoot_percentage"] = _safe_divide(medial, total) * 100.0
        result_df[f"{foot}_lateral_forefoot_percentage"] = _safe_divide(lateral, total) * 100.0
        result_df[f"{foot}_medial_lateral_ratio"] = _safe_divide(medial, lateral)
        result_df[f"{foot}_forefoot_heel_ratio"] = _safe_divide(forefoot, heel)

        per_foot_summary[foot] = {
            "total_pressure_raw": _mean(total),
            "peak_total_pressure_raw": _max(total),
            "heel_pressure_raw": _mean(heel),
            "medial_forefoot_raw": _mean(medial),
            "lateral_forefoot_raw": _mean(lateral),
            "heel_percentage": _mean(result_df[f"{foot}_heel_percentage"]),
            "medial_forefoot_percentage": _mean(result_df[f"{foot}_medial_forefoot_percentage"]),
            "lateral_forefoot_percentage": _mean(result_df[f"{foot}_lateral_forefoot_percentage"]),
            "medial_lateral_ratio": _mean(result_df[f"{foot}_medial_lateral_ratio"]),
            "forefoot_heel_ratio": _mean(result_df[f"{foot}_forefoot_heel_ratio"]),
        }

    result_df["total_pressure_left"] = result_df["left_total_pressure_raw"]
    result_df["total_pressure_right"] = result_df["right_total_pressure_raw"]
    result_df["total_pressure_both"] = (
        result_df["total_pressure_left"] + result_df["total_pressure_right"]
    )
    result_df["left_right_distribution_percentage"] = (
        _safe_divide(result_df["total_pressure_left"], result_df["total_pressure_both"]) * 100.0
    )

    factor = normalized_calibration_factor(calibration_factor)
    if factor is not None:
        result_df["estimated_body_weight_kg"] = estimate_body_weight_kg(
            result_df["total_pressure_both"], factor
        )

    total_pressure_left = _mean(result_df["total_pressure_left"])
    total_pressure_right = _mean(result_df["total_pressure_right"])
    total_pressure_both = _mean(result_df["total_pressure_both"])
    heel_forefoot_balance = evaluate_heel_forefoot_balance(
        per_foot_summary,
        sensor_columns,
    )
    bilateral_summary = {
        "total_pressure_left": total_pressure_left,
        "total_pressure_right": total_pressure_right,
        "total_pressure_both": total_pressure_both,
        "left_right_distribution_percentage": float(
            _safe_divide([total_pressure_left], [total_pressure_both])[0] * 100.0
        ),
    }
    if "estimated_body_weight_kg" in result_df.columns:
        bilateral_summary["estimated_body_weight_kg"] = _mean(
            result_df["estimated_body_weight_kg"]
        )

    return PressureAnalysisResult(
        df=result_df,
        per_foot_summary=per_foot_summary,
        bilateral_summary=bilateral_summary,
        sensor_columns=sensor_columns,
        calibration_factor=factor,
        available_sensor_columns=available_sensor_columns,
        missing_sensor_columns=missing_sensor_columns,
        availability_notes=tuple(
            note for note in (df.attrs.get("pressure_notes"),) if note
        ),
        source_format=df.attrs.get("sensor_format"),
        heel_forefoot_balance=heel_forefoot_balance,
    )
