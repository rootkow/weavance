from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal, cast
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from weavance_api.models import Action, EpisodeEvent, RecommendationEpisode, Task
from weavance_api.models.recommendation import EpisodeEventType
from weavance_api.observability import get_logger
from weavance_api.schemas.recommendation import (
    ContextSnapshot,
    EpisodeEventCreate,
    EpisodeEventResponse,
    EpisodeState,
    RecommendationEpisodeResponse,
    RecommendationTransitionResponse,
)

logger = get_logger(__name__)

STRATEGY_NAME = "transparent-bounded-action"
STRATEGY_VERSION = "1"
PRE_START_EVENTS = frozenset(
    {"accepted", "resized", "deferred", "swapped", "overwhelmed"}
)
OUTCOME_EVENTS = frozenset(
    {"done_for_now", "progress_made", "did_not_start", "keep_going"}
)
CLOSING_EVENTS = frozenset(
    {
        "resized",
        "deferred",
        "swapped",
        "overwhelmed",
        "done_for_now",
        "progress_made",
        "did_not_start",
        "keep_going",
    }
)


class RecommendationNotFoundError(Exception):
    pass


class NoEligibleActionError(Exception):
    pass


class InvalidEpisodeTransitionError(Exception):
    pass


@dataclass(frozen=True)
class Candidate:
    task: Task
    action: Action


async def get_current_recommendation(
    session: AsyncSession,
) -> RecommendationEpisodeResponse | None:
    episode = await _get_current_episode(session)
    return _episode_response(episode) if episode is not None else None


async def create_recommendation(
    session: AsyncSession,
    *,
    context: ContextSnapshot,
) -> RecommendationEpisodeResponse:
    current = await _get_current_episode(session)
    if current is not None:
        return _episode_response(current)

    candidates = await _eligible_candidates(session)
    if not candidates:
        raise NoEligibleActionError

    recently_closed_task_id = await _latest_closed_task_id(session)
    candidate = _choose_candidate(
        candidates,
        context=context,
        excluded_task_id=recently_closed_task_id,
    )
    episode = _build_episode(candidate, context=context, variant="normal")
    session.add(episode)
    await session.commit()
    episode = await _load_episode(session, episode.id)
    logger.info(
        "recommendation.created",
        recommendation_id=episode.id,
        task_id=episode.task_id,
        strategy_name=episode.strategy_name,
        strategy_version=episode.strategy_version,
    )
    return _episode_response(episode)


async def record_episode_event(
    session: AsyncSession,
    *,
    episode_id: UUID,
    request: EpisodeEventCreate,
) -> RecommendationTransitionResponse:
    try:
        episode = await _load_episode(session, episode_id, lock_for_update=True)
    except RecommendationNotFoundError:
        raise

    state = _episode_state(episode)
    event_type: EpisodeEventType = request.event_type
    if event_type in PRE_START_EVENTS and state != "proposed":
        raise InvalidEpisodeTransitionError
    if event_type in OUTCOME_EVENTS and state != "accepted":
        raise InvalidEpisodeTransitionError

    replacement: RecommendationEpisode | None = None
    context = ContextSnapshot.model_validate(episode.context_snapshot)
    candidate = Candidate(task=episode.task, action=episode.action)

    if event_type == "resized":
        replacement = _build_episode(
            candidate,
            context=context,
            variant="smaller",
            parent_episode_id=episode.id,
        )
    elif event_type == "overwhelmed":
        replacement = _build_episode(
            candidate,
            context=context,
            variant="smallest",
            parent_episode_id=episode.id,
        )
    elif event_type == "swapped":
        candidates = await _eligible_candidates(session)
        alternatives = [
            item
            for item in candidates
            if item.task.id != episode.task_id
        ]
        if alternatives:
            selected = _choose_candidate(alternatives, context=context)
            replacement = _build_episode(
                selected,
                context=context,
                variant="normal",
                parent_episode_id=episode.id,
            )
    elif event_type == "keep_going":
        replacement = _build_episode(
            candidate,
            context=context,
            variant="continued",
            parent_episode_id=episode.id,
        )

    payload: dict[str, str] = {}
    if replacement is not None:
        session.add(replacement)
        payload["replacement_episode_id"] = str(replacement.id)

    event = EpisodeEvent(
        id=uuid4(),
        episode_id=episode.id,
        event_type=event_type,
        payload=payload,
    )
    episode.events.append(event)
    await session.commit()
    episode = await _load_episode(session, episode.id)
    loaded_replacement = (
        await _load_episode(session, replacement.id)
        if replacement is not None
        else None
    )
    loaded_event = next(item for item in episode.events if item.id == event.id)
    logger.info(
        "recommendation.event.recorded",
        recommendation_id=episode.id,
        event_type=event_type,
        replacement_id=loaded_replacement.id if loaded_replacement is not None else None,
    )
    return RecommendationTransitionResponse(
        event=EpisodeEventResponse.model_validate(loaded_event),
        episode=_episode_response(episode),
        replacement=(
            _episode_response(loaded_replacement)
            if loaded_replacement is not None
            else None
        ),
    )


