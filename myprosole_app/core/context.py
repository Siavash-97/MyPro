from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from core.registry import ModuleRegistry


@dataclass
class AppContext:
    """Geteilter Zustand zwischen Kern und Feature-Modulen pro Streamlit-Rerun."""

    registry: "ModuleRegistry | None" = None
    params: dict[str, Any] = field(default_factory=dict)

    def param(self, key: str, default: Any = None) -> Any:
        return self.params.get(key, default)

    def set_param(self, key: str, value: Any) -> None:
        self.params[key] = value
