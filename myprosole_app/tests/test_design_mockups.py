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
    "anamnese.html",
    "chat.html",
    "community.html",
    "community-beitrag.html",
    "community-gruppen.html",
    "community-gruppe-detail.html",
    "community-gruppe-erstellen.html",
    "community-meine-gruppen.html",
    "community-neuer-beitrag.html",
    "community-profil.html",
    "community-zusammenlauf.html",
    "community-zusammenlauf-filter.html",
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


def ohne_kommentare(css: str) -> str:
    """CSS ohne /* ... */.

    Kommentare nennen absichtlich die alte Farbe oder den alten Token, um zu
    erklaeren, warum etwas geaendert wurde. Ein Test, der Erklaerungen
    mitzaehlt, schlaegt aus dem falschen Grund an – das ist hier dreimal
    passiert, bevor daraus eine Funktion wurde.
    """
    import re as _re

    return _re.sub(r"/\*.*?\*/", "", css, flags=_re.S)


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
            "anamnese.html",
        },
        "register.html": {"login.html", "anamnese.html", "welcome.html"},
        # Die Anamnese steht zwischen Registrierung und erstem Plan; ihre
        # beiden Auswege aus Block B fuehren ohne Umweg in die App.
        "anamnese.html": {"home.html", "register.html"},
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
        "register.html": "anamnese.html",
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


def test_the_anamnesis_follows_the_v2_draft_rules() -> None:
    """Anamnese V2: angekuendigter Split, ein Balken, nichts gespeichert.

    Der Entwurf zieht seine Lehren aus Fitify und Runna: Nicht der geteilte
    Fragebogen bricht Vertrauen, sondern die unangekuendigte Zusatzrunde.
    Deshalb werden beide Bloecke VOR der ersten Frage angekuendigt, ein
    einziger Fortschrittsbalken laeuft ueber beide, und Block B versperrt
    niemals die App. Schmerzen, Operationen und Gewicht sind
    Gesundheitsdaten (DSGVO Art. 9) – der Entwurf speichert und uebertraegt
    keine einzige Antwort.
    """
    seite = (MOCKUPS_ROOT / "anamnese.html").read_text(encoding="utf-8")

    # Die Ankuendigung steht vor der ersten Frage und nennt beide Bloecke
    # samt Zeitangabe – inklusive des freiwilligen Nachzueglers.
    ankuendigung = seite.index('data-anamnese-schritt="ankuendigung"')
    erste_frage = seite.index('data-anamnese-schritt="a1"')
    assert ankuendigung < erste_frage
    assert "3–5 Minuten" in seite
    assert "30 Sekunden" in seite
    assert "später in deinem Profil nachholen" in seite

    # Genau ein Fortschrittsbalken fuer beide Bloecke, kein zweiter, der bei
    # null neu startet.
    assert seite.count("md-progress__fill") == 1

    # Block A: alle zehn Fragen, der Detailblock mit seinen fuenf Schritten
    # und die Verzweigung nach der Schmerzfrage.
    for schritt in [f"a{n}" for n in range(1, 11)] + [f"d{n}" for n in range(1, 6)]:
        assert f'data-anamnese-schritt="{schritt}"' in seite, schritt
    script = (DESIGN_ROOT / "scripts" / "prototype-anamnese.js").read_text(encoding="utf-8")
    assert 'antworten["schmerzen"] === "ja"' in script

    # Der warme Uebergangssatz vor dem Detailblock (Lehre aus Runna).
    assert "Damit wir Übungen sicher für dich auswählen können" in seite

    # Kilometerangabe als Stepper, nicht als Freitext.
    d3 = seite.split('data-anamnese-schritt="d3"', 1)[1].split("</section>", 1)[0]
    assert "data-anamnese-stepper" in d3
    assert 'type="text"' not in d3

    # Block B: drei ehrliche Auswege, keiner versperrt etwas. Alle drei
    # fuehren weiter zur Geraete-Station und von dort in die App.
    for wahl in ("jetzt", "spaeter", "nein"):
        assert f'data-anamnese-blockb="{wahl}"' in seite, wahl

    # "Spaeter erinnern" haelt sein Versprechen: das Profil traegt die
    # Erinnerung und fuehrt direkt zu Block B.
    profil = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")
    assert "data-anamnese-reminder" in profil
    assert 'href="anamnese.html?teil=b"' in profil
    assert '<script src="../scripts/prototype-anamnese.js"></script>' in profil

    # Gespeichert wird im Sitzungsspeicher: das Erinnerungswort und der
    # Zwischenstand (Schritt + Antworten). Ohne den Stand begann die
    # Anamnese von vorn, sobald das Telefon die Seite im Hintergrund
    # verwarf. Beim Abschluss wird er geloescht; wie jede Eingabe im
    # Prototyp ist er beim Schliessen des Fensters weg und verlaesst das
    # Geraet nie.
    assert "anamnese-blockb-offen" in script
    assert "anamnese-stand" in script
    assert "standLoeschen" in script
    for verboten in ("localStorage", "document.cookie", "indexedDB", "fetch("):
        assert verboten not in script, verboten

    # Gewicht ist eine neutrale Zahl. Es gibt keine Einordnung und keinen BMI.
    for wertung in ("BMI", "bergewichtig", "Idealgewicht"):
        assert wertung not in seite, wertung
    assert "ohne Bewertung" in seite


