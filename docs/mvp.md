# MVP scope

## First outcome

A user enters an unstructured brain dump and receives one manageable next action with a short explanation.

## Milestone 0: Foundation

- Product brief and explicit product principles
- Architecture boundaries and initial decisions
- React and TypeScript application shell
- FastAPI service with configuration and health endpoint
- Formatting, linting, tests, CI, and local development setup

## Milestone 1: First vertical slice

1. Capture and store the original brain dump.
2. Interpret it as typed, versioned task and action proposals without discarding the original wording.
3. Let the user confirm or correct material assumptions.
4. Infer capacity conservatively from interaction signals, with an optional lightweight check-in.
5. Select one concrete next action.
6. Explain why it was selected.
7. Accept one of five responses:
   - Start
   - Make it smaller
   - Not right now
   - Swap task
   - I'm overwhelmed
8. Record the response and produce a revised recommendation.

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
- The user can reduce or reject the action without navigating a backlog.
- A rejected action does not return unchanged as an overdue item.
- Subjective values are represented as sourced observations, uncertain estimates, or unknowns.
- Deterministic policy honors explicit user intent regardless of interpreter or recommendation strategy.
- The interpretation contract can be tested without calling a live model.
