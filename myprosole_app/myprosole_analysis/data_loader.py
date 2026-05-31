"""
data_loader.py
==============
Lädt die Sensor-CSV einer MyProSole-Einlage mit pandas und prüft das Schema.

Verantwortlichkeiten:
- CSV einlesen
- Sicherstellen, dass alle Pflichtspalten vorhanden sind (config.REQUIRED_COLUMNS)
- Bei fehlenden Spalten eine klare, deutsche Fehlermeldung erzeugen
- Zeitspalte und Sensorspalten als numerische Werte sicherstellen
"""

from __future__ import annotations

import os

import pandas as pd

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config


class DataValidationError(ValueError):
    """Wird ausgelöst, wenn die CSV nicht dem erwarteten Schema entspricht."""


def load_csv(file_path: str) -> pd.DataFrame:
    """Lädt eine MyProSole-CSV und validiert die Pflichtspalten.

    Args:
        file_path: Pfad zur CSV-Datei.

    Returns:
        Ein pandas DataFrame mit mindestens den Pflichtspalten, numerisch typisiert.

    Raises:
        FileNotFoundError: Wenn die Datei nicht existiert.
        DataValidationError: Wenn Pflichtspalten fehlen oder keine Daten vorhanden sind.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"CSV-Datei nicht gefunden: {file_path}")

    # CSV einlesen. sep=None + engine='python' erkennt Trennzeichen automatisch
    # (Komma/Semikolon), was bei unterschiedlichen Exporten robust ist.
    try:
        df = pd.read_csv(file_path, sep=None, engine="python")
    except Exception as exc:  # noqa: BLE001 - bewusst breit, um klare Meldung zu geben
        raise DataValidationError(
            f"Die CSV konnte nicht gelesen werden: {file_path}\nUrsprünglicher Fehler: {exc}"
        ) from exc

    # Spaltennamen von führenden/abschließenden Leerzeichen befreien.
    df.columns = [str(col).strip() for col in df.columns]

    _validate_columns(df)

    # Pflichtspalten in numerische Werte umwandeln (Fehler -> NaN, später bereinigt).
    for col in config.REQUIRED_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    if df.empty:
        raise DataValidationError("Die CSV enthält keine Datenzeilen.")

    # Nach Zeit sortieren und Index zurücksetzen (defensive Annahme).
    df = df.sort_values(config.TIME_COLUMN, kind="stable").reset_index(drop=True)

    return df


def _validate_columns(df: pd.DataFrame) -> None:
    """Prüft, ob alle Pflichtspalten vorhanden sind, und meldet sonst klar die fehlenden."""
    missing = [col for col in config.REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        gefunden = ", ".join(df.columns) if len(df.columns) else "(keine)"
        raise DataValidationError(
            "Die CSV enthält nicht alle erforderlichen Spalten.\n"
            f"Fehlende Spalten: {', '.join(missing)}\n"
            f"Erwartete Spalten: {', '.join(config.REQUIRED_COLUMNS)}\n"
            f"Gefundene Spalten: {gefunden}"
        )
