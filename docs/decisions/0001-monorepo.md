# ADR 0001: Use a web-first monorepo

- Status: Accepted
- Date: 2026-07-22

## Decision

Use a monorepo containing a React and TypeScript frontend and a Python FastAPI backend. Begin as a responsive web application, leaving PWA installation for a later slice.

## Rationale

This supports rapid dogfooding, keeps frontend and backend changes coordinated, and exercises the backend, platform, and AI-integration skills the project is intended to demonstrate. It avoids native-mobile complexity before the product loop is validated.

## Consequences

- The project has two development toolchains.
- API contracts must be kept explicit and later used to generate client types.
- Mobile-specific notification and device-control capabilities are deferred.
