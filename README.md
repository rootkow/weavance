# Weavance

**Weave what matters into one manageable next step.**

Weavance is an adaptive executive-function assistant that turns an unstructured brain dump into one manageable next action and adapts the plan as the day changes.

## Guiding idea

Routines can flex with real life. Weavance treats changes in momentum as useful context and builds a fresh path forward around what matters, what fits the user's current capacity, and what would make starting easier.

## Repository layout

- `apps/api`: FastAPI service and deterministic planning boundary
- `apps/web`: React and TypeScript application
- `docs`: Product brief, MVP boundaries, architecture, and decisions

## Local development

Requirements:

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 22+
- npm 10+
- Docker with Compose

Install dependencies:

```bash
make install
```

Start PostgreSQL and apply the schema:

```bash
make db-up
make db-migrate
```

Run the API and web app in separate terminals:

```bash
make api-dev
make web-dev
```

Then open `http://localhost:5173`. The API health endpoint is available at `http://localhost:8000/health`.

Run all checks:

```bash
make check
```

Docker Compose is also available:

```bash
docker compose up --build
```

The API container applies pending migrations before starting. A deployed environment should run
migrations as a separate release step.

### Logging

The API writes readable event logs locally and JSON logs in deployed environments. Every HTTP
response includes an `X-Request-ID` that is also present in the corresponding request log.

Logging can be configured with:

- `WEAVANCE_LOG_LEVEL`: `DEBUG`, `INFO`, `WARNING`, `ERROR`, or `CRITICAL`
- `WEAVANCE_LOG_FORMAT`: `auto`, `console`, or `json`

`auto` selects console output for the `local` environment and JSON everywhere else. Application
logs contain IDs and bounded metadata; they do not contain brain dumps or other user-authored
content.

## Current scope

Milestone 0 established the application shell and delivery tooling. Milestone 1 begins with
PostgreSQL persistence for immutable brain-dump captures, followed by a typed interpretation
boundary. Model providers will propose subjective interpretations; deterministic policy will
enforce user intent and application invariants. See [the MVP scope](docs/mvp.md) for the planned
vertical slice.
