# ADR 0003: Separate uncertain inference, deterministic policy, and recommendation

- Status: Accepted
- Date: 2026-07-23
- Supersedes: [ADR 0002](0002-bounded-ai.md)

## Context

Task boundaries, urgency, duration, difficulty, and a person's current capacity are not universally
objective. Treating them as deterministic values would create false confidence and make later model
integration harder. At the same time, explicit user intent and application invariants must remain
predictable and testable.

## Decision

Weavance separates three responsibilities:

1. A pluggable interpreter proposes observations, estimates, tasks, and startable actions through a
   provider-neutral typed contract.
2. Deterministic policy enforces application state, explicit user intent, and eligibility rules.
3. A pluggable recommendation strategy selects among eligible actions, after which policy validates
   the result.

Interpretation values record their provenance and uncertainty. Unknown values remain unknown.
Explicit user corrections override inferred values.

The intended product experience may use an LLM for subjective interpretation. The first contract
will also support a fake implementation for tests and a deliberately modest deterministic fallback;
neither test infrastructure nor fallback behavior defines the product's future intelligence.

No model-provider SDK, speculative prompt, embedding store, or model-specific persistence field is
added before the typed contract exists.

## Consequences

- Model providers and recommendation strategies can evolve independently.
- Deterministic code does not claim to know subjective facts.
- Policy remains replayable and scenario-testable.
- Every recommendation records the strategy and version that produced it.
- The raw capture is preserved so future interpreters can create new versioned proposals.
- Some useful behavior will require model access, while tests and degraded operation remain possible
  without it.
