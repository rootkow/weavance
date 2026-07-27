from datetime import datetime
from uuid import uuid4

from weavance_api.interpretation import (
    DerivationMethod,
    DeterministicCaptureInterpreter,
    EvidenceSource,
    InterpretationRequest,
)


async def test_fallback_interpreter_turns_visible_lines_into_editable_tasks() -> None:
    capture_id = uuid4()
    interpreter = DeterministicCaptureInterpreter()

    proposal = await interpreter.interpret(
        InterpretationRequest(
            capture_id=capture_id,
            raw_text="- Reply to the recruiter\n\n2. Schedule the dentist\n*   ",
            reference_time=datetime.fromisoformat("2026-07-27T10:00:00-04:00"),
            time_zone="America/Detroit",
        )
    )

    assert proposal.capture_id == capture_id
    assert proposal.interpreter.name == "line-based-fallback"
    assert [task.title for task in proposal.tasks] == [
        "Reply to the recruiter",
        "Schedule the dentist",
    ]
    assert proposal.tasks[0].actions[0].description == "Reply to the recruiter"
    assert proposal.tasks[0].provenance.evidence == "- Reply to the recruiter"
    assert proposal.tasks[0].provenance.evidence_source is EvidenceSource.USER_TEXT
    assert proposal.tasks[0].provenance.derivation is DerivationMethod.RULE
