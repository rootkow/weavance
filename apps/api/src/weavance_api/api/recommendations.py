from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api.database import get_session
from weavance_api.schemas.recommendation import (
    EpisodeEventCreate,
    RecommendationCreate,
    RecommendationEpisodeResponse,
    RecommendationTransitionResponse,
)
from weavance_api.services.recommendations import (
    InvalidEpisodeTransitionError,
    NoEligibleActionError,
    RecommendationNotFoundError,
    create_recommendation,
    get_current_recommendation,
    record_episode_event,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/current", response_model=RecommendationEpisodeResponse | None)
async def get_current_recommendation_endpoint(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RecommendationEpisodeResponse | None:
    return await get_current_recommendation(session)


@router.post(
    "",
    response_model=RecommendationEpisodeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_recommendation_endpoint(
    request: RecommendationCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RecommendationEpisodeResponse:
    try:
        return await create_recommendation(session, context=request.context)
    except NoEligibleActionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active starting action is available",
        ) from exc


@router.post(
    "/{episode_id}/events",
    response_model=RecommendationTransitionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_episode_event_endpoint(
    episode_id: UUID,
    request: EpisodeEventCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RecommendationTransitionResponse:
    try:
        return await record_episode_event(
            session,
            episode_id=episode_id,
            request=request,
        )
    except RecommendationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND) from exc
    except InvalidEpisodeTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That response is not valid for the recommendation's current state",
        ) from exc
