# MyProSole

Laufanalyse- und Trainingsplattform (PWA) mit Sensor-Auswertung, personalisiertem
Training und DSGVO-konformer Gesundheitsdatenverwaltung.

## Projektstruktur

```
MyPro/
├── myprosole_app/       Python/Streamlit – Sensoranalyse & Auswertung
├── myprosole_web/       React/TypeScript – Web-Frontend (Vite + Supabase)
├── project-planner/     Projektplaner (separates Projekt, eigenes Supabase)
├── docs/                Gemeinsame Dokumentation
├── scripts/             Qualitäts-Gates und Build-Skripte
└── .github/             CI-Workflows und PR-Template
```

### MyProSole-App (`myprosole_app/`)

Python-basierte Sensoranalyse-Pipeline: FSR-Drucksensoren, IMU-Bewegungsdaten,
Ganganalyse, Kalibrierung. Enthält die Supabase-Datenbankmigrationen für das
gesamte MyProSole-Backend unter `supabase/migrations/`.

### MyProSole-Web (`myprosole_web/`)

React/TypeScript-PWA mit Material Design 3, Supabase-Auth, Trainingsplanung
und Anamnese-Erfassung.

### Projektplaner (`project-planner/`)

Eigenständiges Gantt-Planungstool mit eigenem Supabase-Projekt. Nutzt eine
separate Datenbank und hat keine fachliche Abhängigkeit zu MyProSole.
Langfristig ist eine Auslagerung in ein eigenes Repository vorgesehen.

## Entwicklung

Für alle Teilprojekte gelten die
[verbindlichen Entwicklungsstandards](docs/DEVELOPMENT_STANDARDS.md).

Lokale Qualitäts-Gates einmalig aktivieren:

```bash
python scripts/setup_quality_gates.py
```

Vollständige Prüfung vor Übergabe oder Push:

```bash
python scripts/run_tests.py --suite all
```

## Datenbanken

| Projekt        | Supabase-Projekt | Region |
|----------------|------------------|--------|
| MyProSole      | `pssyomphfjvhnnuljtzh` | EU |
| Projektplaner  | `bnifbyhkgtggtenrfmzx` | EU |

Die Datenbanken sind strikt getrennt. MyProSole-Migrationen liegen unter
`myprosole_app/supabase/migrations/`.
