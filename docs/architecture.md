# Architecture

## Current implementation

| Boundary | Status |
|---|---|
| Capture UI and `POST /captures` | Implemented |
| Exact-text capture persistence in PostgreSQL | Implemented |
| Interpretation request, proposal models, and interpreter protocol | Implemented and tested in isolation |
| Interpretation orchestration and versioned proposal persistence | Implemented with a line-based fallback |
| Structured task and first-action review | Implemented; richer interpreted details remain read-only |
| Canonical task and action materialization | Implemented at confirmation, with migration backfill |
| Canonical task and action lifecycle | Implemented for listing, editing, completion, reopening, and archival |
| Secondary task-management UI | Implemented for task and first-action editing, completion, reopening, and archival |
| Bounded recommendation episodes | Implemented with a transparent deterministic strategy and persisted context/explanation snapshots |
| Pre-start responses and reported outcomes | Implemented as append-only episode events |
| Re-entry checkpoints | Implemented for optional checkpoint capture, prioritized selection, and traceable consumption |
| Application semantic safety boundary | Accepted in ADR 0007; not implemented across captures, reviewed or canonical edits, context, checkpoints, or strategy output |
| Raw capture and complete proposal-history UI | Not designed yet |

The current user-facing path saves a capture, creates a versioned interpretation, and lets the user
add, edit, or remove proposed tasks and starting actions. Confirmation atomically creates another
immutable interpretation version and materializes its reviewed tasks and actions as canonical
application state. Reinterpreting and reconfirming the same capture archives the prior canonical
projection without deleting its history. The application restores non-archived canonical tasks
when it loads, but the list stays hidden until the user explicitly opens it. The secondary list
supports editing the task and its first action along with completion, reopening, and archival.
When active work exists, startup restores an accepted commitment or presents one recommendation
instead of defaulting to capture. Confirmation also proceeds directly to a recommendation. Start,
resize, defer, swap, overwhelm, and outcome responses are stored as append-only evidence. UI
collection of richer context and a full history surface remain planned. Partial progress can save
one user-authored checkpoint, and the newest eligible checkpoint becomes the next bounded episode
before ordinary selection.

## Target system boundaries

```mermaid
flowchart TD
    UI["Focused UI"] --> API["Application API"]
    API --> STORE["Capture persistence"]
    STORE --> SAFETY_IN["Semantic safety boundary (input)"]
    SAFETY_IN -->|"Allowed"| INTERPRET["Interpretation strategy"]
    SAFETY_IN -->|"Boundary reached"| SAFE["Safe bounded response"]
    INTERPRET -->|"Valid"| PROPOSAL["Typed proposal"]
    PROPOSAL --> SAFETY_OUT["Semantic safety boundary (output)"]
    SAFETY_OUT -->|"Rejected"| SAFE
    SAFETY_OUT -->|"Allowed"| HISTORY["Versioned proposal history"]
    HISTORY --> REVIEW["User review and edits"]
    REVIEW --> SAFETY_CONFIRM["Semantic safety boundary (final proposal)"]
    SAFETY_CONFIRM -->|"Rejected"| SAFE
    SAFETY_CONFIRM -->|"Allowed"| CONFIRMED["Confirmed interpretation history"]
    CONFIRMED --> STATE["Canonical tasks and actions"]
    API --> CANONICAL_EDIT["Later task/action text edits"]
    CANONICAL_EDIT --> SAFETY_EDIT["Semantic safety boundary (canonical edit)"]
    SAFETY_EDIT -->|"Rejected"| SAFE
    SAFETY_EDIT -->|"Allowed"| STATE
    STATE --> POLICY["Deterministic policy"]
    API --> CONTEXT["Explicit recommendation context"]
    CONTEXT --> SAFETY_CONTEXT["Semantic safety boundary (context)"]
    SAFETY_CONTEXT -->|"Rejected"| SAFE
    SAFETY_CONTEXT -->|"Allowed"| POLICY
    POLICY --> RECOMMEND["Recommendation strategy"]
    RECOMMEND --> SAFETY_REC["Semantic safety boundary (output)"]
    SAFETY_REC -->|"Rejected"| SAFE
    SAFETY_REC -->|"Allowed"| VALIDATE["Policy validation"]
    VALIDATE -->|"Rejected"| NO_EPISODE["No episode; bounded error or retry"]
    VALIDATE -->|"Valid"| EPISODE["Bounded episode"]
    EPISODE --> EVENTS["Responses and outcomes"]
    EVENTS -->|"Optional partial-progress note"| SAFETY_REENTRY["Semantic safety boundary (checkpoint)"]
    SAFETY_REENTRY -->|"Rejected"| SAFE
    SAFETY_REENTRY -->|"Allowed"| REENTRY["Re-entry checkpoint"]
    REENTRY -->|"Newest eligible checkpoint"| POLICY
```

