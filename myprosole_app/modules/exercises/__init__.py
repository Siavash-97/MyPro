"""Übungsseite: Katalog-Anzeige, Filter, Navigation aus Empfehlungen."""

from core.context import AppContext
from core.registry import ModuleRegistry
from modules.exercises.render import render_exercises_page


class ExercisesModule:
    id = "exercises"
    display_name = "Übungen"
    order = 30

    def register_sidebar(self, ctx: AppContext) -> None:
        pass

    def render(self, ctx: AppContext) -> None:
        # Hauptinhalt liegt auf der Multipage-Route pages/2_Übungen.py
        pass


def register(registry: ModuleRegistry) -> None:
    registry.add(ExercisesModule())


__all__ = ["render_exercises_page", "ExercisesModule", "register"]
