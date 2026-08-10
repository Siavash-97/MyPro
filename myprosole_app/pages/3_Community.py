"""Streamlit-Multipage: Community (Sidebar-Eintrag „Community“)."""

from core.branding import configure_page, render_centered_logo
from modules.community.render import render_community_page

configure_page(page_title="MyProSole – Community")
render_centered_logo()
render_community_page()
