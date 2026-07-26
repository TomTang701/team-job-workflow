# Runtime Reliability Hardening Plan

> **For Codex:** Execute these tasks directly in dependency order, using only sanitized `example.test` identities and the local Docker Compose stack.

**Goal:** Turn Docker Compose smoke verification from a health-only check into an HTTP contract test that proves authentication, authorization, application workflow, and activity auditing against PostgreSQL.

**Architecture:** A PowerShell contract-smoke script will call the running FastAPI API through HTTP and create fresh, unique sanitized users. The existing Docker smoke script will call it only after its health check and will retain the existing `finally` cleanup. Python API tests preserve fast in-process coverage; the new script detects container, routing, and PostgreSQL integration failures.

**Tech Stack:** FastAPI, PostgreSQL, Docker Compose, PowerShell 5.1-compatible scripts, pytest, Vitest.

---

### Task 1: Lock down missing authorization paths in API tests

**Files:**
- Modify: `tests/test_api.py`

**Step 1: Add focused coverage**

Add a test proving a member cannot invite workspace members and an unrelated authenticated user cannot read the workspace. Use the existing fixtures and test-client patterns.

**Step 2: Run the focused test**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_api.py -k "invite or outsider" -q`
Expected: pass if the existing owner and workspace checks are correctly enforced; otherwise use the failure as the reproduction before a minimal backend fix.

**Step 3: Run backend regression**

Run: `.\.venv\Scripts\python.exe -m pytest tests -q`
Expected: pass.

**Step 4: Commit**

```powershell
git add backend/tests/test_api.py
git commit -m "test: cover workspace authorization boundaries"
```

### Task 2: Add a Compose HTTP contract smoke

**Files:**
- Create: `scripts/run-compose-contract-smoke.ps1`
- Modify: `scripts/run-docker-smoke.ps1`

**Step 1: Write the script with explicit expected statuses**

Implement one request helper accepting method, path, optional JSON body, bearer token, and expected status. It must fail for an unexpected HTTP status and never print passwords or tokens.

**Step 2: Implement the sanitized workflow**

Against `http://127.0.0.1:8000` by default, register a unique owner, member, and outsider at `example.test`; create a workspace; invite the member; prove member invitation and outsider workspace reads are rejected with 403; then as member create an application, move it to interview, create and complete a task, and post a comment. Finally, retrieve application detail as the owner and assert `status_changed`, `task_completed`, and `comment_added` activities exist.

**Step 3: Wire it into the existing Docker smoke**

Invoke the new script after `/health` is confirmed. Preserve the existing Compose teardown in `finally` so a contract failure still cleans up containers.

**Step 4: Run Docker smoke**

Run: `.\scripts\run-docker-smoke.ps1`
Expected: Docker build, migration/startup, health check, HTTP contract, and teardown all pass.

**Step 5: Commit**

```powershell
git add scripts/run-compose-contract-smoke.ps1 scripts/run-docker-smoke.ps1
git commit -m "test: exercise compose API workflow"
```

### Task 3: Document and verify the strengthened acceptance gate

**Files:**
- Modify: `README.md`

**Step 1: Update documentation**

State that the Docker smoke includes an authenticated, authorization-isolated API workflow using sanitized generated identities. Preserve the project's existing lightweight documentation structure rather than inventing development-log files.

**Step 2: Run full gates**

Run: `.\.venv\Scripts\python.exe -m pytest tests -q`
Run from `frontend`: `pnpm.cmd test`
Run from `frontend`: `pnpm.cmd build`
Run: `.\scripts\run-docker-smoke.ps1`
Run: `.\scripts\record-verification-evidence.ps1`

Expected: all application, frontend, Compose-contract, documentation, sanitization, and exact-head CI gates pass.

**Step 3: Review and commit**

Run: `git diff --check`
Run: `git status --short`
Commit only intentional files and the evidence manifest if updated; preserve unrelated files.
