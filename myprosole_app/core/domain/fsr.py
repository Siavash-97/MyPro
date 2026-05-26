"""FSR-Vorverarbeitung und Schrittanalyse (eine Einlage, zwei Sensoren)."""

import numpy as np
import pandas as pd


def preprocess_fsr(df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """Kombiniertes FSR-Signal erzeugen, glätten und Samplingrate schätzen."""
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    def find_col(candidates):
        for cand in candidates:
            for name in df.columns:
                if name.lower() == cand.lower():
                    return name
        return None

    ts_col = find_col(["timestamp_ms", "timestamp", "time", "zeit"])
    fsr1_col = find_col(["fsr1", "sensor1"])
    fsr2_col = find_col(["fsr2", "sensor2"])

    if ts_col is None or fsr1_col is None or fsr2_col is None:
        raise ValueError("Konnte Spalten für Timestamp/FSR1/FSR2 nicht eindeutig erkennen.")

    df = df[[ts_col, fsr1_col, fsr2_col]]
    df.columns = ["Timestamp", "FSR1", "FSR2"]

    df["Timestamp"] = pd.to_numeric(df["Timestamp"], errors="coerce")
    df["FSR1"] = pd.to_numeric(df["FSR1"], errors="coerce")
    df["FSR2"] = pd.to_numeric(df["FSR2"], errors="coerce")

    df = df.bfill().ffill().reset_index(drop=True)

    df["FSR_combined_raw"] = df[["FSR1", "FSR2"]].max(axis=1)
    df["FSR_combined"] = (
        df["FSR_combined_raw"]
        .rolling(window=window, center=True)
        .median()
        .bfill()
        .ffill()
    )

    ts_vals = df["Timestamp"].values
    dt = np.diff(ts_vals)
    dt_pos = dt[dt > 0]
    if len(dt_pos) > 0:
        mean_dt = dt_pos.mean()
        fs_est = 1000.0 / mean_dt
    else:
        fs_est = None
    df.attrs["fs_est"] = fs_est

    return df


def detect_events(df: pd.DataFrame, threshold_factor: float = 0.2) -> dict:
    """Heel-Strike- und Toe-Off-Events auf Basis des kombinierten FSR-Signals erkennen."""
    if "FSR_combined" not in df.columns:
        raise ValueError("FSR_combined-Spalte fehlt. Bitte zuerst preprocess_fsr aufrufen.")

    signal = df["FSR_combined"]
    max_val = signal.quantile(0.99)
    if max_val <= 0:
        return {"threshold": 0.0, "hs_idx": np.array([], dtype=int), "to_idx": np.array([], dtype=int)}

    threshold = float(threshold_factor * max_val)

    contact = signal > threshold
    contact_shift = contact.shift(fill_value=False)

    hs_idx = np.where((~contact_shift) & contact)[0]
    to_idx = np.where(contact_shift & (~contact))[0]

    return {
        "threshold": threshold,
        "hs_idx": hs_idx,
        "to_idx": to_idx,
    }


def compute_step_metrics(
    df: pd.DataFrame,
    events: dict,
    min_step_s: float = 0.5,
    max_step_s: float = 2.0,
) -> tuple[pd.DataFrame, dict]:
    """Per-Schritt-Metriken und aggregierte Kennwerte berechnen."""
    hs_idx = np.asarray(events.get("hs_idx", []), dtype=int)
    to_idx = np.asarray(events.get("to_idx", []), dtype=int)
    timestamps = df["Timestamp"].values
    fsr_combined = df["FSR_combined"]

    rows = []
    for i, hs in enumerate(hs_idx):
        to_candidates = to_idx[to_idx > hs]
        if len(to_candidates) == 0:
            continue
        to = int(to_candidates[0])

        hs_time_ms = float(timestamps[hs])
        to_time_ms = float(timestamps[to])
        stance_time_s = (to_time_ms - hs_time_ms) / 1000.0

        if i + 1 < len(hs_idx):
            hs_next = int(hs_idx[i + 1])
            hs_next_time_ms = float(timestamps[hs_next])
            step_time_s = (hs_next_time_ms - hs_time_ms) / 1000.0
            swing_time_s = (hs_next_time_ms - to_time_ms) / 1000.0
        else:
            hs_next = None
            hs_next_time_ms = np.nan
            step_time_s = np.nan
            swing_time_s = np.nan

        stance_slice = fsr_combined.iloc[hs : to + 1]
        if len(stance_slice) == 0:
            continue
        peak_force = float(stance_slice.max())
        peak_idx_rel = int(stance_slice.values.argmax())
        peak_idx = hs + peak_idx_rel
        peak_time_ms = float(timestamps[peak_idx])
        time_to_peak_s = (peak_time_ms - hs_time_ms) / 1000.0
        loading_rate = float(peak_force / time_to_peak_s) if time_to_peak_s > 0 else np.nan

        rows.append(
            {
                "hs_index": int(hs),
                "to_index": int(to),
                "hs_time_ms": hs_time_ms,
                "to_time_ms": to_time_ms,
                "stance_time_s": stance_time_s,
                "hs_next_index": int(hs_next) if hs_next is not None else np.nan,
                "hs_next_time_ms": hs_next_time_ms,
                "step_time_s": step_time_s,
                "swing_time_s": swing_time_s,
                "peak_force": peak_force,
                "peak_time_ms": peak_time_ms,
                "time_to_peak_s": time_to_peak_s,
                "loading_rate_per_s": loading_rate,
            }
        )

    steps_df = pd.DataFrame(rows)

    if len(steps_df) > 0:
        valid = steps_df[
            (steps_df["step_time_s"] >= min_step_s) & (steps_df["step_time_s"] <= max_step_s)
        ].copy()
    else:
        valid = pd.DataFrame()

    if len(valid) > 0:
        first_hs_time = valid["hs_time_ms"].iloc[0]
        valid["hs_time_s_rel"] = (valid["hs_time_ms"] - first_hs_time) / 1000.0
        valid["stance_ratio"] = valid["stance_time_s"] / valid["step_time_s"]
    else:
        valid["hs_time_s_rel"] = []
        valid["stance_ratio"] = []

    total_duration_s = (timestamps[-1] - timestamps[0]) / 1000.0 if len(timestamps) > 1 else 0.0
    n_steps_all = len(steps_df)
    n_steps_valid = len(valid)

    summary: dict = {
        "total_duration_s": float(total_duration_s),
        "n_steps_all": int(n_steps_all),
        "n_steps_valid": int(n_steps_valid),
    }

    if n_steps_valid > 0:
        step_time_mean = float(valid["step_time_s"].mean())
        cadence_spm = float(60.0 / step_time_mean) if step_time_mean > 0 else 0.0

        step_time_cv = (
            float(valid["step_time_s"].std() / step_time_mean * 100.0) if step_time_mean > 0 else 0.0
        )
        stance_mean = float(valid["stance_time_s"].mean())
        stance_cv = float(valid["stance_time_s"].std() / stance_mean * 100.0) if stance_mean > 0 else 0.0
        swing_mean = float(valid["swing_time_s"].mean())
        swing_cv = float(valid["swing_time_s"].std() / swing_mean * 100.0) if swing_mean > 0 else 0.0
        stance_ratio_mean = float(valid["stance_ratio"].mean())

        summary.update(
            {
                "cadence_spm": cadence_spm,
                "step_time_mean_s": step_time_mean,
                "step_time_cv_percent": step_time_cv,
                "stance_time_mean_s": stance_mean,
                "stance_time_cv_percent": stance_cv,
                "swing_time_mean_s": swing_mean,
                "swing_time_cv_percent": swing_cv,
                "stance_ratio_mean": stance_ratio_mean,
            }
        )
    else:
        summary.update(
            {
                "cadence_spm": 0.0,
                "step_time_mean_s": 0.0,
                "step_time_cv_percent": 0.0,
                "stance_time_mean_s": 0.0,
                "stance_time_cv_percent": 0.0,
                "swing_time_mean_s": 0.0,
                "swing_time_cv_percent": 0.0,
                "stance_ratio_mean": 0.0,
            }
        )

    return valid, summary
