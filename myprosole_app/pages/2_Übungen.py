"""Streamlit-Multipage: Übungen (Sidebar-Eintrag „Übungen“)."""

from core.branding import configure_page, render_centered_logo
from modules.exercises.render import render_exercises_page

configure_page(page_title="MyProSole – Übungen")
render_centered_logo()
render_exercises_page()
