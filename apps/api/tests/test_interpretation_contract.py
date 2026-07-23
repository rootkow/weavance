from datetime import date, datetime
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from weavance_api.interpretation import (
    ActionProposal,
    CaptureInterpreter,
    DeadlineObservation,
    DerivationMethod,
    DurationEstimate,
    EvidenceSource,
    ImportanceEstimate,
    InterpretationProposal,
    InterpretationRequest,
    InterpreterDescriptor,
    Provenance,
    TaskProposal,
)


class FakeInterpreter:
    def __init__(self, proposal: InterpretationProposal) -> None:
        self.proposal = proposal
        self.requests: list[InterpretationRequest] = []

    async def interpret(self, request: InterpretationRequest) -> InterpretationProposal:
        self.requests.append(request)
        return self.proposal


def user_text_provenance(evidence: str) -> Provenance:
    return Provenance(
        evidence_source=EvidenceSource.USER_TEXT,
        derivation=DerivationMethod.MODEL,
        confidence=0.96,
        evidence=evidence,
    )


def create_proposal(capture_id: UUID) -> InterpretationProposal:
    provenance = user_text_provenance("Renew my license before Friday")
    return InterpretationProposal(
        capture_id=capture_id,
        interpreter=InterpreterDescriptor(name="fake", version="1"),
        tasks=(
            TaskProposal(
                id=uuid4(),
                title="Renew my license",
                provenance=provenance,
                deadline=DeadlineObservation(
                    date=date(2026, 7, 24),
                    time_zone="America/Detroit",
                    provenance=provenance,
                ),
                importance=ImportanceEstimate(level="high", provenance=provenance),
                actions=(
                    ActionProposal(
                        id=uuid4(),
                        description="Open the renewal website and check the required information",
                        provenance=provenance,
                        duration=DurationEstimate(
                            minimum_minutes=5,
                            maximum_minutes=10,
                            provenance=Provenance(
                                evidence_source=EvidenceSource.GENERAL_KNOWLEDGE,
                                derivation=DerivationMethod.MODEL,
                                confidence=0.45,
                            ),
                        ),
                    ),
                ),
            ),
        ),
    )


async def run_interpreter(
    interpreter: CaptureInterpreter,
    request: InterpretationRequest,
) -> InterpretationProposal:
    return await interpreter.interpret(request)


async def test_fake_interpreter_satisfies_provider_neutral_contract() -> None:
    capture_id = uuid4()
    request = InterpretationRequest(
        capture_id=capture_id,
        raw_text="Renew my license before Friday",
        reference_time=datetime.fromisoformat("2026-07-23T09:00:00-04:00"),
        time_zone="America/Detroit",
    )
    fake = FakeInterpreter(create_proposal(capture_id))

    result = await run_interpreter(fake, request)

    assert result.capture_id == request.capture_id
    assert result.tasks[0].actions[0].duration is not None
    assert result.tasks[0].actions[0].duration.minimum_minutes == 5
    assert fake.requests == [request]


def test_unknown_subjective_values_are_omitted() -> None:
    capture_id = uuid4()
    provenance = user_text_provenance("Clean the kitchen")

    proposal = InterpretationProposal(
        capture_id=capture_id,
        interpreter=InterpreterDescriptor(name="fake", version="1"),
        tasks=(
            TaskProposal(
                id=uuid4(),
                title="Clean the kitchen",
                provenance=provenance,
                actions=(
                    ActionProposal(
                        id=uuid4(),
                        description="Put one item away",
                        provenance=provenance,
                    ),
                ),
            ),
        ),
    )

    task = proposal.tasks[0]
    assert task.deadline is None
    assert task.importance is None
    assert task.actions[0].duration is None


def test_contract_rejects_invalid_duration_range() -> None:
    with pytest.raises(ValidationError, match="maximum_minutes must be greater"):
        DurationEstimate(
            minimum_minutes=20,
            maximum_minutes=10,
            provenance=Provenance(
                evidence_source=EvidenceSource.DEFAULT,
                derivation=DerivationMethod.RULE,
                confidence=0.2,
            ),
        )


def test_contract_rejects_provider_specific_fields() -> None:
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        InterpreterDescriptor.model_validate(
            {
                "name": "hosted-model",
                "version": "1",
                "openai_model": "provider-specific-value",
            }
        )


def test_contract_rejects_naive_reference_time() -> None:
    with pytest.raises(ValidationError, match="must include a UTC offset"):
        InterpretationRequest(
            capture_id=uuid4(),
            raw_text="Send the form tomorrow",
            reference_time=datetime(2026, 7, 23, 9, 0),
            time_zone="America/Detroit",
        )


def test_contract_rejects_duplicate_action_ids() -> None:
    capture_id = uuid4()
    duplicate_action_id = uuid4()
    provenance = user_text_provenance("Call the dentist\nEmail the recruiter")

    with pytest.raises(ValidationError, match="action proposal IDs must be unique"):
        InterpretationProposal(
            capture_id=capture_id,
            interpreter=InterpreterDescriptor(name="fake", version="1"),
            tasks=(
                TaskProposal(
                    id=uuid4(),
                    title="Call the dentist",
                    provenance=provenance,
                    actions=(
                        ActionProposal(
                            id=duplicate_action_id,
                            description="Find the dentist's phone number",
                            provenance=provenance,
                        ),
                    ),
                ),
                TaskProposal(
                    id=uuid4(),
                    title="Email the recruiter",
                    provenance=provenance,
                    actions=(
                        ActionProposal(
                            id=duplicate_action_id,
                            description="Open the recruiter's last message",
                            provenance=provenance,
                        ),
                    ),
                ),
            ),
        )
