"""Schrittanalyse: Vorverarbeitung, Plot, Schritte, Metriken.

Nutzt die EINE gemeinsam hochgeladene Datei aus dem AppContext
(``shared_data``); es gibt keinen eigenen Upload und kein automatisches Laden
einer Standarddatei mehr.
"""

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from core.context import AppContext
from core.domain import (
    LEGACY_FSR_FORMAT,
    SENSOR_COLUMNS,
    analyze_pressure,
    compute_step_metrics,
    detect_events,
    load_pressure_dataframe,
    render_pressure_distribution,
)
from core.domain.sensor_mapping import (
    FOOT_LABELS,
    FOOT_ORDER,
    REGION_LABELS,
    REGION_ORDER,
    columns_for_region,
)
from core.registry import ModuleRegistry, TabContribution


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

    def analysis_tabs(self, ctx: AppContext) -> list[TabContribution]:
        """Trägt die Schrittanalyse-Inhalte zu den gemeinsamen Analyse-Tabs bei.

        Die Druck-/Schrittpipeline wird hier EINMAL pro Rerun berechnet und das
        Ergebnis in den AppContext (``analysis``/``pressure_analysis``) gelegt;
        die Tab-Beiträge zeichnen nur noch das vorberechnete Ergebnis, ohne
        erneut zu rechnen.
        """
        shared = ctx.param("shared_data")
        if not shared:
            return []

        params = ctx.param("step_analysis") or {}
        raw_df = shared["raw_df"]

        try:
            _sensor_format, df = load_pressure_dataframe(
                raw_df, window=params.get("smooth_window", 5)
            )
        except Exception as e:  # noqa: BLE001 - dem Nutzer eine klare Meldung geben
            return [self._status_tab(f"Fehler bei der Vorverarbeitung der Sensordaten: {e}", level="error")]

        calibration_factor = params.get("calibration_factor") or None
        pressure_analysis = analyze_pressure(df, calibration_factor=calibration_factor)
        df = pressure_analysis.df

        events = detect_events(df, threshold_factor=params.get("threshold_factor", 0.2))
        if len(events["hs_idx"]) == 0 or len(events["to_idx"]) == 0:
            return [
                self._status_tab(
                    "Schrittanalyse: Es konnten keine oder zu wenige Schritte erkannt "
                    "werden. Bitte Parameter/Signal prüfen.",
                    level="warning",
                )
            ]

        steps_df, summary = compute_step_metrics(
            df,
            events,
            min_step_s=params.get("min_step_s", 0.5),
            max_step_s=params.get("max_step_s", 2.0),
        )
        if summary["n_steps_valid"] == 0:
            return [
                self._status_tab(
                    "Schrittanalyse: Keine verwertbaren Schritte im physiologischen "
                    "Bereich gefunden.",
                    level="warning",
                )
            ]

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

        return [
            TabContribution(
                "uebersicht", "Übersicht", 10,
                lambda ctx: self._render_overview(df, summary, pressure_analysis),
                item_order=10,
            ),
            TabContribution(
                "visualisierung", "Visualisierung", 20,
                lambda ctx: self._render_plot_section(df, events, pressure_analysis),
                item_order=10,
            ),
            TabContribution(
                "druckkarte", "Druckkarte", 30,
                lambda ctx: self._render_pressure_section(pressure_analysis),
                item_order=10,
            ),
            TabContribution(
                "schritte", "Schritte", 40,
                lambda ctx: self._render_steps_section(steps_df, pressure_analysis),
                item_order=10,
            ),
        ]

    def _status_tab(self, message: str, *, level: str = "info") -> TabContribution:
        """Hilfs-Beitrag, der eine Status-/Fehlermeldung in der Übersicht zeigt."""
        renderer = {"error": st.error, "warning": st.warning}.get(level, st.info)
        return TabContribution(
            "uebersicht", "Übersicht", 10,
            lambda ctx, msg=message, r=renderer: r(msg),
            item_order=10,
        )

    def _render_overview(self, df: pd.DataFrame, summary: dict, pressure_analysis=None) -> None:
        st.subheader("Schrittanalyse – Kennzahlen (Druckpipeline)")

        col1, col2, col3 = st.columns(3)
        col1.metric("Gültige Schritte", summary["n_steps_valid"])
        col2.metric("Gesamtdauer (s)", f"{summary['total_duration_s']:.1f}")
        col3.metric("Kadenz (Schritte/min)", f"{summary['cadence_spm']:.1f}")

        col4, col5, col6 = st.columns(3)
        col4.metric("Ø Schrittzeit (s)", f"{summary['step_time_mean_s']:.2f}")
        col5.metric("Ø Standzeit (s)", f"{summary['stance_time_mean_s']:.2f}")
        col6.metric("Stance-Ratio (Ø)", f"{summary['stance_ratio_mean']:.2f}")

        st.caption(
            f"Variabilität (CV) – Schrittzeit {summary['step_time_cv_percent']:.1f} % | "
            f"Standzeit {summary['stance_time_cv_percent']:.1f} % | "
            f"Schwungzeit {summary['swing_time_cv_percent']:.1f} %"
        )

        if pressure_analysis is not None:
            bilateral = pressure_analysis.bilateral_summary
            colp1, colp2, colp3 = st.columns(3)
            colp1.metric("Druck links", f"{bilateral['total_pressure_left']:.1f}")
            colp2.metric("Druck rechts", f"{bilateral['total_pressure_right']:.1f}")
            colp3.metric(
                "Links/Rechts-Verteilung",
                f"{bilateral['left_right_distribution_percentage']:.1f} % links",
            )
            if "estimated_body_weight_kg" in bilateral:
                st.metric(
                    "Geschätztes Körpergewicht",
                    f"{bilateral['estimated_body_weight_kg']:.1f} kg",
                )

        with st.expander("Vorschau der vorverarbeiteten Daten", expanded=False):
            preview_cols = self._preview_columns(df, pressure_analysis)
            st.dataframe(df[preview_cols].head())

    def _preview_columns(self, df: pd.DataFrame, pressure_analysis) -> list[str]:
        if (
            pressure_analysis is not None
            and pressure_analysis.source_format == LEGACY_FSR_FORMAT
        ):
            cols = [
                "Timestamp",
                "FSR1",
                "FSR2",
                "FSR_combined",
                "total_pressure_left",
                "total_pressure_right",
                "total_pressure_both",
            ]
            return [col for col in cols if col in df.columns]
        if pressure_analysis is not None:
            cols = [
                "timestamp_ms",
                *SENSOR_COLUMNS,
                "total_pressure_left",
                "total_pressure_right",
                "total_pressure_both",
            ]
            return [col for col in cols if col in df.columns]
        return [col for col in ["Timestamp", "FSR1", "FSR2", "FSR_combined"] if col in df.columns]

    def _render_plot_section(self, df: pd.DataFrame, events: dict, pressure_analysis=None) -> None:
        st.subheader("Druck-Signal & erkannte Events (Schrittanalyse)")
        st.caption("Statischer Signalverlauf mit erkannten Fersenkontakten (HS) und Ablösungen (TO).")
        fig, ax = plt.subplots(figsize=(12, 5))
        if (
            pressure_analysis is not None
            and pressure_analysis.source_format != LEGACY_FSR_FORMAT
        ):
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

    def _render_pressure_section(self, pressure_analysis) -> None:
        st.subheader("Druckkarte links/rechts (Schrittanalyse)")
        if pressure_analysis is None:
            st.info(
                "Für die Druckkarte wird eine Paaranalyse mit linken und rechten "
                "Sensoren benötigt. Bitte eine Datei im Paar-CSV-Format hochladen."
            )
            return

        st.caption(
            "App-artige Druckkarte auf einem neutralen Einlagen-Template. "
            "Heatmap-Flecken entstehen nur aus aktuell vorhandenen Sensorwerten."
        )
        show_labels = st.checkbox("Sensorlabels anzeigen", value=False)
        self._render_pressure_availability(pressure_analysis)
        render_pressure_distribution(pressure_analysis, show_labels=show_labels)

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

    def _render_pressure_availability(self, pressure_analysis) -> None:
        analyzed_parts = self._format_analyzed_parts(pressure_analysis)
        unavailable_parts = self._format_unavailable_parts(pressure_analysis)

        if analyzed_parts:
            st.success(f"Analysiert: {'; '.join(analyzed_parts)}")
        for note in pressure_analysis.availability_notes:
            st.info(note)
        if unavailable_parts:
            st.warning(f"Nicht verfügbar: {', '.join(unavailable_parts)}")

    def _format_analyzed_parts(self, pressure_analysis) -> list[str]:
        parts = []
        for foot in FOOT_ORDER:
            available_regions = [
                REGION_LABELS[region].split(" / ")[0]
                for region in REGION_ORDER
                if self._region_available(pressure_analysis, foot, region)
            ]
            if available_regions:
                parts.append(
                    f"{self._foot_text(foot)} ({', '.join(available_regions)})"
                )
        return parts

    def _format_unavailable_parts(self, pressure_analysis) -> list[str]:
        parts = []
        for foot in FOOT_ORDER:
            available_regions = [
                region
                for region in REGION_ORDER
                if self._region_available(pressure_analysis, foot, region)
            ]
            if not available_regions:
                parts.append(self._foot_text(foot))
                continue

            for region in REGION_ORDER:
                if not self._region_available(pressure_analysis, foot, region):
                    parts.append(f"{self._foot_text(foot)} {self._region_text(region)}")
        return parts

    def _region_available(self, pressure_analysis, foot: str, region: str) -> bool:
        available_columns = set(pressure_analysis.sensor_columns.get(foot, []))
        return any(column in available_columns for column in columns_for_region(foot, region))

    def _foot_text(self, foot: str) -> str:
        return {"left": "linker Fuß", "right": "rechter Fuß"}.get(
            foot, FOOT_LABELS.get(foot, foot)
        )

    def _region_text(self, region: str) -> str:
        return {
            "heel": "Ferse",
            "lateral_forefoot": "lateraler Vorfuß",
            "medial_forefoot": "medialer Vorfuß",
        }.get(region, REGION_LABELS.get(region, region))

    def _render_steps_section(self, steps_df: pd.DataFrame, pressure_analysis=None) -> None:
        st.subheader("Schritt-Metriken (Druckanalyse)")
        st.caption("Per-Schritt-Kennzahlen aus der Druckpipeline (Stand-/Schwung-/Schrittzeit, Peak-Kraft).")
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
                "myprosole_step_metrics_one_insole.csv"
                if pressure_analysis is not None
                and pressure_analysis.source_format == LEGACY_FSR_FORMAT
                else "myprosole_step_metrics_pair.csv"
            ),
            mime="text/csv",
        )

def register(registry: ModuleRegistry) -> None:
    registry.add(StepAnalysisModule())
