# test auto commit

###############################################################
# BLOCK A — SYSTEM & SETTINGS
# (Globale Parameter & Imports)
###############################################################

import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import plotly.graph_objects as go

SAMPLE_RATE = 200
SAMPLE_TIME_MS = 1000 / SAMPLE_RATE



###############################################################
# BLOCK B — SIGNAL PROCESSING (FSR)
###############################################################

def smooth_signal(x, window=5):
    """Glättet das FSR-Signal leicht, ohne Peaks zu zerstören."""
    return x.rolling(window, center=True).median()



###############################################################
# BLOCK C — EVENT DETECTION (Heel Strike / Toe Off)
###############################################################

def detect_events(fsr1, fsr2):
    hs_list = []
    to_list = []

    hs_threshold = 400
    to_threshold = 300

    contact = False

    for i in range(1, len(fsr1)):

        # Heel Strike
        if not contact and (fsr1[i] > hs_threshold or fsr2[i] > hs_threshold):
            contact = True
            hs_list.append(int(i))

        # Toe Off
        if contact and (fsr1[i] < to_threshold and fsr2[i] < to_threshold):
            contact = False
            to_list.append(int(i))

    return hs_list, to_list



###############################################################
# BLOCK D — SCHRITT-TABELLEN (Index, Dauer, Kontaktzeit)
###############################################################

def compute_step_table(hs, to):
    rows = []
    for i in range(min(len(hs), len(to))):
        hs_i = int(hs[i])
        to_i = int(to[i])
        duration = to_i - hs_i
        rows.append([hs_i, to_i, duration])
    return pd.DataFrame(rows, columns=["HS_Index", "TO_Index", "Step_Duration (samples)"])


def compute_contact_time(step_df):
    if len(step_df) == 0:
        return step_df
    step_df["Contact_Time_ms"] = step_df["Step_Duration (samples)"] * SAMPLE_TIME_MS
    return step_df



###############################################################
# BLOCK E — METRIKEN (Dauer, Cadence, Variabilität, Peaks)
###############################################################

def compute_cadence(num_steps, total_samples):
    total_seconds = total_samples / SAMPLE_RATE
    total_minutes = total_seconds / 60
    return num_steps / total_minutes if total_minutes > 0 else 0


def compute_stride_variability(hs_list):
    if len(hs_list) < 2:
        return None, None, None
    stride = [(hs_list[i+1] - hs_list[i]) * SAMPLE_TIME_MS for i in range(len(hs_list)-1)]
    stride = np.array(stride)
    return stride.mean(), stride.std(), stride.std() / stride.mean() * 100


def compute_metrics(step_df, fsr1, fsr2):
    metrics = {}
    if len(step_df) == 0:
        return metrics

    durations = step_df["Step_Duration (samples)"]

    metrics["Avg Step Duration (samples)"] = durations.mean()
    metrics["SD Step Duration"] = durations.std()
    metrics["CoV Step Duration (%)"] = durations.std() / durations.mean() * 100

    peaks = []
    rise = []

    for _, row in step_df.iterrows():
        hs_i = int(row["HS_Index"])
        to_i = int(row["TO_Index"])
        seg = fsr1[hs_i:to_i]
        if len(seg) > 0:
            peaks.append(seg.max())
            rise.append((seg.max() - seg.min()) / (len(seg) + 1))

    if peaks:
        metrics["Avg Peak Force"] = np.mean(peaks)
        metrics["Avg Rise Rate"] = np.mean(rise)

    return metrics



###############################################################
# BLOCK F — STURZRISIKO ANALYSE
###############################################################

def compute_stability(step_df, mean_stride, sd_stride, cov_stride):
    if len(step_df) == 0:
        return {"step_cov": None, "contact_sd": None, "stride_cov": cov_stride}

    step_cov = step_df["Step_Duration (samples)"].std() / step_df["Step_Duration (samples)"].mean() * 100
    contact_sd = step_df["Contact_Time_ms"].std()

    return {"step_cov": step_cov, "contact_sd": contact_sd, "stride_cov": cov_stride}


def compute_symmetry(fsr1, fsr2, hs, to):
    if len(hs) == 0:
        return None

    left, right = [], []
    for i in range(len(hs)):
        hs_i = hs[i]
        to_i = to[i] if i < len(to) else hs_i + 1
        seg1 = fsr1[hs_i:to_i]
        seg2 = fsr2[hs_i:to_i]
        if len(seg1) > 0:
            left.append(seg1.max())
        if len(seg2) > 0:
            right.append(seg2.max())

    if not left or not right:
        return None

    return min(np.mean(left), np.mean(right)) / max(np.mean(left), np.mean(right)) * 100


