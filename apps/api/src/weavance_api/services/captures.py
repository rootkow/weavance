from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api.models import Capture
from weavance_api.observability import get_logger

logger = get_logger(__name__)


async def create_capture(session: AsyncSession, *, raw_text: str) -> Capture:
    capture = Capture(raw_text=raw_text)
    session.add(capture)

    try:
        await session.commit()
        await session.refresh(capture)
    except SQLAlchemyError:
        await session.rollback()
        logger.exception(
            "capture.create.failed",
            character_count=len(raw_text),
        )
        raise

    logger.info(
        "capture.created",
        capture_id=capture.id,
        character_count=len(raw_text),
    )
    return capture
