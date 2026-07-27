import re
from uuid import uuid4

from weavance_api.interpretation.contract import (
    ActionProposal,
    DerivationMethod,
    EvidenceSource,
    InterpretationProposal,
    InterpretationRequest,
    InterpreterDescriptor,
    Provenance,
    TaskProposal,
)

LIST_PREFIX = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+")


class DeterministicCaptureInterpreter:
    """A deliberately modest fallback that treats each visible line as one task."""

    async def interpret(self, request: InterpretationRequest) -> InterpretationProposal:
        tasks = tuple(
            self._task_from_line(title, line)
            for title, line in self._task_lines(request)
        )

        return InterpretationProposal(
            capture_id=request.capture_id,
            interpreter=InterpreterDescriptor(
                name="line-based-fallback",
                version="1",
            ),
            tasks=tasks,
        )

    def _task_lines(self, request: InterpretationRequest) -> tuple[tuple[str, str], ...]:
        lines: list[tuple[str, str]] = []
        for line in request.raw_text.splitlines():
            title = LIST_PREFIX.sub("", line).strip()
            if title:
                lines.append((title, line))
        return tuple(lines)

    def _task_from_line(self, title: str, original_line: str) -> TaskProposal:
        provenance = Provenance(
            evidence_source=EvidenceSource.USER_TEXT,
            derivation=DerivationMethod.RULE,
            confidence=1.0,
            evidence=original_line.strip(),
        )
        return TaskProposal(
            id=uuid4(),
            title=title,
            provenance=provenance,
            actions=(
                ActionProposal(
                    id=uuid4(),
                    description=title,
                    provenance=provenance,
                ),
            ),
        )
