import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# ---------------------------------------------------------
# Globale Parameter
# ---------------------------------------------------------

SAMPLE_RATE = 200
SAMPLE_TIME_MS = 1000 / SAMPLE_RATE


# ---------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------

def smooth_signal(x, window=5):
    s = x.rolling(window, center=True).median()
    return s.fillna(method="bfill").fillna(method="ffill")


# ---------------------------------------------------------
# Event Detection – robust für alle FSR-Dateien
# ---------------------------------------------------------

def detect_events(fsr1, fsr2):

    combined = np.maximum(fsr1.to_numpy(), fsr2.to_numpy())

    hs_list = []
    to_list = []

    fsr_min = float(np.percentile(combined, 5))
    fsr_max = float(np.percentile(combined, 95))

    if fsr_max - fsr_min < 10:
        return hs_list, to_list

    hs_threshold = fsr_min + 0.35 * (fsr_max - fsr_min)
    to_threshold = fsr_min + 0.20 * (fsr_max - fsr_min)

    contact = False

    for i, val in enumerate(combined):
        if not contact and val > hs_threshold:
            contact = True
            hs_list.append(int(i))

        elif contact and val < to_threshold:
            contact = False
            to_list.append(int(i))

    return hs_list, to_list


# ---------------------------------------------------------
# Schritt-Tabelle
# ---------------------------------------------------------

def compute_step_table(hs, to):
    rows = []
    for i in range(min(len(hs), len(to))):
        hs_index = int(hs[i])
        to_index = int(to[i])
        duration = to_index - hs_index
        rows.append([hs_index, to_index, duration])

    return pd.DataFrame(rows, columns=["HS_Index", "TO_Index", "Step_Duration (samples)"])


def compute_contact_time(step_df):
    if len(step_df) == 0:
        return step_df

    step_df["Contact_Time_ms"] = step_df["Step_Duration (samples)"] * SAMPLE_TIME_MS
    return step_df


# ---------------------------------------------------------
# Metriken
# ---------------------------------------------------------

def compute_cadence(num_steps, total_samples):
    total_seconds = total_samples / SAMPLE_RATE
    total_minutes = total_seconds / 60
    return num_steps / total_minutes if total_minutes > 0 else 0


def compute_stride_variability(hs_list):
    if len(hs_list) < 2:
        return None, None, None

    stride_times = []
    for i in range(len(hs_list) - 1):
        stride_times.append((hs_list[i+1] - hs_list[i]) * SAMPLE_TIME_MS)

    stride_times = np.array(stride_times)
    return stride_times.mean(), stride_times.std(), (stride_times.std() / stride_times.mean()) * 100


def compute_metrics(step_df, fsr1, fsr2):
    metrics = {}

    if len(step_df) == 0:
        return metrics

    durations = step_df["Step_Duration (samples)"].to_numpy()

    metrics["Avg Step Duration (samples)"] = durations.mean()
    metrics["SD Step Duration"] = durations.std()
    metrics["CoV Step Duration (%)"] = durations.std() / durations.mean() * 100

    peaks = []
    rise_rates = []

    for _, row in step_df.iterrows():
        hs = int(row["HS_Index"])
        to = int(row["TO_Index"])

        seg = fsr1[hs:to]

        if len(seg) > 0:
            peaks.append(seg.max())
            rise_rates.append((seg.max() - seg.min()) / (len(seg) + 1))

    if peaks:
        metrics["Avg Peak Force"] = np.mean(peaks)
        metrics["Avg Rise Rate"] = np.mean(rise_rates)

    return metrics


# ---------------------------------------------------------
# STREAMLIT UI
# ---------------------------------------------------------

st.set_page_config(page_title="MyProSole Schrittanalyse", layout="wide")
st.title("🦶 MyProSole – Schrittanalyse MVP")

uploaded = st.file_uploader("CSV/XLSX hochladen", type=["csv", "xlsx"])

