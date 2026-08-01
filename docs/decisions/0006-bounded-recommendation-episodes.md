# ADR 0006: Model bounded recommendation episodes and re-entry explicitly

- Status: Accepted
- Date: 2026-07-28

## Context

A persistent task and the commitment Weavance asks a user to make are not the same thing. “Update
my resume” may remain open across many sessions, while “revise the summary for 10 minutes” can be
satisfied once its timebox ends.

Accepting that recommendation, beginning the work, satisfying the bounded commitment, and
completing the persistent task are also different events. Collapsing them would create misleading
history and teach future recommendation strategies from assumptions rather than reported
behavior.

Interrupted work needs its own representation. Repeating the unchanged task loses the useful
detail of where the user stopped and can recreate the same activation cost.

## Decision

Weavance will persist a `RecommendationEpisode` for each proposed bounded commitment. An episode
records:

- the referenced task and action
- a concrete entry point
- a stopping condition, including an optional timebox
- the explicit `ContextSnapshot` used for the decision
- structured explanation factors and a concise user-facing reason
- the recommendation strategy and version

The initial context snapshot is deliberately small and user-sourced. It may contain available
time, a request for something easier, and known deadlines or constraints. Weavance will not infer
capacity, motivation, or mental state as application fact.

Episode changes are append-only events. The initial pre-start events are:

- `accepted`: the user selected **Start**, making the episode the active commitment
- `resized`: the user asked for a smaller commitment
- `deferred`: the user selected **Not right now**
- `swapped`: the user requested a different task
- `overwhelmed`: the user explicitly requested a lower-decision response

An accepted episode's boundary is immutable. `resized` and `swapped` close the current suggestion
and create a replacement episode rather than rewriting it.

Selecting **Start** records acceptance; it does not prove that work began. Actual work remains
unknown until the user reports an outcome. The initial outcome reports are:

- `done_for_now`: the bounded stopping condition was satisfied
- `progress_made`: work began and produced progress without satisfying the stopping condition
- `did_not_start`: the accepted commitment was not started
- `keep_going`: work began and the user wants another bounded commitment

No report produces no event. The outcome remains unknown and contributes no success or failure
signal. `keep_going` creates a follow-on episode with its own boundary; it never silently extends
the accepted commitment.

`done_for_now` completes the bounded commitment, not the persistent task. A `Task` changes to
completed only through a separate explicit user action. Archived tasks remain linked to their
capture, interpretation, action, and episode history.

The initial UI keeps the label **Done for now** and pairs it with **I reached this stopping
point**. The confirmation view repeats that this outcome applies only to the bounded commitment.
Whether the label still sounds like postponement remains an explicit dogfooding question rather
than being decided from assumption.

A countdown or running timer is not part of the initial recommendation experience. A time-based
stopping condition and a timer are separate concepts. If a focus timer is added later, it must be
disabled by default and available only through explicit opt-in on a future Settings page. This
protects users who experience timers as rushing or pressure while leaving room for users who find
them helpful for focus.

After `progress_made`, the user may save a short `ReentryCheckpoint` describing where to begin
next. The outcome and checkpoint are persisted atomically, while skipping records only the
outcome. The application does not generate a checkpoint from silence or another response.

The newest unconsumed checkpoint whose task and action remain active takes precedence when no
episode is current. Offering it creates a new bounded child episode and records that episode as
the checkpoint's consumer. This preserves the exact source and prevents a deferred or swapped
re-entry offer from repeatedly resurfacing. Completed and archived work is not eligible.

The **I'm overwhelmed** response is explicit user intent, not an inferred condition. Its initial
policy should reduce the size and number of decisions presented, avoid expanding the full task
list, and permit a pause without recording failure.

## Consequences

- Recommendation history reflects explicit evidence rather than optimistic completion counts.
- A user can honor a small commitment without claiming that a larger task is finished.
- Recommendation strategies can learn from accepted, resized, deferred, swapped, and reported
  outcomes after sufficient data exists.
- Missing data cannot be treated as avoidance, failure, or success.
- Re-entry can evolve independently from task prioritization.
- The domain needs canonical task and action records before recommendation episodes can reference
  stable application state.
- The UI needs separate controls for accepting a recommendation, reporting its outcome, and
  completing the persistent task.