The interpretation layer converts free-form language and available context into structured
proposals. A model may suggest task boundaries, possible actions, urgency, duration, or
dependencies. These values remain uncertain proposals rather than application facts.
The current provider-neutral boundary is documented in the
[interpretation contract](interpretation-contract.md).

The target semantic safety boundary applies to the existing deterministic interpreter and to every
future hosted, local, hybrid, or fallback strategy. The current line-based interpreter does not
classify capture meaning, so user review and lifecycle validation are the only current checks before
materialization; neither is a semantic safety control. See
[ADR 0007](decisions/0007-cross-strategy-semantic-safety.md).

The raw capture is persisted unchanged before the target input checkpoint. A mixed capture is
evaluated with its full context, but allowed source units continue through interpretation even when
another unit reaches the safety boundary. Rejected units do not become canonical work or learning
signals, and the application does not silently discard the source capture or its allowed proposals.

Safety evaluation is repeated after structured review because the user can add or change proposal
text after strategy output was checked. The final reviewed proposal must pass before the confirmed
version and canonical tasks or actions are created. Later free-text task and action edits must also
pass before canonical state changes; a rejected edit leaves the prior canonical value unchanged.
Allowed items in a mixed final review remain available rather than being discarded with a rejected
item. User authorship does not bypass the boundary.

Explicit free-text recommendation context and re-entry checkpoints are input to later strategy and
personalization decisions, so they must pass the boundary before use. A rejected re-entry point is
not persisted as an active checkpoint, offered as a later recommendation, or admitted as learning
evidence. Any separate preservation of rejected user-authored text is governed by the future
retention and deletion policy rather than the checkpoint lifecycle.

The deterministic policy layer owns enforceable behavior: explicit deferrals, user boundaries,
dependency eligibility, completed or archived state, and the precedence of user corrections.
Subjective values such as task duration remain sourced estimates for the recommendation strategy
to consider.

The current recommendation strategy chooses among active task/action pairs using the episode's
explicit context snapshot. It prefers known deadlines, can consider recorded importance and
duration when available, avoids immediately repeating the most recently closed task when another
candidate exists, and otherwise uses stable creation order with an honest fallback explanation. It
never describes unknown difficulty or capacity as fact. Later strategies may use a model,
personalization, or a hybrid without changing the episode lifecycle.

The intended model roles, semantic safety boundary, learning signals, evidence precedence, and
staged personalization plan are documented in
[LLM integration and adaptive personalization](llm-personalization.md).

## Knowledge and uncertainty

Interpretation output distinguishes among:

| Kind | Example | Treatment |
|---|---|---|
| Observation | “The application closes Friday” | Preserve its evidence and source |
| Estimate | “This may take 20–40 minutes” | Store its range and confidence |
| Policy | “Honor this deferral through today” | Enforce deterministically |

Important interpreted values carry two separate provenance dimensions. Evidence sources include
`user_text`, `user_correction`, `connected_source`, `observed_behavior`, `general_knowledge`, and
`default`; derivation methods include `direct`, `model`, `rule`, and `learned`. Explicit user
corrections are authoritative. Unknown values remain unknown unless asking would materially change
the recommendation.

## Target domain concepts

