from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from weavance_api.interpretation import (
    DerivationMethod,
    EvidenceSource,
    InterpretationProposal,
    Provenance,
)
from weavance_api.models import Action, Interpretation, Task
from weavance_api.observability import get_logger
from weavance_api.schemas.task import ActionUpdate, TaskContentUpdate, TaskUpdate

logger = get_logger(__name__)


class TaskNotFoundError(Exception):
    pass


class ActionNotFoundError(Exception):
    pass


async def list_tasks(
    session: AsyncSession,
    *,
    include_archived: bool = False,
) -> list[Task]:
    statement = select(Task).options(selectinload(Task.actions))
    if not include_archived:
        statement = statement.where(Task.status != "archived")
    tasks = await session.scalars(statement.order_by(Task.created_at, Task.id))
    return list(tasks.unique())


async def update_task(
    session: AsyncSession,
    *,
    task_id: UUID,
    update: TaskUpdate,
) -> Task:
    task = await session.scalar(
        select(Task).options(selectinload(Task.actions)).where(Task.id == task_id)
    )
    if task is None:
        raise TaskNotFoundError

    if update.title is not None:
        task.title = update.title
        task.provenance = _user_correction_provenance()
    if update.status is not None:
        task.status = update.status

    await session.commit()
    await session.refresh(task, attribute_names=["updated_at"])
    logger.info(
        "task.updated",
        task_id=task.id,
        title_changed=update.title is not None,
        status=task.status,
    )
    return task


async def update_task_content(
    session: AsyncSession,
    *,
    task_id: UUID,
    update: TaskContentUpdate,
) -> Task:
    task = await session.scalar(
        select(Task).options(selectinload(Task.actions)).where(Task.id == task_id)
    )
    if task is None:
        raise TaskNotFoundError

    action = next((item for item in task.actions if item.id == update.action_id), None)
    if action is None:
        raise ActionNotFoundError

    title_changed = task.title != update.title
    description_changed = action.description != update.action_description
    if title_changed:
        task.title = update.title
        task.provenance = _user_correction_provenance()
    if description_changed:
        action.description = update.action_description
        action.provenance = _user_correction_provenance()

    await session.commit()
    await session.refresh(task, attribute_names=["updated_at"])
    await session.refresh(action, attribute_names=["updated_at"])
    logger.info(
        "task.content.updated",
        task_id=task.id,
        action_id=action.id,
        title_changed=title_changed,
        description_changed=description_changed,
    )
    return task


async def update_action(
    session: AsyncSession,
    *,
    task_id: UUID,
    action_id: UUID,
    update: ActionUpdate,
) -> Task:
    task = await session.scalar(
        select(Task).options(selectinload(Task.actions)).where(Task.id == task_id)
    )
    if task is None:
        raise TaskNotFoundError

    action = next((item for item in task.actions if item.id == action_id), None)
    if action is None:
        raise ActionNotFoundError

    if update.description is not None:
        action.description = update.description
        action.provenance = _user_correction_provenance()
    if update.status is not None:
        action.status = update.status

    await session.commit()
    await session.refresh(action, attribute_names=["updated_at"])
    logger.info(
        "action.updated",
        task_id=task.id,
        action_id=action.id,
        description_changed=update.description is not None,
        status=action.status,
    )
    return task


async def materialize_confirmed_tasks(
    session: AsyncSession,
    *,
    interpretation: Interpretation,
    proposal: InterpretationProposal,
) -> list[Task]:
    capture_task_ids = select(Task.id).where(
        Task.source_capture_id == interpretation.capture_id
    )
    await session.execute(
        update(Action)
        .where(
            Action.task_id.in_(capture_task_ids),
            Action.status != "archived",
        )
        .values(status="archived", updated_at=func.now())
    )
    await session.execute(
        update(Task)
        .where(
            Task.source_capture_id == interpretation.capture_id,
            Task.status != "archived",
        )
        .values(status="archived", updated_at=func.now())
    )
    tasks: list[Task] = []
    for task_proposal in proposal.tasks:
        task = Task(
            id=task_proposal.id,
            source_capture_id=interpretation.capture_id,
            source_interpretation_id=interpretation.id,
            title=task_proposal.title,
            status="active",
            provenance=task_proposal.provenance.model_dump(mode="json"),
            deadline=(
                task_proposal.deadline.model_dump(mode="json")
                if task_proposal.deadline is not None
                else None
            ),
            importance=(
                task_proposal.importance.model_dump(mode="json")
                if task_proposal.importance is not None
                else None
            ),
        )
        task.actions = [
            Action(
                id=action_proposal.id,
                source_interpretation_id=interpretation.id,
                description=action_proposal.description,
                status="active",
                position=index,
                provenance=action_proposal.provenance.model_dump(mode="json"),
                duration=(
                    action_proposal.duration.model_dump(mode="json")
                    if action_proposal.duration is not None
                    else None
                ),
            )
            for index, action_proposal in enumerate(task_proposal.actions, start=1)
        ]
        tasks.append(task)
    return tasks


def _user_correction_provenance() -> dict[str, object]:
    return Provenance(
        evidence_source=EvidenceSource.USER_CORRECTION,
        derivation=DerivationMethod.DIRECT,
        confidence=1.0,
    ).model_dump(mode="json")
