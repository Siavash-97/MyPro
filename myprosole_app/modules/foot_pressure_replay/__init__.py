"""Frame-by-frame foot pressure replay (Druck-Replay tab)."""

from __future__ import annotations

import streamlit as st

from core.context import AppContext
from core.domain.foot_replay import frame_range_for_step, reduce_replay_frames
from core.domain.replay_canvas import render_foot_replay
from core.registry import ModuleRegistry, TabContribution
from modules.gait_analysis.interactive_viz import build_detected_steps_plotly
from core.domain.replay_service import ensure_replay_sequence


class FootPressureReplayModule:
    id = "foot_pressure_replay"
    display_name = "Druck-Replay"
    order = 25

    def register_sidebar(self, ctx: AppContext) -> None:
        with st.sidebar:
            st.subheader("Druck-Replay")
            ctx.set_param(
                "foot_pressure_replay",
                {
                    "show_labels": st.checkbox(
                        "Sensorlabels anzeigen",
                        value=False,
                        key="foot_replay_show_labels",
                    ),
                },
            )

    def analysis_tabs(self, ctx: AppContext) -> list[TabContribution]:
        shared = ctx.param("shared_data")
        if not shared:
            return []

        raw_df = shared["raw_df"]
        source_name = shared.get("source_name", "")

        try:
            result, replay = ensure_replay_sequence(ctx, raw_df, source_name)
        except Exception as exc:  # noqa: BLE001 - Nutzerhinweis
            return [self._status_tab(f"Druck-Replay: {exc}", level="error")]

        if not replay.frames:
            return [
                self._status_tab(
                    "Druck-Replay: Keine Frames in der Aufnahme.",
                    level="warning",
                )
            ]

        return [
            TabContribution(
                "druck_replay",
                "Druck-Replay",
                35,
                lambda _ctx: self._render_replay_tab(result, replay, ctx),
                item_order=10,
            ),
        ]

    def _render_replay_tab(self, result, replay, ctx: AppContext) -> None:
        params = ctx.param("foot_pressure_replay") or {}
        show_labels = bool(params.get("show_labels"))

        st.markdown(
            "Zeigt **pro CSV-Zeile einen Frame** – Ferse, lateraler und medialer "
            "Vorfuß als farbige Druckflächen. Kein Session-Mittelwert."
        )
        st.caption(
            "Screening-Hinweis: Animation dient der visuellen Einordnung, "
            "nicht der medizinischen Diagnose."
        )

        step_options = {"Gesamte Aufnahme": None}
        for step in replay.steps:
            label = (
                f"Schritt {step['id']} ({step['footLabel']}, "
                f"{step['startT']:.2f}–{step['endT']:.2f} s)"
            )
            step_options[label] = step["id"]

        col_mode, col_info = st.columns([2, 3])
        with col_mode:
            selected_label = st.selectbox(
                "Ansicht",
                options=list(step_options.keys()),
                key="foot_replay_step_select",
            )
        selected_step_id = step_options[selected_label]
        selected_step = next(
            (step for step in replay.steps if step["id"] == selected_step_id),
            None,
        )

        with col_info:
            if selected_step:
                st.info(
                    f"**Aktivierung:** {selected_step.get('activationOrder') or '–'} · "
                    f"**Erster aktiv:** {selected_step.get('firstActive') or '–'} · "
                    f"**Ferse→Vorfuß:** {selected_step.get('heelToForefootRatio', '–')} · "
                    f"**Muster:** {selected_step.get('classification') or selected_step.get('contactPattern') or '–'}"
                )
            else:
                st.info(
                    f"{len(replay.frames)} Frames · Session-Max {replay.session_max:.0f} raw · "
                    f"{len(replay.steps)} erkannte Schritte"
                )

        st.subheader("Live-Animation auf dem Fuß")
        replay_for_render = reduce_replay_frames(replay, max_frames=900)
        if len(replay_for_render.frames) < len(replay.frames):
            st.caption(
                f"Große Aufnahme erkannt: Darstellung auf {len(replay_for_render.frames)} "
                f"Frames reduziert (Zeit bleibt erhalten)."
            )

        selected_step_render = None
        if selected_step is not None:
            selected_step_render = next(
                (step for step in replay_for_render.steps if step["id"] == selected_step["id"]),
                None,
            )
        frame_start_render, frame_end_render = frame_range_for_step(
            replay_for_render, selected_step_id
        )
        render_foot_replay(
            replay_for_render,
            frame_start=frame_start_render,
            frame_end=frame_end_render,
            selected_step=selected_step_render,
            show_labels=show_labels,
        )

        with st.expander("Sensor-Zeitreihe (Kontext)", expanded=False):
            st.plotly_chart(
                build_detected_steps_plotly(result.df, result.steps),
                use_container_width=True,
            )

    def _status_tab(self, message: str, *, level: str = "info") -> TabContribution:
        renderer = {"error": st.error, "warning": st.warning}.get(level, st.info)
        return TabContribution(
            "druck_replay",
            "Druck-Replay",
            35,
            lambda _ctx: renderer(message),
            item_order=10,
        )


def register(registry: ModuleRegistry) -> None:
    registry.add(FootPressureReplayModule())
