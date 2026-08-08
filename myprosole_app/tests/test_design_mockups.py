"""Integration checks for the static HTML app-design prototype."""

from __future__ import annotations

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


DESIGN_ROOT = Path(__file__).resolve().parents[1] / "design"
MOCKUPS_ROOT = DESIGN_ROOT / "mockups"
PROFILE_STATE_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-profile-state.js"
ANALYSIS_STATE_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-analysis-state.js"
SOCIAL_STUDIO_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-social-studio.js"
SOCIAL_EXPORT_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-social-export-state.js"
TRAINING_STATE_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-training-state.js"
EXPECTED_MOCKUPS = {
    "analyse-ergebnis.html",
    "chat.html",
    "einlage.html",
    "einlage-verbinden.html",
    "einlagen-entdecken.html",
    "gym-plan.html",
    "home.html",
    "live-tracking.html",
    "login.html",
    "lauf-zusammenfassung.html",
    "laufplan.html",
    "profil.html",
    "profil-einrichten.html",
    "register.html",
    "share-export.html",
    "social-studio.html",
    "uebungen.html",
    "verlauf.html",
    "welcome.html",
    "trainingseinheit.html",
    "trainingstagebuch.html",
    "zyklus-einrichten.html",
    "zyklus-kalender.html",
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
        # from=tracking meldet den frisch beendeten Lauf; nur dann wird die
        # Mikroroutine angeboten.
        "live-tracking.html": {"home.html", "lauf-zusammenfassung.html?from=tracking"},
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
    # Trainingsniveau und Geschlecht. Letzteres steuert, ob der Zykluskalender
    # angeboten wird, und laesst deshalb ausdruecklich "Keine Angabe" zu.
    assert len([field for field in parser.selects if "required" in field]) == 2
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

    # Was ohne Einlagen laeuft, steht im Hinweis darueber. Der Knopf selbst
    # traegt nur noch seine Handlung – eine Unterzeile, die aufzaehlt, was ein
    # Laufknopf ohnehin tut, erklaert niemandem etwas.
    assert "ohne Einlagen nutzbar" in source
    assert "Laufen starten" in source
    assert "md-cta__subtitle" not in source
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


# --- Konsistenz der Demo-Laufdaten -------------------------------------------
#
# Der Prototyp dient als Spezifikation fuer die spaetere App. Widersprechen
# sich die Beispielwerte zwischen den Screens, wird der Widerspruch
# mitgebaut. Die Aufzeichnungskette (Live-Tracking -> Zusammenfassung) gilt
# als Wahrheit; alle anderen Screens muessen denselben Lauf gleich benennen.

import re
import statistics


VERLAUF_ROW = re.compile(
    r'md-score-badge[^"]*">(?P<score>\d+)</div>.*?'
    r'md-list-item__title">(?P<title>[^<]+)</p>.*?'
    r'md-list-item__meta">(?P<km>[\d,]+) km &middot; '
    r'(?P<time>\d+:\d+) min &middot; (?P<pace>\d+:\d+) min/km',
    re.DOTALL,
)


def _seconds(clock: str) -> int:
    minutes, seconds = clock.split(":")
    return int(minutes) * 60 + int(seconds)


def _number(german: str) -> float:
    return float(german.replace(",", "."))


def _read(screen: str) -> str:
    return (MOCKUPS_ROOT / screen).read_text(encoding="utf-8")


def _weekly_runs() -> list[dict[str, str]]:
    return [match.groupdict() for match in VERLAUF_ROW.finditer(_read("verlauf.html"))]


def test_every_listed_run_has_a_pace_matching_its_distance_and_time() -> None:
    runs = _weekly_runs()

    assert len(runs) == 4
    for run in runs:
        expected = _seconds(run["time"]) / _number(run["km"])
        stated = _seconds(run["pace"])
        assert abs(stated - expected) <= 4, (
            f"{run['title']}: {run['pace']} min/km passt nicht zu "
            f"{run['km']} km in {run['time']} min"
        )


def test_weekly_totals_are_the_sum_of_the_listed_runs() -> None:
    runs = _weekly_runs()
    verlauf = _read("verlauf.html")
    home = _read("home.html")

    distance = round(sum(_number(run["km"]) for run in runs), 1)
    duration_minutes = sum(_seconds(run["time"]) for run in runs) / 60
    average_score = round(statistics.mean(int(run["score"]) for run in runs))

    stated_distance = re.search(
        r'Distanz</p>\s*<p class="md-metric__value">([\d,]+) <span>km', verlauf
    )
    stated_score = re.search(r'md-score__number">(\d+)</div>', verlauf)
    verlauf_active = re.search(
        r'Aktive Zeit</p>\s*<p class="md-metric__value">(\d+:\d+) <span>Stunden',
        verlauf,
    )
    home_distance = re.search(r'([\d,]+) / [\d,]+ km', home)
    home_count = re.search(r'md-metric__value">(\d+) <span>diese Woche', home)
    home_active = re.search(r'md-metric__value">(\d+:\d+) <span>Stunden', home)

    assert stated_distance and _number(stated_distance.group(1)) == distance
    assert stated_score and int(stated_score.group(1)) == average_score
    assert home_distance and _number(home_distance.group(1)) == distance
    assert home_count and int(home_count.group(1)) == len(runs)
    for label, match in (("home.html", home_active), ("verlauf.html", verlauf_active)):
        assert match, f"{label} nennt keine aktive Zeit"
        hours, minutes = match.group(1).split(":")
        assert abs(int(hours) * 60 + int(minutes) - duration_minutes) <= 1, (
            f"{label}: aktive Zeit passt nicht zur Summe der Laufzeiten"
        )


def test_the_score_ring_is_filled_to_the_average_it_states() -> None:
    verlauf = _read("verlauf.html")
    runs = _weekly_runs()

    average_score = round(statistics.mean(int(run["score"]) for run in runs))

    # Der Ring stellt den Durchschnitt als Kreisbogen dar. Fuellt der Bogen
    # nicht denselben Anteil, den die Zahl in seiner Mitte behauptet, zeigt
    # der Screen zwei verschiedene Werte gleichzeitig.
    ring = re.search(
        r'stroke-dasharray="([\d.]+)" stroke-dashoffset="([\d.]+)"', verlauf
    )
    assert ring
    circumference, offset = float(ring.group(1)), float(ring.group(2))
    filled = (circumference - offset) / circumference * 100
    assert abs(filled - average_score) <= 0.5


def test_the_latest_run_is_described_identically_on_every_screen() -> None:
    summary = _read("lauf-zusammenfassung.html")
    distance = re.search(r'Strecke</p><p class="md-metric__value">([\d,]+) <span>km', summary)
    duration = re.search(r'Zeit</p><p class="md-metric__value">(\d+:\d+) <span>min', summary)
    pace = re.search(r'Tempo</p><p class="md-metric__value">(\d+:\d+) <span>min/km', summary)

    assert distance and duration and pace
    km, time, min_per_km = distance.group(1), duration.group(1), pace.group(1)

    analysis = _read("analyse-ergebnis.html")
    assert f"8,2 km · {time} min · {min_per_km} min/km" in analysis
    assert f'"md-metric__value">{time} <span>min' in analysis
    assert f'"md-metric__value">{min_per_km} <span>min/km' in analysis

    latest = _weekly_runs()[0]
    assert (latest["km"], latest["time"], latest["pace"]) == (km, time, min_per_km)

    export = _read("share-export.html")
    assert f"<strong>{time}</strong>" in export
    assert f"<strong>{min_per_km} /km</strong>" in export
    assert f'stat-hud-value">{time}</p>' in export
    assert f'stat-hud-value">{min_per_km}</p>' in export

    studio = _read("social-studio.html")
    assert f"<span>{min_per_km} /KM</span><span>{time}</span>" in studio
    assert f"{km} km, {time} Minuten und {min_per_km} min/km" in studio


# --- Zykluskalender ----------------------------------------------------------
#
# Zyklusdaten sind Gesundheitsdaten nach DSGVO Art. 9. Der Prototyp haelt
# davon bewusst nichts: keine Perioden-Tage, kein Datum, keine Zykluslaenge
# und auch nicht die Geschlechtsangabe, aus der die Sichtbarkeit folgt.

CYCLE_STATE_SCRIPT = DESIGN_ROOT / "scripts" / "prototype-cycle-state.js"


def test_cycle_prototype_stores_no_health_data_and_no_sex() -> None:
    source = CYCLE_STATE_SCRIPT.read_text(encoding="utf-8")

    assert "sessionStorage" in source
    assert "localStorage" not in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source

    # Nur die drei Zustaende des Klickablaufs duerfen abgelegt werden.
    keys = set(re.findall(r'"(myprosole\.prototype\.cycle-[a-z]+)"', source))
    assert keys == {
        "myprosole.prototype.cycle-eligible",
        "myprosole.prototype.cycle-consent",
        "myprosole.prototype.cycle-mode",
    }

    # Geschrieben wird ausschliesslich in den beiden validierenden Helfern.
    # Jeder weitere setItem-Aufruf waere ein Weg, an ihnen vorbei Daten
    # abzulegen.
    assert source.count("setItem(") == 2

    # Beide Helfer pruefen gegen eine Positivliste, bevor sie lesen oder
    # schreiben. Ein unbekannter Wert kommt so weder herein noch heraus.
    assert "const ALLOWED_CONSENT = new Set(" in source
    assert "const ALLOWED_MODES = new Set(" in source
    assert "allowed.has(value) ? value : null" in source
    assert "if (!allowed.has(value))" in source

    # Die Geschlechtsangabe wird an genau einer Stelle gelesen und dort nur
    # verglichen. Abgelegt wird das Ergebnis des Vergleichs, nicht die Angabe.
    assert source.count("field.value") == 1
    assert "field.value === ELIGIBLE_SEX" in source
    assert "writeFlag(ELIGIBLE_KEY, eligible)" in source


def test_cycle_calendar_is_offered_only_after_the_matching_profile_answer() -> None:
    setup = parse_html(MOCKUPS_ROOT / "profil-einrichten.html")
    profile_source = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")

    sex_field = [
        field for field in setup.selects if field.get("id") == "profile-sex"
    ]
    assert len(sex_field) == 1
    assert "data-cycle-eligibility" in sex_field[0]

    # Niemand wird zur Offenlegung gezwungen.
    setup_source = (MOCKUPS_ROOT / "profil-einrichten.html").read_text(
        encoding="utf-8"
    )
    assert 'value="undisclosed"' in setup_source
    assert "Keine Angabe" in setup_source

    # Der Eintrag ist im Markup vorhanden, aber bis zur passenden Antwort
    # ausgeblendet.
    entry = re.search(r"<div data-cycle-entry([^>]*)>", profile_source)
    assert entry and "hidden" in entry.group(1)
    assert "zyklus-einrichten.html" in profile_source


def test_cycle_setup_asks_for_consent_and_names_purpose_and_deletion() -> None:
    source = (MOCKUPS_ROOT / "zyklus-einrichten.html").read_text(encoding="utf-8")

    assert "willigst du in die Verarbeitung" in source
    assert "Gesundheitsdaten" in source
    assert "verschlüsselt" in source
    assert "gelöscht" in source
    assert "nicht an Dritte weitergegeben" in source

    # Trainingsbezug muss benannt sein, ohne eine medizinische Aussage zu
    # behaupten.
    assert "Übungsvorschläge" in source
    assert "keine medizinische Bewertung" in source
    assert "ersetzt keine ärztliche Beratung" in source

    # Beide Erfassungsarten stehen zur Wahl, keine ist vorausgewählt.
    assert 'data-cycle-mode="regular"' in source
    assert 'data-cycle-mode="irregular"' in source


def test_cycle_calendar_grid_matches_august_2026() -> None:
    source = (MOCKUPS_ROOT / "zyklus-kalender.html").read_text(encoding="utf-8")

    # Der 1. August 2026 ist ein Samstag: fuenf Leerzellen vor dem Monatsanfang,
    # danach 31 Tage. Ohne das stehen die Tage unter dem falschen Wochentag.
    assert source.count("md-calendar__day--empty") == 5
    days = re.findall(r'class="md-calendar__day[^"]*"[^>]*>(\d+)</span>', source)
    numbered = sorted({int(day) for day in days})
    assert numbered == list(range(1, 32))

    # Eingetragene Periode 1.-5. August, heute der 6.
    assert source.count("md-calendar__day--period") == 5
    assert source.count("md-calendar__day--today") == 1

    assert "Kalender beenden und Daten löschen" in source
    assert "keine medizinische Bewertung" in source


def test_cycle_prediction_appears_only_for_a_regular_cycle() -> None:
    source = (MOCKUPS_ROOT / "zyklus-kalender.html").read_text(encoding="utf-8")

    predicted = re.findall(r'md-calendar__day--predicted"[^>]*>', source)
    assert predicted
    for element in predicted:
        assert 'data-cycle-view="regular"' in element

    # Der unregelmaessige Zustand zeigt dieselben Tage ohne Vorhersage.
    assert source.count('data-cycle-view="irregular"') == len(predicted) + 2


def test_summary_keeps_the_gps_state_and_adds_a_connected_insole_state() -> None:
    source = _read("lauf-zusammenfassung.html")

    # Der App-only-Zustand bleibt unveraendert erhalten und ist jetzt
    # ausdruecklich an den GPS-Modus gebunden.
    promo = re.search(r'<section class="md-insole-promo"([^>]*)>', source)
    assert promo and 'data-analysis-mode="gps"' in promo.group(1)
    assert "Technikdaten benötigen Sensoreinlagen" in source

    # Der Einlagen-Zustand liegt daneben und ist ohne Parameter ausgeblendet.
    technique = re.search(r'<section class="md-card" data-analysis-mode="insole"([^>]*)>', source)
    assert technique and "hidden" in technique.group(1)
    assert "Einlage verbunden" in source
    assert "keine medizinische Bewertung" in source


def test_summary_offers_exactly_one_way_into_the_run_analysis() -> None:
    source = _read("lauf-zusammenfassung.html")

    # Zwei Wege zum selben Ziel auf einem Screen sind eine Fehlerquelle: einer
    # wird beim Umbauen vergessen. Der Knopf steht in beiden Zustaenden.
    links = re.findall(r'href="(analyse-ergebnis\.html[^"]*)"', source)
    assert links == ["analyse-ergebnis.html?mode=gps"]

    entry = re.search(r'<a class="md-button[^"]*" href="analyse-ergebnis[^>]*>([^<]+)</a>', source)
    assert entry and entry.group(1) == "Laufanalyse anschauen"
    assert "data-analysis-entry" in entry.group(0)

    # Den Modus zieht das gemeinsame Skript nach, damit dort derselbe Lauf im
    # selben Zustand steht.
    script = ANALYSIS_STATE_SCRIPT.read_text(encoding="utf-8")
    assert "[data-analysis-entry]" in script
    assert "analyse-ergebnis.html?mode=${analysisMode}" in script


def test_summary_technique_values_match_the_full_analysis() -> None:
    summary = _read("lauf-zusammenfassung.html")
    analysis = _read("analyse-ergebnis.html")

    # Beide Screens beschreiben denselben Lauf. Weichen die Technikwerte
    # voneinander ab, widerspricht die Zusammenfassung der Auswertung, die
    # sie verlinkt.
    for label, value in (("Bodenkontaktzeit", "243"), ("48 / 52", None)):
        assert label in summary
        assert label in analysis
        if value:
            assert f'{label}</p><p class="md-metric__value">{value} ' in summary
            assert f'{label}</p><p class="md-metric__value">{value} ' in analysis


def test_summary_cadence_produces_a_plausible_step_length() -> None:
    summary = _read("lauf-zusammenfassung.html")

    cadence = re.search(r'Kadenz</p><p class="md-metric__value">(\d+) <span>Schritte/min', summary)
    distance = re.search(r'Strecke</p><p class="md-metric__value">([\d,]+) <span>km', summary)
    duration = re.search(r'Zeit</p><p class="md-metric__value">(\d+:\d+) <span>min', summary)

    assert cadence and distance and duration
    steps = int(cadence.group(1)) * _seconds(duration.group(1)) / 60
    step_length_m = _number(distance.group(1)) * 1000 / steps

    # Schrittlaenge beim Laufen liegt grob zwischen 0,7 m und 1,6 m. Wer Tempo
    # oder Zeit aendert, ohne die Kadenz mitzuziehen, faellt hier auf.
    assert 0.7 <= step_length_m <= 1.6, f"unplausible Schrittlänge: {step_length_m:.2f} m"


# --- Trainingsbegleitung (Kern-Schleife) -------------------------------------
#
# Reihenfolge, Saetze und Dosierung stammen aus dem Trainingskonzept v5:
# F.2 fuer den Aufbau der Mikroroutine, F.1 fuer die Werte je Uebung, B.3 fuer
# die Wochenstruktur, D.2 fuer die Zahl der Routinen pro Woche.

WEEK_PLAN_DAY = re.compile(
    r'md-week-plan__day([^"]*)"([^>]*)>\s*'
    r'<span class="md-week-plan__label">([A-Za-z]{2})</span>\s*'
    r'<span class="md-week-plan__unit">(.*?)</span>',
    re.DOTALL,
)


def _plan_days(source: str, *, visible_only: bool = False) -> list[tuple[str, str]]:
    """Tag und Inhalt je Eintrag des Wochenplans."""
    days = []
    for match in WEEK_PLAN_DAY.finditer(source):
        attributes, label, unit = match.group(2), match.group(3), match.group(4)
        if visible_only and "hidden" in attributes:
            continue
        days.append((label, " ".join(unit.split())))
    return days


def test_the_run_summary_offers_the_routine_without_blocking_the_result() -> None:
    source = _read("lauf-zusammenfassung.html")

    offer = source.index("data-routine-offer")
    result = source.index("Lauf gespeichert")
    splits = source.index("Kilometer-Abschnitte")

    # Das Ergebnis und die Abschnitte stehen vor dem Angebot. Ein Dialog wuerde
    # reflexhaft weggetippt und eine Ablehnung erzeugen, die keine war.
    assert result < splits < offer
    assert "<dialog" not in source
    assert "Starten" in source
    assert "Heute nicht" in source
    assert 'href="trainingseinheit.html?schritt=1"' in source


def test_the_guided_session_follows_the_reference_micro_routine() -> None:
    source = _read("trainingseinheit.html")

    # F.2: drei Uebungen, je zwei Saetze, Rumpf/Gleichgewicht zum Schluss.
    steps = re.findall(r'<section data-step="([^"]+)"', source)
    assert steps == ["1", "2", "3", "fertig"]

    sets = re.findall(r'md-sequence__sets">([^<]+)<', source)
    assert len(sets) == 3
    assert all(entry.startswith("2 Sätze") for entry in sets)

    order = re.findall(r'class="md-sequence__title">([^<]+)</h1>', source)
    assert order == ["Standing Hip Abduction", "Kniebeuge", "Unterarmstütz"]

    counters = re.findall(r'md-sequence__counter">([^<]+)<', source)
    assert counters == ["Übung 1 von 3", "Übung 2 von 3", "Übung 3 von 3"]

    # Sicherheitshinweis aus dem Konzept gehoert in den Screen, nicht nur ins PDF.
    assert "keine medizinische Bewertung" in source
    assert "Ersetzt keine individuelle ärztliche Beratung" in source
    assert "Bei Schmerzen abbrechen" in source


def test_the_training_prototype_stores_only_how_today_ended() -> None:
    source = TRAINING_STATE_SCRIPT.read_text(encoding="utf-8")

    assert "sessionStorage" in source
    assert "localStorage" not in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source

    keys = set(re.findall(r'"(myprosole\.prototype\.[a-z-]+)"', source))
    assert keys == {"myprosole.prototype.routine-today"}

    # Genau ein Schreibzugriff, und der prueft vorher gegen die Positivliste.
    assert source.count("setItem(") == 1
    assert "ALLOWED_STATES.has(state)" in source
    assert "ALLOWED_STEPS.has(requestedStep)" in source


def test_the_week_plan_matches_the_reference_week_structure() -> None:
    source = _read("uebungen.html")

    # Heute steht oben, danach die Woche rueckwaerts. Was zu tun ist, sieht
    # man zuerst; Erledigtes liest sich wie ein Verlauf.
    assert [label for label, _ in _plan_days(source, visible_only=True)] == [
        "So", "Sa", "Fr", "Do", "Mi", "Di", "Mo",
    ]
    # Der Sonntag liegt dreimal im Markup, in seinen drei Zustaenden.
    assert [label for label, _ in _plan_days(source)].count("So") == 3

    units = dict(_plan_days(source, visible_only=True))
    # B.3 Grundgeruest
    assert units["Mo"].startswith("Ruhe")
    assert units["Di"].startswith("Tempolauf")
    assert units["Mi"].startswith("Krafteinheit")
    assert units["Do"].startswith("Lockerer Lauf")
    assert units["Fr"].startswith("Ruhe")
    assert units["Sa"].startswith("Langer Lauf")
    assert units["So"].startswith("Regenerationslauf")


def test_the_week_plan_uses_the_same_runs_as_the_history() -> None:
    plan = _read("uebungen.html")
    runs = _weekly_runs()

    # Jeder Lauf aus dem Verlauf muss im Plan mit derselben Distanz an
    # demselben Tag stehen, sonst beschreiben zwei Screens dieselbe Woche
    # unterschiedlich.
    weekday_by_run = {}
    for run in runs:
        title = run["title"]
        day = "So" if title.startswith("Heute") else title.split(",")[0][:2]
        weekday_by_run[day] = run["km"]

    assert weekday_by_run == {"So": "8,2", "Sa": "12,1", "Do": "6,3", "Di": "5,0"}
    for day, km in weekday_by_run.items():
        assert re.search(
            rf'md-week-plan__label">{day}</span>\s*<span class="md-week-plan__unit">[^<]*{re.escape(km)} km',
            plan,
        ), f"{day}: {km} km fehlt im Wochenplan"


def test_the_week_plan_counts_only_training_units() -> None:
    source = _read("uebungen.html")

    counter = re.search(r">(\d+) von (\d+) Einheiten<", source)
    assert counter
    done, planned = int(counter.group(1)), int(counter.group(2))

    # D.2 bei dieser Trainingslast: Routine nach 2-3 von 4 Laeufen.
    assert planned == 4
    assert 2 <= done <= 3

    # Nur die standardmaessig sichtbaren Tage zaehlen. Die ausgeblendeten
    # Sonntag-Varianten beschreiben denselben Tag in anderen Zustaenden und
    # duerfen nicht doppelt gezaehlt werden.
    completed_units = [
        unit for _, unit in _plan_days(source, visible_only=True)
        if "Mikroroutine erledigt" in unit or unit.startswith("Krafteinheit")
    ]
    assert len(completed_units) == done

    # Nach dem langen Lauf ausdruecklich keine Zusatzeinheit (D.2 Zusatzregel).
    assert "nach dem langen Lauf keine Zusatzeinheit" in source


def test_the_run_is_linked_to_the_plan_after_the_run_not_before() -> None:
    home = _read("home.html")
    summary = _read("lauf-zusammenfassung.html")

    # Home: der Plan steht als Kontext ueber genau einem Startknopf. Ein
    # zweiter gleichrangiger Knopf wuerde eine Entscheidung verlangen, die vor
    # dem Lauf oft nicht feststeht. Siehe docs/trainingsplan-kopplung.md.
    assert "md-plan-hint" in home
    assert "Heute geplant" in home
    assert home.count('href="live-tracking.html"') == 1
    assert "Ohne Plan" not in home
    assert "Nach Plan" not in home

    # Der Plankontext auf Home nennt denselben Lauf wie der Wochenplan.
    plan_day = dict(_plan_days(_read("uebungen.html"), visible_only=True))["So"]
    hint = re.search(r'md-plan-hint__value">([^<]+)<', home)
    assert hint
    assert hint.group(1).split("·")[0].strip() in plan_day

    # Zusammenfassung: die Zuordnung wird sichtbar gemacht und ist korrigierbar.
    assert "md-plan-match" in summary
    assert "in deinen Wochenplan übernommen" in summary
    assert re.search(r'md-plan-match__undo"[^>]*>([^<]+)<', summary)


def test_home_does_not_duplicate_the_bottom_navigation() -> None:
    parser = parse_html(MOCKUPS_ROOT / "home.html")
    source = _read("home.html")

    # Uebungen und Verlauf sind ueber die untere Navigation erreichbar. Ein
    # zweiter Weg auf derselben Seite ist nur eine weitere Stelle, die beim
    # Umbauen vergessen wird.
    assert 'class="md-shortcut' not in source
    assert ">Schnellzugriff<" not in source

    # Die zugehoerige Komponente ist mit entfernt und nicht ungenutzt
    # liegengeblieben.
    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(
        encoding="utf-8"
    )
    assert ".md-shortcut {" not in styles
    assert ".md-shortcut-grid {" not in styles

    assert parser.navigation_targets.count("verlauf.html") == 1

    # Der Wochenplan ist zweimal erreichbar: ueber die Navigation und ueber
    # den Plankontext. Das ist kein doppelter Weg, sondern ein Sprung aus dem
    # Zusammenhang heraus – der Kontext nennt die Einheit, die dort steht.
    assert parser.navigation_targets.count("uebungen.html") == 2
    assert re.search(r'md-plan-hint" href="uebungen\.html"', source)


def test_home_shows_the_plan_below_the_start_button() -> None:
    source = _read("home.html")

    # Der Startknopf bleibt die erste Aktion; der Plan steht als Kontext
    # darunter und nimmt ihm nichts weg.
    assert source.index('href="live-tracking.html"') < source.index("md-plan-hint")


def test_the_routine_offer_is_bound_to_the_moment_after_the_run() -> None:
    summary = _read("lauf-zusammenfassung.html")
    tracking = _read("live-tracking.html")
    script = TRAINING_STATE_SCRIPT.read_text(encoding="utf-8")

    # Nur der Weg aus dem Live-Tracking meldet einen frisch beendeten Lauf.
    assert 'href="lauf-zusammenfassung.html?from=tracking"' in tracking
    assert 'href="lauf-zusammenfassung.html"' in _read("home.html")

    # Beides liegt im Markup, beides standardmaessig ausgeblendet: das Skript
    # entscheidet nach Kontext und Zustand.
    offer = re.search(r"<section class=\"md-routine-offer\"([^>]*)>", summary)
    assert offer and "hidden" in offer.group(1)
    assert summary.count('data-routine-status="done"') == 1
    assert summary.count('data-routine-status="open"') == 1
    assert "Mikroroutine <strong>nicht erledigt</strong>" in summary

    assert 'get("from") === "tracking"' in script
    assert "justFinished" in script


def test_only_data_survives_when_looking_back_at_an_old_run() -> None:
    summary = _read("lauf-zusammenfassung.html")
    script = TRAINING_STATE_SCRIPT.read_text(encoding="utf-8")

    # Angebote gehoeren in den Moment nach dem Lauf. Wer einen alten Lauf
    # nachschlaegt, will nachsehen und nicht ueberredet werden.
    promo = re.search(r'<section class="md-insole-promo"([^>]*)>', summary)
    assert promo and "data-fresh-only" in promo.group(1)

    # Der Technikblock traegt die Markierung ausdruecklich nicht: das sind
    # Messwerte des Laufs und bleiben auch spaeter sichtbar.
    technique = re.search(
        r'<section class="md-card" data-analysis-mode="insole"([^>]*)>', summary
    )
    assert technique and "data-fresh-only" not in technique.group(1)

    # Die Regel blendet nur aus und schaltet nichts ein, damit sie den
    # Analysemodus nicht ueberschreibt.
    assert "element.hidden = true;" in script
    assert "if (!justFinished) {" in script


def test_the_exercise_tab_opens_a_menu_for_self_made_plans() -> None:
    source = _read("uebungen.html")
    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(
        encoding="utf-8"
    )

    # Die Suche ist dem Menue gewichen.
    assert "icon-search" not in source
    assert 'href="#menue"' in source

    entries = [
        " ".join(entry.split())
        for entry in re.findall(
            r'md-drawer__item"[^>]*>.*?</svg>\s*([^<]+)', source, re.DOTALL
        )
    ]
    assert entries == [
        "Gym-Trainingsplan erstellen",
        "Trainingstagebuch",
        "Lauftraining selbst erstellen",
    ]

    # Kein Skript noetig: :target oeffnet und schliesst.
    assert ".md-drawer:target" in styles
    assert source.count('href="#uebungen-oben"') == 2  # Scrim und Schliessen-Symbol

    # Alle drei Module sind gebaut; kein Eintrag fuehrt mehr ins Leere.
    for ziel in ("trainingstagebuch.html", "gym-plan.html", "laufplan.html"):
        assert f'href="{ziel}"' in source
    assert "noch nicht entworfen" not in source


def test_the_guided_session_is_recognisable_as_video_led() -> None:
    exercises = _read("uebungen.html")
    session = _read("trainingseinheit.html")

    # Derselbe Platzhalter an beiden Stellen, damit erkennbar ist, dass die
    # Uebungen angeleitet werden, bevor man startet.
    assert "md-video-placeholder" in exercises
    assert "md-video-placeholder" in session
    assert "mit Videoanleitung" in exercises
    assert "md-routine-start__title" in exercises


def test_internal_rule_names_stay_out_of_the_visible_text() -> None:
    """Prinzip 6 aus `Selbst_gestalten_Module_Logik_und_Einfachheit.docx`.

    Die Fachspezifikation ist bewusst umfangreich; an der Oberflaeche darf
    davon nichts auftauchen. Interne Begriffe wie Dosierungsstufen oder
    Regelnummern gehoeren in Kommentare, nicht in den Screen.
    """
    verboten = ("Stufe Standard", "Stufe Minimal", "Stufe Erweitert", "Trainingslast")

    for path in sorted(MOCKUPS_ROOT.glob("*.html")):
        # Kommentare tragen die Herkunft der Regel und duerfen sie nennen.
        sichtbar = re.sub(r"<!--.*?-->", "", path.read_text(encoding="utf-8"), flags=re.DOTALL)
        for begriff in verboten:
            assert begriff not in sichtbar, f"{path.name} zeigt den internen Begriff {begriff!r}"
        assert not re.search(r"\b[EFD]\.\d+\b", sichtbar), (
            f"{path.name} zeigt eine Regelnummer im sichtbaren Text"
        )


def test_the_reason_for_an_exercise_leads_with_plain_language() -> None:
    """Prinzip 5: einfacher Satz zuerst, Wissenschaft danach und optional."""
    source = _read("trainingseinheit.html")

    reasons = re.findall(r'md-sequence__why">([^<]+)<', source)
    assert len(reasons) == 3
    for reason in reasons:
        assert len(reason) <= 70, f"zu lang für den ersten Satz: {reason}"
        assert "priorisiert" not in reason

    # Die Begruendung liegt dahinter und ist zugeklappt, bis jemand sie oeffnet.
    assert source.count('<details class="md-evidence">') == 3
    assert "[open]" not in source
    # Die Herkunft im Regelwerk steht im Kommentar, nicht im Screen: eine
    # Regelnummer sagt der lesenden Person nichts.
    assert source.count("<!-- Herkunft: Trainingskonzept") == 3


def test_the_diary_starts_prefilled_and_keeps_a_way_out() -> None:
    """Prinzip 2 und 7 aus dem Selbst-gestalten-Dokument.

    Kein leeres Formular als Startpunkt, aber ein kleiner Weg für alle, die
    selbst eintragen wollen.
    """
    source = _read("trainingstagebuch.html")

    auto = re.search(r'<section class="md-diary__values" data-diary-view="auto">(.*?)</section>', source, re.DOTALL)
    manual = re.search(r'<section class="md-diary__values" data-diary-view="manuell"([^>]*)>', source)
    assert auto and manual

    # Der Vorschlag steht als Wert da, nicht als leeres Eingabefeld.
    assert "<input" not in auto.group(1)
    assert "Aus deinem Lauf übernommen" in source
    assert "hidden" in manual.group(1)

    # Beide Richtungen sind erreichbar und klein gehalten.
    assert 'href="trainingstagebuch.html?werte=manuell"' in source
    assert "Werte aus dem Lauf zurückholen" in source
    assert source.count("md-diary__manual") == 2

    # Bewertung als Daumen statt Zahl, drei Stufen.
    rating = re.search(r'<fieldset class="md-diary__rating">(.*?)</fieldset>', source, re.DOTALL)
    assert rating and rating.group(1).count('class="md-rating__input"') == 3
    assert "RPE" not in source

    # Alles Weitere ist optional und zugeklappt.
    details = re.search(r"<details class=\"md-evidence\">(.*?)</details>", source, re.DOTALL)
    assert details and "Mehr Details" in details.group(1)
    assert "[open]" not in source


def test_the_diary_shows_the_same_runs_as_the_history() -> None:
    diary = _read("trainingstagebuch.html")
    runs = _weekly_runs()

    # Der vorbelegte Eintrag ist der heutige Lauf.
    latest = runs[0]
    assert f'{latest["km"]} <span>km' in diary
    assert f'{latest["time"]} <span>min' in diary

    # Die Liste darunter zeigt dieselben früheren Läufe wie der Verlauf.
    for run in runs[1:]:
        assert f'{run["km"]} km · {run["time"]} min' in diary, (
            f'{run["title"]} fehlt im Tagebuch'
        )


def test_the_diary_asks_about_pain_and_only_then_for_details() -> None:
    """`current_pain` ist im Regelwerk ein harter Filter (E.5).

    Deshalb eine eigene Frage statt einer Zeile unter "Mehr Details" – aber
    ohne Kosten für alle, die keine Schmerzen hatten.
    """
    source = _read("trainingstagebuch.html")
    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")

    assert "Hattest du Schmerzen?" in source
    pain = re.search(r'<fieldset class="md-diary__pain">(.*?)</fieldset>', source, re.DOTALL)
    assert pain
    assert pain.group(1).count('type="radio"') == 2

    # Kilometer und Ort werden erst gefragt, wenn es etwas zu berichten gibt.
    assert "Ab welchem Kilometer" in source
    assert source.count('name="ort"') >= 5
    assert ".md-diary__pain-details {" in styles
    assert "display: none;" in styles.split(".md-diary__pain-details {")[1].split("}")[0]

    # Die Orte brechen um statt zu scrollen: eine scrollende Reihe versteckt
    # die hinteren Optionen, hier auch den Ausweg "Woanders".
    assert 'class="md-chip-set"' in source
    assert "flex-wrap: wrap;" in styles.split(".md-chip-set {")[1].split("}")[0]
    assert ".md-diary__pain:has(#schmerz-ja:checked) .md-diary__pain-details" in styles

    # Nicht zweimal nach demselben fragen.
    assert "diary-beschwerden" not in source

    # Schmerzangaben sind Gesundheitsdaten; das steht im Screen.
    assert "Gesundheitsdaten" in source


def test_the_plan_editor_starts_filled_and_never_blocks_saving() -> None:
    """Prinzip 2, 3 und 4 aus dem Selbst-gestalten-Dokument."""
    source = _read("gym-plan.html")

    # Vorausgefüllt, nicht leer. Leer anfangen geht nur ausdrücklich.
    items = re.findall(r'<li class="md-plan-item[^"]*"([^>]*)>', source)
    sichtbar = [item for item in items if "hidden" not in item]
    assert len(sichtbar) == 3
    assert "Lieber leer anfangen" in source

    # Der Vorschlag ist ein zugeklapptes details, kein Dialog, und das
    # Speichern steht unabhängig davon da.
    assert '<details class="md-review"' in source
    assert "<dialog" not in source
    assert "Plan speichern" in source
    review_at = source.index('class="md-review"')
    save_at = source.index("Plan speichern")
    assert review_at < save_at

    # Höchstens ein bis zwei Vorschläge, jeder einzeln zu entscheiden.
    assert source.count('class="md-review__claim"') == 1
    assert "Übernehmen" in source and "Nicht übernehmen" in source
    assert "Alles übernehmen" not in source

    # Einfacher Satz zuerst, Begründung dahinter.
    claim = re.search(r'md-review__claim">([^<]+)<', source)
    assert claim and len(claim.group(1)) <= 70
    assert '<details class="md-evidence">' in source


def test_the_running_plan_shows_the_jump_without_blocking_it() -> None:
    """Wochenraster mit Ampelfarbe statt Warntext.

    Die Schwelle stammt aus Teil A.4: Sprünge über 20 Prozent erhöhen das
    Verletzungsrisiko. Die App zeigt das an und hält niemanden auf.
    """
    source = _read("laufplan.html")
    script = TRAINING_STATE_SCRIPT.read_text(encoding="utf-8")

    # Sieben Zellen, eine je Tag, vorbelegt statt leer.
    tage = re.findall(r'md-week-grid__label" for="km-(\w+)">(\w+)<', source)
    assert [tag for _, tag in tage] == ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    werte = re.findall(r'id="km-\w+"[^>]*value="([\d.]+)"', source)
    assert len(werte) == 7
    assert sum(float(wert) for wert in werte) > 0

    # Kein Warntext, keine Sperre.
    assert "Warnung" not in source
    assert "disabled" not in source
    assert "Plan speichern" in source

    # Die Schwellen stehen im Skript und sind benannt.
    assert "CAUTION_PERCENT = 10" in script
    assert "HIGH_PERCENT = 20" in script
    assert "LAST_WEEK_KM" in script

    # Die Vorwoche ist derselbe Wert wie im Verlauf.
    runs = _weekly_runs()
    letzte_woche = round(sum(_number(run["km"]) for run in runs), 1)
    assert f"LAST_WEEK_KM = {letzte_woche}" in script
    assert f"Vorwoche {str(letzte_woche).replace('.', ',')} km" in source


def test_every_screen_refuses_automatic_darkening_by_the_device() -> None:
    """Ein Design, das auf jedem Telefon gleich aussieht.

    Chrome und Samsung Internet dunkeln auf Android jede helle Seite
    algorithmisch ab, sobald das System auf Dunkelmodus steht. Ein blosses
    ``light`` lesen sie als "unterstuetzt nur Hell, dann rechnen wir es um" –
    erst ``only light`` ist die Absage. Solange ueber Farben entschieden wird,
    darf das Geraet sie nicht veraendern.
    """
    tokens = (DESIGN_ROOT / "design-system" / "tokens.css").read_text(encoding="utf-8")

    assert "color-scheme: only light" in tokens
    # Die Systemeinstellung darf das Thema nicht mehr umschalten.
    assert "prefers-color-scheme" not in tokens
    # Die dunklen Werte bleiben als ausdrueckliche Wahl erhalten.
    assert '[data-theme="dark"]' in tokens

    # Zusaetzlich im Kopf jeder Seite, damit die Entscheidung schon vor dem
    # Laden des Stylesheets feststeht und nichts kurz hell aufblitzt.
    for path in sorted(MOCKUPS_ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        assert '<meta name="color-scheme" content="only light">' in source, path.name


def test_screens_with_a_bottom_bar_are_built_as_an_app_shell() -> None:
    """Kopf und Leiste stehen fest, nur der Inhalt dazwischen scrollt.

    Damit die Regel im Stylesheet ueberhaupt greifen kann, braucht jeder
    dieser Screens genau einen Inhaltsbereich mit derselben Klasse. Frueher
    trugen vier davon dieselbe Polsterung als Inline-Stil – dort haette eine
    Aenderung an einer Stelle nicht gewirkt.
    """
    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    assert ".device-frame:has(> .md-nav) { height: calc(var(--app-height)" in styles
    assert ".device-frame:has(> .md-nav) > .md-page-stack {" in styles

    # Am Telefon haengt die Leiste am Bildschirm, nicht am Rahmen. Nur so ist
    # sie unabhaengig davon, welche Hoehe das Geraet meldet – in der
    # installierten App meldet Android mehr, als zu sehen ist.
    telefon = styles.split("@media (max-width: 420px)")[1]
    assert ".device-frame > .md-nav," in telefon
    assert "position: fixed;" in telefon
    assert ".device-frame > .md-fab { position: fixed;" in telefon
    # Freiraum, damit die geheftete Leiste das letzte Element nicht verdeckt.
    assert "padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px));" in telefon
    # Die gehefteten Leisten schweben ueber dem Inhalt und brauchen eine
    # eigene Flaeche – sonst scheinen die Nachrichten hindurch.
    assert "background: var(--md-surface);" in styles.split(".md-chat-input-row {")[1].split("}")[0]

    # Die gemessene Hoehe bleibt fuer den Rahmen auf dem Rechner in Gebrauch.
    tokens = (DESIGN_ROOT / "design-system" / "tokens.css").read_text(encoding="utf-8")
    assert "--app-height: 100dvh;" in tokens
    shell = (DESIGN_ROOT / "scripts" / "prototype-app-shell.js").read_text(encoding="utf-8")
    assert "window.innerHeight" in shell
    assert '"--app-height"' in shell
    # Drehen und Ein-/Ausblenden von Systemleisten aendern die Hoehe.
    assert 'addEventListener("resize"' in shell
    assert 'addEventListener("orientationchange"' in shell

    mit_leiste = [
        path
        for path in sorted(MOCKUPS_ROOT.glob("*.html"))
        if '<nav class="md-nav">' in path.read_text(encoding="utf-8")
    ]
    assert len(mit_leiste) >= 6

    for path in mit_leiste:
        source = path.read_text(encoding="utf-8")
        assert source.count('<main class="md-page-stack">') == 1, path.name
        # Die frueher inline gesetzte Polsterung darf nicht zurueckkehren.
        assert "padding: 0 var(--space-md) 88px" not in source, path.name
        # Reihenfolge im Rahmen: Kopf, Inhalt, Leiste.
        assert (
            source.index('class="md-app-bar"')
            < source.index('<main class="md-page-stack">')
            < source.index('<nav class="md-nav">')
        ), path.name


def test_the_prototype_can_be_installed_on_a_phone_without_storing_data() -> None:
    """Vom Startbildschirm startbar, offline bedienbar, ohne Datenhaltung.

    Testerinnen und Tester sollen den Entwurf wie eine App bedienen koennen.
    Dafuer braucht jede Seite das Manifest und die Anmeldung des Service
    Workers. Was zwischengespeichert wird, sind ausschliesslich Dateien des
    Entwurfs – Eingaben liegen weiterhin nur im Sitzungsspeicher.
    """
    manifest = json.loads((DESIGN_ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))

    assert manifest["display"] == "standalone"
    assert manifest["start_url"] == "mockups/welcome.html"
    assert (MOCKUPS_ROOT / "welcome.html").exists()
    # Der Name muss den Entwurfscharakter tragen, damit auf dem Startbildschirm
    # niemand ein fertiges Produkt vermutet.
    assert "Prototyp" in manifest["name"]

    for icon in manifest["icons"]:
        assert (DESIGN_ROOT / icon["src"]).exists(), icon["src"]
    assert any(icon["purpose"] == "maskable" for icon in manifest["icons"])

    worker = (DESIGN_ROOT / "sw.js").read_text(encoding="utf-8")
    # Alles zuerst aus dem Netz, der Speicher nur als Rueckfall. Solange am
    # Entwurf taeglich etwas geaendert wird, darf niemand eine Korrektur erst
    # beim zweiten Start sehen und in der Zwischenzeit Fehler melden, die es
    # nicht mehr gibt.
    holen = worker.index("fetch(request)")
    speicher = worker.index("caches\n          .match(request)")
    assert holen < speicher
    # Nur eigene Dateien, nur Abrufe.
    assert 'request.method !== "GET"' in worker
    assert "self.location.origin" in worker
    # Alte Bestaende werden beim Wechsel der Fassung entfernt.
    assert "caches.delete" in worker

    shell = (DESIGN_ROOT / "scripts" / "prototype-app-shell.js").read_text(encoding="utf-8")
    assert "serviceWorker" in shell
    # Kein Speichern, an keiner Stelle.
    for verboten in ("localStorage", "sessionStorage", "document.cookie", "indexedDB"):
        assert verboten not in shell, verboten

    for path in sorted(MOCKUPS_ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        assert '<link rel="manifest" href="../manifest.webmanifest">' in source, path.name
        assert '<script src="../scripts/prototype-app-shell.js"></script>' in source, path.name
        assert '<meta name="theme-color" content="#16213E">' in source, path.name


def test_only_the_design_folder_is_ever_published() -> None:
    """Der Upload-Ordner traegt keine Unterlagen, nur den Entwurf.

    Ein falscher Pfad beim Hochladen wuerde Geschaeftsplan und
    Trainingskonzept oeffentlich machen. Das laesst sich nicht zurueckholen,
    also wird es hier geprueft und nicht nur in der Anleitung erwaehnt.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
    try:
        import deploy_prototype
    finally:
        sys.path.pop(0)

    assert deploy_prototype.UPLOAD_ROOT == DESIGN_ROOT
    assert deploy_prototype.check() == []

    # Nach dem Hochladen wird abgeglichen, ob unter der Adresse derselbe Stand
    # liegt. Ohne das faellt ein vergessener Upload erst auf, wenn jemand einen
    # Fehler meldet, der im Code laengst behoben ist.
    for name in deploy_prototype.PROOF_FILES:
        assert (DESIGN_ROOT / name).is_file(), name
    assert deploy_prototype.PUBLIC_URL.startswith(
        f"https://{deploy_prototype.BRANCH}.{deploy_prototype.PROJECT_NAME}."
    )
    # Zeilenenden duerfen den Vergleich nicht verfaelschen – hier Windows,
    # dort Unix.
    assert deploy_prototype.digest(b"a\r\nb") == deploy_prototype.digest(b"a\nb")

    # Eine untergeschobene Unterlage muss auffallen.
    schmuggel = DESIGN_ROOT / "_pruefung.pdf"
    schmuggel.write_bytes(b"%PDF-1.4 Testdatei")
    try:
        reasons = deploy_prototype.check()
    finally:
        schmuggel.unlink()
    assert any("_pruefung.pdf" in reason for reason in reasons), reasons

    # Cloudflare Pages nimmt keine Datei ueber 25 MB. Das soll vor dem
    # Hochladen auffallen und nicht mittendrin.
    brocken = DESIGN_ROOT / "_pruefung.bin"
    brocken.write_bytes(b"\0" * (deploy_prototype.MAX_FILE_BYTES + 1))
    try:
        reasons = deploy_prototype.check()
    finally:
        brocken.unlink()
    assert any("Zu gross" in reason for reason in reasons), reasons

    # Nichts im Entwurfsordner reisst die Grenze heute.
    zu_gross = [
        path.relative_to(DESIGN_ROOT).as_posix()
        for path in DESIGN_ROOT.rglob("*")
        if path.is_file() and path.stat().st_size > deploy_prototype.MAX_FILE_BYTES
    ]
    assert zu_gross == [], zu_gross


def test_the_public_copy_sets_headers_and_a_landing_redirect() -> None:
    headers = (DESIGN_ROOT / "_headers").read_text(encoding="utf-8")
    redirects = (DESIGN_ROOT / "_redirects").read_text(encoding="utf-8")

    # Wer nur die Adresse eintippt, landet im Entwurf statt auf einem Fehler.
    assert "/mockups/welcome.html" in redirects
    assert " 302" in redirects

    # Ein Entwurf mit erfundenen Daten gehoert nicht in Suchmaschinen.
    assert "X-Robots-Tag: noindex" in headers
    # Der Service Worker darf nicht selbst zwischengespeichert werden, sonst
    # bleibt eine alte Fassung dauerhaft in Kraft.
    assert "/sw.js\n  Cache-Control: no-cache" in headers

    richtlinie = re.search(r"Content-Security-Policy: (.+)", headers)
    assert richtlinie
    regel = richtlinie.group(1)
    # Skripte kommen ausschliesslich aus eigenen Dateien – kein Inline-Skript,
    # kein onclick. Genau dieser Teil darf nicht aufgeweicht werden.
    assert "script-src 'self';" in regel
    assert "'unsafe-inline'" not in regel.split("script-src")[1].split(";")[0]
    assert "'unsafe-eval'" not in regel
    assert "frame-ancestors 'none'" in regel

    for path in sorted(MOCKUPS_ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        assert "<script>" not in source, path.name
        assert not re.search(r"\son[a-z]+=\"", source), path.name
