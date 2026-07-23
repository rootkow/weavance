# ADR 0004: Use PostgreSQL and Alembic from the first persisted model

- Status: Accepted
- Date: 2026-07-23

## Context

Weavance is intended to become a hosted, multi-user application. SQLite would reduce the first local
setup step but would introduce different concurrency, type, constraint, and schema-alteration
behavior from the expected production database.

The API already uses Python and will use SQLAlchemy for persistence. The project needs a repeatable
way to evolve existing database schemas.

## Decision

- PostgreSQL is the development, test, and production database.
- SQLAlchemy 2.x defines the current persistence model.
- Alembic versions schema changes from the first table onward.
- Persistence integration tests run against PostgreSQL rather than silently substituting SQLite.
- Docker Compose provides the local database.

Alembic migrations are reviewed artifacts. Autogeneration may help create them, but it does not
replace review.

## Consequences

- Local persistence work requires PostgreSQL, normally through Docker Compose.
- CI requires a PostgreSQL service.
- Development and production exercise the same database semantics.
- Schema history remains Python-native and fully open source.
- More sophisticated schema tooling can be evaluated later without changing the database choice.
