import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


# ---------------------------------------------------------
# Hilfsfunktionen für FSR-Vorverarbeitung und Schrittanalyse
# (eine Einlage, zwei Sensoren in einem Schuh)
# ---------------------------------------------------------

def preprocess_fsr(df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """Kombiniertes FSR-Signal erzeugen, glätten und Samplingrate schätzen."""
    # Spaltennamen bereinigen
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]

    # Versuche, Timestamp/FSR-Spalten robust zu finden
    cols_lower = {c.lower(): c for c in df.columns}

    def find_col(candidates):
        for cand in candidates:
            for name in df.columns:
                if name.lower() == cand.lower():
                    return name
        return None

    ts_col = find_col(["timestamp", "time", "zeit"])
    fsr1_col = find_col(["fsr1", "sensor1"])
    fsr2_col = find_col(["fsr2", "sensor2"])

    if ts_col is None or fsr1_col is None or fsr2_col is None:
        raise ValueError("Konnte Spalten für Timestamp/FSR1/FSR2 nicht eindeutig erkennen.")

    df = df[[ts_col, fsr1_col, fsr2_col]]
    df.columns = ["Timestamp", "FSR1", "FSR2"]

    # Numerisch casten
    df["Timestamp"] = pd.to_numeric(df["Timestamp"], errors="coerce")
    df["FSR1"] = pd.to_numeric(df["FSR1"], errors="coerce")
    df["FSR2"] = pd.to_numeric(df["FSR2"], errors="coerce")

    df = df.fillna(method="bfill").fillna(method="ffill").reset_index(drop=True)

    # Kombiniertes Signal
    df["FSR_combined_raw"] = df[["FSR1", "FSR2"]].max(axis=1)

    # Median-Glättung
    df["FSR_combined"] = (
        df["FSR_combined_raw"]
        .rolling(window=window, center=True)
        .median()
        .bfill()
        .ffill()
    )

    # Samplingrate schätzen
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
        # passenden TO nach diesem HS suchen
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

        stance_slice = fsr_combined.iloc[hs:to + 1]
        if len(stance_slice) == 0:
            continue
        peak_force = float(stance_slice.max())
        peak_idx_rel = int(stance_slice.values.argmax())
        peak_idx = hs + peak_idx_rel
        peak_time_ms = float(timestamps[peak_idx])
        time_to_peak_s = (peak_time_ms - hs_time_ms) / 1000.0
        loading_rate = float(peak_force / time_to_peak_s) if time_to_peak_s > 0 else np.nan

        rows.append({
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
        })

    steps_df = pd.DataFrame(rows)

    # valide Schritte filtern
    if len(steps_df) > 0:
        valid = steps_df[
            (steps_df["step_time_s"] >= min_step_s)
            & (steps_df["step_time_s"] <= max_step_s)
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

    # Aggregierte Kennzahlen
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

        step_time_cv = float(valid["step_time_s"].std() / step_time_mean * 100.0) if step_time_mean > 0 else 0.0
        stance_mean = float(valid["stance_time_s"].mean())
        stance_cv = float(valid["stance_time_s"].std() / stance_mean * 100.0) if stance_mean > 0 else 0.0
        swing_mean = float(valid["swing_time_s"].mean())
        swing_cv = float(valid["swing_time_s"].std() / swing_mean * 100.0) if swing_mean > 0 else 0.0
        stance_ratio_mean = float(valid["stance_ratio"].mean())

        summary.update({
            "cadence_spm": cadence_spm,
            "step_time_mean_s": step_time_mean,
            "step_time_cv_percent": step_time_cv,
            "stance_time_mean_s": stance_mean,
            "stance_time_cv_percent": stance_cv,
            "swing_time_mean_s": swing_mean,
            "swing_time_cv_percent": swing_cv,
            "stance_ratio_mean": stance_ratio_mean,
        })
    else:
        summary.update({
            "cadence_spm": 0.0,
            "step_time_mean_s": 0.0,
            "step_time_cv_percent": 0.0,
            "stance_time_mean_s": 0.0,
            "stance_time_cv_percent": 0.0,
            "swing_time_mean_s": 0.0,
            "swing_time_cv_percent": 0.0,
            "stance_ratio_mean": 0.0,
        })

    return valid, summary


def build_exercise_recommendations(df: pd.DataFrame, events: dict, summary: dict) -> list[dict]:
    """Regelbasierte Empfehlungen als MVP fuer spaetere personalisierte Uebungen."""
    recommendations: list[dict] = []

    hs_idx = np.asarray(events.get("hs_idx", []), dtype=int)
    heel_dominance = None
    if len(hs_idx) > 0:
        hs_fsr1 = df["FSR1"].iloc[hs_idx]
        hs_fsr2 = df["FSR2"].iloc[hs_idx]
        heel_dominance = float((hs_fsr1 > hs_fsr2).mean())

    cadence = float(summary.get("cadence_spm", 0.0))
    step_cv = float(summary.get("step_time_cv_percent", 0.0))
    stance_ratio = float(summary.get("stance_ratio_mean", 0.0))

    if heel_dominance is not None and heel_dominance >= 0.65:
        recommendations.append(
            {
                "title": "Tendenz zu Fersenaufsatz",
                "insight": (
                    f"Bei {heel_dominance * 100:.0f}% der erkannten Initialkontakte ist FSR1 "
                    "hoeher als FSR2 (Heuristik: eher Ferse als Vorfuss)."
                ),
                "goal": "Kontakt schrittweise in Richtung Mittel-/Vorfuss verbessern.",
                "exercises": [
                    "Barfuss-Marsch mit bewusst leisem, mittigem Fussaufsatz (3 x 45 s).",
                    "Skippings / kurze Anfersen in lockerer Frequenz (3 x 20 m).",
                    "Wadenheben langsam exzentrisch (3 x 12 Wiederholungen).",
                ],
            }
        )

    if cadence > 0 and cadence < 155:
        recommendations.append(
            {
                "title": "Niedrige Kadenz",
                "insight": f"Kadenz liegt bei {cadence:.1f} Schritten/min.",
                "goal": "Schrittfrequenz moderat erhoehen, um Ueberstriding zu reduzieren.",
                "exercises": [
                    "Metronom-Laufdrill mit +5% Kadenz fuer 4 x 1 min.",
                    "Kurze Schrittlaenge bei gleicher Geschwindigkeit ueben.",
                    "Lauf-ABC: Kniehebelauf locker (3 x 20 m).",
                ],
            }
        )

    if step_cv >= 8:
        recommendations.append(
            {
                "title": "Erhoehte Schrittzeit-Variabilitaet",
                "insight": f"Schrittzeit-CV liegt bei {step_cv:.1f}%.",
                "goal": "Rhythmus und Schrittkonstanz verbessern.",
                "exercises": [
                    "Gehen/Laufen im Takt (Metronom), 3 x 2 min.",
                    "Einbeinstand mit leichtem Oberkoerper-Neigen (3 x 30 s pro Seite).",
                    "Linienlauf mit gleichmaessiger Schrittabfolge (4 x 15 m).",
                ],
            }
        )

    if stance_ratio > 0.68:
        recommendations.append(
            {
                "title": "Lange Standphase",
                "insight": f"Mittlere Stance-Ratio liegt bei {stance_ratio:.2f}.",
                "goal": "Dynamischeres Abrollen und effizientere Abdruckphase.",
                "exercises": [
                    "Fussgelenksarbeit im Stand (Vor-/Rueckverlagerung) 2 x 60 s.",
                    "Kurze Hopserlaeufe mit weichem Fussaufsatz (3 x 15 m).",
                    "Sprunggelenk-Mobilitaet an der Wand (2 x 10 pro Seite).",
                ],
            }
        )

    if not recommendations:
        recommendations.append(
            {
                "title": "Aktuell unauffaelliges Profil",
                "insight": "In den aktuellen Kennzahlen ist keine klare Prioritaet sichtbar.",
                "goal": "Praevention und Lauftechnik erhalten.",
                "exercises": [
                    "Dynamische Fussmobilitaet (2 x 60 s).",
                    "Stabi-Zirkel: Einbeinstand + Wadenheben (3 Runden).",
                    "Lockeres Lauf-ABC als Warm-up (5 Minuten).",
                ],
            }
        )

    return recommendations


# ---------------------------------------------------------
# STREAMLIT UI
# ---------------------------------------------------------

st.set_page_config(page_title="MyProSole Schrittanalyse", layout="wide")
st.title("🦶 MyProSole – Schrittanalyse (eine Einlage, zwei Sensoren)")

with st.sidebar:
    st.subheader("Analyse-Parameter")
    smooth_window = st.slider("Glättung (Fenstergröße)", 3, 15, 5, step=2)
    threshold_factor = st.slider("Schwellen-Faktor", 0.05, 0.5, 0.2)
    min_step_s = st.slider("Min. Schrittzeit (s)", 0.3, 1.0, 0.5)
    max_step_s = st.slider("Max. Schrittzeit (s)", 1.5, 3.0, 2.0)

uploaded = st.file_uploader("CSV/XLSX hochladen", type=["csv", "xlsx"])

if uploaded:

    try:
        if uploaded.name.endswith(".xlsx"):
            raw_df = pd.read_excel(uploaded)
        else:
            raw_df = pd.read_csv(uploaded, sep=None, engine="python")
    except Exception as e:
        st.error(f"❌ Fehler beim Lesen der Datei: {e}")
        st.stop()

    try:
        df = preprocess_fsr(raw_df, window=smooth_window)
    except Exception as e:
        st.error(f"❌ Fehler bei der Vorverarbeitung der FSR-Daten: {e}")
        st.stop()

    st.subheader("Vorschau der Daten (vorverarbeitet)")
    st.dataframe(df[["Timestamp", "FSR1", "FSR2", "FSR_combined"]].head())

    events = detect_events(df, threshold_factor=threshold_factor)

    if len(events["hs_idx"]) == 0 or len(events["to_idx"]) == 0:
        st.warning("Es konnten keine oder zu wenige Schritte erkannt werden. Bitte Parameter/Signal prüfen.")
        st.stop()

    steps_df, summary = compute_step_metrics(
        df,
        events,
        min_step_s=min_step_s,
        max_step_s=max_step_s,
    )

    if summary["n_steps_valid"] == 0:
        st.warning("Keine verwertbaren Schritte im physiologischen Bereich gefunden.")
        st.stop()

    recommendations = build_exercise_recommendations(df, events, summary)

    # Ansicht in Tabs
    tab1, tab2, tab3, tab4 = st.tabs(["📈 Plot", "📋 Schritte", "📊 Metriken", "🏋️ Empfohlene Übungen"])

    # ---------------------------------------------------------
    # PLOT
    # ---------------------------------------------------------
    with tab1:
        st.subheader("FSR-Signale und erkannte Events")
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot(df["Timestamp"], df["FSR1"], label="FSR1")
        ax.plot(df["Timestamp"], df["FSR2"], label="FSR2")
        ax.plot(df["Timestamp"], df["FSR_combined"], label="FSR kombiniert")

        ax.axhline(events["threshold"], linestyle="--", color="grey", label="Schwelle")

        hs_idx = events["hs_idx"]
        to_idx = events["to_idx"]
        ax.scatter(df["Timestamp"].iloc[hs_idx], df["FSR_combined"].iloc[hs_idx], marker="x", color="red", label="HS")
        ax.scatter(df["Timestamp"].iloc[to_idx], df["FSR_combined"].iloc[to_idx], marker="o", color="green", label="TO")

        ax.set_xlabel("Zeit (ms)")
        ax.set_ylabel("FSR")
        ax.set_title("FSR-Signale und erkannte Schritte")
        ax.legend()
        st.pyplot(fig)

    # ---------------------------------------------------------
    # SCHRITTE
    # ---------------------------------------------------------
    with tab2:
        st.subheader("Per-Schritt-Metriken")
        display_cols = [
            "hs_time_s_rel",
            "stance_time_s",
            "swing_time_s",
            "step_time_s",
            "stance_ratio",
            "peak_force",
            "time_to_peak_s",
            "loading_rate_per_s",
        ]
        existing_cols = [c for c in display_cols if c in steps_df.columns]
        st.dataframe(steps_df[existing_cols])

        csv_bytes = steps_df.to_csv(index_label="step").encode("utf-8")
        st.download_button(
            "Per-Schritt-Daten herunterladen (CSV)",
            data=csv_bytes,
            file_name="myprosole_step_metrics_one_insole.csv",
            mime="text/csv",
        )

    # ---------------------------------------------------------
    # METRIKEN
    # ---------------------------------------------------------
    with tab3:
        st.subheader("Aggregierte Gang-Metriken")

        col1, col2, col3 = st.columns(3)
        col1.metric("Gültige Schritte", summary["n_steps_valid"])
        col2.metric("Gesamtdauer (s)", f"{summary['total_duration_s']:.1f}")
        col3.metric("Kadenz (Schritte/min)", f"{summary['cadence_spm']:.1f}")

        st.write("---")
        st.write(f"**Ø Schrittzeit:** {summary['step_time_mean_s']:.2f} s")
        st.write(f"**Schrittzeit CV:** {summary['step_time_cv_percent']:.1f} %")
        st.write(f"**Ø Standzeit:** {summary['stance_time_mean_s']:.2f} s")
        st.write(f"**Standzeit CV:** {summary['stance_time_cv_percent']:.1f} %")
        st.write(f"**Ø Schwungzeit:** {summary['swing_time_mean_s']:.2f} s")
        st.write(f"**Schwungzeit CV:** {summary['swing_time_cv_percent']:.1f} %")
        st.write(f"**Stance-Ratio (Ø):** {summary['stance_ratio_mean']:.2f}")

    # ---------------------------------------------------------
    # UEBUNGEN
    # ---------------------------------------------------------
    with tab4:
        st.subheader("Empfohlene Übungen")
        st.caption(
            "Die Vorschlaege sind aktuell regelbasiert (MVP) und koennen spaeter mit "
            "deiner Uebungsdatenbank/Clinical-Logik ersetzt werden."
        )

        for rec in recommendations:
            with st.container(border=True):
                st.markdown(f"### {rec['title']}")
                st.write(f"**Warum:** {rec['insight']}")
                st.write(f"**Ziel:** {rec['goal']}")
                st.write("**Übungen:**")
                for item in rec["exercises"]:
                    st.write(f"- {item}")