async def _get_current_episode(
    session: AsyncSession,
) -> RecommendationEpisode | None:
    episodes = await session.scalars(
        select(RecommendationEpisode)
        .options(
            selectinload(RecommendationEpisode.task),
            selectinload(RecommendationEpisode.action),
            selectinload(RecommendationEpisode.events),
        )
        .order_by(RecommendationEpisode.created_at.desc(), RecommendationEpisode.id.desc())
        .limit(100)
    )
    proposed: RecommendationEpisode | None = None
    for episode in episodes.unique():
        state = _episode_state(episode)
        if state == "accepted":
            return episode
        if (
            proposed is None
            and state == "proposed"
            and episode.task.status == "active"
            and episode.action.status == "active"
        ):
            proposed = episode
    return proposed


async def _load_episode(
    session: AsyncSession,
    episode_id: UUID,
    *,
    lock_for_update: bool = False,
) -> RecommendationEpisode:
    statement = (
        select(RecommendationEpisode)
        .options(
            selectinload(RecommendationEpisode.task),
            selectinload(RecommendationEpisode.action),
            selectinload(RecommendationEpisode.events),
        )
        .where(RecommendationEpisode.id == episode_id)
    )
    if lock_for_update:
        statement = statement.with_for_update()

    episode = await session.scalar(statement)
    if episode is None:
        raise RecommendationNotFoundError
    return episode


async def _eligible_candidates(session: AsyncSession) -> list[Candidate]:
    tasks = await session.scalars(
        select(Task)
        .options(selectinload(Task.actions))
        .where(Task.status == "active")
        .order_by(Task.created_at, Task.id)
    )
    candidates: list[Candidate] = []
    for task in tasks.unique():
        action = next((item for item in task.actions if item.status == "active"), None)
        if action is not None:
            candidates.append(Candidate(task=task, action=action))
    return candidates


async def _latest_closed_task_id(session: AsyncSession) -> UUID | None:
    task_id = await session.scalar(
        select(RecommendationEpisode.task_id)
        .join(EpisodeEvent)
        .where(EpisodeEvent.event_type.in_(CLOSING_EVENTS))
        .order_by(EpisodeEvent.created_at.desc(), EpisodeEvent.id.desc())
        .limit(1)
    )
    return task_id


def _choose_candidate(
    candidates: list[Candidate],
    *,
    context: ContextSnapshot,
    excluded_task_id: UUID | None = None,
) -> Candidate:
    available = [
        candidate
        for candidate in candidates
        if excluded_task_id is None or candidate.task.id != excluded_task_id
    ]
    if not available:
        available = candidates

    if context.available_minutes is not None:
        fitting = []
        for candidate in available:
            maximum_minutes = _maximum_minutes(candidate.action)
            if (
                maximum_minutes is not None
                and maximum_minutes <= context.available_minutes
            ):
                fitting.append(candidate)
        if fitting:
            available = fitting

    return min(
        available,
        key=lambda candidate: _candidate_key(
            candidate,
            prefer_easier=context.easier_requested,
        ),
    )


def _candidate_key(
    candidate: Candidate,
    *,
    prefer_easier: bool,
) -> tuple[object, ...]:
    deadline = _deadline(candidate.task)
    importance = _importance_rank(candidate.task)
    maximum_minutes = _maximum_minutes(candidate.action)
    ease_key = maximum_minutes if prefer_easier and maximum_minutes is not None else 10**9
    return (
        deadline is None,
        deadline or date.max,
        ease_key,
        importance,
        candidate.task.created_at,
        candidate.action.position,
        str(candidate.task.id),
    )


