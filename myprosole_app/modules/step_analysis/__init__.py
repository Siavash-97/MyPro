"""Schrittanalyse: Upload, Vorverarbeitung, Plot, Schritte, Metriken."""

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from core.context import AppContext
from core.domain import (
    PAIRED_PRESSURE_FORMAT,
    SENSOR_COLUMNS,
    analyze_pressure,
    compute_step_metrics,
    detect_events,
    load_pressure_dataframe,
    plot_pressure_distribution,
    read_sensor_table,
)
from core.registry import ModuleRegistry, has_analysis_tab


class StepAnalysisModule:
    id = "step_analysis"
    display_name = "Schrittanalyse"
    order = 10

    def register_sidebar(self, ctx: AppContext) -> None:
        with st.sidebar:
            st.subheader("Analyse-Parameter")
            ctx.set_param(
                "step_analysis",
                {
                    "smooth_window": st.slider("Glättung (Fenstergröße)", 3, 15, 5, step=2),
                    "threshold_factor": st.slider("Schwellen-Faktor", 0.05, 0.5, 0.2),
                    "min_step_s": st.slider("Min. Schrittzeit (s)", 0.3, 1.0, 0.5),
                    "max_step_s": st.slider("Max. Schrittzeit (s)", 1.5, 3.0, 2.0),
                    "calibration_factor": st.number_input(
                        "Kalibrierfaktor (kg pro Rohwert, optional)",
                        min_value=0.0,
                        value=0.0,
                        step=0.001,
                        format="%.6f",
                    ),
                },
            )

    def render(self, ctx: AppContext) -> None:
        params = ctx.param("step_analysis") or {}
        uploaded = st.file_uploader("CSV/XLSX hochladen", type=["csv", "xlsx"])

        if not uploaded:
            return

        try:
            raw_df = read_sensor_table(uploaded, uploaded.name)
        except Exception as e:
            st.error(f"❌ Fehler beim Lesen der Datei: {e}")
            st.stop()

        try:
            sensor_format, df = load_pressure_dataframe(
                raw_df, window=params.get("smooth_window", 5)
            )
        except Exception as e:
            st.error(f"❌ Fehler bei der Vorverarbeitung der Sensordaten: {e}")
            st.stop()

        pressure_analysis = None
        if sensor_format == PAIRED_PRESSURE_FORMAT:
            calibration_factor = params.get("calibration_factor") or None
            pressure_analysis = analyze_pressure(df, calibration_factor=calibration_factor)
            df = pressure_analysis.df

        st.subheader("Vorschau der Daten (vorverarbeitet)")
        preview_cols = self._preview_columns(df, pressure_analysis is not None)
        st.dataframe(df[preview_cols].head())

        events = detect_events(df, threshold_factor=params.get("threshold_factor", 0.2))

        if len(events["hs_idx"]) == 0 or len(events["to_idx"]) == 0:
            st.warning("Es konnten keine oder zu wenige Schritte erkannt werden. Bitte Parameter/Signal prüfen.")
            st.stop()

        steps_df, summary = compute_step_metrics(
            df,
            events,
            min_step_s=params.get("min_step_s", 0.5),
            max_step_s=params.get("max_step_s", 2.0),
        )

        if summary["n_steps_valid"] == 0:
            st.warning("Keine verwertbaren Schritte im physiologischen Bereich gefunden.")
            st.stop()

        ctx.set_param(
            "analysis",
            {
                "df": df,
                "events": events,
                "steps_df": steps_df,
                "summary": summary,
                "pressure_analysis": pressure_analysis,
            },
        )
        ctx.set_param("pressure_analysis", pressure_analysis)

        tab_specs = [
            ("📈 Plot", lambda: self._render_plot_tab(df, events, pressure_analysis)),
        ]
        if pressure_analysis is not None:
            tab_specs.append(
                ("🦶 Druckverteilung", lambda: self._render_pressure_tab(pressure_analysis))
            )
        tab_specs.extend(
            [
                ("📋 Schritte", lambda: self._render_steps_tab(steps_df, pressure_analysis)),
                ("📊 Metriken", lambda: self._render_metrics_tab(summary, pressure_analysis)),
            ]
        )
        tab_labels = [label for label, _ in tab_specs]
        analysis_tab_modules = []
        if ctx.registry:
            analysis_tab_modules = [
                m for m in ctx.registry.sorted_modules() if has_analysis_tab(m)
            ]
            tab_labels.extend([m.display_name for m in analysis_tab_modules])

        tabs = st.tabs(tab_labels)

        for tab, (_, render_tab) in zip(tabs[: len(tab_specs)], tab_specs):
            with tab:
                render_tab()

        for tab, module in zip(tabs[len(tab_specs) :], analysis_tab_modules):
            with tab:
                module.render_analysis_tab(ctx)

    def _preview_columns(self, df: pd.DataFrame, has_pressure_analysis: bool) -> list[str]:
        if has_pressure_analysis:
            cols = [
                "timestamp_ms",
                *SENSOR_COLUMNS,
                "total_pressure_left",
                "total_pressure_right",
                "total_pressure_both",
            ]
            return [col for col in cols if col in df.columns]
        return [col for col in ["Timestamp", "FSR1", "FSR2", "FSR_combined"] if col in df.columns]

    def _render_plot_tab(self, df: pd.DataFrame, events: dict, pressure_analysis=None) -> None:
        st.subheader("FSR-Signale und erkannte Events")
        fig, ax = plt.subplots(figsize=(12, 5))
        if pressure_analysis is not None:
            ax.plot(df["Timestamp"], df["total_pressure_left"], label="Links gesamt")
            ax.plot(df["Timestamp"], df["total_pressure_right"], label="Rechts gesamt")
            ax.plot(df["Timestamp"], df["total_pressure_both"], label="Beide Füße gesamt")
        else:
            ax.plot(df["Timestamp"], df["FSR1"], label="FSR1")
            ax.plot(df["Timestamp"], df["FSR2"], label="FSR2")
            ax.plot(df["Timestamp"], df["FSR_combined"], label="FSR kombiniert")

        ax.axhline(events["threshold"], linestyle="--", color="grey", label="Schwelle")

        hs_idx = events["hs_idx"]
        to_idx = events["to_idx"]
        ax.scatter(
            df["Timestamp"].iloc[hs_idx],
            df["FSR_combined"].iloc[hs_idx],
            marker="x",
            color="red",
            label="HS",
        )
        ax.scatter(
            df["Timestamp"].iloc[to_idx],
            df["FSR_combined"].iloc[to_idx],
            marker="o",
            color="green",
            label="TO",
        )

        ax.set_xlabel("Zeit (ms)")
        ax.set_ylabel("FSR")
        ax.set_title("FSR-Signale und erkannte Schritte")
        ax.legend()
        st.pyplot(fig)

    def _render_pressure_tab(self, pressure_analysis) -> None:
        st.subheader("Druckverteilung links/rechts")
        st.caption(
            "Farben zeigen die mittlere Druckintensität je Sensorregion: Ferse, "
            "lateraler Vorfuß und medialer Vorfuß."
        )
        st.pyplot(plot_pressure_distribution(pressure_analysis))

        st.markdown("#### Zusammenfassung pro Fuß")
        foot_summary = pd.DataFrame.from_dict(
            pressure_analysis.per_foot_summary, orient="index"
        )
        foot_summary.index = foot_summary.index.map({"left": "Links", "right": "Rechts"})
        st.dataframe(foot_summary)

        st.markdown("#### Beidseitige Zusammenfassung")
        st.dataframe(pd.DataFrame([pressure_analysis.bilateral_summary]))

        csv_bytes = pressure_analysis.to_export_frame().to_csv(index=False).encode("utf-8")
        st.download_button(
            "Druckanalyse herunterladen (CSV)",
            data=csv_bytes,
            file_name="myprosole_pressure_analysis.csv",
            mime="text/csv",
        )

    def _render_steps_tab(self, steps_df: pd.DataFrame, pressure_analysis=None) -> None:
        st.subheader("Per-Schritt-Metriken")
        display_cols = [
            "hs_time_s_rel",
            "stance_time_s",
            "swing_time_s",
            "step_time_s",
            "stance_ratio",
            "peak_force",
            "time_to_peak_s",
            "loading_rate_per_s",
        ]
        existing_cols = [c for c in display_cols if c in steps_df.columns]
        st.dataframe(steps_df[existing_cols])

        csv_bytes = steps_df.to_csv(index_label="step").encode("utf-8")
        st.download_button(
            "Per-Schritt-Daten herunterladen (CSV)",
            data=csv_bytes,
            file_name=(
                "myprosole_step_metrics_pair.csv"
                if pressure_analysis is not None
                else "myprosole_step_metrics_one_insole.csv"
            ),
            mime="text/csv",
        )

    def _render_metrics_tab(self, summary: dict, pressure_analysis=None) -> None:
        st.subheader("Aggregierte Gang-Metriken")

        col1, col2, col3 = st.columns(3)
        col1.metric("Gültige Schritte", summary["n_steps_valid"])
        col2.metric("Gesamtdauer (s)", f"{summary['total_duration_s']:.1f}")
        col3.metric("Kadenz (Schritte/min)", f"{summary['cadence_spm']:.1f}")

        st.write("---")
        st.write(f"**Ø Schrittzeit:** {summary['step_time_mean_s']:.2f} s")
        st.write(f"**Schrittzeit CV:** {summary['step_time_cv_percent']:.1f} %")
        st.write(f"**Ø Standzeit:** {summary['stance_time_mean_s']:.2f} s")
        st.write(f"**Standzeit CV:** {summary['stance_time_cv_percent']:.1f} %")
        st.write(f"**Ø Schwungzeit:** {summary['swing_time_mean_s']:.2f} s")
        st.write(f"**Schwungzeit CV:** {summary['swing_time_cv_percent']:.1f} %")
        st.write(f"**Stance-Ratio (Ø):** {summary['stance_ratio_mean']:.2f}")

        if pressure_analysis is None:
            return

        st.write("---")
        st.subheader("Aggregierte Druck-Metriken")
        bilateral = pressure_analysis.bilateral_summary
        col1, col2, col3 = st.columns(3)
        col1.metric("Links gesamt", f"{bilateral['total_pressure_left']:.1f}")
        col2.metric("Rechts gesamt", f"{bilateral['total_pressure_right']:.1f}")
        col3.metric(
            "Links/Rechts-Verteilung",
            f"{bilateral['left_right_distribution_percentage']:.1f} % links",
        )

        if "estimated_body_weight_kg" in bilateral:
            st.metric(
                "Geschätztes Körpergewicht",
                f"{bilateral['estimated_body_weight_kg']:.1f} kg",
            )


def register(registry: ModuleRegistry) -> None:
    registry.add(StepAnalysisModule())
