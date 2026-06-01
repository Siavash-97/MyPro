"""
step_features.py
================
Berechnet pro erkanntem Schritt die relevanten Kennzahlen (Features).

Sensorrollen je Fuß (aus den Spalten in step["sensor_columns"]):
    Index 0 -> S1 = Ferse (heel)
    Index 1 -> S2 = lateraler Vorfuß (lateral)
    Index 2 -> S3 = medialer Vorfuß (medial)

Es werden nur die wirklich benoetigten Kennzahlen berechnet (Peak, Mittelwert,
Aktivierungszeiten, aktive Dauern, Verteilungs-Ratios, Timing). Die Berechnung
ist vektorisiert (numpy), damit sie pro Schritt sehr schnell ist.
"""

from __future__ import annotations

import numpy as np

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config


def compute_features_for_steps(
    steps: list[dict],
    *,
    threshold: float | None = None,
) -> list[dict]:
    """Berechnet die Features fuer alle Schritte und ergaenzt sie in-place.

    Args:
        steps: Liste der Step-Dictionaries aus step_detection.detect_all_steps.
        threshold: Optionaler Aktivierungsschwellenwert (Default: config).

    Returns:
        Dieselbe Liste, jedes Step-Dict um die Feature-Felder erweitert.
    """
    active_threshold = (
        float(threshold) if threshold is not None else config.SENSOR_THRESHOLD
    )
    for step in steps:
        _compute_features(step, threshold=active_threshold)
    return steps


def _safe_ratio(numerator: float, denominator: float) -> float:
    """Sichere Division: gibt 0.0 zurueck, wenn der Nenner 0 (oder ungueltig) ist."""
    if denominator is None or denominator == 0 or np.isnan(denominator):
        return 0.0
    return float(numerator) / float(denominator)


def _first_activation_ms(values: np.ndarray, times_ms: np.ndarray, threshold: float):
    """Zeitpunkt (ms ab Standphasenbeginn), an dem ein Sensor erstmals aktiv wird.

    Returns:
        float (ms) oder None, falls der Sensor nie ueber den Schwellenwert kommt.
    """
    idx = _first_activation_index(values, threshold)
    if idx is None:
        return None
    return float(times_ms[idx])


def _first_activation_index(values: np.ndarray, threshold: float) -> int | None:
    """Erster Sample-Index, an dem der Sensor aktiv ist (oder None)."""
    above = np.where(values > threshold)[0]
    if above.size == 0:
        return None
    return int(above[0])


def _activation_index_map(
    s1: np.ndarray,
    s2: np.ndarray,
    s3: np.ndarray,
    threshold: float,
) -> dict[str, int | None]:
    return {
        "S1": _first_activation_index(s1, threshold),
        "S2": _first_activation_index(s2, threshold),
        "S3": _first_activation_index(s3, threshold),
    }


def _simultaneous_sensors(index_map: dict[str, int | None]) -> list[str]:
    """Sensoren mit gleichem Erstaktivierungs-Sample (100-Hz-Raster)."""
    active = {name: idx for name, idx in index_map.items() if idx is not None}
    if not active:
        return []
    earliest = min(active.values())
    return [name for name, idx in active.items() if idx == earliest]


def _format_sensor_group(sensor_names: list[str]) -> str:
    order = {"S1": 0, "S2": 1, "S3": 2}
    return "+".join(sorted(sensor_names, key=lambda name: order[name]))


def _build_activation_order(index_map: dict[str, int | None]) -> list[str]:
    """Aktivierungsreihenfolge mit Gruppen bei gleicher Sample-Nummer."""
    active = [(name, idx) for name, idx in index_map.items() if idx is not None]
    if not active:
        return []
    active.sort(key=lambda item: (item[1], {"S1": 0, "S2": 1, "S3": 2}[item[0]]))
    groups: list[list[str]] = []
    for name, idx in active:
        if groups and idx == index_map[groups[-1][0]]:
            groups[-1].append(name)
        else:
            groups.append([name])
    return [_format_sensor_group(group) for group in groups]


def _last_active_index(values: np.ndarray, threshold: float):
    """Letzter Sample-Index, an dem der Sensor aktiv ist (oder None)."""
    above = np.where(values > threshold)[0]
    if above.size == 0:
        return None
    return int(above[-1])