def _deadline(task: Task) -> date | None:
    if task.deadline is None:
        return None
    value = task.deadline.get("date")
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _importance_rank(task: Task) -> int:
    if task.importance is None:
        return 3
    value = task.importance.get("level")
    if not isinstance(value, str):
        return 3
    return {"high": 0, "medium": 1, "low": 2}.get(value, 3)


def _maximum_minutes(action: Action) -> int | None:
    if action.duration is None:
        return None
    value = action.duration.get("maximum_minutes")
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _build_episode(
    candidate: Candidate,
    *,
    context: ContextSnapshot,
    variant: Literal["normal", "smaller", "smallest", "continued"],
    parent_episode_id: UUID | None = None,
) -> RecommendationEpisode:
    task = candidate.task
    action = candidate.action
    factors, reason = _explanation(candidate)
    entry_point = action.description
    stopping_condition = (
        f"You have completed this starting action. “{task.title}” can remain open."
    )

    if variant == "smaller":
        entry_point = f"Take only the setup step for: {action.description}"
        stopping_condition = (
            "The first thing you need is open, gathered, or identified. "
            "You do not need to continue."
        )
        factors = [{"kind": "explicit_response", "value": "resized"}]
        reason = "You asked for a smaller commitment, so this stops after setup."
    elif variant == "smallest":
        entry_point = f"Put the first thing you need for “{action.description}” in front of you."
        stopping_condition = (
            "The relevant app, document, object, or contact is ready. "
            "Nothing else is required."
        )
        factors = [{"kind": "explicit_response", "value": "overwhelmed"}]
        reason = "You asked for less to decide, so this is only a preparation step."
    elif variant == "continued":
        stopping_condition = (
            "You have completed one more concrete part of this starting action. "
            "Then pause and choose again."
        )
        factors = [{"kind": "explicit_response", "value": "keep_going"}]
        reason = "You asked to keep going, so this is a new bounded commitment."

    return RecommendationEpisode(
        id=uuid4(),
        task_id=task.id,
        action_id=action.id,
        parent_episode_id=parent_episode_id,
        entry_point=entry_point,
        stopping_condition=stopping_condition,
        context_snapshot=context.model_dump(mode="json"),
        explanation_factors=factors,
        reason=reason,
        strategy_name=STRATEGY_NAME,
        strategy_version=STRATEGY_VERSION,
    )


def _explanation(candidate: Candidate) -> tuple[list[dict[str, str]], str]:
    deadline = _deadline(candidate.task)
    if deadline is not None:
        return (
            [{"kind": "deadline", "value": deadline.isoformat()}],
            f"This starting action has a known deadline: {deadline.isoformat()}.",
        )

    importance = (
        candidate.task.importance.get("level")
        if candidate.task.importance is not None
        else None
    )
    if importance in {"high", "medium", "low"}:
        return (
            [{"kind": "importance", "value": cast(str, importance)}],
            f"This has a recorded {importance} importance and an active starting action.",
        )

    return (
        [{"kind": "fallback", "value": "stable_active_starting_action"}],
        "This is an active starting action, kept to one bounded commitment.",
    )


def _episode_state(episode: RecommendationEpisode) -> EpisodeState:
    event_types = {event.event_type for event in episode.events}
    if event_types.intersection(CLOSING_EVENTS):
        return "closed"
    if "accepted" in event_types:
        return "accepted"
    return "proposed"


def _episode_response(
    episode: RecommendationEpisode,
) -> RecommendationEpisodeResponse:
    return RecommendationEpisodeResponse(
        id=episode.id,
        task_id=episode.task_id,
        action_id=episode.action_id,
        parent_episode_id=episode.parent_episode_id,
        task_title=episode.task.title,
        action_description=episode.action.description,
        entry_point=episode.entry_point,
        stopping_condition=episode.stopping_condition,
        context_snapshot=episode.context_snapshot,
        explanation_factors=tuple(episode.explanation_factors),
        reason=episode.reason,
        strategy_name=episode.strategy_name,
        strategy_version=episode.strategy_version,
        state=_episode_state(episode),
        created_at=episode.created_at,
    )
