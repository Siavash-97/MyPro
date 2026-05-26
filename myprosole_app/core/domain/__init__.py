from core.domain.exercises_catalog import (
    Exercise,
    EXERCISE_CATALOG,
    all_exercises,
    exercise_ids_for_diagnosis,
    exercises_for_diagnosis_ids,
    get_exercise,
)
from core.domain.data_loader import (
    LEGACY_FSR_FORMAT,
    PAIRED_PRESSURE_FORMAT,
    PARTIAL_PRESSURE_FORMAT,
    detect_sensor_format,
    load_pressure_dataframe,
    normalize_legacy_sensor_dataframe,
    normalize_paired_sensor_dataframe,
    read_sensor_table,
)
from core.domain.fsr import compute_step_metrics, detect_events, preprocess_fsr
from core.domain.pressure_analysis import PressureAnalysisResult, analyze_pressure
from core.domain.recommendations import (
    Diagnosis,
    ExerciseRecommendation,
    analyze_and_recommend,
    build_exercise_recommendations,
    diagnose,
    metrics_snapshot,
    recommend_exercises,
)
from core.domain.sensor_mapping import SENSOR_COLUMNS, SENSOR_DEFINITIONS, TIMESTAMP_COLUMN
from core.domain.visualization import plot_pressure_distribution

__all__ = [
    "preprocess_fsr",
    "detect_events",
    "compute_step_metrics",
    "PAIRED_PRESSURE_FORMAT",
    "PARTIAL_PRESSURE_FORMAT",
    "LEGACY_FSR_FORMAT",
    "detect_sensor_format",
    "load_pressure_dataframe",
    "normalize_legacy_sensor_dataframe",
    "normalize_paired_sensor_dataframe",
    "read_sensor_table",
    "PressureAnalysisResult",
    "analyze_pressure",
    "SENSOR_COLUMNS",
    "SENSOR_DEFINITIONS",
    "TIMESTAMP_COLUMN",
    "plot_pressure_distribution",
    "Exercise",
    "EXERCISE_CATALOG",
    "all_exercises",
    "exercise_ids_for_diagnosis",
    "exercises_for_diagnosis_ids",
    "get_exercise",
    "Diagnosis",
    "ExerciseRecommendation",
    "analyze_and_recommend",
    "build_exercise_recommendations",
    "diagnose",
    "metrics_snapshot",
    "recommend_exercises",
]
