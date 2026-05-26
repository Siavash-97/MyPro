from typing import Protocol, runtime_checkable

from core.context import AppContext


@runtime_checkable
class FeatureModule(Protocol):
    """Schnittstelle für Feature-Module. Implementierung in modules/<name>/."""

    id: str
    display_name: str
    order: int

    def register_sidebar(self, ctx: AppContext) -> None:
        """Sidebar-Widgets registrieren (optional)."""

    def render(self, ctx: AppContext) -> None:
        """Hauptinhalt rendern."""

    def render_analysis_tab(self, ctx: AppContext) -> None:
        """Optional: Inhalt eines Analyse-Tabs (nach erfolgreicher Schrittanalyse)."""


def has_analysis_tab(module: FeatureModule) -> bool:
    return callable(getattr(type(module), "render_analysis_tab", None))


class ModuleRegistry:
    def __init__(self) -> None:
        self._modules: dict[str, FeatureModule] = {}

    def add(self, module: FeatureModule) -> None:
        if module.id in self._modules:
            raise ValueError(f"Modul '{module.id}' ist bereits registriert.")
        self._modules[module.id] = module

    def sorted_modules(self) -> list[FeatureModule]:
        return sorted(self._modules.values(), key=lambda m: (m.order, m.id))
