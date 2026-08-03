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
    STORE --> INTERPRET["Interpretation strategy"]
    INTERPRET --> PROPOSAL["Typed proposal"]
    PROPOSAL --> HISTORY["Versioned decision history"]
    HISTORY --> STATE["Canonical tasks and actions"]
    STATE --> POLICY["Deterministic policy"]
    POLICY --> RECOMMEND["Recommendation strategy"]
    RECOMMEND --> VALIDATE["Policy validation"]
    VALIDATE --> EPISODE["Bounded episode"]
    EPISODE --> EVENTS["Responses and outcomes"]
    EVENTS -->|"Optional partial-progress note"| REENTRY["Re-entry checkpoint"]
    REENTRY -->|"Newest eligible checkpoint"| POLICY
```

The interpretation layer converts free-form language and available context into structured
proposals. A model may suggest task boundaries, possible actions, urgency, duration, or
dependencies. These values remain uncertain proposals rather than application facts.
The current provider-neutral boundary is documented in the
[interpretation contract](interpretation-contract.md).

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
2. An interpreter returns a typed proposal with provenance and uncertainty.
3. The API validates and stores it as a new versioned interpretation linked to the capture.
4. The current structured review records user additions, edits, removals, and confirmation as a new
   version.
5. Confirmation materializes canonical tasks and actions in the same transaction while preserving
   their links to capture and interpretation history.
6. The task API lists and updates canonical state without rewriting that source history.
7. Future reviews should narrow questions to ambiguity that would materially change the next
   action.
8. Deterministic policy removes inactive tasks and actions from consideration.
9. The replaceable strategy combines eligible actions with the typed context snapshot and stores
   one bounded recommendation episode.
10. The focused UI presents the entry point, stopping condition, and concise reason.
11. Episode events record explicit responses and reported outcomes without inferring an answer
    from silence. Replacement and follow-on recommendations receive new immutable boundaries.
12. Partial progress may atomically create a user-authored checkpoint. When no episode is current,
    the newest eligible checkpoint is consumed into a bounded child episode before ordinary
    candidate selection.

The API and lifecycle details are documented in the
[recommendation contract](recommendation-contract.md).
