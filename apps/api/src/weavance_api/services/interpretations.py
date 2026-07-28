from datetime import datetime
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import and_, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api.interpretation import (
    ActionProposal,
    CaptureInterpreter,
    DerivationMethod,
    EvidenceSource,
    InterpretationProposal,
    InterpretationRequest,
    InterpreterDescriptor,
    Provenance,
    TaskProposal,
)
from weavance_api.models import Capture, Interpretation, InterpretationStatus
from weavance_api.observability import get_logger
from weavance_api.schemas.interpretation import InterpretationConfirmation
from weavance_api.services.tasks import materialize_confirmed_tasks

logger = get_logger(__name__)


class CaptureNotFoundError(Exception):
    pass


class InterpretationNotFoundError(Exception):
    pass


class InvalidInterpretationError(Exception):
    pass


class StaleInterpretationError(Exception):
    pass


async def list_latest_confirmed_interpretations(
    session: AsyncSession,
) -> list[Interpretation]:
    latest_confirmed_versions = (
        select(
            Interpretation.capture_id,
            func.max(Interpretation.version).label("version"),
        )
        .where(Interpretation.status == "confirmed")
        .group_by(Interpretation.capture_id)
        .subquery()
    )
    interpretations = await session.scalars(
        select(Interpretation)
        .join(
            latest_confirmed_versions,
            and_(
                Interpretation.capture_id
                == latest_confirmed_versions.c.capture_id,
                Interpretation.version == latest_confirmed_versions.c.version,
            ),
        )
        .join(Capture, Capture.id == Interpretation.capture_id)
        .order_by(Capture.created_at, Capture.id)
    )
    return list(interpretations)


async def create_interpretation(
    session: AsyncSession,
    *,
    capture_id: UUID,
    reference_time: datetime,
    time_zone: str,
    interpreter: CaptureInterpreter,
) -> Interpretation:
    capture = await session.get(Capture, capture_id)
    if capture is None:
        raise CaptureNotFoundError
    persisted_capture_id = capture.id
    raw_text = capture.raw_text
    await session.rollback()

    request = InterpretationRequest(
        capture_id=persisted_capture_id,
        raw_text=raw_text,
        reference_time=reference_time,
        time_zone=time_zone,
    )
    try:
        proposal = InterpretationProposal.model_validate(await interpreter.interpret(request))
    except ValidationError as exc:
        raise InvalidInterpretationError("interpreter returned an invalid proposal") from exc
    if proposal.capture_id != persisted_capture_id:
        raise InvalidInterpretationError("proposal references a different capture")

    interpretation = await _persist_interpretation(
        session,
        capture_id=persisted_capture_id,
        parent_interpretation_id=None,
        status="proposed",
        reference_time=reference_time,
        time_zone=time_zone,
        proposal=proposal,
    )
    return interpretation


