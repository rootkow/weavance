# ADR 0002: Separate model interpretation from deterministic planning

- Status: Superseded by [ADR 0003](0003-inference-policy-and-recommendation.md)
- Date: 2026-07-22

## Decision

Models may interpret brain dumps, propose task structure, and suggest startable actions. A deterministic planner applies user boundaries, capacity limits, fixed commitments, and selection rules. Model output is always validated against a typed schema.

## Rationale

The model is valuable precisely where language and ambiguity matter. Scheduling constraints, user consent, and repeatable behavior benefit from testable deterministic code. This boundary also permits a stub interpreter and multiple future model providers.

## Consequences

- The planner must work without a live model.
- Recommendations retain both structured reasons and user-facing explanations.
- Model prompts and providers can evolve without becoming the source of truth for scheduling state.

## Superseding context

This decision correctly separated model output from authoritative state, but assigned subjective
selection rules to a single deterministic planner. ADR 0003 refines that boundary by separating
uncertain inference, deterministic policy, and replaceable recommendation strategies.
