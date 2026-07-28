"""Einfacher, gemeinsamer Login-Schutz für die Cloud-Bereitstellung.

Nutzt Streamlit Secrets (``st.secrets``), damit Benutzername/Passwort nie im
Repo landen. Lokal (ohne ``secrets.toml``) läuft die App unverändert ohne
Login durch, damit die Entwicklung auf dem eigenen Rechner nicht blockiert.
"""

from __future__ import annotations

import streamlit as st


def require_login() -> None:
    try:
        expected_username = st.secrets["app_username"]
        expected_password = st.secrets["app_password"]
    except (KeyError, FileNotFoundError):
        return  # kein Schutz konfiguriert (z.B. lokale Entwicklung)

    if st.session_state.get("authenticated"):
        return

    st.markdown("## MyProSole")
    st.caption("Bitte anmelden, um fortzufahren.")

    with st.form("login_form"):
        username = st.text_input("Benutzername")
        password = st.text_input("Passwort", type="password")
        submitted = st.form_submit_button("Anmelden")

    if submitted:
        if username == expected_username and password == expected_password:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("Benutzername oder Passwort falsch.")

    st.stop()