async def confirm_interpretation(
    session: AsyncSession,
    *,
    capture_id: UUID,
    interpretation_id: UUID,
    confirmation: InterpretationConfirmation,
) -> Interpretation:
    await _lock_capture(session, capture_id)
    original = await session.scalar(
        select(Interpretation).where(
            Interpretation.id == interpretation_id,
            Interpretation.capture_id == capture_id,
        )
    )
    if original is None:
        raise InterpretationNotFoundError
    if original.status != "proposed":
        raise InvalidInterpretationError("only a proposal can be confirmed")

    original_proposal = InterpretationProposal.model_validate(original.proposal)
    original_tasks = {task.id: task for task in original_proposal.tasks}
    correction_provenance = Provenance(
        evidence_source=EvidenceSource.USER_CORRECTION,
        derivation=DerivationMethod.DIRECT,
        confidence=1.0,
    )
    confirmed_tasks: list[TaskProposal] = []

    for reviewed_task in confirmation.tasks:
        original_task = original_tasks.get(reviewed_task.id)
        if original_task is None:
            confirmed_tasks.append(
                TaskProposal(
                    id=reviewed_task.id,
                    title=reviewed_task.title,
                    provenance=correction_provenance,
                    actions=(
                        ActionProposal(
                            id=reviewed_task.action_id,
                            description=reviewed_task.action_description,
                            provenance=correction_provenance,
                        ),
                    ),
                )
            )
            continue

        original_action = next(
            (
                action
                for action in original_task.actions
                if action.id == reviewed_task.action_id
            ),
            None,
        )
        if original_action is None:
            confirmed_action = ActionProposal(
                id=reviewed_task.action_id,
                description=reviewed_task.action_description,
                provenance=correction_provenance,
            )
        else:
            confirmed_action = ActionProposal(
                id=original_action.id,
                description=reviewed_task.action_description,
                provenance=(
                    original_action.provenance
                    if reviewed_task.action_description == original_action.description
                    else correction_provenance
                ),
                duration=original_action.duration,
            )

        confirmed_tasks.append(
            TaskProposal(
                id=original_task.id,
                title=reviewed_task.title,
                provenance=(
                    original_task.provenance
                    if reviewed_task.title == original_task.title
                    else correction_provenance
                ),
                actions=(confirmed_action,),
                deadline=original_task.deadline,
                importance=original_task.importance,
            )
        )

    confirmed_proposal = InterpretationProposal(
        capture_id=capture_id,
        interpreter=InterpreterDescriptor(name="user-review", version="1"),
        tasks=tuple(confirmed_tasks),
    )
    existing_confirmation = await session.scalar(
        select(Interpretation).where(
            Interpretation.parent_interpretation_id == original.id
        )
    )
    if existing_confirmation is not None:
        if existing_confirmation.proposal == confirmed_proposal.model_dump(mode="json"):
            return existing_confirmation
        raise StaleInterpretationError

    latest_version = await _latest_version(session, capture_id)
    if original.version != latest_version:
        raise StaleInterpretationError

    return await _persist_interpretation(
        session,
        capture_id=capture_id,
        parent_interpretation_id=original.id,
        status="confirmed",
        reference_time=original.reference_time,
        time_zone=original.time_zone,
        proposal=confirmed_proposal,
        materialize_tasks=True,
    )


async def _persist_interpretation(
    session: AsyncSession,
    *,
    capture_id: UUID,
    parent_interpretation_id: UUID | None,
    status: InterpretationStatus,
    reference_time: datetime,
    time_zone: str,
    proposal: InterpretationProposal,
    materialize_tasks: bool = False,
) -> Interpretation:
    await _lock_capture(session, capture_id)
    interpretation = Interpretation(
        capture_id=capture_id,
        parent_interpretation_id=parent_interpretation_id,
        version=await _latest_version(session, capture_id) + 1,
        status=status,
        reference_time=reference_time,
        time_zone=time_zone,
        proposal=proposal.model_dump(mode="json"),
    )
    session.add(interpretation)
    try:
        if materialize_tasks:
            await session.flush()
            session.add_all(
                await materialize_confirmed_tasks(
                    session,
                    interpretation=interpretation,
                    proposal=proposal,
                )
            )
        await session.flush()
        await session.commit()
    except SQLAlchemyError:
        await session.rollback()
        logger.exception(
            "interpretation.persist.failed",
            capture_id=capture_id,
            status=status,
        )
        raise
    logger.info(
        "interpretation.persisted",
        capture_id=capture_id,
        interpretation_id=interpretation.id,
        version=interpretation.version,
        status=status,
        task_count=len(proposal.tasks),
    )
    return interpretation


async def _latest_version(session: AsyncSession, capture_id: UUID) -> int:
    latest = await session.scalar(
        select(func.coalesce(func.max(Interpretation.version), 0)).where(
            Interpretation.capture_id == capture_id
        )
    )
    return int(latest or 0)


async def _lock_capture(session: AsyncSession, capture_id: UUID) -> None:
    locked_capture_id = await session.scalar(
        select(Capture.id).where(Capture.id == capture_id).with_for_update()
    )
    if locked_capture_id is None:
        raise CaptureNotFoundError
