"""
myprosole_analysis
==================
Regelbasierte (KEINE KI) Gang-/Laufanalyse für MyProSole-Einlagen mit 3
FSR-Drucksensoren pro Fuß.

Dieses Verzeichnis ist sowohl als eigenständiges Kommandozeilen-Projekt
(``python myprosole_analysis/main.py sample_data.csv``) als auch als
importierbares Python-Package nutzbar (z. B. aus der Streamlit-App heraus:
``from myprosole_analysis import step_detection``).

Damit beide Nutzungsarten funktionieren, verwenden die einzelnen Module einen
"dual import"-Stil: zuerst wird der relative Package-Import versucht
(``from . import config``) und nur als Fallback der flache Skript-Import
(``import config``). So bleibt die CLI-Nutzung erhalten, ohne mit der ebenfalls
vorhandenen ``config.py`` im App-Stammverzeichnis zu kollidieren.
"""

from __future__ import annotations
