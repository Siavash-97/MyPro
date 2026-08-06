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

    assert "ohne Einlagen nutzbar" in source
    # Der Startknopf nennt die Aufzeichnung, nicht die Technik dahinter. Was
    # ohne Einlagen erfasst wird, muss trotzdem am Knopf ablesbar bleiben.
    assert "Laufen starten" in source
    assert "Zeit, Strecke und Tempo aufzeichnen" in source
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
