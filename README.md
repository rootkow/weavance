# Weavance

**Weave what matters into one manageable next step.**

Weavance is an adaptive activation and re-entry assistant for the moments when deciding how to
begin feels like work of its own. It creates a simpler bridge between everything on your mind and
one bounded action you can begin now.

Instead of requiring you to organize a backlog before receiving help, Weavance starts with an
unstructured brain dump. It identifies possible tasks and starting actions and lets you correct
what it understood. Weavance then uses that context to offer one manageable commitment with a
clear stopping point. Your full task list remains available when you request it without taking
over the main screen.

## Why Weavance

Traditional task and calendar tools are good at storing decisions, but they often leave the
difficult parts to you: sorting, prioritizing, estimating, initiating, and replanning when the day
changes.

That burden can grow whenever you feel overwhelmed, low on time or energy, interrupted, or simply
unsure where to begin. Weavance reduces the number of decisions between intention and action
without taking control away from you or pretending uncertain inferences are facts.

## How it works

1. **Unload what is on your mind.** Capture thoughts in your own words without organizing them
   first.
2. **Review what Weavance understood.** Correct proposed tasks and concrete starting actions on one
   structured review screen.
3. **Accept one bounded commitment.** See where to begin, where to stop, and why the action fits
   now instead of confronting the entire backlog.
4. **Report what happened.** Progress, difficulty starting, and a request to continue all help
   shape what comes next without being treated as success or failure.
5. **Find your way back.** When momentum disappears, resume from a small checkpoint instead of
   receiving the unchanged task again.

For example, you might begin with:

```text
update resume
apply for the Software Engineer job at Weavance
work on Weavance
clean my office
schedule dentist appointment
The dentist's office closes at 4, and I only have about 20 minutes.
```

Weavance turns those thoughts into proposals you can review and correct:

```text
Apply for the Software Engineer role at Weavance
  Start with: Update your resume for the role

Schedule the dentist appointment
  Start with: Find the office number and make the call
  Deadline: Before 4

Work on Weavance
  Start with: Open the project and choose one unfinished item

Clean the office
  Start with: Clear one section of the desk
```

After you confirm the proposals, Weavance narrows them to one starting action:

```text
Start here

Find the dentist's office number and make the call.
Why: The office closes at 4, and this should fit within the 20 minutes you have.
You're done when: The appointment is scheduled, you leave a message, or you know when to call
again.
```

## Product principles

- **One clear starting point.** The main screen should answer “What can I do now?”
- **Commitments stay bounded.** Every recommendation says where to begin and when you can stop.
- **Re-entry is part of the work.** After an interruption, Weavance helps you find a small way back
  in.
- **You remain authoritative.** Your explicit corrections and boundaries override inferred meaning.
- **Uncertainty stays visible.** Model output is treated as a sourced proposal, not application
  truth.
- **Important behavior stays bounded.** Deterministic policy constrains model-assisted
  interpretation and recommendation.

## Development stage

Weavance is under active development. The working prototype currently covers capture,
interpretation, structured review, and preserving confirmed tasks across brain dumps. It does not
yet create bounded recommendation episodes, collect outcomes, or provide the re-entry flow
described above.

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

No model provider or API key is required. The current prototype uses a deterministic line-based
fallback that turns each nonblank line into an editable task and starting action. A future hosted
or local model can replace it through the provider-neutral interpretation boundary.

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
