"""Analyse-Zusammenfassung und regelbasierte Übungsempfehlungen (Analyse-Tab)."""

import streamlit as st

from core.context import AppContext
from core.domain.exercises_catalog import exercise_ids_for_diagnosis
from core.domain.recommendations import analyze_and_recommend
from core.registry import ModuleRegistry
from modules.exercises.navigation import navigate_to_exercises


class ExerciseRecommendationsModule:
    id = "exercise_recommendations"
    display_name = "Analyse & Empfehlungen"
    order = 20

    def register_sidebar(self, ctx: AppContext) -> None:
        pass

    def render(self, ctx: AppContext) -> None:
        pass

    def render_analysis_tab(self, ctx: AppContext) -> None:
        analysis = ctx.param("analysis")
        if not analysis:
            st.info(
                "Noch keine Analyse vorhanden. Bitte eine Datei hochladen und die "
                "Schrittanalyse durchführen – danach erscheinen hier Muster und Übungsvorschläge."
            )
            return

        df = analysis["df"]
        events = analysis["events"]
        summary = analysis["summary"]
        pressure_analysis = analysis.get("pressure_analysis") or ctx.param("pressure_analysis")
        report = analyze_and_recommend(
            df, events, summary, pressure_analysis=pressure_analysis
        )

        st.subheader("Druck- und Gangmuster")
        st.caption(
            "Auswertung der Schrittanalyse: druckbasierte Muster und Kennzahlen – "
            "darauf basieren die Übungsvorschläge unten."
        )

        self._render_metrics_summary(report["metrics"])
        self._render_patterns(report["diagnoses"])

        st.divider()
        st.subheader("Personalisierte Übungsvorschläge")
        st.caption("Abgeleitet aus den Mustern oben – jeweils mit kurzer Begründung.")

        diagnosis_ids = [d.id for d in report["diagnoses"]]

        for rec in report["recommendations"]:
            with st.container(border=True):
                st.markdown(f"### {rec.title}")
                st.write(f"**Weil:** {rec.because}")
                st.write(f"**Ziel:** {rec.goal}")
                st.write("**Übungen:**")
                for item in rec.exercises:
                    st.write(f"- {item}")
                exercise_ids = list(exercise_ids_for_diagnosis(rec.diagnosis_id))
                if st.button(
                    "Übungen ansehen",
                    key=f"open_exercises_{rec.diagnosis_id}",
                    type="secondary",
                ):
                    navigate_to_exercises(
                        diagnosis_ids=diagnosis_ids,
                        focus_exercise_ids=exercise_ids,
                    )

        st.divider()
        if st.button(
            "Alle empfohlenen Übungen öffnen",
            key="open_all_recommended_exercises",
            type="primary",
        ):
            navigate_to_exercises(diagnosis_ids=diagnosis_ids)

    def _render_metrics_summary(self, metrics: dict) -> None:
        st.markdown("#### Kennzahlen")
        col1, col2, col3 = st.columns(3)
        col1.metric("Gültige Schritte", metrics.get("n_steps_valid", 0))
        col2.metric("Kadenz (Schritte/min)", f"{metrics.get('cadence_spm', 0):.1f}")
        col3.metric("Schrittzeit-CV (%)", f"{metrics.get('step_time_cv_percent', 0):.1f}")

        col4, col5, col6 = st.columns(3)
        col4.metric("Stance-Ratio (Ø)", f"{metrics.get('stance_ratio_mean', 0):.2f}")
        col5.metric("Ø Schrittzeit (s)", f"{metrics.get('step_time_mean_s', 0):.2f}")
        if "heel_dominance_percent" in metrics:
            col6.metric("Fersenbelastung (%)", f"{metrics['heel_dominance_percent']:.1f}")
        elif "left_right_distribution_percentage" in metrics:
            col6.metric(
                "Links/Rechts",
                f"{metrics['left_right_distribution_percentage']:.1f} % links",
            )
        else:
            col6.metric("Druckverteilung", "–")

        if "total_pressure_left" in metrics and "total_pressure_right" in metrics:
            col7, col8, col9 = st.columns(3)
            col7.metric("Druck links", f"{metrics['total_pressure_left']:.1f}")
            col8.metric("Druck rechts", f"{metrics['total_pressure_right']:.1f}")
            if "estimated_body_weight_kg" in metrics:
                col9.metric("Gewicht geschätzt", f"{metrics['estimated_body_weight_kg']:.1f} kg")
            else:
                col9.metric("Gewicht geschätzt", "–")

    def _render_patterns(self, diagnoses) -> None:
        st.markdown("#### Erkannte Muster")
        if len(diagnoses) == 1 and diagnoses[0].id == "unremarkable_profile":
            st.success(diagnoses[0].finding)
            return

        for d in diagnoses:
            with st.expander(d.title, expanded=True):
                st.write(d.finding)
                if d.metrics:
                    parts = [f"**{k.replace('_', ' ')}:** {v}" for k, v in d.metrics.items()]
                    st.caption(" | ".join(parts))


def register(registry: ModuleRegistry) -> None:
    registry.add(ExerciseRecommendationsModule())
