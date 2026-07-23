# Interpretation contract

The interpretation contract is the provider-neutral boundary between a raw `Capture` and proposed
tasks and actions. An interpreter can be backed by a hosted model, a local model, a deterministic
fallback, or a test fake while the rest of the application consumes the same contract.

## Input

`InterpretationRequest` contains:

- The immutable capture ID and original text
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
- Reference timestamps must be timezone-aware and time zones must be valid IANA names.
- Duration estimates use positive ranges ordered from minimum to maximum.
- Task and action proposal IDs are unique within an interpretation.
- Task titles and action descriptions must contain visible text.

These guarantees describe contract structure. Future policy and user corrections determine which
proposals become authoritative application state.
