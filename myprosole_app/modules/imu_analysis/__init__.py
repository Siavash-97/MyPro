"""IMU-Analyse (Etappe 0): Sensor-Knoten-Erkennung und Rohdaten-Ansicht.

Zeigt, welche Sensor-Knoten (siehe ``core/domain/imu/nodes.py``) in der
aktuell geladenen Datei tatsächlich vollständige IMU-Achsen liefern, und
stellt deren Rohsignale zur Sichtprüfung dar. Orientierung (Pitch/Roll),
Phasenerkennung und Höhenschätzung folgen in späteren Etappen.
"""

from __future__ import annotations

import streamlit as st

from core.context import AppContext
from core.domain.imu import NODE_DEFINITIONS, active_node_ids, extract_imu_dataframe
from core.registry import ModuleRegistry


class ImuAnalysisModule:
    id = "imu_analysis"
    display_name = "IMU-Analyse"
    order = 30

    def register_sidebar(self, ctx: AppContext) -> None:
        return

    def render(self, ctx: AppContext) -> None:
        shared = ctx.param("shared_data")
        if not shared or shared.get("raw_df") is None:
            return

        raw_df = shared["raw_df"]

        with st.expander("IMU-Analyse (Sensor-Knoten)", expanded=False):
            detected = active_node_ids(raw_df)

            if not detected:
                st.info(
                    "Keine vollständigen IMU-Achsen (ax, ay, az, gx, gy, gz) in dieser "
                    "Datei gefunden. Unterstützt werden aktuell die Einlagen "
                    "(`L_`/`R_`-Präfix) sowie zusätzliche Knoten wie Unterschenkel, "
                    "Oberschenkel, Rumpf oder Arme (`<node_id>_ax` usw.)."
                )
                return

            st.success(f"{len(detected)} IMU-Knoten erkannt: {', '.join(detected)}")

            all_ids = [node.node_id for node in NODE_DEFINITIONS if node.has_imu]
            inactive = [node_id for node_id in all_ids if node_id not in detected]
            if inactive:
                st.caption(
                    "Nicht aktiv in dieser Datei: " + ", ".join(inactive)
                    + " (optionale Zusatz-Sensoren)."
                )

            node_id = st.selectbox("Knoten anzeigen", options=detected, key="imu_node_select")
            imu_df = extract_imu_dataframe(raw_df, node_id)
            if imu_df is None:
                return

            st.caption(f"{len(imu_df)} Samples · Achsen: {', '.join(imu_df.columns)}")

            accel_cols = [c for c in ("ax", "ay", "az") if c in imu_df.columns]
            gyro_cols = [c for c in ("gx", "gy", "gz") if c in imu_df.columns]

            col_a, col_g = st.columns(2)
            with col_a:
                st.markdown("**Beschleunigung (g)**")
                st.line_chart(imu_df[accel_cols])
            with col_g:
                st.markdown("**Gyroskop (°/s)**")
                st.line_chart(imu_df[gyro_cols])


def register(registry: ModuleRegistry) -> None:
    registry.add(ImuAnalysisModule())