def test_the_anamnesis_ends_with_devices_and_a_plan_built_from_the_answers() -> None:
    """Geraete-Station und Abschluss: mitgestaltet statt verordnet.

    Nach den Fragen stehen Smartwatch und Einlagen auf EINER Seite, einzeln
    waehlbar, jede mit einer kurzen Begruendung. Beides ist freiwillig und
    spaeter im Profil moeglich – die Wege dafuer existieren dort bereits.
    Den Schluss bildet die Zusage, dass der Plan aus den eigenen Antworten
    entstanden ist: Wer fuenf Minuten investiert hat, soll sehen, wofuer.
    """
    seite = (MOCKUPS_ROOT / "anamnese.html").read_text(encoding="utf-8")

    geraete = seite.split('data-anamnese-schritt="geraete"', 1)[1].split("</section>", 1)[0]
    # Beide Geraete auf einer Seite, einzeln waehlbar (Kaestchen, kein
    # Entweder-oder) und jeweils mit dem Warum.
    assert 'name="geraet-watch"' in geraete
    assert 'name="geraet-einlage"' in geraete
    assert 'type="checkbox"' in geraete
    assert "Herzfrequenz" in geraete
    assert "Laufanalyse direkt im Schuh" in geraete
    # Der ehrliche Ausweg, und die Zusage dazu.
    assert "data-anamnese-geraete-spaeter" in geraete
    assert "jederzeit später im Profil möglich" in geraete

    # Wer beide waehlt, verbindet beide nacheinander; die Reihenfolge steht
    # im Skript, nicht im Zufall.
    script = (DESIGN_ROOT / "scripts" / "prototype-anamnese.js").read_text(encoding="utf-8")
    assert 'aktuell === "verbinde-watch" && geraete.einlage' in script
    for station in ("verbinde-watch", "verbinde-einlage"):
        assert f'data-anamnese-schritt="{station}"' in seite, station

    # Spaeter-verbinden ist kein leeres Versprechen: das Profil traegt die
    # beiden Wege bereits.
    profil = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")
    assert "Smartwatch" in profil
    assert 'href="einlage-verbinden.html"' in profil

    # Der Abschluss sagt, woraus der Plan entstanden ist – aus den eigenen
    # Antworten, nicht aus einem Durchschnitt.
    abschluss = seite.split('data-anamnese-schritt="abschluss"', 1)[1].split("</section>", 1)[0]
    assert "Dein Plan ist erstellt" in abschluss
    assert "mitgestaltet" in abschluss
    assert 'href="home.html"' in abschluss

    # Ein unterbrochener Durchlauf setzt an derselben Stelle fort, statt von
    # vorn zu beginnen – das war der Grund fuer den Zwischenstand.
    assert "stand.schritt" in script


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
    """Auch Google und Facebook muenden in die Anamnese.

    Alle drei Kontowege fuehren zum selben naechsten Schritt: der erste
    Laufplan braucht die Anamnese, egal wie das Konto entstanden ist. Der
    Profil-Hinweis haengt am data-Attribut, nicht mehr am Anker.
    """
    welcome_parser = parse_html(MOCKUPS_ROOT / "welcome.html")
    home_parser = parse_html(MOCKUPS_ROOT / "home.html")

    assert welcome_parser.navigation_targets.count("anamnese.html") == 2
    assert "home.html#profil-hinweis" not in welcome_parser.navigation_targets
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

    # Der App-only-Zustand bleibt der Ausgangswert; die Kopfzeile traegt ihn,
    # nicht mehr ein Einlagen-Werbeblock (der lebt in analyse-ergebnis.html).
    gps_state = re.search(r'<p data-analysis-mode="gps"([^>]*)>', source)
    assert gps_state and "hidden" not in gps_state.group(1)
    insole_state = re.search(r'<p data-analysis-mode="insole"([^>]*)>', source)
    assert insole_state and "hidden" in insole_state.group(1)
    assert "Technikdaten benötigen Sensoreinlagen" not in source

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


