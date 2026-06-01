"""Katalog der mitgelieferten Beispiel-CSVs fuer die Streamlit-App."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

SAMPLE_DATA_DIR = (
    Path(__file__).resolve().parents[1] / "myprosole_analysis" / "sample_data"
)


@dataclass(frozen=True)
class SampleDataset:
    filename: str
    title: str
    description: str

    @property
    def path(self) -> Path:
        return SAMPLE_DATA_DIR / self.filename


SAMPLE_DATASETS: tuple[SampleDataset, ...] = (
    SampleDataset(
        "sample_data.csv",
        "Gemischt",
        "Verschiedene Kontaktmuster (Default)",
    ),
    SampleDataset(
        "sample_heel_striker.csv",
        "Fersenläufer",
        "Überwiegend klassischer Fersenaufsatz",
    ),
    SampleDataset(
        "sample_flat_foot.csv",
        "Flacher Fuß",
        "Schneller Vorfuß nach Ferse",
    ),
    SampleDataset(
        "sample_forefoot_runner.csv",
        "Vorfußläufer",
        "Vorfuß zuerst, teils ohne Ferse",
    ),
    SampleDataset(
        "sample_lateral_dominant.csv",
        "Außenbelastung",
        "Erhöhte laterale Vorfußbelastung",
    ),
    SampleDataset(
        "sample_variable_pace.csv",
        "Wechselndes Tempo",
        "Langsam / normal / schnell",
    ),
)

SESSION_SAMPLE_KEY = "shared_sample_file"


def available_samples() -> list[SampleDataset]:
    return [sample for sample in SAMPLE_DATASETS if sample.path.is_file()]


def sample_by_filename(filename: str) -> SampleDataset | None:
    for sample in SAMPLE_DATASETS:
        if sample.filename == filename:
            return sample
    return None
