# Model-assisted workflows

## Status

This document describes where a language model may participate in Weavance workflows and which
application layers remain authoritative. It expands the
[LLM and personalization principles](llm-personalization.md) without choosing a provider, prompt,
model, or personalization design.

The interpretation protocol and deterministic fallback are implemented. Recommendation episodes
and a versioned deterministic selection strategy are also implemented, but a separate pluggable
recommendation-strategy interface does not exist yet. The distinct provider-egress,
generated-behavior, and personalization boundaries are accepted in
[ADR 0007](decisions/0007-cross-strategy-semantic-safety.md) but are not implemented.

## Responsibility split

Model integration does not collapse interpretation, policy, and recommendation into one agent.
[ADR 0003](decisions/0003-inference-policy-and-recommendation.md) keeps them separate:

| Layer | Responsibility | Current state |
|---|---|---|
| Interpretation strategy | Propose structured meaning from a capture | Provider-neutral protocol and deterministic implementation exist |
| Deterministic policy | Enforce state, user boundaries, eligibility, and references | Implemented |
| Recommendation strategy | Select among eligible actions and propose one bounded commitment | Versioned deterministic implementation exists; pluggable interface is future work |
| Provider egress | Minimize and govern context sent outside the application | Accepted; no live provider path exists |
| Generated-behavior safety | Constrain application-generated transformations and recommendations | Accepted; not implemented |
| Personalization eligibility | Admit only appropriate evidence into durable application-owned knowledge | Accepted; no durable personalization exists |
| User review | Correct or reject proposed task and action meaning | Implemented for tasks and first actions |

A model may contribute to an interpretation or recommendation strategy. It does not replace
deterministic policy, the applicable trust boundaries, or explicit user review.

## Capture interpretation

The target interpretation path is:

1. Preserve the exact raw capture as the user-owned source record.
2. Select the minimum source units and context eligible for the chosen interpreter; apply provider
   data rules before any hosted call.
3. Send that selection, reference time, and time zone to a `CaptureInterpreter`.
4. Validate the complete response against the provider-neutral `InterpretationProposal` schema.
5. Apply generated-behavior safety and deterministic application policy.
6. Persist and display the allowed proposal for structured user review.
7. Validate the final reviewed proposal's structure, references, and provenance after additions or
   edits.
8. Materialize confirmed tasks and actions after validation.

Steps 1, 3, 4, 6, 7, and 8 exist today with the deterministic interpreter. That path does not cross
a provider boundary. A future hosted or local model can implement `CaptureInterpreter` without
changing the orchestration or canonical task model, but a hosted implementation also needs a
separately approved data-handling design.

Model-assisted interpretation may propose:

- concise task boundaries and titles
- concrete starting actions
- deadline observations
- duration ranges
- dependencies or ambiguity worth reviewing

Every inferred value retains provenance and uncertainty. A proposal does not become authoritative
merely because it is structurally valid or confidently worded.

## Task decomposition

A model may suggest smaller tasks or actions when existing work is too vague or large to begin. It
must not invent requirements, priorities, dependencies, or completion criteria merely to produce a
plausible plan.

The original task and its provenance remain intact. A decomposition remains editable until the
user confirms it. When useful decomposition depends on missing project context, the strategy should
ask one focused question or propose a bounded discovery action rather than generate speculative
busywork.

Whether decomposition creates child tasks, actions, or either depending on the work remains a
separate domain-model decision.

## Bounded recommendation

Recommendation starts after deterministic policy removes inactive, archived, deferred, or
otherwise ineligible tasks and actions. A future model-assisted strategy may receive:

- only the policy-eligible canonical task and action references
- the current explicit context snapshot
- later, confirmed preferences and relevant safety-eligible evidence

It may propose one commitment containing:

- one supplied canonical task and action reference
- a concrete entry point
- a timebox or other clear stopping condition
- a concise explanation grounded in factors actually used
- strategy and schema version information

The model cannot create a new canonical reference or restore an ineligible one. Its complete output
must pass a provider-neutral proposal schema, the generated-behavior safety boundary, and
deterministic policy validation before it becomes a persisted `RecommendationEpisode`.

The current episode schema and lifecycle are documented in the
[recommendation contract](recommendation-contract.md). Before adding a model-assisted recommender,
Weavance needs a provider-neutral strategy interface and proposal type separate from the persisted
episode model.

## Re-entry after interruption

A user-authored re-entry checkpoint records where the user wants to resume. A model may propose a
smaller or clearer entry point for the same canonical task and action, but it must preserve the
source checkpoint and must not infer an interruption, outcome, or next step from silence.

The resulting suggestion follows the same rules as any other recommendation: generated-behavior
safety, typed validation, deterministic policy validation, one bounded episode, and explicit user
response. If a model is unavailable, the existing deterministic path may offer the allowed
checkpoint text directly.

## Focused questions

A model may ask one focused question when the answer would materially change the interpretation or
recommendation. It should make a bounded best-effort proposal when the uncertainty is minor so that
clarification does not become another planning burden.

Question persistence, response schemas, and UI behavior are not designed yet. A question does not
silently mutate canonical state or become durable personalization evidence.

## Validation and traceability

Every model-assisted workflow must:

- reject unknown response fields and invalid canonical references
- validate the entire response before persistence or display
- preserve source provenance and distinguish model derivation from evidence source
- record strategy, provider, model, schema, and prompt-template identifiers or hashes needed to
  evaluate and explain behavior
- keep provider-specific fields out of core domain contracts
- explain a recommendation using only factors that actually affected the decision

Raw prompts and provider responses are not retained by default. Retaining them requires an explicit
purpose, access policy, duration, deletion behavior, and sensitive-data treatment. Safe decision
metadata and version identifiers should support routine traceability without creating an
indefinite archive of user content.

## Reliability and degraded behavior

Provider calls should use explicit timeouts, bounded retries, and failure classification. An
unavailable provider, malformed response, or failed validation must not discard a raw capture or
partially apply canonical state.

Operational failure may fall back to the existing deterministic interpretation or recommendation
behavior. The fallback is intentionally modest and remains subject to generated-behavior policy
when it transforms or recommends content; deterministic output is not presumed safe merely because
it does not generate new language.

## Deferred decisions

This workflow boundary does not decide:

- the first hosted or local model and provider
- prompt design or provider SDK integration
- the generated-behavior classifications or enforcement mechanism
- provider data handling, retention, and context-selection rules
- the personalization evidence model and precedence rules
- user-facing controls for learned knowledge and provider data
- strategy evaluation datasets, thresholds, or promotion gates
- whether connected sources may supply additional context
