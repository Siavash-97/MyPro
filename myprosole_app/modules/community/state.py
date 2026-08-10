"""Sitzungsstand der Community-Demo (st.session_state) über der Fachlogik.

Demo-Modus ohne echte Nutzerkonten (siehe core/domain/community_catalog.py):
Alle Beiträge/Gruppen/Kontakte liegen nur im Session-State dieses einen
Browser-Tabs und sind beim Schließen weg.
"""

from __future__ import annotations

import streamlit as st

from core.domain.community_catalog import (
    Group,
    Post,
    RunBuddy,
    add_comment,
    create_group,
    create_post,
    seed_groups,
    seed_posts,
    seed_run_buddies,
    toggle_buddy_request,
    toggle_group_membership,
    toggle_like,
)

CURRENT_USER_DISPLAY_NAME = "Du"

SESSION_POSTS = "community_posts"
SESSION_GROUPS = "community_groups"
SESSION_BUDDIES = "community_buddies"
SESSION_VIEW = "community_view"

VIEW_FEED = "feed"
VIEW_ZUSAMMENLAUF = "zusammenlauf"
VIEW_GRUPPEN = "gruppen"


def _ensure_seeded() -> None:
    if SESSION_POSTS not in st.session_state:
        st.session_state[SESSION_POSTS] = seed_posts()
    if SESSION_GROUPS not in st.session_state:
        st.session_state[SESSION_GROUPS] = seed_groups()
    if SESSION_BUDDIES not in st.session_state:
        st.session_state[SESSION_BUDDIES] = seed_run_buddies()


def get_posts() -> list[Post]:
    _ensure_seeded()
    return st.session_state[SESSION_POSTS]


def get_groups() -> list[Group]:
    _ensure_seeded()
    return st.session_state[SESSION_GROUPS]


def get_buddies() -> list[RunBuddy]:
    _ensure_seeded()
    return st.session_state[SESSION_BUDDIES]


def get_active_view() -> str:
    return st.session_state.get(SESSION_VIEW, VIEW_FEED)


def set_active_view(view: str) -> None:
    st.session_state[SESSION_VIEW] = view


def find_post(post_id: str) -> Post | None:
    return next((post for post in get_posts() if post.id == post_id), None)


def find_group(group_id: str) -> Group | None:
    return next((group for group in get_groups() if group.id == group_id), None)


def find_buddy(buddy_id: str) -> RunBuddy | None:
    return next((buddy for buddy in get_buddies() if buddy.id == buddy_id), None)


def submit_post(caption: str, *, crosslink_zusammenlauf: bool = False) -> Post:
    return create_post(
        get_posts(),
        author=CURRENT_USER_DISPLAY_NAME,
        caption=caption,
        crosslink_zusammenlauf=crosslink_zusammenlauf,
    )


def submit_comment(post_id: str, text: str) -> None:
    post = find_post(post_id)
    if post is None:
        raise ValueError("Beitrag wurde nicht gefunden.")
    add_comment(post, author=CURRENT_USER_DISPLAY_NAME, text=text)


def like_post(post_id: str) -> None:
    post = find_post(post_id)
    if post is None:
        raise ValueError("Beitrag wurde nicht gefunden.")
    toggle_like(post)


def submit_group(
    *, name: str, location: str, focus_tags: list[str], description: str
) -> Group:
    return create_group(
        get_groups(),
        name=name,
        location=location,
        focus_tags=focus_tags,
        description=description,
        owner=CURRENT_USER_DISPLAY_NAME,
    )


def toggle_membership(group_id: str) -> None:
    group = find_group(group_id)
    if group is None:
        raise ValueError("Gruppe wurde nicht gefunden.")
    toggle_group_membership(group)


def toggle_request(buddy_id: str) -> None:
    buddy = find_buddy(buddy_id)
    if buddy is None:
        raise ValueError("Kontakt wurde nicht gefunden.")
    toggle_buddy_request(buddy)
