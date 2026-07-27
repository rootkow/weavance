# Interpretation contract

The interpretation contract is the provider-neutral boundary between a raw `Capture` and proposed
tasks and actions. An interpreter can be backed by a hosted model, a local model, a deterministic
fallback, or a test fake while the rest of the application consumes the same contract.

The immutable Pydantic models and `CaptureInterpreter` protocol are implemented and tested. The
capture endpoint does not invoke an interpreter yet, and interpretation proposals are not yet
persisted or exposed through the API.

## Input

`InterpretationRequest` contains:

- The immutable capture ID and exact original text, up to 50,000 characters
- A timezone-aware reference timestamp for resolving relative phrases such as “tomorrow”
- The user's IANA time zone for interpreting local dates and times

Capacity and recommendation state are handled after this request. Interpretation describes what
the capture appears to contain; recommendation later decides what is useful to show.

## Output

`InterpretationProposal` contains:

- A contract schema version
- The capture it was derived from
- The interpreter name and implementation version
- Zero or more proposed tasks
- One or more startable action proposals for every proposed task
- Optional deadline observations, duration estimates, and importance estimates

Zero tasks is valid when the capture contains no actionable work. Optional fields keep subjective
or unknown values explicit.

## Provenance

Provenance records two separate questions:

1. **Where did the evidence come from?** User text, a user correction, a connected source, observed
   behavior, general knowledge, or a default.
2. **How was the value derived?** Directly, by a model, by a rule, or from learned behavior.

Every provenance record also carries confidence and may carry a short evidence excerpt. Separating
the evidence source from the derivation method avoids ambiguous labels such as `source=model`: a
model may derive one value from the user's text and another from general knowledge, and those
values should not be treated equally.

## Validation guarantees

- Contract objects are immutable after validation.
- Unknown fields produce validation errors, keeping the contract provider-neutral.
- Capture text must contain visible text, is limited to 50,000 characters, and is not normalized.
- Reference timestamps must be timezone-aware, and their UTC offsets must match the supplied IANA
  time zone at that instant.
- Deadline time zones must be valid IANA names; optional local times must not carry their own time
  zone.
- Confidence values range from 0 through 1.
- Duration estimates use positive ranges ordered from minimum to maximum.
- Task and action proposal IDs are unique within an interpretation.
- Task titles and action descriptions must contain visible text.

These guarantees describe contract structure. Future policy and user corrections determine which
proposals become authoritative application state.

## Orchestration responsibilities

The future orchestration layer must:

- construct the request from the persisted `Capture` without changing its text
- verify that the returned proposal references the requested capture
- validate the complete proposal before persistence
- append a new versioned interpretation instead of overwriting an earlier proposal
- preserve enough interpreter and schema information to explain and replay the result
