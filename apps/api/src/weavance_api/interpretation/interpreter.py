from typing import Protocol

from weavance_api.interpretation.contract import (
    InterpretationProposal,
    InterpretationRequest,
)


class CaptureInterpreter(Protocol):
    async def interpret(self, request: InterpretationRequest) -> InterpretationProposal: ...
