# Weavance

**Weave what matters into one manageable next step.**

Weavance is an adaptive executive-function assistant that turns an unstructured brain dump into one manageable next action and helps the user recover when the day goes off plan.

## Guiding idea

Missing part of a routine is expected behavior, not failure. Weavance does not carry every unfinished item forward as overdue task debt. It reassesses what matters, what fits the user's current capacity, and what would make starting easier.

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

Install dependencies:

```bash
make install
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

## Current scope

The initial UI deliberately uses a local deterministic parser and planner. This proves the full interaction boundary before introducing persistence or an LLM provider. See [the MVP scope](docs/mvp.md) for what comes next.
