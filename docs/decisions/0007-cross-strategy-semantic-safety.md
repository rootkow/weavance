# ADR 0007: Apply semantic safety across capture and recommendation strategies

- Status: Accepted
- Date: 2026-08-03

## Context

Weavance accepts unstructured text from a user who may be overwhelmed, low on energy, interrupted,
or unsure where to begin. Semantic risk therefore exists before a live model is introduced. The
current deterministic interpreter copies each nonblank capture line into an editable task and
starting-action proposal without classifying its meaning. It does not elaborate on the source text,
but it can present distressing, harmful, or high-stakes content as an ordinary task.

Existing deterministic policy validates lifecycle state, eligibility, references, explicit
boundaries, and other application invariants. Those checks do not evaluate the ethical meaning of
capture content or strategy output. User review prevents an interpretation from silently becoming
canonical state, but review is not itself a semantic safety mechanism.

Hosted model guardrails may reduce some risk, but they differ across providers and versions. Local
models may have weaker or no equivalent guardrails. Treating safety as a provider feature would
also leave deterministic and fallback paths outside the boundary.

## Decision

Weavance will treat semantic safety as an application-owned boundary across the capture,
interpretation, recommendation, re-entry, and personalization workflow. It is not specific to an
LLM provider.

Every capture-derived proposal and recommendation must pass this boundary before it becomes
user-visible strategy output or contributes a learning signal. The boundary applies to
deterministic, hosted-model, local-model, hybrid, and fallback strategies. Provider guardrails are
defense in depth and never replace application policy.

The application will persist the complete raw capture unchanged before semantic safety evaluation.
A safety rejection will not delete or discard that user-owned source record. Evaluation will use
the full capture as context while assigning a disposition to the smallest reliable source unit. In
a mixed capture, allowed units will continue through interpretation; rejected units will not become
tasks, actions, recommendations, or learning signals. A safety response may take display priority,
but allowed proposals from the same capture will remain available rather than being silently lost.
The user will be told when content was not converted and will retain control over later deletion.

The semantic safety boundary is evaluated before user instructions, current context, confirmed
preferences, learned hypotheses, or strategy scores can affect a decision. Those inputs cannot
override the boundary. Content must not be converted into prohibited assistance merely because it
is structurally valid or explicitly requested.

When a boundary is reached, the application will avoid presenting the content as an ordinary task
proposal or recommendation. It will use a bounded, non-diagnostic response and provide an
appropriate path to human or emergency support when relevant. The event must not silently become a
durable trait or personalization signal.

Before the boundary is implemented, a separate implementation decision must define the exact
classifications, source-unit segmentation, response and escalation behavior, enforcement
mechanism, retention duration and deletion controls, and adversarial regression suite. The
mechanism must preserve raw-capture ownership and traceability without placing sensitive
user-authored content in routine operational logs.

No live model output and no public or unattended deployment should be enabled before the boundary
is implemented and evaluated. The existing personal deterministic prototype must document that it
does not yet satisfy this decision.

## Consequences

- The current deterministic path is explicitly recognized as having semantic exposure even though
  it does not generate new language.
- Availability fallback and semantic safety remain separate concerns; falling back to deterministic
  behavior does not bypass safety evaluation.
- Provider or model changes cannot weaken the application boundary without an explicit decision.
- Safety tests must cover deterministic, hosted, local, hybrid, and fallback behavior.
- Harmful, crisis-related, and high-stakes input cannot be treated as ordinary personalization
  evidence.
- A mixed capture cannot lose its allowed portions merely because another portion reaches the
  safety boundary.
- Implementation requires product decisions for safe responses, escalation, privacy, retention,
  observability, and failure behavior before enforcement can be claimed.
