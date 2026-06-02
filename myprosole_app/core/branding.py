"""Gemeinsames Branding (Logo, Favicon) für Haupt- und Multipage-Routen."""

from __future__ import annotations

import base64
from pathlib import Path

import streamlit as st

_APP_ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = _APP_ROOT / "assets" / "myprosole_logo.png"
FAVICON_PATH = _APP_ROOT / "assets" / "favicon_run.png"


def resolve_page_icon() -> str:
    """Pfad zum Lauf-Favicon oder Fallback."""
    if FAVICON_PATH.is_file():
        return str(FAVICON_PATH)
    if LOGO_PATH.is_file():
        return str(LOGO_PATH)
    return "🦶"


def configure_page(*, page_title: str, layout: str = "wide") -> None:
    """`st.set_page_config` – muss die erste Streamlit-Zeile der Seite sein."""
    st.set_page_config(
        page_title=page_title,
        page_icon=resolve_page_icon(),
        layout=layout,
    )


def render_centered_logo() -> None:
    """MyProSole-Logo zentriert oben (wie auf der Hauptseite)."""
    if not LOGO_PATH.is_file():
        return
    data = base64.b64encode(LOGO_PATH.read_bytes()).decode()
    st.markdown(
        "<div style='text-align:center; margin-top:0.5rem; margin-bottom:1rem;'>"
        f"<img src='data:image/png;base64,{data}' "
        "style='width:280px; max-width:80%;' alt='MyProSole'/>"
        "</div>",
        unsafe_allow_html=True,
    )