def _compute_features(step: dict, *, threshold: float) -> None:
    """Berechnet alle Features fuer einen einzelnen Schritt (in-place)."""
    raw = step["raw_step_data"]
    sensor_cols = step["sensor_columns"]

    # Zeit relativ zum Standphasenbeginn in Millisekunden.
    time_s = raw[config.TIME_COLUMN].to_numpy(dtype=float)
    times_ms = (time_s - time_s[0]) * 1000.0

    # Mittlere Abtastzeit (ms) fuer die Berechnung aktiver Dauern.
    if times_ms.size >= 2:
        dt_ms = float(np.median(np.diff(times_ms)))
        if dt_ms <= 0:
            dt_ms = 1000.0 / config.DEFAULT_SAMPLING_RATE_HZ
    else:
        dt_ms = 1000.0 / config.DEFAULT_SAMPLING_RATE_HZ

    # Sensorwerte nach Rolle extrahieren (S1=Ferse, S2=lateral, S3=medial).
    s1 = raw[sensor_cols[0]].to_numpy(dtype=float)  # Ferse
    s2 = raw[sensor_cols[1]].to_numpy(dtype=float)  # lateraler Vorfuß
    s3 = raw[sensor_cols[2]].to_numpy(dtype=float)  # medialer Vorfuß

    # --- Druck-Kennzahlen (Peak / Mittelwert) ---
    peak_s1, peak_s2, peak_s3 = float(s1.max()), float(s2.max()), float(s3.max())
    mean_s1, mean_s2, mean_s3 = float(s1.mean()), float(s2.mean()), float(s3.mean())

    # --- Aktive Dauern (Zeit ueber Schwelle) ---
    active_duration_s1 = float(np.count_nonzero(s1 > threshold) * dt_ms)
    active_duration_s2 = float(np.count_nonzero(s2 > threshold) * dt_ms)
    active_duration_s3 = float(np.count_nonzero(s3 > threshold) * dt_ms)

    activation_indices = _activation_index_map(s1, s2, s3, threshold)
    time_s1_on = (
        float(times_ms[activation_indices["S1"]])
        if activation_indices["S1"] is not None
        else None
    )
    time_s2_on = (
        float(times_ms[activation_indices["S2"]])
        if activation_indices["S2"] is not None
        else None
    )
    time_s3_on = (
        float(times_ms[activation_indices["S3"]])
        if activation_indices["S3"] is not None
        else None
    )

    activation_times = {"S1": time_s1_on, "S2": time_s2_on, "S3": time_s3_on}
    simultaneous_sensors = _simultaneous_sensors(activation_indices)
    activation_order = _build_activation_order(activation_indices)
    first_active_sensor = (
        _format_sensor_group(simultaneous_sensors) if simultaneous_sensors else None
    )

    # Zuletzt aktiver Sensor: jener, der am spaetesten unter die Schwelle faellt.
    last_idx_map = {
        "S1": _last_active_index(s1, threshold),
        "S2": _last_active_index(s2, threshold),
        "S3": _last_active_index(s3, threshold),
    }
    active_last = [(name, idx) for name, idx in last_idx_map.items() if idx is not None]
    if active_last:
        last_active_sensor = max(active_last, key=lambda p: p[1])[0]
    else:
        last_active_sensor = None
    # Abdruck (push-off) erfolgt ueber den zuletzt belasteten Sensor.
    push_off_sensor = last_active_sensor

    # --- Druckverteilung ---
    total_pressure = peak_s1 + peak_s2 + peak_s3
    forefoot_pressure = peak_s2 + peak_s3  # S2 + S3
    medial_ratio = _safe_ratio(peak_s3, forefoot_pressure)   # S3 / (S2+S3)
    lateral_ratio = _safe_ratio(peak_s2, forefoot_pressure)  # S2 / (S2+S3)

    # --- Uebergaenge / Timing ---
    # Verzoegerung bis Fersenkontakt (ms ab Standphasenbeginn).
    heel_contact_delay_ms = time_s1_on

    # Erster Vorfußkontakt = frueheste Aktivierung von S2 oder S3.
    forefoot_times = [t for t in (time_s2_on, time_s3_on) if t is not None]
    forefoot_contact_delay_ms = min(forefoot_times) if forefoot_times else None

    # Zeit von Fersenkontakt bis erstem Vorfußkontakt.
    if time_s1_on is not None and forefoot_contact_delay_ms is not None:
        heel_to_forefoot_time_ms = forefoot_contact_delay_ms - time_s1_on
    else:
        heel_to_forefoot_time_ms = None

    stance_duration_ms = float(step.get("stance_duration_ms") or 0.0)
    if (
        heel_to_forefoot_time_ms is not None
        and heel_to_forefoot_time_ms >= 0
        and stance_duration_ms > 0
    ):
        heel_to_forefoot_ratio = heel_to_forefoot_time_ms / stance_duration_ms
    else:
        heel_to_forefoot_ratio = None

    gait_cycle_duration_ms = step.get("gait_cycle_duration_ms")
    if gait_cycle_duration_ms and float(gait_cycle_duration_ms) > 0:
        cadence_spm = 60000.0 / float(gait_cycle_duration_ms)
    else:
        cadence_spm = None

    # --- Kontaktmuster (grobe Einordnung; Feinklassifikation in gait_classification) ---
    heel_active = time_s1_on is not None
    forefoot_active = forefoot_contact_delay_ms is not None

    # Vorfußaufsatz: Vorfußsensor (S2/S3) in der ersten Aktivierungsgruppe.
    is_forefoot_strike = bool(
        simultaneous_sensors and not any(name == "S1" for name in simultaneous_sensors)
    )

    # Flacher Fußaufsatz: Ferse zuerst, Vorfuß folgt sehr schnell (absolut oder relativ).
    is_flat_foot_contact = bool(
        first_active_sensor
        and first_active_sensor.startswith("S1")
        and forefoot_active
        and heel_to_forefoot_time_ms is not None
        and (
            heel_to_forefoot_time_ms <= config.FLAT_FOOT_TIME_WINDOW_MS
            or (
                heel_to_forefoot_ratio is not None
                and heel_to_forefoot_ratio <= config.FLAT_FOOT_STANCE_RATIO
            )
        )
    )

    # Spaeter Fersenkontakt: Ferse wird erst deutlich nach Standphasenbeginn aktiv.
    has_late_heel_contact = bool(
        heel_active and (time_s1_on > config.LATE_HEEL_CONTACT_THRESHOLD_MS)
    )

    contact_pattern = _coarse_contact_pattern(
        heel_active=heel_active,
        forefoot_active=forefoot_active,
        is_forefoot_strike=is_forefoot_strike,
        is_flat_foot_contact=is_flat_foot_contact,
    )

    # --- Ergebnis in das Step-Dict schreiben ---
    step.update(
        {
            "duration_ms": step.get("stance_duration_ms"),
            # Druckwerte
            "peak_S1": peak_s1,
            "peak_S2": peak_s2,
            "peak_S3": peak_s3,
            "mean_S1": mean_s1,
            "mean_S2": mean_s2,
            "mean_S3": mean_s3,
            "active_duration_S1_ms": active_duration_s1,
            "active_duration_S2_ms": active_duration_s2,
            "active_duration_S3_ms": active_duration_s3,
            # Aktivierung
            "time_S1_on": time_s1_on,
            "time_S2_on": time_s2_on,
            "time_S3_on": time_s3_on,
            "activation_times": activation_times,
            "activation_order": activation_order,
            "first_active_sensor": first_active_sensor,
            "simultaneous_sensors": simultaneous_sensors,
            "last_active_sensor": last_active_sensor,
            "push_off_sensor": push_off_sensor,
            # Verteilung
            "total_pressure": total_pressure,
            "forefoot_pressure": forefoot_pressure,
            "medial_ratio": medial_ratio,
            "lateral_ratio": lateral_ratio,
            # Uebergaenge
            "heel_to_forefoot_time_ms": heel_to_forefoot_time_ms,
            "heel_to_forefoot_ratio": heel_to_forefoot_ratio,
            "forefoot_contact_delay_ms": forefoot_contact_delay_ms,
            "heel_contact_delay_ms": heel_contact_delay_ms,
            "cadence_spm": cadence_spm,
            # Kontaktmuster (grob)
            "contact_pattern": contact_pattern,
            "is_flat_foot_contact": is_flat_foot_contact,
            "is_forefoot_strike": is_forefoot_strike,
            "has_late_heel_contact": has_late_heel_contact,
        }
    )


def _coarse_contact_pattern(
    *,
    heel_active: bool,
    forefoot_active: bool,
    is_forefoot_strike: bool,
    is_flat_foot_contact: bool,
) -> str:
    """Liefert eine grobe Kontaktmuster-Bezeichnung fuer Uebersicht/Debug."""
    if is_forefoot_strike:
        return "forefoot_strike_late_heel" if heel_active else "forefoot_strike_no_heel"
    if is_flat_foot_contact:
        return "flat_foot"
    if heel_active:
        return "heel_strike"
    if forefoot_active:
        return "forefoot_only"
    return "unclear"
