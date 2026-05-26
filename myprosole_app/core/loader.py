import importlib
from types import ModuleType

from config import ENABLED_MODULES
from core.registry import ModuleRegistry


def _load_module(path: str) -> ModuleType:
    return importlib.import_module(path)


def load_modules(registry: ModuleRegistry) -> None:
    """Lädt alle in config.ENABLED_MODULES eingetragenen Feature-Module."""
    for module_path in ENABLED_MODULES:
        mod = _load_module(module_path)
        register_fn = getattr(mod, "register", None)
        if register_fn is None:
            raise ImportError(f"{module_path} exportiert keine register(registry)-Funktion.")
        register_fn(registry)
