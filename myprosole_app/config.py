"""Zentrale Konfiguration – hier Module aktivieren/deaktivieren."""

# Explizite Liste der Feature-Module (Pfad als Python-Import).
# Reihenfolge der Sidebar/Render-Phase: Feld `order` im Modul.
ENABLED_MODULES: list[str] = [
    "modules.step_analysis",
    "modules.exercise_recommendations",
    "modules.exercises",
    "modules.example_feature",
]
