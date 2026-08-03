# Interpretation contract

The interpretation contract is the provider-neutral boundary between a raw `Capture` and proposed
tasks and actions. An interpreter can be backed by a hosted model, a local model, a deterministic
fallback, or a test fake while the rest of the application consumes the same contract.

The immutable Pydantic models and `CaptureInterpreter` protocol are implemented and tested. The
runtime orchestration invokes a deliberately modest line-based fallback through that protocol,
validates its proposal, and stores every interpretation version in PostgreSQL. A future hosted or
local model can replace the fallback without changing the orchestration boundary.

## Input

`InterpretationRequest` contains:

- The immutable capture ID and exact original text, up to 50,000 characters
- A timezone-aware reference timestamp for resolving relative phrases such as “tomorrow”
- The user's IANA time zone for interpreting local dates and times

Explicit context and recommendation state are handled after this request. Interpretation describes
what the capture appears to contain; recommendation later decides what is useful to show.

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

## Orchestration behavior

The orchestration layer:

- constructs the request from the persisted `Capture` without changing its text
- verifies that the returned proposal references the requested capture
- validates the complete proposal before persistence
- appends a new versioned interpretation instead of overwriting an earlier proposal
- preserves the request time zone and reference time alongside interpreter and schema information
- serializes version assignment per capture so concurrent requests cannot claim the same version

The structured review writes user edits as a new confirmed version. Changed and newly added fields
carry direct user-correction provenance; unchanged values retain their original provenance. Removed
tasks remain visible in the earlier proposal rather than being deleted from history.
