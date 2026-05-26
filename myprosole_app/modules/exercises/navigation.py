"""Navigation zur Übungsseite (Streamlit session_state + switch_page)."""

from __future__ import annotations

import streamlit as st

EXERCISES_PAGE_PATH = "pages/2_Übungen.py"

SESSION_DIAGNOSIS_IDS = "exercises_diagnosis_ids"
SESSION_FOCUS_EXERCISE_IDS = "exercises_focus_exercise_ids"
SESSION_FILTER_MODE = "exercises_filter_mode"

FILTER_FROM_ANALYSIS = "from_analysis"
FILTER_ALL = "all"


def set_exercises_context(
    *,
    diagnosis_ids: list[str] | None = None,
    focus_exercise_ids: list[str] | None = None,
    filter_mode: str | None = None,
) -> None:
    if diagnosis_ids is not None:
        st.session_state[SESSION_DIAGNOSIS_IDS] = list(diagnosis_ids)
    if focus_exercise_ids is not None:
        st.session_state[SESSION_FOCUS_EXERCISE_IDS] = list(focus_exercise_ids)
    if filter_mode is not None:
        st.session_state[SESSION_FILTER_MODE] = filter_mode


def get_diagnosis_ids() -> list[str]:
    return list(st.session_state.get(SESSION_DIAGNOSIS_IDS, []))


def get_focus_exercise_ids() -> list[str]:
    return list(st.session_state.get(SESSION_FOCUS_EXERCISE_IDS, []))


def get_filter_mode() -> str:
    mode = st.session_state.get(SESSION_FILTER_MODE)
    if mode in (FILTER_FROM_ANALYSIS, FILTER_ALL):
        return mode
    if get_diagnosis_ids():
        return FILTER_FROM_ANALYSIS
    return FILTER_ALL


def navigate_to_exercises(
    *,
    diagnosis_ids: list[str] | None = None,
    focus_exercise_ids: list[str] | None = None,
    filter_mode: str | None = FILTER_FROM_ANALYSIS,
) -> None:
    """Session-State setzen und zur Übungsseite wechseln."""
    set_exercises_context(
        diagnosis_ids=diagnosis_ids,
        focus_exercise_ids=focus_exercise_ids,
        filter_mode=filter_mode,
    )
    st.switch_page(EXERCISES_PAGE_PATH)
