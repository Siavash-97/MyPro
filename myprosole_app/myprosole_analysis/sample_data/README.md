# Synthetische Beispiel-CSVs (MyProSole)

Alle Dateien werden mit `python generate_sample_data.py --all` erzeugt.
Keine echten Messdaten – nur modellierte Verlaeufe zum Testen der Analyse.

| Datei | Profil |
|-------|--------|
| `sample_data.csv` | Gemischte Kontaktmuster (Default) |
| `sample_heel_striker.csv` | Ueberwiegend klassischer Fersenaufsatz |
| `sample_flat_foot.csv` | Flacher Aufsatz / schneller Vorfuess |
| `sample_forefoot_runner.csv` | Vorfuess zuerst (mit/spaeter ohne Ferse) |
| `sample_lateral_dominant.csv` | Erhoehte laterale Vorfuessbelastung |
| `sample_variable_pace.csv` | Wechselnde Standphasenlaenge (langsam/schnell) |

Analyse starten:

```bash
python myprosole_analysis/main.py myprosole_analysis/sample_data/sample_forefoot_runner.csv
python myprosole_analysis/threshold_sensitivity.py myprosole_analysis/sample_data/sample_data.csv
```
