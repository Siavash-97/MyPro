"""Streamlit-Multipage: Übungen (Sidebar-Eintrag „Übungen“)."""

import streamlit as st

from modules.exercises.render import render_exercises_page

st.set_page_config(
    page_title="MyProSole – Übungen",
    page_icon="🦶",
    layout="wide",
)
render_exercises_page()
