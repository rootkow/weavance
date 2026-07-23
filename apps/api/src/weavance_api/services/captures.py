from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from weavance_api.models import Capture


async def create_capture(session: AsyncSession, *, raw_text: str) -> Capture:
    capture = Capture(raw_text=raw_text)
    session.add(capture)

    try:
        await session.commit()
        await session.refresh(capture)
    except SQLAlchemyError:
        await session.rollback()
        raise

    return capture