def classify_fall_risk(step_cov, contact_sd, stride_cov, symmetry_ratio):
    if step_cov is None:
        return "Nicht genug Daten"

    score = 0
    if step_cov > 12: score += 2
    elif step_cov > 7: score += 1

    if contact_sd and contact_sd > 50: score += 2
    elif contact_sd and contact_sd > 25: score += 1

    if stride_cov and stride_cov > 20: score += 2
    elif stride_cov and stride_cov > 12: score += 1

    if symmetry_ratio and symmetry_ratio < 70: score += 2
    elif symmetry_ratio and symmetry_ratio < 85: score += 1

    if score >= 5: return "⚠️ High Risk"
    if score >= 3: return "⚠️ Medium Risk"
    return "🟢 Low Risk"



###############################################################
# BLOCK G — GAIT QUALITY SCORE (0–100)
###############################################################

def compute_gait_quality(step_cov, stride_cov, contact_sd, symmetry_ratio):
    if step_cov is None:
        return None

    score = 100
    score -= min(step_cov * 0.8, 25)
    score -= min(stride_cov * 0.7, 25) if stride_cov else 0
    score -= min(contact_sd * 0.3, 20) if contact_sd else 0
    score -= min((100 - symmetry_ratio) * 0.3, 20) if symmetry_ratio else 0

    return max(0, min(100, score))



###############################################################
# BLOCK H — SENSOR DATENQUALITÄT (Fehlererkennung)
###############################################################

def detect_data_quality_issues(fsr1, fsr2, hs, to):
    issues = []

    if fsr1.std() < 15 and fsr2.std() < 15:
        issues.append("⚠️ Sehr geringe Signaländerung – Sensor bewegt sich kaum.")

    if fsr1.mean() < 20:
        issues.append("🔴 Sensor 1 sehr niedrige Werte – Verbindung prüfen.")

    if fsr2.mean() < 20:
        issues.append("🔴 Sensor 2 sehr niedrige Werte – Verbindung prüfen.")

    if fsr1.std() > 400 or fsr2.std() > 400:
        issues.append("⚠️ Starkes Rauschen – Kabel locker?")

    if len(hs) < 3:
        issues.append("⚠️ Zu wenige Schritte erkannt.")

    return issues



###############################################################
# BLOCK I — INTERAKTIVER PLOT
###############################################################

def create_interactive_plot(fsr1, fsr2, hs, to):
    fig = go.Figure()

    fig.add_trace(go.Scatter(y=fsr1, mode="lines", name="FSR1"))
    fig.add_trace(go.Scatter(y=fsr2, mode="lines", name="FSR2"))

    fig.add_trace(go.Scatter(
        x=hs, y=[fsr1[i] for i in hs],
        mode="markers", marker=dict(color="red"),
        name="Heel Strike"
    ))

    fig.add_trace(go.Scatter(
        x=to, y=[fsr1[i] for i in to],
        mode="markers", marker=dict(color="green"),
        name="Toe Off"
    ))

    fig.update_layout(
        title="Interaktiver Gang-Plot",
        xaxis_title="Samples",
        yaxis_title="FSR Value",
        height=500
    )
    return fig



###############################################################
# BLOCK J — STREAMLIT UI (Frontend)
###############################################################

st.set_page_config(page_title="MyProSole Schrittanalyse", layout="wide")
st.title("🦶 MyProSole – Schrittanalyse MVP")

uploaded = st.file_uploader("CSV/XLSX hochladen", type=["csv", "xlsx"])

