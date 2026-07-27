# Weavance

**Weave what matters into one manageable next step.**

Weavance is an adaptive executive-function assistant that turns an unstructured brain dump into one manageable next action and adapts the plan as the day changes.

## Guiding idea

Routines can flex with real life. Weavance treats changes in momentum as useful context and builds a fresh path forward around what matters, what fits the user's current capacity, and what would make starting easier.

## Repository layout

- `apps/api`: FastAPI service and deterministic planning boundary
- `apps/web`: React and TypeScript application
- `docs`: Product brief, MVP boundaries, architecture, and decisions

## Implementation status

The current vertical slice can:

- accept a brain dump through the web application
- preserve its exact text in PostgreSQL through `POST /captures`
- reject blank captures and captures longer than 50,000 characters
- correlate requests through privacy-aware structured logs
- represent provider-neutral interpretation requests and proposals through a tested typed contract
- create and persist a versioned proposal through a transparent line-based fallback interpreter
- let the user add, edit, or remove proposed tasks and starting actions
- preserve the reviewed result as a separate confirmed interpretation version
- restore the latest confirmed tasks from every brain dump when the web application loads
- present that cumulative task list only when the user explicitly opens it

The cumulative list is a secondary, user-opened current-state read model, not the default
experience or a full capture or interpretation-history surface. The fallback intentionally
performs only a modest first pass; it is replaceable through the existing interpreter contract.
Task lifecycle, capacity inference, policy, recommendation selection, and the main one-action
execution screen are still planned.

## Local development

Requirements:

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 24+
- npm 10+
- Docker with Compose

Install dependencies:

```bash
make install
```

The Make targets prefer an active virtual environment, including one managed by
`pyenv-virtualenv`. When no virtual environment is active, uv uses `apps/api/.venv`.

Configure the web application to reach the locally running API:

```bash
cp apps/web/.env.example apps/web/.env
```

The API defaults work with the Compose database. To override them, copy
`apps/api/.env.example` to `apps/api/.env` and edit the app-specific values.

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

Run the local lint, unit-test, and build checks:

```bash
make check
```

PostgreSQL integration tests require a disposable test database. Create it once, then provide its
URL when running the checks:

```bash
docker compose exec db createdb -U weavance weavance_test
WEAVANCE_TEST_DATABASE_URL=postgresql+asyncpg://weavance:weavance@localhost:5432/weavance_test make check
```

The integration-test fixture applies all migrations before the tests and downgrades the test
database back to an empty schema afterward. GitHub Actions always runs these tests against its own
PostgreSQL service.

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

## Current API

- `GET /health` returns service status and the configured environment.
- `POST /captures` stores a nonblank brain dump of at most 50,000 characters and returns its ID,
  exact original text, and creation time.
- `POST /captures/{capture_id}/interpretations` creates and stores a versioned proposal using the
  configured interpreter.
- `POST /captures/{capture_id}/interpretations/{interpretation_id}/confirm` stores reviewed task
  and action corrections as a new confirmed version.
- `GET /interpretations/confirmed` returns the latest confirmed interpretation for each capture,
  ordered by capture creation time.
- `/docs` exposes FastAPI's generated OpenAPI interface during local development.

There are no raw-capture or complete interpretation-history endpoints yet. Task update, completion,
and deletion endpoints are also not implemented.

## Documentation

- [Product brief](docs/product-brief.md): problem, principles, initial user, and success signals
- [MVP scope](docs/mvp.md): implementation progress, first vertical slice, and non-goals
- [Architecture](docs/architecture.md): current boundaries and target request flow
- [Interpretation contract](docs/interpretation-contract.md): provider-neutral typed interface
- [Architecture decisions](docs/decisions): accepted and superseded ADRs
