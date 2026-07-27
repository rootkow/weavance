# Backlog

This document tracks work that has been identified but not yet scheduled. Product scope and
milestone acceptance criteria remain in the [MVP scope](mvp.md); completed behavior belongs in the
architecture and API documentation rather than here.

## Product

### Manage confirmed tasks

Let the user add, edit, and remove tasks from the saved backlog after interpretation review.

- Keep the complete backlog behind the existing explicit **View all tasks** action.
- Preserve the immutable capture and interpretation history instead of deleting or rewriting source
  records.
- Represent later task changes as explicit user-authored state.
- Define safe removal behavior, including confirmation or a practical undo path.
- Preserve stable task ordering when a task is changed.
- Add API, persistence, and UI regression coverage.

### Recommend one manageable next action

Continue the primary experience beyond interpretation and confirmation.

- Infer current capacity conservatively.
- Select one policy-eligible action.
- Explain the recommendation in plain language.
- Accept start, resize, defer, swap, and overwhelmed responses.
- Record the response and use it to revise the next recommendation.

## Documentation

### Rewrite the README as a project introduction

The README currently carries too much implementation status and reads like a project status board.
Rewrite it as a stable entry point for someone encountering Weavance for the first time.

- Lead with the problem, product idea, and intended experience.
- Keep current capabilities concise rather than maintaining a feature-by-feature progress report.
- Retain a clear local-development quick start.
- Move detailed implementation status, API inventory, and roadmap material to focused documents.
- Keep links to the product brief, MVP scope, architecture, decisions, and this backlog.
