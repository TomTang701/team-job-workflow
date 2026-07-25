# Runtime Reliability Hardening Design

## Goal

Upgrade the Docker Compose smoke test from a health-only check to a disposable, HTTP-level collaboration workflow contract.

## Current Gap

`scripts/run-docker-smoke.ps1` verifies that PostgreSQL becomes healthy and that `/health` returns 200. It does not prove that the running Compose API can execute registration, authentication, role isolation, application tracking, tasks, comments, or activity auditing.

## Design

1. Add a PowerShell HTTP contract smoke helper that runs only against the local Compose API at `127.0.0.1:8000`.
2. Generate unique `@example.test` owner, member, and outsider accounts for every run. The helper must never use a real account or job-platform data.
3. Exercise this sequence through REST endpoints: registration, JWT-authenticated workspace creation, member invitation, owner-only rejection for member invitation, outsider workspace denial, application creation/status update, task completion, comment creation, and activity retrieval.
4. Make `run-docker-smoke.ps1` invoke the helper after the API health check. Its existing `finally` cleanup remains the authority for removing the disposable Compose volume and containers.
5. Add focused API regression tests for any uncovered response or authorization rule discovered while implementing the runtime contract.

## Acceptance Evidence

- A fresh `docker compose up --build` run passes the HTTP contract and cleans all containers and volumes.
- Backend and frontend suites remain green.
- The ignored verification manifest records the Docker smoke as passed only after this stronger contract succeeds.
- No production credentials, real resumes, or recruiting-platform interaction are introduced.

## Non-Goals

- Do not deploy the application or add a cloud environment.
- Do not change the public API design merely to make the smoke helper easier to write.
