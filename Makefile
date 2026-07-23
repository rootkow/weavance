.PHONY: install db-up db-migrate api-dev web-dev lint test check

install:
	cd apps/api && uv sync --dev
	cd apps/web && npm install

db-up:
	docker compose up -d db

db-migrate:
	cd apps/api && uv run alembic upgrade head

api-dev:
	cd apps/api && uv run uvicorn weavance_api.main:app --reload

web-dev:
	cd apps/web && npm run dev

lint:
	cd apps/api && uv run ruff check .
	cd apps/api && uv run mypy src
	cd apps/web && npm run lint

test:
	cd apps/api && uv run pytest
	cd apps/web && npm test -- --run

check: lint test
	cd apps/web && npm run build
