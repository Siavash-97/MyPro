"""UI der Übungsseite (Platzhalter für spätere Videos)."""

from __future__ import annotations

import streamlit as st

from core.domain.exercises_catalog import (
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    Exercise,
    ExerciseCategory,
    all_exercises,
    category_label,
    exercises_for_diagnosis_ids,
    filter_exercises_by_category,
)
from modules.exercises.navigation import (
    FILTER_ALL,
    FILTER_FROM_ANALYSIS,
    SESSION_FILTER_MODE,
    get_diagnosis_ids,
    get_filter_mode,
    get_focus_exercise_ids,
)

SESSION_ACTIVE_CATEGORY = "exercises_active_category"


def _render_video_section(exercise: Exercise) -> None:
    st.markdown("#### Video")
    if exercise.video_url:
        st.video(exercise.video_url)
    else:
        st.info("Video folgt – Anleitung vorerst in den Schritten unten.")


def _render_exercise_card(exercise: Exercise, *, highlighted: bool = False) -> None:
    label = exercise.title
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


def _category_counts(exercises: list[Exercise]) -> dict[ExerciseCategory, int]:
    counts = {cat: 0 for cat in CATEGORY_ORDER}
    for exercise in exercises:
        counts[exercise.category] += 1
    return counts


def _pick_default_category(exercises: list[Exercise]) -> ExerciseCategory:
    counts = _category_counts(exercises)
    for cat in CATEGORY_ORDER:
        if counts[cat] > 0:
            return cat
    return "technique"


def _render_category_picker(exercises: list[Exercise]) -> ExerciseCategory:
    counts = _category_counts(exercises)
    active = st.session_state.get(SESSION_ACTIVE_CATEGORY)
    if active not in CATEGORY_LABELS or counts.get(active, 0) == 0:
        active = _pick_default_category(exercises)
        st.session_state[SESSION_ACTIVE_CATEGORY] = active

    st.markdown("#### Kategorie")
    cols = st.columns(len(CATEGORY_ORDER))
    for col, cat in zip(cols, CATEGORY_ORDER, strict=True):
        label = category_label(cat)
        with col:
            if st.button(
                label,
                key=f"exercises_cat_{cat}",
                type="primary" if cat == active else "secondary",
                use_container_width=True,
                disabled=counts[cat] == 0,
            ):
                st.session_state[SESSION_ACTIVE_CATEGORY] = cat

    return st.session_state[SESSION_ACTIVE_CATEGORY]


def render_exercises_page() -> None:
    st.title("Übungen")
    st.caption(
        "Übungsanleitungen nach Kategorie – Technik, Beweglichkeit oder Kraft. "
        "Videos können später pro Übung ergänzt werden."
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

    st.divider()
    selected_category = _render_category_picker(exercises)

    category_exercises = filter_exercises_by_category(exercises, selected_category)
    cat_label = category_label(selected_category)
    scope = (
        " (aus Ihrer Analyse)"
        if filter_mode == FILTER_FROM_ANALYSIS and has_analysis
        else ""
    )

    st.markdown(f"### {cat_label}{scope}")
    if not category_exercises:
        st.info(f"In **{cat_label}** liegt für die aktuelle Auswahl keine Übung.")
        return

    focus_ids = set(get_focus_exercise_ids())
    for exercise in category_exercises:
        _render_exercise_card(exercise, highlighted=exercise.id in focus_ids)
