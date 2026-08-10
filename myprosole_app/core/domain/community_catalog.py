"""Community: Feed, Gruppen und ZusammenLauf – reine Fachlogik ohne Streamlit.

Demo-Modus: Es gibt noch keine echten Nutzerkonten oder eine Datenbank (siehe
``core/auth.py`` – nur ein gemeinsamer App-Login ohne Nutzeridentität). Die
Funktionen hier erzeugen bei jedem Aufruf frische, unabhängige Objekte statt
geteilter Modul-Konstanten, damit zwei gleichzeitige Streamlit-Sitzungen sich
nicht gegenseitig ihre Demo-Interaktionen (Kommentare, Beitritte, Likes)
überschreiben. Die UI-Schicht (``modules/community/``) hält den jeweiligen
Sitzungsstand in ``st.session_state``.

Folgeaufgabe für eine produktive Freischaltung: echte Nutzerkonten, eine
persistente, normalisierte Datenbank (Beiträge/Kommentare/Gruppen/
Mitgliedschaften) mit Migration, sowie – für ZusammenLauf – eine
einwilligungsbasierte Standortverarbeitung statt der hier fest hinterlegten
Distanz-Demowerte.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

MAX_CAPTION_LENGTH = 500
MAX_COMMENT_LENGTH = 300
MAX_GROUP_NAME_LENGTH = 60
MAX_GROUP_LOCATION_LENGTH = 60
MAX_GROUP_DESCRIPTION_LENGTH = 280

FOCUS_TAGS: tuple[str, ...] = (
    "Locker",
    "Tempo",
    "Marathon",
    "Frauenlauf",
    "Familie",
    "Trailrunning",
)


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _require_text(value: str, *, field_name: str, max_length: int) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} darf nicht leer sein.")
    if len(cleaned) > max_length:
        raise ValueError(
            f"{field_name} darf höchstens {max_length} Zeichen lang sein."
        )
    return cleaned


@dataclass
class Comment:
    id: str
    author: str
    text: str


@dataclass
class Post:
    id: str
    author: str
    created_label: str
    caption: str
    likes: int = 0
    liked_by_me: bool = False
    stats_label: str | None = None
    crosslink_zusammenlauf: bool = False
    comments: list[Comment] = field(default_factory=list)


@dataclass
class Group:
    id: str
    name: str
    location: str
    focus_tags: tuple[str, ...]
    description: str
    owner: str
    member_count: int = 1
    weekly_km: float = 0.0
    joined_by_me: bool = False


@dataclass
class RunBuddy:
    id: str
    name: str
    age: int
    distance_km: float
    pace_label: str
    schedule_label: str
    weekly_km: int
    request_sent: bool = False


def seed_posts() -> list[Post]:
    """Demo-Feed. Jeder Aufruf liefert frische, unabhängige Objekte."""
    return [
        Post(
            id=_new_id(),
            author="Jana",
            created_label="Heute, 09:14 Uhr",
            stats_label="10,2 km · 52:30 min · 5:09 min/km",
            caption=(
                "Erster Long Run in dieser Saison. Die letzten zwei Kilometer "
                "haben trotzdem noch weh getan 😅"
            ),
            likes=12,
            comments=[],
        ),
        Post(
            id=_new_id(),
            author="Markus",
            created_label="Gestern, 19:40 Uhr",
            caption=(
                "Wer hat Tipps gegen Seitenstechen bei Tempo-Läufen? Passiert "
                "mir seit zwei Wochen zuverlässig ab km 4."
            ),
            likes=3,
            comments=[
                Comment(
                    id=_new_id(),
                    author="Lisa",
                    text=(
                        "Bei mir hilft tiefe Bauchatmung im Rhythmus 3:2 – drei "
                        "Schritte einatmen, zwei ausatmen. Meist innerhalb einer "
                        "Minute weg."
                    ),
                ),
                Comment(
                    id=_new_id(),
                    author="Tobias",
                    text="Trinkst du kurz vorm Lauf noch viel? Bei mir war das der Auslöser.",
                ),
                Comment(
                    id=_new_id(),
                    author="Nina",
                    text=(
                        "Zusätzlich: locker ausatmen auf der Seite, die schmerzt, "
                        "statt anzuhalten."
                    ),
                ),
            ],
        ),
        Post(
            id=_new_id(),
            author="Elena",
            created_label="Vor 3 Stunden",
            caption="Sonntag 8 Uhr, Park Süd, 10 km locker – läuft jemand mit?",
            likes=6,
            crosslink_zusammenlauf=True,
            comments=[],
        ),
    ]


def seed_groups() -> list[Group]:
    return [
        Group(
            id=_new_id(),
            name="Frühaufsteher München",
            location="München",
            focus_tags=("Locker",),
            description="Wir treffen uns werktags um 6 Uhr am Ostpark-Eingang.",
            owner="Jana",
            member_count=214,
            weekly_km=486.0,
        ),
        Group(
            id=_new_id(),
            name="Marathon-Vorbereitung 2027",
            location="Deutschlandweit",
            focus_tags=("Marathon",),
            description="Gemeinsamer Trainingsplan bis zum Frühjahrsmarathon.",
            owner="Tobias",
            member_count=512,
            weekly_km=3140.0,
        ),
        Group(
            id=_new_id(),
            name="Frauenlauf Hamburg",
            location="Hamburg",
            focus_tags=("Frauenlauf",),
            description="Laufgruppe für Frauen aller Levels, sonntags im Stadtpark.",
            owner="Nina",
            member_count=89,
            weekly_km=198.0,
        ),
    ]


def seed_run_buddies() -> list[RunBuddy]:
    return [
        RunBuddy(
            id=_new_id(),
            name="Tobias, 31",
            age=31,
            distance_km=1.8,
            pace_label="~5:40 min/km",
            schedule_label="läuft meist Sa/So morgens",
            weekly_km=42,
        ),
        RunBuddy(
            id=_new_id(),
            name="Nina, 27",
            age=27,
            distance_km=3.2,
            pace_label="~5:50 min/km",
            schedule_label="läuft meist Di/Do abends",
            weekly_km=36,
        ),
        RunBuddy(
            id=_new_id(),
            name="David, 44",
            age=44,
            distance_km=4.6,
            pace_label="~5:35 min/km",
            schedule_label="läuft meist So vormittags",
            weekly_km=51,
        ),
    ]


def create_post(
    posts: list[Post],
    *,
    author: str,
    caption: str,
    stats_label: str | None = None,
    crosslink_zusammenlauf: bool = False,
) -> Post:
    cleaned_caption = _require_text(
        caption, field_name="Beitrag", max_length=MAX_CAPTION_LENGTH
    )
    post = Post(
        id=_new_id(),
        author=author,
        created_label="Gerade eben",
        caption=cleaned_caption,
        stats_label=stats_label,
        crosslink_zusammenlauf=crosslink_zusammenlauf,
    )
    posts.insert(0, post)
    return post


def add_comment(post: Post, *, author: str, text: str) -> Comment:
    cleaned_text = _require_text(
        text, field_name="Antwort", max_length=MAX_COMMENT_LENGTH
    )
    comment = Comment(id=_new_id(), author=author, text=cleaned_text)
    post.comments.append(comment)
    return comment


def toggle_like(post: Post) -> Post:
    if post.liked_by_me:
        post.likes = max(0, post.likes - 1)
        post.liked_by_me = False
    else:
        post.likes += 1
        post.liked_by_me = True
    return post


def create_group(
    groups: list[Group],
    *,
    name: str,
    location: str,
    focus_tags: list[str],
    description: str,
    owner: str,
) -> Group:
    cleaned_name = _require_text(
        name, field_name="Gruppenname", max_length=MAX_GROUP_NAME_LENGTH
    )
    cleaned_location = _require_text(
        location, field_name="Ort", max_length=MAX_GROUP_LOCATION_LENGTH
    )
    cleaned_description = _require_text(
        description,
        field_name="Kurzbeschreibung",
        max_length=MAX_GROUP_DESCRIPTION_LENGTH,
    )
    unknown_tags = set(focus_tags) - set(FOCUS_TAGS)
    if unknown_tags:
        raise ValueError(f"Unbekannter Fokus: {', '.join(sorted(unknown_tags))}")
    if not focus_tags:
        raise ValueError("Mindestens ein Fokus muss ausgewählt sein.")

    group = Group(
        id=_new_id(),
        name=cleaned_name,
        location=cleaned_location,
        focus_tags=tuple(focus_tags),
        description=cleaned_description,
        owner=owner,
        member_count=1,
        weekly_km=0.0,
        joined_by_me=True,
    )
    groups.insert(0, group)
    return group


def toggle_group_membership(group: Group) -> Group:
    if group.joined_by_me:
        group.member_count = max(0, group.member_count - 1)
        group.joined_by_me = False
    else:
        group.member_count += 1
        group.joined_by_me = True
    return group


def toggle_buddy_request(buddy: RunBuddy) -> RunBuddy:
    buddy.request_sent = not buddy.request_sent
    return buddy