def _plan_days(
    source: str, *, visible_only: bool = False, ahead: bool = False
) -> list[tuple[str, str]]:
    """Tag und Inhalt je Eintrag des Wochenplans.

    Die kommenden Tage (--ahead) sind eine eigene Liste ueber Heute; sie
    zaehlen nicht zur laufenden Woche und werden getrennt abgefragt.
    """
    days = []
    for match in WEEK_PLAN_DAY.finditer(source):
        klassen, attributes, label, unit = (
            match.group(1), match.group(2), match.group(3), match.group(4)
        )
        if ("--ahead" in klassen) != ahead:
            continue
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

    # Sichtbar ausserhalb der Vorschau ist nur noch Heute: der Tab zeigt,
    # was ansteht. Die erledigten Tage wohnen im Reiter Verlauf.
    assert [label for label, _ in _plan_days(source, visible_only=True)] == ["So"]
    # Der Sonntag liegt dreimal im Markup, in seinen drei Zustaenden.
    assert [label for label, _ in _plan_days(source)].count("So") == 3
    heute = dict(_plan_days(source, visible_only=True))
    assert heute["So"].startswith("Regenerationslauf")

    # B.3 Grundgeruest traegt jetzt die Vorschau der kommenden Woche. Mi und
    # Do weichen bewusst ab: dort gilt die Kilometer-Progression aus dem
    # Laufplan ("Naechste Woche"), nicht das statische Grundgeruest.
    units = dict(_plan_days(source, ahead=True))
    assert units["Mo"].startswith("Ruhe")
    assert units["Di"].startswith("Tempolauf")
    assert units["Fr"].startswith("Ruhe")
    assert units["Sa"].startswith("Langer Lauf")
    assert units["So"].startswith("Regenerationslauf")


def test_the_week_plan_uses_the_same_runs_as_the_history() -> None:
    plan = _read("uebungen.html")
    runs = _weekly_runs()

    # Vergangene Laeufe stehen nur noch im Reiter Verlauf; der Plan zeigt
    # von der laufenden Woche allein Heute. Der eine gemeinsame Eintrag
    # muss deshalb exakt uebereinstimmen, sonst beschreiben zwei Screens
    # denselben Lauf unterschiedlich.
    heutiger_lauf = next(run for run in runs if run["title"].startswith("Heute"))
    assert heutiger_lauf["km"] == "8,2"
    assert re.search(
        r'md-week-plan__label">So</span>\s*<span class="md-week-plan__unit">[^<]*8,2 km',
        plan,
    )


