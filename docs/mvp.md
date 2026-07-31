# MVP scope

## First outcome

A user enters an unstructured brain dump and can accept one manageable commitment with a concrete
entry point, a clear stopping condition, and a short explanation. The user can later report what
happened or return through a small re-entry action.

## Milestone 0: Foundation

Status: **Complete**

- Product brief and explicit product principles
- Architecture boundaries and initial decisions
- React and TypeScript application shell
- FastAPI service with configuration and health endpoint
- Formatting, linting, tests, CI, and local development setup

## Milestone 1: First vertical slice

| Stage | Status | Current boundary |
|---|---|---|
| 1. Capture and store the original brain dump | Complete | The UI and `POST /captures` preserve exact text in PostgreSQL |
| 2. Interpret it as typed, versioned task and action proposals | Complete | A replaceable line-based fallback creates validated proposals and PostgreSQL stores every version |
| 3. Let the user confirm or correct material assumptions | In progress | The structured review supports adding, editing, and removing tasks and first actions; richer interpreted details are not editable yet |
| 4. Materialize canonical tasks and actions | Complete | Confirmation creates lifecycle-aware application state without rewriting capture or interpretation history; task and first-action editing plus completion/reopening/archival are available in the secondary UI |
| 5. Collect an explicit context snapshot | In progress | Every episode persists the typed snapshot used for selection; UI collection of available time, easier work, and constraints remains planned |
| 6. Create one bounded recommendation episode | Complete | A deterministic strategy selects an eligible active action and records its entry point, textual stopping condition, explanation factors, reason, and strategy version |
| 7. Accept a pre-start response | Complete | Start, resize, defer, swap, and overwhelmed are persisted as explicit append-only events; resize, swap, and overwhelm can create replacement episodes |
| 8. Record an honest outcome | Complete | The focused commitment view records done for now, progress, did not start, and keep going without completing the persistent task |
| 9. Offer a re-entry action | Planned | Partial progress can preserve a checkpoint for a later bounded recommendation |

The five initial responses are:

- Start
- Make it smaller
- Not right now
- Different task
- I'm overwhelmed

Selecting **Start** accepts the recommendation and makes it the active commitment. It does not
prove that work began. The initial outcome choices are:

- Done for now
- I made some progress
- I didn't get started
- I want to keep going

**Done for now** satisfies the bounded commitment. The persistent task remains open until the user
explicitly completes it. The focused UI currently adds the supporting description **I reached this
stopping point** and explains the boundary again after selection. The label remains under review
after dogfooding because it may also be read as postponement. If the user does not report an
outcome, the outcome remains unknown.

The initial experience has no countdown or timer UI. A possible future focus timer is a separate,
optional feature: it must remain disabled by default and require explicit opt-in through a future
Settings page.

## Explicit non-goals

- A comprehensive calendar replacement
- Minute-by-minute automatic scheduling
- Native mobile applications
- Clinical assessment or treatment
- Social features, leaderboards, or streak pressure
- An autonomous LLM with direct control over the schedule
- Opaque inference about capacity, motivation, or mental state
- Complex personalization or model training before useful feedback data exists
- Blocking games or enforcing device usage limits in the first version

## Acceptance criteria for the first usable slice

- A brain dump can be submitted in under 30 seconds.
- Confirmed proposals create canonical tasks and actions without rewriting capture or
  interpretation history.
- The user can add, edit, or remove persistent tasks and their actions. Removal archives state
  without destroying history.
- The user can explicitly complete a persistent task.
- The result contains one action that can be started immediately.
- The recommendation says where to begin and “You're done when...”
- The system states why it chose that action.
- The user can start, resize, defer, swap, or report feeling overwhelmed directly from the
  recommendation.
- A later outcome report does not automatically complete the persistent task.
- Missing outcome data remains unknown.
- Partial progress can preserve a checkpoint for a later re-entry action.
- The next recommendation reflects explicit responses and the current context snapshot.
- Subjective values are represented as sourced observations, uncertain estimates, or unknowns.
- Deterministic policy honors explicit user intent regardless of interpreter or recommendation
  strategy.
- The interpretation contract can be tested with a local test double.
