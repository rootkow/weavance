# ADR 0005: Observability foundation

- Status: Accepted
- Date: 2026-07-24

## Context

Weavance will combine HTTP requests, database work, model calls, deterministic policy, and
recommendation decisions. Operators need to follow technical execution across these boundaries,
while product developers need to explain how a recommendation was produced.

The application also handles private user content. Brain dumps, task text, model prompts and
responses, calendar content, and future email content should not enter routine application logs.

## Decision

We will build observability around two complementary forms of traceability.

### Operational telemetry

The API emits structured events at system boundaries and meaningful domain transitions. Every
HTTP response carries an `X-Request-ID`, and request logs include the same identifier, route
template, method, status, and duration. Deployed environments use JSON logs; local development
uses a readable console format by default.

Logging records identifiers and bounded metadata rather than user-authored content. A central
redaction layer protects known sensitive field names. New events should follow the same
data-minimization rule instead of relying on redaction as their primary privacy control.

OpenTelemetry will become the vendor-neutral instrumentation boundary as workflows span model
providers and additional services. Prometheus, Loki, Tempo, and Grafana may be added through an
optional Compose profile when the application has useful metrics, traces, and dashboards to
exercise.

Metrics will use bounded labels such as route template, status class, interpreter version, and
recommendation strategy version. Unique identifiers such as user, capture, interpretation, or
request IDs will not be metric labels.

### Product decision history

PostgreSQL remains the durable record of why the product made a recommendation. Interpretations
and recommendations will retain their schema, provider, prompt, policy, and strategy versions,
along with provenance, confidence, structured factors, corrections, and user feedback.

Operational telemetry diagnoses how the system executed. Product decision history explains what
the system decided and makes future strategies replayable against prior scenarios.

## Initial implementation

The first increment includes:

- structured JSON and local console logging
- request correlation and safe request metadata
- privacy-aware field redaction
- `capture.created` and capture-persistence failure events
- tests for correlation and sensitive-data handling

It does not yet add telemetry infrastructure, dashboards, alerting, or model instrumentation.

## Consequences

- Interpretation work can add spans and domain events at established boundaries.
- Production logs are machine-queryable without making the default Compose environment heavier.
- Sensitive content stays in purpose-built application storage rather than log aggregation.
- A future Grafana stack can be introduced from observed needs instead of speculative dashboards.
