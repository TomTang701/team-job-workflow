# Team Job Workflow

A sanitized-demo, role-aware application tracker for teams. It is a portfolio project; it does not automate access to job boards, submissions, messages, or real applicant data.

## Stack

- React + TypeScript Kanban client
- FastAPI + SQLAlchemy REST API
- PostgreSQL, Alembic migrations, Docker Compose
- Argon2id password hashing, JWT access tokens, owner/member authorization
- pytest, Vitest, and GitHub Actions CI

## Capabilities

- Create workspaces and add already-registered members with `owner` or `member` roles; the API enforces owner-only membership changes.
- Track sanitized application records across saved, applied, interview, offer, and rejected stages.
- Filter, search, and paginate application lists.
- Open a Kanban card to create and complete tasks, add comments, and review its activity log for status changes and collaboration events.

## Local development

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

In a second terminal, use the bundled or installed Node.js runtime:

```powershell
Set-Location frontend
pnpm install
pnpm dev
```

The API is available at `http://127.0.0.1:8000`; the Vite UI is normally served at `http://127.0.0.1:5173`.
The API explicitly permits only the local Vite (`5173`) and Compose web (`8080`) origins; do not widen this list without an intentional deployment security review.

## Docker

Docker Compose uses a development-only PostgreSQL password and starts the API on port 8000 and web client on port 8080:

```powershell
.\scripts\run-docker-smoke.ps1
```

The smoke test waits for the API health endpoint, then runs an authenticated HTTP contract against the Compose PostgreSQL stack with fresh `@example.test` users. It verifies owner/member authorization isolation, application status changes, task completion, comments, and the corresponding activity audit records before removing the containers and volume.

For the visible React workflow, install the frontend dependencies and Chromium once, then run the browser smoke:

```powershell
Set-Location frontend
pnpm exec playwright install chromium
Set-Location ..
.\scripts\run-browser-smoke.ps1
```

It drives the Compose UI through registration, workspace and application creation, movement to interview, task completion, comments, and visible activity records. This is a Chromium happy-path smoke test using fresh `@example.test` data; it is not cross-browser or visual-regression coverage.

For a persistent local stack, use `docker compose up --build`. Do not deploy with the default `TJW_SECRET_KEY` or development database password.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
pnpm test
pnpm build
```

To write a local, ignored evidence manifest for the complete acceptance gate (tests, build, Docker smoke, exact-commit CI, documentation, and sanitized seed data), run:

```powershell
.\scripts\record-verification-evidence.ps1
```

Use `-LocalOnly` only when the repository has not yet been pushed; it deliberately records `ci_passed: false`.

## Sanitized demo

After migrating a local database, create only fake data:

```powershell
.\.venv\Scripts\python.exe tools\seed_demo.py
```

The seed creates two sample applications plus a task, comment, and activity records so the collaboration view is immediately demonstrable. The demo user is intentionally public test data. Never add a real resume, job description, account credential, or job-platform workflow to this repository.
