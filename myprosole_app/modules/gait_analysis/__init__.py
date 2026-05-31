"""
Gang-/Laufanalyse (regelbasiert)
================================
Streamlit-Modul, das die regelbasierte Analyse aus dem Package
``myprosole_analysis`` in die bestehende MyProSole-App integriert.

Es erkennt Schritte getrennt für links/rechts, berechnet pro Schritt Features,
klassifiziert das Kontaktmuster über feste Regeln (KEINE KI, keine medizinische
Diagnose) und vergleicht beide Seiten. Akzeptiert sowohl das neue
``time_s``-Format als auch die bisherigen App-Formate (z. B. ``timestamp_ms``).
"""

from __future__ import annotations

import streamlit as st

from core.context import AppContext
from core.registry import ModuleRegistry
from myprosole_analysis import visualization as gait_viz

from . import interactive_viz
from .pipeline import default_params, run_pipeline


class GaitAnalysisModule:
    id = "gait_analysis"
    display_name = "Gang-/Laufanalyse (regelbasiert)"
    order = 20

    def register_sidebar(self, ctx: AppContext) -> None:
        defaults = default_params()
        with st.sidebar:
            st.subheader("Gang-/Laufanalyse-Parameter")
            ctx.set_param(
                "gait_analysis",
                {
                    "SENSOR_THRESHOLD": st.slider(
                        "Sensor-Schwelle (Kontakt ab)",
                        0.0,
                        200.0,
                        float(defaults["SENSOR_THRESHOLD"]),
                        step=1.0,
                        help="Ab diesem Rohwert gilt ein Sensor als aktiv (Bodenkontakt).",
                    ),
                    "MIN_STEP_DURATION_MS": st.slider(
                        "Min. Standphasendauer (ms)",
                        50.0,
                        1000.0,
                        float(defaults["MIN_STEP_DURATION_MS"]),
                        step=10.0,
                    ),
                    "MAX_STEP_DURATION_MS": st.slider(
                        "Max. Standphasendauer (ms)",
                        500.0,
                        5000.0,
                        float(defaults["MAX_STEP_DURATION_MS"]),
                        step=50.0,
                    ),
                    "MIN_SWING_DURATION_MS": st.slider(
                        "Min. Schwungphasendauer (ms)",
                        20.0,
                        500.0,
                        float(defaults["MIN_SWING_DURATION_MS"]),
                        step=10.0,
                    ),
                    "FLAT_FOOT_TIME_WINDOW_MS": st.slider(
                        "Flat-Foot-Zeitfenster (ms)",
                        20.0,
                        400.0,
                        float(defaults["FLAT_FOOT_TIME_WINDOW_MS"]),
                        step=10.0,
                        help="Folgt der Vorfuß innerhalb dieses Fensters auf die Ferse, "
                        "gilt der Aufsatz als flach.",
                    ),
                    "LATE_HEEL_CONTACT_THRESHOLD_MS": st.slider(
                        "Schwelle 'später Fersenkontakt' (ms)",
                        20.0,
                        500.0,
                        float(defaults["LATE_HEEL_CONTACT_THRESHOLD_MS"]),
                        step=10.0,
                    ),
                    "MEDIAL_LATERAL_THRESHOLD": st.slider(
                        "Medial/Lateral-Schwelle",
                        0.05,
                        0.6,
                        float(defaults["MEDIAL_LATERAL_THRESHOLD"]),
                        step=0.05,
                        help="Unterschied medial vs. lateral, ab dem eine Seite als "
                        "dominant markiert wird.",
                    ),
                    "ASYMMETRY_THRESHOLD_PERCENT": st.slider(
                        "Asymmetrie-Schwelle (%)",
                        5.0,
                        50.0,
                        float(defaults["ASYMMETRY_THRESHOLD_PERCENT"]),
                        step=1.0,
                    ),
                    "SMOOTHING_WINDOW_SAMPLES": st.slider(
                        "Glättungsfenster (Samples)",
                        1,
                        15,
                        int(defaults["SMOOTHING_WINDOW_SAMPLES"]),
                        step=2,
                    ),
                },
            )

    def render(self, ctx: AppContext) -> None:
        st.write("---")
        st.header("Gang-/Laufanalyse (regelbasiert)")
        st.caption(
            "Regelbasierte Schritt-/Kontaktmusteranalyse pro Fuß. Es werden nur "
            "neutrale Hinweise erzeugt – KEINE medizinische Diagnose."
        )

        params = ctx.param("gait_analysis") or {}

        shared = ctx.param("shared_data")
        if not shared:
            st.info("Bitte zuerst oben eine Datei hochladen.")
            return

        raw_df = shared["raw_df"]

        try:
            result = run_pipeline(raw_df, params)
        except Exception as exc:
            st.error(f"Fehler in der Analysepipeline: {exc}")
            return

        if result.missing_sensor_columns:
            st.warning(
                "Folgende Sensorspalten fehlten in der Datei und wurden mit 0 "
                "aufgefüllt (Ergebnisse für diese Sensoren sind nicht aussagekräftig): "
                + ", ".join(result.missing_sensor_columns)
            )

        if not result.steps:
            st.warning(
                "Es konnten keine gültigen Schritte erkannt werden. Bitte die "
                "Parameter (z. B. Sensor-Schwelle, Schrittdauern) oder das Signal prüfen."
            )
            return

        tabs = st.tabs(
            [
                "Schritte",
                "Links/Rechts",
                "Kontaktmuster",
                "Visualisierung",
            ]
        )

        with tabs[0]:
            self._render_steps_tab(result)
        with tabs[1]:
            self._render_summary_tab(result)
        with tabs[2]:
            self._render_pattern_tab(result)
        with tabs[3]:
            self._render_visualization_tab(result)

    def _render_steps_tab(self, result) -> None:
        st.subheader("Step-Level-Tabelle")
        st.dataframe(result.step_table, width="stretch")
        csv_bytes = result.step_table.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Step-Tabelle herunterladen (CSV)",
            data=csv_bytes,
            file_name="myprosole_gait_steps.csv",
            mime="text/csv",
            key="gait_steps_download",
        )

    def _render_summary_tab(self, result) -> None:
        lr = result.left_right
        st.subheader("Zusammenfassung Links/Rechts")

        col1, col2, col3 = st.columns(3)
        col1.metric("Schritte gesamt", lr.get("total_step_count", 0))
        col2.metric("Links / Rechts", f"{lr.get('step_count_left', 0)} / {lr.get('step_count_right', 0)}")
        col3.metric("Lastdifferenz", f"{lr.get('load_difference_percent', 0.0):.1f} %")

        dominant_labels = {
            "left": "Links",
            "right": "Rechts",
            "balanced": "Ausgeglichen",
            "none": "–",
        }
        st.write(
            f"**Dominante Seite:** {dominant_labels.get(lr.get('dominant_side'), lr.get('dominant_side'))}"
        )
        st.info(lr.get("asymmetry_note", ""))

        st.dataframe(result.summary_table, width="stretch")

    def _render_pattern_tab(self, result) -> None:
        st.subheader("Kontaktmuster-Verteilung pro Seite (% der Schritte)")
        dist = result.pattern_distribution
        st.dataframe(dist, width="stretch")
        if not dist.empty:
            chart_df = dist.set_index("contact_pattern")[["links_%", "rechts_%"]]
            st.bar_chart(chart_df)

    def _render_visualization_tab(self, result) -> None:
        st.subheader("Sensor-Zeitreihe und erkannte Schritte")
        st.caption(
            "Die Diagramme sind interaktiv: mit der Maus zum Zoomen aufziehen, "
            "Doppelklick setzt zurück. Über die Häkchen lassen sich einzelne "
            "Sensoren und Füße aus-/einblenden."
        )

        st.markdown("**Sichtbare Sensoren:**")
        col_s1, col_s2, col_s3 = st.columns(3)
        show_s1 = col_s1.checkbox("Ferse (S1)", value=True, key="gait_show_s1")
        show_s2 = col_s2.checkbox("lateraler Vorfuß (S2)", value=True, key="gait_show_s2")
        show_s3 = col_s3.checkbox("medialer Vorfuß (S3)", value=True, key="gait_show_s3")

        st.markdown("**Sichtbare Füße:**")
        col_l, col_r = st.columns(2)
        show_left = col_l.checkbox("Linker Fuß", value=True, key="gait_show_left")
        show_right = col_r.checkbox("Rechter Fuß", value=True, key="gait_show_right")

        if not (show_s1 or show_s2 or show_s3):
            st.info("Bitte mindestens einen Sensortyp auswählen, um die Kurven zu sehen.")
        if not (show_left or show_right):
            st.info("Bitte mindestens einen Fuß auswählen.")

        timeseries_fig = interactive_viz.build_sensor_timeseries_plotly(
            result.df,
            show_s1=show_s1,
            show_s2=show_s2,
            show_s3=show_s3,
            show_left=show_left,
            show_right=show_right,
        )
        st.plotly_chart(timeseries_fig, width="stretch", key="gait_timeseries_plot")

        steps_fig = interactive_viz.build_detected_steps_plotly(
            result.df,
            result.steps,
            show_left=show_left,
            show_right=show_right,
        )
        st.plotly_chart(steps_fig, width="stretch", key="gait_steps_plot")

        st.subheader("Druck- und Verteilungsvergleich Links/Rechts")
        col1, col2 = st.columns(2)
        with col1:
            st.pyplot(gait_viz.build_peak_pressure_lr_figure(result.left_right))
        with col2:
            st.pyplot(gait_viz.build_total_pressure_lr_figure(result.left_right))
        st.pyplot(gait_viz.build_medial_lateral_ratio_figure(result.left_right))


def register(registry: ModuleRegistry) -> None:
    registry.add(GaitAnalysisModule())
