"""Community: Feed, Gruppen und ZusammenLauf (Demo-Modus, siehe render.py)."""

from core.context import AppContext
from core.registry import ModuleRegistry
from modules.community.render import render_community_page


class CommunityModule:
    id = "community"
    display_name = "Community"
    order = 40

    def register_sidebar(self, ctx: AppContext) -> None:
        pass

    def render(self, ctx: AppContext) -> None:
        # Hauptinhalt liegt auf der Multipage-Route pages/3_Community.py
        pass


def register(registry: ModuleRegistry) -> None:
    registry.add(CommunityModule())


__all__ = ["render_community_page", "CommunityModule", "register"]
