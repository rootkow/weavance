# Weavance documentation

Weavance is an adaptive activation and re-entry assistant that turns what is on a user's mind into
one bounded action they can begin now.

This site documents the product direction, current implementation, provider-neutral contracts, and
the architectural decisions behind the project.

## Start here

- [Product brief](product-brief.md) explains the problem, principles, intended user, and success
  signals.
- [MVP scope](mvp.md) tracks implementation progress, acceptance criteria, and explicit non-goals.
- [Architecture](architecture.md) describes current and target system boundaries.
- [Interpretation contract](interpretation-contract.md) defines the typed boundary for turning raw
  captures into task and action proposals.
- [Recommendation contract](recommendation-contract.md) defines bounded recommendation episodes,
  events, checkpoints, and HTTP behavior.
- [LLM and personalization principles](llm-personalization.md) introduces the intended role of
  models, the authority boundaries, and the staged direction for adaptive behavior.
- [Model-assisted workflows](model-assisted-workflows.md) describes how interpretation,
  recommendation, re-entry, validation, and fallback fit together.

Architectural decisions are preserved as ADRs in the **Decisions** section.