def test_the_week_plan_shows_the_next_seven_days_below_today() -> None:
    """Heute zuerst, darunter der Blick voraus.

    Direkt unter Heute steht, was morgen ansteht; nach unten scrollen zeigt
    bis zu sieben Tage voraus. Die Kilometer der kommenden Tage sind
    dieselben wie im Laufplan unter "Naechste Woche": zwei Ansichten,
    ein Plan. Die erledigten Tage wohnen im Reiter Verlauf, nicht mehr
    hier – so bleibt der Trainings-Tab auf das gerichtet, was kommt.
    """
    source = _read("uebungen.html")

    # Heute steht VOR den kommenden Tagen.
    assert source.index(">Heute</p>") < source.index("Nächste Tage")

    kommend = _plan_days(source, ahead=True)
    # Morgen zuerst, direkt unter Heute. Prototyp-Heute ist Sonntag,
    # morgen also Montag.
    assert [label for label, _ in kommend] == [
        "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So",
    ]
    einheiten = dict(kommend)
    assert "Morgen" in einheiten["Mo"]
    assert "Übermorgen" in einheiten["Di"]

    # Dieselben Kilometer wie der Laufplan fuer die naechste Woche vorgibt.
    laufplan = _read("laufplan.html")
    for tag, km in (("di", "5"), ("mi", "6"), ("do", "6"), ("sa", "12"), ("so", "7")):
        wert = re.search(rf'id="km-{tag}"[^>]*value="(\d+)"', laufplan)
        assert wert and wert.group(1) == km, tag
    assert "Tempolauf · 5,0 km" in einheiten["Di"]
    assert "6,0 km" in einheiten["Mi"]
    assert "6,0 km" in einheiten["Do"]
    assert "Langer Lauf · 12,0 km" in einheiten["Sa"]
    assert "Regenerationslauf · 7,0 km" in einheiten["So"]
    # Ruhetage bleiben Ruhetage (im Laufplan stehen sie auf 0).
    assert einheiten["Mo"].startswith("Ruhe")
    assert einheiten["Fr"].startswith("Ruhe")

    # Feste Hoehe und scrollbar, in einer Karte wie der Wochenstand oben.
    styles = ohne_kommentare(
        (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    )
    block = styles.split(".md-week-plan--ahead {", 1)[1].split("}", 1)[0]
    assert "overflow-y: auto" in block
    assert "max-height" in block
    assert '<section class="md-card" aria-labelledby="naechste-titel">' in source

    # Die erledigten Tage stehen nicht mehr auf dieser Seite.
    assert "Letzte Trainings" not in source
    assert "md-week-plan--past" not in source


def test_the_week_plan_counts_only_training_units() -> None:
    source = _read("uebungen.html")

    counter = re.search(r">(\d+) von (\d+) Einheiten<", source)
    assert counter
    done, planned = int(counter.group(1)), int(counter.group(2))

    # D.2 bei dieser Trainingslast: Routine nach 2-3 von 4 Laeufen. Die
    # erledigten Einheiten selbst stehen im Reiter Verlauf; hier zaehlt nur
    # noch der Zaehler auf der Wochenkarte.
    assert planned == 4
    assert 2 <= done <= 3


def test_the_run_is_linked_to_the_plan_after_the_run_not_before() -> None:
    home = _read("home.html")
    summary = _read("lauf-zusammenfassung.html")

    # Home: der Plan steht als Kontext ueber genau einem Startknopf. Ein
    # zweiter gleichrangiger Knopf wuerde eine Entscheidung verlangen, die vor
    # dem Lauf oft nicht feststeht. Siehe docs/trainingsplan-kopplung.md.
    assert "md-cta__plan" in home
    assert "Heute geplant" in home
    assert home.count('href="live-tracking.html"') == 1
    assert "Ohne Plan" not in home
    assert "Nach Plan" not in home

    # Die Unterzeile im Startknopf nennt denselben Lauf wie der Wochenplan.
    plan_day = dict(_plan_days(_read("uebungen.html"), visible_only=True))["So"]
    hint = re.search(r'md-cta__plan">Heute geplant: ([^<]+)<', home)
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

    # Der Wochenplan ist ueber die Navigation erreichbar; der Plankontext
    # steckt als Unterzeile im Startknopf und ist kein eigenes Ziel mehr.
    assert parser.navigation_targets.count("uebungen.html") == 1
    assert "md-plan-hint" not in source


def test_home_shows_the_plan_inside_the_start_button() -> None:
    source = _read("home.html")

    # Der Startknopf bleibt die erste Aktion; der Plan steht als Unterzeile
    # in ihm selbst - eine Handlung, ihr heutiger Inhalt direkt darunter.
    # In der echten App wechselt die Zeile mit Tag und Training.
    cta = source.split('class="md-cta"', 1)[1].split("</a>", 1)[0]
    assert source.index("md-cta__title") < source.index("md-cta__plan")
    assert "md-cta__plan" in cta


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


def test_insole_promo_lives_on_the_analysis_not_the_summary() -> None:
    """Der Hinweis "Mehr Daten moeglich" gehoert zur Laufanalyse.

    Vorher stand er zusaetzlich auf der Zusammenfassung und lenkte dort vom
    Ergebnis ab. Jetzt steht er ausschliesslich in analyse-ergebnis.html,
    eingeklappt hinter der Biomechanik-Analyse.
    """
    summary = _read("lauf-zusammenfassung.html")
    analysis = _read("analyse-ergebnis.html")

    assert "md-insole-promo" not in summary
    assert "Technikdaten benötigen Sensoreinlagen" not in summary

    promo = re.search(r'<section class="md-insole-promo"([^>]*)>', analysis)
    assert promo and 'data-analysis-mode="gps"' in promo.group(1)
    # Kein data-fresh-only mehr noetig: das Skript blendet unmittelbar nach
    # dem Lauf nichts mehr aus, seit die Zusammenfassung selbst keinen
    # Einlagen-Werbeblock mehr traegt.
    assert "data-fresh-only" not in promo.group(1)


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


def test_the_welcome_video_survives_the_service_worker() -> None:
    """Der Laufhintergrund muss auch auf dem Telefon ankommen.

    Ein Video holt der Browser abschnittsweise, und eine solche Teilantwort
    nimmt der Speicher des Service Workers nicht an. Der Speicherversuch
    scheiterte und riss die Antwort mit: auf dem Rechner fiel es nicht auf,
    weil der Browser dort oft die ganze Datei am Stueck holt – auf dem Telefon
    blieb der Willkommensbildschirm ohne Hintergrund.

    Zwei Dinge halten das fern: abschnittsweise Anfragen gehen am Service
    Worker vorbei, und ein gescheiterter Speicherversuch darf die Antwort
    grundsaetzlich nicht mehr mitreissen.
    """
    worker = (DESIGN_ROOT / "sw.js").read_text(encoding="utf-8")

    abrufen = worker.index("addEventListener(\"fetch\"")
    vorbei = worker.index('request.headers.has("range")', abrufen)
    assert vorbei < worker.index("event.respondWith", abrufen)

    speichern = worker[worker.index("const put ="):worker.index("self.addEventListener(\"fetch\"")]
    # Nur die vollstaendige Antwort, nicht jede erfolgreiche.
    assert "response.status === 200" in speichern
    assert "response.ok" not in speichern
    # Und selbst dann darf das Ablegen nichts verhindern.
    assert "try {" in speichern and "catch" in speichern

    welcome = (MOCKUPS_ROOT / "welcome.html").read_text(encoding="utf-8")
    quelle = welcome.split('<source src="', 1)[1].split('"', 1)[0]
    assert (MOCKUPS_ROOT / quelle).exists(), quelle
    # Faellt das Video aus, traegt der Platzhalter darunter den Bildschirm.
    assert welcome.index("md-hero__placeholder") < welcome.index("md-hero__video")
    # Ohne diese beiden Angaben startet kein Telefon ein Video von selbst.
    for pflicht in ("autoplay", "muted", "playsinline"):
        assert pflicht in welcome.split("<video", 1)[1].split(">", 1)[0], pflicht


def test_the_welcome_screen_shows_running_even_without_a_playing_video() -> None:
    """Ein Standbild traegt den Bildschirm, wenn das Video nicht startet.

    Ob ein Telefon ein Video von selbst abspielt, entscheidet es selbst:
    Datensparmodus, Energiesparmodus oder eine schwache Verbindung reichen,
    damit nichts laeuft. Vorher blieb dann nur der abstrakte Platzhalter uebrig
    und vom Laufen war nichts zu sehen. Das Standbild stammt aus demselben
    Video, steht sofort und bleibt stehen, solange nichts laeuft.
    """
    welcome = (MOCKUPS_ROOT / "welcome.html").read_text(encoding="utf-8")
    video = welcome.split("<video", 1)[1].split(">", 1)[0]

    standbild = video.split('poster="', 1)[1].split('"', 1)[0]
    datei = MOCKUPS_ROOT / standbild
    assert datei.exists(), standbild
    # Ein Standbild, das laenger braucht als der erste Videoabschnitt, hilft
    # niemandem. Es bleibt deutlich kleiner als das Video selbst.
    video_datei = MOCKUPS_ROOT / welcome.split('<source src="', 1)[1].split('"', 1)[0]
    assert datei.stat().st_size < video_datei.stat().st_size / 10


def test_the_welcome_screen_carries_the_logo_at_the_top() -> None:
    """Das Logo steht oben und bleibt auf der Laufaufnahme lesbar.

    Der Laeufer im Logo ist schwarz, das PRO dunkelviolett. Auf dem dunklen
    Bild waere beides weg. Deshalb steht es dort weiss ausgestanzt – die Datei
    selbst bleibt farbig und ist damit auch fuer helle Flaechen zu gebrauchen.
    Ein Versuch mit violettem PRO samt weisser Kontur wurde am 10. August
    wieder verworfen: auf dem bewegten Bild wirkte er unruhig.
    """
    welcome = (MOCKUPS_ROOT / "welcome.html").read_text(encoding="utf-8")
    logo = welcome.split('class="md-hero__logo"', 1)[1].split(">", 1)[0]

    quelle = logo.split('src="', 1)[1].split('"', 1)[0]
    assert quelle.endswith("logo-myprosole.png"), quelle
    assert (MOCKUPS_ROOT / quelle).exists(), quelle
    # Ohne Alternativtext ist ein Logo fuer Vorlesesoftware ein leeres Bild.
    assert 'alt="MyProSole"' in logo
    # Feste Masse: sonst springt der Bildschirm, sobald das Logo eintrifft.
    assert 'width="' in logo and 'height="' in logo

    styles = ohne_kommentare(
        (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    )
    block = styles.split(".md-hero__logo {", 1)[1].split("}", 1)[0]
    assert "brightness(0) invert(1)" in block
    # Es steht oben und mittig, nicht irgendwo im Fluss.
    assert "margin: 0 auto;" in block

    # Das Logo gehoert in den Entwurfsordner, nicht in einen Nachbarordner:
    # veroeffentlicht wird nur dieser eine Ordner.
    assert (MOCKUPS_ROOT / quelle).resolve().is_relative_to(DESIGN_ROOT.resolve())


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


def test_controls_without_a_target_say_so_instead_of_doing_nothing() -> None:
    """Ein Knopf ohne Wirkung ist in einer Testrunde ein gemeldeter Fehler.

    Vorher passierte beim Antippen entweder nichts – dann haelt man ihn fuer
    kaputt – oder die Seite lud sich neu, weil href="" auf die eigene Adresse
    zeigt. Beides kostet Zeit fuer etwas, das gar kein Fehler ist.
    """
    script = (DESIGN_ROOT / "scripts" / "prototype-placeholder.js").read_text(encoding="utf-8")

    # Die Regel, auf der die Erkennung beruht: verdrahtete Elemente tragen ein
    # data-Attribut. Wird sie gebrochen, meldet dieses Skript falsch.
    assert "Object.keys(element.dataset).length > 0" in script
    # href="" wuerde die Seite neu laden.
    assert "preventDefault" in script
    # Ohne Ziel ist ein <a> weder mit der Tastatur erreichbar noch angesagt.
    assert 'setAttribute("role", "button")' in script
    assert 'setAttribute("tabindex", "0")' in script
    # Nichts wird gespeichert.
    for verboten in ("localStorage", "sessionStorage", "document.cookie"):
        assert verboten not in script, verboten

    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    einblendung = styles.split(".md-snackbar {")[1].split("}")[0]
    # Sie darf keine Beruehrungen abfangen – wer weitertippen will, soll das koennen.
    assert "pointer-events: none;" in einblendung

    for path in sorted(MOCKUPS_ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        assert '<script src="../scripts/prototype-placeholder.js"></script>' in source, path.name


def test_the_open_controls_are_written_down_as_a_work_list() -> None:
    """Die offenen Stellen sind eine Arbeitsliste, kein Zufallsbefund.

    Gezaehlt wird im Browser (siehe den Klickflow-Test), weil dort dieselbe
    Regel laeuft wie in der App. Hier steht nur, dass die Liste die Screens
    nennt, um die es geht – wer einen Screen nachzieht, soll sie
    fortschreiben muessen.
    """
    doku = (DESIGN_ROOT.parent / "docs" / "offene-bedienelemente.md").read_text(encoding="utf-8")

    assert "Die 32 offenen Stellen" in doku
    # Die beiden Gruppen tragen die Entscheidung, was das Nachziehen kostet.
    assert "Führt auf einen Screen, den es noch nicht gibt (16)" in doku
    assert "Sollte auf demselben Screen etwas tun (16)" in doku

    betroffen = {
        "chat", "einlage", "gym-plan", "home", "live-tracking", "login",
        "profil", "share-export", "verlauf", "zyklus-kalender",
    }
    for screen in betroffen:
        assert screen in doku, screen
        assert (MOCKUPS_ROOT / f"{screen}.html").is_file(), screen


def test_dark_design_is_a_choice_in_the_profile_and_stores_nothing_personal() -> None:
    """Der Schalter im Profil, nicht die Systemeinstellung.

    Die Kopplung an das Betriebssystem wurde geloest, damit waehrend der
    Abstimmung auf jedem Geraet dasselbe zu sehen ist. Der Schalter gibt die
    Entscheidung an die Person zurueck, ohne sie wieder ans Geraet zu haengen.
    """
    script = (DESIGN_ROOT / "scripts" / "prototype-theme.js").read_text(encoding="utf-8")

    assert "sessionStorage" in script
    assert "localStorage" not in script
    # Nur erlaubte Woerter, alles andere faellt auf die Voreinstellung zurueck.
    assert "new Set([DARK, LIGHT])" in script
    assert "erlaubt.has(wert)" in script

    profil = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")
    # Ein echtes Kaestchen: mit der Tastatur bedienbar und als Schalter angesagt.
    assert '<input class="md-switch" id="dunkles-design" type="checkbox" data-theme-switch>' in profil
    assert "Dunkles Design" in profil

    for path in sorted(MOCKUPS_ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        kopf = source.split("</head>")[0]
        # Im Kopf und nicht am Seitenende: sonst blitzt jeder Screen erst hell
        # auf und springt dann um.
        assert '<script src="../scripts/prototype-theme.js"></script>' in kopf, path.name


def test_the_logo_palette_is_a_second_switch_for_the_comparison() -> None:
    """Navy gegen Logo-Violett, umschaltbar am lebenden Entwurf.

    Das Navy #16213E steht nicht im Logo; die echte zweite Markenfarbe ist
    das Dunkelviolett des PRO (#460059). Ob es Navy ersetzen soll, laesst
    sich nur am Bildschirm entscheiden – dafuer der Schalter im Profil,
    nach demselben Muster wie das dunkle Design. Nach der Entscheidung
    fliegen Schalter und Zweitpalette wieder raus.
    """
    script = (DESIGN_ROOT / "scripts" / "prototype-theme.js").read_text(encoding="utf-8")
    assert "new Set([LOGO, VITAL, SETB, STANDARD])" in script
    assert "data-palette-switch" in script

    profil = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")
    assert '<input class="md-switch" id="logo-farben" type="checkbox" data-palette-switch="logo">' in profil
    assert "Logo-Farben" in profil

    tokens = (DESIGN_ROOT / "design-system" / "tokens.css").read_text(encoding="utf-8")
    hell = tokens.split('[data-palette="logo"]', 1)[1].split("}")[0]
    # Das Violett stammt aus LOGO/14.png; Weiss darauf traegt 15:1.
    assert "--md-primary: #460059;" in hell
    # Auf den blauen Knoepfen steht das Violett des PRO: 6,0:1.
    assert "--md-on-brand: #460059;" in hell

    # Beide Schalter zusammen brauchen einen eigenen Block, sonst gewinnt je
    # nach Reihenfolge mal das dunkle Thema, mal die Palette.
    dunkel = tokens.split('[data-theme="dark"][data-palette="logo"]', 1)[1].split("}")[0]
    assert "--md-primary:" in dunkel
    assert "--md-background:" in dunkel

    # Die Wahl der Palette bleibt eine Sitzungsnotiz, kein Personendatum.
    assert "localStorage" not in script


def test_the_vital_palette_is_the_third_candidate_and_only_one_runs() -> None:
    """Petrol als hergeleitete Alternative – und nie zwei Paletten zugleich.

    Die grossen Lauf-Apps besetzen die Leistungsfarben: Orange (Strava),
    Neongelb (Nike), Blau (Adidas, Garmin). MyProSole verkauft Technik und
    Gesundheit; Petrol ist die Farbe von Physiotherapie und Medizintechnik
    und liegt im Farbkreis neben dem Logo-Blau. Der Schalter macht daraus
    einen pruefbaren Kandidaten statt einer Geschmacksfrage.

    Zwei Paletten zugleich waeren kein Vergleich: das Skript stellt beim
    Anwenden alle Paletten-Schalter auf den gespeicherten Zustand, damit der
    zweite sichtbar ausgeht, wenn der erste angeht.
    """
    profil = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")
    assert '<input class="md-switch" id="vital-farben" type="checkbox" data-palette-switch="vital">' in profil
    assert "Vital-Farben" in profil

    tokens = (DESIGN_ROOT / "design-system" / "tokens.css").read_text(encoding="utf-8")
    hell = tokens.split('[data-palette="vital"]', 1)[1].split("}")[0]
    assert "--md-primary: #0F5257;" in hell
    # Petrol-Tinte auf den blauen Knoepfen: 4,9:1.
    assert "--md-on-brand: #0F3B3E;" in hell
    dunkel = tokens.split('[data-theme="dark"][data-palette="vital"]', 1)[1].split("}")[0]
    assert "--md-primary:" in dunkel
    assert "--md-background:" in dunkel

    script = (DESIGN_ROOT / "scripts" / "prototype-theme.js").read_text(encoding="utf-8")
    # Genau ein gespeichertes Wort entscheidet; jeder Schalter vergleicht
    # sich damit. So kann nie mehr als einer auf "an" stehen.
    assert 'schalter.getAttribute("data-palette-switch") === palette' in script


def test_set_b_carries_the_delivered_colour_system_unchanged() -> None:
    """Das gelieferte Farbsystem (LOGO/Farbe) als vierte Farbwelt.

    Die Werte stammen aus myprosole-farben.css und werden hier nicht neu
    erfunden, nur auf die Bausteine des Entwurfs übertragen: Cyan als
    Strukturfarbe (dort "action"), Indigo für Sekundärflächen und die
    Schrift auf den Startknöpfen (dort "brand-ink"), Violett als
    Tertiär-Akzent (dort der Analyse vorbehalten).
    """
    profil = (MOCKUPS_ROOT / "profil.html").read_text(encoding="utf-8")
    assert '<input class="md-switch" id="setb-farben" type="checkbox" data-palette-switch="setb">' in profil
    assert "Set B" in profil

    tokens = (DESIGN_ROOT / "design-system" / "tokens.css").read_text(encoding="utf-8")
    hell = tokens.split('[data-palette="setb"]', 1)[1].split("}")[0]
    # Cyan-700 "action-fill" aus der gelieferten Datei.
    assert "--md-primary: #006484;" in hell
    # Der primaere Knopf der Vorschau: Cyan-Fuellung, weisse Schrift. Set B
    # ersetzt als einzige Palette auch das Markenblau der Knoepfe — sonst
    # saehe die App anders aus als die gelieferte Vorschau, an der der
    # Vergleich sich messen soll.
    assert "--md-brand: #006484;" in hell
    assert "--md-on-brand: #FFFFFF;" in hell
    # Violett gehoert der Analyse (Regel 3.2 der gelieferten Doku).
    assert "--md-tertiary: #76399B;" in hell
    # Auch die Statusfarben kommen aus den Set-B-Rampen.
    assert "--md-success: #016D3E;" in hell
    assert "--md-error: #A12626;" in hell
    # Der Vorschau-Look: weisse Karten MIT Rahmen, Aufmerksamkeit als
    # Toenung plus farbiger Rahmen (das Banner-Muster). Nur Set B definiert
    # diese Tokens; anderswo greift der transparente Rueckfall.
    assert "--md-card-border: #D5D6DA;" in hell
    assert "--md-tint-border: #B0DEFB;" in hell
    styles = ohne_kommentare(
        (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    )
    assert "var(--md-card-border, transparent)" in styles
    assert "var(--md-tint-border, transparent)" in styles

    dunkel = tokens.split('[data-theme="dark"][data-palette="setb"]', 1)[1].split("}")[0]
    # Im Dunkeln dreht das System auf helles Cyan mit Indigo-Tinte darauf.
    assert "--md-primary: #85C9F1;" in dunkel
    assert "--md-on-primary: #180F3F;" in dunkel
    assert "--md-brand: #85C9F1;" in dunkel
    assert "--md-background: #13161F;" in dunkel


def test_surfaces_over_photographs_do_not_follow_the_theme() -> None:
    """Ein Foto wird nicht heller, wenn jemand auf dunkel umschaltet.

    Der Schleier ueber dem Willkommensvideo benutzte --md-primary. Im dunklen
    Thema ist das Weiss – ein weisser Schleier ueber dem Foto, mit
    navyfarbener Schrift darauf. Diese beiden Werte drehen sich deshalb nicht
    mit.
    """
    tokens = (DESIGN_ROOT / "design-system" / "tokens.css").read_text(encoding="utf-8")
    hell, dunkel = tokens.split('[data-theme="dark"]', 1)

    assert "--md-scrim: #16213E;" in hell
    assert "--md-on-scrim: #FFFFFF;" in hell
    assert "--md-scrim" not in dunkel.split("}")[0]
    assert "--md-on-scrim" not in dunkel.split("}")[0]
    # Eingabefelder muessen dem dunklen Thema folgen, sonst bleiben sie hell.
    assert "color-scheme: only dark;" in dunkel

    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    for regel in (".md-hero__scrim", ".md-hero__content"):
        block = styles.split(regel + " {")[1].split("}")[0]
        assert "--md-primary" not in block, regel
        assert "scrim" in block, regel

    # Fest verdrahtetes Weiss auf Flaechen, die im dunklen Thema hell werden.
    # Kommentare vorher entfernen – sie nennen die alte Farbe absichtlich, und
    # ein Test, der Erklaerungen mitzaehlt, schlaegt aus dem falschen Grund an.
    sauber = ohne_kommentare(styles)
    for regel in (".md-run-complete__icon", ".md-plan-card .md-button--tonal"):
        block = sauber.split(regel)[1].split("}")[0]
        assert "#FFFFFF" not in block, regel
        assert "var(--md-surface)" in block, regel


def test_icons_take_the_text_colour_everywhere() -> None:
    """Symbole werden mit fill gezeichnet, nicht mit color.

    Vorher trug nur .icon diese Zeile. Alles ohne diese Klasse blieb beim
    Standardwert Schwarz – im hellen Thema faellt das nicht auf, im dunklen
    verschwinden die Symbole. Betroffen war die gesamte untere
    Navigationsleiste.
    """
    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")

    # Als Grundregel, nicht je Klasse: sonst geht dieselbe Luecke beim
    # naechsten Symbol wieder auf.
    assert "\nsvg { fill: currentColor; }" in styles

    # Die Navigationsleiste benutzt icon-sm; genau dort fiel es auf.
    for screen in ("home.html", "verlauf.html", "uebungen.html", "profil.html"):
        source = (MOCKUPS_ROOT / screen).read_text(encoding="utf-8")
        leiste = source.split('<nav class="md-nav">')[1].split("</nav>")[0]
        assert 'class="icon-sm"' in leiste, screen


def test_the_filled_buttons_carry_the_logo_blue() -> None:
    """Ein Knopf, eine Farbe – dieselbe wie "Laufen starten", in beiden Themen.

    Das Blau stammt aus assets/myprosole_logo.png. Es wird im dunklen Thema
    nicht ueberschrieben: eine Markenfarbe, die sich mitdreht, ist keine mehr.

    Anfangs trugen nur die Startknoepfe das Blau und die uebrigen gefuellten
    Knoepfe Navy – zwei Farben fuer dieselbe Rolle sahen aus wie zwei
    Bedeutungen. Seitdem alle gefuellten Knoepfe das Blau tragen, gibt es
    keine Sondervariante --brand mehr; sie waere nur ein zweiter Name.
    """
    tokens = (DESIGN_ROOT / "design-system" / "tokens.css").read_text(encoding="utf-8")
    hell, dunkel = tokens.split('[data-theme="dark"]', 1)
    dunkler_block = dunkel.split("}")[0]

    assert "--md-brand: #43AFD8;" in hell
    # Navy statt Weiss: Weiss auf diesem Blau ergibt 2,5:1 und ist unlesbar.
    assert "--md-on-brand: #16213E;" in hell
    assert "--md-brand-surface: #FFFFFF;" in hell
    for marke in ("--md-brand:", "--md-on-brand:", "--md-brand-surface:"):
        assert marke not in dunkler_block, marke

    styles = (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    for regel in (".md-cta {", ".md-routine-start__body {"):
        block = styles.split(regel)[1].split("}")[0]
        assert "var(--md-brand)" in block, regel
        assert "var(--md-on-brand)" in block, regel
    assert ".md-button--filled { background: var(--md-brand); color: var(--md-on-brand); }" in styles

    # Die alte Sondervariante darf nirgends weiterleben – weder als Regel
    # noch als Klasse in einem Entwurf.
    assert "md-button--brand" not in styles
    for path in sorted(MOCKUPS_ROOT.glob("*.html")):
        assert "md-button--brand" not in path.read_text(encoding="utf-8"), path.name


def test_the_round_marks_are_dark_with_a_bright_glyph() -> None:
    """Kreis dunkel, Zeichen hell – in beiden Themen gleich.

    Ueber --md-tertiary drehte sich der Chat-Knopf im dunklen Thema um: weisser
    Kreis, dunkles Zeichen. Das Logo-Blau steht dabei bewusst nicht auf Weiss –
    das waere 2,5:1 und damit unlesbar; auf dem dunklen Kreis sind es 6,4:1.
    """
    styles = ohne_kommentare(
        (DESIGN_ROOT / "design-system" / "components.css").read_text(encoding="utf-8")
    )

    kreis = styles.split(".md-cta__icon {")[1].split("}")[0]
    assert "background: var(--md-on-brand);" in kreis
    assert "color: var(--md-brand-surface);" in kreis

    chat = styles.split("\n.md-fab {")[1].split("}")[0]
    # Seit dem durchscheinenden Knopf steckt --md-on-brand in einem
    # color-mix() statt als reiner Wert, damit der Kreis leicht transparent
    # bleibt. Nur das Icon selbst bleibt voll deckend, sonst waere es kaum
    # noch lesbar.
    assert "--md-on-brand" in chat
    assert "color: var(--md-brand);" in chat
    # Beide duerfen nicht mehr an den Themenfarben haengen.
    for block in (kreis, chat):
        assert "--md-tertiary" not in block
        assert "--md-primary" not in block