if uploaded:

    # ------- CSV/XLSX AUTOMATIK -------
    try:
        if uploaded.name.endswith(".xlsx"):
            df = pd.read_excel(uploaded)
        else:
            df = pd.read_csv(uploaded, sep=None, engine="python")
    except:
        st.error("❌ Fehler beim Lesen der Datei.")
        st.stop()

    df.columns = [str(c).strip().lower() for c in df.columns]

    possible_timestamp = [c for c in df.columns if "time" in c]
    possible_fsr1 = [c for c in df.columns if "fsr1" in c or "sensor1" in c]
    possible_fsr2 = [c for c in df.columns if "fsr2" in c or "sensor2" in c]

    if len(possible_timestamp) == 0 or len(possible_fsr1) == 0 or len(possible_fsr2) == 0:
        df = df.iloc[:, :3]
        df.columns = ["timestamp", "fsr1", "fsr2"]
    else:
        df = df[[possible_timestamp[0], possible_fsr1[0], possible_fsr2[0]]]
        df.columns = ["timestamp", "fsr1", "fsr2"]

    df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
    df["fsr1"] = pd.to_numeric(df["fsr1"], errors="coerce")
    df["fsr2"] = pd.to_numeric(df["fsr2"], errors="coerce")

    df = df.fillna(method="bfill").fillna(method="ffill").reset_index(drop=True)

    st.subheader("Vorschau der Daten")
    st.dataframe(df.head())

    fsr1 = smooth_signal(df["fsr1"])
    fsr2 = smooth_signal(df["fsr2"])

    hs, to = detect_events(fsr1, fsr2)

    step_df = compute_step_table(hs, to)
    step_df = compute_contact_time(step_df)

    base_metrics = compute_metrics(step_df, fsr1, fsr2)
    cadence = compute_cadence(len(hs), len(df))
    mean_stride, sd_stride, cov_stride = compute_stride_variability(hs)

    step_count = len(hs)
    stride_count = max(0, len(hs) - 1)

    tab1, tab2, tab3 = st.tabs(["📈 Plot", "📋 Schritte", "📊 Metriken"])

    # ---------------------------------------------------------
    # PLOT
    # ---------------------------------------------------------
    with tab1:
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot(fsr1, label="FSR1")
        ax.plot(fsr2, label="FSR2")

        if len(hs) > 0:
            ax.scatter(hs, fsr1.iloc[hs], color="red", label="Heel Strike")
        if len(to) > 0:
            ax.scatter(to, fsr1.iloc[to], color="green", label="Toe Off")

        ax.legend()
        st.pyplot(fig)

    # ---------------------------------------------------------
    # SCHRITTE
    # ---------------------------------------------------------
    with tab2:
        st.subheader("Schritt-Analyse")
        st.dataframe(step_df)

    # ---------------------------------------------------------
    # METRIKEN
    # ---------------------------------------------------------
    with tab3:
        st.subheader("Gang-Metriken")

        st.write(f"**Step Count:** {step_count}")
        st.write(f"**Stride Count:** {stride_count}")
        st.write("---")

        for key, value in base_metrics.items():
            st.write(f"**{key}:** {value:.2f}")

        st.write("---")
        st.write(f"**Cadence:** {cadence:.2f} Schritte/min")

        if mean_stride:
            st.write(f"Stride Time: {mean_stride:.2f} ms")
            st.write(f"Stride SD: {sd_stride:.2f} ms")
            st.write(f"Stride CoV: {cov_stride:.2f} %")

        # ---------------------------------------------------------
        # Erweiterte Klinische Parameter
        # ---------------------------------------------------------

        # Kontaktzeit-Variabilität
        if len(step_df) > 1:
            contact_times = step_df["Contact_Time_ms"].to_numpy()
            contact_mean = np.mean(contact_times)
            contact_sd = np.std(contact_times)
            contact_cov = (contact_sd / contact_mean) * 100
        else:
            contact_mean = contact_sd = contact_cov = None

        # Asymmetrie
        fsr1_mean = float(fsr1.mean())
        fsr2_mean = float(fsr2.mean())
        asymmetry = abs(fsr1_mean - fsr2_mean) / ((fsr1_mean + fsr2_mean) / 2) * 100

        # Peak-Force Variabilität
        peaks = []
        for _, row in step_df.iterrows():
            hs_idx = int(row["HS_Index"])
            to_idx = int(row["TO_Index"])
            seg = fsr1[hs_idx:to_idx]
            if len(seg) > 0:
                peaks.append(seg.max())

        peak_var = np.std(peaks) / np.mean(peaks) * 100 if len(peaks) > 2 else None

        # ---------------------------------------------------------
        # Gait Score
        # ---------------------------------------------------------

        gait_score = 100

        if cov_stride:
            gait_score -= cov_stride * 1.5
        if contact_cov:
            gait_score -= contact_cov * 1.2
        gait_score -= asymmetry * 1.0
        if peak_var:
            gait_score -= peak_var * 0.8

        gait_score = max(0, min(100, gait_score))

        # ---------------------------------------------------------
        # Sturzrisiko
        # ---------------------------------------------------------

        fall_risk = 0
        if cov_stride and cov_stride > 8: fall_risk += 1
        if contact_cov and contact_cov > 10: fall_risk += 1
        if asymmetry > 6: fall_risk += 1
        if peak_var and peak_var > 15: fall_risk += 1
        fall_risk = min(fall_risk, 3)

        # ---------------------------------------------------------
        # Anzeige
        # ---------------------------------------------------------

        st.write("### Erweiterte Analyse")
        if contact_mean:
            st.write(f"Kontaktzeit Mittel: {contact_mean:.2f} ms")
            st.write(f"Kontaktzeit Variabilität (CoV): {contact_cov:.2f} %")
        st.write(f"Asymmetrie FSR1/FSR2: {asymmetry:.2f} %")
        if peak_var:
            st.write(f"Peak-Force Variabilität: {peak_var:.2f} %")

        st.write("---")
        st.write(f"### 🧠 Gait Score: **{gait_score:.1f} / 100**")
        st.write(f"### ⚠️ Sturzrisiko-Level: **{fall_risk} von 3**")
        st.write("---")

        # ---------------------------------------------------------
        # Textbasierter Medizinbericht
        # ---------------------------------------------------------

        report = f"""
MyProSole – Medizinischer Gangbericht
-------------------------------------

Schritte gesamt: {step_count}
Kadenz: {cadence:.1f} Schritte/min

Kontaktzeit Mittel: {contact_mean:.1f} ms
Kontaktzeit Variabilität: {contact_cov:.1f} %
Asymmetrie L/R: {asymmetry:.1f} %
Peak-Variabilität: {peak_var:.1f} %

Gait Score: {gait_score:.1f} / 100
Sturzrisiko-Level: {fall_risk} von 3

Interpretation:
- Hohe Variabilität deutet auf instabile Gangmuster hin.
- Asymmetrien können durch Schmerzen, Arthrose oder muskuläre Dysbalancen entstehen.
- Ein niedriger Gait Score < 70 oder Sturzrisiko ≥ 2 sollte weiter klinisch abgeklärt werden.
"""

        st.write("### 📄 Medizinischer Bericht")
        st.text(report)

        # ---------------------------------------------------------
        # Download
        # ---------------------------------------------------------

        st.download_button(
            label="📥 Bericht als TXT herunterladen",
            data=report,
            file_name="MyProSole_Gangbericht.txt"
        )
