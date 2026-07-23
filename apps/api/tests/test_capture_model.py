from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from weavance_api.models import Capture


async def test_capture_round_trip(test_database_url: str) -> None:
    engine = create_async_engine(test_database_url)
    test_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with test_session_factory.begin() as session:
        capture = Capture(raw_text="Renew my license before Friday")
        session.add(capture)

    async with test_session_factory() as session:
        stored_capture = await session.scalar(
            select(Capture).where(Capture.id == capture.id)
        )

    await engine.dispose()

    assert stored_capture is not None
    assert stored_capture.raw_text == "Renew my license before Friday"
    assert stored_capture.created_at is not None
