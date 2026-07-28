from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api.database import get_session
from weavance_api.schemas.task import ActionUpdate, TaskResponse, TaskUpdate
from weavance_api.services.tasks import (
    ActionNotFoundError,
    TaskNotFoundError,
    list_tasks,
    update_action,
    update_task,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
async def list_tasks_endpoint(
    session: Annotated[AsyncSession, Depends(get_session)],
    include_archived: Annotated[bool, Query()] = False,
) -> list[TaskResponse]:
    tasks = await list_tasks(session, include_archived=include_archived)
    return [TaskResponse.model_validate(task) for task in tasks]


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task_endpoint(
    task_id: UUID,
    request: TaskUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskResponse:
    try:
        task = await update_task(session, task_id=task_id, update=request)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND) from exc
    return TaskResponse.model_validate(task)


@router.patch("/{task_id}/actions/{action_id}", response_model=TaskResponse)
async def update_action_endpoint(
    task_id: UUID,
    action_id: UUID,
    request: ActionUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TaskResponse:
    try:
        task = await update_action(
            session,
            task_id=task_id,
            action_id=action_id,
            update=request,
        )
    except (TaskNotFoundError, ActionNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND) from exc
    return TaskResponse.model_validate(task)
