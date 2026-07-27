# MVP scope

## First outcome

A user enters an unstructured brain dump and receives one manageable next action with a short explanation.

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
| 4. Infer capacity conservatively | Planned | Uses interaction signals with an optional lightweight check-in |
| 5. Select one concrete next action | Planned | Runs only over policy-eligible actions |
| 6. Explain why it was selected | Planned | Uses structured, attributable factors |
| 7. Accept a response to the recommendation | Planned | Feeds the next recommendation |
| 8. Record the response and revise the recommendation | Planned | Closes the first feedback loop |

The five initial responses are:

- Start
- Make it smaller
- Not right now
- Swap task
- I'm overwhelmed

## Explicit non-goals

- A comprehensive calendar replacement
- Minute-by-minute automatic scheduling
- Native mobile applications
- Clinical assessment or treatment
- Social features, leaderboards, or streak pressure
- An autonomous LLM with direct control over the schedule
- Complex personalization or model training before useful feedback data exists
- Blocking games or enforcing device usage limits in the first version

## Acceptance criteria for the first usable slice

- A brain dump can be submitted in under 30 seconds.
- The result contains one action that can be started immediately.
- The system states why it chose that action.
- The user can resize, defer, or swap the action directly from the recommendation.
- The next recommendation reflects the user's response and current context.
- Subjective values are represented as sourced observations, uncertain estimates, or unknowns.
- Deterministic policy honors explicit user intent regardless of interpreter or recommendation strategy.
- The interpretation contract can be tested with a local test double.
