# Team Job Workflow

A sanitized-demo, role-aware application tracker for teams. It is a portfolio project; it does not automate access to job boards, submissions, messages, or real applicant data.

## Stack

- React + TypeScript Kanban client
- FastAPI + SQLAlchemy REST API
- PostgreSQL, Alembic migrations, Docker Compose
- Argon2id password hashing, JWT access tokens, owner/member authorization
- pytest, Vitest, and GitHub Actions CI

## Capabilities

- Create, discover, and select only the workspaces available through the caller's membership; owners can add already-registered `owner` or `member` accounts, while the API enforces owner-only membership changes.
- Track sanitized application records across saved, applied, interview, offer, and rejected stages.
- Filter, search, and paginate application lists.
- Open a Kanban card to create and complete tasks, add comments, and review its activity log for status changes and collaboration events.

## Local development

Install Node.js 24 LTS once, then prepare a user-level pnpm command that does not require administrator rights:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\setup-frontend-runtime.ps1
```

Open a new terminal after the setup command. The PowerShell examples below deliberately use pnpm.cmd because a default Windows execution policy can block Corepack's pnpm.ps1 shim.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements.lock
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Alembic is the only production schema initializer: the API does not create tables on startup, and `/health` reports `503` until the database is upgraded to the current revision.

If `local.sqlite3` was created by an older pre-migration build, it may contain tables without `alembic_version`; `alembic upgrade head` will correctly stop rather than overwrite it. Back up any unknown data first. For a disposable sanitized demo database, remove that file and run the migration command again; do not stamp an unverified database as current.

In a second terminal:

```powershell
Set-Location frontend
pnpm.cmd run verify:dependencies
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

The API is available at `http://127.0.0.1:8000`; the Vite UI is normally served at `http://127.0.0.1:5173`.
The API explicitly permits only the local Vite (`5173`) and Compose web (`8080`) origins; do not widen this list without an intentional deployment security review.
All direct frontend dependencies are fixed to exact versions, while `pnpm-lock.yaml` records the resolved package-integrity hashes. Keep both files in sync; the verification command and CI reject floating direct dependency specifiers. Python dependencies likewise use exact versions plus SHA-256 hashes; every local, Docker, and CI install requires those hashes.

## Docker

Docker Compose uses a development-only PostgreSQL password and starts the API on `127.0.0.1:8000` and web client on `127.0.0.1:8080`. The ports are deliberately bound only to the local machine. Python, Node, Nginx, and PostgreSQL base images are pinned to verified multi-architecture OCI digests; update a digest only with a new full verification run:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\run-docker-smoke.ps1
```

The smoke test waits for the API health endpoint, verifies Docker has bound both published ports only to loopback, then runs authenticated contracts against the Compose PostgreSQL stack with fresh `@example.test` users. It verifies owner/member authorization isolation, concurrent uniqueness conflicts return `201`/`409` rather than server errors, application status changes, task completion, comments, and the corresponding activity audit records before removing the containers and volume.

For the visible React workflow, install the frontend dependencies and Chromium once, then run the browser smoke:

```powershell
Set-Location frontend
pnpm.cmd exec playwright install chromium
Set-Location ..
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\run-browser-smoke.ps1
```

It drives the Compose UI through registration, workspace and application creation, movement to interview, task completion, comments, and visible activity records. This is a Chromium happy-path smoke test using fresh `@example.test` data; it is not cross-browser or visual-regression coverage.

For a persistent local stack, use `docker compose up --build`. When `TJW_SECRET_KEY` is unset, the API generates a new high-entropy key at startup, so local JWTs are intentionally invalidated after an API restart. Set a unique `TJW_SECRET_KEY` before any persistent or non-local use; do not deploy with the development database password.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
pnpm.cmd test
pnpm.cmd build
```

To write a local, ignored evidence manifest for the complete acceptance gate (tests, build, Docker smoke, exact-commit CI, documentation, and sanitized seed data), run:

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\record-verification-evidence.ps1
```

Use `-LocalOnly` only when the repository has not yet been pushed; it deliberately records `ci_passed: false`. A fully eligible manifest also records the exact Git commit it verified and requires no uncommitted tracked source changes, so the Resume Growth Coach planner rejects missing or stale evidence.

## Sanitized demo

After migrating a local database, create only fake data. The seed tool refuses an unversioned or outdated schema rather than creating tables itself:

```powershell
.\.venv\Scripts\python.exe tools\seed_demo.py
```

The seed creates two sample applications plus a task, comment, and activity records so the collaboration view is immediately demonstrable. The demo user is intentionally public test data. Never add a real resume, job description, account credential, or job-platform workflow to this repository.
