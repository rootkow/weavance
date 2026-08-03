.PHONY: install db-up db-migrate api-dev web-dev docs-serve docs-build lint test check

install:
	uv sync --locked --python 3.12
	cd apps/api && uv sync --active --locked --dev
	cd apps/web && npm ci

db-up:
	docker compose up -d db

db-migrate:
	cd apps/api && uv run --active alembic upgrade head

api-dev:
	cd apps/api && uv run --active uvicorn weavance_api.main:app --reload

web-dev:
	cd apps/web && npm run dev

docs-serve:
	uv run --python 3.12 mkdocs serve

docs-build:
	uv run --python 3.12 mkdocs build --strict

lint:
	cd apps/api && uv run --active ruff check .
	cd apps/api && uv run --active mypy src
	cd apps/web && npm run lint

test:
	cd apps/api && uv run --active pytest
	cd apps/web && npm test -- --run

check: lint test docs-build
	cd apps/web && npm run build
