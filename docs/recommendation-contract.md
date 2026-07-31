# Recommendation contract

## Purpose

The recommendation boundary turns canonical task state into one persisted, bounded commitment.
It is separate from interpretation: interpretation proposes what a capture contains, while
recommendation chooses one eligible starting action to present now.

## Episode

Every `RecommendationEpisode` stores:

- the canonical task and action IDs
- an immutable entry point and textual stopping condition
- the typed context snapshot used for selection
- structured explanation factors and a concise user-facing reason
- the strategy name and version
- an optional parent episode for resized, swapped, overwhelmed, or continued commitments

The current context snapshot supports optional available minutes, a user request for something
easier, and explicit constraints. The first UI persists the empty/default snapshot; collecting
those values from the user remains planned.

The first strategy considers only active tasks with an active action. It prefers known deadlines,
then recorded importance, then stable creation order. If available time or an easier-work request
is supplied, known duration ranges can narrow or reorder eligible actions. When another candidate
exists, it avoids immediately repeating the task from the most recently closed episode. Missing
estimates remain unknown.

## Append-only events

An episode begins in `proposed`. Its events determine its state:

| Current state | Event | Result |
|---|---|---|
| Proposed | `accepted` | The episode becomes the active commitment |
| Proposed | `resized` | The episode closes and a smaller child episode is created |
| Proposed | `swapped` | The episode closes and another eligible task may receive a child episode |
| Proposed | `deferred` | The episode closes without recording failure |
| Proposed | `overwhelmed` | The episode closes and a preparation-only child episode is created |
| Accepted | `done_for_now` | The bounded commitment closes; the task remains open |
| Accepted | `progress_made` | Reported progress closes the commitment; the task remains open |
| Accepted | `did_not_start` | The commitment closes without progress or failure inference |
| Accepted | `keep_going` | The episode closes and a new bounded child episode is created |

No event means no outcome. Invalid or repeated transitions return a conflict instead of rewriting
history.

## HTTP API

- `GET /recommendations/current` returns the accepted commitment first, otherwise the latest open
  proposal, or `null`.
- `POST /recommendations` returns the existing open episode when present or creates one episode
  from eligible state.
- `POST /recommendations/{episode_id}/events` appends one explicit response and returns the closed
  or accepted episode plus any replacement.

The initial API has no timer state, countdown endpoint, or timer setting.