if uploaded:

    ###########################################################
    # J1 — DATEN LADEN & HEADER ERKENNEN
    ###########################################################
    if uploaded.name.endswith(".xlsx"):
        df = pd.read_excel(uploaded)
    else:
        df = pd.read_csv(uploaded)

    df.columns = [str(c).strip().lower() for c in df.columns]

    possible_timestamp = [c for c in df.columns if "time" in c]
    possible_fsr1 = [c for c in df.columns if "fsr1" in c or "sensor1" in c]
    possible_fsr2 = [c for c in df.columns if "fsr2" in c or "sensor2" in c]

    if len(possible_timestamp) == 0:
        df = df.iloc[:, :3]
        df.columns = ["timestamp", "fsr1", "fsr2"]
    else:
        df = df[[possible_timestamp[0], possible_fsr1[0], possible_fsr2[0]]]
        df.columns = ["timestamp", "fsr1", "fsr2"]

    df = df.apply(pd.to_numeric, errors="coerce").dropna().reset_index(drop=True)

    ###########################################################
    # J2 — SIGNAL GLÄTTEN & EVENTS ERKENNEN
    ###########################################################
    fsr1 = smooth_signal(df["fsr1"])
    fsr2 = smooth_signal(df["fsr2"])

    hs, to = detect_events(fsr1, fsr2)

    ###########################################################
    # J3 — SCHRITTANALYSE
    ###########################################################
    step_df = compute_step_table(hs, to)
    step_df = compute_contact_time(step_df)

    base_metrics = compute_metrics(step_df, fsr1, fsr2)
    cadence = compute_cadence(len(hs), len(df))
    mean_stride, sd_stride, cov_stride = compute_stride_variability(hs)

    step_count = len(hs)
    stride_count = max(0, len(hs) - 1)

    ###########################################################
    # J4 — UI: TABS
    ###########################################################
    tab1, tab2, tab3 = st.tabs(["📈 Plot", "📋 Schritte", "📊 Metriken"])



    ###########################################################
    # TAB 1 — Signalplot (Matplotlib)
    ###########################################################
    with tab1:
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot(fsr1, label="FSR1")
        ax.plot(fsr2, label="FSR2")
        ax.scatter(hs, fsr1.iloc[hs], color="red", label="Heel Strike")
        ax.scatter(to, fsr1.iloc[to], color="green", label="Toe Off")
        ax.legend()
        st.pyplot(fig)



    ###########################################################
    # TAB 2 — Schritt-Tabelle
    ###########################################################
    with tab2:
        st.subheader("Schritt-Analyse")
        st.dataframe(step_df)



    ###########################################################
    # TAB 3 — Alle Metriken, Risiko, Qualität, Score, Interaktiv
    ###########################################################
    with tab3:

        st.subheader("📊 Gang-Metriken")

        # Schrittanzahl
        st.write(f"**Step Count:** {step_count}")
        st.write(f"**Stride Count:** {stride_count}")
        st.write("---")

        # Basis-Metriken
        for key, value in base_metrics.items():
            st.write(f"**{key}:** {value:.2f}")

        st.write("---")
        st.write(f"**Cadence:** {cadence:.2f} Schritte/min")

        if mean_stride is not None:
            st.write(f"Stride Time: {mean_stride:.2f} ms")
            st.write(f"Stride SD: {sd_stride:.2f} ms")
            st.write(f"Stride CoV: {cov_stride:.2f} %")
        else:
            st.write("Nicht genug Daten für Stride Analyse.")


        #######################################################
        # Risikoanalyse
        #######################################################
        st.write("---")
        st.subheader("🧠 Stabilität & Sturzrisiko")

        stability = compute_stability(step_df, mean_stride, sd_stride, cov_stride)
        symmetry_ratio = compute_symmetry(fsr1, fsr2, hs, to)

        risk_level = classify_fall_risk(
            stability["step_cov"], stability["contact_sd"],
            stability["stride_cov"], symmetry_ratio
        )

        st.write(f"**Step Variability (CoV):** {stability['step_cov']:.2f}%")
        st.write(f"**Contact Time SD:** {stability['contact_sd']:.2f} ms")
        st.write(f"**Stride Variability CoV:** {stability['stride_cov']:.2f}%")

        if symmetry_ratio is not None:
            st.write(f"**Symmetry Score:** {symmetry_ratio:.1f}%")
        else:
            st.write("Symmetry Score: nicht bestimmbar")

        st.write(f"### 🚨 Fall Risk Classification: {risk_level}")


        #######################################################
        # Datenqualität
        #######################################################
        st.write("---")
        st.subheader("📡 Datenqualität")

        issues = detect_data_quality_issues(fsr1, fsr2, hs, to)

        if len(issues) > 0:
            for issue in issues:
                st.write(issue)
        else:
            st.write("✅ Sehr gute Messqualität.")


        #######################################################
        # Gait Quality Score
        #######################################################
        st.write("---")
        st.subheader("⭐ Gait Quality Score (0–100)")

        gait_score = compute_gait_quality(
            stability["step_cov"], stability["stride_cov"],
            stability["contact_sd"], symmetry_ratio
        )

        st.write(f"### **{gait_score:.1f} / 100**")


        #######################################################
        # Interaktiver Plot
        #######################################################
        st.write("---")
        st.subheader("📊 Interaktiver Plot")

        interactive_fig = create_interactive_plot(fsr1, fsr2, hs, to)
        st.plotly_chart(interactive_fig, use_container_width=True)
