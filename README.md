# Weavance

**Weave what matters into one manageable next step.**

Weavance is an adaptive executive-function assistant for the moments when deciding what to do
feels like work of its own. It creates a simpler bridge between everything on a person's mind and
one concrete action they can begin now.

Instead of requiring someone to organize a backlog before receiving help, Weavance starts with an
unstructured brain dump. It identifies possible tasks and starting actions, lets the user correct
what it understood, and is designed to use that context to choose a manageable next step. The
broader task list remains available when requested without becoming the default experience.

## Why Weavance

Traditional task and calendar tools are good at storing decisions, but they often leave the
difficult parts to the user: sorting, prioritizing, estimating, initiating, and replanning when the
day changes.

That planning burden can be especially costly during periods of ADHD-related friction, stress,
anxiety, burnout, or reduced capacity. Weavance is designed to reduce that burden without taking
control away from the user or pretending uncertain inferences are facts.

## The intended experience

1. **Unload what is on your mind.** Capture thoughts in the user's own words without organizing
   them first.
2. **Review what Weavance understood.** Correct proposed tasks and concrete starting actions on one
   structured review screen.
3. **Start with one useful action.** Keep the default experience focused instead of presenting the
   entire backlog at once.
4. **Respond and adapt.** Starting, resizing, deferring, swapping, or feeling overwhelmed all
   become useful context for what comes next.

## Product principles

- **One clear starting point.** The main experience should answer “What can I do now?”
- **The user remains authoritative.** Explicit corrections and boundaries override inferred
  meaning.
- **Uncertainty stays visible.** Model output is treated as a sourced proposal, not application
  truth.
- **Plans reflect current capacity.** Recommendations should fit the day the user is actually
  having.
- **Recovery belongs in the plan.** Rest is legitimate context, not a failure to be optimized
  away.
- **Important behavior stays bounded.** Deterministic policy constrains model-assisted
  interpretation and recommendation.

## Development stage

Weavance is under active development. The working prototype currently covers capture,
interpretation, structured review, and preserving confirmed tasks across brain dumps. It does not
yet make the capacity-aware recommendation described above or close the response-and-revision
loop.

See the [MVP scope](docs/mvp.md) for current progress and acceptance criteria.

## Repository layout

```text
apps/
├── api/    FastAPI service, persistence, and interpretation boundaries
└── web/    React and TypeScript application
docs/       Product, architecture, contract, and decision records
```

## Local development

### Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 24+
- npm 10+
- Docker with Compose

### Set up the project

Install the API and web dependencies:

```bash
make install
```

Configure the web application:

```bash
cp apps/web/.env.example apps/web/.env
```

The API defaults work with the Compose database. To customize them, copy
`apps/api/.env.example` to `apps/api/.env` and edit the values.

Start PostgreSQL and apply the schema:

```bash
make db-up
make db-migrate
```

Run the API and web application in separate terminals:

```bash
make api-dev
make web-dev
```

Open `http://localhost:5173`. The API health endpoint is available at
`http://localhost:8000/health`, and its generated OpenAPI interface is available at
`http://localhost:8000/docs`.

The Make targets use an active virtual environment when one is available, including environments
managed by `pyenv-virtualenv`. Otherwise, uv uses `apps/api/.venv`.

To run the entire stack with Compose instead:

```bash
docker compose up --build
```

## Verification

Run linting, type checks, unit tests, and the production web build:

```bash
make check
```

PostgreSQL integration tests require a disposable test database:

```bash
docker compose exec db createdb -U weavance weavance_test
WEAVANCE_TEST_DATABASE_URL=postgresql+asyncpg://weavance:weavance@localhost:5432/weavance_test make check
```

The integration fixture applies all migrations before testing and removes the schema afterward.
GitHub Actions runs the same checks against an isolated PostgreSQL service.

## Documentation

- [Product brief](docs/product-brief.md): problem, principles, intended user, and success signals
- [MVP scope](docs/mvp.md): implementation progress, acceptance criteria, and non-goals
- [Architecture](docs/architecture.md): current and target system boundaries
- [Interpretation contract](docs/interpretation-contract.md): provider-neutral typed interface
- [Architecture decisions](docs/decisions): accepted and superseded ADRs
