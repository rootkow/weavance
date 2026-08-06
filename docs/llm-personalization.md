# LLM and personalization principles

## Status

This document sets the high-level direction for using language models and adaptive personalization
in Weavance. It is intentionally a starting point for discussion, not a final architecture,
persistence model, provider choice, or implementation plan.

Later documents and architecture decisions will define the semantic safety mechanism, system
boundaries, evidence model, user controls, privacy rules, evaluation criteria, and delivery gates.

## Current state

Weavance does not currently call a live language model or learn durable preferences. The working
prototype uses:

- a provider-neutral [interpretation contract](interpretation-contract.md)
- a deterministic line-based interpreter
- user review before proposed tasks and actions become canonical state
- a deterministic recommendation strategy
- persisted bounded recommendation episodes, explicit responses, reported outcomes, and re-entry
  checkpoints

The current UI does not yet collect useful recommendation context such as available time or an
easier-work request. The application also does not yet classify the semantic risk of captures,
edits, checkpoints, or strategy output.

## Product intent

A model should help where language, ambiguity, and subjective judgment make rigid rules less
useful. It may help Weavance understand what the user meant, suggest a manageable starting point,
or make returning to interrupted work easier.

Over time, Weavance may adapt to what the user explicitly says, corrects, and reports. That
adaptation should feel like accumulated understanding rather than hidden profiling. The user
should be able to see what influences a suggestion and remain able to correct or override it.

The objective is not to maximize task completion, recommendation acceptance, time in the
application, or engagement. It is to help the user begin a useful bounded commitment and find a
manageable way back while preserving their authority.

## Guiding principles

### The user remains authoritative

Current instructions, explicit corrections, and deliberate task state have more authority than
model output or learned patterns. A model may propose; it does not silently decide. User authority
does not override semantic safety or deterministic application invariants.

### Inference remains a proposal

Interpretations, estimates, decompositions, and recommendations must preserve uncertainty and
provenance. Plausible language is not evidence that a suggestion is correct.

### Safety belongs to the application

Semantic risk exists even in the deterministic prototype because user text can be presented as an
ordinary task or recommendation without understanding its meaning. Provider guardrails may help,
but they cannot be the only safety boundary. Before live model output or wider deployment, the
application needs an explicit, evaluated safety design that also covers deterministic and fallback
paths.

### Important behavior stays bounded

Deterministic policy continues to enforce lifecycle state, eligibility, explicit boundaries, and
application invariants. Every recommendation remains one limited commitment with a clear entry
point, stopping condition, and concise reason.

### Learning stays inspectable and revisable

Initial personalization should use structured knowledge, not hidden fine-tuning on one user's
history. Explicit preferences, episode-specific reports, and tentative learned patterns remain
distinguishable. Tentative patterns must be scoped, correctable, and lower authority than current
user intent.

### Silence remains unknown

No response does not mean success, failure, avoidance, low motivation, or any other behavioral or
mental-state signal. Personalization uses explicit evidence rather than filling in missing events.

### Context is selected, not accumulated by default

A strategy should receive only the information relevant to its current job. Historical or
sensitive context is not exposed merely because it exists.

### Degraded behavior preserves ownership

The product should remain useful when a provider is unavailable. A deterministic fallback may be
more modest, but raw captures and canonical state remain accessible and model failure does not
silently discard user-owned information.

### Evaluation follows product boundaries

A suggestion is not successful merely because it was accepted or sounds convincing. Evaluation
must consider fidelity, policy adherence, boundedness, safety, honest explanations, and explicit
user-reported outcomes.

## Appropriate model roles

At a high level, a model may eventually help Weavance:

- interpret an unstructured capture as editable task and action proposals
- suggest a decomposition when a task is too vague or large to begin
- propose one bounded recommendation from policy-eligible actions and explicit context
- turn a user-authored checkpoint into a manageable re-entry suggestion
- ask one focused question when the answer would materially change the next step

These roles remain behind typed, provider-neutral boundaries. They do not make the model the source
of truth for canonical state or application policy.

## Responsibilities a model does not receive

No model or recommendation strategy should:

- silently create, complete, archive, defer, or delete canonical work
- infer that work started or finished from acceptance, elapsed time, or silence
- invent deadlines, dependencies, preferences, personal facts, or mental states and present them as
  known
- provide instructions that facilitate harm or present itself as medical, mental-health, legal,
  financial, or emergency guidance
- autonomously control a calendar or schedule
- bypass deterministic policy because its output sounds reasonable
- turn a tentative behavior pattern into a permanent user trait
- receive unrelated historical or sensitive context

## Personalization at a glance

The intended direction distinguishes three kinds of information:

1. **Explicit facts and preferences** stated or confirmed by the user
2. **Episode evidence** describing a particular response or reported outcome
3. **Learned hypotheses** derived from repeated, relevant observations

Within safety and policy boundaries, current explicit intent wins when these conflict. A learned
hypothesis is a conservative input to a decision, not a diagnosis or durable truth about the user.
Later work will define evidence precedence, confidence, scope, contradiction, decay, confirmation,
and deletion in detail.

## Staged direction

The broad sequence is:

1. Collect meaningful explicit recommendation context.
2. Define and evaluate an application-owned semantic safety boundary.
3. Add one model-assisted interpretation strategy behind the existing contract.
4. Add model-assisted recommendation without cross-session learning.
5. Add user-managed explicit preferences.
6. Introduce conservative learned hypotheses with inspection and correction controls.
7. Compare strategies against explicit product and safety criteria.

Each stage should receive its own focused design discussion before implementation.

## Deferred detail

Follow-up documents and decisions will answer:

- What exact semantic safety classifications and checkpoints are required?
- How do model-assisted strategies fit into the request and persistence paths?
- What evidence may form a learned hypothesis, and how is authority resolved?
- What can the user inspect, confirm, correct, disable, export, or delete?
- What provider, retention, and context-minimization rules apply?
- What tests and measurements are required before a strategy is promoted?
