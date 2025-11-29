import pandas as pd
import matplotlib.pyplot as plt
from scipy.signal import find_peaks

# ------------------------------------------------------------
# 1) Daten laden
# ------------------------------------------------------------
def load_data(path):
    print("📂 Lese Datei:", path)
    df = pd.read_excel(path)
    df.columns = ["timestamp", "fsr1", "fsr2"]  # Einheitliche Benennung
    print(f"📊 Daten geladen: {len(df)} Zeilen")
    return df


# ------------------------------------------------------------
# 2) Events erkennen: Heel-Strike (HS) & Toe-Off (TO)
# ------------------------------------------------------------
def detect_events(df):

    fsr = df["fsr1"].values

    # Heel-Strike = lokale Maxima
    hs_peaks, _ = find_peaks(fsr, distance=150, prominence=300)

    # Toe-Off = lokale Minima -> Peaks im invertierten Signal
    inverted = -fsr
    to_peaks, _ = find_peaks(inverted, distance=150, prominence=200)

    print(f"👣 Heel-Strike erkannt: {len(hs_peaks)}")
    print(f"🟢 Toe-Off erkannt: {len(to_peaks)}")

    return hs_peaks, to_peaks


# ------------------------------------------------------------
# 3) Ergebnisse berechnen
# ------------------------------------------------------------
def compute_step_metrics(hs, to):
    results = []

    # Wir matchen jeweils: 1 HS → nächster TO
    to_index = 0

    for heel in hs:
        while to_index < len(to) and to[to_index] < heel:
            to_index += 1

        if to_index >= len(to):
            break

        toe = to[to_index]

        step_time = toe - heel

        results.append({
            "HS_Index": heel,
            "TO_Index": toe,
            "Step_Duration(Samples)": step_time
        })

    return results


# ------------------------------------------------------------
# 4) Plot anzeigen
# ------------------------------------------------------------
def plot_with_events(df, hs, to):
    plt.figure(figsize=(13, 6))
    plt.plot(df["fsr1"], label="FSR1 Signal", color="blue")

    # Heel-Strike -> Rot
    plt.scatter(hs, df["fsr1"].iloc[hs], color="red", s=40, label="Heel-Strike")

    # Toe-Off -> Grün
    plt.scatter(to, df["fsr1"].iloc[to], color="green", s=40, label="Toe-Off")

    plt.title("MyProSole – Schritte & Events")
    plt.xlabel("Samples")
    plt.ylabel("FSR1")
    plt.legend()
    plt.grid(True)
    plt.show()


# ------------------------------------------------------------
# 5) Main – Ablauf
# ------------------------------------------------------------
def main():
    print("\n🚀 Starte MyProSole Analyse...\n")

    df = load_data("FSR_LOG_CSV.xlsx")

    hs, to = detect_events(df)

    # Ergebnisse berechnen
    results = compute_step_metrics(hs, to)

    # Ergebnisse anzeigen
    print("\n============================")
    print("📄 ERGEBNISSE")
    print("============================")
    for r in results:
        print(
            f"HS: {r['HS_Index']:5d} | "
            f"TO: {r['TO_Index']:5d} | "
            f"Step Duration: {r['Step_Duration(Samples)']} samples"
        )

    print("\n📌 Schritte gesamt:", len(results))

    # Plot zeigen
    print("\n📊 Öffne Plot...")
    plot_with_events(df, hs, to)


if __name__ == "__main__":
    main()

