"""UI der Community-Seite: Feed, ZusammenLauf, Gruppen (Demo-Modus)."""

from __future__ import annotations

import streamlit as st

from core.domain.community_catalog import FOCUS_TAGS, Post
from modules.community import state

_VIEW_LABELS: dict[str, str] = {
    state.VIEW_FEED: "Feed",
    state.VIEW_ZUSAMMENLAUF: "ZusammenLauf",
    state.VIEW_GRUPPEN: "Gruppen",
}


def _render_segmented_nav() -> str:
    labels = list(_VIEW_LABELS.values())
    views = list(_VIEW_LABELS.keys())
    current_view = state.get_active_view()
    current_index = views.index(current_view) if current_view in views else 0

    selected_label = st.radio(
        "Ansicht",
        options=labels,
        index=current_index,
        horizontal=True,
        label_visibility="collapsed",
        key="community_segmented_nav",
    )
    selected_view = views[labels.index(selected_label)]
    state.set_active_view(selected_view)
    return selected_view


def _render_post_composer() -> None:
    with st.expander("Frage stellen oder Lauf teilen…"):
        st.caption(
            "Dein Beitrag ist für alle MyProSole-Läufer:innen sichtbar. "
            "Verletzungen, Schmerzangaben und andere Gesundheitsdaten bleiben "
            "in deinem privaten Verlauf – die teilst du hier nicht."
        )
        with st.form("community_new_post_form", clear_on_submit=True):
            caption = st.text_area(
                "Beitrag",
                placeholder="Frage stellen, Tipp suchen oder deinen letzten Lauf beschreiben…",
                label_visibility="collapsed",
            )
            crosslink = st.checkbox("Auch unter ZusammenLauf sichtbar machen")
            submitted = st.form_submit_button("Veröffentlichen")

        if submitted:
            try:
                state.submit_post(caption, crosslink_zusammenlauf=crosslink)
            except ValueError as exc:
                st.error(str(exc))
            else:
                st.rerun()


def _render_post_card(post: Post) -> None:
    with st.container(border=True):
        header = f"**{post.author}** · {post.created_label}"
        if post.stats_label:
            header += f" · {post.stats_label}"
        st.markdown(header)
        st.write(post.caption)
        if post.crosslink_zusammenlauf:
            st.caption("🏃 Auch unter ZusammenLauf sichtbar")

        col_like, col_comment_count = st.columns([1, 3])
        with col_like:
            like_label = f"❤️ {post.likes}" if not post.liked_by_me else f"💗 {post.likes}"
            if st.button(like_label, key=f"like_{post.id}"):
                state.like_post(post.id)
                st.rerun()
        with col_comment_count:
            st.caption(f"{len(post.comments)} Antworten")

        with st.expander("Antworten anzeigen"):
            for comment in post.comments:
                st.markdown(f"**{comment.author}:** {comment.text}")
            with st.form(f"community_comment_form_{post.id}", clear_on_submit=True):
                reply = st.text_input(
                    "Antworten oder Tipp teilen…", label_visibility="collapsed"
                )
                reply_submitted = st.form_submit_button("Senden")
            if reply_submitted:
                try:
                    state.submit_comment(post.id, reply)
                except ValueError as exc:
                    st.error(str(exc))
                else:
                    st.rerun()


def render_feed() -> None:
    _render_post_composer()
    for post in state.get_posts():
        _render_post_card(post)


def render_gruppen() -> None:
    with st.expander("Eigene Gruppe erstellen"):
        with st.form("community_new_group_form", clear_on_submit=True):
            name = st.text_input("Name der Gruppe", placeholder="z. B. Frühaufsteher München")
            location = st.text_input("Ort", placeholder="Stadt oder Region")
            focus_tags = st.multiselect("Fokus (Mehrfachauswahl möglich)", options=FOCUS_TAGS)
            description = st.text_area(
                "Kurzbeschreibung",
                placeholder="Wann und wo trefft ihr euch, für wen ist das gedacht?",
            )
            submitted = st.form_submit_button("Gruppe erstellen")

        if submitted:
            try:
                state.submit_group(
                    name=name,
                    location=location,
                    focus_tags=focus_tags,
                    description=description,
                )
            except ValueError as exc:
                st.error(str(exc))
            else:
                st.rerun()

    focus_filter = st.selectbox("Fokus", options=["Alle", *FOCUS_TAGS])

    groups = sorted(state.get_groups(), key=lambda g: g.member_count, reverse=True)
    if focus_filter != "Alle":
        groups = [group for group in groups if focus_filter in group.focus_tags]

    st.caption(
        "Nach Aktivität sortiert. Jede Gruppe hat eine verantwortliche Person "
        "und lässt sich jederzeit melden."
    )
    for group in groups:
        with st.container(border=True):
            st.markdown(f"**{group.name}**")
            st.caption(
                f"{group.location} · {group.member_count} Mitglieder · "
                f"{', '.join(group.focus_tags)}"
            )
            st.write(group.description)
            st.caption(f"Diese Woche gemeinsam gelaufen: {group.weekly_km:,.0f} km")
            button_label = "Verlassen" if group.joined_by_me else "Beitreten"
            if st.button(button_label, key=f"membership_{group.id}"):
                state.toggle_membership(group.id)
                st.rerun()


def render_zusammenlauf() -> None:
    st.info(
        "Anderen zeigen wir nur deinen Vornamen, deine ungefähre Distanz und "
        "eure gemeinsamen Laufzeiten. Der genaue Standort bleibt privat, bis "
        "du eine Anfrage bestätigst."
    )
    st.caption("Demo-Filter: Umkreis 5 km · Tempo 5:30–6:00 min/km · Sa/So vormittags")

    st.markdown("**Läuferinnen und Läufer in der Nähe**")
    for buddy in state.get_buddies():
        with st.container(border=True):
            col_info, col_action = st.columns([3, 1])
            with col_info:
                st.markdown(f"**{buddy.name}** · {buddy.weekly_km} km/Woche")
                st.caption(
                    f"{buddy.distance_km:g} km entfernt · {buddy.pace_label} · "
                    f"{buddy.schedule_label}"
                )
            with col_action:
                button_label = "Anfrage gesendet" if buddy.request_sent else "Anfrage"
                if st.button(button_label, key=f"buddy_{buddy.id}", disabled=buddy.request_sent):
                    state.toggle_request(buddy.id)
                    st.rerun()

    crosslinked_posts = [post for post in state.get_posts() if post.crosslink_zusammenlauf]
    if crosslinked_posts:
        st.markdown("**Aus der Community**")
        for post in crosslinked_posts:
            st.caption(f"{post.author} · {post.caption} · {len(post.comments)} Antworten")

    st.caption(
        "Trefft euch beim ersten Mal an einem öffentlichen Ort, zum Beispiel "
        "einem Parkeingang. Profile lassen sich jederzeit melden oder blockieren."
    )


def render_community_page() -> None:
    st.subheader("Community")
    view = _render_segmented_nav()

    if view == state.VIEW_ZUSAMMENLAUF:
        render_zusammenlauf()
    elif view == state.VIEW_GRUPPEN:
        render_gruppen()
    else:
        render_feed()
