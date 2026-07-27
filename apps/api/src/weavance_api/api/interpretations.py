from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api.database import get_session
from weavance_api.interpretation import (
    CaptureInterpreter,
    DeterministicCaptureInterpreter,
)
from weavance_api.schemas.interpretation import (
    InterpretationConfirmation,
    InterpretationCreate,
    InterpretationResponse,
)
from weavance_api.services.interpretations import (
    CaptureNotFoundError,
    InterpretationNotFoundError,
    InvalidInterpretationError,
    StaleInterpretationError,
    confirm_interpretation,
    create_interpretation,
    list_latest_confirmed_interpretations,
)

router = APIRouter(prefix="/captures/{capture_id}/interpretations", tags=["interpretations"])
list_router = APIRouter(prefix="/interpretations", tags=["interpretations"])
fallback_interpreter = DeterministicCaptureInterpreter()


def get_capture_interpreter() -> CaptureInterpreter:
    return fallback_interpreter


@list_router.get("/confirmed", response_model=list[InterpretationResponse])
async def list_confirmed_interpretations_endpoint(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InterpretationResponse]:
    interpretations = await list_latest_confirmed_interpretations(session)
    return [
        InterpretationResponse.model_validate(interpretation)
        for interpretation in interpretations
    ]


@router.post("", response_model=InterpretationResponse, status_code=status.HTTP_201_CREATED)
async def create_interpretation_endpoint(
    capture_id: UUID,
    request: InterpretationCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    interpreter: Annotated[CaptureInterpreter, Depends(get_capture_interpreter)],
) -> InterpretationResponse:
    try:
        interpretation = await create_interpretation(
            session,
            capture_id=capture_id,
            reference_time=request.reference_time,
            time_zone=request.time_zone,
            interpreter=interpreter,
        )
    except CaptureNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND) from exc
    except InvalidInterpretationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The interpreter returned an invalid proposal.",
        ) from exc
    return InterpretationResponse.model_validate(interpretation)


@router.post(
    "/{interpretation_id}/confirm",
    response_model=InterpretationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_interpretation_endpoint(
    capture_id: UUID,
    interpretation_id: UUID,
    request: InterpretationConfirmation,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InterpretationResponse:
    try:
        interpretation = await confirm_interpretation(
            session,
            capture_id=capture_id,
            interpretation_id=interpretation_id,
            confirmation=request,
        )
    except (CaptureNotFoundError, InterpretationNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND) from exc
    except StaleInterpretationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A newer interpretation already exists.",
        ) from exc
    except InvalidInterpretationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    return InterpretationResponse.model_validate(interpretation)
