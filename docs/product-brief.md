# Product brief

## Positioning

Weavance is an adaptive activation and re-entry assistant for people who want a simpler bridge
from intention to action. A user can unload whatever is occupying their mind; Weavance helps turn
it into one bounded commitment, learns from explicit responses, and provides a small way back
after interruptions.

## Problem

Prioritizing, estimating, initiating, and replanning all impose decisions before useful work can
begin. That burden varies from one moment to the next and can be especially noticeable when a
person feels overwhelmed, short on time or energy, interrupted, or unsure where to begin.

When circumstances change, many tools continue carrying earlier items forward unchanged. The
backlog grows at the same moment the user could benefit most from a clear starting point or a
small way back into unfinished work.

## Primary job to be done

When everything feels like a lot or I am having trouble getting started, give me one useful,
limited commitment I can accept now. If I lose momentum, help me return without making me
reconstruct the plan.

## Product principles

1. **One clear starting point.** The default execution screen shows one concrete entry point.
2. **Commitments stay bounded.** Every recommendation includes a clear stopping condition.
3. **Acceptance is not completion.** Accepting, starting, satisfying a bounded commitment, and
   completing a persistent task remain distinct.
4. **Every explicit response is useful evidence.** Resizing, deferring, swapping, feeling
   overwhelmed, and reporting an outcome can shape what comes next.
5. **Unknown remains unknown.** Silence is not interpreted as success, failure, avoidance, or any
   other mental state.
6. **Re-entry is a first-class workflow.** Unfinished work returns through a useful checkpoint,
   not merely as the same overdue task.
7. **You remain authoritative.** Explicit corrections, boundaries, and task state override
   inferred meaning.
8. **Important decisions stay bounded and explainable.** Model suggestions follow deterministic
   rules and include clear reasons.

## Target interaction priority

The intended main interface prioritizes:

1. An active commitment
2. A pending interpretation review
3. A saved re-entry checkpoint
4. One bounded recommendation from the saved task set
5. A new brain dump

The full task list remains available through an explicit action instead of becoming the default
screen. When no commitment or interpretation review is active, a saved re-entry checkpoint takes
precedence over ordinary recommendation selection.

The current UI preserves a pending review only within the active browser session. After a page
reload, startup can restore an accepted commitment or open recommendation, including one created
from a saved re-entry checkpoint, but it cannot yet restore an unconfirmed interpretation review.

## Initial user

The first user is the builder. Daily dogfooding and recorded outcomes will ground early product
decisions in the builder's lived experience.

## Success signal

The earliest meaningful signal is whether a bounded recommendation helps the user begin and
whether they can find a manageable way back after an interruption.

For the first dogfooding period, the product currently records:

- Recommendation accepted, resized, deferred, swapped, or overwhelmed
- User-reported outcome: done for now, progress made, did not start, or keep going
- Whether the promised stopping point was honored
- Whether the user saved a re-entry checkpoint and later accepted the resulting recommendation

It should later add:

- Optional feedback that the recommendation helped or added pressure

No outcome is inferred when the user does not report one.

## Safety boundary

Weavance provides activation and planning support, not medical diagnosis or treatment. It avoids
clinical claims and does not present inferred mental states as facts. The current deterministic
interpreter does not classify the semantic risk of free-text captures, so this boundary is accepted
product direction rather than implemented enforcement. [ADR 0007](decisions/0007-cross-strategy-semantic-safety.md)
requires one application-owned boundary across deterministic, hosted, local, hybrid, and fallback
strategies before public or unattended deployment or live model output. That boundary preserves the
complete user-owned capture and allows safe portions of a mixed capture to continue rather than
silently discarding the user's brain dump.
