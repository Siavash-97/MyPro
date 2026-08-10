"""Import- und Syntax-Smoke-Tests (ohne Streamlit-Laufzeit)."""

from __future__ import annotations

import importlib
import py_compile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

_PY_FILES = [
    ROOT / "app.py",
    ROOT / "config.py",
    ROOT / "core" / "bootstrap.py",
    ROOT / "core" / "branding.py",
    ROOT / "core" / "domain" / "calibration.py",
    ROOT / "core" / "domain" / "community_catalog.py",
    ROOT / "core" / "domain" / "data_loader.py",
    ROOT / "core" / "domain" / "exercises_catalog.py",
    ROOT / "core" / "domain" / "fsr.py",
    ROOT / "core" / "domain" / "pressure_analysis.py",
    ROOT / "core" / "domain" / "recommendations.py",
    ROOT / "core" / "domain" / "sensor_mapping.py",
    ROOT / "core" / "domain" / "visualization.py",
    ROOT / "modules" / "exercises" / "navigation.py",
    ROOT / "modules" / "exercises" / "render.py",
    ROOT / "modules" / "exercises" / "__init__.py",
    ROOT / "modules" / "exercise_recommendations" / "__init__.py",
    ROOT / "modules" / "step_analysis" / "__init__.py",
    ROOT / "modules" / "community" / "state.py",
    ROOT / "modules" / "community" / "render.py",
    ROOT / "modules" / "community" / "__init__.py",
    ROOT / "pages" / "2_Übungen.py",
    ROOT / "pages" / "3_Community.py",
]


def test_py_compile_all() -> None:
    for path in _PY_FILES:
        assert path.is_file(), f"missing: {path}"
        py_compile.compile(str(path), doraise=True)


def test_import_exercises_catalog() -> None:
    from core.domain.exercises_catalog import (
        EXERCISE_CATALOG,
        exercises_for_diagnosis_ids,
    )

    assert len(EXERCISE_CATALOG) > 0
    exercises = exercises_for_diagnosis_ids(["heel_strike_tendency"])
    assert len(exercises) == 3
    assert exercises[0].id == "barefoot_march"


def test_import_navigation_module() -> None:
    mod = importlib.import_module("modules.exercises.navigation")
    assert mod.EXERCISES_PAGE_PATH == "pages/2_Übungen.py"
