from dataclasses import dataclass, field
from typing import Callable, Iterable, Protocol, runtime_checkable

from core.context import AppContext


@dataclass
class TabContribution:
    """Ein Inhaltsbeitrag eines Moduls zu einem gemeinsamen Analyse-Tab.

    Mehrere Module können in denselben Tab (``section_key``) einzahlen. Die
    Reihenfolge der Tabs richtet sich nach ``section_order``, die Reihenfolge der
    Beiträge innerhalb eines Tabs nach ``item_order``. ``render`` zeichnet den
    Inhalt in das Panel (bekommt den AppContext, kann ihn aber ignorieren).
    """

    section_key: str
    section_label: str
    section_order: int
    render: Callable[[AppContext], None]
    item_order: int = 0


@dataclass
class TabSection:
    """Ein zusammengeführter Tab: Label + geordnete Beiträge mehrerer Module."""

    key: str
    label: str
    order: int
    items: list[TabContribution] = field(default_factory=list)


@runtime_checkable
class FeatureModule(Protocol):
    """Schnittstelle für Feature-Module. Implementierung in modules/<name>/."""

    id: str
    display_name: str
    order: int

    def register_sidebar(self, ctx: AppContext) -> None:
        """Sidebar-Widgets registrieren (optional)."""

    def render(self, ctx: AppContext) -> None:
        """Hauptinhalt rendern (für Module ohne eigene Analyse-Tabs)."""

    def analysis_tabs(self, ctx: AppContext) -> Iterable[TabContribution]:
        """Optional: Inhalte zu den gemeinsamen Analyse-Tabs beitragen."""


def has_analysis_tabs(module: FeatureModule) -> bool:
    return callable(getattr(type(module), "analysis_tabs", None))


class ModuleRegistry:
    def __init__(self) -> None:
        self._modules: dict[str, FeatureModule] = {}

    def add(self, module: FeatureModule) -> None:
        if module.id in self._modules:
            raise ValueError(f"Modul '{module.id}' ist bereits registriert.")
        self._modules[module.id] = module

    def sorted_modules(self) -> list[FeatureModule]:
        return sorted(self._modules.values(), key=lambda m: (m.order, m.id))

    def collect_tab_sections(self, ctx: AppContext) -> list[TabSection]:
        """Sammelt alle Tab-Beiträge der Module und gruppiert sie zu Tabs.

        Die Module werden in ``order``-Reihenfolge befragt, damit Module mit
        kleinerer ``order`` (z. B. die Schrittanalyse) zuerst ihre Ergebnisse im
        AppContext veröffentlichen können, bevor spätere Module sie lesen.
        """
        contributions: list[TabContribution] = []
        for module in self.sorted_modules():
            if not has_analysis_tabs(module):
                continue
            contributions.extend(module.analysis_tabs(ctx) or [])

        grouped: dict[str, list[TabContribution]] = {}
        for contribution in contributions:
            grouped.setdefault(contribution.section_key, []).append(contribution)

        sections: list[TabSection] = []
        for key, items in grouped.items():
            ordered_items = sorted(items, key=lambda c: c.item_order)
            label = ordered_items[0].section_label
            order = min(c.section_order for c in ordered_items)
            sections.append(TabSection(key=key, label=label, order=order, items=ordered_items))

        sections.sort(key=lambda s: (s.order, s.key))
        return sections