| Concept | Purpose |
|---|---|
| `Capture` | Preserves the user's original brain dump |
| `Interpretation` | Versioned proposal derived from a capture and its available context |
| `Task` | Represents a canonical persistent outcome with an explicit active, completed, or archived lifecycle |
| `Action` | Represents a concrete, startable step belonging to a task |
| `ContextSnapshot` | Records optional, explicit context such as available time, a request for something easier, and known constraints |
| `RecommendationEpisode` | Records one bounded commitment, its stopping condition, explanation factors, context, and strategy version |
| `EpisodeEvent` | Appends acceptance, resize, defer, swap, overwhelm, and reported-outcome evidence |
| `ReentryCheckpoint` | Preserves a user-authored next entry point, its source episode, and the child episode that consumes it |

`Task` and `Action` remain separate. “Update my resume” can be a long-lived task; “revise the
summary” is a startable action. A recommendation episode adds a textual stopping boundary without
claiming that the larger task will be completed.

Accepting an episode does not prove work began. “Done for now” satisfies the bounded commitment,
not the persistent task. Task completion is an explicit user action, and a missing outcome remains
unknown. [ADR 0006](decisions/0006-bounded-recommendation-episodes.md) defines the lifecycle.

## Observability and traceability

Weavance separates operational telemetry and product decision history because they answer
different questions:

- Structured logs, metrics, and traces describe how a request or background operation executed.
- Versioned PostgreSQL records describe why an interpretation or recommendation was produced.

Structured request, capture, interpretation, and recommendation events, request IDs, safe
metadata, local console formatting, and deployed JSON formatting are implemented. User-authored
content stays out of routine logs. Versioned interpretation history and append-only recommendation
history are implemented.

OpenTelemetry is the planned instrumentation boundary, with Prometheus, Loki, Tempo, and Grafana
added when the interpretation workflow provides meaningful signals to observe. See
[ADR 0005](decisions/0005-observability-foundation.md).

## Request path

1. The API stores the raw capture.
2. **Target:** The application safety boundary evaluates the full capture, assigns a disposition to
   each reliable source unit, and routes allowed units to ordinary interpretation while producing a
   bounded response for rejected units. The raw capture and allowed units are not discarded. This
   step is not implemented yet.
3. An interpreter returns a typed proposal with provenance and uncertainty.
4. **Target:** The same safety boundary evaluates strategy output before it is displayed or used as
   a learning signal. This step is not implemented yet.
5. The API validates and stores an allowed proposal as a new versioned interpretation linked to the
   capture.
6. The current structured review records user additions, edits, removals, and confirmation as a new
   version.
7. **Target:** The safety boundary evaluates the final reviewed proposal, including user additions
   and edits, before confirmation. This step is not implemented yet.
8. Confirmation materializes canonical tasks and actions in the same transaction while preserving
   their links to capture and interpretation history.
9. The task API lists canonical state without rewriting that source history. **Target:** Later
   free-text task and action edits pass the safety boundary before updating canonical state. This
   safety step is not implemented yet.
10. Future reviews should narrow questions to ambiguity that would materially change the next
   action.
11. Deterministic policy removes inactive tasks and actions from consideration. **Target:** Any
    user-authored free-text context passes the safety boundary before it becomes strategy input.
12. The replaceable strategy combines eligible actions with the typed context snapshot and proposes
    one bounded recommendation.
13. **Target:** The application safety boundary evaluates the recommendation before persistence or
    display. This step is not implemented yet.
14. Deterministic policy validates and stores an allowed bounded recommendation episode.
15. The focused UI presents the entry point, stopping condition, and concise reason.
16. Episode events record explicit responses and reported outcomes without inferring an answer
    from silence. Replacement and follow-on recommendations receive new immutable boundaries.
17. **Target:** A free-text re-entry point passes the safety boundary before it is persisted as an
    active checkpoint or admitted as learning evidence. This step is not implemented yet.
18. Partial progress may atomically create an allowed user-authored checkpoint. When no episode is
    current, the newest eligible checkpoint is consumed into a bounded child episode before
    ordinary candidate selection.

The API and lifecycle details are documented in the
[recommendation contract](recommendation-contract.md).
