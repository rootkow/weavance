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
| 3. Let the user confirm or correct material assumptions | In progress | The structured review supports adding, editing, and removing tasks and first actions; the cumulative confirmed list is restored but remains behind an explicit user action; richer interpreted details are not editable yet |
| 4. Materialize canonical tasks and actions | Planned | Confirmation creates editable application state without rewriting capture or interpretation history |
| 5. Collect an explicit context snapshot | Planned | Available time, a request for something easier, and known constraints remain optional and user-sourced |
| 6. Create one bounded recommendation episode | Planned | A deterministic strategy selects a policy-eligible action and records its entry point, stopping condition, reason, and strategy version |
| 7. Accept a pre-start response | Planned | Start, resize, defer, swap, and overwhelmed are explicit episode events |
| 8. Record an honest outcome | Planned | Acceptance, reported work, bounded-action completion, and persistent-task completion remain separate |
| 9. Offer a re-entry action | Planned | Partial progress can preserve a checkpoint for a later bounded recommendation |

The five initial responses are:

- Start
- Make it smaller
- Not right now
- Swap task
- I'm overwhelmed

Selecting **Start** accepts the recommendation and makes it the active commitment. It does not
prove that work began. The initial outcome choices are:

- Done for now
- I made some progress
- I didn't get started
- I want to keep going

**Done for now** satisfies the bounded commitment. The persistent task remains open until the user
explicitly completes it. If the user does not report an outcome, the outcome remains unknown.

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
