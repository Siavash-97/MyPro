"""Integration checks for the static HTML app-design prototype."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


DESIGN_ROOT = Path(__file__).resolve().parents[1] / "design"
MOCKUPS_ROOT = DESIGN_ROOT / "mockups"
PROFILE_STATE_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-profile-state.js"
ANALYSIS_STATE_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-analysis-state.js"
SOCIAL_STUDIO_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-social-studio.js"
SOCIAL_EXPORT_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-social-export-state.js"
EXPECTED_MOCKUPS = {
    "analyse-ergebnis.html",
    "chat.html",
    "einlage.html",
    "einlage-verbinden.html",
    "einlagen-entdecken.html",
    "home.html",
    "live-tracking.html",
    "login.html",
    "lauf-zusammenfassung.html",
    "profil.html",
    "profil-einrichten.html",
    "register.html",
    "share-export.html",
    "social-studio.html",
    "uebungen.html",
    "verlauf.html",
    "welcome.html",
}


class ResourceParser(HTMLParser):
    """Collect navigation and resource references from an HTML document."""

    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []
        self.navigation_targets: list[str] = []
        self.form_actions: list[str] = []
        self.inputs: list[dict[str, str | None]] = []
        self.selects: list[dict[str, str | None]] = []
        self.refresh_target: str | None = None

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        attributes = dict(attrs)
        for attribute in ("href", "src", "action"):
            value = attributes.get(attribute)
            if value:
                self.references.append(value)
        if tag == "a" and attributes.get("href"):
            self.navigation_targets.append(attributes["href"] or "")
        if tag == "form" and attributes.get("action"):
            self.form_actions.append(attributes["action"] or "")
        if tag == "input":
            self.inputs.append(attributes)
        if tag == "select":
            self.selects.append(attributes)
        if tag == "meta" and attributes.get("http-equiv", "").lower() == "refresh":
            content = attributes.get("content") or ""
            _, separator, target = content.partition(";")
            if separator and target.strip().lower().startswith("url="):
                self.refresh_target = target.strip()[4:].strip()


def parse_html(path: Path) -> ResourceParser:
    parser = ResourceParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def test_mockup_entrypoint_starts_with_welcome_screen() -> None:
    index_path = MOCKUPS_ROOT / "index.html"

    assert index_path.is_file()
    parser = parse_html(index_path)

    assert parser.refresh_target == "welcome.html"
    assert "welcome.html" in parser.navigation_targets


def test_expected_app_screens_are_present() -> None:
    screens = {
        path.name for path in MOCKUPS_ROOT.glob("*.html") if path.name != "index.html"
    }

    assert screens == EXPECTED_MOCKUPS


def test_primary_app_flow_is_connected() -> None:
    expected_transitions = {
        "welcome.html": {
            "register.html",
            "login.html",
            "home.html#profil-hinweis",
        },
        "register.html": {"login.html", "home.html#profil-hinweis", "welcome.html"},
        "profil-einrichten.html": {"home.html"},
        "login.html": {"register.html", "home.html", "welcome.html"},
        "home.html": {
            "live-tracking.html",
            "lauf-zusammenfassung.html",
            "verlauf.html",
            "uebungen.html",
            "profil.html",
            "profil-einrichten.html",
            "chat.html",
        },
        "live-tracking.html": {"home.html", "lauf-zusammenfassung.html"},
        "lauf-zusammenfassung.html": {
            "home.html",
            "einlagen-entdecken.html",
            "verlauf.html",
            "uebungen.html",
            "profil.html",
            "social-studio.html?from=summary",
            "chat.html",
        },
        "einlagen-entdecken.html": {"home.html", "einlage-verbinden.html"},
        "einlage-verbinden.html": {
            "home.html",
            "einlagen-entdecken.html",
            "einlage.html",
        },
        "einlage.html": {"home.html", "einlage-verbinden.html"},
        "profil.html": {
            "home.html",
            "profil-einrichten.html",
            "einlage-verbinden.html",
            "welcome.html",
        },
    }

    for screen, expected_targets in expected_transitions.items():
        parser = parse_html(MOCKUPS_ROOT / screen)
        actual_targets = set(parser.navigation_targets + parser.form_actions)
        assert expected_targets.issubset(actual_targets), (
            f"{screen} hat nicht alle erwarteten Ziele: "
            f"{sorted(expected_targets - actual_targets)}"
        )


def test_auth_forms_require_complete_local_input() -> None:
    expected_required_inputs = {"register.html": 4, "login.html": 2}
    expected_actions = {
        "register.html": "home.html#profil-hinweis",
        "login.html": "home.html",
    }

    for screen, required_count in expected_required_inputs.items():
        parser = parse_html(MOCKUPS_ROOT / screen)
        assert parser.form_actions == [expected_actions[screen]]
        assert len([field for field in parser.inputs if "required" in field]) == required_count
        password_fields = [
            field for field in parser.inputs if field.get("type") == "password"
        ]
        assert len(password_fields) == 1
        assert password_fields[0].get("minlength") == "8"


def test_profile_setup_is_optional_and_does_not_transmit_form_values() -> None:
    parser = parse_html(MOCKUPS_ROOT / "profil-einrichten.html")

    assert parser.form_actions == ["home.html"]
    assert "home.html" in parser.navigation_targets
    assert len([field for field in parser.inputs if "required" in field]) == 1
    assert len([field for field in parser.selects if "required" in field]) == 1
    assert all("name" not in field for field in parser.inputs + parser.selects)


def test_social_login_opens_optional_profile_reminder_without_external_request() -> None:
    welcome_parser = parse_html(MOCKUPS_ROOT / "welcome.html")
    home_parser = parse_html(MOCKUPS_ROOT / "home.html")

    assert welcome_parser.navigation_targets.count("home.html#profil-hinweis") == 2
    assert "profil-einrichten.html" in home_parser.navigation_targets
    assert "home.html" in home_parser.navigation_targets


def test_profile_completion_state_stores_no_answers_or_personal_data() -> None:
    source = PROFILE_STATE_SCRIPT.read_text(encoding="utf-8")

    assert "sessionStorage" in source
    assert "localStorage" not in source
    assert "FormData" not in source
    assert ".value" not in source


def test_app_only_home_does_not_claim_that_sensors_are_connected() -> None:
    source = (MOCKUPS_ROOT / "home.html").read_text(encoding="utf-8")

    assert "ohne Einlagen nutzbar" in source
    assert "Lauf mit GPS starten" in source
    assert "Einlage verbunden" not in source
    assert "GPS und Sensor sind bereit" not in source
    assert "Optional erweitern" not in source
    assert "einlagen-entdecken.html" not in source
    assert "einlage-verbinden.html" not in source


def test_profile_uses_single_insole_entry_with_optional_explanation_below_it() -> None:
    profile_source = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")
    connection_parser = parse_html(MOCKUPS_ROOT / "einlage-verbinden.html")

    assert "Einlagen kennenlernen" not in profile_source
    assert profile_source.count("einlage-verbinden.html") == 1
    assert "einlagen-entdecken.html" in connection_parser.navigation_targets


def test_run_analysis_is_collapsible_and_keeps_training_content_separate() -> None:
    source = (MOCKUPS_ROOT / "analyse-ergebnis.html").read_text(encoding="utf-8")

    assert source.count("<details class=\"md-analysis-section\"") == 3
    assert "Erkannte Auffälligkeiten" in source
    assert "Deine Laufwerte" in source
    assert "Biomechanik-Analyse" in source
    assert "Empfohlene Übungen" not in source
    assert "Übungsplan starten" not in source
    assert "einlagen-entdecken.html" in source


def test_analysis_personalization_stores_only_a_validated_session_decision() -> None:
    source = ANALYSIS_STATE_SCRIPT.read_text(encoding="utf-8")

    assert "sessionStorage" in source
    assert "localStorage" not in source
    assert "ALLOWED_DECISIONS.has" in source
    assert "FormData" not in source
    assert ".value" not in source
    assert "Übungen ändern sich nicht automatisch" in (
        MOCKUPS_ROOT / "analyse-ergebnis.html"
    ).read_text(encoding="utf-8")


def test_history_opens_both_analysis_modes_without_claiming_a_technique_score() -> None:
    source = (MOCKUPS_ROOT / "verlauf.html").read_text(encoding="utf-8")

    assert "analyse-ergebnis.html?mode=gps" in source
    assert "analyse-ergebnis.html?mode=insole" in source
    assert "Lauf-Score" in source
    assert "Technik-Score" not in source


def test_social_post_flow_is_reachable_after_a_run_and_ends_in_export() -> None:
    analysis_parser = parse_html(MOCKUPS_ROOT / "analyse-ergebnis.html")
    summary_parser = parse_html(MOCKUPS_ROOT / "lauf-zusammenfassung.html")
    studio_parser = parse_html(MOCKUPS_ROOT / "social-studio.html")

    assert "social-studio.html?from=analysis&mode=gps" in (
        analysis_parser.navigation_targets
    )
    assert "social-studio.html?from=summary" in summary_parser.navigation_targets
    assert "share-export.html?source=data&from=analysis&mode=gps" in (
        analysis_parser.navigation_targets
    )
    assert "share-export.html?source=data&from=summary" in (
        summary_parser.navigation_targets
    )
    assert "share-export.html?source=ai&from=analysis&mode=gps" in (
        studio_parser.navigation_targets
    )
    assert "Social-Post erstellen" in (
        MOCKUPS_ROOT / "analyse-ergebnis.html"
    ).read_text(encoding="utf-8")
    assert "Deine Laufdaten sind schon da" in (
        MOCKUPS_ROOT / "social-studio.html"
    ).read_text(encoding="utf-8")


def test_social_photo_selection_is_local_and_validated() -> None:
    source = SOCIAL_STUDIO_SCRIPT.read_text(encoding="utf-8")
    studio_source = (MOCKUPS_ROOT / "social-studio.html").read_text(
        encoding="utf-8"
    )

    assert "ALLOWED_IMAGE_TYPES" in source
    assert "MAX_IMAGE_BYTES" in source
    assert "URL.createObjectURL" in source
    assert "URL.revokeObjectURL" in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source
    assert "localStorage" not in source
    assert "sessionStorage" not in source
    assert 'accept="image/jpeg,image/png,image/webp"' in studio_source
    assert "wird nicht hochgeladen" in studio_source


def test_social_navigation_validates_and_preserves_its_origin() -> None:
    studio_source = SOCIAL_STUDIO_SCRIPT.read_text(encoding="utf-8")
    export_source = SOCIAL_EXPORT_SCRIPT.read_text(encoding="utf-8")

    for source in (studio_source, export_source):
        assert "ALLOWED_ORIGINS.has" in source
        assert "ALLOWED_ANALYSIS_MODES.has" in source
    assert "lauf-zusammenfassung.html" in studio_source
    assert "analyse-ergebnis.html?mode=" in studio_source
    assert "window.history.back()" in export_source
    assert "ALLOWED_SOURCES.has" in export_source


def test_quick_share_and_ai_social_post_are_visually_separate() -> None:
    source = (MOCKUPS_ROOT / "share-export.html").read_text(encoding="utf-8")

    assert 'data-share-source="data"' in source
    assert 'data-share-source="ai"' in source
    assert "Route und Laufwerte als Bild teilen" in source
    assert "MYPROSOLE · KI-ENTWURF" in source


def test_all_local_mockup_resources_exist_inside_design_directory() -> None:
    html_files = sorted(MOCKUPS_ROOT.glob("*.html"))

    assert html_files
    for html_file in html_files:
        assert "<!doctype html>" in html_file.read_text(encoding="utf-8").lower()
        for reference in parse_html(html_file).references:
            parsed = urlsplit(reference)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue

            target = (html_file.parent / unquote(parsed.path)).resolve()
            assert target.is_relative_to(DESIGN_ROOT.resolve()), (
                f"{html_file.name} verweist außerhalb des Designordners: {reference}"
            )
            assert target.is_file(), (
                f"{html_file.name} verweist auf eine fehlende Datei: {reference}"
            )
