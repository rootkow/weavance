# ADR 0007: Separate AI trust boundaries

- Status: Accepted
- Date: 2026-08-03
- Amended: 2026-08-08

## Context

Weavance handles several kinds of information and behavior that carry different risks. A raw
capture is user-owned source material. Sending selected context to a model provider is a disclosure.
An interpretation or recommendation is application behavior. A durable preference or learned
hypothesis can influence future decisions.

The original version of this decision treated all four as one semantic-safety gate. That would
content-moderate user-owned storage, make ordinary task editing depend on a classifier, and mix
privacy, generated-behavior safety, and personalization policy. It also implied that Weavance must
provide crisis-response infrastructure. Those are different product responsibilities and should
not share one allow-or-reject decision.

Provider guardrails may reduce risk, but they vary across providers and versions. They also do not
cover deterministic or fallback behavior. Application policy therefore remains authoritative at
each boundary that produces application behavior or changes how data is used.

## Decision

Weavance will implement four distinct, application-owned trust boundaries.

### 1. User-owned storage

Raw captures, user-authored tasks, edits, context, and re-entry notes are user-owned records. The
application preserves them subject to ordinary structural validation, access control, retention,
and user-directed deletion. Sensitive, high-stakes, or distressing content is not rejected merely
because the user chose to record it.

Storing “call my oncologist,” for example, does not authorize Weavance to infer a diagnosis, offer
medical advice, or learn a health-related trait. Storage is not endorsement, personalization, or
permission to disclose the content to a provider.

### 2. Provider egress and context selection

Before any hosted model call, the application selects the minimum context needed for the specific
job and records why each category is eligible. Unrelated history and sensitive context are not sent
merely because they exist. Provider choice must include explicit decisions about data use,
retention, deletion, regional handling where relevant, and degraded behavior.

The exact user-owned source remains available even when a provider call is refused, unavailable,
or limited. Local and deterministic strategies do not cross a provider boundary, but they remain
subject to the behavior boundaries below.

### 3. Generated behavior and application action

Model-generated interpretations, decompositions, questions, explanations, and recommendations
must pass typed validation, reference validation, deterministic policy, and an evaluated
generated-behavior safety policy before they are presented or acted upon. The same policy applies
when deterministic or fallback logic transforms, elaborates on, or selectively recommends
user-authored content.

The boundary governs what Weavance does, not what the user may store. It may refuse or constrain a
generated transformation while preserving the source record and the user's ability to edit their
own canonical work. A final reviewed proposal is checked for structure, references, and provenance;
it is not rejected solely because user-authored text concerns a sensitive or high-stakes topic.

Weavance provides planning and activation support. It must not generate instructions that
facilitate harm or present itself as medical, mental-health, legal, financial, or emergency
guidance. It does not claim to be a crisis-intervention service. Any support or escalation
experience would be a separate, deliberately scoped product decision with its own maintenance and
evaluation obligations.

### 4. Personalization eligibility

Information does not become a preference or learned hypothesis merely because it was stored,
included in a model call, or mentioned repeatedly. A separate eligibility decision must consider
source, purpose, sensitivity, confidence, scope, contradiction, and user control before information
may influence future sessions.

Sensitive or high-stakes content and possible crisis signals are not automatically durable traits.
Explicit user intent remains higher authority than learned patterns. The user must be able to
inspect, correct, disable, and delete durable personalization before cross-session learning is
enabled.

Personalization belongs to the Weavance application, not to a model provider. Durable preferences,
evidence, and hypotheses remain typed application-owned state. A replaceable model may receive a
small, eligible context selection at inference time; provider-side memory or hidden fine-tuning on
a user's history is not the personalization architecture.

### Traceability and retention

Operational logs exclude user-authored and model-generated content by default. Product history
stores the provenance and safe decision metadata needed to explain behavior. Model-assisted paths
record provider, model, strategy, schema, and prompt-template identifiers or hashes when useful for
evaluation; this does not require retaining raw prompts or provider responses indefinitely.

Any retention of raw request or response artifacts requires a later explicit decision covering
purpose, access, duration, deletion, and sensitive-data handling.

Before a live provider-backed path is enabled, focused implementation decisions and tests must
cover its provider-egress rules, generated-behavior policy, validation, failure handling, and
evaluation criteria. Before cross-session personalization is enabled, its eligibility rules and
user controls must be implemented and evaluated separately.

## Consequences

- User-owned text remains available even when Weavance cannot safely transform or recommend it.
- Privacy review, generated-behavior safety, and personalization admission receive separate tests
  and failure behavior instead of one broad classifier result.
- Provider changes cannot silently expand the context sent or weaken application policy.
- Deterministic and fallback strategies are evaluated when they generate, transform, or recommend
  behavior, but ordinary storage does not require semantic classification.
- Sensitive content cannot silently become a durable user trait.
- Weavance avoids high-stakes guidance without claiming a crisis-response capability.
- Raw prompts and provider responses are not retained by default for hypothetical future replay.
