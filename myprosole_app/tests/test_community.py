"""Unit-Tests für die Community-Fachlogik (Feed, Gruppen, ZusammenLauf)."""

from __future__ import annotations

import importlib

import pytest

from core.domain.community_catalog import (
    FOCUS_TAGS,
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


def test_seed_posts_are_non_empty_and_independent_across_calls() -> None:
    first = seed_posts()
    second = seed_posts()

    assert len(first) > 0
    assert first is not second
    assert first[0] is not second[0]
    assert first[0].id != second[0].id


def test_seed_groups_use_only_known_focus_tags() -> None:
    for group in seed_groups():
        assert set(group.focus_tags).issubset(set(FOCUS_TAGS))


def test_seed_run_buddies_are_non_empty() -> None:
    assert len(seed_run_buddies()) > 0


def test_create_post_rejects_empty_caption() -> None:
    posts = seed_posts()
    with pytest.raises(ValueError):
        create_post(posts, author="Du", caption="   ")


def test_create_post_rejects_too_long_caption() -> None:
    posts = seed_posts()
    with pytest.raises(ValueError):
        create_post(posts, author="Du", caption="x" * 501)


def test_create_post_prepends_new_post() -> None:
    posts = seed_posts()
    before = len(posts)

    new_post = create_post(posts, author="Du", caption="Kurzer Testlauf heute.")

    assert len(posts) == before + 1
    assert posts[0] is new_post
    assert new_post.caption == "Kurzer Testlauf heute."


def test_add_comment_rejects_empty_text() -> None:
    post = seed_posts()[0]
    with pytest.raises(ValueError):
        add_comment(post, author="Du", text="")


def test_add_comment_appends_to_post() -> None:
    post = seed_posts()[0]
    before = len(post.comments)

    comment = add_comment(post, author="Du", text="Guter Lauf!")

    assert len(post.comments) == before + 1
    assert post.comments[-1] is comment


def test_toggle_like_is_reversible() -> None:
    post = seed_posts()[0]
    original_likes = post.likes

    toggle_like(post)
    assert post.liked_by_me is True
    assert post.likes == original_likes + 1

    toggle_like(post)
    assert post.liked_by_me is False
    assert post.likes == original_likes


def test_create_group_requires_at_least_one_focus_tag() -> None:
    groups = seed_groups()
    with pytest.raises(ValueError):
        create_group(
            groups,
            name="Test-Gruppe",
            location="Berlin",
            focus_tags=[],
            description="Testbeschreibung",
            owner="Du",
        )


def test_create_group_rejects_unknown_focus_tag() -> None:
    groups = seed_groups()
    with pytest.raises(ValueError):
        create_group(
            groups,
            name="Test-Gruppe",
            location="Berlin",
            focus_tags=["Ultramarathon"],
            description="Testbeschreibung",
            owner="Du",
        )


def test_create_group_auto_joins_the_creator() -> None:
    groups = seed_groups()

    group = create_group(
        groups,
        name="Test-Gruppe",
        location="Berlin",
        focus_tags=["Locker"],
        description="Testbeschreibung",
        owner="Du",
    )

    assert group.joined_by_me is True
    assert group.member_count == 1
    assert groups[0] is group


def test_toggle_group_membership_is_reversible() -> None:
    group = seed_groups()[0]
    original_members = group.member_count

    toggle_group_membership(group)
    assert group.joined_by_me is True
    assert group.member_count == original_members + 1

    toggle_group_membership(group)
    assert group.joined_by_me is False
    assert group.member_count == original_members


def test_toggle_buddy_request_is_reversible() -> None:
    buddy = seed_run_buddies()[0]

    toggle_buddy_request(buddy)
    assert buddy.request_sent is True

    toggle_buddy_request(buddy)
    assert buddy.request_sent is False


def test_import_community_state_module() -> None:
    mod = importlib.import_module("modules.community.state")

    assert mod.VIEW_FEED == "feed"
    assert mod.VIEW_ZUSAMMENLAUF == "zusammenlauf"
    assert mod.VIEW_GRUPPEN == "gruppen"
