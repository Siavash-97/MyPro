"""UI der Übungsseite (Platzhalter für spätere Videos)."""

from __future__ import annotations

import streamlit as st

from core.domain.exercises_catalog import Exercise, all_exercises, exercises_for_diagnosis_ids
from modules.exercises.navigation import (
    FILTER_ALL,
    FILTER_FROM_ANALYSIS,
    SESSION_FILTER_MODE,
    get_diagnosis_ids,
    get_filter_mode,
    get_focus_exercise_ids,
)


def _render_video_section(exercise: Exercise) -> None:
    st.markdown("#### Video")
    if exercise.video_url:
        st.video(exercise.video_url)
    else:
        st.info("Video folgt – Anleitung vorerst in den Schritten unten.")


def _render_exercise_card(exercise: Exercise, *, highlighted: bool = False) -> None:
    label = exercise.title
    if highlighted:
        label = f"⭐ {label}"
    with st.container(border=True):
        st.markdown(f"### {label}")
        st.write(exercise.description)
        _render_video_section(exercise)
        st.markdown("#### Schritte")
        for i, step in enumerate(exercise.steps, start=1):
            st.write(f"{i}. {step}")


def _resolve_exercise_list(filter_mode: str) -> list[Exercise]:
    diagnosis_ids = get_diagnosis_ids()

    if filter_mode == FILTER_FROM_ANALYSIS and diagnosis_ids:
        return exercises_for_diagnosis_ids(diagnosis_ids)
    return all_exercises()


def render_exercises_page() -> None:
    st.title("Übungen")
    st.caption(
        "Übungsanleitungen zu Ihren Analyse-Mustern – Videos können später pro Übung ergänzt werden."
    )

    diagnosis_ids = get_diagnosis_ids()
    has_analysis = bool(diagnosis_ids)

    if has_analysis:
        st.success(
            "Es liegen Muster aus Ihrer letzten Schrittanalyse vor. "
            "Standardmäßig sehen Sie die passenden Übungen."
        )
    else:
        st.info(
            "Noch keine Analyse-Übungen ausgewählt. "
            "Führen Sie eine Schrittanalyse durch oder öffnen Sie Empfehlungen über „Analyse & Empfehlungen“."
        )

    filter_mode = get_filter_mode()
    if has_analysis:
        options = {
            "Aus Ihrer Analyse": FILTER_FROM_ANALYSIS,
            "Alle Übungen": FILTER_ALL,
        }
        labels = list(options.keys())
        default_label = (
            "Aus Ihrer Analyse" if filter_mode == FILTER_FROM_ANALYSIS else "Alle Übungen"
        )
        try:
            default_index = labels.index(default_label)
        except ValueError:
            default_index = 0
        choice = st.radio(
            "Anzeige",
            labels,
            index=default_index,
            horizontal=True,
            key="exercises_filter_radio",
        )
        filter_mode = options[choice]
        st.session_state[SESSION_FILTER_MODE] = filter_mode
    else:
        filter_mode = FILTER_ALL
        st.session_state[SESSION_FILTER_MODE] = filter_mode

    exercises = _resolve_exercise_list(filter_mode)

    if not exercises:
        st.warning("Für die gewählten Muster sind noch keine Übungen hinterlegt.")
        return

    st.subheader(
        f"{len(exercises)} Übung{'en' if len(exercises) != 1 else ''}"
        + (" (aus Ihrer Analyse)" if filter_mode == FILTER_FROM_ANALYSIS and has_analysis else "")
    )

    focus_ids = set(get_focus_exercise_ids())
    for exercise in exercises:
        _render_exercise_card(exercise, highlighted=exercise.id in focus_ids)
