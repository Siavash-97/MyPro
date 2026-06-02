"""Load and cache foot pressure replay data in the AppContext."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from core.domain.foot_replay import ReplaySequence, build_replay_sequence

if TYPE_CHECKING:
    from core.context import AppContext


def ensure_replay_sequence(
    ctx: AppContext,
    raw_df,
    source_name: str,
) -> tuple[Any, ReplaySequence]:
    """Run the gait pipeline once per upload and cache replay frames in ``ctx``."""
    cache_source = ctx.param("foot_replay_source_name")
    cached_result = ctx.param("foot_replay_pipeline_result")
    cached_replay = ctx.param("foot_replay_sequence")

    if (
        cache_source == source_name
        and cached_result is not None
        and cached_replay is not None
    ):
        return cached_result, cached_replay

    from modules.gait_analysis.pipeline import run_pipeline

    result = run_pipeline(raw_df)
    replay = build_replay_sequence(result.df, result.steps)
    ctx.set_param("foot_replay_source_name", source_name)
    ctx.set_param("foot_replay_pipeline_result", result)
    ctx.set_param("foot_replay_sequence", replay)
    return result, replay
