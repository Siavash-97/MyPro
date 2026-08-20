"""Wie viel Strecke erfindet ein stillliegendes Telefon?

Rechnet die Filterkette aus myprosole_web/src/store/run.ts gegen ein
Telefon nach, das ruhig liegt. Die Zahlen in docs/gps-genauigkeit.md,
Teil 3, stammen aus diesem Skript.

    python scripts/gps_drift_messung.py

Grenze des Modells, ausdruecklich benannt: Es nimmt unabhaengiges Rauschen
je Messung an. Echtes GPS wandert langsam, aufeinanderfolgende Messungen
haengen also zusammen und liegen enger beieinander. Eine Distanzschwelle
wirkt in der Praxis deshalb besser als hier. Was das Modell trotzdem zeigt:
Ihre Wirkung haengt vom Rauschcharakter des Geraets ab - die eines
Geschwindigkeitstors nicht.

Kein Zufallsstartwert aus der Uhr: Mit festem Startwert liefert derselbe
Aufruf dieselben Zahlen, und die Angaben im Dokument bleiben nachpruefbar.
"""

import math
import random

# --- Die Schwellen, wie sie heute in run.ts stehen ---------------------------
MIN_SEGMENT_M = 5.0
MAX_SEGMENT_KM = 0.5
MAX_TEMPO_MPS = 12.5

# --- Die Werte aus der Recherche (OpenTracks, Strava) ------------------------
OPENTRACKS_MIN_SEGMENT_M = 10.0
STRAVA_BEWEGUNG_MPS = 0.9

ERDRADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return ERDRADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def stillstand(
    streuung_m: float,
    min_segment_m: float,
    tempo_tor_mps: float | None,
    minuten: int = 30,
    startwert: int = 3,
) -> float:
    """Strecke in Metern, die aus reinem Rauschen entsteht.

    streuung_m    Standardabweichung der Ortung. Die gemeldete accuracy
                  liegt bei etwa dem Doppelten.
    tempo_tor_mps None heisst: kein Doppler-Tor, so wie heute.
    """
    zufall = random.Random(startwert)
    lat0, lon0 = 52.52, 13.405
    meter_je_grad_lat = 111_320.0
    meter_je_grad_lon = 111_320.0 * math.cos(math.radians(lat0))

    strecke_km = 0.0
    letzter = None

    for sekunde in range(minuten * 60):
        lat = lat0 + zufall.gauss(0, streuung_m) / meter_je_grad_lat
        lon = lon0 + zufall.gauss(0, streuung_m) / meter_je_grad_lon

        # Doppler im Stand: ein Restfehler bleibt. Die ISPRS-Messung von 2022
        # findet je nach Geraet Zentimeter bis Dezimeter pro Sekunde; 0,15
        # liegt dazwischen. Genau diese Zahl soll die App spaeter am eigenen
        # Geraet messen, statt sie zu raten - siehe Teil 3, Abschnitt 4.
        doppler_mps = abs(zufall.gauss(0, 0.15))

        if tempo_tor_mps is not None and doppler_mps < tempo_tor_mps:
            # Steht: Der Bezugspunkt wandert mit, Strecke waechst nicht.
            letzter = (lat, lon, sekunde)
            continue

        if letzter is None:
            letzter = (lat, lon, sekunde)
            continue

        segment_km = haversine_km(letzter[0], letzter[1], lat, lon)
        if segment_km * 1000 < min_segment_m:
            continue

        sekunden = sekunde - letzter[2]
        tempo = (segment_km * 1000) / sekunden if sekunden > 0 else float("inf")
        if not (segment_km > MAX_SEGMENT_KM or tempo > MAX_TEMPO_MPS):
            strecke_km += segment_km
        letzter = (lat, lon, sekunde)

    return strecke_km * 1000


def main() -> None:
    print("Ein Telefon liegt still. Wie viel Strecke entsteht trotzdem?\n")

    # Erst der Stand von heute ueber fuenf Minuten. Bemerkenswert ist die
    # erste Zeile: Je besser der Empfang, desto mehr erfundene Strecke - bei
    # kleinen Spruengen wird weniger als Ortungssprung verworfen.
    print("Heutige Filterkette, 5 Minuten:\n")
    print(f"{'Streuung':>9} | {'~accuracy':>10} | {'Strecke':>9} | {'Pace?':>6}")
    print("-" * 44)
    for streuung in (3, 5, 8, 12):
        meter = stillstand(streuung, MIN_SEGMENT_M, None, minuten=5, startwert=1)
        # Unter 50 m zeigt die App "--:--" (MIN_PACE_DISTANCE_KM in run.ts).
        pace = "JA" if meter >= 50 else "nein"
        print(f"{streuung:>7} m | {streuung * 2:>8} m | {meter:>7.0f} m | {pace:>6}")

    print("\n30 Minuten, eine Messung je Sekunde.\n")
    kopf = (
        f"{'Streuung':>9} | {'heute (5 m)':>12} | "
        f"{'OpenTracks (10 m)':>18} | {'10 m + Doppler-Tor':>19}"
    )
    print(kopf)
    print("-" * len(kopf))

    for streuung in (3, 5, 8, 12):
        heute = stillstand(streuung, MIN_SEGMENT_M, None)
        groesser = stillstand(streuung, OPENTRACKS_MIN_SEGMENT_M, None)
        mit_tor = stillstand(
            streuung, OPENTRACKS_MIN_SEGMENT_M, STRAVA_BEWEGUNG_MPS
        )
        print(
            f"{streuung:>7} m | {heute:>10.0f} m | "
            f"{groesser:>16.0f} m | {mit_tor:>17.0f} m"
        )

    print(
        "\nLesart: Die Schwelle zu verdoppeln traegt nicht - eine Mindest-"
        "\ndistanz wirkt nur, solange sie groesser ist als das Rauschen."
        "\nDas Doppler-Tor haengt nicht davon ab."
    )


if __name__ == "__main__":
    main()
