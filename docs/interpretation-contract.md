# Interpretation contract

The interpretation contract is the provider-neutral boundary between a raw `Capture` and proposed
tasks and actions. An interpreter can be backed by a hosted model, a local model, a deterministic
fallback, or a test fake without changing the rest of the application.

## Input

`InterpretationRequest` contains:

- The immutable capture ID and original text
- A timezone-aware reference timestamp for resolving relative phrases such as “tomorrow”
- The user's IANA time zone for interpreting local dates and times

Capacity and recommendation state do not belong in this request. Interpretation describes what the
capture appears to contain; recommendation later decides what is useful to show.

## Output

`InterpretationProposal` contains:

- A contract schema version
- The capture it was derived from
- The interpreter name and implementation version
- Zero or more proposed tasks
- One or more startable action proposals for every proposed task
- Optional deadline observations, duration estimates, and importance estimates

Zero tasks is valid when the capture contains no actionable work. Subjective or missing values stay
absent rather than receiving invented defaults.

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
- Unknown fields are rejected, preventing provider-specific response data from leaking inward.
- Reference timestamps must be timezone-aware and time zones must be valid IANA names.
- Duration estimates are positive ranges whose maximum cannot precede their minimum.
- Task and action proposal IDs are unique within an interpretation.
- Blank task titles and action descriptions are rejected.

These are structural guarantees, not claims that inferred values are objectively correct. Future
policy and user corrections decide which proposals may become authoritative application state.
