from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api.database import get_session
from weavance_api.schemas.capture import CaptureCreate, CaptureResponse
from weavance_api.services.captures import create_capture

router = APIRouter(prefix="/captures", tags=["captures"])


@router.post("", response_model=CaptureResponse, status_code=status.HTTP_201_CREATED)
async def create_capture_endpoint(
    request: CaptureCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CaptureResponse:
    capture = await create_capture(session, raw_text=request.raw_text)
    return CaptureResponse.model_validate(capture)
